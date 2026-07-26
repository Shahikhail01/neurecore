# G2 Secure Initiation Evidence

**Date:** 2026-07-26  
**Branch:** `feature/awl-g1-operational-gates`  
**Plan Reference:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §4  
**Status:** DEPLOYED RUNTIME PARTIALLY VERIFIED — refreshed live G2 repetition blocked by Neon quota; formal reviewer sign-off pending

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

### 3.6 Live 20-Run Controlled Repetition

Command:

```bash
node scripts/g2-live-initiation-verification.cjs
```

Execution path:

- Connected through Contabo SSH tunnel to PostgreSQL.
- Scoped to tenant `reconstruction-integration-test`.
- Used synthetic actor `awl-g2-verifier@reconstruction.local`.
- Created clearly labeled `G2-*` verification records only.

Result:

```text
G2 run: G2-2026-07-26T11-45-02-805Z
20-run controlled repetition: 20/20 materialized
Concurrency duplicate test: fulfilled=1, rejected=9
passed: true
projectCount: 21
outboxCount: 21
uniqueInitiationLinks: 21
duplicateInitiationLinks: []
```

Follow-up after enum/migration reconciliation:

```text
Run id: G2-2026-07-26T13-08-PRISMA-ENUM
Path: Contabo host, updated runner using Prisma project.create with executionEngineVersion='canonical'
Result: BLOCKED before tenant lookup
Database error: Neon account/project exceeded compute time quota
```

The original 20-run/concurrency invariant remains valid as prior live evidence. The stricter post-fix rerun could not complete because the database provider rejected compute before the first read.

### 3.7 Deployed Runtime Probes

Backend health:

```text
GET https://brain.neurecore.com/api/v1/health -> 200
timestamp: 2026-07-26T13:07:59.495Z
```

PM2 status on Contabo:

```text
neurecore-backend online
neurecore-tenant online
neurecore-admin online
neurecore-cors-proxy online
```

Hermes runtime trace:

```text
CommandRegistry registered:
- ApproveEnterpriseInitiationCommand:1.0
- CreateProjectFromInitiationCommand:1.0
```

Frontend/API recovery probe:

```text
GET https://brain.neurecore.com/api/v1/enterprise-initiation/G2-probe/status -> 401
```

Conclusion: the Phase 2 status route is deployed and protected by authentication. Public unauthenticated probing verifies routing presence by returning auth failure instead of 404. Full browser/frontend refresh-relogin verification still requires an authenticated tenant session and a live database with compute available.

### 3.8 Enum and Migration Drift Reconciliation

Applied migrations:

```text
20260726_g2_enum_audit_drift
20260726_g2_enum_column_casts
```

Verified live schema state:

```text
agents.availability -> AwlAgentAvailability
projects.executionEngineVersion -> AwlExecutionEngine
reviews.status -> AwlReviewStatus
prisma migrate deploy -> No pending migrations to apply
```

Additional Prisma enum write proof:

```text
Prisma project create with executionEngineVersion='canonical' succeeded inside rollback-only verification transaction.
```

## 4. G2 Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| One approval creates exactly one project | PASS DB | Live G2 run `G2-2026-07-26T11-45-02-805Z`: 20/20 materialized |
| Zero duplicate projects | PASS DB | Live concurrency test: 1 success, 9 rejected, 0 duplicate initiation links |
| No tool performs a direct business mutation | PASS LOCALLY | Architecture tests pass |
| Project and outbox event commit together | PASS DB | Live run created 21 projects and 21 outbox events in transaction-scoped flow |
| Refresh/relogin resolves to correct result | PARTIAL LIVE | Status endpoint deployed; unauthenticated route probe returns 401, authenticated browser recovery blocked by DB quota/session requirement |
| Failure never returns misleading success | PARTIAL | Handler throws on missing/unapproved initiation; live UX/API negative test pending |
| Canonical and legacy routes cannot both process same initiation | PASS LOCALLY | Legacy isolation tests pass |
| Hermes runtime trace uses canonical tools | PARTIAL LIVE | CommandRegistry registered both canonical Phase 2 commands live; end-to-end Hermes tool invocation still pending |
| Enum/migration drift fixed | PASS LIVE | AWL enum columns verified; migrations up to date; rollback-only Prisma enum write succeeded |

## 5. Readiness Decision

**Decision:** Phase 2 is deployed and materially on track, but G2 is not formally closed yet.

Phase 3 should not start until these final Phase 2 verification items are completed:

- Restore/upgrade Neon compute quota, then rerun `G2-2026-07-26T13-08-PRISMA-ENUM` or a new equivalent strict Prisma-backed 20-run/concurrency verification.
- Verify an authenticated frontend refresh/relogin recovery against `GET /enterprise-initiation/:initiationId/status`.
- Verify a full Hermes `PROJECT_DISCOVERY` invocation trace using `approve_initiation` and `create_project_from_initiation` metadata, not direct project mutation.
- Record formal reviewer sign-off for G2.

## 6. Notes

The checked-in Prisma schema, generated client, and live database have been reconciled to AWL-prefixed enum names for the affected Phase 2 columns.

The live audit table now includes `correlationId` and `causationId` compatibility columns from the G2 drift migration. The remaining closure blocker is not schema drift; it is external database compute quota plus authenticated end-to-end reviewer verification.
