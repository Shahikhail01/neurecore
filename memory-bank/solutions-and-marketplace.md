# Solutions & Marketplace

> How `SolutionPack`, `Package`, `TenantTemplate`, and `Marketplace` compose, install, and apply. Last refreshed: 2026-07-31.

There are **three layers** of "composable business bundle" in the platform:

| Layer | Model | Live in | Owner role |
|---|---|---|---|
| **TenantTemplate** | `TenantTemplate` | `tenant-templates/` | PLATFORM_ADMIN |
| **SolutionPack** | `SolutionPack` | `solution-packs/` | SUPER_ADMIN / PLATFORM_ADMIN |
| **Package** | `Package` | `packages/` | TENANT_ADMIN (deploys to own tenant) |
| **Marketplace listing** | `MarketplaceListing` | `marketplace/` | PLATFORM_ADMIN (publishes) |

Plus **industry bundles** (`IndustrySolution`) and **project type packs**
(`ProjectTypePack`) which are tightly related but live separately.

---

## 1. Concepts

### 1.1 TenantTemplate
A **platform-level** template that defines a starting point for a new
tenant. Includes default department templates, agent templates, project
types, workflows, and feature flags. Tenant may inherit + override.

### 1.2 SolutionPack
A **composite** that bundles:
- Agent templates (`AgentTemplate`)
- Department templates (`DepartmentTemplate`)
- Project types (`ProjectType`)
- Workflows (`WorkflowTemplate`)
- Knowledge packs (`KnowledgePack`)
- Connectors / integrations (`ToolIntegration`)
- Optional industry targeting

Owned by the platform; installed at the tenant level. **Lifecycle**:
`draft → beta → stable → deprecated → retired`.

### 1.3 Package
**Per-tenant composition.** A tenant admin combines installed solution
packs + platform primitives into a deployable composition, then deploys
it (atomic) to enable / reconfigure.

### 1.4 IndustrySolution + ProjectTypePack
- `IndustrySolution` — industry-specific recommendation row (used by
  the onboarding allocator).
- `ProjectTypePack` — per-industry project type presets.

### 1.5 Marketplace
A **read-side facade** that unifies browsing across all of:
- SolutionPacks
- AgentTemplates
- Connectors
- Workflows
- KnowledgePacks

It has 8 tabs (defined in the controller); it delegates to the
respective module services for actual data.

---

## 2. Models (Prisma)

Primary models (from `schema.prisma`):
- **`Package`** — composite package (Pool #6 admin).
- **`PackInstallation`** — per-tenant install record.
- **`TenantInstalledPack`** — denormalised for fast listing.
- **`SolutionPack`** — pack definition.
- **`MarketplaceListing`** — public marketplace row.
- **`TenantTemplate`** — platform template.
- **`DomainPackage`** — domain-bundled package (Phase 10).
- **`ProjectTypePack`** — project type pack.
- **`IndustrySolution`** — industry solution recommendation.

Supporting: **`Feature`**, **`FeatureLifecycle`**,
**`KnowledgePack`**, **`Plugin`**, **`ExtensionPermission`** —
related primitives that can be packaged.

---

## 3. Backend modules

### 3.1 `backend/src/modules/packages/` — Pool #6 admin
- `packages.controller.ts:1-11` documents the standard CRUD + the
  composition-specific endpoints:
  - `PATCH /:id/composition` — replace M2M items in one tx.
  - `POST /preview` — dry-run validation + counts.
  - `POST /deploy` — apply to a tenant.
  - `GET /deploy/preview` — dry-run a deploy.
- `packages.service.ts` + `.spec.ts`.
- `services/package-deployment.service.ts` — the actual deploy logic.
- `dto/` — CreatePackageDto, UpdatePackageDto, DeployPackageDto,
  PackagePreviewDto, etc.

The comment block at `packages.controller.ts:42-49` warns about a
**`import type` vs `import value`** pitfall: under
`isolatedModules: true`, DTOs used as parameter-types must be **value
imports**, not `import type`. This was a runtime bug source — keep the
import shape.

### 3.2 `backend/src/modules/solution-packs/`
- `solution-packs.controller.ts:1-22` documents the REST surface:
  - `GET /` — list catalog (filters: category, status, tierRequired,
    q, installedOnly).
  - `GET /:slug` — pack details.
  - `GET /:slug/preview` — install preview (T7.9).
  - `POST /:slug/install` — install (OWNER or ADMIN per RBAC §4.11).
  - `DELETE /:slug` — uninstall.
  - `GET /installed` — tenant's installed packs.
  - `GET /installed/history` — install/uninstall audit log.
  - `POST /` — create (PLATFORM admin).
  - `PATCH /:id` — update.
  - `POST /:id/publish` — set `status=stable` + `publishedAt`.
- `solution-packs.module.ts` — Nest wiring.
- `guards/` — RBAC guards.
- `interfaces/` — TS contracts.
- `services/` — orchestration.
- `dto/` — request/response.

### 3.3 `backend/src/modules/marketplace/`
- 8 browser tabs, unified:
  - Packs, agent templates, connectors, workflows, knowledge packs,
    industries, ...
- `marketplace.controller.ts:1-19` documents the tabs:
  - `GET /tabs` — list + counts + recent.
  - `GET /items?tab=...` — browse one tab.
  - `GET /packs` / `:slug` / `:slug/install` — pass-through to
    solution-packs.
  - `GET /agent-templates` / `/connectors` / `/workflows` /
    `/knowledge-packs` — pass-through.
  - `GET /docs-json` — public OpenAPI subset for third-party pack
    developers.
- `services/marketplace.service.ts` — aggregation.

---

## 4. Onboarding integration

The onboarding allocator uses these primitives to recommend a starting
configuration:

1. Read `QuestionPack` for the user's industry.
2. Look up `OnboardingAllocator` rules for `(industry, tier, answers)`.
3. Recommend a **Package** (composition of solution packs + primitives).
4. User accepts — `OnboardingService.applyPackage(packageId)` runs:
   - Install referenced `SolutionPack`s (`/api/v1/solution-packs/:slug/install`).
   - Apply the composition (`/api/v1/packages/:id/deploy`).
   - Emit a `tenant.onboarded` event on the Event Fabric (ADR-001).

See `memory-bank/onboarding.md` for the wizard flow and
`memory-bank/common-patterns.md §"Add a new seed catalogue"` for adding
new pack types.

---

## 5. Marketplace tabs

Per the controller's swagger, the 8 tabs are:
1. **Solutions** — `SolutionPack` list.
2. **Agent Templates** — `AgentTemplate` list.
3. **Connectors** — connector list.
4. **Workflows** — workflow list.
5. **Knowledge Packs** — knowledge pack list.
6. **Industries** — industry bundles.
7. **Departments** — department templates.
8. **Tiers** — tier templates.

Item counts feed the tab badges. MarketplaceService caches counts in Redis
with a short TTL.

---

## 6. RBAC + audit

| Action | Role |
|---|---|
| Browse marketplace | any tenant user |
| `POST /api/v1/solution-packs/:slug/install` | OWNER or ADMIN (per RBAC §4.11) |
| `DELETE /api/v1/solution-packs/:slug` | OWNER or ADMIN |
| Create solution pack | SUPER_ADMIN or PLATFORM_ADMIN |
| Publish solution pack | PLATFORM_ADMIN |
| Apply PackageComposition to tenant | TENANT_ADMIN |
| Marketplace `/docs-json` | public (third-party devs) |

Every install / uninstall is logged to `PackInstallation` (or
`SolutionPackInstall`) and visible via
`GET /api/v1/solution-packs/installed/history`.

---

## 7. Frontend

- **`frontend-tenant/src/app/marketplace/`** — `/marketplace` landing.
  Renders tabs + item cards.
- **`services/marketplace.service.ts`** (if present) — wraps the API.
- **Admin** counterparts:
  - `/admin/packages` — Pool #6 admin (CRUD + composition).
  - `/admin/solution-packs` — pack library.
  - `/admin/agent-templates`, `/admin/connectors`,
    `/admin/industries`, etc. — individual tab admins.

---

## 8. Seed scripts

Under `backend/prisma/`:
- `seed-platform-templates.cjs` — base templates.
- `seed-package-catalogue.cjs` — base package catalogue.
- `seed-industry-packages.cjs` — industry-specific packages.
- `seed-industry-*.cjs` (6 scripts) — industry template bundles.
- `seed-business-composition.cjs` — six-pool composition row seed.
- `seed-accounting-packages.cjs` — accounting solution pack.

`pnpm seed:industry-packages[:check]`, `pnpm seed:platform-templates`.

---

## 9. Common failures + fixes

| Symptom | Likely cause |
|---|---|
| 401 on `GET /marketplace/...` | Cookie not attached (browser issue) |
| 403 on install | Wrong role; need OWNER or ADMIN per RBAC §4.11 |
| 409 on install | Already installed; uninstall first |
| 422 on deploy | Composition invalid (missing reference) |
| Marketplace count drift | Redis cache stale; restart backend or wait for TTL |

---

## 10. How to publish a new Solution Pack

1. Create the pack in the admin UI (`/admin/solution-packs → Create`).
2. Bundle references to existing `AgentTemplate`, `DepartmentTemplate`,
   `ProjectType`, `WorkflowTemplate`, `KnowledgePack` IDs.
3. Set `category`, `tierRequired`, `status='draft'`.
4. Test via `GET /api/v1/solution-packs/:slug/preview` for a tenant.
5. Move to `beta` and install on a staging tenant.
6. When ready, `POST /api/v1/solution-packs/:id/publish`.
7. Optionally list on the marketplace (admin action).

---

## 11. Source pointers

- `backend/src/modules/packages/`
- `backend/src/modules/solution-packs/`
- `backend/src/modules/marketplace/`
- `backend/src/modules/tenant-templates/`
- `backend/src/modules/onboarding/` (allocator)
- `backend/prisma/schema.prisma` (`SolutionPack`, `Package`,
  `PackInstallation`, `TenantInstalledPack`, `MarketplaceListing`)
- `frontend-tenant/src/app/marketplace/`
- `frontend-admin/src/app/packages/`, `/admin/solution-packs/`
- `memory-bank/onboarding.md`