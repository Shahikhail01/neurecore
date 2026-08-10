# Phase 1 Implementation Report — AI Employee Contracts and Resolution

Date: 2026-08-10  
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`  
Phase: 1 — Add contracts and Employee resolution  
Verdict: **IMPLEMENTED; DATABASE EXIT PROOF PENDING**

## 1. Honest outcome

Phase 1 is implemented without cutting over any execution behavior.

The new module establishes a small application boundary and a read-only,
tenant-scoped Employee resolver. No controller uses the boundary, no existing
executor was replaced, and the `AI_EMPLOYEE_CORE` token deliberately has no
implementation binding yet. That binding belongs to Phase 3 after WorkRun
becomes Employee-aware and idempotent in Phase 2.

The backend build, focused lint, unit tests, architecture tests, and whitespace
checks pass. The real PostgreSQL tests exist but were skipped because
`DATABASE_TEST_URL` was not present. Therefore the phase must not be described
as fully certified yet.

## 2. Implemented boundary

Created `backend/src/modules/ai-employee-core/` with:

- `AI_EMPLOYEE_CORE` and `EMPLOYEE_RESOLVER` dependency-injection tokens;
- the future canonical `IAIEmployeeCore` start/get/list/resume/cancel contract;
- stable Employee run input and view types that do not expose persistence
  models;
- a narrow `IEmployeeResolver` contract;
- an immutable `ResolvedEmployee` projection;
- typed Employee resolution errors;
- `EmployeeResolverService`;
- an isolated Nest module exporting only `EMPLOYEE_RESOLVER`;
- unit, architecture, and real-database tests.

`AiEmployeeCoreModule` is registered in `AppModule`. It has no controller and
no execution side effect.

## 3. Resolver behavior

The resolver:

1. rejects missing, empty, and wildcard tenant identifiers through the
   existing `AGENT_TENANT_SCOPE` port;
2. queries Agent by both `id` and `tenantId` using an explicit Prisma select;
3. returns the same `EMPLOYEE_NOT_FOUND` result for missing and foreign-tenant
   IDs, avoiding tenant-existence disclosure;
4. rejects inactive, unselected, archived, offline, terminal, paused, errored,
   deprecated, or over-capacity Employees;
5. fails closed if persisted permissions are not an array of strings;
6. counts non-terminal WorkRuns instead of trusting mutable Agent status;
7. permits a `RUNNING`/`BUSY` Employee when its derived capacity remains;
8. returns only identity, role/instructions, capabilities, permissions,
   authority inputs, lifecycle/capacity facts, and advisory model preference;
9. freezes the returned object and all nested arrays/objects;
10. performs no write.

## 4. Current-schema compatibility decision

The current `WorkRun` schema has no `employeeId`. That direct link is planned
for Phase 2. Phase 1 therefore derives active concurrency through today's real
links:

- `actorType = AI_AGENT` and `actorId = Agent.id`; or
- `hermesAgentId = Agent.hermesAgentId`, when present.

This lookup is isolated and explicitly marked as a Phase 1 compatibility
boundary. It must be replaced by the direct, tenant-scoped Employee relation
after the additive Phase 2 migration. No schema was changed in Phase 1.

## 5. Validation evidence

Executed from `backend/`:

```text
pnpm build
PASS — Nest backend compiled

pnpm eslint "src/modules/ai-employee-core/**/*.ts"
PASS — no lint findings

pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core/identity/employee-resolver.service.spec.ts \
  src/modules/ai-employee-core/identity/employee-resolver.architecture.spec.ts \
  src/modules/ai-employee-core/identity/employee-resolver-db.spec.ts
PASS — 23 tests
SKIP — 2 PostgreSQL tests; DATABASE_TEST_URL absent

git diff --check
PASS
```

An earlier lint invocation also included the full existing `app.module.ts`. It
reported 44 pre-existing Prettier findings and one unused import elsewhere in
that file. None points to the two Phase 1 lines added there, and the backend
build passes. Those unrelated baseline findings were not reformatted in this
phase.

## 6. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| All resolution branches tested | Pass | 21 resolver unit tests plus 2 architecture tests |
| Resolver performs no write | Pass | architecture source gate and read-only implementation |
| No wildcard tenant path | Pass | shared guard tests and architecture source gate |
| No controller consumes new core | Pass | module contains no controller; no consumer of `AI_EMPLOYEE_CORE` |
| Real-database tenant isolation | Pending | two tests implemented; skipped without `DATABASE_TEST_URL` |

Final Phase 1 exit is **pending**, not failed: all implementation work is
present, but the real-database proof has not run in this environment.

## 7. Command required to close Phase 1

Provision a disposable PostgreSQL database with the current Prisma schema and
run:

```bash
DATABASE_TEST_URL='postgresql://...' pnpm jest --config jest.config.js \
  --runInBand \
  src/modules/ai-employee-core/identity/employee-resolver-db.spec.ts
```

Expected proof:

- owning tenant resolves its Employee;
- foreign tenant receives `EMPLOYEE_NOT_FOUND`;
- a persisted non-terminal Employee WorkRun exhausts configured capacity;
- test-owned rows are removed without truncating or modifying unrelated data.

Do not begin Phase 2 migration/cutover until this database suite passes.
