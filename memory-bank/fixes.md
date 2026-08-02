# Fixes

> Notable bug fixes that have landed, with the failure mode + fix + source pointer. Last refreshed: 2026-07-31.

When you close a defect, add an entry here with a "Closed in" note so
future readers can find the relevant code + tests.

---

## Phase 9 — Auth hardening

### FIX D12.2 — `req.body` undefined in `forwardRef`'d modules
- **Symptom:** `PackagesModule` (`POST /api/v1/packages/deploy`) and
  `DepartmentsModule` (`POST /api/v1/departments`) were receiving
  `req.body = undefined` because Nest's auto body-parser mounted after
  some module-init work.
- **Fix:** `backend/src/main.ts:29` disables the auto body-parser and
  mounts `json()` + `urlencoded()` explicitly **before** any guard runs.
- **Reference:** comment at `backend/src/main.ts:23-28`.

### FIX-OUTBOX-RACE — OutboxWorker started before handlers registered
- **Symptom:** Outbox events whose handlers hadn't yet registered were
  silently dead-lettered.
- **Fix:** Move `outboxWorker.bootstrap()` from `onModuleInit` to
  `onApplicationBootstrap` (`backend/src/app.module.ts:404-412`).
- **Reference:** comment at `backend/src/app.module.ts:404-407`.

### FIX-020 — Stale-user redirect loop on 401
- **Symptom:** Hard-redirect on 401 caused a redirect loop with a stale
  user.
- **Fix:** Both legacy `services/api.ts` and the newer
  `auth/transport/authHttpClient.ts` now call
  `authService.reportAuthFailure({ type: 'session_expired' })` instead
  of redirecting. The AuthService surfaces a non-blocking modal.
- **Reference:** `frontend-tenant/src/services/api.ts:67-101`.

### F8 — Constant-time `validateUser`
- **Symptom:** Timing leak on user-existence enumeration.
- **Fix:** `backend/src/modules/auth/services/auth.service.ts:59-98`
  always runs a bcrypt compare (against a dummy hash if user not found
  or inactive).
- **Reference:** comment block at `auth.service.ts:52-58`.

### Cookie auth + CSRF double-submit
- **What:** New `CookieAuthService`, `CsrfProtectionMiddleware`. Cookies
  `__Host-nc_at` / `__Host-nc_rt` / `__Host-nc_csrf`.
- **Reference:** `backend/src/common/auth/cookie-auth.service.ts`,
  `backend/src/common/auth/csrf.middleware.ts`,
  `backend/src/main.ts:87, 142-161`.

### TenantContextMiddleware removed in favour of TenantContextGuard
- **Symptom:** Middleware runs before guards, so `req.user` was unset
  when TenantContextMiddleware tried to read it.
- **Fix:** Replaced with `TenantContextGuard` registered as `APP_GUARD`
  (runs after `JwtAuthGuard`).
- **Reference:** comment block at `backend/src/app.module.ts:395-401`.

### PERF-FIX — gzip + slow-request alarm
- **What:** `compression({ threshold: 1024, level: 6 })` and
  `pino-http.customLogLevel` returning `warn` for >1500ms requests.
- **Reference:** `backend/src/main.ts:41-83`.

---

## Phase 4 — Accounting capability

### Accounting capability migration lands (`20260730_acct_capability_init`)
- **What:** Introduces COA, JournalEntry/Line, AccountingPeriod,
  BeancountSnapshot, MerkleRoot, AccountingApproval, SoD CHECK.
- **Reference:** `backend/prisma/migrations/20260730_acct_capability_init/`.

### SoD enforcement (double layer)
- **What:** Both DB CHECK (`posting_user_id <> approved_by_user_id`) and
  `AccountingApprovalGuard` application-level enforcement.
- **Reference:** `backend/src/modules/accounting/services/segregation-of-duties.service.ts`,
  `backend/src/modules/accounting/guards/accounting-approval.guard.ts`.

---

## SIM-04 (Accounting Customer HITL) — landed fixes

### NC-SIM04-001 — chat-create one-shot bypass
- **What:** Wired a one-shot bypass so chat-create transitions land in
  a single mutation.
- **Reference:** AGENTS.md §"Surface fix #2".

### NC-SIM04-003 — `customers.financialSubType` + `lifecycleStage` enum
- **What:** Cast the columns to proper Prisma enums.
- **Reference:** `backend/prisma/migrations/20260728_sim04_nc_sim04_003_customer_enums/`.

### G-07 — `POST /customers/:id/lifecycle` subroute + timeline events
- **What:** Subroute to advance lifecycle + emits customer timeline
  events.
- **Reference:** `backend/prisma/migrations/20260728_sim04_g07_timeline_customer_id/`.

### G-10 — Socket.IO CORS shim
- **What:** `scripts/contabo/cors-proxy.js` handles `/socket.io/?EIO=4&transport=polling`
  + 400 on WebSocket upgrade + 200 on bare probes.
- **Reference:** `scripts/contabo/cors-proxy.js:9-29, 135-177`.

### G-03 — calendar surface
- **What:** Calendar endpoints + FE surface.
- **Reference:** AGENTS.md §"Surface fix #2".

### G-04 / G-05 / G-06 / G-01 / G-08
- **What:** Six new endpoints + `ObservabilityController` registration
  fix.
- **Reference:** AGENTS.md §"Surface fix #1" (commit `93a1ad0e`).

### `Task.dueDate` + `Task.dueOverride` columns
- **What:** New columns + migration.
- **Reference:** `backend/prisma/migrations/20260728_sim04_task_due_date/`.

### conversationId ESLint warning
- **What:** `chat.service.ts` now declares `conversationId` as part of
  the `async send()` return type (see `chat-and-agents.md §2.2`) and
  uses it consistently; the prior ESLint `@typescript-eslint/no-unused-vars`
  warning is silenced by routing the parameter into the returned
  payload rather than dropping it.
- **Reference:** `backend/src/modules/chat/chat.service.ts` (`send()`
  signature + return type).

---

## AWL — Phase 1–10 reconstruction

### 10 Mandatory invariants enforced
- **What:** `src/test/certification/invariants/mandatory-invariants.spec.ts`.
- **Reference:** AGENTS.md §"10 Mandatory Invariants".

### Gate G9 — 105-scenario matrix
- **What:** `src/test/certification/certification-runner.ts`,
  `certification.spec.ts`.
- **Reference:** AGENTS.md §"Gate G9".

### FailureInjectionBus
- **What:** Eight injection modes (`duplicate_submission`,
  `worker_termination`, `transient_provider_failure`, `session_expiry`,
  `realtime_loss`, `cross_tenant_attempt`, `budget_exhaustion`,
  `policy_denial`).
- **Reference:** `backend/src/test/certification/fixtures/failure-injection.ts`.

### Tenant isolation — 10 entity types × 5 boundary layers
- **What:** `backend/src/test/certification/cross-tenant-negative.spec.ts`,
  `phase8-tenant-isolation.spec.ts`.
- **Reference:** AGENTS.md §"Tenant Isolation".

---

## Deploy reliability

### FIX-COMPREHENSIVE-R3 — Lockfile drift deploy failures
- **Symptom:** `pnpm install --frozen-lockfile` failed on Contabo because
  `package.json` had new deps not in `pnpm-lock.yaml`. Two deploy
  incidents (2026-07-23 + 2026-07-24).
- **Fix:** Two-part mitigation:
  1. `scripts/deploy.sh` runs `check_lockfile` locally before rsync
     (warn + suggest `pnpm install`).
  2. `pnpm` placed on PATH inside subshells (it lives at
     `/home/najeeb/node/node-v22.12.0-linux-x64/bin/pnpm`).
- **Reference:** `scripts/deploy.sh:18-26, 101-154`.

### Backend dist-drift gate
- **Symptom:** Someone edited backend src and forgot `nest build`.
- **Fix:** `scripts/check-dist-drift.sh` runs before deploy and aborts
  if `dist/` is older than `src/`.
- **Reference:** `scripts/check-dist-drift.sh`.

### Atomic deploy with rollback
- **What:** `scripts/deploy/neurecore-deploy.sh` (DEPLOY-001) — install →
  typecheck → build → DI boot gate → migrate → stage → atomic switch →
  PM2 reload → health-check + rollback.
- **Reference:** `scripts/deploy/neurecore-deploy.sh`.

---

## Schema migrations of note

| Date | Migration | Notes |
|---|---|---|
| 2026-07-27 | `20260727_awl_g6_review_lifecycle` | AWL review state lifecycle |
| 2026-07-28 | `20260728_ai_gateway_db_keys` | AI gateway keys persisted to DB |
| 2026-07-28 | `20260728_align_review_decision_enum` (+ step2) | Enum alignment |
| 2026-07-28 | `20260728_sim04_g07_timeline_customer_id` | G-07 timeline events |
| 2026-07-28 | `20260728_sim04_nc_sim04_003_customer_enums` | NC-SIM04-003 |
| 2026-07-28 | `20260728_sim04_task_due_date` | Task.dueDate + Task.dueOverride |
| 2026-07-28 | `20260728_task_status_enum_extension` | Enum extension |
| 2026-07-30 | `20260730_acct_capability_init` | Accounting capability |

---

## How to record a new fix

1. Add an entry under the appropriate phase with:
   - Short ID (`NC-...`, `FIX-...`, or descriptive).
   - Symptom (what was breaking).
   - Fix (what changed; commit hash if you have it).
   - Source pointer (file:line).
2. If it closes a `pending-tasks.md` item, mark that item **Closed in
   <this fix entry>**.

---

## Source pointers

- `backend/src/main.ts` (D12.2, perf, cookie/CORS).
- `backend/src/app.module.ts` (OutboxWorker race, TenantContext guard).
- `backend/src/common/auth/*` (cookie auth + CSRF).
- `backend/src/modules/auth/services/auth.service.ts` (F8).
- `frontend-tenant/src/services/api.ts` (FIX-020).
- `backend/src/modules/accounting/` (SoD, COA).
- `scripts/contabo/cors-proxy.js` (G-10).
- `scripts/deploy.sh` (lockfile drift).
- `scripts/deploy/neurecore-deploy.sh` (atomic deploy).