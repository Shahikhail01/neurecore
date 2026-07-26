# Phase 3 Plan — Transactional Outbox and Durable Automation

**Source:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §5
**Phase duration:** 2 weeks
**Phase objective:** Reliably convert a created project into goals, tasks, role requirements, and initial assignment requests, through a durable transactional outbox and a leased worker.

## 1. Authorization Gate

Per plan §1.4 ("Each later phase requires its preceding gate evidence and a phase-start approval") and §4.7 ("Phase 3 should not start until [G2 governance] is completed"), Phase 3 implementation is held until:

- All five reviewer signatures recorded in `phase-2/G2-SIGN-OFF.md`
- G2 closure decision changed from `HELD only` to `CLOSED`
- A formal phase-start approval is recorded

This document captures the planned Phase 3 work so G3 evidence and tests can be drafted in parallel with G2 governance; no production code or migration may land until the gate above is satisfied.

## 2. Phase 3 Workstreams

### 2.1 Outbox Infrastructure (plan §5.1)

`backend/src/common/outbox/`

- `outbox.module.ts` — global module wiring
- `outbox.service.ts` — transactional publish + `executeInTransaction`
- `outbox.repository.ts` — Prisma adapter with `claimAvailable`, `markCompleted`, lease/stale-lease handling
- `outbox.worker.ts` — leased poller with backoff, retry, dead-letter, poison isolation
- Prisma migration: outbox table, unique `(tenantId, scope, idempotencyKey)`, indexes for `(status, availableAt)` claim path

Implementation preconditions that must be specified and tested before code lands (per plan §5.1):

- Polling start, overlap prevention, graceful stop
- Transaction-safe claim (row locks or expiring leases)
- Lease renewal and stale-lease recovery
- Multi-replica behavior
- Exponential backoff with jitter
- Retry classification and maximum attempts
- Dead-letter transition and controlled replay
- Event schema-version compatibility
- Poison-event isolation
- Handler-effect vs processed-event transaction boundary
- Deployment/readiness behavior when worker is unavailable

### 2.2 Project Automation Worker (plan §5.2)

`backend/src/modules/project-automation/`

- `project-automation.worker.ts` — handler for `ProjectAutomationRequested`
- Idempotent `materializeGoals`, `materializeTasks`, `createRoleRequirements`, `createAssignmentRequests`
- Status transitions for `ProjectAutomationStatus`
- Per-step uniqueness constraints (deterministic template keys per tenant/project/automationVersion)

### 2.3 Idempotency Implementation (plan §5.3)

- Aggregate uniqueness constraints in Prisma schema
- Database-backed command/event processing record
- Atomic key reservation
- Reject reuse with different request hash
- Persisted authoritative result on replay
- No TTL expiry on durable business keys

### 2.4 Failure Visibility (plan §5.4)

- `automation-status.service.ts` — exposure of in-flight status
- `GET /projects/:projectId/automation-status`
- Dead-letter visibility tooling

## 3. Phase 3 Deliverables (per plan §5.5)

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Transactional outbox implementation | Backend Lead | Transaction test |
| Outbox publisher with retry/backoff | Backend Lead | Failure injection |
| Stable event IDs as job IDs | Backend Lead | Trace verified |
| ProjectAutomationWorker implementation | Backend Lead | Integration test |
| Idempotent automation steps | Backend Lead | Duplicate delivery test |
| Automation progress tracking | Backend Lead | UI verified |
| Dead-letter visibility | Backend Lead | Manual test |
| Worker crash recovery | Backend Lead | Restart test |

## 4. G3 Criteria (per plan §5.6)

- Project automation survives worker restart
- Duplicate delivery produces no duplicate goals, tasks, roles, or assignments
- Every failure is visible and retryable or terminal with reason
- Project never silently remains half-initialized
- Replaying a completed event has no additional business effect
- Canonical automation does not depend on legacy fallback
- Legacy fallback may be disabled for reconstruction tenant

## 5. Pre-Approved Phase-3 Evidence Templates

- `phase-3/automation-status-live-probe.md` — Contabo live status query
- `phase-3/duplicate-delivery-live-test.md` — outbox-envelope duplication test
- `phase-3/worker-restart-live-test.md` — kill/restart propagation test

These templates may be drafted in advance but no live evidence may be collected until G2 is formally closed.
