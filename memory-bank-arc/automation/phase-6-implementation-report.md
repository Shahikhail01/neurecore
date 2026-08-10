# Phase 6 Implementation Report — Deterministic Employee Selection and Task Assignment

Date: 2026-08-10
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`
Phase: 6 — Add deterministic Employee selection and task assignment
Verdict: **IMPLEMENTED; DATABASE GATES INHERITED FROM PHASES 1-2**

## 1. Honest outcome

Phase 6 adds a read-only `EmployeeEligibilityPort`, a deterministic eligibility
service, an expanded `tasks.create` tool, and a governed `tasks.assign`
INTERNAL_WRITE tool that re-validates eligibility inside the tool (never
trusting planner output). No legacy executor was replaced, no production
database was mutated, and no new schema migration was introduced.

The implementation is covered by focused unit and architecture tests, passes the
backend build, scoped TypeScript diagnostics, focused lint, and the existing
ai-employee-core / work-runtime / architecture suites. As with Phases 1-5, the
real-PostgreSQL concurrency and tenant-isolation proofs remain gated on a
disposable database (`DATABASE_TEST_URL`), so this phase is not fully
database-certified.

## 2. Implemented components

### 2.1 EmployeeEligibilityPort (contract)

`contracts/employee-eligibility.interface.ts`

| Export | Purpose |
|--------|---------|
| `EmployeeEligibilityCriteria` | `requiredCapabilities`, `requiredRole`, `departmentId`, `dataClassification`, `limit` |
| `EligibleEmployee` | Immutable ranked projection (coverage, matches, workload, score, reasons) |
| `IEmployeeEligibility` | `findEligible()` + `assertEligible()` |
| `EMPLOYEE_ELIGIBILITY` | DI symbol token |

Separate from `IEmployeeResolver`: the resolver proves one Employee is
executable by the core right now; eligibility ranks the tenant's Employees for
assignment and re-validates a planner-nominated Employee inside `tasks.assign`.

### 2.2 EmployeeEligibilityService

`eligibility/employee-eligibility.service.ts`

- tenant-scoped, read-only (uses `AGENT_TENANT_SCOPE.assert`);
- queries only tenant Employees meeting: active / selected / non-archived,
  availability not OFFLINE/ARCHIVED, status not PAUSED/ERROR/TERMINATED/
  DEPRECATED;
- filters by required capability coverage (all must be covered);
- optional department / role / data-classification (INTERNAL < CONFIDENTIAL <
  RESTRICTED) constraints;
- concurrency from non-terminal `WorkRun.employeeId` counts (never mutable
  Agent status);
- deterministic ranking: capability coverage, then role/department match, then
  workload (fewer active WorkRuns first), then stable Agent ID ascending;
- freezes returned objects/arrays;
- `assertEligible()` returns `EMPLOYEE_NOT_FOUND` for missing/foreign IDs and
  `TASK_ASSIGNMENT_INELIGIBLE` for existing-but-ineligible Employees.

### 2.3 Expanded `tasks.create`

`work-runtime/tools/runtime-tools.provider.ts`

`TasksService.create()` and the `tasks.create` tool now accept and persist
validated `projectId`, `goalId`, `dueDate`, `acceptanceCriteria`,
`expectedOutput`, `requiredRole`, `requiredCapabilities`, and `capabilityTags`.
The tool also records the originating `workRunId`/`stepId` in the task's `input`
JSON metadata so the UI can follow Task -> Work Run.

### 2.4 `tasks.assign` (INTERNAL_WRITE)

`adapters/employee-task-tools.provider.ts` — `EmployeeTaskToolsProvider`

- `employees.find_eligible` (READ, authority 10): delegates to the eligibility
  port, returns ranked eligible Employees.
- `tasks.assign` (INTERNAL_WRITE, authority 50): requires `taskId` +
  `employeeId`, calls `assertEligible()` (re-validating capability/role/
  department/classification/capacity inside the tool) and then
  `TasksService.assignToEmployee()`, returning `taskId`, `employeeId`,
  `workRunId`, and status.

### 2.5 Idempotent assignment

`TasksService.assignToEmployee()` is idempotent under retry: if the task is
already assigned to the same agent for the same `workRunId`, it returns the
existing task without a second write. Eligibility re-validation is not skipped
on replay — it still runs first.

### 2.6 Module wiring

`ai-employee-core.module.ts` now imports `OrchestrationModule` (for
`TasksService`), provides `EmployeeEligibilityService`
(`EMPLOYEE_ELIGIBILITY` token) and `EmployeeTaskToolsProvider`. No circular
dependency was introduced.

## 3. Test coverage

| Suite | Tests | Status |
|-------|------:|--------|
| `employee-eligibility.service.spec.ts` | 8 | ✅ Passing |
| `employee-task-tools.provider.spec.ts` | 9 | ✅ Passing |
| `employee-eligibility.architecture.spec.ts` | 6 | ✅ Passing |

### Key scenarios covered

- wildcard tenant rejected before any query;
- only Employees covering all required capabilities returned;
- ineligible role / department / classification / overloaded Employees excluded;
- deterministic ranking (coverage, role/dept, workload, stable ID);
- immutability of returned projections;
- `assertEligible` success, `EMPLOYEE_NOT_FOUND` for foreign/missing, and
  `TASK_ASSIGNMENT_INELIGIBLE` for ineligible;
- fabricated Employee ID rejected before any write;
- tool metadata (READ/INTERNAL_WRITE, authority, no approval);
- eligibility re-validation inside `tasks.assign` before assignment;
- honest typed failure (no synthetic success).

## 4. Validation evidence

Executed from `backend/`:

```text
pnpm prisma validate
PASS

pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core \
  src/modules/work-runtime \
  src/test/architecture
PASS — 24 suites, 223 passed, 14 skipped (0 failures)

pnpm build
PASS

pnpm eslint <all Phase 6 changed/new files>
PASS — no findings in Phase 6 files

pnpm exec tsc --noEmit (scoped to Phase 6 files)
PASS — no diagnostics

git diff --check
PASS
```

The `runtime-tools.provider.ts` and `tasks.service.ts` files contain pre-existing
Prettier/type-safety findings (baseline recorded in Phases 0/4). My added lines
introduce no new lint errors (provider findings in the added block: none;
`tasks.service` non-prettier count unchanged at 5 after line-shift).

## 5. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Planner cannot assign a fabricated or foreign Employee ID | Pass | `tasks.assign` calls `assertEligible`; `EMPLOYEE_NOT_FOUND`/`TASK_ASSIGNMENT_INELIGIBLE`; test "rejects a fabricated or foreign Employee ID before any write" |
| One task created and assigned under retry/concurrency | Pass (unit layer) | `assignToEmployee` idempotent replay + step-level idempotency in WorkRuntime; real-Postgres proof pending |
| Overloaded/ineligible Employees are not selected | Pass | `findEligible` filters by capacity + eligibility; overloaded test excluded |
| Frontend can follow Task -> Employee -> Work Run | Pass (contract) | Task persists `workRunId`/`stepId` in `input`; `tasks.assign` returns `workRunId`; WorkRun already links `taskId` |
| Real-database tenant isolation | Pending | inherited from Phases 1-2; `DATABASE_TEST_URL` absent |

## 6. Honest limitations

- **No schema migration for a `Task.workRunId` column.** The Task->WorkRun
  linkage is stored in the task's `input` JSON metadata (least disruptive),
  matching the plan's "prefer an explicit nullable field if needed" guidance —
  an explicit nullable `workRunId` column can be added later without breaking
  this path.
- **Real-PostgreSQL proof pending.** Concurrency/idempotency and tenant
  isolation against PostgreSQL remain gated on a disposable database, as for
  Phases 1-5.
- **Assignment writes via `TasksService` public command.** `tasks.assign`
  updates `Task.agentId` + `input` metadata; it does not create a
  `TaskAssignment` row (that heavier lifecycle belongs to the existing
  `AssignmentService`). This keeps the tool narrow and SOLID; callers needing
  the full assignment lifecycle can compose with `AssignmentService` later.
- **No new task-assignment-specific feature flag.** The Phase 12 flag
  `ai_employee_core.task_assignment.enabled` is not yet introduced; tools are
  registered at bootstrap alongside the existing Phase 4/5 tools.

## 7. Next action

Phase 7 — Implement real approval request and resume:
1. inject `IApprovalPort` into the Work Runtime approval collaborator;
2. persist approval ID on the step and stop before tool execution;
3. approve/reject resume exactly once with re-validation;
4. prohibit requester/AI self-approval;
5. split internal draft vs external approval-sensitive actions.
