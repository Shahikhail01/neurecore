# Phase 8 Implementation Report — Compatibility Adapters and Caller Migration

Date: 2026-08-10
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`
Phase: 8 — Compatibility adapters and caller migration
Verdict: **MOSTLY IMPLEMENTED; DATABASE GATES INHERITED FROM PHASES 1-2; 8.2 LIVE CUTOVER PENDING**

## 1. Honest outcome

Phase 8 moved four execution surfaces onto the canonical `AIEmployeeCore`:

- **8.1 (Legacy agent dispatch)** — implemented and wired. `/agents/:id/dispatch`,
  `/agents/:id/task`, and `/agents/:id/cancel/:taskId` now go through the core via
  a compatibility adapter, preserve `202 Accepted`, return the canonical
  `workRunId`, and cancel WorkRuns. The synthetic local completion is no longer
  on the active dispatch route.
- **8.3 (Cognition and Autonomy)** — implemented and wired. `runtime.createRun()`
  is removed; handoff/scheduling now delegates to `core.start()` with explicit
  trigger, idempotency, and `requestedBy`, and blocked outcomes are recorded
  instead of leaving dormant `CREATED` runs.
- **8.4 (ExecutionAttempt)** — implemented (code + additive migration + tests).
  The synthetic `Draft execution for:` completion is removed; the attempt
  delegates business execution to the core and links `workRunId`. The worker
  retains the attempt envelope (claim/heartbeat/evidence/review). Migration
  apply and real-PostgreSQL proof remain gated.
- **8.2 (Agent Runtime + chat)** — the compatibility adapter is implemented and
  unit-tested, but the **live route cutover is NOT** forced. It is opt-in behind a
  feature flag and requires mapping the static OOB catalog to a concrete tenant
  Employee plus a real-database response-compatibility proof.

No production database was mutated. The additive `ExecutionAttempt.workRunId`
migration was inspected but not applied. As with Phases 1-7, the real-PostgreSQL
proofs remain gated on a disposable database (`DATABASE_TEST_URL`).

## 2. Implemented components

### 2.1 Core contract extension (foundation)

`contracts/ai-employee-core.interface.ts` + `application/ai-employee-core.service.ts`

Added two thin operations so compatibility adapters can preserve `202`-style
durable creation without blocking on full execution:

- `startDurable(input)` — create-or-get the canonical run and return
  `{ run, created }`; only the creation winner may execute.
- `executeRun(tenantId, runId)` — execute an existing run and map the view.

`start()` is now a thin composition of `startDurable` + `executeRun`.

### 2.2 8.1 — LegacyAgentDispatchAdapter

`adapters/legacy-agent-dispatch.adapter.ts` (+ tests)

- Depends only on `AI_EMPLOYEE_CORE`.
- `dispatchTask(taskId, agentId, tenantId, actorId)`:
  - idempotency key `legacy-dispatch:${tenantId}:${taskId}:${agentId}`;
  - trigger `{ type: 'TASK', sourceId: taskId }`;
  - awaits the durable create (returns `workRunId` + status), then fires only
    the execution without blocking the response;
  - on an idempotent replay, never re-executes.
- `cancelTask(tenantId, taskId)` — cancels all non-terminal WorkRuns for the task.

`agents.controller.ts` now injects the adapter; `dispatch`/`dispatchTask` return
`{ taskId, agentId, workRunId, runStatus }` at `202`; `cancel` delegates to
`core.cancel`. `AgentsModule` imports `AiEmployeeCoreModule` via `forwardRef`
(bidirectional with `ai-employee-core.module.ts`).

### 2.3 8.3 — Cognition and Autonomy migration

`enterprise-cognition.service.ts`, `enterprise-autonomy.service.ts`, module
wiring, architecture specs, and unit tests.

- Both services now inject `IAIEmployeeCore` (via `AI_EMPLOYEE_CORE`) instead of
  `IWorkRuntime`; their modules import `AiEmployeeCoreModule`.
- Cognition `autoHandoff`: delegates to `core.start()` with trigger
  `{ type: 'EVENT', sourceId: requestId }` and a hashed idempotency key.
  `CognizeParams` gained optional `handoffEmployeeId`; without it, the handoff is
  BLOCKED and logged (no dormant run).
- Autonomy `scheduleMission`: delegates to `core.start()` with trigger
  `{ type: 'MISSION', sourceId: mission.id }`, hashed idempotency key, and
  `requestedBy` carrying the caller's actor type (HUMAN/SYSTEM). Missions without
  an `assignedEmployeeId` are blocked and counted; failures are logged as blocked
  outcomes, not silently swallowed.
- Architecture specs updated: the only runtime interaction is now
  `this.core.start(`, and `runtime.createRun(` is forbidden.

### 2.4 8.4 — ExecutionAttempt delegation

`execution-orchestrator.ts`, `execution.worker.ts`, `execution.module.ts`,
repository + port, Prisma model + additive migration, unit tests.

- `runExecution()` now calls `core.start()` (idempotency key
  `execution-attempt:${attemptId}`, trigger `{ type: 'TASK', sourceId: taskId }`,
  `employeeId = agentId`) instead of fabricating `Draft execution for:`.
- Completion is honest: if the canonical run did not reach `COMPLETED`, the
  orchestrator throws `EXECUTION_NOT_COMPLETED:...` so the worker never marks the
  attempt complete on a non-terminal run.
- `ExecutionRuntimeResult` carries `workRunId`; the worker persists it on the
  attempt (`PRODUCING_EVIDENCE` update) and writes evidence mapped from the run.
- `ExecutionAttempt` gained nullable `workRunId` + tenant-prefixed index.
  Migration: `prisma/migrations/20260810_ai_employee_execution_attempt_work_run/`.
- `ExecutionModule` imports `AiEmployeeCoreModule` (no cycle).

### 2.5 8.2 — AgentRunCompatAdapter (adapter implemented; live cutover pending)

`adapters/agent-run-compat.adapter.ts` (+ tests)

- Translates an `AgentRunRequest`-shaped input into `core.startDurable` +
  `executeRun` and maps the canonical `EmployeeRunView` to an
  `AgentRunResult`-compatible shape.
- Non-terminal canonical states map honestly:
  - `WAITING_FOR_APPROVAL` → `APPROVAL_REQUIRED`;
  - `PAUSED` / non-terminal → `CLARIFICATION_REQUIRED`;
  - `FAILED`/`CANCELLED` → `FAILED` with reason.
- Registered and exported from `AiEmployeeCoreModule`.

Live cutover of `/agents/:id/run`, `/agent-runtime/run`, and chat `/agent` to the
core is **not** forced in this change set. It is the opt-in
`ai_employee_core.legacy_adapter.enabled` path (plan §12) and depends on mapping
the static OOB catalog to a concrete tenant Employee and a real-database
response-compatibility proof; `AgentRun` rows continue to be written until
response compatibility is proven (Phase 11 retirement).

## 3. Test coverage added / updated

| Suite | Tests | Result |
|-------|------:|--------|
| `legacy-agent-dispatch.adapter.spec.ts` (new) | 5 | ✅ |
| `agent-run-compat.adapter.spec.ts` (new) | 5 | ✅ |
| `execution-orchestrator.spec.ts` (new) | 4 | ✅ |
| `enterprise-cognition.spec.ts` (updated) | +block/no-employee case | ✅ |
| `enterprise-autonomy/__tests__/autonomy-in-memory.spec.ts` (updated) | core-based | ✅ |
| `architecture.spec.ts` (cognition + autonomy) | updated to `core.start(` | ✅ |
| `legacy-executor-gate.spec.ts` | unchanged | ✅ |

Key scenarios:

- 8.1: durable create returns workRunId; replay never re-executes; only
  non-terminal runs cancelled; start failure propagates (no synthetic success).
- 8.3: handoff executes via `core.start` with an Employee; handoff blocked (no
  dormant run) without an Employee; autonomy propagates HUMAN/SYSTEM actor type
  and MISSION trigger.
- 8.4: completed run → result with workRunId; non-terminal run → `EXECUTION_NOT_
  COMPLETED` (never reported complete); missing instructions → typed failure;
  artifacts mapped to evidence.
- 8.2: completed / approval / clarification / failed canonical states map
  honestly; replay not re-executed.

## 4. Validation evidence

Executed from `backend/`:

```text
pnpm prisma validate
PASS — schema valid

pnpm build
PASS

pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core src/modules/agents src/modules/work-runtime \
  src/modules/execution src/modules/enterprise-cognition \
  src/modules/enterprise-autonomy src/test/architecture
PASS — 41 suites passed, 5 skipped (DB-gated), 360 passed, 26 skipped, 0 failures

pnpm eslint <all Phase 8 changed/new files>
PASS — 0 errors on Phase 8 files; only a pre-existing unused-import warning in
       agents.controller.ts (EntityOwnerGuard, not introduced here)

pnpm exec tsc --noEmit (scoped to Phase 8 files)
PASS — no diagnostics in ai-employee-core, agents controller/module, execution,
       enterprise-cognition.service, enterprise-autonomy.service

git diff --check
PASS
```

## 5. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Every active execution entry point reaches Work Runtime | Partial | dispatch/task/cancel (8.1), cognition/autonomy handoff (8.3), ExecutionAttempt (8.4) reach the core. Agent Runtime `/run` and chat `/agent` still use AgentRuntime by default (8.2 cutover pending). |
| Compatibility response tests pass | Partial | adapter translation tests pass; live HTTP response compatibility not proven against a DB |
| No active route reaches synthetic local completion | Pass (for migrated routes) | `executeTask` no longer used by dispatch/task/cancel; `Draft execution for:` removed from orchestrator |
| No duplicate run created during adapter retries | Pass (unit layer) | idempotent startDurable replay short-circuits; real-Postgres concurrency proof pending |
| Real-PostgreSQL concurrency / tenant-isolation / migration apply | Pending | inherited; `DATABASE_TEST_URL` absent |

## 6. Honest limitations

- **Database/deployment gates pending.** The additive `workRunId` migration and
  the real-PostgreSQL idempotency/tenant-isolation proofs are not run in this
  environment (no disposable DB), inherited from Phases 1-2. This phase is not
  fully database-certified.
- **8.2 live cutover pending.** The Agent Runtime and chat `/agent` routes still
  use the Phase-23 `AgentRuntime` by default. The core-backed compatibility
  adapter is implemented and tested, but mapping the static OOB catalog to a
  concrete tenant Employee and proving response compatibility against a real DB
  is required before cutover; `AgentRun` rows continue to be written until then
  (Phase 11 retirement).
- **8.1 objective is task-scoped, not task-content.** The dispatch objective is
  `Execute assigned task ${taskId}`; the context plane supplies task context via
  `taskId`. Full task-content plumbing into the planner objective is a follow-up.
- **8.4 evidence is reference/summary-based.** `EmployeeRunView.artifacts` are
  references (id/type/name) and the view redacts full content, so the worker's
  `EvidenceArtifact` rows are mapped from the run summary/artifact name, not the
  full artifact body. The attempt envelope (claim/heartbeat/fencing/review) is
  retained.
- **Pre-existing lint debt in touched files.** `enterprise-cognition.service.ts`
  and `enterprise-autonomy.service.ts` `publish()` template literals carry
  `no-base-to-string`/`restrict-template-expressions` lint findings that predate
  this phase (those methods were not modified). Global backend `tsc --noEmit`
  remains red with the recorded baseline debt (incl. hermes-adapter spec); no new
  tsc error was introduced in any Phase 8 file.

## 7. Next action

- **8.2 cutover** — decide catalog→tenant-Employee mapping; enable
  `ai_employee_core.legacy_adapter.enabled` per tenant; prove response
  compatibility against a disposable DB.
- **DB certification** — provision a disposable PostgreSQL, `prisma migrate
  deploy` both additive migrations, and run the Phase 2 idempotency suite plus an
  HTTP dispatch/task vertical slice.
- **Phase 9** — tenant frontend Employee activity view (consume canonical runs).
