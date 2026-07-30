# NeureCore — Deployment Procedure

**Audience:** Anyone pushing a change to Contabo.
**Sibling docs:** [operations.md](operations.md), [disaster-recovery.md](disaster-recovery.md).

> **2026-07-23 (FIX-COMPREHENSIVE + R2) caveat:** `backend/package.json` includes `compression` + `lru-cache` added 2026-07-21 per FIX-PERF-001, but `pnpm-lock.yaml` does not capture them. `scripts/deploy.sh` enforces `--frozen-lockfile` and will fail with `ERR_PNPM_OUTDATED_LOCKFILE`. Workaround until `scripts/deploy.sh` is updated to detect lockfile drift: see [contabo-ops.md §4.3](contabo-ops.md#43-use-pnpm9159-on-contabo).

---

## TL;DR

```bash
# From local workspace root
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant       # or admin / backend / all
```

That's it. The script rsyncs source (excluding build artifacts and `.env`) and triggers the on-server rebuild.

---

## 1. Deploy one app

```bash
./scripts/deploy.sh tenant       # Frontend-Tenant (Next.js)
./scripts/deploy.sh admin        # Frontend-Admin  (Next.js)
./scripts/deploy.sh backend      # Backend         (NestJS)
```

What the script does:

1. **rsync** from `$LOCAL_ROOT/<app>/` → `contabo:/opt/neurecore/<app>/` (or `backend/backend/` for backend), excluding:
   - `node_modules`
   - `.next` / `dist`
   - `.env` / `.env.local` / `.env.production`
   - `tsconfig.tsbuildinfo`
   - `.git`
2. **ssh** to Contabo and run `bash /opt/neurecore/rebuild.sh <app>`, which:
   - `npm ci --omit=dev=false`
   - `next build` (or `nest build` for backend)
   - `prisma migrate deploy` (backend only)
   - `pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-<app>`

**If `npm ci` fails with peer dependency errors**, it means the deployed `package.json` has an incompatible dependency tree. Fall back to:
```bash
ssh contabo 'cd /opt/neurecore/<app> && npm install --legacy-peer-deps'
```
`npm install` tolerates peer dependency mismatches. After fixing the root cause (update `package.json` to resolve the conflict locally and redeploy), switch back to `npm ci` for faster, deterministic installs.

**If `pnpm install --frozen-lockfile` fails with `ERR_PNPM_OUTDATED_LOCKFILE`**, it means `package.json` was updated without regenerating the lockfile. This is the current state of `backend/package.json` since 2026-07-21 (added `compression`, `lru-cache`). Run on Contabo first:
```bash
ssh contabo 'cd /opt/neurecore/<app> && pnpm install --no-frozen-lockfile'
```
Then re-run `bash /opt/neurecore/rebuild.sh <app>`. Tracked in [pending-tasks.md §B.2](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).

**If build output is stale after source changes**, Next.js webpack persistent cache can survive `rm -rf .next`. Clear it:
```bash
ssh contabo 'cd /opt/neurecore/<app> && rm -rf .next node_modules/.cache && npm run build'
```
The persistent cache lives at `.next/cache/webpack/` — `node_modules/.cache` covers additional caching layers. After clearing, chunks will have new content hashes.

After completion, smoke test:

```bash
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

---

## 2. Deploy all

```bash
./scripts/deploy.sh all
```

This rsyncs all three apps and triggers `rebuild.sh all`. Order: tenant → admin → backend.

---

## 3. Deploy only the on-server build step (no rsync)

If you've already rsynced manually and just want to rebuild on the server:

```bash
ssh contabo 'bash /opt/neurecore/rebuild.sh backend'   # or tenant / admin / all
```

This is the right call when:
- You changed files directly on Contabo (and committed them).
- You're iterating on the server-side rebuild script itself.

---

## 4. Adding a new service to the ecosystem

1. Edit `/opt/neurecore/ecosystem.config.js` on Contabo, adding a new `apps[]` entry.
2. Mirror the change locally at `scripts/contabo/ecosystem.config.js`.
3. Validate: `node -c /opt/neurecore/ecosystem.config.js`
4. Reload: `ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'`
5. Verify: `ssh contabo 'pm2 list | grep neurecore'`

Template for a new entry:
```js
{
  name: 'neurecore-<app>',
  cwd: '/opt/neurecore/<app>',
  script: './start.sh',
  interpreter: 'bash',
  exec_mode: 'fork',
  instances: 1,
  autorestart: true,
  max_memory_restart: '512M',
  env: { NODE_ENV: 'production', PORT: '<port>' },
  out_file: '/root/.pm2/logs/neurecore-<app>-out.log',
  error_file: '/root/.pm2/logs/neurecore-<app>-error.log',
  merge_logs: true,
}
```

---

## 5. Adding a new vhost

For a new hostname (e.g. `docs.neurecore.com`) pointing to a new app on a new internal port:

1. Add the app to `ecosystem.config.js` (see §4).
2. Create the OLS vhost:

```bash
ssh contabo '
  VH=/usr/local/lsws/conf/vhosts/docs.neurecore.com
  mkdir -p $VH
  cat > $VH/vhost.conf <<'\''VHEOF'\''
docRoot                   /home/neurecore.com/docs/html
vhDomain                  $VH_NAME
vhAliases                 www.$VH_NAME
adminEmails               admin@neurecore.com
enableGzip                1

extProcessor neurecore_docs {
  type                    proxy
  address                 127.0.0.1:<port>
  maxConns                200
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

rewrite  {
  enable                  1
  autoLoadHtaccess        0
  rules                   <<<END_RULES
RewriteCond %{REQUEST_URI} ^/\\.well-known/acme-challenge/
RewriteRule .* - [L]
RewriteRule ^(.*)$ http://neurecore_docs/$1 [P,L]
END_RULES
}

context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1
  rewrite  { enable 0 }
  addDefaultCharset       off
}

context / {
  type                    proxy
  handler                 neurecore_docs
  addDefaultCharset       off
}

vhssl  {
  keyFile                 /etc/letsencrypt/live/docs.neurecore.com/privkey.pem
  certFile                /etc/letsencrypt/live/docs.neurecore.com/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling           1
  ocspRespMaxAge           86400
}
VHEOF

  /usr/local/lsws/bin/litespeed -t   # validate
  systemctl restart lsws              # apply
'
```

3. Add DNS A record pointing to `109.123.248.253`.
4. Request Let's Encrypt cert: `ssh contabo 'certbot certonly --noninteractive --agree-tos -m admin@neurecore.com --webroot -w /usr/local/lsws/Example/html -d docs.neurecore.com'`.
5. Update CORS proxy allowed origins (§4 of operations.md).

---

## 6. Frontend env changes

`.env.production` is **not** rsynced from local (it would expose dev URLs). To change a public env var:

```bash
# 1. Edit on Contabo
ssh contabo 'nano /opt/neurecore/frontend-tenant/.env.production'

# 2. Rebuild (env is inlined at build time)
ssh contabo 'bash /opt/neurecore/rebuild.sh tenant'
```

Never put secrets in `.env.production` for the frontends — only `NEXT_PUBLIC_*` vars (which are public).

---

## 7. Backend env changes

`/opt/neurecore/backend/backend/.env` is **never** overwritten by rsync. Edit it directly on Contabo:

```bash
ssh contabo 'nano /opt/neurecore/backend/backend/.env'

# After any change, restart:
ssh contabo 'pm2 restart neurecore-backend'
```

If you change `schema.prisma`:
```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/prisma migrate deploy   # only if you also added a migration locally
  ./node_modules/.bin/nest build
  pm2 restart neurecore-backend'
```

---

## 8. Files to keep in sync between local and Contabo

| Local path | Contabo path | Sync direction |
|---|---|---|
| `frontend-tenant/` | `/opt/neurecore/frontend-tenant/` | local → Contabo (via deploy.sh) |
| `frontend-admin/` | `/opt/neurecore/frontend-admin/` | local → Contabo |
| `backend/` | `/opt/neurecore/backend/backend/` | local → Contabo |
| `scripts/contabo/ecosystem.config.js` | `/opt/neurecore/ecosystem.config.js` | bidirectional (mirror) |
| `rebuild.sh` | `/opt/neurecore/rebuild.sh` | bidirectional (mirror) |
| `frontend-*/.env.production` | `/opt/neurecore/frontend-*/.env.production` | **Contabo → local only**, never the reverse |
| `backend/.env` | `/opt/neurecore/backend/backend/.env` | **Contabo → local only**, never the reverse |
| `/etc/letsencrypt/live/*` | — | Contabo-only (managed by certbot) |
| `/usr/local/lsws/conf/vhosts/*` | — | Contabo-only (managed by CyberPanel) |

---

## 9. Rollback

If a deploy breaks something:

```bash
# Rollback to a snapshot — see disaster-recovery.md §3
ssh contabo '
  SNAP=/opt/neurecore/_archives/<previous-snapshot-dir>
  cd /opt/neurecore/backend/backend   && tar -xzf $SNAP/backend-dist.tar.gz
  cd /opt/neurecore/frontend-tenant  && tar -xzf $SNAP/frontend-tenant-.next.tar.gz
  pm2 startOrReload /opt/neurecore/ecosystem.config.js
'
```

For code rollback (revert a bad commit):

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  git log --oneline -5
  git checkout <good-commit>
  ./node_modules/.bin/nest build
  pm2 restart neurecore-backend'
```

---

## 10. Pre-deploy checklist

Before `./scripts/deploy.sh`, run this from local:

```bash
# 1. Confirm git is clean on local
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
git status                                    # should be clean (or only intended changes)

# 2. Confirm local builds work (NOT just lint)
cd frontend-tenant && npm run build && cd ..   # next build catches what lint misses
cd backend        && npm run build && cd ..   # nest build catches missing destructures, type errors
```

**Why `npm run build` and not just `npm run lint`?** — `next lint` (and `eslint` in general) does NOT catch missing destructures, unused imports in certain patterns, or type-system errors. A pre-existing build error in `frontend-tenant/src/app/command-center/page.tsx` (called `setWorkflows` from `useWorkflowStore` but never destructured it) survived **multiple lint passes** and was only caught by `next build`. Lint said "0 errors"; the build said "Type error: Cannot find name 'setWorkflows'". If we'd run the build, we'd have caught it before the 1.7 MB rsync. (See [fixes.md FIX-019](fixes.md#fix-019--comprehensive-home-page-audit-5-issues-fixed) §"Build error" for the post-mortem.)

**The local build catches:**
- Type errors (missing destructures, wrong generics, undefined names)
- Module resolution errors (import paths that no longer exist)
- `next.config.js` / `tsconfig.json` errors
- `next/image` / `<Image>` constraints
- Server-only imports leaking into client components

**The local build does NOT catch:**
- Production-only env-var behaviour (NEXT_PUBLIC_* is inlined at build time)
- Network/connectivity (only runtime tests catch this)
- localStorage shape drift in user browsers (FIX-019 added `merge` to defensively handle)

```bash
# 3. Confirm Contabo is reachable and healthy
ssh contabo 'pm2 list | grep neurecore'        # all 4 online
curl -sk https://brain.neurecore.com/api/v1/health   # 200

# 4. Take a fresh DR snapshot (always — even for "small" changes)
ssh contabo 'mkdir -p /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S) && \
  cd /opt/neurecore/backend/backend   && tar -czf /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)/backend-dist.tar.gz dist/'
# (full DR recipe in disaster-recovery.md §4)
```

If any check fails, **do not deploy**. Fix the issue first.

## 11. Troubleshooting common deploy failures

| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails with `peer dep` error | Incompatible dependency tree in `package.json` | `npm install --legacy-peer-deps` (see §1) |
| Build succeeds but frontend still shows old behaviour | Next.js webpack persistent cache | `rm -rf .next node_modules/.cache && npm run build` (see §1) |
| Frontend requests go to `localhost:3000` on production | Source code has hardcoded `?? 'http://localhost:3000/api/v1'` fallback | Replace with `/api/v1` (same-origin). Check: `grep -r 'localhost:3000' src/` |
| `pm2 restart` doesn't reflect changes | Build output cached, or `rsync --delete` removed `start.sh` | Check `ls /opt/neurecore/<app>/.next` exists; ensure `start.sh` is present |
| Build on Contabo fails: `Type error: Cannot find name 'X'` | Pre-existing TypeScript error in source — `npm run lint` did not catch it | **Run `npm run build` locally BEFORE rsync** — see [§10 Pre-deploy checklist](deployment.md#10-pre-deploy-checklist). The build catches missing destructures, wrong generics, etc. that lint misses. |
| Browser console: `TypeError: can't access property "length", n is undefined` on a tenant page | Zustand `persist` middleware hydrated a non-array from corrupted `localStorage` | See [runbook.md §3.1](runbook.md#31-tenant-cant-access-property-length-crash) and [frontend-tenant.md §19](frontend-tenant.md#19-defensive-patterns-zustand-merge--ui-guards-fix-019) |
| `wss://brain.neurecore.com/socket.io/` connection failure | WebSocket URL fallback to dev `localhost:3000` (FIX-019) | See [runbook.md §3.2](runbook.md#32-tenant-websocket-connection-failure) |
| 500 `PrismaClientValidationError: Invalid value for argument 'in'. Expected <EnumName>.` | Code is querying an enum value that does not exist in the actual Postgres enum (e.g. `IN_PROGRESS` not in `ApprovalStatus`) | See [fixes.md FIX-030](fixes.md#fix-030--approval-workflow-invalid-value-for-argument-in-in_progress-not-in-approvalstatus-enum). Cross-check enum values: `psql ... -c "SELECT enumlabel FROM pg_enum WHERE pg_enum.enumtypid = '<EnumName>'::regtype;"` |
| 500 `PrismaClientKnownRequestError: The column <Model>.<field> does not exist` OR `relation <Model> does not exist` | Prisma schema is mapping the model to a different table name than the database uses. Likely `@@map()` is missing or wrong on the model | See [fixes.md FIX-029](fixes.md#fix-029--approval-workflow-column-does-not-exist-missing-map-on-prisma-models). Verify with: `SELECT tablename FROM pg_tables WHERE tablename ILIKE '%<modelname>%';` and add `@@map("<actual_table>")` to the model |
| 500 `PrismaClientUnknownRequestError: type "public.<EnumName>" does not exist` | DB has the enum but with a different case (e.g. lowercase `memory_category` vs Prisma's PascalCase `MemoryCategory`) | See [fixes.md FIX-031](fixes.md#fix-031--lowercase-postgres-enum-types-drift-from-prisma-pascalcase-names). Rename in-place: `ALTER TYPE <lowercase_name> RENAME TO "<PascalCaseName>";` |
| 400 `INVALID_REQUEST: <field> must be a UUID` from any DTO endpoint | DTO uses `@IsUUID()` but the field value is a CUID (NeureCore uses `@default(cuid())` everywhere, not UUIDs) | See [fixes.md FIX-028](fixes.md#fix-028--goals-creation-400-bad-request-isuuid-on-cuid-fields). Replace `@IsUUID()` with `@IsString()` in the DTO. Audit all DTOs for the same pattern |
| 500 `Socket.IO ... 400` errors in browser console (real-time features silently broken) | Likely OLS vhost missing `RewriteRule` for `/socket.io/` path, or backend WebSocketGateway not configured for CORS | Compare OLS config with D12.5 example. Check `pm2 logs neurecore-backend` for WebSocket connection errors. See [pending-tasks.md D22](pending-tasks.md) |

---

## 12. Database schema drift: enum case + missing `@@map()`

**Audience:** Anyone who hits a Prisma error about a missing column, missing relation, or missing enum type, and is unsure whether to fix the schema or the database.

NeureCore uses Prisma's `@default(cuid())` for all primary keys. The schema defines enum types (e.g. `DeliverableStatus`, `MemoryCategory`) using `enum` blocks, and Prisma expects those types to exist in Postgres with **PascalCase names matching the schema**.

Over time, several migrations have created enum types in the database with **lowercase snake_case names** instead of PascalCase. This causes 500 errors on any endpoint that uses those enums (e.g. `POST /deliverables` → `type "public.DeliverableStatus" does not exist`).

A second related issue: when a model is added to the Prisma schema **without `@@map()`**, Prisma assumes the table name is the PascalCase model name (e.g. `model ApprovalWorkflow` → table `ApprovalWorkflow`). If a migration created the table as `approval_workflows` (snake_case), Prisma queries the wrong table and 500s.

### Detection

```sql
-- 1. List all enum types in the database (casing should match Prisma schema)
SELECT typname FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e'
ORDER BY typname;

-- 2. Check which enums are lowercase (these need renaming)
SELECT typname FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e' AND typname ~ '^[a-z]'
ORDER BY typname;

-- 3. Check which tables don't match their Prisma model names
-- (compare against grep '^model ' prisma/schema.prisma)
```

### Fix procedure (for enum case drift)

Apply `ALTER TYPE ... RENAME TO` directly to the database via `psql` or `pgAdmin`. **This is reversible** (rename only, no data loss) and does not require a Prisma migration:

```bash
# From any host with psql + DATABASE_URL
PGPASSWORD=... psql -h <host> -U <user> -d <db> <<'SQL'
BEGIN;
ALTER TYPE deliverable_status RENAME TO "DeliverableStatus";
ALTER TYPE memory_category    RENAME TO "MemoryCategory";
ALTER TYPE decision_status    RENAME TO "DecisionStatus";
ALTER TYPE risk_tier          RENAME TO "RiskTier";
ALTER TYPE approval_type      RENAME TO "ApprovalType";
ALTER TYPE thread_status      RENAME TO "ThreadStatus";
COMMIT;
SQL
```

No `prisma migrate` is needed; the schema is already correct. No application code changes are required. Just restart `pm2 restart neurecore-backend` after the rename.

### Fix procedure (for missing `@@map()`)

Add `@@map()` to the model in `prisma/schema.prisma`, then:

```bash
npx prisma generate     # regenerate client
npm run build           # rebuild
pm2 restart neurecore-backend
```

### Prevention

- **Pre-commit hook:** fail the commit if any `model X` in `prisma/schema.prisma` doesn't have a `@@map()` directive. See [pending-tasks.md D24](pending-tasks.md).
- **CI step:** `prisma db pull` → diff against `prisma/schema.prisma`; any enum name case mismatch fails. See [pending-tasks.md D25](pending-tasks.md).
- **Migration review:** every new migration that creates an enum type or table must use the exact case Prisma expects (PascalCase for enum types matching the `enum` block; PascalCase or snake_case for tables matching the `@@map` directive).