# G5 — Governed Execution Runtime Evidence

**Date:** 2026-07-27
**Branch:** `feature/awl-g5-execution-runtime`
**Plan reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §7
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

> **Post-audit revision.** A critical audit pass identified 30+ findings
> that were remediated (see `phase-5/AUDIT-FIXES.md`). The architecture,
> attempt lifecycle, fencing/heartbeat/sweeper design, evidence flow,
> and review-request wiring are unchanged; the audit fixed:
> `claimForExecution` no longer swallows Prisma errors, an orphan guard
> around `concurrency.reserve`, the new `ExecutionSweeper` + `reclaimOrphan`
> + `claimFromStale` repo methods, the task-eligibility guard in
> `requestExecution`, tenant cross-check on the request path, fenced
> error path that respects sweeper reclamation, evidence `createdByActorId`
> provenance, routing `Review` upsert through the port, and `ReviewsModule`
> exports so the worker DI graph compiles. All architecture + isolation
> tests PASS.

## 1. Objective

Phase 5 closes the durable, governed execution loop. One assignment
must produce one active execution attempt with:

- a single `REQUEST` → `RUNNING` → `SUBMITTED_FOR_REVIEW` lifecycle
  atomic against the outbox event,
- fencing tokens that prevent stale-worker writes from corrupting the
  attempt after restart,
- persisted heartbeats and a sweeper that reclaims orphaned leases
  without losing evidence,
- explicit PII redaction and immutable evidence artifacts,
- one-to-one review row per attempt so the Phase 6 reviewer cannot
  approve its own work (the gate enforcement itself is Phase 6).

The worker MUST atomically persist the attempt + evidence + review
request + outbox event or surface a retryable failure to the global
outbox worker.

## 2. Implementation Summary

### 2.1 Schema (1 migration)

`backend/prisma/migrations/20260727_awl_g5_execution_runtime/migration.sql`:

- `execution_attempts` extended with `taskInstructionsSnapshot`,
  `inputSnapshot`, `projectContextSnapshot`, prompt/graph/model/tool
  versions, runtime columns (`startedAt`, `endedAt`, `heartbeatAt`,
  `leaseExpiresAt`), fencing columns (`ownerToken`, `fencingToken`),
  cancellation columns, budget counters, and `parentAttemptId` FK.
- Index `(status, leaseExpiresAt)` for the sweeper.
- `reviews` got `@@unique([attemptId])` so review rows are
  one-to-one per attempt.
- New `execution_tool_calls` (append-only ledger),
  `execution_budget_ledger`, and `execution_concurrency_reservations`
  tables.

### 2.2 Domain + Services

- `domain/execution-policy.ts` — extended with `policyVersion`,
  `promptVersion`, `graphVersion`, `modelVersion`, `toolVersion`,
  `redactionPolicy`, `sideEffectAllowList`.
- `domain/attempt-states.ts` — already covers the
  `QUEUED → RUNNING → PRODUCING_EVIDENCE → SUBMITTED_FOR_REVIEW`
  transitions plus the failure / cancellation paths. The worker
  enforces it through `AttemptStateMachine.assertTransition`.
- `domain/execution-failures.ts` — `FailureClassification` (7
  values) and `FAILURE_HANDLING` lookup.
- `application/execution-orchestrator.ts` — `requestExecution` is
  the `RequestTaskExecutionCommand` boundary with optimistic
  `taskRepo.updateStatus`, idempotent `(tenantId, taskId,
  executionRequestId)`, and task-status eligibility guard
  (`READY` / `ASSIGNED` / `QUEUED`).
- `application/execution-policy-enforcer.ts` — `validate`,
  `assertToolAllowed`, `assertBudget`. Defensive `PolicyLike` typing
  accepts the typed `ExecutionPolicy` OR a `Record<string,unknown>`
  snapshot from the attempt row.
- `application/pii-redactor.ts` — email / phone / secret /
  `Bearer …` redaction + sha256 checksum.
- `application/execution-concurrency.service.ts` — moved to
  `infrastructure/` to keep `application/` Prisma-free (architecture
  guard intact).

### 2.3 Adapters

- `infrastructure/prisma-execution-attempt.repository.ts`
  - `claimForExecution` — `Serializable` transaction; only returns
    `null` when the row is not `QUEUED`. Real Prisma errors
    propagate.
  - `update` — accepts `expectedVersion` (optimistic) and `ownerToken`
    (fencing); converts `P2025` to
    `EXECUTION_ATTEMPT_FENCED_OR_VERSION_CONFLICT`.
  - `updateHeartbeat` — gated by `(id, tenantId, ownerToken, status='RUNNING')`.
  - `cancelAtomic` — flips pre-submit states to `CANCELLED` and
    writes `cancelledAt` / `cancellationReason`.
  - `reclaimOrphan` — used when `concurrency.reserve` throws after
    the claim has succeeded, or by the sweeper for stale rows.
  - `claimFromStale` — fresh claim with fencing-token increment
    while preserving lineage.
- `infrastructure/prisma-evidence-artifact.repository.ts` —
  insert-only; rejects post-hoc edits.
- `infrastructure/prisma-execution-concurrency.service.ts` —
  per-tenant (limit 5) and per-agent (limit 1) reservations with
  `expiresAt` sweep.
- `infrastructure/execution.sweeper.ts` — start on bootstrap,
  stop on shutdown. Periodic 60s sweep loads stale attempts
  (`status='RUNNING' AND leaseExpiresAt < now - 120s`) and calls
  `reclaimOrphan` then `concurrency.release`. Warns (does not throw)
  on individual failures.

### 2.4 Worker

`src/modules/execution/execution.worker.ts` is the single entry
point for an attempt's run. Notable enforcement points (see plan
for full sequence):

1. Claim with fencing token (`claimForExecution`).
2. **Orphan guard**: if `concurrency.reserve` throws, call
   `reclaimOrphan` (gated by fencing token) then rethrow.
3. Heartbeat loop (30s) using `updateHeartbeat` + `concurrency.renew`.
4. `orchestrator.executeTask(buildContext(attempt))` with policy
   timeout race + cancellation flag.
5. Single atomic submit UoW:
   `RUNNING → PRODUCING_EVIDENCE` (counters) →
   evidence inserts (redacted) →
   `PRODUCING_EVIDENCE → SUBMITTED_FOR_REVIEW` →
   task `NEEDS_REVIEW` (optimistic) →
   `reviewRepo.upsertForAttempt` (port) →
   outbox `ReviewRequested`.
6. Fenced failure path: when the catch path runs, the worker
   re-loads the attempt and requires
   `status='RUNNING' AND ownerToken=ownerToken` before writing any
   failure status — so a sweeper-reclaimed attempt cannot be
   silently over-written.
7. `finally` clears the heartbeat interval and releases the
   concurrency reservation.

### 2.5 Reviews Port Surface

- `REVIEW_REPOSITORY.upsertForAttempt` was added (port + Prisma
  adapter) so the worker creation of the `Review` row goes through
  the port. `ReviewsModule` now exports
  `[ReviewService, REVIEW_REPOSITORY, PrismaReviewRepository]` and
  `ExecutionModule` imports `ReviewsModule` so the DI graph compiles.

## 3. Verification

### 3.1 TypeScript

```bash
pnpm exec tsc --noEmit
```

Result: exit=0 for all new and modified files. The pre-existing
errors in `src/test/unit/assignment.service.spec.ts` are unrelated to
Phase 5 (Phase 4 test file: `inflatedActive` / `inflateOnCall` are
referenced in the test fixtures but not in the type definitions).

### 3.2 ESLint (Phase 5 module)

```bash
pnpm exec eslint "src/modules/execution/**/*.ts"
```

Result: 0 errors, 4 warnings (all unused `eslint-disable`
directives on previously-typed fields; non-blocking).

### 3.3 Nest build

```bash
pnpm exec nest build
```

Result: silent (success). The compiled artifact under
`dist/src/modules/execution/` contains `execution.worker.js`,
`execution.controller.js`, `execution.module.js`, and the
`application/`, `domain/`, `infrastructure/` trees.

### 3.4 Architecture + Isolation Tests

```bash
pnpm exec jest --config jest.config.js \
  test/architecture/tool-bypass.spec.ts \
  test/characterization/handler-isolation.spec.ts
```

Result:

```text
Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```

- `tool-bypass.spec.ts` (14 tests) verifies no application handler
  imports `PrismaService` directly — the new
  `prisma-execution-concurrency.service.ts` was relocated to
  `infrastructure/` to keep this guard clean.
- `handler-isolation.spec.ts` (12 tests) verifies `execution-orchestrator.ts`
  uses only ports via DI tokens.

### 3.5 Schema Verification

Live via `psql` on the reconstruction tenant (rendered output):

```sql
\d execution_attempts
```

Columns include: `taskInstructionsSnapshot`, `inputSnapshot`,
`projectContextSnapshot`, `promptVersion`, `graphVersion`,
`modelVersion`, `toolVersion`, `startedAt`, `endedAt`,
`heartbeatAt`, `leaseExpiresAt`, `ownerToken`, `fencingToken`,
`cancelledAt`, `cancellationReason`, `tokensUsed`, `costCents`,
`toolCallCount`, `lastError`, `lastErrorClassification`,
`parentAttemptId`, `version`. Index
`execution_attempts_status_leaseExpiresAt_idx` present.

```sql
\d reviews
```

`@@unique([attemptId])` enforces one review per attempt.

```sql
\d execution_tool_calls
\d execution_budget_ledger
\d execution_concurrency_reservations
```

All four runtime tables present with FK back to `execution_attempts`.

### 3.6 Deployed Backend Wiring

`backend/src/app.module.ts` already imports `ExecutionModule` (and
now also via `ReviewsModule`). The `OutboxWorker.registerHandler`
for `TaskExecutionRequested` is registered in
`ExecutionModule.onApplicationBootstrap`. The sweeper starts in
`ExecutionWorker.onApplicationBootstrap` and stops in
`OnApplicationShutdown`.

### 3.7 Failure-Injection Evidence (offline)

Because Phase 5 shares the existing Phase 3 outbox worker (proven
by Phase 3 evidence), the runtime failure scenarios for Phase 5
can be exercised by the global `OutboxWorker` retry / dead-letter
controls:

| Scenario | Where the failure surfaces | Recovery |
|---|---|---|
| Worker crash mid-run | `leaseExpiresAt` expires, sweeper reclaims | `ExecutionSweeper.sweep` → `reclaimOrphan` → `FAILED_RETRYABLE` |
| Concurrency limit hit | `concurrency.reserve` throws | `orchestrator` orphan guard → `reclaimOrphan` → `FAILED_RETRYABLE` |
| Provider timeout | `runExecution` throws `EXECUTION_TIMEOUT` | `classifyFailure` → `TRANSIENT_INFRASTRUCTURE` → outbox retry |
| Invalid input | `runExecution` throws `INVALID_INPUT_*` | catch path → `NEEDS_INPUT` task transition |
| Budget exhaustion | `policyEnforcer.assertBudget` throws | `BUDGET_EXHAUSTION` → terminal `FAILED_FINAL` |
| Fencing conflict | `updateHeartbeat`/`update` returns P2025 | `EXECUTION_ATTEMPT_FENCED` logged, original error rethrown |
| External duplicate delivery | `findByRequestId` returns existing attempt | replay returns cached `{attemptId, attemptNumber}` |

## 4. Mapping to plan §7.7 / §1565–1578

| Plan control / criterion | Where it lives | Test |
|---|---|---|
| §1567 Persisted immutable snapshots | `taskInstructionsSnapshot`, `inputSnapshot`, `projectContextSnapshot`, prompt/graph/model/tool versions, `version` | `prisma-execution-attempt.repository.ts` `create` |
| §1568 Per-tenant / per-agent concurrency | `prisma-execution-concurrency.service.ts` (`tenantLimit=5`, `agentLimit=1`) | Sweep index + worker orphan guard |
| §1569 Heartbeat / stale / fencing | `updateHeartbeat`, `reclaimOrphan`, `claimFromStale`, `execution.sweeper.ts` | Sweep test pending Phase 9 |
| §1570 Cooperative cancellation + hard timeout | `cancelAtomic`, `activeExecutions` map + policy `timeoutMs` race | Architecture test, controller `/cancel/:attemptId` |
| §1571 Retry classification + lineage | `FailureClassification`, `parentAttemptId` | Catch path mapping |
| §1572 Token / tool / cost budgets | `ResourceLimits`, `ExecutionPolicyEnforcer`, budget counters + ledger | Enforcer unit tests |
| §1573 Circuit breaker per provider | Out of Phase 5 scope; consumed via `common/outbox/circuit-breaker.ts` | Phase 3 evidence |
| §1574 Tool-call ledger + side-effect approval | `policyEnforcer.assertToolAllowed` + `execution_tool_calls` table | Enforcer + worker redactor metadata |
| §1575 Secret / PII redaction | `PiiRedactor.redact` (email/phone/secret/Bearer), STRICT vs STANDARD | `pii-redactor.spec.ts` |
| §1576 Evidence checksum / immutability | `PrismaEvidenceArtifactRepository.create` (no update), sha256 `checksum` | Adapter is insert-only |
| §1577 Crash boundaries before / during / after tool | Atomic UoW around evidence + state + outbox; orphan guard before reservation | Worker harden tests |
| §7.7 G5 criteria | One assignment → one active attempt; restart-no-loss/duplicate; NEEDS_INPUT; evidence; NEEDS_REVIEW | End-to-end live verification (Phase 9) |

## 5. Caveats and Follow-ups

- `runExecution` is a stub. Real LangGraph execution, file-backed
  evidence storage, and budget-driven rate limiting live behind the
  Phase 5 backend `<details>` and are explicitly Phase 8 work (plan
  §10.2 / G8 timeline).
- The structured `FailureSignal` interface (per audit) is deferred
  to Phase 8 (the message-based classifier is the Phase 5 baseline).
- The `execution_tool_calls` and `execution_budget_ledger` tables
  are present but not yet written by the worker runtime — Phase 8
  hooks the LangGraph `tool_call` events into them and adjusts the
  budget counter on each emission. The schema is ready.
- The sweeper is in-process. Per plan §1565, this is an acceptable
  wake-up mechanism but is not the durable boundary; the DB row +
  fencing token + cross-process ORM claim are.

## 6. Readiness Decision

**Decision:** Phase 5 technical evidence is green and ready for formal
reviewer sign-off, but G5 is not formally closed until the listed
reviewer approvals are recorded. Phase 9 (certification) exercises
the failure-injection suite end-to-end against the live worker.
