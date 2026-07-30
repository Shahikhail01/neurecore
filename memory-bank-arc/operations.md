# NeureCore — Operations Reference

**Audience:** Anyone operating or debugging the 3 services on Contabo.
**Sibling docs:** [system-state.md](system-state.md) for current inventory, [deployment.md](deployment.md) for deploys, [runbook.md](runbook.md) for quick health checks, [disaster-recovery.md](disaster-recovery.md) for restores.

---

## 1. SSH access

```bash
ssh contabo                  # alias defined in ~/.ssh/config, user root
```

Passwordless via SSH key (`~/.ssh/id_ed25519`). If you don't have the key, use `sudo bash scripts/connect_contabo.sh` which reads a password from a file (default `/root/contabo`).

---

## 2. PM2 — process manager

### 2.1 View processes

```bash
ssh contabo 'pm2 list'
ssh contabo 'pm2 jlist' | python3 -c "..."   # structured output
ssh contabo 'pm2 show neurecore-backend'
```

### 2.2 The 4 neurecore processes

Always managed through `/opt/neurecore/ecosystem.config.js`. **Never** create them via ad-hoc `pm2 start`.

| PM2 name | What | Port |
|---|---|---|
| `neurecore-backend` | NestJS | 3003 |
| `neurecore-tenant` | Next.js (hq.neurecore.com) | 3001 |
| `neurecore-admin` | Next.js (cc.neurecore.com) | 3020 |
| `neurecore-cors-proxy` | dev CORS sidecar | 3004 |

### 2.3 Reload from ecosystem

```bash
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'
# Reload only one app:
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant'
```

### 2.4 Logs

```bash
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw'
ssh contabo 'pm2 logs neurecore-tenant --lines 100 --nostream --raw'
ssh contabo 'tail -f /root/.pm2/logs/neurecore-admin-error.log'
```

### 2.5 Survival across reboots

PM2 dump is saved to `/root/.pm2/dump.pm2`. On boot, `pm2 resurrect` (or systemd/pm2 startup) restores it. Verify:

```bash
ssh contabo 'pm2 resurrect --help'    # if not running, run it
```

---

## 3. OpenLiteSpeed (CyberPanel)

### 3.1 Where vhost configs live

```
/usr/local/lsws/conf/vhosts/
├── hq.neurecore.com/vhost.conf      # → 127.0.0.1:3001
├── cc.neurecore.com/vhost.conf      # → 127.0.0.1:3020
└── brain.neurecore.com/vhost.conf   # → 127.0.0.1:3003
```

Each vhost has `extProcessor <name> { address 127.0.0.1:<port> }` and a `context /` that proxies to that extProcessor.

### 3.2 Reload OLS after vhost edit

```bash
ssh contabo '/usr/local/lsws/bin/litespeed -t'   # test config
ssh contabo 'systemctl restart lsws'             # or: kill -HUP $(pidof litespeed)
```

### 3.3 CyberPanel-specific paths

- CyberPanel admin UI: `https://<server>:7080`
- CyberPanel docRoot per vhost: `/home/<domain>/public_html/`
- CyberPanel manages certs via `certbot`; renewal cron lives at `/etc/cron.d/certbot`

### 3.4 Vhost quirks

- **`hq.neurecore.com`** has a catch-all rewrite: `RewriteRule ^(.*)$ http://neurecore_tenant/$1 [P,L]` — every path (including `/api/v1/*`) is proxied to the tenant Next.js on port 3001. Tenant's `NEXT_PUBLIC_API_URL=/api/v1` means it makes relative requests that hit this proxy, which forwards to Next.js, which itself has internal fetch logic to call backend. **Net result:** `/api/v1/agents` returns `401` (auth required, expected); `/api/v1/auth/login` on GET returns `404` because Next.js can't serve a route that the backend owns.
- **`cc.neurecore.com`** rewrites `/` and **21** admin paths (admin, login, agents, agents-pool, audit, billing, brain, connectors, departments-pool, dept-templates, features, industries, infrastructure, models, monitoring, overview, packages, security, settings, strategy, tenants, tier-templates, tiers, users) to `/admin/<path>` inside Next.js, then catch-all proxies. The admin frontend's `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` is absolute — the browser calls backend directly. Phase 10 added six new pool routes (`/agents-pool`, `/departments-pool`, `/industries`, `/tiers`, `/features`, `/packages`); three legacy routes (`/agent-templates`, `/dept-templates`, `/tier-templates`) 302-redirect to the new ones.
- **`brain.neurecore.com`** has an extProcessor `nodeapi` that proxies to `127.0.0.1:3003`. CORS headers are added by the vhost itself (not by NestJS).

---

## 4. CORS proxy

`/opt/neurecore/cors-proxy.js` is a small (50-line) Node `http.createServer` proxy. It listens on `127.0.0.1:3004` and forwards to `127.0.0.1:3003`. Allowed origins are hard-coded in `ALLOWED_ORIGINS`.

### 4.1 When to use it

- **Production:** requests from `https://hq.neurecore.com`, `https://cc.neurecore.com`, `https://brain.neurecore.com` are CORS-handled by the OLS vhost. The proxy is **not** needed in production.
- **Development:** a developer running `next dev` on `localhost:3005` needs the proxy because OLS isn't involved. Their browser sends `Origin: http://localhost:3005` → CORS proxy accepts → forwards to backend.

### 4.2 Adding a new origin

```bash
ssh contabo 'nano /opt/neurecore/cors-proxy.js'   # add to ALLOWED_ORIGINS
ssh contabo 'pm2 restart neurecore-cors-proxy'
curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
  -H "Origin: https://new-origin.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  | grep -iE "^HTTP|access-control-allow"
```

Expected: `HTTP/1.1 204 No Content` and `Access-Control-Allow-Origin: https://new-origin.example.com`.

### 4.3 Why CORS is not in NestJS

Earlier versions of the backend had CORS configured in NestJS. We removed it because:
1. The OLS vhost already adds CORS headers for production origins.
2. NestJS CORS blocks browser preflights from any non-allowlisted origin, which breaks dev.
3. The sidecar approach lets us add origins without restarting the backend.

**Do NOT add CORS to NestJS main.ts.** Keep it in the sidecar.

---

## 5. Backend — specific gotchas

### 5.0 Brevo / Socket.IO / Industry — Run-3 deployment notes (2026-07-25)

- **Brevo master-key fallback**: `BREVO_MASTER_API_KEY` in `/opt/neurecore/backend/backend/.env` is the platform-wide fallback. `getBrevoConnectionStatus` returns `{ connected: true, source: 'master' }` when only the master key is configured. The card on `/settings/integrations` now shows "Connected (Master Key)" with an amber call-to-action to upgrade.
- **Socket.IO polling noise (FIX-INDUSTRY-VERIFY-3)**: The backend `events.gateway.ts` now sets `pingInterval: 60_000`, `pingTimeout: 90_000`, `maxHttpBufferSize: 1_048_576`, `allowEIO3: true` to give the OLS-fronted polling transport enough headroom. The `unauthorized` event is emitted before `disconnect(true)` on bad JWT. Browser console will still show ~1-2% POST-poll 400s (cosmetic, non-blocking).
- **Industry workspace pages (FIX-D06)**: All 8 routes under `/workspace/{engagements,loans,portfolios,audits,tax,payroll,compliance,risk}` now render `<IndustryWorkspacePage config={...} />` backed by `/api/v1/projects?industry=...` and `/api/v1/project-types?industry=...`. No infra changes needed; rebuild + restart tenant only.
- **Fiscal Year End field (FIX-D07)**: `CustomerFieldType` extended with `month-day`. Persists as `MM-DD` string. Rendered as two `<select>` (Month 01-12, Day 01-31) with `aria-label` for screen readers.
- **Re-deploy procedure for these fixes**:
  ```bash
  rsync -a backend/ contabo:/opt/neurecore/backend/backend/
  rsync -a frontend-tenant/ contabo:/opt/neurecore/frontend-tenant/
  ssh contabo 'bash /opt/neurecore/scripts/rebuild.sh backend && bash /opt/neurecore/scripts/rebuild.sh tenant'
  ssh contabo 'pm2 restart neurecore-backend neurecore-tenant'
  ```

### 5.0b Industry verification run-5 — 8 functional defects + DB fixes (2026-07-25 13:45 PKT)

**8 defects found, all fixed and deployed.** Full report at `audits/2026-07-25-industry-verification/final-report.md`. Fix detail in `fixes.md §FIX-INDUSTRY-VERIFY-5`.

**Code fixes (4 files):**
- `backend/src/modules/compliance/compliance.controller.ts` — `@Controller('api/v1/compliance')` → `@Controller({ path: 'compliance', version: '1' })` (D10)
- `backend/src/modules/workflows/workflows.controller.ts` — renamed route `/industry-templates` → `/templates/industry` (D11)
- `backend/src/modules/project-types/repositories/prisma-project-type.repository.ts` — added dedup by (slug, industry) preferring tenant-scoped rows (D15)
- `backend/src/modules/tiers/services/tier-provisioning.service.ts` — added `linkAgentsToDepartments` helper, wired into both `provisionAgents` and `selectIndustryDefaultAgents` (D16)

**DB fixes (4 SQL operations, applied directly to Contabo via psql):**
- `department_templates` UPDATE — `accounting` template trimmed 12 → 10 agents (D12)
- `industries` INSERT — added `insurance` industry to `financial-compliance` group (D13)
- `tiers` UPDATE — `tier-government-003` description corrected (D14)
- `agents` UPDATE — backfill `departmentId` for 85 orphan agents (D16)

**Deployment sequence used (not the deploy.sh which has the PM2 cwd gap from FIX-INDUSTRY-VERIFY-4):**
```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
./node_modules/.bin/nest build          # local build
bash /home/najeeb/Linux-Dev/neurecore-2026/neurecore/scripts/deploy.sh backend  # rsync + rebuild + pm2 reload

# Manual SQL changes for DB-only fixes
ssh contabo 'psql -U neurecore_app -h 127.0.0.1 -d neurecore_prod -c "UPDATE ..."'
```

**Important new gotcha — `routes affected by D11`:**
- Old URL: `GET /api/v1/workflows/industry-templates` — DELETED
- New URL: `GET /api/v1/workflows/templates/industry?group=<slug>`
- FE grep confirmed no client uses the old URL (Stage 2 Phase 2D templates surface differently in the FE). But any external integration or custom script that called the old URL will now 404.

### 5.0c Industry verification run-6 — 6 defects fixed + 2 new seeders + 1 inline DB update (2026-07-25 20:06 PKT)

**6 defects found, all fixed and deployed; 5 follow-up items documented for next round.** Full report at `audits/2026-07-25-industry-verification-run6-professional/final-report.md`. Fix detail in `fixes.md §FIX-INDUSTRY-VERIFY-6`.

**Code fixes (5 files, 6 edits):**
- `backend/src/modules/industry/tier-industry-matrix.ts:44` — added `'insurance'` to F&C `INDUSTRY_GROUP_INDUSTRIES` (D18)
- `backend/src/modules/department-templates/department-templates.service.ts:13-22` — replaced stale hardcoded map with canonical slugs (D18)
- `frontend-tenant/src/lib/industryGroups.ts:73` — added `'insurance'` to F&C (D18)
- `frontend-admin/src/lib/industries.ts` — added `'insurance'` slug, label, and group map (3 separate edits) (D18)
- `frontend-tenant/src/app/customers/page.tsx:16, 216-218` — import `getIndustryNavConfig`; use industry-aware h1 (D24)
- `frontend-tenant/src/components/onboarding/PlanImpactPanel.tsx:165` — added "(N in pool · M tier cap)" caption (D19)

**New seeders (2 files, ~400 lines, both in repo):**
- `backend/prisma/seed-healthcare-department-template.cjs` (D21) — 8-dept `healthcare-clinic` template. Idempotent upsert on slug.
- `backend/prisma/seed-healthcare-agent-templates.cjs` (D29) — 8 AgentTemplates (upserted by name, no slug column on AgentTemplate) + 8 TierAgentPool rows on Professional tier + 8 backfilled Agents for the pre-existing healthcare tenant. Idempotent.

**DB fixes (1 inline update, applied directly to Contabo via `node -e`):**
- `department_templates` UPDATE — `accounting` template description: "12 AI Employees" → "10 AI Employees" (D20). (D12 already trimmed the structure in Run-5 but didn't sync the description string.)

**Seeded data on Contabo (idempotent runs):**
- `healthcare-clinic` DepartmentTemplate — id=33d36960-fff7-4f54-a864-649d9735f50a, structure=8 depts, category=`healthcare`, tags=`['healthcare','industry:healthcare','healthcare-life-sciences','clinic']`, isPublic=true
- 8 AgentTemplate rows (Clinical Operations Coordinator, Nurse Practitioner, Medical Records Clerk, Pharmacy Manager, Lab Technician, Patient Advocate, Billing Specialist Healthcare, Practice Manager) with type=role pairs and full system prompts
- 8 TierAgentPool rows on `tier_pro` at slots 1-8, all with `isDefaultSelected=true`
- 8 Agent rows backfilled to `ReVerify Community Health Alliance` tenant (round-robin to existing 8 departments)

**Deployment sequence used (manual rebuild + restart, deploy.sh used for sync only):**
```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
./node_modules/.bin/nest build
bash /home/najeeb/Linux-Dev/neurecore-2026/neurecore/scripts/deploy.sh backend  # rsync + rebuild + pm2 reload
ssh contabo 'pm2 restart neurecore-backend'  # not just reload, hard restart needed after Prisma client regen

cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant
./node_modules/.bin/next build
bash /home/najeeb/Linux-Dev/neurecore-2026/neurecore/scripts/deploy.sh tenant  # rsync + rebuild + pm2 reload

# Manual PM2 hard-restart per FIX-INDUSTRY-VERIFY-4 deploy-path workaround
ssh contabo 'pm2 delete neurecore-tenant && pm2 start /opt/neurecore/frontend-tenant/start.sh --name neurecore-tenant'
ssh contabo 'pm2 restart neurecore-admin'  # to pick up the new admin build

# Then run the new seeders
scp /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/seed-healthcare-department-template.cjs contabo:/opt/neurecore/backend/backend/prisma/
ssh contabo 'cd /opt/neurecore/backend/backend && set -a; source .env; set +a; node prisma/seed-healthcare-department-template.cjs'

scp /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/prisma/seed-healthcare-agent-templates.cjs contabo:/opt/neurecore/backend/backend/prisma/
ssh contabo 'cd /opt/neurecore/backend/backend && set -a; source .env; set +a; node prisma/seed-healthcare-agent-templates.cjs'

# Inline DB update for the accounting description
ssh contabo 'cd /opt/neurecore/backend/backend && set -a; source .env; set +a; node -e "const{PrismaClient}=require(\"@prisma/client\");const p=new PrismaClient();(async()=>{await p.departmentTemplate.update({where:{slug:\"accounting\"},data:{description:\"Department template for Accounting with 10 AI Employees. Includes AP/AR, Audit Coordinator, Budget, Cost, Financial Reporting, Fixed Assets, GL, Payroll, Tax Compliance roles.\"}});console.log(\"OK\")})().finally()=>p.$disconnect())"'
```

**Confirmed gotcha (re-stated from Run-4):** After running `pm2 reload neurecore-tenant` via `rebuild.sh` or `deploy.sh`, the served `page-*.js` chunk hash is still the old build because PM2's working directory `/opt/neurecore/frontend-tenant/` was rsynced but the running Next.js process still has the in-memory chunk list. The fix is `pm2 delete neurecore-tenant && pm2 start <start.sh>` to force a full restart. Future improvement: update the PM2 ecosystem config to point at `apps/tenant/current/` so the deploy script's atomic-release pattern works correctly. (This is the same issue as FIX-INDUSTRY-VERIFY-4 §Deploy-Path Discovery; root fix still pending.)

**Smoke-test after deploy (post-fix):**
```bash
# D18
curl -sk https://brain.neurecore.com/api/v1/industries/groups | jq '.data[] | select(.slug=="financial-compliance") | .industrySlugs'
# expect: ["accounting-audit-services","financial-services","insurance"]

# D21
curl -sk 'https://brain.neurecore.com/api/v1/department-templates?industryGroup=healthcare' | jq '.data.total'
# expect: 1

# D24 (requires browser)
# Login as Fatima → /customers → h1 should say "Patients"
# Login as Hamza  → /customers → h1 should say "Clients & Accounts"

# D29
# Login as Fatima → /departments → KPI strip should show "8 / 8"

# D20
# New accounting tenant → /onboarding/setup → Step 5 Template
# "Accounting" card should read "10 AI Employees"
```

### 5.1 Working tree pollution

`/opt/neurecore/backend/backend` is a real git checkout. It often has uncommitted changes because:
- ~~Someone rsync'd `Temp/` into the parent dir by accident, polluting git with `../Temp/paperclip-master/` deletions (~1682 entries).~~ **RESOLVED 2026-07-04**: `Temp/` is now properly gitignored at the repo root; `git status --short` shows 0 paperclip-related entries. The filter below is no longer strictly necessary but is kept as a safety net.
- Local edits made directly on Contabo and not committed.

**Filter (recommended for clarity):**
```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'
```

This shows only backend-relevant changes.

### 5.2 Stash before deploy

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && \
  git stash push -u -m "SNAPSHOT-$(date +%Y%m%d-%H%M%S)-pre-deploy" -- src/ prisma/'
```

**Never** use raw `git stash` — it picks up paperclip noise and amplifies it. (Historical caution; currently a non-issue since paperclip is gitignored, but the habit is good.)

### 5.3 pnpm

**RESOLVED 2026-07-04**: `pnpm@9.15.9` installed globally on Contabo via `npm install -g --force pnpm@9`. Replaces the broken corepack-pnpm (required Node 22.13+ but Contabo runs Node 20.20.2). Standard `pnpm install` / `pnpm run ...` now works.

### 5.4 `dist/` vs `src/`

The PM2 process runs `node ./dist/src/main.js`. `dist/` is **compiled JavaScript only**. After editing `.ts` you MUST rebuild:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
```

If you edit `.ts` and only restart PM2, you keep running the OLD compiled code.

### 5.5 Prisma client regeneration

After any `schema.prisma` change:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate'   # BEFORE nest build
./node_modules/.bin/nest build
./node_modules/.bin/prisma migrate deploy
pm2 restart neurecore-backend'
```

Order matters: generate → build → migrate → restart.

### 5.6 PostgreSQL connection issues

Intermittent `Can't reach database server` errors observed in `MissionFeedAiPrioritizer` and `SyncSchedulerService` (logged "0 succeeded, 0 failed" every 15 minutes). The `/api/v1/health` shallow check passes; deep queries sometimes fail.

### 5.7 Backend Google OAuth env checklist

When adding/removing Google OAuth consumers, audit both local and Contabo env files. As of 2026-07-12, the following vars must be set in `/opt/neurecore/backend/backend/.env.production` (and the matching local `backend/.env.production` template):

```ini
GOOGLE_CLIENT_ID=<web-app OAuth client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-…           # the matching secret
GOOGLE_REDIRECT_URI=https://brain.neurecore.com/api/v1/integrations/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=<32+ char hex>  # AES-256-GCM for the per-tenant refresh tokens
TENANT_FRONTEND_BASE_URL=https://hq.neurecore.com
ADMIN_FRONTEND_BASE_URL=https://cc.neurecore.com
```

**Smoke-test after deploy:**
```bash
ssh contabo 'grep -E "^GOOGLE_" /opt/neurecore/backend/backend/.env.production'
ssh contabo 'curl -s https://brain.neurecore.com/api/v1/integrations/google/status \
  -H "Cookie: __Host-nc_at=<paste-from-browser>" | head -c 300'
```

If `health/status` returns 200 with the full payload (`email`, `scopes`, `connected:true`), the integration is healthy.

---

## 6. Frontends — specific gotchas

### 6.1 `start.sh` wrappers

Both frontends use a `start.sh` wrapper invoked from PM2 with `interpreter: 'bash'`. Do not replace this with `script: 'npx'` — earlier PM2 entries used `npx next start --hostname 127.0.0.1 --port 3020` which failed because npx couldn't resolve `next` outside `node_modules/.bin`.

```bash
# /opt/neurecore/frontend-tenant/start.sh
#!/bin/bash
cd /opt/neurecore/frontend-tenant
exec node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005
```

### 6.2 Build before restart

PM2 reload doesn't rebuild. The deploy script (`/opt/neurecore/rebuild.sh` or local `scripts/deploy.sh`) handles `npm ci` + `next build` first.

### 6.3 `.env.production` files

Both frontends read from `/opt/neurecore/frontend-{tenant,admin}/.env.production`. These are **not** synced from local (would expose local dev URLs). They contain `NEXT_PUBLIC_*` variables only — Next.js inlines them at build time, so changing the env file requires a rebuild.

### 6.4 Env vars that differ between tenant and admin

| Var | Tenant | Admin |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api/v1` (relative, uses hq OLS proxy) | `https://brain.neurecore.com/api/v1` (absolute) |
| `NEXT_PUBLIC_TENANT_URL` | `https://hq.neurecore.com` | `https://hq.neurecore.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://cc.neurecore.com` | `https://cc.neurecore.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | set | not set |

### 6.5 `NEXT_PUBLIC_` vars: `.env.local` takes priority over `.env.production`

Next.js loads env files in this priority order (highest first):
1. `.env.local` (all environments)
2. `.env.production` (production only)
3. `.env`

This means `.env.local` **overrides** `.env.production` for `NEXT_PUBLIC_*` vars. The login page (`frontend-tenant/src/app/login/page.tsx:10`) reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — if `.env.local` has a placeholder value (`your-google-client-id.apps.googleusercontent.com`), it will override the real value in `.env.production` and Google Sign-In will fail with `GSI_LOGGER: The given client ID is not found`.

**On 2026-07-12 this was the root cause of the `invalid_client` error on the login page.**

**Fix:** Update both `.env.local` and `.env.production` with the correct value, then rebuild:
```bash
ssh contabo
cd /opt/neurecore/frontend-tenant
sed -i 's|NEXT_PUBLIC_GOOGLE_CLIENT_ID=.*|NEXT_PUBLIC_GOOGLE_CLIENT_ID=<REAL_CLIENT_ID>|' .env.local .env.production
npx next build
pm2 restart neurecore-tenant
```

### 6.6 Never hardcode `localhost:3000` in production code

A missing `NEXT_PUBLIC_*` env var should NOT silently fall back to a dev-only default. Browsers running the production build will then attempt to connect to `localhost:3000` (which is unreachable from the user's machine) and fail with cryptic errors.

**Current pattern (FIX-019, services/socket.ts):**
```ts
const SOCKET_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (window.location.protocol === 'https:') return `wss://${window.location.host}`;
  return `ws://${window.location.host}`;
})();
```

**Anti-pattern (banned):**
```ts
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
```

**Audit grep (run before every commit that touches `NEXT_PUBLIC_*` or `process.env`):**
```bash
grep -rn "localhost:3000\|localhost:3001\|localhost:3002" frontend-tenant/src/ frontend-admin/src/ \
  | grep -v "//" \
  | grep -v "node_modules" || echo "clean"
```

**`localhost:3000` is fine in `localhost`-gated `if` blocks** (dev-only) but should never be a default fallback that the production build can hit.

---

## 7. Disk & RAM

| Resource | Used | Free | Threshold |
|---|---|---|---|
| `/` (sda1, 96 GB) | 52 GB (54%) | 45 GB | warn at 80%, critical at 90% |
| RAM (11 GiB) | 4.2 GiB | 7.5 GiB available | warn at 9 GiB used |
| Swap (2 GiB) | 1.2 GiB | 788 MiB | healthy |
| `/opt/neurecore/_archives` | ~8.7 GB (including legacy-2026-06-30.tar.gz) | varies | prune to last 5 snapshots |

Prune old snapshots:
```bash
ssh contabo 'ls -t /opt/neurecore/_archives/ | tail -n +6 | xargs -I {} rm -rf /opt/neurecore/_archives/{}'
```

---

## 8. TLS certificates

Auto-renewed by certbot timer. Manual renewal (if needed):

```bash
ssh contabo 'certbot renew --dry-run'                    # test
ssh contabo 'certbot renew --force-renewal -d hq.neurecore.com'   # actual
```

OLS reads certs on demand; after renewal, no restart needed (OLS watches inotify).

---

## 9. Observability queries

```bash
# Live alerts
ssh contabo 'curl -s http://127.0.0.1:9093/api/v2/alerts | jq'

# Active targets
ssh contabo 'curl -s http://127.0.0.1:9090/api/v1/targets | jq ".data.activeTargets[] | {job:.labels.job, health:.health, lastError}"'

# Grafana health
ssh contabo 'curl -s http://127.0.0.1:3200/api/health'
```

---

## 10. Lessons learned (operational)

These are hard-won. Read before doing a deploy.

1. **Don't `pm2 start` ad-hoc.** Always update `/opt/neurecore/ecosystem.config.js`.
2. **Don't use `npx next start`** in PM2 entries. Use a `start.sh` wrapper.
3. **Don't use `pnpm` on Contabo.** Use `./node_modules/.bin/`.
4. **Don't `git reset --hard`** on Contabo backend. Snapshot first via `git stash push -- src/ prisma/`.
5. **Don't forget `prisma generate`** before `nest build`.
6. **Don't sync `.env`** from local to Contabo.
7. **Don't add CORS to NestJS.** Keep it in `cors-proxy.js`.
8. **Don't trust `git status`** on Contabo backend — filter to `src/` and `prisma/` only.
9. **Don't deploy without rebuilding.** PM2 restart doesn't recompile.
10. **Don't assume port 3001 = tenant.** It's GUV's `app-frontend`.
11. **Don't assume port 3003 is exposed publicly** — it's behind OLS reverse-proxy at `brain.neurecore.com`.
12. **Don't skip CORS preflight test** after editing `cors-proxy.js`. Run the `curl -X OPTIONS` recipe in §4.2.
13. **Don't hardcode `localhost:3000` as a fallback** in production code. A missing `NEXT_PUBLIC_*` env var should derive from `window.location`, not silently fall back to a dev-only value. See §6.5.
14. **Don't trust `npm run lint` as proof of a buildable codebase.** Always run `next build` / `nest build` before rsync. Lint does not catch missing destructures, wrong generics, or undefined names. See [deployment.md §10](deployment.md#10-pre-deploy-checklist).
15. **Always set `GOOGLE_REDIRECT_URI` in backend `.env.production`.** Missing this env var causes `redirect_uri_mismatch` (Error 400) on the Google Workspace OAuth integration flow. The correct value is `https://brain.neurecore.com/api/v1/integrations/google/callback`. See [runbook.md §9](runbook.md#9-google-oauth-credential-rotation-client_id--client_secret) failure-mode cheatsheet.
16. **Never leave a placeholder `your-google-client-id.apps.googleusercontent.com` in any `.env.*` file.** The login page reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. If `.env.local` has the placeholder and `.env.production` has the real value, `.env.local` wins (Next.js priority) and Google Sign-In fails with `[GSI_LOGGER]: The given client ID is not found`. See §6.5.