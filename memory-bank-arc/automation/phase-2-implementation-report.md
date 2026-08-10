# Phase 2 Implementation Report — Employee-aware, Idempotent WorkRun

Date: 2026-08-10  
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`  
Phase: 2 — Make WorkRun Employee-aware and idempotent  
Verdict: **IMPLEMENTED; LIVE DATABASE EXIT PROOF PENDING**

## 1. Honest outcome

Phase 2 code and migration are implemented without cutting over a controller or
existing caller. Existing WorkRuntime creation remains compatible. Employee
runs use a separate, fail-closed, idempotent creation path.

The additive migration was inspected and statically tested, Prisma schema
validation passes, the backend builds, focused lint passes, all scoped
TypeScript diagnostics are clean, and 74 focused tests pass. The migration was
not applied to an unspecified database. The real PostgreSQL concurrency tests
were skipped because `DATABASE_TEST_URL` is absent. Docker was checked as a
safe disposable alternative, but no Docker daemon is available.

Consequently, this phase is implemented but not fully database-certified.

## 2. Additive data model

`WorkRun` now defines nullable, backward-compatible fields:

- `employeeId` — executing AI Employee;
- `requestedByActorId` — human/system/agent that requested the work;
- `taskId` — optional originating or associated task;
- `triggerType` — defaults to `USER` for old rows;
- `triggerSourceId`;
- `idempotencyKey`;
- `parentRunId`.

The migration adds:

- nullable foreign key from `work_runs.employeeId` to `Agent.id` using
  `ON DELETE SET NULL` so historical run evidence survives Agent deletion;
- unique `(tenantId, idempotencyKey)` boundary;
- tenant-prefixed Employee/time lookup index;
- tenant-prefixed task lookup index.

No existing column, table, enum, or data is dropped or rewritten. Existing
rows receive only the safe `triggerType = USER` default and retain null values
for all new optional metadata.

Migration:
`backend/prisma/migrations/20260810_ai_employee_work_run_identity/migration.sql`

## 3. Transactional create-or-get behavior

`WorkRunRepository.createOrGetByIdempotencyKey()` now:

1. runs through a Prisma transaction;
2. verifies the executing Agent exists under the supplied tenant;
3. looks up the tenant/key unique identity;
4. returns the existing canonical run when metadata matches;
5. creates exactly one new run when absent;
6. handles a unique-index race by loading the committed winner;
7. rejects reuse of a key for a different Employee, requester, objective,
   task, or trigger;
8. returns `{ run, created }`, allowing only the winner to produce snapshots,
   planning, events, steps, or effects.

The legacy `createRun()` method rejects Employee-aware input. This prevents a
caller from accidentally bypassing database idempotency while preserving all
legacy human WorkRun creation.

## 4. WorkRuntime behavior

Employee-aware creation requires:

- non-empty `employeeId`;
- non-empty `requestedByActorId`;
- non-empty run `idempotencyKey`;
- `actorType = AI_AGENT`;
- `actorId = employeeId`;
- a supported trigger: `USER`, `TASK`, `SCHEDULE`, `EVENT`, or `MISSION`.

An idempotent replay returns before context snapshot persistence, lifecycle
event publication, planning, step creation, or effects. Phase 3 will own the
create-and-execute orchestration around this result.

Every lifecycle event is enriched server-side with the persisted
`employeeId`. The run idempotency key remains persistence-only and is not
exposed through the public WorkRun view.

## 5. Employee resolution update

Phase 1 temporarily derived concurrency through legacy `actorId` and
`hermesAgentId` links because `WorkRun.employeeId` did not exist. Phase 2
replaces that compatibility lookup with the direct tenant-scoped
`WorkRun.employeeId` link.

Concurrency is still calculated from non-terminal WorkRuns and never from
mutable Agent status alone.

## 6. Stable Employee Run mapper

`EmployeeRunViewMapper` maps a persisted Employee WorkRun into the thin public
view without exposing:

- context provenance;
- raw plan data;
- prompts;
- tool inputs/results;
- persistence idempotency keys.

It rejects missing or mismatched Employee identity and normalizes the
runtime-only `PLANNED` state to the stable public `PLANNING` state.

## 7. Validation evidence

Executed from `backend/`:

```text
pnpm prisma validate
PASS

pnpm jest --config jest.config.js --runInBand \
  src/modules/work-runtime src/modules/ai-employee-core
PASS — 74 tests
SKIP — 14 database-gated tests across 3 suites

pnpm build
PASS

pnpm eslint <all Phase 1/2 changed TypeScript files>
PASS

pnpm tsc --noEmit --pretty false | scoped diagnostic filter
PASS — no diagnostics in ai-employee-core, work-runtime, or affected gateway consumers

git diff --check
PASS
```

The repository-wide TypeScript baseline still contains unrelated failures
recorded in Phase 0. No Phase 2 scoped diagnostic remains.

`prisma generate` exits successfully in this environment but did not refresh
the existing generated client timestamp. The committed source does not include
generated `node_modules` artifacts. A deployment or database certification job
must verify client generation after applying the migration.

## 8. Test coverage added

### Unit and architecture

- repository existing-row replay;
- repository new-row creation;
- foreign-tenant Employee rejection;
- idempotency metadata conflict rejection;
- requester and executor identity separation;
- replay skips snapshots, events, and planning;
- incomplete metadata and invalid trigger rejection;
- lifecycle events include Employee ID;
- legacy WorkRun view compatibility;
- stable mapper success, redaction, failure mapping, state normalization, and
  identity mismatch;
- executable migration SQL contains no destructive statements;
- all new indexes are tenant-prefixed;
- Agent deletion preserves historical WorkRun evidence.

### Real PostgreSQL suite, currently gated

`employee-run-idempotency-db.spec.ts` proves:

- eight concurrent callers receive one WorkRun ID;
- exactly one caller owns creation;
- only the winner produces one simulated effect set;
- the database contains one `(tenant, key)` row;
- the same key remains valid in another tenant;
- foreign-tenant Employee creation is rejected;
- tenant-scoped reads do not leak;
- old rows remain readable with nullable Employee metadata.

The suite performs targeted cleanup of only its unique test-owned rows and does
not truncate shared tables.

## 9. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Additive migration designed and inspected | Pass | schema validation and architecture SQL tests |
| Existing WorkRuntime tests remain green | Pass | focused suite: 74 passed |
| Repeated key skips duplicate planning/effects | Pass in unit layer | replay short-circuit tests |
| Employee and requester persist separately | Pass in code/unit layer | contract, repository, service tests |
| Employee ID present in lifecycle events | Pass | all-event assertion |
| Old rows remain readable | Pass in unit layer | explicit compatibility test |
| Migration applies to PostgreSQL | Pending | no disposable database available |
| Concurrent PostgreSQL create/effect proof | Pending | test implemented; `DATABASE_TEST_URL` absent |
| Generated Prisma client refreshed | Pending environment proof | generate exits 0 but local artifact timestamp stayed stale |

Final Phase 2 exit is **pending**, not failed. No behavioral cutover should occur
until the database and generated-client rows above pass.

## 10. Commands to close Phase 2

Against a disposable PostgreSQL database containing the migration history:

```bash
export DATABASE_TEST_URL='postgresql://.../neurecore_phase2_test?schema=public'

DATABASE_URL="$DATABASE_TEST_URL" pnpm prisma migrate deploy
pnpm prisma generate

pnpm jest --config jest.config.js --runInBand \
  src/modules/work-runtime/__tests__/employee-run-idempotency-db.spec.ts \
  src/modules/ai-employee-core/identity/employee-resolver-db.spec.ts
```

Before approving Phase 3, verify:

1. migration deployment reports success;
2. generated client contains `WorkRun.employeeId` and the compound unique key;
3. all database tests pass without skips;
4. pre/post row counts for existing WorkRuns match;
5. an old application binary can still read the additive schema;
6. the new backend build starts against it.

Rollback remains code rollback with the harmless nullable columns retained.
Physical column removal is unnecessary and should not be performed during this
consolidation.
