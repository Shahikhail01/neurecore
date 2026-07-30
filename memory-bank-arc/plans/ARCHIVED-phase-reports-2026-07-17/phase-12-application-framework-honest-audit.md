# Phase 12 — Enterprise Applications Framework: Honest Audit

**Date:** 2026-07-18
**Branch:** `006-simulation-readiness`
**Commit:** `f404573`
**Status:** MOSTLY COMPLETE — core infrastructure intact, two gaps remediated

---

## Executive Summary

Phase 12 (Enterprise Applications Framework) provides the product layer — Application Registry, Domain Packages, Industry Solutions, Workspaces, and Enterprise Catalog. Applications inherit all 11-layer platform governance and never own infrastructure.

**Audit findings:**
- Core infrastructure (schema, migration, service, controller, module, existing tests) was correctly implemented
- **Gap 1 (fixed):** `deprecate()` and `retire()` were missing from the interface despite `AppStatus` supporting all four states (DRAFT → ACTIVE → DEPRECATED → RETIRED)
- **Gap 2 (fixed):** Three event types were registered in the fabric (`application.installed`, `application.activated`, `application.catalog.updated`) but `ApplicationFramework` never emitted any of them

---

## What Was Already Implemented (Verified Intact)

### Schema & Migration

| Table | Migration | Key Fields |
|---|---|---|
| `applications` | `20260714_application_framework` | `id`, `tenantId`, `name`, `domain`, `version`, `status` (AppStatus), `edition` (Edition), `requiredCapabilities`, `icon`, `navigationJson`, `metadataJson` |
| `domain_packages` | `20260714_application_framework` | `id`, `tenantId`, `name`, `domain`, `modules` (string[]), `dependencies` |
| `industry_solutions` | `20260714_application_framework` | `id`, `tenantId`, `name`, `industry`, `packages` (string[]) |
| `workspaces` | `20260714_application_framework` | `id`, `tenantId`, `name`, `role`, `dashboards` (string[]), `layoutJson` |

**`AppStatus` enum:** `DRAFT | ACTIVE | DEPRECATED | RETIRED`
**`Edition` enum:** `COMMUNITY | PROFESSIONAL | ENTERPRISE | GOVERNMENT | PRIVATE_CLOUD`

All tables: `@@unique([tenantId, name])` per tenant.

### Service (`ApplicationFramework`) — pre-existing

| Method | Status | Notes |
|---|---|---|
| `registerApp` | ✅ | tenant-scoped, edition optional |
| `listApps` | ✅ | domain filter supported |
| `activate` | ✅ | cross-tenant guard (id + tenantId) |
| `registerDomain` | ✅ | tenant-scoped |
| `registerSolution` | ✅ | tenant-scoped |
| `createWorkspace` | ✅ | tenant-scoped |
| `catalog` | ✅ | parallel fetch of all 4 entities |

### Controller — pre-existing

9 endpoints, all JwtAuthGuard:
- `GET /application-framework/v1/catalog`
- `POST /application-framework/v1/apps`
- `GET /application-framework/v1/apps`
- `POST /application-framework/v1/apps/:id/activate`
- `POST /application-framework/v1/domains`
- `GET /application-framework/v1/domains`
- `POST /application-framework/v1/solutions`
- `GET /application-framework/v1/solutions`
- `POST /application-framework/v1/workspaces`
- `GET /application-framework/v1/workspaces`

### Module

- `ApplicationFrameworkModule` imported in `app.module.ts` at line 183
- Uses `{ provide: APP_FRAMEWORK, useExisting: ApplicationFramework }` (DIP-compliant)

---

## Honest Gaps Found & Remediated

### Gap 1: Missing `deprecate()` and `retire()` methods

**Problem:** `AppStatus` enum defines four states (`DRAFT | ACTIVE | DEPRECATED | RETIRED`) but the interface only had `activate()`. A full application lifecycle (DRAFT→ACTIVE→DEPRECATED→RETIRED) was not implementable.

**Fix:** Added `deprecate()` and `retire()` to `IApplicationFramework` and `ApplicationFramework`. Both use the same compound `(id, tenantId)` update pattern as `activate()` — cross-tenant calls throw "application not found for tenant".

Added controller endpoints:
- `PATCH /application-framework/v1/apps/:id/deprecate`
- `PATCH /application-framework/v1/apps/:id/retire`

### Gap 2: No Event Emissions

**Problem:** The enterprise event registry (`enterprise-event-registry.ts`) registered three event types:
- `application.installed`
- `application.activated`
- `application.catalog.updated`

`ApplicationFramework` never emitted any events. No consumer could react to app installation, activation, or catalog changes.

**Fix:** Injected `IEnterpriseEventTransport` via DIP and added event emissions:

| Action | Events Emitted |
|---|---|
| `registerApp` | `application.installed` + `application.catalog.updated` |
| `activate` | `application.activated` |
| `deprecate` | `application.catalog.updated` |
| `retire` | `application.catalog.updated` |
| `registerDomain` | `application.catalog.updated` |
| `registerSolution` | `application.catalog.updated` |
| `createWorkspace` | `application.catalog.updated` |

Events are non-fatal: emit failures are caught and swallowed. `publish()` calls include `idempotencyKey` and `sourceModule: 'ApplicationFramework'`.

---

## Pre-existing Tests (13 passing, verified intact)

- `registerApp` creates DRAFT row with default edition ENTERPRISE
- `registerApp` accepts explicit Edition (COMMUNITY, GOVERNMENT, etc.)
- `listApps` returns only calling tenant's apps
- `listApps` filters by domain
- `activate` works for owning tenant → ACTIVE
- `activate` **refuses cross-tenant** (CRITICAL regression guard)
- `activate` throws when app doesn't exist
- `registerDomain` tenant-scoped
- `listDomains` tenant-scoped
- `registerSolution` + `listSolutions` tenant-scoped
- `createWorkspace` + `listWorkspaces` tenant-scoped
- `catalog` aggregates all 4 entity types per tenant
- `catalog` does not leak other tenants' entries

---

## New Tests Added (11 passing)

**deprecate (2):**
- works for owning tenant → DEPRECATED
- refuses cross-tenant

**retire (2):**
- works for owning tenant → RETIRED
- refuses cross-tenant

**Event emissions (7):**
- `registerApp` emits `application.installed` + `application.catalog.updated`
- `activate` emits `application.activated`
- `deprecate` emits `application.catalog.updated`
- `retire` emits `application.catalog.updated`
- `registerDomain` emits `application.catalog.updated`
- `registerSolution` emits `application.catalog.updated`
- `createWorkspace` emits `application.catalog.updated`

---

## Test Results

| Suite | Result |
|---|---|
| `application-framework-in-memory.spec.ts` | 24 passed (was 13, +11 new) |
| `application-framework-db.spec.ts` | Skipped (no DATABASE_TEST_URL) |
| **Phase 12 total** | **24 passing** |
| Full backend suite | 1301 passing, 37 pre-existing failures |

---

## Architectural Properties

| Property | Status |
|---|---|
| **SRP** | `ApplicationFramework` manages app/domain/solution/workspace lifecycle; events are emitted to fabric |
| **OCP** | Add new lifecycle methods without modifying existing ones |
| **ISP** | Separate view types for App, DomainPackage, IndustrySolution, Workspace |
| **DIP** | Controller depends on `IApplicationFramework`; service depends on `IEnterpriseEventTransport` |
| **Tenant isolation** | All operations filter by `tenantId`; mutations use compound `(id, tenantId)` |
| **Audit-remediation** | `activate/deprecate/retire` all use `findFirst` + `updateMany` with compound where |

---

## What Is NOT Phase 12 (Outside Scope)

| Item | Reason |
|---|---|
| Application Shell UI | Frontend concern; backend registry/catalog ready |
| Cross-application navigation | Frontend concern; catalog endpoint enables it |
| Branding/licensing UI | Frontend concern |
| Workspace layout rendering | Frontend concern |
| Auto-deployment of apps | Cloud operations |

---

## Deployment

**Contabo unreachable** (`164.52.212.221` — no route to host). Commit `f404573` ready on `006-simulation-readiness`.
