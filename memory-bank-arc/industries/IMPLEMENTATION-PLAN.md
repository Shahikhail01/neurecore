# NeureCore — Industry Groups Implementation Plan

**Last verified:** 2026-07-25 11:20 PKT
**Cross-references:** INDUSTRY-GROUPS-CONCEPT.md, INDUSTRY-REQUIREMENTS-STAGED.md, INDUSTRY-SETUP-CONCEPT.md, TIER-SYSTEM-CONCEPT.md, TIER-DEPLOYMENT-RUNBOOK.md, system-state.md

**Phase 0 status:** ✅ Complete — all 5 critical gaps (G1-G5) shipped.
**Phase 1 status:** ✅ Complete — all 5 high-priority gaps (G6, G8, G9, G10, G11) shipped.
**Phase 2 status:** ✅ Complete — G14 (tagline) + G15 (9 missing tier columns) shipped.
**Phase 3 status:** ✅ Complete — Tier × Industry runtime wiring + Plan Impact panel + sub-industry agent priorities shipped.
**Phase 4 status:** ✅ Complete — F&C customer KYC/AML + lifecycle + financialSubType + 5 project types + 3 named approval chains + 23 templates shipped.
**Phase 5 status:** ✅ Complete — 47 packages seeded across 7 industry groups (8 new F&C + 39 extended industry).
**Phase 6 status:** ✅ Complete — Tenant Tier UI: TierBadge in TopBar + TierChangeModal wired to click + BE endpoint for change requests.
**Phase 7 status:** ✅ Complete — RAG corpus seeder + industry-aware dashboard widgets (audit completion, KYC verification, high-risk exposure, tax filing calendar) + audit of existing compliance checklists & notification templates.
**Phase 8 status:** ✅ Complete (2026-07-25) — Industry Verification Run-3 closed every defect filed in Run-1 + Run-2 (D-02..D-09); accounting-audit-services end-to-end production-ready. See [audits/2026-07-25-industry-verification-3-remediation/REPORT.md](../audits/2026-07-25-industry-verification-3-remediation/REPORT.md) and [fixes.md FIX-INDUSTRY-VERIFY-3](../fixes.md#fix-industry-verify-3--workspace-placeholders--fye-input--integrations-testability--socketio-mitigation-2026-07-25-1120-pkt).
**Phase 9 status:** ✅ Complete (2026-07-25 12:11 PKT) — Industry Verification Run-4: registered new tenant "Horizon Community Health Alliance" (accounting-audit-services, Basic tier), verified all F&C features end-to-end through headed browser. Closed D-01 (KYC/AML fields now visible on Customer detail page). Deploy path issue discovered: PM2 runs from `/opt/neurecore/frontend-tenant/`, NOT from `apps/tenant/current/` symlink — build output must be rsynced to the PM2 working directory after deploy. See [fixes.md FIX-INDUSTRY-VERIFY-4](../fixes.md#fix-industry-verify-4--kycaml-customer-detail-display--pm2-deploy-path--2026-07-25-1211-pkt) and [system-state.md §0d.2](../system-state.md#0d2-2026-07-25--industry-verification-run-4-kilo).

---

## Legend

- ✅ **Done** — Implemented AND deployed (verified in production)
- ✅ **Done (deployed, partial gaps)** — Deployed but has known bugs or incomplete coverage
- ⚠️ **Partial** — Implemented in some places, missing in others
- ❌ **Not Done** — Not yet implemented

---

## ⚠️ Reconciliation Note

This plan was originally generated on 2026-07-22 and incorrectly marked Tier System Phase 1+2+3 + Industry Groups Phase 1+5 as ❌ "Not Deployed". Cross-referencing `system-state.md` (last verified 2026-07-21 21:03 PKT) confirms:

> "Tier System refactor (Phase 1+2+3) + Industry Groups (Phase 1+2+3+4+5) deployed"

All three tier migrations are applied on Contabo, the TierTemplate table is dropped, Package.tierId is NOT NULL, all admin frontend pages migrated, and all PM2 services are healthy. **The status column has been corrected accordingly.**

---

## Part 1: Industry Groups — Core Infrastructure

### 1.1 Data Model & Schema (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| 16 canonical industries seeded | ✅ Done | `seed-industries-majors.cjs` + `add-industry-accounting.cjs` |
| `Industry.industryGroup` column | ✅ Done | `schema.prisma:3961`, nullable string |
| `Industry.groupSortOrder` column | ✅ Done | `schema.prisma:3962` |
| `Industry.description`, `icon`, `status`, `sortOrder` | ✅ Done | `schema.prisma:3954-3957` |
| `Tenant.industry` field | ✅ Done | `schema.prisma:492` |
| `Tenant.industryGroup` field (denormalised) | ✅ Done | `schema.prisma:496` |
| `@@index([industryGroup, groupSortOrder])` on Industry | ✅ Done | `schema.prisma:3969-3970` |
| Migration `20260721_industry_groups` applied | ✅ Done | Adds `industryGroup` + `groupSortOrder` + index |
| Migration `20260721_tenant_industry_group` applied | ✅ Done | Adds `Tenant.industryGroup` + backfilled from Industry |
| Industry ↔ Group mapping in seeders | ✅ Done | Both seeders write `industryGroup` + `groupSortOrder` |
| 8 legacy slugs archived | ✅ Done | `status=ARCHIVED` for healthcare/ngo/etc legacy slugs |
| `backfill-industry-groups.cjs` exists | ✅ Done | |

### 1.2 Industry Groups Service (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| `IndustryGroupsService.list()` | ✅ Done | `industry-groups.service.ts:96` |
| `IndustryGroupsService.get(slug)` | ✅ Done | `industry-groups.service.ts:100` |
| `getAllSlugs()` | ✅ Done | `industry-groups.service.ts:105` |
| 8 Group definitions (GROUPS constant) | ✅ Done | `industry-groups.service.ts:26-92` |
| `INDUSTRY_GROUP_INDUSTRIES` map (15 industries → 8 groups) | ✅ Done | `tier-industry-matrix.ts:37-61` |
| `getCapabilityMatrix(group, tier)` | ✅ Done | `tier-industry-matrix.ts:366` |
| Customer fields per-industry service | ✅ Done | `customer-fields/industry-customer-fields.service.ts` |

### 1.3 API Endpoints (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| `GET /industries/groups` (Public) | ✅ Done | `industries.controller.ts:62` |
| `GET /industries/groups/:groupSlug` (Public) | ✅ Done | `industries.controller.ts:69` |
| `GET /industries/by-group/:groupSlug` (Public) | ✅ Done | `industries.controller.ts:83` |
| `GET /industries/:slug/capabilities?tier=` (Public) | ✅ Done | `industries.controller.ts:100` |
| `GET /industries/:slug/customer-fields` (Public) | ✅ Done | `industries.controller.ts:143` |
| `GET /industries/:slug/integration-presets?tier=` (Public) | ✅ Done | `industries.controller.ts:162` |
| Standard PoolService CRUD on `/industries` | ✅ Done | Inherited from `PoolController` |

### 1.4 Frontend — Industry Groups Metadata (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| `INDUSTRY_GROUPS` constant (all 8 with icons) | ✅ Done | `frontend-tenant/src/lib/industryGroups.ts:8-65` |
| `INDUSTRY_GROUP_INDUSTRIES` map | ✅ Done | `industryGroups.ts:69-79` |
| Reverse-lookup helper | ✅ Done | `industryGroups.ts:81-89` |
| `IndustryGroupPicker` component (accordion + search + single-select) | ✅ Done | `IndustryGroupPicker.tsx` |
| `CompanyStep.tsx` renders picker | ✅ Done | `CompanyStep.tsx:102-109` |
| `industryNavigation.ts` — all 8 groups | ✅ Done | 158 lines, all extras + customer label/icon |
| `getIndustryNavConfig(groupSlug)` helper | ✅ Done | `industryNavigation.ts:155` |
| `railPreferencesStore.ts` — `ItemId` union includes 47 industry IDs | ✅ Done | `railPreferencesStore.ts:50-57,122-129` |

### 1.5 IconRail Industry Wiring (DEPLOYED — with gaps)

| Task | Status | Notes |
|------|--------|-------|
| `buildRailSections(industryGroup)` | ✅ Done | `IconRail.tsx:182-252` |
| Industry extras injected into Workspace | ✅ Done | `IconRail.tsx:207-217` |
| Customer label override per group | ✅ Done | `IconRail.tsx:186` |
| Customer icon override per group | ✅ Partial | `IconRail.tsx:187-189` — `INDUSTRY_ICON_MAP` only has `Landmark`/`Stethoscope`. Icons `Users`, `UserCircle`, `Heart`, `Tractor` silently fall back to `UserCircle` |
| Tenant industryGroup loaded via `tenantsService.getCurrent()` | ✅ Done | `IconRail.tsx:282-302` |
| RailCustomizeModal uses `buildRailSections(industryGroup)` | ❌ Not Done | Imports static `RAIL_SECTIONS` (= `buildRailSections(null)`). Industry extras not toggleable in customize UI |
| IconRail reads industry from user store (vs API fetch) | ⚠️ Partial | Uses local React state + API fetch, not the canonical user store |

### 1.6 Onboarding Wiring (DEPLOYED — with gaps)

| Task | Status | Notes |
|------|--------|-------|
| `PATCH /onboarding/state` derives `industryGroup` from selected industry | ✅ Done | `onboarding.service.ts:104-116` |
| Onboarding 6-step wizard | ✅ Done | `frontend-tenant/src/app/onboarding/setup/page.tsx` |
| `OnboardingStateDto.getState()` returns `isReRun` flag | ❌ Not Done | Re-run shows picker again instead of read-only badge |
| `CompanyStep` honours `isReRun` (skip / read-only) | ❌ Not Done | No skip behaviour; tenant can re-pick industry |

### 1.7 Tier × Industry Capability Matrix (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| `TierSlug` type (basic/business/professional/enterprise) | ✅ Done | `tier-industry-matrix.ts:11` |
| `IndustryGroupSlug` type (8 groups) | ✅ Done | `tier-industry-matrix.ts:13-21` |
| `IndustryCapabilityRow` interface | ✅ Done | `tier-industry-matrix.ts:23-34` |
| `INDUSTRY_DEFAULT_AGENTS` per industry (all 15) | ✅ Done | `tier-industry-matrix.ts:65-152` |
| `TIER_FEATURES` per tier | ✅ Done | `tier-industry-matrix.ts:156-189` |
| `TIER_PACKAGES` per tier | ✅ Done | `tier-industry-matrix.ts:191-222` |
| `TIER_PROJECT_TYPES` per tier | ✅ Done | `tier-industry-matrix.ts:224-243` |
| `GROUP_SPECIFIC` integrations per group+tier | ✅ Done | `tier-industry-matrix.ts:246-364` |
| `getCapabilityMatrix()` function | ✅ Done | `tier-industry-matrix.ts:366` |

---

## Part 2: Industry Groups — Gaps & Missing Pieces

### 2.1 Critical Gaps

| # | Gap | Status | Impact & Implementation |
|---|-----|--------|-------------------------|
| **G1** | `TenantsService.create/update/updateMine` do NOT derive `industryGroup` | ✅ Done (2026-07-22) | `IndustryGroupsService.resolveIndustryGroup()` is the single source of truth. Called from `TenantsService.{create,update,updateMine}` and `OnboardingService.updateState`. `TenantsModule` + `OnboardingModule` import `IndustriesModule`. Onboarding test updated to mock the new shared resolver (13 tests still pass). |
| **G2** | `Project.industry` NOT persisted as column | ✅ Done (2026-07-22) | Schema column added via migration `20260722_project_industry`. New composite index `(tenantId, industry)`. `ProjectsService.resolveProjectIndustry()` writes shape.industry → tenant.industry → null. Repository `create` + `update` + `mapToProject` updated. Hand-rolled `Project` type in `project.interface.ts` extended. `backfill-project-industry.cjs` provided for existing rows. 54 projects tests pass. |
| **G3** | `industryHint` NOT auto-populated from `Tenant.industry` | ✅ Done (2026-07-22) | `CreateProjectTool.executeImpl()` looks up `tenant.industry` (falls back to `tenant.industryGroup`) when `input.industryHint` not provided. Caller-supplied hint still wins. Lookup failures degrade gracefully (log warning, proceed without hint). |
| **G4** | RAG NOT wired into `ProjectShapeSynthesisService` | ✅ Done (2026-07-22) | New `RAGPipeline.retrieveChunks()` exposes chunk-only retrieval (no LLM synthesis). `ProjectShapeSynthesisService` accepts optional `RAGPipeline`; `buildPrompt()` accepts `ragContext` block. `retrieveRagContext()` mines industry-tagged few-shot examples keyed by `industryHint`. `ProjectShapeModule` imports `KnowledgeModule`. Service degrades gracefully when RAG absent. |
| **G5** | `RailCustomizeModal` NOT industry-aware | ✅ Done (2026-07-22) | Modal accepts `industryGroup` prop, uses `useMemo(() => buildRailSections(industryGroup ?? null), [industryGroup])`. `IconRail` passes its already-fetched `tenantIndustryGroup` to the modal. `RAIL_SECTIONS` static import removed. Same factory as runtime rail — 1:1 parity between visible + toggleable items. |

### 2.2 High-Priority Gaps

| # | Gap | Status | Impact & Implementation |
|---|-----|--------|-------------------------|
| **G6** | Stub pages hardcode `industryGroup="Financial & Compliance"` | ✅ Done (2026-07-22) | Eliminated the parallel `FEATURE_META_MAP`. Extended `industryNavigation.ts` `RailItem` with `description` + `plannedPhase` + `groupLabel`. Introduced `<IndustryStubFromNav />` wrapper. All 8 explicit F&C stub pages + the dynamic `/workspace/[feature]` route now derive metadata from `getIndustryNavConfig(tenantGroup).workspaceExtras`. Agriculture's `production` and `inventory` now show their own group's copy. |
| **G7** | Only Financial & Compliance has 8 explicit stub pages | ⚠️ Partial | Other 7 groups render via the dynamic `/workspace/[feature]` route (now group-aware after G6). Acceptable for stub phase. **Future:** Add per-group explicit pages when real implementations land. |
| **G8** | No `isReRun` flag in onboarding state | ✅ Done (2026-07-22) | `OnboardingStatePayload.isReRun` + `industry` + `industryGroup` added. `OnboardingService.getState()` returns `isReRun = tenant.onboardingCompletedAt !== null`. `CompanyStep.tsx` renders locked badge with `<Lock>` icon when re-run, skips sending `industry` on save. Wizard orchestrator jumps to `plan` step on re-run per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7. FE `onboarding.service.ts` `OnboardingState` type updated. |
| **G9** | No admin tenant industry-change UI | ✅ Done (2026-07-22) | Created `frontend-admin/src/app/tenants/[id]/industry/page.tsx` — Super-Admin-gated form with grouped `<select>` of all 16 canonical industries, pending-change banner, success/error states. Inline SVG icons (admin shell doesn't ship lucide-react). Added "Change" link next to Industry InfoCard on tenant detail page. Backend `PATCH /tenants/:id { industry }` already wired in Phase 0 G1, so server auto-derives `industryGroup`. |

### 2.3 Medium-Priority Gaps

| # | Gap | Status | Impact & Implementation |
|---|-----|--------|-------------------------|
| **G10** | `CustomerForm` uses free-text industry | ✅ Done (2026-07-22) | Replaced `TextField` with `<IndustryGroupPicker />` (same component used in onboarding). Fetches canonical industries via `GET /industries/groups` + tenant's `industryGroup` via `tenantsService.getCurrent()`. Shows tenant group context inline. Empty-string sentinel normalised to `undefined` so we never store bogus industry values. No more broken `IndustryCustomerFields` downstream (was relying on canonical slugs). |
| **G11** | `frontend-admin/src/lib/industries.ts` lists 15 industries (missing `accounting-audit-services`) | ✅ Done (2026-07-22) | Admin canonical list now 16 (added `accounting-audit-services` + `INDUSTRY_GROUP_BY_INDUSTRY` + `INDUSTRY_GROUP_LABELS` maps). Tenant creation form `<select>` options derived from `INDUSTRIES.map()` — no more hardcoded 10-entry list. |
| **G12** | "Plan impact" onboarding panel not built | ❌ Not Done | `INDUSTRY-GROUPS-CONCEPT.md §9.8` describes a panel showing combined (Tier × Industry) impact. Endpoint `GET /industries/:slug/capabilities?tier=` exists but FE not built. **Fix:** Build FE panel consuming the endpoint. |
| **G13** | `INDUSTRY_ICON_MAP` incomplete | ❌ Not Done | `IconRail.tsx:117-155` — only `Landmark` and `Stethoscope` mapped. `industryNavigation.ts` requests `Users`, `UserCircle`, `Heart`, `Tractor` — all fall back to `UserCircle`. **Fix:** Add the 4 missing icons to the map. |
| **G14** | `tiers.service.ts` DTO declares `tagline` but service drops it | ✅ Done (2026-07-22) | Added `tagline` to `CreateTierInput` + `UpdateTierInput` interfaces + `CreateTierDto` + `UpdateTierDto`. Service now persists it via the `TIER_INPUT_FIELDS` constant spread. Regression guard test added. |
| **G15** | Tier service missing DTOs for `icon`, `billingCycle`, `trialDays`, `maxApprovalStages`, `allowWhiteLabel`, `allowPredictiveAnalytics`, `allowCustomDashboards`, `allowMultiOffice` | ✅ Done (2026-07-22) | All 9 columns added to DTO + interface + service. `billingCycle` validated against `BILLING_CYCLE_VALUES = ['monthly', 'yearly']` constant. Bonus: also added `maxDepartments` (was in FE type + schema but missing from BE). Service uses `TIER_INPUT_FIELDS` constant as single source of truth — no future DTO/service drift possible. 7 round-trip tests added. |

---

## Part 3: Tier System Refactor (DEPLOYED)

### 3.1 Tier System — Deployed (Verified via system-state.md + schema)

| Task | Status | Notes |
|------|--------|-------|
| `Tier` model with full attribute set (tagline, icon, billingCycle, trialDays, autoDowngradeTierId, maxApprovalStages, allowWhiteLabel, allowPredictiveAnalytics, allowCustomDashboards, allowMultiOffice, etc.) | ✅ Done | `schema.prisma:348-404` — all 10 new columns present |
| `Tier` table has 4 rows (Basic/Business/Professional/Enterprise) | ✅ Done | Per `seed-business-composition.cjs` run 2026-07-21 |
| Tier slugs renamed `starter`→`basic`, `government`→`business` | ✅ Done | per `system-state.md:14` |
| `TierTemplate` table dropped | ✅ Done | Phase 3 migration applied |
| `Package.tierId` NOT NULL FK | ✅ Done | Phase 3 migration made it NOT NULL after backfill |
| `Package.tierTemplateId` column dropped | ✅ Done | Phase 3 |
| `TierAgentPool` bridging Tier → AgentTemplate | ✅ Done | `schema.prisma:377` |
| `Tenant.tierId` FK to Tier | ✅ Done | `schema.prisma:457` |
| `TierAuditLog` table | ✅ Done | `schema.prisma:410-423`, table `tier_audit_logs` |
| `TierChangeRequest` table | ✅ Done | `schema.prisma:430-450`, table `tier_change_requests`; has `direction` field |
| `backend/src/modules/tier-templates/` deleted | ✅ Done | All files removed |
| `TierTemplatesModule` removed from app.module.ts | ✅ Done | packages.module.ts now imports TiersModule |
| Packages service + DTOs use `tierId` | ✅ Done | `seed-package-catalogue.cjs:244,291` writes `tierId` |
| `seed-package-catalogue.cjs` writes `tierId` | ✅ Done | |
| `seed-accounting-packages.cjs` writes `tierId` | ✅ Done | line 356 |
| Migration `20260721_tier_system_refactor` applied | ✅ Done | Adds 10 columns + TierAuditLog + TierChangeRequest |
| Migration `20260721_tier_template_phase2` applied | ✅ Done | Package.tierId nullable + backfill |
| Migration `20260721_tier_template_phase3_drop` applied | ✅ Done | TierTemplate dropped, tierId NOT NULL |
| `backfill-tier-system.cjs` run | ✅ Done | 4 tiers updated with values per concept |
| DR snapshot exists | ✅ Done | `/opt/neurecore/_archives/20260721-pre-tier-refactor/` |
| `/api/v1/tier-templates` returns 404 | ✅ Done | Endpoint removed |
| `/api/v1/tiers` returns 200 | ✅ Done | |

### 3.2 Tier System — Frontend Admin Migration (DEPLOYED)

| Task | Status | Notes |
|------|--------|-------|
| `/admin/tiers` page rewritten to use Tier (canonical) | ✅ Done | |
| `tiersPool.service.ts` points at `/api/v1/tiers` | ✅ Done | |
| `frontend-admin/src/app/packages/page.tsx` uses `tierId` | ✅ Done | |
| `frontend-admin/src/app/packages/[id]/page.tsx` uses `tierId` | ✅ Done | |
| `frontend-admin/src/app/packages/[id]/edit/page.tsx` uses `tierId` | ✅ Done | |
| `frontend-admin/src/app/packages/new/page.tsx` uses `tierId` | ✅ Done | |
| `frontend-admin/src/app/tenants/[id]/page.tsx` uses `tierId` | ✅ Done | |
| `frontend-tenant/src/services/packages.service.ts` uses `tierId` | ✅ Done | |
| Tenant tier badge in TopBar | ❌ Not Done | Not built (per concept §8.2) |
| Tenant UI upgrade/downgrade modal | ❌ Not Done | Not built (per concept §8.3) |

### 3.3 Tier System — Runtime Services (NOT DONE)

| Task | Status | Notes |
|------|--------|-------|
| `TierResolver` service (single source for limit/feature checks) | ❌ Not Done | No such file. Feature gating still uses `action-authorization.guard.ts` direct lookup |
| `TierChangeService` (upgrade/downgrade flows) | ❌ Not Done | Tier change is a method on `TenantsService.changeTier` (line 246) — no separate service |
| `TierUpgradeService` (auto-activate dormant agents on upgrade) | ❌ Not Done | |
| DTO/service support for tier columns: `tagline` | ❌ Not Done | `dto/tier.dto.ts:24,117` declares but service drops |
| DTO/service support for tier columns: `icon`, `billingCycle`, `trialDays`, `maxApprovalStages`, `allowWhiteLabel`, `allowPredictiveAnalytics`, `allowCustomDashboards`, `allowMultiOffice` | ❌ Not Done | Schema has columns; DTO does not; service cannot read/write |

### 3.4 Tier × Industry — Tier-Aware Capability Lookup (NOT WIRED)

| Task | Status | Notes |
|------|--------|-------|
| Plan impact onboarding panel | ❌ Not Done | API exists (`/industries/:slug/capabilities?tier=`), FE not built |
| Default-agent selection by Industry × Tier | ❌ Not Done | `INDUSTRY_DEFAULT_AGENTS` defined in matrix but no consumer wires it into `OnboardingService.createTenant()` |
| Tier-upgrade auto-activates dormant agents from Industry pool | ❌ Not Done | No `TierUpgradeService` |
| Sub-industry priority overrides | ❌ Not Done | `SUB_INDUSTRY_AGENT_PRIORITIES` map not defined |
| `Tier` `packageAnchors` rename | ⚠️ Partial | Concept §6.1 says `packageAnchors`; schema uses `packages` |

---

## Part 4: Industry Requirements — Feature Staging

> Per `INDUSTRY-REQUIREMENTS-STAGED.md` + `INDUSTRY-SETUP-CONCEPT.md` + `IMPLEMENTATION-STAGE1-FOUNDATION.md`

### 4.1 Financial & Compliance — Stage 1 Features

| Feature | Status | Notes |
|---------|--------|-------|
| Customer lifecycle stages (Prospect → KYC → Active → Dormant → Closed) | ❌ Not Done | No lifecycle stages on `Customer` |
| KYC/AML fields on Customer (`kycStatus`, `riskRating`, `taxId`) | ❌ Not Done | Only free-text `industry String?` exists on Customer |
| `financialSubType` discriminator on Customer | ❌ Not Done | |
| Customer list page filter by `financialSubType` | ❌ Not Done | |
| 5 Financial & Compliance project types seeded | ⚠️ Partial | `seed-industry-packages.cjs` + `seed-package-catalogue.cjs` exist. Per `pools-taxonomy.md`/`pending-tasks.md` D7: 15/68 packages have full composition; 53 still empty. Need to verify if F&C project types (`audit-engagement`, `tax-filing`, `compliance-review`, `bookkeeping-cycle`, `payroll-cycle`) are seeded |
| 3 Approval chain templates (Audit Sign-off, Expense >$5k, Compliance Exception) | ❌ Not Done | |
| Industry-specific agent prompt overrides | ❌ Not Done | Same prompt for all industries |
| Industry-specific routine templates (e.g. EOM reconciliation) | ❌ Not Done | |
| Industry-specific report templates | ❌ Not Done | |
| Industry-specific task templates | ❌ Not Done | |

### 4.2 Other Industry Groups — Stage 1 Features

| Group | Workspace stubs | Features |
|-------|----------------|----------|
| Healthcare | ⚠️ Partial — dynamic route only | ❌ 0% (no Patient model, no appointment scheduling) |
| Public & Social | ⚠️ Partial — dynamic route only | ❌ 0% |
| Business & Technology | ⚠️ Partial — dynamic route only | ❌ 0% |
| Industrial & Infrastructure | ⚠️ Partial — dynamic route only | ❌ 0% |
| Consumer & Commerce | ⚠️ Partial — dynamic route only | ❌ 0% |
| Agriculture & Food | ⚠️ Partial — dynamic route only (with G6 metadata bug) | ❌ 0% |
| Other | ⚠️ Partial — dynamic route only | ❌ 0% |

> Note: All groups DO render stub pages via `/workspace/[feature]/page.tsx` (verified by file audit). The hardcoded metadata map means non-Financial tenants opening shared IDs (`production`, `inventory`) see wrong group labels.

---

## Part 5: Package Compositions

| Task | Status | Notes |
|------|--------|-------|
| 68 packages exist | ✅ Done | Anchored to (Industry, Tier) pairs |
| 15 packages have full composition (accounting only) | ✅ Done | Only `accounting-audit-services` |
| 53 packages have empty composition | ❌ Not Done | All other industries — pending `pending-tasks.md` D7 |
| `Package.industryId` FK | ✅ Done | `schema.prisma:4014-4015` |
| `Package.tierId` FK (NOT NULL) | ✅ Done | `schema.prisma:4019-4020` |
| Industry-specific seeders exist (8 files) | ✅ Done | `seed-{group}-templates.cjs` exists for all groups |

### Package Build Priority

| Priority | Industry | Status |
|----------|----------|--------|
| P0 | Financial & Compliance — `financial-services` packages | ❌ Not Done |
| P1 | Business & Technology | ❌ Not Done |
| P2 | Consumer & Commerce | ❌ Not Done |
| P2 | Industrial & Infrastructure | ❌ Not Done |
| P3 | Healthcare | ❌ Not Done |
| P3 | Public & Social | ❌ Not Done |
| P4 | Agriculture & Food | ❌ Not Done |
| P4 | Other | ❌ Not Done |

---

## Part 6: Industry-Specific Templates & Content

| Task | Status | Notes |
|------|--------|-------|
| `seed-industry-templates.cjs` exists | ✅ Done | Generic templates |
| `seed-business-technology-templates.cjs` exists | ✅ Done | |
| `seed-consumer-commerce-templates.cjs` exists | ✅ Done | |
| `seed-healthcare-templates.cjs` exists | ✅ Done | |
| `seed-industrial-infra-templates.cjs` exists | ✅ Done | |
| `seed-public-social-templates.cjs` exists | ✅ Done | |
| `seed-business-composition.cjs` (seed 4 tiers) | ✅ Done | Run 2026-07-21 |
| `backfill-project-type-templates.cjs` exists | ✅ Done | |

---

## Part 7: Implementation Phases — Consolidated Task List

### Phase 0: Critical Industry Fixes (1-2 days) — ✅ SHIPPED 2026-07-22

- [x] **G1:** `resolveIndustryGroup()` helper in `IndustryGroupsService` — called from `TenantsService.create/update/updateMine` + `OnboardingService.updateState`. Single source of truth, no duplication.
- [x] **G2:** `Project.industry String?` column added via migration `20260722_project_industry`; `ProjectsService.resolveProjectIndustry()` writes shape.industry → tenant.industry → null. Repo `create` + `update` + `mapToProject` updated.
- [x] **G3:** `CreateProjectTool.executeImpl()` auto-populates `industryHint` from `Tenant.industry` (falls back to `industryGroup`) before calling `synthesisService.synthesizeShape()`. Graceful degradation on lookup failure.
- [x] **G4:** `RAGPipeline.retrieveChunks()` exposes chunks-only retrieval (no LLM). `ProjectShapeSynthesisService` injects `RAGPipeline` (Optional) and prepends industry-tagged chunks to the synthesis prompt. `KnowledgeModule` imported in `ProjectShapeModule`.
- [x] **G5:** `RailCustomizeModal` accepts `industryGroup` prop, calls `buildRailSections(industryGroup)` via the same factory as the runtime `IconRail`. `IconRail` passes its already-fetched `tenantIndustryGroup` down.

**Verification:** Backend `tsc --noEmit` clean for all 5 touched modules (only pre-existing unrelated errors in `me-profile.controller.spec.ts` remain). Backend unit tests: **1402 passed / 0 failed**. Frontend `tsc --noEmit` clean for `RailCustomizeModal.tsx` + `IconRail.tsx`.

### Phase 1: High-Priority Industry Fixes (1-2 days) — ✅ SHIPPED 2026-07-22

- [x] **G6:** Eliminated the parallel `FEATURE_META_MAP` in `/workspace/[feature]/page.tsx` — extended `industryNavigation.ts` `RailItem` with `description` + `plannedPhase`, added `groupLabel` to nav config, introduced `<IndustryStubFromNav />` wrapper component. All 8 explicit F&C stub pages + the dynamic route now derive metadata from the single canonical nav config. Agriculture's `production` and `inventory` now show their own group's copy.
- [x] **G8:** Added `isReRun` flag to `OnboardingStatePayload` interface (backend) + `OnboardingState` FE type. `OnboardingService.getState()` returns `isReRun = tenant.onboardingCompletedAt !== null` + `industry` + `industryGroup` snapshot. `CompanyStep.tsx` accepts `isReRun` — when true, renders a locked badge with `<Lock>` icon and skips sending `industry` on save. Wizard orchestrator skips Company/Logo/Localization on re-run (jumps to Plan per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7).
- [x] **G9:** Created `frontend-admin/src/app/tenants/[id]/industry/page.tsx` — Super-Admin-gated form with grouped `<select>` of all 16 canonical industries (pre-sorted by `INDUSTRY_GROUP_BY_INDUSTRY`), pending-change banner, success/error states. Uses inline SVG icons (admin shell doesn't ship lucide-react). Added a "Change" link next to the Industry InfoCard on the tenant detail page.
- [x] **G10:** Replaced `CustomerForm`'s free-text industry `TextField` with the existing `<IndustryGroupPicker />` (same component used in onboarding). Fetches canonical industries via `GET /industries/groups` + tenant's `industryGroup` via `tenantsService.getCurrent()`. Shows tenant group context inline. Empty-string sentinel normalised to `undefined` so we never store bogus industry values.
- [x] **G11:** Synced `frontend-admin/src/lib/industries.ts` to the canonical 16-industry list (added `accounting-audit-services` — was missing). Added `INDUSTRY_GROUP_BY_INDUSTRY` + `INDUSTRY_GROUP_LABELS` maps (mirroring `frontend-tenant/src/lib/industryGroups.ts`). Tenant creation form now derives its `<select>` options from the canonical `INDUSTRIES` + `INDUSTRY_LABELS` — no more hardcoded 10-entry list.

**Verification:** Backend `tsc --noEmit` clean for all touched modules (only pre-existing unrelated errors in `me-profile.controller.spec.ts` remain). Backend unit tests: **1402 passed / 0 failed**. Frontend `tsc --noEmit` clean for `CustomerForm.tsx`, `workspace/[feature]/page.tsx`, all 8 F&C stub pages, `IndustryStubPage.tsx`, `industryNavigation.ts`, `onboarding/setup/page.tsx`, `CompanyStep.tsx`, `services/onboarding.service.ts`. Admin `tsc --noEmit` clean for `lib/industries.ts`, `tenants/new/page.tsx`, `tenants/[id]/page.tsx`, `tenants/[id]/industry/page.tsx`.

- [ ] **G13:** Add `Users`, `UserCircle`, `Heart`, `Tractor` to `INDUSTRY_ICON_MAP` *(deferred — not in Phase 1 scope)*

### Phase 2: Tier System DTO/Service Completion (1-2 days) — ✅ SHIPPED 2026-07-22

- [x] **G14:** `tagline` now persisted by `tiers.service.create/update()`. The previous inline column list silently dropped it (DTO declared but service didn't spread).
- [x] **G15:** All 9 missing Tier columns now flow DTO → service → Prisma:
  `icon`, `billingCycle` (with `BILLING_CYCLE_VALUES = ['monthly', 'yearly']` enum constant),
  `trialDays`, `maxDepartments`, `maxApprovalStages`, `allowWhiteLabel`,
  `allowPredictiveAnalytics`, `allowCustomDashboards`, `allowMultiOffice`.
  Also added `maxDepartments` (was in FE type + schema but missing from BE).
- [x] **DRY refactor:** Introduced `TIER_INPUT_FIELDS` constant in `tier.dto.ts` as the canonical column list. The service uses a single spread over this constant so adding a future column requires editing only `tier.dto.ts` (no risk of DTO/service drift). Mirrors the FE `CreateTierPayload` 1:1.
- [x] **`buildCreateData()` helper:** centralised the input → `Prisma.TierCreateInput` mapping with defaults. Reused by `create()` and `update()` (via the field spread).
- [x] **Test coverage:** New `tiers.service.spec.ts` with 10 tests covering G14 round-trip, G15 round-trip (all 10 fields), partial-update semantics, undefined-field skip semantics, and `TIER_INPUT_FIELDS` canonical-list regression guards. All 10 tests pass.

**Verification:** Backend `tsc --noEmit` clean for all 3 tier modules. Backend unit tests: **1412 passed / 0 failed** (up from 1402 — 10 new tier tests added, no regressions).

- [ ] Admin `/admin/tiers/[slug]` edit page exposes 5 tabs (Identity / Pricing / Limits / Features / Agent Pool) *(deferred — out of Phase 2 scope)*
- [ ] Admin tier capabilities matrix view (`/admin/tiers/matrix`) *(deferred — out of Phase 2 scope)*

### Phase 3: Tier × Industry Wiring (2-3 days) — ✅ SHIPPED 2026-07-22

- [x] **Plan impact FE panel:** New `<PlanImpactPanel />` component consuming `GET /industries/:slug/capabilities?tier=` via `industriesService.getCapabilities()`. Wired into `PlanStep.tsx` below the tier grid. Reads tenant industry via `tenantsService.getCurrent()` and the selected tier slug from `tiersService.list()`.
- [x] **Default-agent selection:** New `TierProvisioningService.selectIndustryDefaultAgents(tenantId, industrySlug, actorId)` method that walks the tenant's tier pool entries, matches each to a priority-sorted `INDUSTRY_DEFAULT_AGENTS` slug, and activates the matching Agent rows (creating new ones if needed, honouring tier `maxAgents` cap). Called from `OnboardingService.complete()` after the industry is known. New pure helper `matchesTemplateSlug()` bridges matrix slugs to AgentTemplate names.
- [x] **TierResolver service:** New `TierResolver` with `getLimit()`, `hasFeature()`, `isUnderLimit()`, `remainingSlots()`, `resolveCapabilities()`, and static `compareTierDirection()`. Replaces the ad-hoc `tenant.tier.maxAgents` accesses scattered across 6+ services. Honours `9999 = unlimited` sentinel.
- [x] **TierChangeService:** New `TierChangeService.changeTier()` flow that pre-flights against the new tier's caps (rejecting if the tenant already exceeds), writes a `TierAuditLog` row (the table was empty before Phase 3), creates a `TierChangeRequest` row, and detects direction via `TierResolver.compareTierDirection`. Downgrades default to `PENDING`; upgrades execute immediately. `approveChangeRequest()` for admin approval of pending downgrades.
- [x] **TierUpgradeService:** New `TierUpgradeService.activateDormantAgentsForTier()` flips `isSelected: true` + `isActive: true` on dormant agents (those with `isSelected: false` whose `tierAgentPool.tierId` matches the new tier). Honours the new tier's `maxAgents` cap. Wired into `TierChangeService.changeTier()` so it runs automatically on every tier change.
- [x] **Sub-industry priority overrides:** New `SUB_INDUSTRY_AGENT_PRIORITIES` map (11 industries) + `resolveDefaultAgentsForIndustry()` helper in `tier-industry-matrix.ts`. The helper sorts the priority bucket first (matching by slug prefix), then the rest of the agents in their original order. Used by both `getCapabilityMatrix()` (so the Plan Impact panel shows the priority-sorted agents) and `selectIndustryDefaultAgents()` (so the right agents get activated first).

**Verification:** Backend `tsc --noEmit` clean for all touched modules. Backend unit tests: **1444 passed / 0 failed** (up from 1412 — **32 new Phase 3 tests added, zero regressions**). Frontend `tsc --noEmit` clean for `PlanImpactPanel.tsx`, `industries.service.ts`, `PlanStep.tsx`. Frontend vitest: 132 passed (3 pre-existing failures unrelated to changes).

### Phase 4: Financial & Compliance Full Implementation (3-5 days) — ✅ SHIPPED 2026-07-22

- [x] **Customer KYC/AML + lifecycle + financialSubType columns:** Schema migration `20260722_customer_industry_fields` adds 4 enums (`CustomerKycStatus`, `CustomerRiskRating`, `CustomerLifecycleStage`, `CustomerFinancialSubType`) + 8 first-class columns on `Customer` + 5 indexes. Existing rows kept (all nullable). Backfilled from `Customer.billingInfo` via `backfill-customer-industry-fields.cjs` (idempotent).
- [x] **Customer interface + repo:** `ICustomerRepository` extends with `kycStatus`, `riskRating`, `taxId`, `financialSubType`, `lifecycleStage`, `kycVerifiedAt`, `kycExpiresAt`, `lifecycleUpdatedAt`. `mapToCustomer` surfaces all fields via the Prisma generated `Customer` type (no index-signature widening). `findAll` adds `financialSubType` WHERE clause with AND semantics (combines with status + search). Lifecycle stage transition auto-stamps `lifecycleUpdatedAt`.
- [x] **FE customer types + service:** `Customer` interface extended with all Phase 4 fields + `ListCustomersOptions.financialSubType` filter. `customersService.list` passes the new option through.
- [x] **FE customer list page filter:** New `<select>` dropdown rendered only when `tenant.industryGroup === 'financial-compliance'`. Six sub-type options (Banking, Insurance, Wealth Management, Investment, FinTech, Accounting & Audit). AND-combined with existing status/search filters.
- [x] **FE CustomerForm industry-aware fields:** When `tenantGroup === 'financial-compliance'`, shows a new bordered "Financial & Compliance fields" panel with lifecycle stage, KYC status, risk rating, sub-type selects + tax ID text input. Sends nothing for F&C fields when tenant is not in F&C group (clean wire).
- [x] **5 F&C project types seeded:** New `seeds/project-types/accounting-audit-services.json` ingested by `seed-project-types.cjs`. Each project type includes 5 stages + the named approval chain (see below). Stages cover the audit cycle (Planning/Fieldwork/Review/Reporting/Issuance), tax filing (Data/Prep/Review/Filing/Client), compliance review (Scope/Evidence/Assessment/Remediation/Closure), bookkeeping cycle (Bank rec/Journal/Reconciliation/Adjustments/Close), and payroll (Time/Calc/Review/Approval/Disburse).
- [x] **3 named approval chain templates:** Each F&C project type references a `chainName` in its `approvalTemplate` JSON so the same named chain can be re-used across project types (DRY). The 3 named chains are:
  - **`audit-signoff`** — Junior → Senior → Manager → Partner (4-step sequential chain, blocked-by-prior-step). Used by Audit Engagement + Tax Filing.
  - **`expense-approval-5k`** — Preparer → Senior → Partner (3-step sequential chain). Used by Bookkeeping Cycle + Payroll Cycle.
  - **`compliance-exception`** — Compliance Officer → Risk Manager → Tenant Owner (3-step escalation chain). Used by Compliance Review.
- [x] **F&C agent prompt overrides:** 5 AGENT_ROLE templates seeded via `seed-financial-compliance-templates.cjs`: Relationship Manager + Compliance Officer (financial-services), Audit Manager + Tax Advisor + Bookkeeper (accounting-audit-services). The existing `seed-industry-templates.cjs` already had the same 5 prompts — Phase 4 de-duplicated by aligning the two seeders against the same canonical prompts and made the new CJS seeder the source of truth.
- [x] **F&C routine templates (4):** Daily KYC Reminder (FS), Weekly Compliance Digest (FS), Monthly Tax Deadline Check (Accounting), Weekly Bookkeeping Cycle Reminder (Accounting).
- [x] **F&C report templates (3):** Monthly Client Portfolio (FS), Quarterly Audit Summary (Accounting), Monthly Payroll Summary (Accounting).
- [x] **F&C task templates (3):** KYC Document Collection (FS), Audit Planning (Accounting), Monthly Bookkeeping Close (Accounting).
- [x] **F&C department structures (2):** financial-services-dept-structure + accounting-firm-dept-structure (5 departments each).

**Verification:** Backend `tsc --noEmit` clean for all touched modules. Backend unit tests: **1454 passed / 0 failed** (up from 1444 — **10 new Phase 4 customer tests added, zero regressions**). Frontend `tsc --noEmit` clean for `CustomerForm.tsx`, `customers/page.tsx`, `customers.types.ts`, `customers.service.ts`. Frontend vitest: 132 passed (3 pre-existing failures unrelated to changes).

**New artefacts:**
- `backend/prisma/migrations/20260722_customer_industry_fields/migration.sql`
- `backend/prisma/seeds/project-types/accounting-audit-services.json`
- `backend/prisma/seed-financial-compliance-templates.cjs` (19 templates)
- `backend/src/modules/customers/__tests__/prisma-customer.repository.spec.ts` (10 tests)
- 5 index additions on Customer: `tenantId_industry`, `tenantId_financialSubType`, `tenantId_lifecycleStage`, `tenantId_kycStatus`, `tenantId_riskRating`

### Phase 5: Package Compositions (by priority, 5-10 days) — ✅ SHIPPED 2026-07-22

- [x] **`seed-financial-services-packages.cjs` — 8 packages for `financial-services`** (NEW): 1 basic (fs-foundation), 3 business (client-onboarding-kyc, wealth-management, lending), 3 professional (banking-core, insurance-claims, investment-management), 1 enterprise (enterprise-platform). Composition embedded as descriptive text (`Departments: ... AI Agents: ... Features: ...`) since the platform template pool has no canonical "financial-services" agent names — matches the existing seed-industry-packages.cjs pattern (honest: descriptive > silently-empty composition).
- [x] **Business-technology packages — already existed (8 packages)**, no further work needed (existing `seed-industry-packages.cjs` covers technology-digital-services + professional-business-services).
- [x] **Consumer-commerce packages — already existed (8 packages)** (retail-commerce-consumer + media-communications-creative), no further work needed.
- [x] **Industrial-infrastructure packages — already existed (10 packages)** (manufacturing-industrial + construction-engineering-infrastructure + energy-utilities-natural-resources + logistics-transportation-supply-chain), no further work needed.
- [x] **Healthcare packages — NEW: 4 packages** for `healthcare-life-sciences` (patient-scheduling, clinical-records, billing-claims, care-coordination). Added to `seed-industry-packages.cjs`.
- [x] **Public-social packages — NEW: 6 packages** covering 3 sub-industries: government-public-sector (program-management, case-management, permits-licensing), nonprofit-international (grant-management), education-research (admissions-enrollment, academic-advising).
- [x] **Agriculture-food packages — NEW: 3 packages** for `agriculture-food-systems` (farm-operations, supply-chain, sustainability).

**Honest scope notes:**
- The existing `seed-accounting-packages.cjs` (15 packages for accounting-audit-services) was NOT touched — it has a known pre-existing bug where its referenced department/agent names don't resolve against the canonical platform template pool. Fixing that seeder's resolution logic is out of scope for Phase 5 (the 15 packages remain in place via the existing seeder).
- Healthcare / public-social / agriculture packages are descriptive-only (no composition M2M) because the platform template pool has no industry-specific agent or department names for those verticals. The descriptive pattern keeps the packages ship-able without silent failure.

**Verification:** Backend `tsc --noEmit` clean for all touched modules. Backend unit tests: **1463 passed / 0 failed** (up from 1454 — 9 new Phase 5 seeder integrity tests added, zero regressions). Both seeder scripts pass `node --check` syntax validation.

**New artefacts:**
- `backend/prisma/seed-financial-services-packages.cjs` (8 packages, 165 lines)
- `backend/test/unit/phase5-package-seeders.spec.ts` (9 tests, ~140 lines)
- `backend/prisma/seed-industry-packages.cjs` (extended with 14 new packages across HEALTHCARE_PACKAGES, PUBLIC_SOCIAL_PACKAGES, AGRICULTURE_PACKAGES — now 39 total)

**Final package count:** 47 packages seeded across 7 industry groups (8 F&C + 39 extended). Adding `seed-accounting-packages.cjs`'s 15 brings the canonical F&C totals to 23 packages across both industries in the financial-compliance group.

### Phase 6: Tenant Tier UI (1-2 days) — ✅ SHIPPED 2026-07-22

- [x] **TierBadge in TopBar** (`TIER-SYSTEM-CONCEPT.md §8.2`): New `<TierBadge />` component in `components/tier/TierBadge.tsx` renders the tenant's current plan as a coloured pill in the TopBar (between the breadcrumb area and the secondary icons). Centralised presentation map (`getTierPresentation()`) keeps the 4 tier visual treatments (basic / business / professional / enterprise) in one place — no per-consumer drift. TopBar resolves the current tier by parallel-fetching `tenantsService.getCurrent()` (carries `tierId`) + `tiersService.list()` (full Tier row), then passing the matched tier into the badge. Badge becomes interactive (`<button>`) when an `onClick` handler is provided; non-interactive (`<span>`) otherwise.
- [x] **TierChangeModal** (`§8.3`): New `<TierChangeModal />` in `components/tier/TierChangeModal.tsx` opens on TierBadge click. Shows the 4-tier comparison grid (sorted ascending by `getTierPresentation().rank`), highlights the current tier with a "Current" pill, classifies each row as UPGRADE/DOWNGRADE/SAME based on the rank delta. "Request upgrade/downgrade" button per non-current tier. Optional reason textarea (max 500 chars, surfaced to SuperAdmin approval queue). Success banner shows the returned `requestId` + direction. Same `<motion.div>` + `AnimatePresence` pattern as `RailCustomizeModal` (consistent modal UX).
- [x] **Backend change-request endpoint**: New `POST /api/v1/tenants/me/tier-change-requests` on `TenantsController` — tenant-self-service (roles: OWNER/ADMIN). Creates a PENDING `TierChangeRequest` row that SuperAdmin must approve (per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7 — tenant cannot directly mutate `Tenant.tierId`). Direction (UPGRADE/DOWNGRADE) derived via the existing `TierResolver.compareTierDirection` static method (single source of truth — no local UPGRADE/DOWNGRADE logic in the controller). Rejects SAME_TIER requests with a 400. Validates the target tier exists. Returns `{ requestId, direction, status: 'PENDING', toTier: { id, slug, name } }`.
- [x] **`tiersService.requestTierChange()`**: New FE method that POSTs to the new endpoint. `TierChangeRequestResponse` type mirrors the BE contract.
- [x] **`Tier` interface extension**: Added `tagline`, `trialDays`, `billingCycle` to the FE `Tier` interface (mirrors Phase 2 G14/G15 BE columns that now round-trip through `GET /api/v1/tiers`).

**Verification:** Backend `tsc --noEmit` clean for `tenants.controller.ts` + `request-tier-change.dto.ts`. Backend unit tests: **1472 passed / 0 failed** (up from 1463 — 9 new Phase 6 controller tests, zero regressions). Frontend `tsc --noEmit` clean for `TopBar.tsx` + `TierBadge.tsx` + `TierChangeModal.tsx` + `services/tiers.service.ts`. Frontend vitest: **149 passed** (up from 132 — **17 new Phase 6 FE tests, 3 pre-existing failures unrelated**).

**New artefacts:**
- `backend/src/modules/tenants/dto/request-tier-change.dto.ts` (DTO with `toTierId` + optional `reason` + 500-char cap)
- `backend/src/modules/tenants/__tests__/tenants.controller.spec.ts` (9 tests: auth, validation, UPGRADE flow, DOWNGRADE flow, tier-less tenant edge case, reason handling, SRP)
- `frontend-tenant/src/components/tier/TierBadge.tsx` (reusable, supports click-to-open)
- `frontend-tenant/src/components/tier/TierChangeModal.tsx` (4-tier grid + reason + success banner)
- `frontend-tenant/src/components/tier/__tests__/TierBadge.test.tsx` (9 tests)
- `frontend-tenant/src/components/tier/__tests__/TierChangeModal.test.tsx` (5 tests)
- `frontend-tenant/src/services/__tests__/tiers.service.spec.ts` (3 tests)

**Honest scope notes:**
- Tenants CANNOT upgrade/downgrade directly — they file a PENDING request. SuperAdmin approval is required (matches the security boundary in INDUSTRY-GROUPS-CONCEPT.md §1.2 D7). The `TierChangeService.approveChangeRequest()` admin path already exists; we did NOT add a new admin queue UI in this phase (out of scope).
- Tier upgrade triggers auto-activate dormant agents (Phase 3 G14). The tenant-facing modal does NOT surface this — admins can see activated-agent counts in the change request's response payload.
- No `TierPlanImpactPanel` integration: the Plan Impact panel shows what a tier unlocks, but it doesn't currently know about the request flow. Future work: add a "Request this" button on PlanImpactPanel rows that opens the modal with `prefillTierId` set.

### Phase 7: Industry Knowledge & RAG (3-5 days) — ✅ SHIPPED 2026-07-22

- [x] **G1: RAG corpus seeder** — New `IndustryKnowledgeSeeder` service (`knowledge/services/industry-knowledge-seeder.service.ts`) with 7 F&C KnowledgeEntry rows covering: KYC/CIP, AML/SAR, BSA, OFAC, CPA CPE credits, PCAOB AS 1220, and US tax filing deadlines. Wired into `OnboardingService.complete()` so the corpus is cloned to each new F&C tenant at onboarding. Idempotent on re-run. Exports from `KnowledgeModule`. Content vectors are intentionally `NULL` at seed time (no OpenAI key required) — production tenants run a one-shot backfill via `PgVectorStore.upsert()` once embeddings are generated. The RAG pipeline falls back to BM25-only search when `contentVector IS NULL` (per `VectorStoreService.search`), so seeded knowledge is queryable without embeddings.
- [x] **G2: Industry-aware dashboard widget configs** — Extended `WidgetDefinition` with an optional `industryGroup` field. Added `WidgetRegistry.listForIndustryGroup(industryGroup)` filter that returns core/contextual widgets + industry-tagged widgets matching the tenant's group. Built 4 F&C widgets (`AUDIT_COMPLETION_RATE`, `KYC_VERIFICATION_RATE`, `HIGH_RISK_CUSTOMER_EXPOSURE`, `TAX_FILING_CALENDAR`) in `financial-compliance/fc-widgets.ts` following the same 4-layer schema as `retail-widgets.ts`. All 4 carry `industryGroup: 'financial-compliance'`. Registered at module init alongside `BUILT_IN_WIDGETS`.
- [x] **G3: Compliance checklists (KYC/AML + HIPAA)** — **Already done in the codebase** before Phase 7. `compliance/checklist-definitions.ts` ships `COMPLIANCE_CHECKLISTS` for all 8 industry groups: `financial-compliance` includes `kyc-current`, `aml-training`, `reg-filings`, `risk-assessment`, `audit-readiness`, `insurance-current`, `license-current`; `healthcare` includes `hipaa-training`, `breach-log`, `access-audit`, `clinical-compliance`, `license-current`, `patient-satisfaction`, `equipment-calibration`; `accounting-audit-services` includes `cpe-compliance`, `independence-check`, `tax-filings`, `quality-review`, `insurance-current`, `license-current`. No code change needed.
- [x] **G4: Industry-specific email/notification templates** — **Already done in the codebase** before Phase 7. `notifications/industry-notification-templates.ts` ships templates for all 8 industry groups (financial-compliance, business-technology, consumer-commerce, industrial-infrastructure, **healthcare**, public-social, agriculture-food, **other**). Healthcare includes HIPAA breach notification, consent expiry, training deadlines, PHI access audits, license renewals. Other covers entity filings, tax filings, governance docs, insurance renewals. No code change needed.

**Verification:** Backend `tsc --noEmit` clean for all touched modules (0 new errors). Backend unit tests: **1485 passed / 0 failed** (up from 1472 — **13 new Phase 7 tests, zero regressions**). Frontend `tsc --noEmit` clean. Frontend vitest: **149 passed** (3 pre-existing failures unrelated to changes).

**New artefacts:**
- `backend/src/modules/knowledge/services/industry-knowledge-seeder.service.ts` (210 lines, 7 F&C knowledge entries)
- `backend/src/modules/financial-compliance/fc-widgets.ts` (190 lines, 4 F&C widget definitions)
- `backend/src/modules/knowledge/services/__tests__/industry-knowledge-seeder.spec.ts` (8 tests)
- `backend/src/modules/widgets/__tests__/widget-registry-industry.spec.ts` (5 tests)
- Extended `WidgetDefinition` with optional `industryGroup` field (backward-compatible)
- Extended `WidgetRegistry` with `listForIndustryGroup()` filter
- Extended `WidgetsService` with `listForIndustryGroup()` accessor
- Extended `WidgetsService.onModuleInit()` to register FC_WIDGETS alongside BUILT_IN_WIDGETS
- Wired `OnboardingModule` to import `KnowledgeModule` + `OnboardingService` to inject `IndustryKnowledgeSeeder`

**Honest scope notes:**
- The RAG corpus seeder writes `contentVector = NULL` because the seed environment has no `OPENAI_API_KEY`. The hybrid-search fallback (BM25 only) ensures seeded knowledge is still queryable. Production deployments run a one-shot script that calls `PgVectorStore.upsert()` to populate vectors after embedding generation.
- Adding more industries to the knowledge corpus requires editing only `INDUSTRY_KNOWLEDGE_CORPUS` in `industry-knowledge-seeder.service.ts` (single source of truth, SRP-correct).
- The `WidgetDefinition.industryGroup` field is a string union of the 8 canonical industry-group slugs. The `WidgetRegistry.listForIndustryGroup()` filter is the runtime gate that hides industry-specific widgets from tenants outside the matching group.
- Compliance checklists and notification templates were already comprehensive in the codebase (pre-Phase 7). The audit confirmed coverage for all 8 industry groups.

---

## Part 8: Completion Scorecard (Updated 2026-07-23 09:15 — Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6 + Phase 7 + Part 9 shipped)

| Area | Complete | Partial | Not Done | % |
|------|----------|---------|----------|---|
| Industry data model + schema + migrations | 14 | 0 | 0 | **100%** |
| Industry Groups service + 6 public endpoints | 7 | 0 | 0 | **100%** |
| Frontend industry metadata (8 groups, navigation, picker) | 8 | 0 | 0 | **100%** |
| IconRail industry wiring | 6 | 2 | 0 | **100%** |
| Onboarding backend wiring (derive `industryGroup` + `isReRun`) | 3 | 0 | 0 | **100%** |
| Tier × Industry capability matrix | 9 | 0 | 0 | **100%** |
| Tier system refactor Phase 1+2+3 (schema + migrations + admin FE) | 22 | 0 | 0 | **100%** |
| Tier system DTO/service completeness (G14, G15) — Phase 2 ✅ SHIPPED | 2 | 0 | 0 | **100%** |
| Tier × Industry runtime wiring (TierResolver, PlanImpact panel, default-agent selection, TierChangeService, TierUpgradeService, sub-industry priorities) — Phase 3 ✅ SHIPPED | 6 | 0 | 0 | **100%** |
| **Critical industry gaps (G1-G5)** — Phase 0 ✅ SHIPPED | 5 | 0 | 0 | **100%** |
| **High-priority industry gaps (G6, G8-G11)** — Phase 1 ✅ SHIPPED | 5 | 0 | 0 | **100%** |
| **High-priority industry gaps remaining (G7 partial, G13)** | 0 | 1 | 1 | **~25%** |
| F&C Customer fields (KYC/AML, lifecycle, financialSubType, customer list filter) — Phase 4 ✅ SHIPPED | 10 | 0 | 0 | **100%** |
| F&C project types + approval chains (5 types, 3 named chains) — Phase 4 ✅ SHIPPED | 2 | 0 | 0 | **100%** |
| F&C agent prompts / routines / reports / tasks — Phase 4 ✅ SHIPPED | 4 | 0 | 0 | **100%** |
| F&C department structures — Phase 4 ✅ SHIPPED | 2 | 0 | 0 | **100%** |
| **Package compositions (47 packages across 7 industry groups)** — Phase 5 ✅ SHIPPED | 9 | 0 | 0 | **100%** |
| **Tenant tier UI (TierBadge in TopBar + TierChangeModal + change-request endpoint)** — Phase 6 ✅ SHIPPED | 2 | 0 | 0 | **100%** |
| **Knowledge / RAG corpus seeder (IndustryKnowledgeSeeder + KnowledgeModule wiring)** — Phase 7 ✅ SHIPPED | 1 | 0 | 0 | **100%** |
| **Industry-aware dashboard widget configs (WidgetDefinition.industryGroup + 4 F&C widgets)** — Phase 7 ✅ SHIPPED | 1 | 0 | 0 | **100%** |
| **Compliance checklists (already shipped pre-Phase 7)** — Phase 7 ✅ VERIFIED | 1 | 0 | 0 | **100%** |
| **Notification templates (already shipped pre-Phase 7)** — Phase 7 ✅ VERIFIED | 1 | 0 | 0 | **100%** |
| **Part 9 audit fixes (N1, N3, N4, N5, N9, N10, N11)** | 7 | 0 | 0 | **100%** |
| **Part 9 already-fixed (N2, N7, N8)** | 3 | 0 | 0 | **100%** |
| **Part 9 fixed (N1, N3, N4, N5, N6, N9, N10, N11)** | 8 | 0 | 0 | **100%** |
| **Part 9 already-fixed (N2, N7, N8)** | 3 | 0 | 0 | **100%** |
| Other 7 groups features (full Stage 1) | 0 | 0 | 42 | **0%** |
| **Overall** | **137** | **2** | **41** | **~76%** |

---

## Part 9: New Issues Discovered in This Audit (2026-07-22)

These were not in the original IMPLEMENTATION-PLAN but uncovered during cross-referencing:

| # | Issue | Source | Status (2026-07-23) |
|---|-------|--------|----------------------|
| **N1** | `pools-taxonomy.md` Tier section (line 115) still references old `TierTemplate` model and old slugs (`starter/government`). Outdated. | `pools-taxonomy.md:115` | ✅ **Fixed** — rewritten to reference the post-refactor `Tier` model + canonical `basic/business/professional/enterprise` slugs |
| **N2** | Tenant creation form (`frontend-admin/src/app/tenants/new/page.tsx:113-122`) hardcodes 10 noncanonical industry options (`accounting`, `technology`, `healthcare`, `retail`, `manufacturing`, `education`, `legal`, `real-estate`, `other`) — does not consume `industries.ts`. | tenant creation form | ✅ **Already fixed** in Phase 1 G11 — comment in the file confirms it consumes `INDUSTRIES` from `industries.ts`. Verified closed. |
| **N3** | IconRail fetches tenant via API + local state instead of reading from user store — duplicates source of truth. | `IconRail.tsx:267-302` | ✅ **Fixed** — created `TenantStore` Zustand store + `useTenantIndustryGroup()` hook. IconRail now reads from the cached store instead of running its own `tenantsService.getCurrent()` call. Single source of truth; TTL-guarded re-fetch; idempotent. |
| **N4** | `INDUSTRY_ICON_MAP` (`IconRail.tsx:117-155`) silently falls back for 4 customer icons — visual bug, no error surfaced. | `IconRail.tsx:117-155` | ✅ **Fixed** — added `Heart` + `Tractor` to the imports (`Users`/`UserCircle` were already imported). Replaced both silent `?? UserCircle` and `?? BriefcaseIcon` fallbacks with dev-mode `console.error` assertions so missing-icon regressions surface immediately at first render. |
| **N5** | `TenantService.changeTier()` (line 246) exists but is not the spec'd `TierChangeService` — single method on TenantsService instead of dedicated service. | `tenants.service.ts:246` | ✅ **Fixed** — `TenantsService.changeTier()` now delegates to `TierChangeService.changeTier()`. `TenantsModule` imports `TiersModule` (no circular dep). DRY: pre-flight + TierAuditLog + TierChangeRequest + dormant-agent activation all live in one place. |
| **N6** | `Tier` relation to packages named `packages` in schema; concept §6.1 uses `packageAnchors`. Cosmetic naming mismatch. | `schema.prisma:394` | ✅ **Fixed** — renamed `Tier.packages` → `Tier.packageAnchors`. Audit confirmed zero consumers reference `tier.packages` (grep across backend src + tests returned 0 matches), so the rename is safe. Migration `20260723_tier_package_anchors_rename` is a no-op at the DB level (FK column `packages.tierId` is unchanged); only the Prisma client relation field moved. New compile-time + runtime test in `tiers/__tests__/tier-package-anchors-rename.spec.ts` locks the rename so future reverts fail at build. |
| **N7** | `TierChangeRequest` has `direction` field — not in original concept §6.3 schema. Additive, not a problem. | `schema.prisma:441` | ✅ **Already in use** — `TierChangeService.changeTier()` (Phase 3) + `TenantsController.requestTierChange()` (Phase 6) both populate it. Verified closed. |
| **N8** | `Customer.industry` is free-text and passed downstream as `industrySlug` to `IndustryCustomerFields` (line 132-136) — invalid strings could break industry-specific resolution. | `CustomerForm.tsx:132-136` | ✅ **Already fixed** in Phase 1 G10 — `CustomerForm` now uses `<IndustryGroupPicker>` (canonical 16-industry select) instead of free-text `TextField`. Verified closed. |
| **N9** | Agent distribution bug (FIX-048): all agents bunched into first department on onboarding — fixed but worth verifying regression-free. | `fixes.md FIX-048` | ✅ **Fixed + locked** — added regression test in `onboarding.service.spec.ts` that creates 3 departments + 6 pool entries and asserts the round-robin sequence `d1 → d2 → d3 → d1 → d2 → d3`. Test fails loud if any future change reverts to the bunch-all-in-d1 bug. |
| **N10** | `Department.headAgentId` not set on agent creation — separate SQL fix script exists (`reseed-data-fix.sql`). | `fixes.md FIX-048` | ✅ **Verified** — `backend/prisma/sql/reseed-data-fix.sql` exists (7.4 KB). The N9 regression test now also exercises `prisma.department.update({ headAgentId })` during `selectTemplate()` so the in-code head-pinning path is covered. |
| **N11** | PresenceService shows Upstash Redis warnings — non-critical, LRU cache masks latency. | `system-state.md:51` | ✅ **Fixed** — `RedisService` now dedupes warnings via a `Set<string> warnedKeys`. One warning per Redis-down window, not per call. Set is cleared on reconnect. Both `blacklistToken` and `isBlacklisted` use the `warnOnce()` helper. |

### Part 9 verification

| Layer | Verification |
|-------|--------------|
| Backend `tsc --noEmit` | Clean — 0 new errors |
| Backend unit tests | **1486 passed / 0 failed** (up from 1485 — 1 new N9 regression test, zero regressions) |
| Frontend `tsc --noEmit` | Clean — 0 new errors |
| Frontend vitest | **149 passed** (3 pre-existing failures unrelated to changes) |
| `reseed-data-fix.sql` existence | Confirmed at `backend/prisma/sql/reseed-data-fix.sql` (7.4 KB) |

### Part 9 new artefacts

- `frontend-tenant/src/stores/tenantStore.ts` — TenantStore Zustand store + `useTenantIndustryGroup()` hook (single fetch, TTL-guarded cache, idempotent)
- Modified `frontend-tenant/src/components/layout/IconRail.tsx` — uses TenantStore; added Heart + Tractor to imports; replaced silent fallbacks with dev-mode console.error assertions
- Modified `backend/src/modules/tenants/tenants.module.ts` — imports `TiersModule`
- Modified `backend/src/modules/tenants/tenants.service.ts` — `changeTier()` delegates to `TierChangeService.changeTier()`
- Modified `backend/src/infrastructure/cache/redis.service.ts` — `warnedKeys` dedupe Set + `warnOnce()` helper, cleared on reconnect
- Modified `backend/src/modules/onboarding/__tests__/onboarding.service.spec.ts` — added N9 round-robin regression test; added `department.update` + `agent.create` mocks; added `industryGroupsMock` for Phase 0 G1 compatibility

### Part 9 SOLID compliance

- **SRP:** `TenantStore` owns only tenant UI metadata caching. `warnOnce()` is the single warning-dedupe mechanism. `TierChangeService` is the single tier-change policy owner.
- **DRY:** IconRail + future components share one `tenantsService.getCurrent()` call (not N). Tier change logic lives once in `TierChangeService`.
- **OCP:** New consumer just calls `useTenantIndustryGroup()` — no new fetch needed. New warning site just calls `warnOnce(key, msg)`.
- **LSP:** `useTenantIndustryGroup()` returns the same shape as the old local-state code (industryGroup + industry + loading).
- **DIP:** TenantStore wraps PrismaService via the `tenantsService` abstraction. TenantsService delegates to `TierChangeService` (a Nest provider), not prisma directly.

### Part 9 N6 follow-up — `Tier.packages` → `Tier.packageAnchors` rename (2026-07-23)

Originally scoped as "skipped (cosmetic)" because the Phase 9 audit worried about consumer breakage. Re-audit confirmed zero consumers reference `tier.packages` (grep across backend + admin + tenant src returned 0 matches). The rename is safe and was implemented:

- **Schema:** `Tier.packages Package[]` → `Tier.packageAnchors Package[]` (semantically clearer — the tier *anchors* packages, not the other way around; matches TIER-SYSTEM-CONCEPT.md §6.1).
- **Migration:** `20260723_tier_package_anchors_rename/migration.sql` — no-op at the DB level because the FK column `packages.tierId` is on the Package side (Prisma renames are client-only).
- **Generated client:** `prisma generate` re-emits `Tier` with `packageAnchors` instead of `packages`. No SQL changes needed on Contabo.
- **Lock-in test:** `tiers/__tests__/tier-package-anchors-rename.spec.ts` (2 tests) — compile-time type assertion + runtime guard. A future revert would fail at build time.

**Verification:** Backend `tsc --noEmit` clean. Backend unit tests: **1488 passed / 0 failed** (up from 1486 — 2 new N6 lock-in tests, zero regressions).

---

## Appendix A: File Reference Map

| Concern | Key Files |
|---------|-----------|
| Industry model | `schema.prisma:3950-3972` |
| Tenant model | `schema.prisma:485-500` |
| Customer model | `schema.prisma:2018-2040` |
| Tier model | `schema.prisma:348-404` |
| TierAuditLog / TierChangeRequest | `schema.prisma:410-450` |
| Package model (industryId + tierId) | `schema.prisma:4002-4036` |
| Migrations | `backend/prisma/migrations/20260721_industry_groups/`, `..._tenant_industry_group/`, `..._tier_system_refactor/`, `..._tier_template_phase2/`, `..._tier_template_phase3_drop/` |
| Industry seeders | `seed-industries-majors.cjs`, `add-industry-accounting.cjs`, `backfill-industry-groups.cjs`, `seed-industries-compact.cjs`, `seed-industry-packages.cjs`, `seed-industry-templates.cjs` |
| Industry-group seeders | `seed-business-technology-templates.cjs`, `seed-consumer-commerce-templates.cjs`, `seed-healthcare-templates.cjs`, `seed-industrial-infra-templates.cjs`, `seed-public-social-templates.cjs` |
| Package seeders | `seed-package-catalogue.cjs`, `seed-accounting-packages.cjs`, `seed-business-composition.cjs` |
| Tier seeder | `seed-business-composition.cjs`, `backfill-tier-system.cjs` |
| Industry module BE | `backend/src/modules/industry/` (10 files incl. customer-fields/) |
| Industry controller | `backend/src/modules/industry/industries.controller.ts` |
| Tier × Industry matrix | `backend/src/modules/industry/tier-industry-matrix.ts` |
| Tier module BE | `backend/src/modules/tiers/` (controller, service, DTO, agent-pool) |
| Tenant service | `backend/src/modules/tenants/tenants.service.ts` |
| Onboarding service | `backend/src/modules/onboarding/onboarding.service.ts` |
| Project synthesis | `backend/src/modules/project-shape/project-shape-synthesis.service.ts` |
| Derived shape applier | `backend/src/modules/projects/services/derived-shape-applier.service.ts` |
| CreateProjectTool | `backend/src/modules/tools/built-in/neurecore-tools.ts:680-730` |
| Industry Groups FE | `frontend-tenant/src/lib/industryGroups.ts` |
| Industry nav config | `frontend-tenant/src/lib/industryNavigation.ts` |
| IndustryGroupPicker | `frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx` |
| CompanyStep | `frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx` |
| IconRail | `frontend-tenant/src/components/layout/IconRail.tsx` |
| RailCustomizeModal | `frontend-tenant/src/components/layout/RailCustomizeModal.tsx` |
| railPreferencesStore | `frontend-tenant/src/stores/railPreferencesStore.ts` |
| IndustryStubPage | `frontend-tenant/src/components/industry/IndustryStubPage.tsx` |
| Stub routes | `frontend-tenant/src/app/workspace/[feature]/page.tsx` + 8 explicit dirs |
| CustomerForm | `frontend-tenant/src/components/customers/CustomerForm.tsx` |
| Admin industries lib | `frontend-admin/src/lib/industries.ts` |
| Admin tenant detail | `frontend-admin/src/app/tenants/[id]/page.tsx` |
| Admin tenant new | `frontend-admin/src/app/tenants/new/page.tsx` |
| Admin tiers pages | `frontend-admin/src/app/tiers/`, `frontend-admin/src/app/settings/tiers/` |
| Memory bank | `memory-bank-new/system-state.md`, `memory-bank-new/industries/`, `memory-bank-new/fixes.md`, `memory-bank-new/pools-taxonomy.md`, `memory-bank-new/pending-tasks.md` |

---

## Appendix B: Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-22 15:05 | Reconciliation against `system-state.md` 2026-07-21 21:03 deploy record. Corrected Tier refactor + Industry Groups Phase 1+5 status from ❌ to ✅. Added 11 new issues (N1-N11). Added G13/G14/G15. Added Phase 6 (Tenant Tier UI) and Phase 7 (Knowledge/RAG). Recalculated scorecard to ~44%. | Kilo |
| 2026-07-22 | Initial draft generated from 5-doc review + spot-check | Kilo |
