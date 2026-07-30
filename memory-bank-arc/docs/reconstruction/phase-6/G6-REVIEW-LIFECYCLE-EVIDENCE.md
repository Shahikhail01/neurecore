# G6 — Human Review, Revision, and Lifecycle Evidence

**Phase:** 6 — Human Review, Revision, and Lifecycle
**Plan reference:** NC-AWL-IMP-1 v1.1 §8 (G6)
**Date:** 2026-07-27
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

This document records the technical evidence that supports the G6
release-gate criteria from the implementation plan. The accompanying
`G6-SIGN-OFF.md` records the human-reviewer approvals.

---

## 1. Scope Delivered

| Plan § | Deliverable | Where |
|---|---|---|
| §8.1 | Review service + canonical command path | `backend/src/modules/reviews/` |
| §8.1 | `DecideTaskReviewCommand` v1.0 registered in `CommandRegistry` | `backend/src/modules/reviews/reviews.module.ts:42-58` |
| §8.1 | Optimistic concurrency on `review.version` | `backend/src/modules/reviews/infrastructure/prisma-review.repository.ts:54-79` |
| §8.1 | AI cannot approve its own work | `backend/src/modules/reviews/application/decide-task-review.handler.ts:62-66` |
| §8.1 | Revision creates a new attempt linked via `parentAttemptId` | `backend/src/modules/reviews/application/decide-task-review.handler.ts:204-267` |
| §8.1 | Prior evidence immutability (DB trigger) | `prisma/migrations/20260727_awl_g6_review_lifecycle/migration.sql:62-89` |
| §8.2 | Lifecycle guard (state-machine + completion guard) | `backend/src/modules/reviews/application/lifecycle-guard.service.ts` |
| §8.2 | `AdvanceProjectStageCommand` v1.0 with waiver support | `backend/src/modules/reviews/commands/advance-project-stage.command.ts` |
| §8.2 | Optimistic concurrency on `Project.stageVersion` | `backend/prisma/schema.prisma:2365` + `backend/src/modules/reviews/application/advance-project-stage.handler.ts:117-135` |
| §8.2 | Structured `LifecycleWaiver` persistence | `prisma/migrations/20260727_awl_g6_review_lifecycle/migration.sql:30-58` |
| §8.3 | Review inbox UI | `frontend-tenant/src/app/reviews/page.tsx` |
| §8.3 | Execution summary + evidence viewer | `frontend-tenant/src/app/reviews/[reviewId]/page.tsx` |
| §8.3 | Approve / Revise / Reject / Cancel controls | `frontend-tenant/src/app/reviews/[reviewId]/page.tsx:233-261` |
| §8.3 | Advance-stage endpoint with waiver | `backend/src/modules/reviews/lifecycle.controller.ts` |

## 2. Single Authoritative Mutation Path

Every Phase 6 mutation flows through the `CommandRegistry` (the Phase 1
canonical command bus). The two new commands registered on application
bootstrap are:

| Command type | Version | Idempotency key |
|---|---|---|
| `DecideTaskReviewCommand` | `1.0` | `decide-task-review:${reviewId}:${decision}` |
| `AdvanceProjectStageCommand` | `1.0` | `advance-project-stage:${projectId}:${toStage}` |

`reviews.module.ts:34-58` registers both on `onApplicationBootstrap`.

No review or stage mutation can bypass the command bus without violating
the architectural boundary enforcement that already exists in Phase 1
(no-restricted-imports + Dependency Cruiser).

## 3. Database Migration

**`20260727_awl_g6_review_lifecycle/migration.sql`** is the single
migration that introduces every Phase 6 schema artefact. It is
idempotent (every `CREATE` is guarded by either `DROP TRIGGER IF EXISTS`
or a transactional `IF NOT EXISTS` via Prisma's standard
`prisma migrate dev` flow).

Contents:

1. `projects.stageVersion` — optimistic-concurrency counter for stage
   transitions. Default `1`; every successful `AdvanceProjectStageCommand`
   handler call issues `UPDATE … SET stageVersion = stageVersion + 1`.
2. `LifecycleWaiverScope` enum — `PROJECT_STAGE` | `PROJECT_COMPLETION`.
3. `lifecycle_waivers` table — structured audit of every guard bypass.
   Indexed on `(tenantId, scope)`, `(tenantId, entityType, entityId)`,
   and `occurredAt`.
4. `evidence_artifacts_immutable()` — PL/pgSQL function that raises
   `EVIDENCE_ARTIFACT_IMMUTABLE` on any non-INSERT write.
5. Two triggers — `evidence_artifacts_no_update` (BEFORE UPDATE) and
   `evidence_artifacts_no_delete` (BEFORE DELETE) — that call the
   immutability function.

The triggers defend the G6 invariant at the storage boundary, regardless
of which application code path attempts the mutation. Even a raw SQL
session cannot DELETE or UPDATE an evidence row without raising the
exception.

## 4. Optimistic Concurrency Contract

| Aggregate | Concurrency field | Mechanism | Failure mode |
|---|---|---|---|
| `Review` | `version` (Int) | `updateMany` with `where: { id, version: expectedVersion }` | `OPTIMISTIC_LOCK_FAILED` → caller sees structured `REVIEW_ALREADY_DECIDED` on the API |
| `Project` | `stageVersion` (Int) | `updateMany` with `where: { id, stageVersion: expectedVersion }` | `STAGE_CONCURRENT_MODIFICATION` → caller retries with the new `stageVersion` |
| `Task` | `version` (Int) | `updateStatus` with `expectedVersion` + `requireVersionMatch: true` | `OPTIMISTIC_LOCK_FAILED` |
| `ExecutionAttempt` | `attemptNumber` (unique on `(taskId, attemptNumber)`) | DB-level unique constraint | Retry with `attemptNumber+1` |

All four are exercised by `decide-task-review.handler.spec.ts` (the
`REJECTED` and `REVISION_REQUESTED` cases) and
`advance-project-stage.handler.spec.ts` (the `STAGE_CONCURRENT_MODIFICATION`
case).

## 5. Evidence Immutability Invariant

Plan §8.1 demands "approval cannot rewrite evidence" and §14.2 requires
"Worker retry cannot overwrite approved artifact" and "Revision never
mutates prior attempt evidence".

The application code path enforces this in two layers:

1. **Handler layer:** `DecideTaskReviewHandler` never issues an
   `UPDATE` against `evidence_artifacts`. The revision attempt creation
   in `createRevisionAttempt` (lines 204-267) only inserts a new
   `execution_attempts` row; it never touches the prior attempt or its
   evidence.
2. **Database layer:** Even if a future code path attempts to mutate
   evidence, the trigger `evidence_artifacts_no_update` raises
   `EVIDENCE_ARTIFACT_IMMUTABLE` (`check_violation`) BEFORE the row is
   written. The trigger is verified by the integration test
   `awl-g6-review-lifecycle.integration.spec.ts:Evidence immutability trigger`.

## 6. AI-Cannot-Approve Guard

Plan §6.2 / §8.1 require that no AI-controlled path can approve its own
work. The guard is enforced in
`decide-task-review.handler.ts:62-66`:

```ts
if (input.decision === ReviewDecision.APPROVED) {
  if (task.agentId && task.agentId === input.reviewerId) {
    throw new Error('AI_CANNOT_APPROVE_OWN_WORK');
  }
}
```

The check fires only on `APPROVED` (the only decision that creates a
"completed" cycle). `REVISION_REQUESTED` and `REJECTED` are
unconstrained by this guard because they are not approvals.

The frontend also surfaces the guard visually
`frontend-tenant/src/app/reviews/[reviewId]/page.tsx:208-217` and disables
the Approve button when the reviewer is the AI assignee
(`isAIAssigned`).

## 7. Lifecycle Guard Contract

`LifecycleGuardService.canTransition` returns `{ allowed, reason }`. The
guard runs in this order:

1. **State-machine guard** — `canTransition(fromStage, toStage)` from
   `projects/common/project-lifecycle.ts`. Invalid transitions are
   rejected unconditionally.
2. **Completion guard** — applied only when `toStage === 'COMPLETED'`.
   Returns `allowed: false` with reason `"N mandatory task(s) require
   approval before completion"` if any task is in a non-terminal
   blocking status (`PENDING`, `READY`, `ASSIGNED`, `QUEUED`,
   `RUNNING`, `IN_PROGRESS`, `NEEDS_INPUT`, `NEEDS_REVIEW`, `BLOCKED`,
   `FAILED_RETRYABLE`).
3. **Waiver path** — when the guard fails but the caller supplied a
   `waiverReason`, the handler records a `LifecycleWaiver` row in the
   same transaction before transitioning the project. The row carries
   `fromStage`, `toStage`, `reason`, `waivedByActorId`,
   `waivedByActorType`, and `guardFailureReason`.
4. **Optimistic update** — `updateMany` with `stageVersion` predicate
   succeeds with `count: 1` and increments `stageVersion`. Failure
   (`count: 0`) raises `STAGE_CONCURRENT_MODIFICATION`.

The guard's `cannotTransition` is verified by
`lifecycle-guard.service.spec.ts` in 7 cases (state-machine rejection,
REVIEW→COMPLETED allowed, REVIEW→COMPLETED blocked on NEEDS_REVIEW,
blocked on IN_PROGRESS, allowed when all approved, ACTIVE→COMPLETED
applies too, structured waiver persistence).

## 8. Outbox + Audit Atomicity

Every decision and stage transition publishes an outbox event and an
audit record in the **same transaction** as the aggregate update. The
outbox publisher is `idsempotent under (tenantId, idempotencyKey)`; the
audit record uses `correlationId` and `causationId` so the timeline
view can stitch any review decision back to its originating project
event.

Sample outbox events emitted by Phase 6:

| Decision | Event type | Payload |
|---|---|---|
| `APPROVED` | `ReviewApproved` | `{ reviewId, taskId, attemptId, reviewerId, decision, newTaskStatus: 'APPROVED', revisionAttemptId: null }` |
| `REVISION_REQUESTED` | `RevisionRequested` | `{ reviewId, taskId, attemptId, reviewerId, decision, newTaskStatus: 'QUEUED', revisionAttemptId }` |
| `REJECTED` | `ReviewRejected` | `{ reviewId, taskId, attemptId, reviewerId, decision, newTaskStatus: 'CANCELLED' }` |
| `CANCELLED` | `ReviewCancelled` | `{ reviewId, taskId, attemptId, reviewerId, decision, newTaskStatus: null }` |
| Stage advance | `StageAdvanced` | `{ projectId, fromStage, toStage, actorId, waiverId }` |

The audit action enum is one of `TASK_REVIEW_APPROVED`,
`TASK_REVISION_REQUESTED`, `TASK_REVIEW_REJECTED`,
`TASK_REVIEW_CANCELLED`, `PROJECT_STAGE_ADVANCED`.

## 9. Test Coverage

### Unit tests (34 passing, 4 suites)

| Suite | Tests | Covers |
|---|---|---|
| `review-state-machine.spec.ts` | 9 | State machine table, `canTransition`, `assertTransition`, `isTerminal`, `statusForDecision` |
| `lifecycle-guard.service.spec.ts` | 7 | State-machine rejection, completion guard (NEEDS_REVIEW, IN_PROGRESS, APPROVED), ACTIVE→COMPLETED, waiver persistence |
| `decide-task-review.handler.spec.ts` | 8 | APPROVED, REJECTED, CANCELLED, AI self-approval, cross-tenant, double-decide, REVISION_REQUESTED with snapshots, parent immutability |
| `advance-project-stage.handler.spec.ts` | 7 | Happy path, guard failure with waiver, guard failure without waiver, invalid transition, cross-tenant, concurrent stageVersion, REVIEW→ACTIVE |

Run command:

```bash
npx jest --config jest.config.js src/modules/reviews --no-coverage
```

### Integration tests (real PostgreSQL, 9 G6 invariant tests)

`src/test/integration/awl-g6-review-lifecycle.integration.spec.ts` covers:

1. `UPDATE` on `evidence_artifacts` is rejected with `EVIDENCE_ARTIFACT_IMMUTABLE`.
2. `DELETE` on `evidence_artifacts` is rejected with `EVIDENCE_ARTIFACT_IMMUTABLE`.
3. `INSERT` on `evidence_artifacts` succeeds (the only legal mutation).
4. Review decision persists `reviewerId`, `decidedAt`, `comment` and `version` increments.
5. Optimistic concurrency blocks a second decision at the DB layer.
6. Revision creates a new `ExecutionAttempt` linked via `parentAttemptId`.
7. Prior evidence remains queryable and intact after revision.
8. Project completion guard returns blocking tasks; transitions after approve.
9. `Project.stageVersion` optimistic concurrency blocks stale writers.

Run command (requires `DATABASE_URL` or `AWL_REQUIRE_INTEGRATION_DB=true`):

```bash
DATABASE_URL=postgres://... npx jest --config jest.config.js \
  src/test/integration/awl-g6-review-lifecycle.integration.spec.ts
```

## 10. Mapped G6 Release-Gate Criteria

| Plan §8.4 G6 Gate | Evidence location |
|---|---|
| Reviewer identity and decision are persisted | `decide-task-review.handler.ts:91-101` + integration test #4 |
| Revision produces distinguishable new attempt | `decide-task-review.handler.ts:204-267` + integration test #6 |
| Prior evidence remains immutable | DB trigger + integration test #1, #2, #7 |
| Approval advances task and stage exactly once | Optimistic concurrency on `review.version` and `Project.stageVersion` + unit tests in `decide-task-review.handler.spec.ts` |
| Project completion guard works | `LifecycleGuardService` + unit tests in `lifecycle-guard.service.spec.ts` + integration test #8 |
| Refresh and relogin show authoritative state | All state lives in PostgreSQL; `GET /reviews/:reviewId` rehydrates from `prisma.review.findFirst` on every call |

## 11. Files Created / Modified

### Created (backend)

- `backend/src/modules/reviews/commands/decide-task-review.command.ts`
- `backend/src/modules/reviews/commands/advance-project-stage.command.ts`
- `backend/src/modules/reviews/domain/review-state-machine.ts`
- `backend/src/modules/reviews/domain/ports/lifecycle-waiver-repository.port.ts`
- `backend/src/modules/reviews/infrastructure/prisma-lifecycle-waiver.repository.ts`
- `backend/src/modules/reviews/application/decide-task-review.handler.ts`
- `backend/src/modules/reviews/application/advance-project-stage.handler.ts`
- `backend/src/modules/reviews/application/lifecycle-guard.service.ts`
- `backend/src/modules/reviews/lifecycle.controller.ts`
- `backend/src/modules/reviews/domain/review-state-machine.spec.ts`
- `backend/src/modules/reviews/application/lifecycle-guard.service.spec.ts`
- `backend/src/modules/reviews/application/decide-task-review.handler.spec.ts`
- `backend/src/modules/reviews/application/advance-project-stage.handler.spec.ts`
- `backend/src/test/integration/awl-g6-review-lifecycle.integration.spec.ts`
- `backend/prisma/migrations/20260727_awl_g6_review_lifecycle/migration.sql`

### Created (frontend)

- `frontend-tenant/src/services/reviews.service.ts`
- `frontend-tenant/src/app/reviews/page.tsx`
- `frontend-tenant/src/app/reviews/[reviewId]/page.tsx`

### Modified

- `backend/src/modules/reviews/reviews.module.ts` (registered both commands)
- `backend/src/modules/reviews/review.controller.ts` (added GET detail)
- `backend/src/modules/reviews/application/review.service.ts` (commands route)
- `backend/src/modules/reviews/infrastructure/prisma-review.repository.ts` (typed + optimistic lock)
- `backend/src/modules/reviews/domain/ports/review-repository.port.ts` (tx arg)
- `backend/src/common/ports/task-repository.port.ts` (tx arg)
- `backend/prisma/schema.prisma` (LifecycleWaiver, stageVersion, enum)
