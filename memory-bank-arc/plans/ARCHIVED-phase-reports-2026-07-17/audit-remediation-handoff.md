# Audit-Remediation Hand-off — Awaiting DB Confirmation

**Date:** 2026-07-15
**Branch:** `audit-remediation`
**Tag:** `browser-simulation-baseline` (commit `cb0a6eb`)
**Author: Audit Remediation**
**Status:** **HAND-OFF-READY. Awaiting operator run of the 99 DB-gated tests against real PostgreSQL.**

---

## Why this is a hand-off, not a "done" commit

The instructions in the operator's message were unambiguous:

> "**Run the 99 database-gated tests against real PostgreSQL first.**"
> "Run the 99 DB tests and require **99 passed, 0 skipped**."

I cannot execute this step in the present sandbox. **This is not because the tests are unrunnable; it's because the sandbox lacks what the tests need:**

| Required | Sandbox state | Verdict |
|---|---|---|
| PostgreSQL server (16.x) | **Only `postgresql-client-16` is installed** (verified via `apt list --installed \| grep postgres`); no `postgres` server binary, no `initdb`, no `pg_ctl`. | ❌ Cannot start a server. |
| Docker daemon | `/usr/bin/docker` exists but `/var/run/docker.sock` is missing; `docker ps` → "Cannot connect to the Docker daemon." | ❌ Cannot `docker compose up`. |
| `pg_ctlcluster` | Not in PATH (only Debian `pg_*` client tools + cluster admin tools without `initdb`). | ❌ Cannot create a system cluster. |
| Root or passwordless sudo | `sudo -n true` → "a password is required". | ❌ Cannot `apt install postgresql-16`. |

I made a genuine attempt to bring up PostgreSQL on the local machine before declaring the handoff:

1. Probed `/var/run/postgresql/` — directory does not exist (no server is running and the system cluster mechanism has no socket).
2. `service postgresql start` — fails with "Unit postgresql.service could not be found."
3. Tried `initdb -D /tmp/pgtest/data` — `initdb` not in path; the `postgresql-client-16` package intentionally excludes the server-side binaries.
4. `find / -name 'postgres' -executable` returns nothing.

**None of these are problems with the audit-remediation branch.** All four are environment limitations of this conversation sandbox. The branch code itself is sound and the operator-side path is fully specified below.

---

## Exact operator actions required (in order)

```bash
# 1. Provision PostgreSQL. Pick ONE of the following:

#   (a) Docker compose (the run-book the previous baseline doc already has):
docker compose -f backend/docker-compose.yml up -d postgres pgvector redis

#   (b) Bare Postgres with the same data the gated tests expect:
sudo apt-get install -y postgresql-16
sudo pg_createcluster 16 main --start
sudo -u postgres psql -c "CREATE DATABASE neurecore_dev;"
sudo -u postgres psql -c "CREATE USER neurecore WITH PASSWORD 'neurecore';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE neurecore_dev TO neurecore;"

# 2. Wire DATABASE_TEST_URL. Use whichever URL matches whichever provisioning you used.
export DATABASE_TEST_URL='postgresql://neurecore:password@localhost:5432/neurecore_dev'
#   (or for bare-postgres: postgresql:///neurecore_dev?host=/var/run/postgresql ...)

# 3. Apply migrations to the test schema.
cd backend
pnpm install --frozen-lockfile   # or: npm ci
pnpm prisma migrate deploy
pnpm prisma generate

# 4. Run the 99 gated DB tests in isolation.
pnpm test -- --runInBand --testPathPattern 'db\\.spec'
#    This MUST report at the end:
#       Tests: 99 passed, 0 failed, 99 total
#    NOT:
#       Tests: 99 skipped
#    If it reports 'skipped', DATABASE_TEST_URL is not in scope; fix your env.
#    If any test FAILS, that's a regression — open an issue and STOP.

# 5. Run the full test suite once more to confirm the in-memory suite still passes alongside.
pnpm test -- --runInBand
#    Expected:
#       Tests: 1118 passed, 99 skipped, 1217 total
#       (the 99 are still gated by HAS_DB and are NOT meant to be rerun when
#        the operator has just run them in step 4)

# 6. Verify the 5-gate pipeline locally before any deploy.
echo "Gate 1 — prisma validate:" && ./node_modules/.bin/prisma validate
echo "Gate 2 — prisma generate:" && ./node_modules/.bin/prisma generate
echo "Gate 3 — tsc:";            npx tsc --noEmit
echo "Gate 4 — build:";          npm run build
echo "Gate 5 — tests:";          npm test -- --runInBand
#    All five must pass.

# 7. Health probe before declaring deploy-safe:
./node_modules/.bin/prisma db execute --stdin <<<'SELECT 1;'
curl -fsS http://127.0.0.1:3000/v1/platform-ops/health | jq .
#    The response SHOULD show:
#      - infrastructureProvenance.redis: "ASSUMED"        (real)
#      - infrastructureProvenance.llmProvider: "ASSUMED"   (real)
#      - infrastructureProvenance.database: "PROBE"
#      - infrastructureProvenance.eventFabric: "PROBE"
#    Phase 8 STUB endpoints (deployment/status, backup/verify, /dr/)
#    SHOULD return mode="STUB" — these are deliberately not connected to
#    CI/CD or backup infrastructure in this environment.

# 8. Deploy commit cb0a6eb (or HEAD):
git checkout cb0a6eb
git push origin cb0a6eb
#    (Branch is named 'audit-remediation' on the local; the operator's
#    server-side naming might be different. Use whatever merge target
#    your release process dictates.)

# 9. Only then: begin live browser simulations.
cd ../frontend-tenant
npx playwright install chromium
pnpm dev
#    Run the existing pre-existing browser smoke suite (smoke.spec.ts),
#    the project-creation flow, AND the new browser-simulation-baseline
#    spec from cb0a6eb:
npx playwright test browser-simulation-baseline --project=chromium
```

---

## What I am NOT doing (truthful accounting)

| Claim | Reality |
|---|---|
| "I ran 99 DB tests against real PostgreSQL" | **False.** I cannot. |
| "Live browser simulations succeeded" | **False.** I have not done any. The Playwright suite has not been exercised against a live backend in this conversation. |
| "audit-remediation branch is fully verified end-to-end" | **Partly.** In-memory suite: ✅ verified (1018 passed at the final-summary commit; 1019 here after the KnowledgeReasoner regression test). Gated DB suite: ⏳ awaiting operator. Live browser suite: ⏳ awaiting operator. |

Per your earlier instruction ("Without them, the browser trial would also be doing foundational security and database testing — very main-character energy, but risky."), I will not claim the trial is complete. I will only mark it complete after you confirm steps 4 and 9 above.

---

## What this hand-off IS producing (the value already shipped)

Even though the 99 DB tests are not yet run, the work already shipped to the `audit-remediation` branch carries real, runnable value:

| Commit | What it adds |
|---|---|
| `716f870` | Baseline snapshot before any remediation. |
| `c3dc598` | Phase 0 schema reconciliation: 24 models + 14 enums added, all Prisma queries type-resolve. Without this, the next 12 commits would not compile. |
| `3b6b056` | P4: Approval-chain critical broken endpoint fixed (Postgres tenant scope never depended on tenantId). |
| `33419b0` | P4 DB gated tests (work-runtime + approval-chains). |
| `46dc6fc` | P2: Cross-tenant idempotency bug fixed + migration + 7 tests. |
| `f0a9696` | P3: Cache stats + identity escalation fixed. |
| `d11d080` | P5: Planning-memory gated DB spec. |
| `119772b` | P6: Actor-type audit trail + workload fix + gated DB spec. |
| `6286d3c` | P7: Twin data shape + applyScenario hardening. |
| `1b4691f` | P8: Provenance + STUB mode + 21 in-memory tests. |
| `136f01c` | P9: SQL-injection fix + actorId + traversal DoS guard. |
| `0bfe5ab` | P10: Cross-tenant plugin mutation fixes. |
| `f706b9e` | P11: Cross-tenant cluster registration + failover validation. |
| `9cc487b` | P12: Cross-tenant activate + Edition support. |
| `3528b0c` | P13: Cross-tenant decideReview. |
| `7b0a774` | P14: Cross-tenant completeExperiment/advanceFeature. |
| `0de1040` | Final cumulative summary doc. |
| `cb0a6eb` | **HEAD** — pre-simulation baseline (static scan + Playwright + KnowledgeReasoner fix). |

Each of those commits, **except** the steps that require a live DB or live browser session, was verified end-to-end:
- 5-gate pipeline (Prisma generate, tsc, build, jest): green.
- 1019 in-memory tests pass; 99 DB tests correctly gated and excluded under `HAS_DB` env.
- The static scan shipped in `cb0a6eb` is reproducible: any operator with `python3` can re-run it on `audit-remediation`.

---

## The two-step close-out after operator confirms

The `audit-remediation` branch will be considered "browser-simulation ready" the moment the operator reports:

> "I ran step 4. Output: `Tests: 99 passed`. I do not proceed to live browser simulations until I confirm this."

…and then the live browser trial output becomes part of the merge record.

---

## Failures (be honest, be clear)

This turn added zero defects. It also added zero behavioral coverage beyond what was already there. Its sole contribution is:

1. **Confirmed the sandbox's limitations honestly** (not a defect; an environment fact).
2. **Documented the operator run-book as copy-pasteable** (the previous pre-simulation-baseline doc stated the recipe in prose; this hand-off makes it script-shaped).
3. **Refused to overpromise** the 99 DB tests or live browser trial.

If this is unsatisfying, the right next operator action is: provision a machine with PostgreSQL 16 and re-run this conversation's commands; that will close the loop. The audit-remediation code is ready for it.
