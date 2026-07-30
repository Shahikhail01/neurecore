# Contabo Pre-Deploy Verification — Operator-Requested Re-Verification (Third Pass)

**Date:** 2026-07-15
**Auditor:** Independent release engineer / verification auditor
**Branch under review:** `audit-remediation` (HEAD `08515c5`)

---

## Executive result

**`NO-GO` — operator's "99 passed, 0 failed, 0 skipped" condition is NOT met.**

This pass actually executed the 99 DB-gated tests against a freshly-provisioned disposable PostgreSQL on Contabo itself. The result is:

```
Tests: 55 failed, 44 passed, 99 total
Test Suites: 6 failed, 6 passed, 12 total
Time:  45.954 s
```

The previous "1019 active / 99 skipped" claim in the audit-remediation final summary is the result of the **in-memory suite** running with `process.env.DATABASE_TEST_URL` unset. It is **not** an equivalent of "99 DB-gated tests passed against a real PostgreSQL". The 99 DB-gated tests were never executed prior to this turn.

Per the operator's authorization rule:
> "Run the 99 DB-gated tests against real PostgreSQL. Expect: 99 passed, 0 failed, 0 skipped."

That condition is unmet. I will not claim the trial is GO.

---

## What I did this turn

1. **Started a fresh PostgreSQL cluster on Contabo itself**, on a non-production port (5433, separate from the live 5432), named `audit-test`. Used `pg_createcluster` + `pg_ctl` (as the `postgres` user — `pg_ctl` refuses root). Cluster is up; `pg_isready -h 127.0.0.1 -p 5433` returns `accepting connections`.
2. **Created a fresh database `neurecore_audit_test`** with a `pgvector` extension and a `audit_tester` role. Confirmed the role can reach the DB and that the schema is empty.
3. **Materialized the audit-remediation schema** on the disposable DB using `prisma db push --skip-generate --accept-data-loss`. After a clean reset (`DROP DATABASE`), `prisma db push` produced 145 tables — including all 36 audit-remediation tables (`enterprise_event_idempotency`, `work_runs`, `knowledge_nodes`, `cloud_regions`, `ai_departments`, `plugins`, `simulation_records`, etc.). Confirmed via `psql \dt`.
4. **Shipped the audit-remediation branch's source into Contabo via `git bundle`**, fetched into a worktree at `/opt/neurecore/_worktrees/audit-remediation/`. The original `main` working tree on Contabo was preserved (untracked / modified files were not touched).
5. **Ran `pnpm install --frozen-lockfile`** in the worktree — 55s, generated the Prisma client v5.22.0.
6. **Configured `.env`** to point at the disposable DB.
7. **Ran `jest --testPathPatterns 'db\.spec'`** — 99 tests, 6 suites pass, 6 suites fail, 44 / 99 individual tests pass.
8. **Reset and re-pushed the schema** when the first run failed due to a stale-state issue — the re-push produced all 36 audit-remediation tables in the disposable DB.

---

## Test result details

| Suite | Result | Reason (if fail) |
|---|---|---|
| `approval-chains/__tests__/approval-chains-db.spec.ts` | **PASS** | |
| `enterprise-ai-governance/__tests__/ai-governance-db.spec.ts` | **PASS** | |
| `enterprise-cognition/__tests__/planning-memory-db.spec.ts` | **PASS** | |
| `enterprise-events/__tests__/idempotency-unique-db.spec.ts` | **PASS** | |
| `enterprise-operating-system/__tests__/eos-db.spec.ts` | **PASS** | |
| `work-runtime/__tests__/work-runtime-db.spec.ts` | **PASS** | |
| `application-framework/__tests__/application-framework-db.spec.ts` | **FAIL** | test files reference `prisma.<model>.create` with explicit `createdAt`/`updatedAt` defaults that are interpreted as required, or other missing fields. |
| `cloud-platform/__tests__/cloud-platform-db.spec.ts` | **FAIL** | same class: typed-PrismaClient rejects inserts that don't include every required field including `@updatedAt`-style auto columns. |
| `enterprise-autonomy/__tests__/autonomy-db.spec.ts` | **FAIL** | same. |
| `enterprise-intelligence-network/__tests__/intelligence-db.spec.ts` | **FAIL** | same. |
| `platform-evolution/__tests__/platform-evolution-db.spec.ts` | **FAIL** | `TRUNCATE feature_lifecycles` (plural) — but `FeatureLifecycle` is `@@map("feature_lifecycle")` (singular). The test file's `TRUNCATE` is wrong. |
| `platform-sdk/__tests__/platform-sdk-db.spec.ts` | **FAIL** | `Argument 'updatedAt' is missing` — `Plugin` model has `updatedAt DateTime` (no `@default`, no `@updatedAt`), so application must provide it. The audit-remediation source code doesn't. |

---

## Verifiable root causes

The 55 failures fall into a small number of classes — none are flakiness. Each is a **real defect** in either the test file or the source under test:

### Class A — `Plugin.updatedAt` and similar fields are non-nullable but not defaulted (audit-remediation commit didn't apply `@default(now())` or `@updatedAt`)

Source: `backend/prisma/schema.prisma` (in the addendum section, line ~4477):
```prisma
model Plugin {
  ...
  createdAt DateTime  @default(now())  ...
  updatedAt DateTime  // nullable=False default=None sql=TIMESTAMP     // <-- BUG: no @default and no @updatedAt
  @@unique([tenantId, name, version])
  @@map("plugins")
}
```

`prisma.plugin.create({...})` without `updatedAt` is rejected at runtime. **The in-memory test mock does not catch this** — only a real Prisma client does. The audit-remediation's 5-gate pipeline locally was *green* because the in-memory suite uses a manual FakePrisma. The gated DB test, when run, surfaces the defect.

This is exactly the kind of bug the operator's check was designed to catch.

### Class B — test files reference plural table names

Source: `backend/src/modules/platform-evolution/__tests__/platform-evolution-db.spec.ts:29`:
```typescript
TRUNCATE migration_plans, capability_versions, feature_lifecycles, ...
```
`FeatureLifecycle` is `@@map("feature_lifecycle")` (singular). The test must use the same names Prisma uses.

### Class C — implicit required fields on Prisma create calls

Across `application-framework`, `cloud-platform`, `enterprise-autonomy`, `enterprise-intelligence-network`, `platform-evolution` tests, the source code does `prisma.<model>.create({data: {...}})` without supplying every non-null column that has no default. Examples: `confidenceThreshold`, `healthStatus`, `updatedAt`. The in-memory FakePrisma doesn't model every required column; the real Prisma client does.

---

## What the previous gate's reports missed

The audit-remediation final summary (commit `0de1040`) recorded "1019 active / 99 skipped". The 99-skipped count is the **count of suites that were gated and did not run** because `DATABASE_TEST_URL` was unset. The summary's claim of "All 5 mandatory Phase 0 gates PASS" referred to a different gate set:
- `prisma validate` PASS
- `prisma generate` PASS
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm test -- --runInBand` PASS — **but with 99 suites skipped**, not run.

The 99-skipped tests were asserted as "ready to run" but not actually run. **This was an overclaim in the final summary.** The current run proves that 55 of them have real defects that the in-memory suite could not catch.

The previous gate's recommendation was honest: "the operator must provision a disposable test DB and run them there". I did exactly that. The 55 failures are now visible.

---

## What still remains for the operator to do

If the operator wants to reach "99 passed, 0 failed, 0 skipped":

1. **Fix Class A** (audit-remediation source code): the `Plugin.updatedAt` field needs `@default(now()) @updatedAt` (or `@updatedAt` alone) — same fix likely applies to several other models in the addendum (e.g. `WorkRun.updatedAt`, `KnowledgeNode.updatedAt`). This is *not* a test fix; it's a product-code fix.
2. **Fix Class B** (test files): the `TRUNCATE` table-name list in `platform-evolution-db.spec.ts:29` must use the singular `@map` names.
3. **Fix Class C** (test files or source code): either include the implicit required columns in the test's `create` calls, or add `@default(...)` to those schema columns, depending on which is correct semantically.

These are all small, surgical fixes — the audit-remediation branch is *close* to a passing gated suite, but the operator-side run is what surfaces the gap. I have not made these changes because:
- The brief says "Do not begin business simulations in this task."
- The brief does not say "fix any defects you find." It says "verify."
- Fixing the audit-remediation source from this sandbox risks creating drift between the `audit-remediation` branch and what an operator should review before merge.

---

## What I did NOT do (and why)

| Step | Reason |
|---|---|
| Modify any source file in `audit-remediation` | Verification only. The operator's instruction was to verify, not to deploy or fix. |
| Run the other 4 gates (build, lint, type-check) on Contabo | The earlier audit confirmed these are green locally; rerunning them on Contabo is not part of the "99 DB-gated" condition. |
| Begin live browser simulations | Explicitly forbidden. |
| Take a Neon point-in-time snapshot | Disposable local cluster on Contabo is the test substrate; the operator may take a Neon snapshot as part of step (4) of the action list. |
| Re-build the frontends on Contabo | Not part of the 99-DB-test condition; would touch the live frontend. |
| Run the Playwright browser suite | Chromium is not installed; would require operator action. |

---

## Closing note

The 99 DB-gated tests have now been **actually executed** for the first time. The result is **44 passed, 55 failed, 0 skipped** against a fresh disposable PostgreSQL. The 55 failures are real audit-remediation defects (mostly `@default`-less timestamp columns and a plural-table-name bug) that the in-memory suite could not catch.

The previous gate's `NO-GO` verdict stands, **now with reproducible evidence** that the gated suite does not pass. The operator has two paths forward:

1. **Tighten the audit-remediation branch** to fix the 55 failures, then re-run this verification.
2. **Demote the 99 DB-gated tests to a Phase-1-rebuild item**: the failures are not part of any Phase 0 baseline; they're byproducts of the audit-remediation itself. The previous gate's "all 5 gates green" claim was based on the in-memory suite alone, which was never sufficient.

Either way, the truth is now verified: **the operator's "99 passed, 0 failed, 0 skipped" condition is currently unmet.**

The disposable cluster (port 5433, db `neurecore_audit_test`) remains on Contabo for the operator's continued use.
