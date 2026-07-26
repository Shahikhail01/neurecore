# G4 — Task-to-AI Assignment Evidence

**Date:** 2026-07-27
**Branch:** `feature/awl-g4-ai-assignment`
**Plan reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §6
**Status:** TECHNICAL GREEN — formal reviewer sign-off still required (governance only)

## 1. Objective

Phase 4 closes the deterministic, explainable, overridable AI assignment
loop. Every assignment flows through a single transactional command that
revalidates eligibility, reserves agent capacity, persists the decision
with a rationale, and emits the `TaskAssigned` outbox event. Manual
override and reassign are first-class, attributable, and auditable.

## 2. Implementation Summary

### 2.1 Schema (3 migrations)

| Migration | Purpose |
|---|---|
| `20260726_awl_g4_assignment_foundation` | `AgentClassification` enum; `agents.dataClassification` |
| `20260726_awl_g4_task_version` | `tasks.version` optimistic concurrency; `task_assignment_override_audits` table |
| `20260726_awl_g4_assignment_lifecycle` | `task_assignments.releasedAt`, `releasedByActorId`, `releaseReason`, `expiresAt`; sweep index |

### 2.2 Domain + Service

- `domain/agent-capability.ts` exports the versioned
  `SCORING_POLICY_V1` (capability 40 / workload 30 / department 20 /
  historical 10) plus pure `scoreAgent` and `tieBreak` functions.
- `AssignmentService.executeAssign` covers the AssignTaskCommand
  path; `executeRelease` covers the ReleaseAssignmentCommand path.
- `sweepExpiredReleases` runs the §6.2 expiry sweep.

### 2.3 Controller + Commands

- `GET /assignments/eligible-agents/:taskId`
- `POST /assignments/assign` (CommandRegistry path)
- `POST /assignments/release` (CommandRegistry path)
- `GET /assignments/override-audit/:taskId`

### 2.4 Frontend

`frontend-tenant/src/components/assignments/AgentPicker.tsx` —
searchable candidate list + manual override pane. Users never enter
UUIDs.

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

### 3.3 Unit Tests (Phase 4)

```bash
pnpm exec jest --config jest.config.js --runInBand \
  src/test/unit/assignment-scoring.spec.ts \
  src/test/unit/assignment.service.spec.ts \
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
Test Suites: 10 passed, 10 total
Tests:       72 passed, 72 total
```

The Phase 4-specific suite (assignment-scoring + assignment-service =
23 tests) covers: scoring determinism, tie-break ordering,
eligibility ranking, optimistic concurrency, manual override audit,
release + reassign new generation, expired-sweep promotion,
cross-tenant rejection.

### 3.4 Live Migration

```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/neurecore_prod?sslmode=disable&connection_limit=1&connect_timeout=15" npx prisma migrate deploy
```

```text
87 migrations found in prisma/migrations

Applying migration `20260726_awl_g4_assignment_foundation`
Applying migration `20260726_awl_g4_assignment_lifecycle`
Applying migration `20260726_awl_g4_task_version`

The following migration(s) have been applied:
migrations/
  └─ 20260726_awl_g4_assignment_foundation/
    └─ migration.sql
  └─ 20260726_awl_g4_assignment_lifecycle/
    └─ migration.sql
  └─ 20260726_awl_g4_task_version/
    └─ migration.sql

All migrations have been successfully applied.
```

A live hot-fix (`ALTER TABLE task_assignment_override_audits ADD COLUMN
"dataClassificationAtOverride" TEXT`) brought the deployed schema in
line with the Prisma model. This column addition is captured in the
20260726_awl_g4_task_version migration for fresh installs.

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

Run (`AWL_G4_RUN_ID=G4-live-FINAL`):

```text
=== G4 Live Verification ===
Run: G4-live-FINAL
Tenant: reconstruction-integration-test
Projects already in tenant: 66
Test task: task_g4_4-live-_g2proj_ms1qe0nv_6chmweaw
INSERT 0 1
Test task: task_g4_4-live-_g2proj_ms1qe0nv_6chmweaw
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

G4 LIVE: PASS
```

Mapping to plan §6.5:

| G4 Criterion | Evidence |
|---|---|
| Golden task receives one eligible AI employee | `Auto-assign: assignment row=1 task fields=2 outbox=1` (STAFF agent at generation 1, task status QUEUED, TaskAssigned outbox) |
| Users never enter UUIDs manually | `AgentPicker` UI selects by agent id; controller rejects explicit id-only paths through `tenantId`-scoped reads |
| Assignment rationale is visible | `task_assignments.rationale` + the same string echoed back through the `AssignTaskResult` payload |
| Invalid or cross-tenant assignment is rejected | `Cross-tenant: row inserted=0` — FK constraint and the service-level `task.tenantId !== tenantId` guard |
| Manual override is attributable and auditable | `Override: gen2 row=1 gen1 released=1 audit=1` — override audit row written, generation incremented, previous agent recorded |
| Assignment persists consistently across views | `tasks.version` increments on every transition; `task_assignments.generation` is unique per `(tenantId, taskId)` |

### 3.8 Plan §6.5 Verifications (cross-references)

- `gate-a-1-eligibility-filtering`: `findEligibleAgents` tested in
  `src/test/unit/assignment.service.spec.ts` (9 tests).
- `gate-a-2-scoring-logic`: `scoreAgent` + `tieBreak` tested in
  `src/test/unit/assignment-scoring.spec.ts` (14 tests).
- `gate-a-3-decision-persistence`: optimistic concurrency on
  `updateAssignment`; outbox `TaskAssigned` emitted in the same
  transaction; audit row written on auto and override paths.
- `gate-a-5-manual-override-permission`: `manualOverrideRationale`
  is required to set `manualOverride=true`; the audit row captures
  `overrideByActorId`, `overrideByActorType`, `previousAgentId`,
  `dataClassificationAtOverride`.

## 4. Caveats and Follow-ups

- The deployed `TaskStatus` enum is the legacy shape (no `READY` /
  `ASSIGNED` values). The G4 script aligns with the deployed schema by
  reading `PENDING` tasks and writing `QUEUED`. Fresh installs use the
  full enum after Prisma migrate deploy.
- The `dataClassificationAtOverride` column was added to the live DB
  via a hot ALTER TABLE; the migration is updated so future greenfield
  installs land it via `prisma migrate deploy`.
- Frontend AgentPicker is wired into the assignments surface; the
  next phase (Phase 5 — Execution Runtime) will consume the
  `TaskAssigned` outbox event to start attempt creation.

## 5. Readiness Decision

**Decision:** Phase 4 technical evidence is green and ready for formal
reviewer sign-off, but G4 is not formally closed until the listed
reviewer approvals are recorded.