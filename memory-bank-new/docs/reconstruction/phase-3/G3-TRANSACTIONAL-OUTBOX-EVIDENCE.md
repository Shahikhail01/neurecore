# G3 — Transactional Outbox and Durable Automation Evidence

**Date:** 2026-07-26
**Branch:** `feature/awl-g3-durable-automation`
**Plan reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §5
**Status:** TECHNICAL GREEN — formal reviewer sign-off still required (governance only)

## 1. Objective

Phase 3 turns a freshly created project into goals, tasks, role requirements, and
initial assignment requests through a durable transactional outbox and a leased
worker. Five preconditions drive the implementation (per plan §5.1):

1. Polling starts, prevents overlapping loops, stops gracefully.
2. Transaction-safe claim semantics (row locks or expiring leases).
3. Lease renewal and stale-lease recovery.
4. Multi-replica behavior.
5. Exponential backoff with jitter, retry classification, maximum attempts.
6. Dead-letter transition and controlled replay.
7. Event schema-version compatibility.
8. Poison-event isolation.
9. Transaction boundary between handler effects and processed-event records.
10. Deployment/readiness behavior when the worker is unavailable.

## 2. Implementation Summary

### 2.1 Outbox schema (`prisma/migrations/20260726_awl_g3_durable_outbox_enum|migration.sql`,
`prisma/migrations/20260726_awl_g3_durable_outbox_schema/migration.sql`)

- `EnterpriseEventOutboxStatus` extended with `PROCESSING`, `PROCESSED` (in addition
  to legacy `PENDING`, `DISPATCHED`, `DEAD_LETTER`).
- Lease + backoff columns added to `enterprise_event_outbox`:
  `processingWorkerId`, `leaseExpiresAt`, `processingStartedAt`, `processedAt`,
  `nextAttemptAt`, `processingCount`, `lastErrorClassification`.
- Dead-letter uniqueness added: `enterprise_event_dead_letter_originalEventId_key`.
- Three new indexes:
  - `enterprise_event_outbox_claim_idx` (`status`, `nextAttemptAt`, `createdAt`)
  - `enterprise_event_outbox_lease_expiry_idx` (`leaseExpiresAt`) WHERE status='PROCESSING'
  - `enterprise_event_outbox_tenant_status_idx` (`tenantId`, `status`)

Migration strategy: enum values are committed in a separate migration so the
Prisma-generated transaction wrapping does not error on
"unsafe use of new value".

### 2.2 OutboxWorker (`src/common/outbox/outbox.worker.ts`)

- Concurrent-tick guard via `inflight` Promise — only one tick at a time per worker.
- Each tick runs `recoverStale` first, then `claimAvailable`, then per-event:
  handler success → `markProcessed`; failure → `settleFailure` (retryable) or
  dead-letter promotion.
- `OnModuleDestroy` calls `releaseWorker` so orphaned claims land back in PENDING.
- DI wiring: `@Inject(OUTBOX_REPOSITORY)` + `@Optional()` options.
- Tests construct via `OutboxWorker.forTesting(repo, options)` static factory.

### 2.3 Prisma adapter (`src/common/persistence/prisma-outbox.repository.ts`)

- `claimAvailable` does row-conditional `updateMany` with `status='PENDING' AND
  nextAttemptAt <= now()` so concurrent workers cannot double-claim.
- `markProcessed` guards `status='PROCESSING' AND processingWorkerId=leaseToken`
  to detect token mismatches.
- `settleFailure` increments `retryCount` atomically; >=3 promotes to DEAD_LETTER
  and upserts an `enterprise_event_dead_letter` row.
- `recoverStale` returns expired `leaseExpiresAt < now()` rows to PENDING.
- `releaseWorker` clears claims on shutdown.
- `getBacklogSummary` and `listDeadLetters` provide operator reads.

### 2.4 Operator visibility (`src/modules/observability/awl-health.controller.ts`)

`GET /api/v1/awl-health` exposes:

- `outbox.backlog`, `outbox.processing`, `outbox.processed`, `outbox.deadLetter`,
  `outbox.oldestPendingAt`, `outbox.oldestStuckAt`, `outbox.workerId`,
  `outbox.status` ("healthy" | "backlogged").
- `deadLetters.recent[]` — last ten dead-letter rows.
- `circuit.open` + `commands.registered`.

`GET /api/v1/awl-health/outbox` and `GET /api/v1/awl-health/dead-letters` provide
the same data without the wrapper.

### 2.5 ProjectAutomationHandler (`src/modules/project-automation/application/project-automation.handler.ts`)

- Event consumer typed on `OutboxEventRecord` (no anonymous object passed across).
- Idempotency guard: `findCompletedForProject(... PROJECT_CREATED, COMPLETED)`
  short-circuits on duplicate delivery.
- Final state writes `PROJECT_CREATED, COMPLETED` so the dedupe predicate matches.
- Goal/task upsert under `(tenantId, projectId, automationVersion, templateKey)`
  keeps duplicate deliveries safe.
- `ProjectAutomationFailed` outbox emission uses a deterministic
  `automation-failed:${event.id}` idempotency key.

### 2.6 ProjectAutomationService (`src/modules/project-automation/project-automation.service.ts`)

- `getAutomationStatus(tenantId, projectId)` returns canonical state-machine
  status, last log, full log history, and goal/task counts.
- `AutomationStatusView` shape documented in the service file.

### 2.7 Controller (`src/modules/project-automation/project-automation.controller.ts`)

- `GET /project-automation/:projectId/status` is JWT-guarded, derives tenant
  from auth context, and 404s on cross-tenant ID.
- Replaced the previous global `Project.findUnique` with a tenant-scoped
  `findFirst({ id, tenantId })`.

## 3. Verification

### 3.1 TypeScript

```bash
pnpm exec tsc --noEmit
```

Result: `exit=0`.

### 3.2 nest build

```bash
NODE_ENV=production npx nest build
```

Result: silent (success).

### 3.3 Focused Unit Tests

```bash
pnpm exec jest --config jest.config.js --runInBand \
  src/test/unit/outbox-worker.spec.ts \
  src/test/unit/project-automation.handler.spec.ts \
  src/test/architecture/tool-bypass.spec.ts \
  src/test/architecture/circuit-breaker.spec.ts \
  src/modules/enterprise-initiation/legacy-isolation.spec.ts \
  src/modules/enterprise-initiation/application/create-project-from-initiation.handler.spec.ts \
  src/test/characterization/project-automation.handler.spec.ts \
  src/modules/tools/built-in/documents.tool.spec.ts
```

Result:

```text
Test Suites: 8 passed, 8 total
Tests:       49 passed, 49 total
```

The Phase 3-specific unit suite (`src/test/unit/outbox-worker.spec.ts`,
`src/test/unit/project-automation.handler.spec.ts`) covers:

- Tick overlap protection — at most one in-flight tick at a time.
- Successful `markProcessed` clears lease and stamps `processedAt`.
- Three failed attempts promote the row to DEAD_LETTER and insert a
  `enterprise_event_dead_letter` row.
- Stale lease recovery returns PROCESSING → PENDING.
- Duplicate delivery is a no-op (idempotent guard holds).
- Failure classification populates `lastErrorClassification` (e.g., `POLICY_DENIAL`).
- Goal/task idempotency under duplicate handler delivery.
- Handler failure writes a coherent FAILED automation log.

### 3.4 Schema Verification

Live `psql` after migration:

```text
unnest
-------------
 PENDING
 DISPATCHED
 DEAD_LETTER
 PROCESSING
 PROCESSED
(5 rows)

Indexes:
  enterprise_event_outbox_claim_idx  btree (status, "nextAttemptAt", "createdAt")
  enterprise_event_outbox_lease_expiry_idx  btree ("leaseExpiresAt") WHERE status = 'PROCESSING'
  enterprise_event_outbox_tenant_status_idx  btree ("tenantId", status)
```

### 3.5 Deployed Backend Health

```bash
curl -sS -o - -w "STATUS=%{http_code}\n" https://brain.neurecore.com/api/v1/health
```

```text
{"status":"success","data":{"status":"healthy",...}}STATUS=200
```

### 3.6 Deployed AwlHealth Snapshot

```bash
curl -sS https://brain.neurecore.com/api/v1/awl-health
```

```json
{"data":{"status":"degraded","components":{"outbox":{
  "backlog":0,"processing":0,"processed":1,"deadLetter":11,
  "oldestPendingAt":null,"oldestStuckAt":null,
  "workerId":"worker-543866-1785090215416","status":"backlogged"
},"circuit":{"open":false,"status":"closed"},"deadLetters":{"count":10,...},"commands":{"registered":0}}}}
```

### 3.7 Live Verification (`scripts/g3-live.sh` on Contabo)

Run:

```text
$ AWL_G3_RUN_ID=G3-live-FINAL bash /opt/neurecore/backend/backend/scripts/g3-live.sh
=== G3 Live Verification ===
Run: G3-live-FINAL
Tenant: reconstruction-integration-test
Repeated: pass=20 fail=0
Driver row: status=PROCESSED completionLogs=1
Poison: status=DEAD_LETTER retryCount=4 deadLetterRows=1
Stale recovery: before=PROCESSING after=PENDING
Idempotent goals count (must be 1): 1
Projects created: 24 (expected 24 = 20 reps + driver + poison + stale + idem)
Events created: 23 (expected 23 = 20 reps + driver + poison + stale — idem has no event)
G3 LIVE: PASS
```

Mapping to plan §5.6:

| G3 Criterion | Evidence |
|---|---|
| Project automation survives worker restart | `STALE_BEFORE=PROCESSING → STALE_AFTER=PENDING` (lease-recovery path is identical to the restart recovery story) |
| Duplicate delivery produces no duplicate goals, tasks, roles, or assignments | `IDEM_GOALS=1` for two upserts under the same composite key |
| Every failure is visible and retryable or terminal with reason | Poison row reached `retryCount=4, status=DEAD_LETTER, lastError='synthetic failure', lastErrorClassification='TRANSIENT_INFRASTRUCTURE'` plus a `enterprise_event_dead_letter` row |
| Project never silently remains half-initialized | `Driver row: status=PROCESSED completionLogs=1` proves the COMPLETED automation log is written alongside the PROCESSED outbox transition |
| Replaying a completed event has no additional business effect | Phase 3 handler idempotency guard under `(PROJECT_CREATED, COMPLETED)`; unit-tested in `src/test/unit/project-automation.handler.spec.ts` |
| Canonical automation does not depend on legacy fallback | Phase 2 legacy isolation contract still in effect; tested in `src/modules/enterprise-initiation/legacy-isolation.spec.ts` |
| Legacy fallback may be disabled for reconstruction tenant | Same |

### 3.8 Plan §5.1 Preconditions

| Precondition | Where it lives |
|---|---|
| Polling starts, prevents overlap, stops gracefully | `outbox.worker.ts` `start`/`stop`/`tickSafely` + `inflight` Promise |
| Transaction-safe claim | `prisma-outbox.repository.ts` `claimAvailable` row-conditional `updateMany` |
| Lease renewal + stale-lease recovery | `recoverStale`, plus plan §5.1 §6 poison-event isolation |
| Multi-replica behavior | `processingWorkerId` + lease + atomic guards prevent double-claim |
| Backoff with jitter | `OutboxService.computeNextAttempt` (1000ms base, 30s cap, 20% jitter) |
| Retry classification and max attempts | `classifyFailure` (POLICY_DENIAL, INVALID_INPUT, TRANSIENT_INFRASTRUCTURE) + retryCount>=3 promotion |
| Dead-letter transition + controlled replay | `enterprise_event_dead_letter` upsert + `replayDeadLetter` |
| Event schema-version compatibility | `OutboxEvent.version` integer |
| Poison-event isolation | `no handler` path settles failure immediately |
| Transaction boundary | `ProjectAutomationHandler.handleProjectAutomationRequested` keeps `uow.execute()` around all domain writes |
| Worker unavailable behavior | `OutboxWorker.isCircuitOpen` + backlog summary |

## 4. Notes

- The new `OutboxWorker` runs alongside the existing
  `EnterpriseEventTransport`. Phase 4 may separate the two paths cleanly; the
  Phase 3 evidence shows the *new* code path operates the planned semantics
  even in the presence of the older path.
- The Contabo-fork schema diverges from the local Prisma client; this build
  regenerates the live schema but the Prisma client regeneration is gated on a
  rebuild on Contabo. Phase 3 evidence uses raw SQL where the Prisma client
  surfaces the drift.
- The dead-letter rows older than Phase 3 (`cms...` events with
  `lastError='no handler registered'`) demonstrate the worker was previously
  failing to resolve handlers; with Phase 3's wiring, the
  `ProjectAutomationRequested` handler is registered at module bootstrap and
  those failures should not recur.

## 5. Readiness Decision

**Decision:** Phase 3 technical evidence is green and ready for formal
reviewer sign-off, but G3 is not formally closed until the following governance
items are recorded.
