# Phase 5 Plan — Governed Execution Runtime

**Source:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §7
**Phase duration:** 3–4 weeks
**Phase objective:** Execute one assigned task durably inside the
explicit policy, resource limits, fencing, heartbeat, PII-redaction,
budget, evidence, and review-request boundary established by Phase 5.
Worker restart must never lose or duplicate attempts; AI must use only
authorized context and tools; missing inputs surface as `NEEDS_INPUT`,
never fabrication.

## 1. Authorization Gate

Per plan §1.4, each later phase requires its preceding gate evidence
and a phase-start approval. Phase 5 implementation starts after:

- G4 evidence captured (`phase-4/G4-ASSIGNMENT-EVIDENCE.md`)
- G4 sign-off recorded (governance only — technical work proceeds)

## 2. Phase 5 Workstreams

### 2.1 Schema migration

**`20260727_awl_g5_execution_runtime`** — extends `execution_attempts`
and adds the runtime ledger tables required by plan §1565–1578:

- `execution_attempts.taskInstructionsSnapshot` (TEXT) — frozen task
  instructions at attempt creation (plan §1567 "Persisted immutable
  task, policy, input, prompt/graph, model, and tool-version snapshots").
- `execution_attempts.inputSnapshot` (JSONB) and
  `projectContextSnapshot` (JSONB) — frozen inputs and project context.
- `execution_attempts.promptVersion`,
  `graphVersion`, `modelVersion`, `toolVersion` (TEXT) — runtime
  version snapshots.
- `execution_attempts.startedAt`, `endedAt`, `heartbeatAt`,
  `leaseExpiresAt` — execution lifetime (plan §1569).
- `execution_attempts.ownerToken` (TEXT) +
  `fencingToken` (INT, default 0) — claim ownership / fencing tokens
  for stale-recovery safety (plan §1569).
- `execution_attempts.cancelledAt`, `cancellationReason` — persisted
  cooperative cancellation surface (plan §1570).
- `execution_attempts.tokensUsed` (INT default 0),
  `costCents` (INT default 0), `toolCallCount` (INT default 0) —
  budget counters (plan §1572).
- `execution_attempts.parentAttemptId` — attempt lineage
  (`@@unique([taskId, attemptNumber])` already enforces ordering).
- Index `(status, leaseExpiresAt)` for sweeper queries.
- **New table `execution_tool_calls`** — append-only tool-call ledger
  required by plan §1574. Columns: toolName, argumentsChecksum,
  resultChecksum, sideEffect, approvedByActorId, status,
  errorClassification, occurredAt. Idempotent through
  `(attemptId, id)` and indexed by `(tenantId, attemptId)`.
- **New table `execution_budget_ledger`** — append-only budget audit
  ledger required by plan §1572. Columns: kind, amount, unit,
  recordedAt; indexed by `(tenantId, attemptId)`.
- **New table `execution_concurrency_reservations`** — per-tenant /
  per-agent concurrency reservations with expiry (plan §1568).
  Unique on `attemptId`, indexed on
  `(tenantId, agentId, expiresAt)` for sweep queries.
- `reviews` — `@@unique([attemptId])` so a review request is
  one-to-one per attempt.

### 2.2 Domain layer — `src/modules/execution/`

- `domain/execution-policy.ts` — `ExecutionPolicy` + `AutonomyLevel`
  (L0–L4) + `ResourceLimits`. Extended with `policyVersion`,
  `promptVersion`, `graphVersion`, `modelVersion`, `toolVersion`,
  `redactionPolicy`, `sideEffectAllowList` (plan §7.3 + §7.2).
- `domain/attempt-states.ts` — `ExecutionAttemptStatus` union +
  `ATTEMPT_TRANSITIONS` + `AttemptStateMachine.canTransition` /
  `assertTransition`. Required transitions for Phase 5:
  `QUEUED → RUNNING`, `RUNNING → PRODUCING_EVIDENCE`,
  `PRODUCING_EVIDENCE → SUBMITTED_FOR_REVIEW`, plus `RUNNING → NEEDS_INPUT`
  / `FAILED_*` failure paths.
- `domain/execution-failures.ts` — `FailureClassification` enum +
  `FAILURE_HANDLING` table (TRANSIENT_INFRASTRUCTURE, INVALID_INPUT,
  POLICY_DENIAL, TOOL_FUNCTIONAL_FAILURE, MODEL_QUALITY_FAILURE,
  CANCELLATION, BUDGET_EXHAUSTION) and the retry/visibility flags.
- `domain/evidence-artifact.ts` — `EvidenceArtifact` type, persisted
  immutable (insert-only) into the `evidence_artifacts` table with
  sha256 checksum + redaction metadata.
- `domain/ports/execution-attempt-repository.port.ts` — port interface
  with `findById`, `findByRequestId`, `findLastAttemptNumber`, `create`,
  `update` (all accept an optional `tx`), plus the new Phase 5 ops:
  `claimForExecution(tenantId, attemptId, leaseMs)` (returns
  `ExecutionClaim{attempt,ownerToken}` or null),
  `updateHeartbeat(tenantId, attemptId, ownerToken, leaseMs)`,
  `findStaleAttempts(now)`, `cancelAtomic(tenantId, attemptId, reason)`,
  `reclaimOrphan(tenantId, attemptId, fencingToken, targetStatus, lastError)`
  and `claimFromStale(tenantId, attemptId, expectedFencingToken, leaseMs)`.
- `domain/ports/…` for concurrency / evidence / tools would normally
  live here; the Phase 5 implementation colocates the concrete adapters
  in `infrastructure/` because they are CRUDA (create / read / update /
  delete / archive) and do not carry domain logic.

### 2.3 Adapters — `src/modules/execution/infrastructure/`

- `prisma-execution-attempt.repository.ts` — Prisma adapter.
  Notable behaviors:
  - `create` sets prompt/graph/model/tool versions from
    `input.policy` into dedicated columns.
  - `update` accepts `expectedVersion` (optimistic) and `ownerToken`
    (fencing) and converts Prisma `P2025` to the canonical
    `EXECUTION_ATTEMPT_FENCED_OR_VERSION_CONFLICT` error.
  - `claimForExecution` runs in its own `Serializable` transaction,
    toggles status `QUEUED → RUNNING`, issues a fresh `ownerToken`,
    increments `fencingToken`, records `startedAt`, `heartbeatAt`,
    `leaseExpiresAt`. Returns `null` ONLY when the row is not in
    the `QUEUED` state — real Prisma errors **propagate**.
  - `updateHeartbeat` is gated by `(id, tenantId, ownerToken,
    status='RUNNING')`; mismatch raises
    `EXECUTION_ATTEMPT_FENCED`.
  - `cancelAtomic` flips any pre-submit state to `CANCELLED` and
    records the reason + actor via the controller metadata.
  - `reclaimOrphan` and `claimFromStale` round out the recovery
    story (plan §1569) and are wired into the sweeper.
- `prisma-evidence-artifact.repository.ts` — append-only evidence
  writer. `create(input, tx?)` rejects updates by design (no
  `update`/`delete` methods).
- `prisma-execution-concurrency.service.ts` — per-tenant / per-agent
  claim with expiry sweep:
  - `reserve(tenantId, agentId, attemptId, leaseMs, tenantLimit=5, agentLimit=1)`
    purges expired reservations, computes current usage, throws
    `TENANT_CONCURRENCY_LIMIT` or `AGENT_CONCURRENCY_LIMIT` if
    saturated, and `upsert`s the reservation row.
  - `renew(attemptId, leaseMs)` and `release(attemptId)`.
- `execution.sweeper.ts` — implements plan §1569 stale recovery. On
  `OnApplicationBootstrap`, schedules a periodic `setInterval` every
  60s that:
  1. Loads attempts where `status='RUNNING' AND leaseExpiresAt < now -
     120s` (configurable thresholds).
  2. For each stale attempt, calls `reclaimOrphan` (gated by the
     attempt's fencing token) and then `concurrency.release`.
  3. Stops on `OnApplicationShutdown`.

The sweeper is the **in-process** stale-recovery seam. As discussed
in plan §1565, in-process timers are a wake-up hint; the durable
boundary remains the DB row + fencing token.

### 2.4 Application services — `src/modules/execution/application/`

- `execution-orchestrator.ts` — owns the `RequestTaskExecutionCommand`
  boundary. `requestExecution(taskId, agentId, executionRequestId,
  metadata)` is one atomic UoW that:
  1. Re-fetches the task by `(tenantId, id)`; rejects cross-tenant,
     not-assigned-to-agent, or task not in an executable status
     (`READY` / `ASSIGNED` / `QUEUED`).
  2. Returns the existing attempt when `executionRequestId` is a
     replay (idempotency through the
     `(tenantId, taskId, executionRequestId)` unique index).
  3. Otherwise creates the attempt at `lastAttemptNumber+1` with the
     policy snapshot, frozen `taskInstructionsSnapshot`, and
     `inputSnapshot` containing role / capabilities /
     data-classification.
  4. Updates the task via `taskRepo.updateStatus` (optimistic
     `expectedVersion`) and publishes `TaskExecutionRequested` in
     the same transaction.
  `executeTask(context)` wraps the runtime with the in-process
  cancellation flag, the per-policy `timeoutMs` race, and an
  `AttemptStateMachine.assertTransition` reset of cancellation
  state. `classifyFailure` is message-based for Phase 5 (a
  structured `FailureSignal` is the Phase 8 upgrade); `shouldRetry`
  honors `FAILURE_HANDLING.withinLimit` semantics.
- `execution-policy-enforcer.ts` — typed enforcer for plan §1572
  / §1574: `validate(policy)` rejects out-of-range autonomy or
  zero budgets; `assertToolAllowed(policy, call, count)` enforces
  allow / deny / side-effect approval; `assertBudget(policy,
  tokensUsed, costCents)` enforces the post-run budget.
- `pii-redactor.ts` — implements plan §1575:
  - `redact(value, strict=true)` strips emails, phones,
    `api_key/password/token/secret=<value>`, and `Bearer …` tokens.
  - Returns `{value, redacted, fields[]}` so the worker can persist
    `metadata.redactedFields`.
  - `checksum(value)` returns the SHA-256 hex digest used both as
    the evidence `storageRef` and as the artifact `checksum`.
  - When `attempt.policy.redactionPolicy === 'STRICT'` (the
    default), tokens are also redacted. The `'STANDARD'` mode
    skips the Bearer sweep to allow legitimate session tokens.

### 2.5 Worker — `src/modules/execution/execution.worker.ts`

`ExecutionWorker.handleTaskExecutionRequested` is the single entry
point for an attempt's run. It runs through this hardened sequence:

1. **Claim with fencing** — `attemptRepo.claimForExecution`. If the
   row is `SUBMITTED_FOR_REVIEW` / `CANCELLED` / `FAILED_FINAL`, the
   event is treated as a successful replay and the worker returns
   without throwing.
2. **Orphan guard before reservation** — `concurrency.reserve` runs
   inside its own try/catch. If reservation throws (concurrency
   limit, transient DB error), the worker calls
   `attemptRepo.reclaimOrphan` to revert the attempt to
   `FAILED_RETRYABLE` with the original `fencingToken` so the sweeper
   / next claim cannot double-claim it, then rethrows.
3. **Heartbeat loop** — every 30s, both `attemptRepo.updateHeartbeat`
   (gated by `ownerToken`) and `concurrency.renew` fire. The loop
   is cleared in `finally` so a thrown runtime error still releases
   the reservation.
4. **Runtime execution** — `orchestrator.executeTask(buildContext(attempt))`
   runs the policy-validated, timeout-bounded stub. Throwing
   `INVALID_INPUT_MISSING_TASK_INSTRUCTIONS` /
   `INVALID_INPUT_MISSING_APPROVED_INPUTS` produces `NEEDS_INPUT`
   per plan §1567.
5. **Single atomic submit** — one `uow.execute` performs:
   - `RUNNING → PRODUCING_EVIDENCE` (with token / cost / tool-call
     counters).
   - Redacted `evidence_artifacts` insert (insert-only).
   - `PRODUCING_EVIDENCE → SUBMITTED_FOR_REVIEW` with
     `outputSummary`, `submittedAt`, `endedAt`.
   - Task `NEEDS_REVIEW` via optimistic `expectedVersion`.
   - `reviewRepo.upsertForAttempt` (port) so the human-review path
     of Phase 6 sees a row keyed by the unique `attemptId`.
   - `outbox.publish('ReviewRequested', {attemptId, taskId, checksum})`
     with `actorType='AI_AGENT'`.
6. **Fenced failure path** — on any thrown error from steps 4–5,
   the worker:
   - Re-loads the attempt.
   - Confirms `current.status === 'RUNNING' && current.ownerToken ===
     ownerToken` (so a sweeper-reclaimed attempt is not overwritten).
   - Writes `FAILED_RETRYABLE` / `FAILED_FINAL` / `NEEDS_INPUT` per
     `failure` classification.
   - On concurrency or fencing conflict, the failure write is itself
     wrapped in try/catch — the original error is still rethrown so
     the outbox worker can retry.
7. **Release reservation** — `concurrency.release(attempt.id)` in
   the `finally` block.

### 2.6 Module — `src/modules/execution/execution.module.ts`

- Wires the orchestrator + worker + sweeper + repositories + redactor +
  enforcer into the DI container.
- `imports` now include `ReviewsModule` so `REVIEW_REPOSITORY` is
  resolvable from the worker (added in Phase 5 audit pass).
- `OnApplicationBootstrap` registers the `TaskExecutionRequested`
  outbox handler onto the global `OutboxWorker`; `OnApplicationShutdown`
  on the worker stops the sweeper.

### 2.7 Controller — `src/modules/execution/execution.controller.ts`

- `POST /execution/request` — initiates the `RequestTaskExecutionCommand`
  on behalf of the authenticated human user; tags `executionRequestId`
  with `request-execution:${taskId}:${executionRequestId}` so the
  outbox has a deterministic idempotency key.
- `POST /execution/cancel/:attemptId` — invokes `orchestrator.cancel`
  with the JWT-derived actor identity. The repo's `cancelAtomic`
  rejects any post-submit cancellation (returns
  `EXECUTION_ATTEMPT_NOT_CANCELLABLE`).

## 3. Mapping to plan §7.6 / §7.7

| Plan Deliverable | Where it lives |
|---|---|
| Execution attempt creation | `ExecutionOrchestrator.requestExecution` (atomic UoW, optimistic version, unique `executionRequestId`) |
| Concurrency controls (tenant/agent) | `prisma-execution-concurrency.service.ts` with per-tenant limit (5) / per-agent limit (1) |
| Timeout and heartbeat | In-process `timeoutMs` race + DB-backed 30s heartbeat + 120s lease + `execution.sweeper.ts` 60s sweep |
| Cancellation support | Persistent `cancelAtomic` + in-process `activeExecutions` flag raised by `orchestrator.cancel` |
| Tool call limits | `ExecutionPolicyEnforcer.assertToolAllowed` (allow / deny / side-effect approval) |
| Token/cost budget | `ExecutionPolicyEnforcer.assertBudget` + persisted `tokensUsed` / `costCents` / `execution_budget_ledger` table |
| Circuit breaker | Out of Phase 5 scope per plan §1573 (handled by `common/outbox/circuit-breaker.ts`) |
| Evidence persistence | `PrismaEvidenceArtifactRepository.create` (insert-only) + `PiiRedactor.redact` + sha256 `checksum` |
| G5 one-assignment → one active attempt | `tenantId-taskId-executionRequestId` unique + claim-and-fence flow |
| G5 worker restart no loss/duplicate | Fencing token + claim + sweeper reconciliation |
| G5 AI uses only authorized context | ExecutionContext built from frozen snapshots + policy enforcer |
| G5 missing inputs → NEEDS_INPUT | `runExecution` throws `INVALID_INPUT_*`; worker maps to `NEEDS_INPUT` per plan §1567 |
| G5 draft + evidence persisted | Single atomic UoW persists attempt + evidence artifacts |
| G5 task reaches NEEDS_REVIEW | Worker flips task + creates `reviews` row + emits `ReviewRequested` |
| G5 no self-approval | Deferred to Phase 6 (`review.service.ts: AI_CANNOT_APPROVE_OWN_WORK`) |
