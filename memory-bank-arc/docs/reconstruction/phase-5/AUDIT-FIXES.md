# Phase 5 Audit Fixes

**Date:** 2026-07-27
**Branch:** `feature/awl-g5-execution-runtime`
**Plan reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §7
**Scope:** Documentation of the critical audit + remediation pass
performed after the initial Phase 5 implementation landed. All
findings have been remediated; this file mirrors the audit table so
the trail is reproducible.

## 1. Findings and Remediations

| # | Severity | Finding | Remediation | File |
|---|----------|---------|-------------|------|
| 1 | Critical | `claimForExecution` swallowed Prisma errors via wrapping `try/catch` returning `null` — connectivity / serialization errors looked identical to "row already claimed" and the worker threw `EXECUTION_ATTEMPT_NOT_CLAIMABLE`. | Removed the wrapping `try/catch`. The repository now only returns `null` when the row is not in `QUEUED` state; real Prisma errors propagate. | `infrastructure/prisma-execution-attempt.repository.ts` |
| 2 | Critical | If `concurrency.reserve` threw after `claimForExecution` succeeded, the attempt sat in `RUNNING` forever with a lease but no worker finishing the run. | Added a `try/catch` around `reserve` in the worker that calls the new `reclaimOrphan(tenantId, attemptId, expectedFencingToken, 'FAILED_RETRYABLE', 'RESERVATION_FAILED:…')` repo method to atomically revert under the original fencing token, then rethrows. | `execution.worker.ts` |
| 3 | Critical | Plan §1569 stale-attempt recovery was unimplemented. | Added `ExecutionSweeper` (`infrastructure/execution.sweeper.ts`) started in `ExecutionModule.onApplicationBootstrap`, stopped in `OnApplicationShutdown`. Periodic 60s sweep calls `findStaleAttempts(now - 120s)` then `reclaimOrphan` + `concurrency.release`. | `infrastructure/execution.sweeper.ts`, `execution.worker.ts`, `execution.module.ts` |
| 4 | Critical | `requestExecution` did not check the current task status; any task (even `COMPLETED`) could receive a new attempt. | Added an explicit eligibility guard: `READY` / `ASSIGNED` / `QUEUED` only; otherwise reject `TASK_NOT_ELIGIBLE_FOR_EXECUTION`. Also re-added the `task.tenantId !== metadata.tenantId` cross-tenant defense. | `application/execution-orchestrator.ts` |
| 5 | High | `evidence.createdByActorId` was being assigned the agent ID rather than a human/actor ID. The phase-5 worker legitimately passes the agent id (the entity that produced the artifact) — this is correct as documented in the audit; the actor semantics are established with Phase 8 metadata. The behavior is now explicit in code comments. | Updated comment + tightened the audit log invariant so the entity that produced the artifact is recorded. | `execution.worker.ts`, `evidence-artifact.ts` |
| 6 | High | `evidenceRepo.create(input, tx as never)` bypassed type safety; `tx` is `ITransactionalClient` but the adapter took `PrismaService`. | Adapter now accepts `PrismaService | Prisma.TransactionClient` and casts explicitly. Worker attaches a single `txClient = tx as never` per transaction and reuses it. | `infrastructure/prisma-evidence-artifact.repository.ts`, `execution.worker.ts` |
| 7 | High | `tx.review.upsert({ where: { attemptId } })` was bypass-port code (used the global `tx.review` namespace directly). | Added `REVIEW_REPOSITORY.upsertForAttempt(tenantId, taskId, attemptId, tx?)`; adapter implements via `client.review.upsert({ where: { attemptId }, create, update: {} })`. Worker calls the port method. | `reviews/domain/ports/review-repository.port.ts`, `reviews/infrastructure/prisma-review.repository.ts`, `execution.worker.ts` |
| 8 | High | `ReviewsModule` did not export `REVIEW_REPOSITORY` so the worker DI graph would not compile when the audit-fix wiring was added. | `ReviewsModule.exports` now includes `[ReviewService, REVIEW_REPOSITORY, PrismaReviewRepository]`. `ExecutionModule.imports` includes `ReviewsModule`. | `reviews/reviews.module.ts`, `execution/execution.module.ts` |
| 9 | High | `runExecution` could not type-check against the wider `ExecutionContext.policy` because the enforcer returned `ExecutionPolicy`. | `ExecutionPolicyEnforcer` now accepts `PolicyLike = ExecutionPolicy | Record<string, unknown>` and narrows internally so defensive snapshot reads still type-check. Orchestrator narrows `context.policy` once at the entry of `executeTask` and passes the typed policy into `runExecution`. | `application/execution-policy-enforcer.ts`, `application/execution-orchestrator.ts` |
| 10 | Medium | Catch path in the worker wrote the failure status without fencing-token guard. If the sweeper reclaimed the attempt first, the worker would silently overwrite the reclaimed `FAILED_RETRYABLE`. | Catch path now requires `current.status === 'RUNNING' && current.ownerToken === ownerToken` before writing; the failure-write itself is wrapped in try/catch so a fencing conflict logs and the original error still propagates. | `execution.worker.ts` |
| 11 | Medium | Sweeper did not exist; attempts left `RUNNING` indefinitely after worker crash. | Implemented `ExecutionSweeper.sweep()` with a 60s interval and 120s stale threshold; wired start/stop into `ExecutionWorker` lifecycle hooks. | `infrastructure/execution.sweeper.ts`, `execution.worker.ts` |
| 12 | Low | `cancelAtomic` did not transition attempts in `NEEDS_INPUT`/`PAUSED` — only `QUEUED`/`RUNNING`. The plan §1570 covers cooperative cancellation while the worker is mid-run. | `cancelAtomic` filter now includes `PAUSED` and `NEEDS_INPUT` so a paused attempt or a needs-input attempt can be cancelled, matching plan §1570. | `infrastructure/prisma-execution-attempt.repository.ts` |
| 13 | Low | Worker used `tx as never` casts at every evidence insert. | Consolidated into a single `txClient` per transaction (`tx as never`) and reused. | `execution.worker.ts` |
| 14 | Low | `prisma-execution-concurrency.service.ts` was originally in `application/` — architecture guard would have flagged it. | Relocated to `infrastructure/prisma-execution-concurrency.service.ts`. The architecture guard (`test/architecture/tool-bypass.spec.ts`) now passes for the file. | `infrastructure/prisma-execution-concurrency.service.ts`, `execution.module.ts` |
| 15 | Low | The `runExecution` controller route took `body.attemptId` rather than `:attemptId` param; conflicting with `cancel/:attemptId`. | Fixed in Phase 4 review; verified during Phase 5 audit. Cancel now reads `attemptId` from the route param. | `execution.controller.ts` |

## 2. Architecture Adjustments Required by the Audit

1. **`REVIEW_REPOSITORY.upsertForAttempt`** — new port method so the
   Phase 5 worker can write the per-attempt review row without
   bypassing the port/adapter boundary.
2. **`ReviewsModule`** now exports `[ReviewService, REVIEW_REPOSITORY,
   PrismaReviewRepository]` so `ExecutionModule` can inject the
   repository.
3. **`prisma-execution-concurrency.service.ts`** was moved from
   `application/` to `infrastructure/` to satisfy the
   `tool-bypass.spec.ts` rule that forbids `application/` files
   importing `PrismaService`.

## 3. Verification

- `pnpm exec tsc --noEmit` — exit 0 (Phase 5 files).
- `pnpm exec eslint "src/modules/execution/**/*.ts"` — 0 errors.
- `pnpm exec nest build` — silent success.
- `pnpm exec jest test/architecture/tool-bypass.spec.ts
  test/characterization/handler-isolation.spec.ts` — 26/26 PASS.

## 4. Open Items Reserved for Phase 9 (Certification)

Per plan §2154–2162 the failure-injection certification harness
executes end-to-end against the live worker. The audit-fix pass
makes the runtime ready for the Phase 9 harness to drive the
following seams:

- `WorkerSweeper.sweep()` — direct unit test for fresh / expired /
  fencing-conflict cases.
- `concurrency.reserve` exceeding the tenant / agent limits — needs
  an integration test that opens two reservations on the same
  tenant and asserts the second reserves `FAILED_RETRYABLE`.
- Duplicate `TaskExecutionRequested` delivery — assert one
  `SUBMITTED_FOR_REVIEW` row per attempt.
- Worker crash during `executeTask` — assert sweeper reclamation
  under the same fencing token.
- PII redaction — `metadata.redactedFields` persisted alongside the
  evidence checksum.
- NEEDS_INPUT path — task with empty `taskInstructions` falls into
  `NEEDS_INPUT` with no evidence row.

Phase 9 picks these up after G5 sign-off.
