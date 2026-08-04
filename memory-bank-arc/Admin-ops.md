# Admin Operations Guide — cc.neurecore.com (Control Center)

**Document ID:** NC-ADMIN-OPS-V1  
**Last updated:** 2026-08-03  
**Audience:** Future AI agents / Operators performing browser-based smoke tests, configuration, and feature discovery on the NeureCore Admin Control Center.  
**Goal:** Provide a single source of truth so future agents do not reinvent navigation/element discovery.

---

## 1. URL and Login

| Item | Value |
|---|---|
| Production URL | `https://cc.neurecore.com/admin` |
| Login page | `https://cc.neurecore.com/admin/login` |
| Backend API | `https://brain.neurecore.com/api/v1/...` (proxied via cc.neurecore.com) |
| Title (in browser tab) | "NeureCore — Admin Portal" |
| Required role | `SUPER_ADMIN` for harness-control / most controls; `OWNER` sufficient for limited subset |

**Quick status-code check (verified 2026-08-03):**

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://cc.neurecore.com/harness-control
# 404 — bare path is wrong; the app is mounted under /admin/

curl -sk -o /dev/null -w '%{http_code}\n' https://cc.neurecore.com/admin/harness-control
# 307 — correct path; redirects to /admin/login when unauthenticated

curl -sk -o /dev/null -w '%{http_code}\n' https://cc.neurecore.com/admin/login
# 200 — login page
```

**Do NOT expect 200 or 307 from the bare `/harness-control` URL.** That route does not exist. Any agent or operator verifying harness-control must use the `/admin/` prefix.

**Important routing notes:**

- The Next.js admin app is mounted under the `/admin` path prefix via LiteSpeed reverse proxy.
- The first redirect on a fresh visit is to `/admin/login`.
- After login, default landing is `/admin/overview`.
- The base URL `https://cc.neurecore.com/` (no `/admin`) serves a minimal landing page, not the full console — always start at `/admin`.

**Test SuperAdmin credential procedure (when needed):**

1. SSH into Contabo: `ssh contabo`.
2. Confirm backend DB target: `cat /opt/neurecore/backend/backend/.env | grep DATABASE_URL` — the backend uses **local PostgreSQL `neurecore_prod`** at `127.0.0.1:5432` (NOT Neon, NOT the local `neurecore` DB created earlier).
3. Generate bcrypt hash locally:
   ```bash
   cd /opt/neurecore/backend/backend
   node -e "const bcrypt=require('./node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs'); require('fs').writeFileSync('/tmp/hash.txt', bcrypt.hashSync('YOUR_PASSWORD', 12))"
   ```
4. Write hash to DB (must use a temp file — the `$` characters in bcrypt hashes break shell quoting):
   ```bash
   HASH=$(cat /tmp/hash.txt)
   sudo -u postgres psql -h 127.0.0.1 -d neurecore_prod \
     -c "UPDATE \"users\" SET \"passwordHash\" = '$HASH', \"updatedAt\" = now() WHERE email = 'admin@neurecore.ai';"
   ```
5. Restart pm2 to clear in-memory NestJS throttle (login attempts are rate-limited at 100/min, restarting clears the bucket):
   ```bash
   pm2 restart neurecore-backend
   ```
6. **After smoke test, clean up:**
   ```bash
   sudo -u postgres psql -h 127.0.0.1 -d neurecore_prod \
     -c "UPDATE \"users\" SET \"passwordHash\" = 'DELETED_INVALIDATED' WHERE email = 'admin@neurecore.ai';"
   rm -f /tmp/hash.txt
   ```

---

## 2. Login Flow (Browser Steps)

1. Navigate to `https://cc.neurecore.com/admin/login`.
2. Page shows: logo image, heading "Admin Portal", subtitle "Super Admin access only", two inputs (Email, Password), and "Sign In" button.
3. Submit form. Successful login redirects to `/admin/overview` (HTTP 200).
4. Failed login (bad credentials) returns `400 INVALID_REQUEST` with message "email must be an email; password must be longer than or equal to 1 characters" — this is the schema-validator error, NOT an actual auth failure. The frontend must dispatch React-compatible input events to register values (see §7).

---

## 3. Page Structure (Every Authenticated Page)

The admin console has a fixed three-zone layout:

### 3.1 Top Bar (Banner)

Present on every authenticated page after login. Left side shows the **current page title** (e.g. "Harness Control"). Right side has:

- **"Search or command… ⌘K"** button — opens the command palette (search every nav item).
- **"⏳ N pending"** link — pending approval count badge; navigates to `/approvals`.
- A right-side chat/conversation toggle button (speech-bubble icon `◈`).

### 3.2 Left Sidebar (Navigation)

The left rail is the single source of truth for navigation. Items come from `frontend-admin/src/components/sidebar/navigation.config.ts`. The rail groups are:

| Group label | Items (label → href) |
|---|---|
| **Platform** | Overview (`/overview`) · Tenants (`/tenants`) · Users (`/users`) |
| **Library** | AI Employees (`/agents-pool`) · Departments (`/departments-pool`) · Industries (`/industries`) · Tiers (`/tiers`) · Features (`/features`) · Packages (`/packages`) |
| **Fleet** | Employee Fleet (`/agents`) |
| **Intelligence** | Models (`/models`) · Brain Map (`/brain`) · Strategy (`/strategy`) |
| **Control** | Monitoring (`/monitoring`) · Security (`/security`) · Connectors (`/connectors`) · Billing (`/billing`) · Infrastructure (`/infrastructure`) · Harness Control (`/harness-control`) · Audit Logs (`/audit`) |
| **Integrations** | Brevo Email (`/admin/brevo`) |
| **Settings** | Settings (`/settings`) |

URLs are mounted under `/admin/` (so full path is `/admin/harness-control`, `/admin/audit`, etc.). Each item is a `<link>` with a unicode-glyph icon, label, and hover state.

### 3.3 Bottom-of-Sidebar — User Card

Always present at the bottom of the sidebar:

- User name (e.g. "Admin User")
- Email (e.g. `admin@neurecore.ai`)
- Role pill (e.g. "SUPER_ADMIN")
- "Sign Out" button

### 3.4 Main Content Area

Page-specific. See §4 for `/admin/harness-control`.

### 3.5 Activity Stream (Bottom-right floating button)

A floating `▲ Activity Stream` button toggles a panel that streams real-time events.

---

## 4. Harness Control Center (`/admin/harness-control`)

This is the Phase 10 page. The route resolves under `/admin/`, so the absolute URL is `https://cc.neurecore.com/admin/harness-control`.

### 4.1 Page Header

- Heading: **"Harness Control Center"**
- Subtitle: **"Governed operations, immutable evidence, independent approvals"**

### 4.2 Dashboard Stat Cards

Five tile cards displayed in a row:

1. **Pending approvals** — count of harness runs awaiting SuperAdmin approval.
2. **Active certificates** — count of `harness_certificates` rows in `ACTIVE` state.
3. **Active waivers** — count of `harness_waivers` rows in `ACTIVE` state.
4. **Catalog scenarios** — count of registered scenarios.
5. **Integrity issues** — count of audit chain integrity failures (expected 0 in healthy state).

Empty-state placeholder: a dash `—` until data loads; replaced by integer values from `/api/v1/harness-control/dashboard`.

### 4.3 Tab Strip ("Harness resources" tablist)

Five tabs, in order:

1. **Runs** (default selected) — table of harness run records.
2. **Configuration** — change versions registry (prompts, rubrics, datasets, policies).
3. **Waivers** — waiver requests and active waivers.
4. **Certificates** — capability certificates with state/verdict/limitations.
5. **Audit** — append-only audit event chain with hash verification.

Switching tabs in the UI does NOT change the URL — it is a client-side state. To deep-link to a sub-page use one of the four dedicated routes:

- `/admin/harness-control/audit`
- `/admin/harness-control/certificates`
- `/admin/harness-control/replay`
- `/admin/harness-control/waivers`

### 4.4 Runs Table (default tab)

Columns (in order):

1. **Capability / scenario** — combined capability and scenario identifier.
2. **Environment** — `LOCAL` / `CI` / `STAGING` / `PRODUCTION_PROBE` / `PRODUCTION`.
3. **Status** — `REQUESTED` / `APPROVED` / `RUNNING` / `COMPLETED` / `FAILED` / `CANCELLED` / `BLOCKED`.
4. **Evidence** — checksum or evidence artifact link.
5. **Safety** — destructive/production flags.
6. **Actions** — approve/cancel buttons (SuperAdmin only).

Empty state text: **"No harness runs are visible."**

### 4.5 Data Loading Behavior

- On mount, two parallel API calls: `GET /api/v1/harness-control/dashboard` and `GET /api/v1/harness-control/runs`.
- If both fail (500), the page renders the alert: **"Harness control data is unavailable. No operation was attempted."** This is the safe-fail message — no mutations occur on failure.
- Successful response renders numbers and rows.
- The harness-control endpoints require role `SUPER_ADMIN` — `OWNER` returns 403.

### 4.6 Sub-Routes

| Route | Purpose |
|---|---|
| `/admin/harness-control` | Dashboard + Runs tab |
| `/admin/harness-control/audit` | Audit event chain viewer with `verifyAudit` action |
| `/admin/harness-control/certificates` | Active/expired/revoked certificates with revoke action |
| `/admin/harness-control/replay` | Replay bundles and execution history |
| `/admin/harness-control/waivers` | Waiver requests, approvals, revocations |

---

## 5. Common API Endpoints (for Playwright / programmatic smoke tests)

Base: `https://brain.neurecore.com/api/v1` (also reachable at `https://cc.neurecore.com/api/v1` through the proxy).

| Method | Path | Role required | Purpose |
|---|---|---|---|
| POST | `/auth/login` | none | Issue access + refresh tokens |
| POST | `/auth/register` | none | Create OWNER user + tenant |
| GET | `/health` | none | Liveness probe |
| GET | `/harness-control/dashboard` | SUPER_ADMIN | Stat counters |
| GET | `/harness-control/runs` | SUPER_ADMIN | Run list |
| GET | `/harness-control/changes` | SUPER_ADMIN | Change versions |
| GET | `/harness-control/waivers` | SUPER_ADMIN | Waivers |
| GET | `/harness-control/certificates` | SUPER_ADMIN | Certificates |
| GET | `/harness-control/audit` | SUPER_ADMIN | Audit events |
| GET | `/harness-control/audit/verify` | SUPER_ADMIN | Verify hash chain |
| GET | `/harness-control/replay` | SUPER_ADMIN | Replay bundles |
| POST | `/harness-control/runs` | SUPER_ADMIN | Request new run |
| POST | `/harness-control/runs/:id/approve` | SUPER_ADMIN | Approve run |
| POST | `/harness-control/runs/:id/cancel` | SUPER_ADMIN | Cancel run |
| POST | `/harness-control/waivers/:id/approve` | SUPER_ADMIN | Approve waiver |
| POST | `/harness-control/waivers/:id/revoke` | SUPER_ADMIN | Revoke waiver |
| POST | `/harness-control/certificates/:id/revoke` | SUPER_ADMIN | Revoke certificate |
| POST | `/harness-control/replay/:bundleId/execute` | SUPER_ADMIN | Execute replay |

**Auth headers for curl:**

```
Authorization: Bearer <accessToken>
Cookie: access_token=<accessToken>
```

---

## 6. Data Sources (Contabo)

When troubleshooting harness-control data issues, verify:

| Layer | Location | Notes |
|---|---|---|
| Backend process | `pm2 show neurecore-backend` (PID 17) | Listens on port 3003 internally; proxied to 443 via LiteSpeed |
| Backend `.env` | `/opt/neurecore/backend/backend/.env` | Contains `DATABASE_URL` → local `neurecore_prod` at 127.0.0.1 |
| Local Postgres | `127.0.0.1:5432` database `neurecore_prod` | Owned by `neurecore_app` role; `pg_hba.conf` allows local trust |
| Migrations | `/opt/neurecore/backend/backend/prisma/migrations/20260803_phase10_harness_control_center/` | Contains `migration.sql` for the 9 harness tables |
| Frontend build | `/opt/neurecore/frontend-admin/.next/` | Next.js App Router under `/admin/` base path |
| Frontend source | `/opt/neurecore/frontend-admin/src/app/harness-control/` | `page.tsx`, plus sub-route dirs (`audit/`, `certificates/`, `replay/`, `waivers/`) |
| Nav config | `/opt/neurecore/frontend-admin/src/components/sidebar/navigation.config.ts` | Single source of truth for sidebar items |
| Harness API service | `/opt/neurecore/frontend-admin/src/services/harness-control.service.ts` | Calls dashboard/runs endpoints |
| Backend harness module | `/opt/neurecore/backend/backend/src/harness/phase10/` | `harness-control.controller.ts`, `service.ts`, `module.ts` |

**Critical "gotcha":** There are TWO Postgres databases on Contabo:

- `neurecore` — created earlier during this session, not used by the backend.
- `neurecore_prod` — the actual backend DB. **All harness migrations and password updates must go here.**

There is also `neondb` on Neon (remote) — this was a wrong target used earlier; the local `neurecore_prod` is correct.

---

## 7. Playwright / Browser-Automation Notes

### 7.1 React-controlled inputs

Setting `input.value` directly does NOT register with React state. Use the native value setter:

```js
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
nativeInputValueSetter.call(emailInput, 'admin@neurecore.ai');
emailInput.dispatchEvent(new Event('input', { bubbles: true }));
```

Then submit by clicking the submit button (also React-controlled — `document.querySelector('button[type="submit"]').click()` works because React's synthetic events propagate from real DOM events).

### 7.2 Expected status codes

| Action | Expected |
|---|---|
| Unauthenticated `/admin/overview` | 307 redirect → `/admin/login` |
| Wrong credentials login | 400 `INVALID_REQUEST` (schema validator) OR 401 `AUTHENTICATION_FAILED` (bad creds) |
| Rate-limited login | 429 `RATE_LIMIT_EXCEEDED` ("Too many login attempts"). Fix: `pm2 restart neurecore-backend` to clear in-memory bucket |
| Login success | 200 + JSON tokens, then redirect to `/admin/overview` |
| Harness data call success | 200 + JSON with `{capabilities, runs, pendingApprovals, ...}` |
| Harness data call failure (table missing) | 500 `INTERNAL_ERROR` — fix by applying migration to `neurecore_prod` |

### 7.3 Cookie-based authentication

After login, the access token is set as an `HttpOnly` cookie (`access_token`). Subsequent fetches to `/api/v1/...` from the same origin include it automatically. For cross-origin (e.g. testing `cc.neurecore.com` page that calls API at `brain.neurecore.com`), an `Authorization: Bearer ...` header is needed.

---

## 8. Troubleshooting Matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| Login form 400 "email must be an email" | React state not updated; only DOM value set | Use §7.1 native setter + dispatch input event |
| Login 429 rate-limited | NestJS throttler in-memory bucket full | `pm2 restart neurecore-backend` |
| Harness-control 500 "table does not exist" | Migration applied to wrong DB | Apply to `neurecore_prod`: `PGPASSWORD=... psql -h 127.0.0.1 -d neurecore_prod -f prisma/migrations/20260803_phase10_harness_control_center/migration.sql` |
| Harness-control 401/403 | User is OWNER not SUPER_ADMIN | Reset `users.role = 'SUPER_ADMIN'` in `neurecore_prod` |
| Password update appears to succeed but login fails | Shell `$` expansion broke bcrypt hash | Write hash to `/tmp/hash.txt`, read with `HASH=$(cat ...)` into the SQL command |
| `/admin/harness-control` returns 404 in browser | Frontend not deployed | Run `./scripts/deploy.sh admin` from local repo root |
| Sidebar missing Harness Control item | `navigation.config.ts` not updated | Add entry to `NAV_GROUPS` under Control group |
| Harness-control 200 but page shows "data is unavailable" | API returned 500 or empty array; check backend logs | `pm2 logs neurecore-backend --lines 100` |

---

## 9. Quick Verification Script (idempotent smoke test)

```bash
# 1. Health
curl -sk https://brain.neurecore.com/api/v1/health | jq .data.status

# 2. Login (replace TOKEN)
TOKEN=$(curl -sk -X POST https://brain.neurecore.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@neurecore.ai","password":"YOUR_PASSWORD"}' \
  | jq -r .data.tokens.accessToken)

# 3. Harness dashboard
curl -sk https://brain.neurecore.com/api/v1/harness-control/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Browser smoke test
# Navigate to https://cc.neurecore.com/admin/login → fill creds → submit
# Verify redirect to /admin/overview
# Click "Harness Control" in sidebar
# Verify URL is /admin/harness-control
# Verify stats cards and Runs table render
```

---

## 10. Document References

- Harness source-of-truth plan: `memory-bank-arc/comms/harness-elementsv1.md`
- Frontend-admin reference: `memory-bank-arc/frontend-admin.md`
- Contabo operations: `memory-bank-arc/contabo-ops.md`
- Phase 9 certification guide: `AGENTS.md` (root)
- Harness module source: `backend/src/harness/phase10/`
- Frontend harness pages: `frontend-admin/src/app/harness-control/`
- Sidebar nav config: `frontend-admin/src/components/sidebar/navigation.config.ts`
