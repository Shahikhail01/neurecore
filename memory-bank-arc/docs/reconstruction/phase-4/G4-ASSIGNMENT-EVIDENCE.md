# G4 — Task-to-AI Assignment Evidence

**Date:** 2026-07-27
**Branch:** `feature/awl-g4-ai-assignment`
**Plan reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §6
**Status:** TECHNICAL GREEN — formal reviewer sign-off still required (governance only)

> **Post-audit revision.** A critical audit pass identified 30+ findings
> that were remediated in commit `904da5b0`. The architecture, scoring
> policy, and lifecycle are unchanged; the audit fixed transactional
> correctness gaps, added capacity re-check inside the transaction,
> enforced tenant flag + role checks, surfaced the alternatives list,
> wired controller through the CommandRegistry, and expanded test
> coverage. All 79 unit tests and the live verification PASS.

## 1. Objective

Phase 4 closes the deterministic, explainable, overridable AI
assignment loop. Every assignment flows through a single transactional
command that revalidates eligibility, reserves agent capacity, persists
the decision with a rationale, and emits the `TaskAssigned` outbox event.
Manual override and reassign are first-class, attributable, and auditable.

## 2. Implementation Summary

### 2.1 Schema (3 migrations, unchanged from initial design)

| Migration | Purpose |
|---|---|
| `20260726_awl_g4_assignment_foundation` | `AgentClassification` enum; `agents.dataClassification` |
| `20260726_awl_g4_task_version` | `tasks.version` optimistic concurrency; `task_assignment_override_audits` table |
| `20260726_awl_g4_assignment_lifecycle` | `task_assignments.releasedAt`/`releasedByActorId`/`releaseReason`/`expiresAt`; sweep index |

### 2.2 Domain + Service

- `domain/agent-capability.ts` exports the versioned
  `SCORING_POLICY_V1` (capability 40 / workload 30 / department 20 /
  historical 10), pure `scoreAgent` + `tieBreak` (workload →
  maxConcurrency → agent id lex order).
- `AssignmentService.executeAssign` covers the AssignTaskCommand
  path with the **post-audit hardening**:
  - tenant guard + dedup branch (state machine moves AFTER dedup)
  - AUTO_ASSIGNMENT flag gate (manual override always allowed)
  - in-transaction re-fetch of the chosen agent + capacity re-check
  - 4-attempt P2002 retry loop around `(tenantId, taskId, generation)`
- `AssignmentService.executeRelease` covers the ReleaseAssignmentCommand
  path: revalidates the reassign target agent (tenant, availability,
  capacity), persists the new generation in one transaction, drops the
  agent linkage on pure release, and emits either `TaskAssignmentReleased`
  or `TaskAssigned` accordingly.
- `AssignmentService.sweepExpiredReleases` — batch-transition expired
  ACTIVE rows to EXPIRED, drop the task linkage, and emit one
  `TaskAssignmentReleased` outbox event per transitioned row.

### 2.3 Commands

- `commands/assign-task.command.ts` — typed `AssignTaskInput`,
  `AssignTaskResult` with ranked `alternatives[]`. Command name
  `AssignTaskCommand:1.0`.
- `commands/release-assignment.command.ts` — typed
  `ReleaseAssignmentInput`, `ReleaseAssignmentResult`. Command name
  `ReleaseAssignmentCommand:1.0`. New `reassignExpiresInSeconds`
  override.

### 2.4 Controller

- `GET  /assignments/eligible-agents/:taskId` — pre-filters by the task's
  actual `requiredRole`, `requiredCapabilities`, and `departmentId`.
- `POST /assignments/assign` — routes through `CommandRegistry` so the
  idempotency / replay safety nets apply uniformly. Requires
  `OWNER`/`MANAGER` role for `manualOverrideRationale`.
- `POST /assignments/release` — routes through `CommandRegistry`.
  Requires `OWNER`/`MANAGER`/`LEAD` role.
- `GET  /assignments/override-audit/:taskId` — audit history.

### 2.5 Frontend

`frontend-tenant/src/components/assignments/AgentPicker.tsx` —
searchable list, role/capability match, current workload, department
alignment, total score, policy version, and the rationale returned by
the backend. Manual override pane with rationale textarea. Users never
enter UUIDs.

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

### 3.3 Unit Tests

```bash
pnpm exec jest --config jest.config.js --runInBand \
  src/test/unit/outbox-worker.spec.ts \
  src/test/unit/project-automation.handler.spec.ts \
  src/test/unit/assignment-scoring.spec.ts \
  src/test/unit/assignment.service.spec.ts \
  src/test/architecture/tool-bypass.spec.ts \
  src/test/architecture/circuit-breaker.spec.ts \
  src/modules/enterprise-initiation/legacy-isolation.spec.ts \
  src/modules/enterprise-initiation/application/create-project-from-initiation.handler.spec.ts \
  src/test/characterization/project-automation.handler.spec.ts \
  src/modules/tools/built-in/documents.tool.spec.ts
```

Result:

```text
Test Suites: 10 passed, 10 total
Tests:       79 passed, 79 total
```

The Phase 4-specific suite (`assignment-scoring` 14 +
`assignment.service` 16 = **30 tests**) covers:

- deterministic scoring
- workload penalty cap
- department scoring
- capability match
- tie-break ordering
- auto-assign happy path
- manual-override audit + outbox
- no-eligible rejection
- cross-tenant rejection
- pure release
- release + reassign new generation
- expired sweep + outbox
- AUTO_ASSIGNMENT flag gate (auto rejected, override allowed)
- capacity re-check inside the transaction (both auto and override paths)
- dedup branch happy path
- dedup closed-state behavior

### 3.4 Schema Verification (Live)

```text
unnest
-------------
 PENDING
 QUEUED
 RUNNING
 COMPLETED
 FAILED
 CANCELLED
(6 rows)

Indexes on enterprise_event_outbox:
  enterprise_event_outbox_claim_idx  btree (status, "nextAttemptAt", "createdAt")
  enterprise_event_outbox_lease_expiry_idx  btree ("leaseExpiresAt") WHERE status = 'PROCESSING'
  enterprise_event_outbox_tenant_status_idx  btree ("tenantId", status)

Columns on agents:
  dataClassification  AgentClassification  (INTERNAL | CONFIDENTIAL | RESTRICTED)

Columns on task_assignment_override_audits:
  dataClassificationAtOverride TEXT

Columns on task_assignments:
  releasedAt, releasedByActorId, releaseReason, expiresAt

Columns on tasks:
  version (optimistic concurrency)
```

### 3.5 Deployed Backend Health

```bash
curl -sS -o - -w 'STATUS=%{http_code}\n' https://brain.neurecore.com/api/v1/health
```

```text
{"status":"success","data":{"status":"healthy",...}}STATUS=200
```

### 3.6 Deployed Commands Registered

```text
[CommandRegistry] Registered command AssignTaskCommand:1.0
[CommandRegistry] Registered command ReleaseAssignmentCommand:1.0
[OutboxWorker] Registered handler for ProjectAutomationRequested
[OutboxWorker] Registered handler for TaskExecutionRequested
```

### 3.7 Live Verification (`scripts/g4-live.sh`)

Run (`AWL_G4_RUN_ID=G4-live-final`):

```text
=== G4 Live Verification ===
Run: G4-live-final
Tenant: reconstruction-integration-test
Projects already in tenant: 66
Test task: task_g4_4-live-final_g2proj_ms1qe0nv_6chmweaw
INSERT 0 1
DELETE 1
DELETE 0
DELETE 0
INSERT 0 1
INSERT 0 1
INSERT 0 1
1
Auto-assign: assignment row=1 task fields=2 outbox=1
1
Override: gen2 row=1 gen1 released=1 audit=1
1
Reassign: gen3 row=1
Cross-tenant: row inserted=0 tenant-foreign=0
INSERT 0 1
UPDATE 1
Expired sweep: status_after=EXPIRED
1
Sweep outbox: row=1

G4 LIVE: PASS
```

Mapping to plan §6.5:

| G4 Criterion | Evidence |
|---|---|
| Golden task receives one eligible AI employee | `Auto-assign: assignment row=1 task fields=2 outbox=1` (STAFF agent at generation 1, task status QUEUED, TaskAssigned outbox) |
| Users never enter UUIDs manually | `AgentPicker` UI selects by agent id; controller rejects explicit id-only paths through `tenantId`-scoped reads |
| Assignment rationale is visible | `task_assignments.rationale` + the same string echoed back through the `AssignTaskResult` payload + `alternatives[]` |
| Invalid or cross-tenant assignment is rejected | `Cross-tenant: row inserted=0` — FK constraint and the service-level `task.tenantId !== tenantId` guard + tenant role check on the controller |
| Manual override is attributable and auditable | `Override: gen2 row=1 gen1 released=1 audit=1` — override audit row written, generation incremented, previous agent recorded + controller `requireOverrideRole(OWNER|MANAGER)` gate |
| Assignment persists consistently across views | `tasks.version` increments on every transition; `task_assignments.generation` is unique per `(tenantId, taskId)`; capacity re-check inside transaction prevents oversubscription |
| Expired assignments are released visibly | `Expired sweep: status_after=EXPIRED` + `Sweep outbox: row=1` — sweep emits `TaskAssignmentReleased` and drops the agent linkage |

### 3.8 Plan §6.5 Verifications (cross-references)

- `gate-a-1-eligibility-filtering`: `findEligibleAgents` (assignment.service
  spec 9 tests + 14 scoring tests).
- `gate-a-2-scoring-logic`: `scoreAgent` + `tieBreak` (scoring spec).
- `gate-a-3-decision-persistence`: optimistic concurrency on
  `updateAssignment`; outbox `TaskAssigned` emitted in the same
  transaction; audit row written on auto and override paths.
- `gate-a-5-manual-override-permission`: `manualOverrideRationale`
  required to set `manualOverride=true`; audit row captures
  `overrideByActorId`, `overrideByActorType`, `previousAgentId`,
  `dataClassificationAtOverride`; controller enforces `OWNER`/`MANAGER`.

## 4. Caveats and Follow-ups

- The deployed `TaskStatus` enum is the legacy shape (no `READY` /
  `ASSIGNED` values). The G4 script aligns with the deployed schema
  by reading `PENDING` tasks and writing `QUEUED`. Fresh installs use
  the full enum after `prisma migrate deploy`.
- The `dataClassificationAtOverride` column was added to the live DB
  via a hot ALTER TABLE; the migration is updated for greenfield installs.
- Frontend AgentPicker is wired into the assignments surface; the next
  phase (Phase 5 — Execution Runtime) will consume the
  `TaskAssigned` outbox event to start attempt creation.

## 5. Readiness Decision

**Decision:** Phase 4 technical evidence is green and ready for formal
reviewer sign-off, but G4 is not formally closed until the listed
reviewer approvals are recorded.