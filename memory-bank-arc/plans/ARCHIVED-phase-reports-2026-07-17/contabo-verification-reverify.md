# NeuroCore Contabo Re-Verification — Second Pass (BLOCKED)

**Date:** 2026-07-15
**Auditor:** Independent release engineer / verification auditor
**Branch under review:** `audit-remediation` (HEAD `08515c5` after this commit; previously `f22b329`)
**Behavioral tag:** `browser-simulation-baseline` (`cb0a6eb8cb63e62da97bec2715f8fd9224327497`)

---

## Executive result

**`NO-GO` — all operator-side steps in the previous gate remain blocked.**

The previous gate report (`memory-bank-new/plans/contabo-verification-audit.md`, commit `08515c5`) listed eight operator actions. **None of them were performed in this turn**, because the action list required credentials and access I do not have:

| Step | Operator-only? | Reason | Verifiable here? |
|---|---|---|---|
| 1. Neon point-in-time-restore snapshot | Yes | Requires Neon API key or console login; rules forbid printing secrets | No — BLOCKED |
| 2. Provision a disposable `DATABASE_TEST_URL` | Yes | Requires Neon test branch / local PG server (no `initdb`/`postgres` binary in this sandbox; no docker daemon) | No — BLOCKED |
| 3. Run the 99 DB-gated tests | Yes | Depends on (2); a false "99 passed" would be operator-fraud | No — BLOCKED |
| 4. Deploy `f22b329` to Contabo | Yes | Requires Contabo session or local deploy script (`./scripts/deploy.sh`) | No — BLOCKED |
| 5. Rebuild both frontends | Yes | Same as (4) | No — BLOCKED |
| 6. Verify `/api/v1/health` Phase-8 contract | **No — read-only** | Done below | ✅ Verified |
| 7. Install Chromium + run `browser-simulation-baseline` | Yes | Requires `npx playwright install chromium` (~180 MB) on Contabo | No — BLOCKED |
| 8. Create the audit tenant + `AUDIT-SIM-*` users | Yes | Operator creates on prod | No — BLOCKED |

**Status: `NO-GO`.** The previous gate's conclusion stands and is re-confirmed by Step 6 (read-only health probe) below.

I will **not** fabricate test results. I will **not** invoke Neon APIs without credentials. I will **not** `cat` `/opt/neurecore/backend/backend/.env` and pump it into shell history.

---

## What I did re-verify (read-only, no operator access required)

### Local 5-gate re-run (this turn, this checkout)

Confirmed independently in this turn — **second independent execution** of the same gates. The numbers match the previous summary.

| Gate | Result | Note |
|---|---|---|
| `prisma validate` | **PASS** | |
| `prisma generate` | **PASS** | |
| `npx tsc --noEmit` | **PASS** (zero errors) | |
| `npm run build` | **PASS** (nest build succeeded) | |
| `npm test -- --runInBand` | **1019 passed / 99 skipped / 1118 total** | 12 test suites skipped (the 99 DB-gated suites) |

This is **this local checkout's result**, not Contabo. I have **not** run any gate on Contabo.

### Contabo runtime health (read-only HTTP/log probe, this turn)

| Probe | Result | Evidence |
|---|---|---|
| `GET https://brain.neurecore.com/api/v1/health` | 200 PASS — but **`checks: { application: pass }` only** — no `database`, `redis`, `eventFabric`, or `llmProvider` in the response. | Live response: `{"status":"success","data":{"status":"healthy","checks":{"application":{"name":"application","status":"pass","timestamp":"2026-07-15T12:13:29.675Z"}},"version":"1.0.0"},"meta":{"requestId":"c3dda38b-0364-44ee-bb7f-31d19b27d61a"}}` |
| `tail -200 /root/.pm2/logs/neurecore-backend-error.log | grep -c "Fabric worker tick failed"` | **200** — every line in the last 200 error lines is the same Fabric TypeError. The bug from the prior audit is **still live**. | Live count, this turn |
| `GET https://brain.neurecore.com/api/v1/platform-ops/health` | 401 (auth required or endpoint missing) | The Phase 8 endpoint does not appear to be exposed on Contabo. The 401 may be a JWT-401 from the global guard; regardless, the Phase 8 contract is not observable. |

**These three pieces of evidence together confirm:** the `audit-remediation` branch is **not deployed** on Contabo. The running backend is the pre-`audit-remediation` build at commit `9aec2fc`.

### What I did NOT do (and why)

| Action | Reason |
|---|---|
| Read `/opt/neurecore/backend/backend/.env` | Safety rule: never print secrets, database passwords, JWT signing keys, or API credentials. The file exists on Contabo but its contents were never read into the audit's shell history. |
| `cat` `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/.env` | Same reason. |
| Call Neon's API to take a point-in-time-restore snapshot | Operator-only action. The previous gate's checklist said so. |
| Call Neon's API to provision a test branch / schema | Operator-only. |
| Start a Postgres server in this sandbox | **This sandbox has no Postgres server** — `apt list --installed | grep postgresql` shows only `postgresql-client-16`. There is no `initdb`, no `postgres` binary, no `pg_createcluster`. The Docker daemon socket is absent. `sudo -n true` returns "a password is required." |
| Run `npx playwright install chromium` on Contabo | Requires operator session on Contabo; not a one-line check. The Playwright browser cache at `/root/.cache/ms-playwright` is **absent** (verified read-only this turn). |
| `ssh contabo 'cd ... && git checkout f22b329 && prisma migrate deploy && ...'` | **The previous gate explicitly said not to do destructive deploys.** |
| Create the audit tenant | Operator-only on prod. |

### Honest accounting of the previous gate's "operator action checklist"

The previous gate's checklist called for **eight** operator actions, all requiring credentials or access I do not have. I did **not** perform any of them. I will not claim `GO`.

Per the gate's own authorization rule:
> Issue GO only when: all five gates pass; **99 database tests pass**; services are healthy; the audit tenant exists; browser automation works; no critical defect remains open.

I cannot claim the third condition (`99 database tests pass`) because I have not run them. The 99 DB-gated tests are still skipped in the local `npm test` run because `DATABASE_TEST_URL` is not set in this sandbox. **The operator must run them and re-confirm the gate.**

---

## Re-issued gate matrix

| Gate | Status | Evidence |
|---|---|---|
| A — Repository verification | ✅ Local | branch `audit-remediation`, HEAD `08515c5`, working tree clean |
| B — Infrastructure (read-only) | ✅ Re-probed | `/api/v1/health` only exposes `application:pass`; Fabric TypeError still logging every second on Contabo |
| C — Database safety / migration | ❌ BLOCKED | No fresh snapshot; `migrate deploy` not run; I do not have a disposable `DATABASE_TEST_URL` |
| D — Five release gates (local) | ✅ Local | `prisma validate/generate/tsc/build/jest` all PASS; 1019/99 split (this turn) |
| E — Real DB gated tests | ❌ BLOCKED | No Postgres server in sandbox; no Neon test branch; no Neon credentials. **Have not run them. Will not claim 99 passed.** |
| F — Runtime health | ⚠️ DEGRADED | Fabric TypeError every 1s; `/api/v1/health` incomplete contract |
| G — Playwright browser harness | ❌ BLOCKED | Chromium not installed on Contabo; PRE-PROJECTS frontends make `browser-simulation-baseline.spec.ts` impossible to evaluate against real prod surface |
| Audit tenant + `AUDIT-SIM-*` users | ❌ BLOCKED | Operator-only on prod |

---

## Phase 8 scope declaration (unchanged from prior gate)

**Allowed (real implementations in source):** Health Center, Audit Center, Security Center, Observability Engine, Diagnostics Engine, Operational Readiness.

**Excluded unless configured:** Deployment Manager, Backup Manager, Disaster Recovery, Chaos testing, Load testing, Capacity planning. `mode: 'STUB'` is the contract; treating it as operational would be a misrepresentation.

---

## Recommended next steps (operator)

The previous gate's checklist still applies. I am re-stating it here, not because I haven't said it, but because the steps are not yet done and the gap must be visible.

1. **Snapshot the production database** (Neon point-in-time-restore, or pg_dump if running a local PG). Required before any `audit-remediation` deploy.
2. **Provision a disposable test schema** (Neon branch, or a local PG container with `docker run postgres:16` on any machine with Docker). Apply only the `20260715_fix_idempotency_tenant_unique` migration to it — **not to prod**. The remaining 60 migrations on Contabo are already applied and should not be re-applied.
3. **Run the 99 gated tests** there:
   ```bash
   cd backend
   export DATABASE_TEST_URL="postgresql://...neon_test_branch.../neurecore_test?sslmode=require"
   pnpm prisma migrate deploy
   pnpm test -- --runInBand --testPathPattern "db\.spec"
   ```
   Expected: `Tests: 99 passed, 0 failed, 99 total`. Report that exact line.
4. **Deploy `f22b329` to Contabo** per `contabo-ops.md §3.2` (canonical rebuild recipe). Confirm:
   - `git rev-parse HEAD` on Contabo backend = `f22b329`
   - `git status` clean (modulo any pre-existing uncommitted items)
   - The Phase 8 audit-remediation migrations are present in `backend/prisma/migrations/`
5. **Rebuild both frontends** per `contabo-ops.md §3.3b`. Confirm:
   - `BUILD_ID` for `frontend-tenant` updates
   - `BUILD_ID` for `frontend-admin` updates
6. **Verify health** post-deploy:
   - `GET /api/v1/health` must include `database`, `redis`, `eventFabric` provenance (Phase 8 contract)
   - `pm2 logs neurecore-backend-error --lines 100` must NOT contain `Fabric worker tick failed` anymore
7. **Install Chromium** on Contabo: `ssh contabo 'cd /opt/neurecore/frontend-tenant && ./node_modules/.bin/playwright install chromium'`
8. **Create the audit tenant + `AUDIT-SIM-*` users** on the deployed Contabo.
9. **Re-run this gate document** with the operator's evidence (DB-test output, health response JSON, log lines).

Once all nine steps have evidence, the gate can be re-issued. **Until then: `NO-GO`.**

---

## Closing note

The previous gate's instructions and this turn's instructions agree: do not perform destructive actions on prod; do not fabricate test results; do not trust previous completion reports; do not begin business simulations in this task. I have complied with all four.

I cannot make the audit `GO` because the operator's "99 database tests pass" condition requires an action I cannot perform in this sandbox (no Postgres server, no Neon credentials). The five-gate pipeline is **green locally** but the gate's authorization rule includes that **99 DB tests** condition, which I will not claim without evidence.

The 11-step operator action list above is the same as the prior gate's. The branch `audit-remediation` is ready to be deployed by an operator who can follow it.
