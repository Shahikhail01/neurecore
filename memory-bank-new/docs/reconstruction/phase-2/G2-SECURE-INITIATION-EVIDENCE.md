# G2 Secure Initiation Evidence

**Date:** 2026-07-26  
**Branch:** `feature/awl-g1-operational-gates`  
**Plan Reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §4  
**Status:** IMPLEMENTED LOCALLY — live 20-run G2 repetition and formal reviewer sign-off still pending

## 1. Objective

Phase 2 makes conversational initiation create exactly one recoverable project through the canonical command path.

The implementation focus for this pass was:

- Canonical project materialization through `CreateProjectFromInitiationCommand`
- Explicit approval through `ApproveEnterpriseInitiationCommand`
- Project/outbox/audit/initiation writes inside one unit-of-work transaction
- Idempotent replay behavior for repeated create-project requests
- Read-only initiation status recovery after refresh/relogin
- Legacy/canonical route isolation contract
- Hermes `PROJECT_DISCOVERY` tool-set metadata aligned to the canonical command path

## 2. Implemented Changes

### 2.1 Transaction Atomicity

Updated the initiation/project/audit repository ports and Prisma adapters to accept the unit-of-work transaction client.

Affected files:

- `backend/src/modules/enterprise-initiation/domain/ports/initiation-repository.port.ts`
- `backend/src/modules/enterprise-initiation/infrastructure/prisma-initiation.repository.ts`
- `backend/src/modules/projects/domain/ports/project-repository.port.ts`
- `backend/src/modules/projects/infrastructure/prisma-project.repository.ts`
- `backend/src/common/persistence/prisma-audit.repository.ts`

`CreateProjectFromInitiationHandler` now performs these operations in the same `IUnitOfWork.execute()` transaction:

- Load approved initiation
- Check existing project by initiation
- Create canonical project
- Mark initiation as materializing
- Write audit record
- Publish `ProjectAutomationRequested` outbox event

The returned result now includes `automationRequestId`, allowing clients and operators to correlate the project creation response with the durable outbox event.

### 2.2 Approval Path Fix

`ApproveInitiationHandler` now loads the initiation by ID before asserting the state transition to `APPROVED`.

Previous behavior attempted to load only already-approved initiations before approval, which could reject valid drafts.

### 2.3 Recovery Endpoint

Added read-only status recovery:

`GET /enterprise-initiation/:initiationId/status`

The endpoint returns:

- Initiation status
- Linked project ID, if materialized
- Project status, if available
- Automation state summary
- Correlation ID

This supports frontend refresh/relogin recovery without replaying a mutation.

### 2.4 Legacy Route Isolation

Added `backend/src/modules/enterprise-initiation/legacy-isolation.ts`.

Rules enforced:

- Canonical aggregates cannot silently fall back to legacy writes.
- Legacy aggregates cannot be mutated through canonical routing without migration.
- Tenant flag and aggregate engine jointly determine route.

### 2.5 Hermes Tool Registration

Updated `backend/src/modules/tools/built-in/hermes-tools.ts` so `PROJECT_DISCOVERY` exposes canonical initiation actions:

- `approve_initiation`
- `create_project_from_initiation`

Both require approval and identify their command owner in metadata.

## 3. Verification

### 3.1 TypeScript

Command:

```bash
pnpm exec tsc --noEmit
```

Result:

```text
PASS
```

### 3.2 Phase 2 Focused Tests

Command:

```bash
pnpm exec jest --config jest.config.js \
  src/modules/enterprise-initiation/legacy-isolation.spec.ts \
  src/modules/enterprise-initiation/application/create-project-from-initiation.handler.spec.ts \
  --runInBand
```

Result:

```text
Test Suites: 2 passed, 2 total
Tests: 5 passed, 5 total
```

### 3.3 Architecture Tests

Command:

```bash
pnpm exec jest --config jest.config.js \
  src/test/architecture/tool-bypass.spec.ts \
  src/test/architecture/circuit-breaker.spec.ts \
  --runInBand
```

Result:

```text
Test Suites: 2 passed, 2 total
Tests: 20 passed, 20 total
```

### 3.4 Certification Tests

Command:

```bash
pnpm exec jest --config jest.config.js src/test/certification --runInBand
```

Result:

```text
Test Suites: 6 passed, 6 total
Tests: 16 passed, 16 total
```

### 3.5 Built-In Tool Regression

Command:

```bash
pnpm exec jest --config jest.config.js \
  src/modules/tools/built-in/documents.tool.spec.ts \
  --runInBand
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests: 13 passed, 13 total
```

## 4. G2 Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| One approval creates exactly one project | PARTIAL | Command/idempotency/transaction tests pass; 20 live controlled repetitions pending |
| Zero duplicate projects | PARTIAL | Existing-project dedupe test passes; DB relation has `EnterpriseInitiation.projectId @unique`; live concurrency test pending |
| No tool performs a direct business mutation | PASS LOCALLY | Architecture tests pass |
| Project and outbox event commit together | PASS LOCALLY | Handler transaction propagation test passes |
| Refresh/relogin resolves to correct result | PARTIAL | Status endpoint implemented; frontend refresh test pending |
| Failure never returns misleading success | PARTIAL | Handler throws on missing/unapproved initiation; live UX/API negative test pending |
| Canonical and legacy routes cannot both process same initiation | PASS LOCALLY | Legacy isolation tests pass |

## 5. Readiness Decision

**Decision:** Phase 2 code implementation is substantially on track, but G2 is not formally closed yet.

Phase 3 should not start until these final Phase 2 verification items are completed:

- Run 20 controlled create-from-initiation repetitions against the reconstruction tenant.
- Run at least one concurrent duplicate-attempt test against PostgreSQL.
- Verify Hermes runtime trace shows `PROJECT_DISCOVERY` using `approve_initiation` and `create_project_from_initiation` metadata, not direct project mutation.
- Verify frontend refresh/relogin recovery against `GET /enterprise-initiation/:initiationId/status`.
- Record formal reviewer sign-off for G2.

## 6. Notes

The checked-in Prisma schema currently declares plain enum names, while the local generated client exposes AWL-prefixed enum exports. The implementation was aligned to the generated client so local TypeScript verification passes. This enum naming drift should be normalized in a small dedicated cleanup before broader promotion.
