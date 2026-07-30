# Phase 4 Plan — Task-to-AI Assignment

**Source:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §6
**Phase duration:** 1.5 weeks
**Phase objective:** Assign eligible AI employees through explicit,
explainable, overridable logic. Tenants never enter UUIDs.

## 1. Authorization Gate

Per plan §1.4, each later phase requires its preceding gate evidence
and a phase-start approval. Phase 4 implementation starts after:

- G3 evidence captured (`phase-3/G3-TRANSACTIONAL-OUTBOX-EVIDENCE.md`)
- G3 sign-off recorded (governance only — technical work proceeds)

## 2. Phase 4 Workstreams

### 2.1 Schema migration

- `20260726_awl_g4_assignment_foundation` — `AgentClassification` enum
  (`INTERNAL` / `CONFIDENTIAL` / `RESTRICTED`); `agents.dataClassification`
  column with `agents_data_classification_idx`.
- `20260726_awl_g4_task_version` — `tasks.version` for optimistic
  concurrency on assignment / release / reassign; new
  `task_assignment_override_audits` table (plan §6.5 "Manual override
  is attributable and auditable").
- `20260726_awl_g4_assignment_lifecycle` —
  `task_assignments.releasedAt`, `releasedByActorId`, `releaseReason`,
  `expiresAt`, plus the `task_assignments_release_sweep_idx` used by
  the expired-sweep job (plan §6.2 "Define … assignment expiry").

### 2.2 Domain layer — `src/modules/assignments/`

- `domain/agent-capability.ts` — `AgentCapability`, `AgentFilter`,
  `ScoredAgent`, `SCORING_POLICY_V1` (versioned deterministic weights:
  capability 40 / workload 30 / department 20 / historical 10),
  `scoreAgent()` pure function, `tieBreak()` (workload → maxConcurrency
  → agent id lex order).
- `domain/ports/agent-repository.port.ts` — `IAgentRepository` with
  `findEligible()` (role / department / capabilities / classification
  filter), `loadWorkloads()`, `loadPerformance()`.
- `domain/ports/task-assignment-repository.port.ts` —
  `ITaskAssignmentRepository` with `findByGeneration`, `findLatestActive`,
  `create`, `updateStatus` (optimistic via `version`),
  `releaseExpired`, `recordOverrideAudit`, `listOverrideAudits`.

### 2.3 Adapters

- `infrastructure/prisma-agent.repository.ts` — SQL eligibility filter
  (`hasEvery` capabilities), `groupBy` for workload counts,
  `findMany` window for historical performance (counts attempts that
  reached `SUBMITTED_FOR_REVIEW` / `PAUSED` / `NEEDS_INPUT`).
- `infrastructure/prisma-task-assignment.repository.ts` — optimistic
  lock via `version=expectedVersion`, lease-aware `releaseExpired` sweep
  that respects `status='ACTIVE' AND expiresAt <= now()`.
- `common/persistence/prisma-task.repository.ts` — adds
  `updateAssignment` with optimistic concurrency, separates
  `updateStatus` from `updateAssignment`.
- `common/ports/di-tokens.ts` — exports `AGENT_REPOSITORY` and
  `TASK_ASSIGNMENT_REPOSITORY` symbols.

### 2.4 Application service — `application/assignment.service.ts`

`AssignmentService.executeAssign` (the AssignTaskCommand handler):

1. Re-fetch the task by `(tenantId, id)` and reject cross-tenant.
2. If the task already has an assignment for the same agent at the
   current generation, return a `deduplicated: true` command result.
3. Otherwise enforce `TaskStateMachine.assertTransition(status, 'ASSIGNED')`.
4. Build the eligibility filter from `task.requiredRole`,
   `task.requiredCapabilities`, `task.departmentId`, and
   `task.dataClassification`. Optionally tighten with explicit
   `requiredCapabilities` / `requiredRole` from the command.
5. If `agentId + manualOverrideRationale` is provided, take the manual
   override path (records an override audit row, emits
   `TaskAssigned` outbox with `manualOverride: true`).
6. Otherwise call `findEligibleAgents`, score deterministically, and
   pick the top result (or throw `NO_ELIGIBLE_AI_EMPLOYEE`).
7. Compute `nextGeneration` by scanning active + history generations.
8. Insert the `task_assignments` row at `nextGeneration` with
   `expiresAt` (default 8h), version=1.
9. Update the task via `updateAssignment` with optimistic `expectedVersion`.
10. If manual override → `recordOverrideAudit`.
11. Audit + `outbox.publish('TaskAssigned')` in the same transaction.

`AssignmentService.executeRelease` (the ReleaseAssignmentCommand
handler):

1. Re-validate task, find the latest `ACTIVE` assignment, reject if none.
2. Mark it `RELEASED` with `releasedAt`, `releasedByActorId`, `releaseReason`.
3. If `reassignToAgentId` + `reassignRationale` are present, insert
   a new row at `generation+1`, update the task, and (when
   `reassignManualOverride`) record an override audit row.
4. Otherwise drop the agent linkage and revert the task to `READY`.
5. Audit + outbox (`TaskAssignmentReleased` or `TaskAssigned`).

`AssignmentService.sweepExpiredReleases` — batch-transition expired
`ACTIVE` rows to `EXPIRED`.

`AssignmentService.listOverrideAudits` — read-only operator view.

### 2.5 Commands

- `commands/assign-task.command.ts` — typed `AssignTaskInput`,
  `AssignTaskResult`, command name `AssignTaskCommand:1.0`.
- `commands/release-assignment.command.ts` — typed
  `ReleaseAssignmentInput`, `ReleaseAssignmentResult`, command name
  `ReleaseAssignmentCommand:1.0`.
- Commands registered through the existing `CommandRegistry`
  (idempotency, request hashing, replay) by `AssignmentsModule`.

### 2.6 Controller

- `GET  /assignments/eligible-agents/:taskId` — ranked candidates.
- `POST /assignments/assign` — runs the `AssignTaskCommand` through
  `CommandRegistry`.
- `POST /assignments/release` — runs the `ReleaseAssignmentCommand`.
- `GET  /assignments/override-audit/:taskId` — reads the audit trail
  for a specific task.

All endpoints enforce `tenantId` from the JWT context.

### 2.7 Frontend — `frontend-tenant/src/components/assignments/`

`AgentPicker.tsx` (plan §6.3):

- Searchable list of eligible agents with name, role, capability
  match, current workload, department alignment, total score, policy
  version, and the rationale returned by the backend.
- "Manual override" details pane renders when `allowManualOverride`
  is true, with an override target dropdown + required rationale
  textarea.
- Submit button calls `onAssign(agentId, rationale)` — the user never
  types UUIDs; selection is by stable agent id.

### 2.8 Unit tests — 23 new

- `src/test/unit/assignment-scoring.spec.ts` (14 tests): policy weight
  sum to 100, deterministic scoring, workload penalty cap, department
  scoring, capability match, tie-break ordering, data-classification
  pass-through, policy version in rationale.
- `src/test/unit/assignment.service.spec.ts` (9 tests): auto-assign,
  manual-override audit + outbox, no-eligible rejection, cross-tenant
  rejection, pure release + TaskAssignmentReleased outbox,
  release + reassign new generation in one transaction, expired-sweep
  promotion, deterministic eligibility ranking, invalid state
  transition rejection.

## 3. Mapping to plan §6.4 / §6.5

| Plan Deliverable | Where it lives |
|---|---|
| Agent capability metadata | `AgentCapability` type + `Agent.dataClassification` |
| Deterministic eligibility filtering | `IAgentRepository.findEligible` (Prisma) + `findEligibleAgents` (service) |
| Scored selection | `scoreAgent()` + `getActiveScoringPolicy()` |
| Assignment decision persistence | `task_assignments` row + `tasks.version` increment |
| Searchable agent picker | `frontend-tenant/.../AgentPicker.tsx` |
| Manual override with authorization | `manualOverrideRationale` path → `task_assignment_override_audits` |
| Reassignment/unassignment behavior | `executeRelease` (reassign + drop-link variants) |
| Golden task receives one eligible AI employee | `executeAssign` auto path (deterministic pick) |
| Users never enter UUIDs manually | `AgentPicker` UI + `executionRequestId` derived ids |
| Assignment rationale is visible | `rationale` field on `task_assignments` + service `assign-result` |
| Invalid or cross-tenant assignment is rejected | `findById` tenant check + service `if (task.tenantId !== tenantId)` |
| Manual override is attributable and auditable | `task_assignment_override_audits` |
| Assignment persists consistently across views | `(tenantId, taskId, generation)` unique + `version` optimistic |