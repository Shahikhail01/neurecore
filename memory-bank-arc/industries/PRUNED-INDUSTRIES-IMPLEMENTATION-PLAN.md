# Pruned-Industries Implementation Plan

**Status:** Active implementation plan
**Author:** Kilo
**Date:** 2026-07-31
**Supersedes (implementation-wise):** All per-Industry build items previously inlined in `PRUNED-TAXONOMY-PROPOSAL.md §7.x` — this plan is the **single, sequenced, de-duplicated** execution guide.
**Builds on:**
- `PRUNED-TAXONOMY-PROPOSAL.md` — what to ship + when (Phase plan, effort estimates, open questions).
- `KEPT-INDUSTRY-CATALOG.md` — what every Industry's Tenant Template, Packages, Project Types, Workspace modules look like.
- `NeuroCore Architectural Constitution` — governing principles.
- `memory-bank-arc/pools-taxonomy.md` — 6-pool schema (canonical data model).

---

## Table of Contents

1. [Executive summary](#1-executive-summary)
2. [SOLID enforcement matrix](#2-solid-enforcement-matrix)
3. [Anti-duplication audit (current state)](#3-anti-duplication-audit-current-state)
4. [Refactor targets before any Phase begins](#4-refactor-targets-before-any-phase-begins)
5. [Per-Phase implementation steps](#5-per-phase-implementation-steps)
6. [Shared infrastructure](#6-shared-infrastructure)
7. [Testing & certification](#7-testing--certification)
8. [Risk register](#8-risk-register)
9. [Effort totals](#9-effort-totals)
10. [Rollout & deployment](#10-rollout--deployment)
11. [References](#11-references)

---

## 1. Executive summary

### 1.1 What this plan delivers

A sequenced, de-duplicated build that takes the platform from "1 live Industry (accounting), 15 stubbed Industries" to "8 live, certified, Phase-aligned Industries" while:

- **Enforcing 100% SOLID** at every layer (data, service, controller, UI).
- **Eliminating duplication** in three categories: string-literal sprawl (50+ hardcoded `'financial-compliance'` references), per-Industry seeder copy-paste, and per-Industry workspace-module scaffolding.
- **Honoring the prior decisions**: 8 kept Industries, 8 cut, F&C group shared nav, B&T + Consumer groups sharing nav blocks via P3 sub-industry filter, Special-Purpose cross-group inheritance via T8.

### 1.2 Three laws this plan enforces

These three laws are non-negotiable. Every code review, every PR, every "is this PR ready?" check applies them.

> **Law 1 — One source of truth per concept.** A string literal exists in **exactly one place**. A constant lives in **exactly one module**. A config row lives in **exactly one DB table**. Duplicates are bugs, not "documentation."

> **Law 2 — Open/Closed Industries.** A new Industry (or new vertical) is added by **appending** to data tables and registries — never by editing existing code or by `switch`/`if-else` chains on industry slugs.

> **Law 3 — Composition over inheritance.** Tenant Templates compose Departments + Agents + Features via M2M; Packages compose Templates + Features via M2M; Packages may *reference* parent Packages via FK (T8). No class-hierarchy trees for industry behavior.

### 1.3 Effort + timeline recap

| Bucket | Dev-days | Source |
|---|---:|---|
| Refactor (before any Phase) | 5 | §4 |
| Phase 2.A picker + P3+P5+P6+P7 | 6.5 | §5.1 |
| Phase 2.B financial-services | 8 | §5.2 |
| Phase 3.A tech-digital | 10 | §5.3 |
| Phase 3.B professional-services | 5 | §5.4 |
| Phase 4.A retail | 12 | §5.5 |
| Phase 4.B media | 5 | §5.6 |
| Phase 5.A nonprofit | 9.5 | §5.7 |
| Phase 5.B special-purpose (T8+P4+P9) | 7.5 | §5.8 |
| Shared infra (P1+P2) | 4 | §6 |
| Testing & certification harness | 4 | §7 |
| **Total v1** | **~76.5 dev-days** | ≈ 2 engineers × 9 weeks |

The 7.5 dev-days of Stage-2 deferrable work (P10–P13 + Hermes tools, from proposal §7.9 Tier C) is excluded.

---

## 2. SOLID enforcement matrix

For each SOLID principle: the **rule**, the **mechanism** that enforces it in this codebase, the **owner** (human or test), and the **violation pattern** to grep for in code review.

### 2.1 S — Single Responsibility Principle

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **One Industry = one source of truth for its metadata.** `slug`, `name`, `icon`, `industryGroup`, `status` live on the `Industry` table only. | `Industry` model (`schema.prisma:4117`) is the sole source. Nav/customer-field/project-type data **joins** to it, never duplicates it. | Code review | `slug:\s*'financial-compliance'` outside `seeds/industry-templates/` and `industryNavigation.ts`; literal `name:` for an Industry in component code |
| **One package composition editor** for all Industries, parameterized by `Package.id`. | `/packages/[id]/edit/page.tsx` is generic; reads `packagesService.getById(id)`, renders composition fields from `pkg.industry`/`pkg.tier`/`pkg.scope`. No Industry-specific branches in the editor. | Code review + visual test | `if (pkg.industry === ...)` in `/packages/[id]/edit/` |
| **One Tenant Template renderer** for all Departments. | `DepartmentTemplate.structure: Json` is rendered by a single generic `DepartmentStructureRenderer` component (already in `frontend-admin/src/app/departments-pool/page.tsx` ~line 200). | Code review | Duplicate `structure.map(...)` JSX in admin or tenant UI |
| **One agent role-prompt template** per Industry's `AgentTemplate.description`. | `AgentTemplate` rows seeded once via `seed-*-department-template.cjs`. No Industry-specific agent prompt code in service layer. | Code review | `prompt += industry === 'X' ? ...` in any agent service |
| **One workspace module renderer** for all Industries. | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` is already generic; routes register at `[feature]/page.tsx`. New modules = new pages only. | Code review | Component imports `industryGroup ===` to decide what to render |

### 2.2 O — Open/Closed Principle

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **Adding an Industry = appending to data, never editing code.** | All Industry-aware logic reads from `INDUSTRY_NAV_CONFIGS`, `INDUSTRY_CUSTOMER_FIELDS`, `INDUSTRY_WIDGETS`, `INDUSTRY_APPROVAL_ADDONS`, `INDUSTRY_NOTIFICATION_TEMPLATES` — each is a `Record<slug, ...>` map keyed by slug. | Code review + E2E | `switch (tenant.industry)` or `if (tenant.industry === 'X') { ... }` in any controller/service |
| **Adding a Package = appending to data.** | `Package` rows reference existing templates + features; no new code. | Admin UI test | `if (tier === 'X' && industry === 'Y')` in package composition code |
| **Adding a feature flag = appending to `Feature` table** (no new code). | `Feature.key` registry is the dispatch table; consumers use `featureRegistry.get('kyc_pack')`. | Code review | `if (features.includes('kyc_pack'))` directly in service code — should use `featureRegistry.has(...)` |
| **Adding a workspace module = adding a page, not editing IconRail.** | `IconRail` reads `INDUSTRY_NAV_CONFIGS['{groupSlug}'].workspaceExtras`; new entries appear automatically. | Visual test | Hardcoded nav item in `IconRail.tsx` |
| **Adding an approval-chain addon = appending to `ApprovalAddon` registry.** | New addon class implementing `ApprovalAddon` interface auto-registered via NestJS DI (`@Injectable` + module providers array). | Code review | New addon wired via `if (industry === ...) { ... }` |

### 2.3 L — Liskov Substitution Principle

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **All `ApprovalAddon` implementations are interchangeable.** | `approval-addon.interface.ts` defines `supports(context): boolean` + `buildChain(context): ApprovalChain`. No addon can throw or silently no-op when called. | Test | `if (!supports) throw new Error('unsupported')` |
| **All `WidgetDefinition` rows behave identically when filtered by industryGroup.** | `widget-registry.ts:105` filters by group; missing group → row is universal. No widget treats "no group" as an error. | Test | `if (!widget.industryGroup) throw ...` |
| **All `DepartmentTemplate.structure[]` rows render with the same shape** (`name`, `description`, `type`, `parentSlug?`). | `DepartmentStructureRenderer` validates structure keys at render time in dev mode (`process.env.NODE_ENV !== 'production'`). | Code review | Per-Industry `if (structure[0].type === 'X')` in renderer |
| **All `Package.scope` values mean the same thing** (`FUNCTIONAL` = reusable, `VERTICAL` = Industry-specific, never the opposite). | Type guard in package-resolver service throws if a Package is `VERTICAL` but no `industryId` matches the tenant's Industry. | Test | Resolver silently no-ops on missing scope |

### 2.4 I — Interface Segregation Principle

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **Industry-aware clients depend on the smallest Industry interface they need.** | Five narrow interfaces in `backend/src/modules/industry/interfaces/` (audit 2026-07-31 confirms `compliance.interface.ts` exists; expand):<br>1. `IndustryMetadataProvider` — `getIndustry(slug)`, `getGroupForIndustry(slug)`, `listIndustriesInGroup(group)`.<br>2. `IndustryNavProvider` — `getNavConfig(groupSlug)`, `getSubIndustryFilter(groupSlug, industrySlug)`.<br>3. `IndustryCustomerFieldProvider` — `getFieldsForIndustry(slug)`.<br>4. `IndustryApprovalAddonRegistry` — `getAddons(context)`, `register(addon)`.<br>5. `IndustryWidgetProvider` — `getWidgetsFor(groupSlug, tenantTier)`. | Code review | A single `IndustryService` god-class that everything imports |
| **Feature consumers depend on `FeatureProvider`, not the `Package` model.** | `FeatureProvider.hasFeature(tenantId, key): Promise<boolean>` is the only public API. Consumers don't `findMany({where: {key: ...}})`. | Code review | `prisma.package.findMany({...})` in non-package services |
| **Tenant onboarding depends on `TenantBlueprintResolver`, not on raw `Industry`/`Tier`/`Package` queries.** | `OnboardingService` calls `resolver.resolveForIndustry(industrySlug, tierSlug): TenantBlueprint` — single method, no chained Prisma calls. | Test | `OnboardingService` directly queries `industry`, `tier`, `package`, `departmentTemplate`, `agentTemplate` |

### 2.5 D — Dependency Inversion Principle

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **High-level services depend on abstractions (interfaces + DI tokens), not on Prisma directly.** | Every module's service constructor takes its dependencies as `@Inject(TOKEN)` symbols, not as `PrismaService` directly. The five `Industry*Provider` interfaces (above) are bound to concrete impls via `useClass` in each module. | Code review | `constructor(private prisma: PrismaService)` in any non-data-layer service |
| **Industry-group strings flow through one constants module.** | `backend/src/modules/industry/industry-group.constants.ts` + `frontend-tenant/src/lib/industryGroups.ts` export `INDUSTRY_GROUP = { FINANCIAL_COMPLIANCE: 'financial-compliance', ... } as const;`. Every consumer imports this. | Code review + automated lint | Any string literal `'financial-compliance'` outside the two constants modules |
| **The 8-Group picker accordion reads from a single `INDUSTRY_GROUPS` registry.** | One constant + one `Record<slug, IndustryGroup>` exports Group label + Industry slugs. Adding Industry #9 = one entry in one file. | Code review | `INDUSTRY_NAV_CONFIGS` keys duplicated in 3+ places |
| **Tier-slug strings flow through one constants module.** | `backend/prisma/seed-tier-slugs.cjs` exports `TIER_SLUGS = ['starter','professional','enterprise'] as const`. FS seeder's `basic|business|professional|enterprise` is **legacy and gets migrated** (T1). | Code review | Any `tierSlug: 'basic'` or `tierSlug: 'business'` post-Phase 2.B |

### 2.6 Bonus law — DRY (don't repeat yourself) for seeder scaffolding

| Rule | Mechanism | Owner | Grep pattern (violation) |
|---|---|---|---|
| **All Industry Tenant Templates seed via one shared helper.** | `prisma/seed-helpers/seed-tenant-template.cjs` exports `seedTenantTemplate({ slug, name, category, structure, agents })`. New Industry = one `require()` call + one literal. | Code review | `seed-*-department-template.cjs` files duplicating the same `prisma.departmentTemplate.upsert(...)` block |
| **All Industry package compositions seed via one shared helper.** | `prisma/seed-helpers/seed-package.cjs` exports `seedPackage({ industry, tier, scope, slug, name, description, departments, agents, features })`. New Industry = one call per package. | Code review | `seed-*-packages.cjs` files duplicating the same `findIndustry → findTier → upsert Package → set M2M` block |
| **All Industry project types seed via one shared loader.** | `prisma/seed-helpers/seed-project-types.cjs` reads each `seeds/project-types/*.json` and upserts in a loop. New Industry = one JSON file. | Code review | Per-Industry `seed-project-types.cjs` files |

### 2.7 SOLID enforcement testing

A single **lint rule** (custom ESLint or regex grep in CI) catches all six pattern columns. Implementation:

```yaml
# .github/workflows/solid-guard.yml (or pre-commit hook)
- name: SOLID guard
  run: |
    # S — Industry metadata not duplicated outside canonical files
    ! grep -rE "slug:\s*'(financial-compliance|healthcare|business-technology)" \
        neurecore/backend/src neurecore/frontend-tenant/src \
        --include="*.ts" --include="*.tsx" \
        | grep -v "industryNavigation.ts" \
        | grep -v "industry-group.constants.ts" \
        | grep -v "industryGroups.ts" \
        | grep -v "industry-customer-field-definitions.ts"
    # ... + 5 more checks (one per principle)
```

Add as **mandatory CI gate** before Phase 2.A ships. ~1 dev-day.

---

## 3. Anti-duplication audit (current state)

Audit results from 2026-07-31. Quantified duplication surface to be eliminated by §4 refactor + §6 infra.

### 3.1 String-literal sprawl (industry slugs + group slugs)

| Search target | Count | Locations |
|---|---:|---|
| `'financial-compliance'` / `"financial-compliance"` | **50** | Backend (compliance, widgets, approval, departments, onboarding, industry module) + tenant FE (Customer.tsx, IconRail.tsx, industryNavigation.ts) |
| `'healthcare'` (group slug) | **15** | Backend modules + FE stubs |
| `'business-technology'` | **18** | Same pattern |
| `'consumer-commerce'` | ~6 | FE only (nav config + IconRail) |
| `'public-social'` | ~5 | FE only |
| `'agriculture-food'` | ~5 | FE only (cut Industry; will reduce post-Phase 2.A) |
| `'other'` (group slug) | ~3 | FE only |
| Tier slugs (`'starter'`, `'professional'`, `'enterprise'`, `'basic'`, `'business'`) | ~40 | Spread across 6 package seeders |
| `Customer.financialSubType` enum literal in FE guard | 1 | `Customer.tsx` (acceptable — single source) |

**Refactor target:** All 50 `'financial-compliance'` references + equivalent for other groups → one constants module per side (`backend/src/modules/industry/industry-group.constants.ts`, `frontend-tenant/src/lib/industryGroups.ts`).

### 3.2 Per-Industry seeder copy-paste

| Seeder | Lines | Duplicated boilerplate |
|---|---:|---|
| `seed-accounting-packages.cjs` | 457 | Loads `.env.production`, constructs `PrismaClient`, looks up Industry by slug, looks up Tier, upserts Package, sets M2M (3 places × 5 files). |
| `seed-financial-services-packages.cjs` | 322 | Same boilerplate. |
| `seed-business-composition.cjs` | 207 | Same boilerplate. |
| `seed-package-catalogue.cjs` | 342 | Same boilerplate. |
| `seed-business-technology-templates.cjs` | ~180 | `DepartmentTemplate.upsert` boilerplate. |
| `seed-healthcare-department-template.cjs` | 128 | Same. |
| `seed-financial-compliance-templates.cjs` | ~150 | Same. |
| 3 other Industry seeders | ~150 each | Same. |

**Estimated duplication:** ~60% of each seeder is boilerplate (env loading + Prisma init + Industry/Tier lookup + upsert pattern). The Industry-specific data is ~40%.

**Refactor target:** Extract `seed-helpers/` (3 modules: `seed-tenant-template.cjs`, `seed-package.cjs`, `seed-project-types.cjs`). New Industry = one `require()` + one literal config. Boilerplate drops to 0 lines per seeder.

### 3.3 Per-Industry customer-field defs (already good, no duplication)

`industry-customer-field-definitions.ts:46` is a single `Record<industrySlug, CustomerFieldDef[]>`. All 16 Industries wired. The function `getCustomerFieldDefs(slug)` is the single resolver. **No refactor needed — this is the gold standard the rest of the codebase should follow.**

### 3.4 Per-Group nav config (already good, no duplication)

`industryNavigation.ts:62` is a single `Record<groupSlug, IndustryNavConfig>`. Resolved by `getIndustryNavConfig(groupSlug)`. **No refactor needed.**

### 3.5 Industry-aware service duplication (target for refactor)

| File pattern | Count | Issue |
|---|---:|---|
| `compliance/industry-compliance.service.ts` | 1 | Already segregated; verify it uses `IndustryMetadataProvider` interface (§2.4). |
| `widgets/industry-*.ts` | 3 | Widget definitions per Group; should be data rows not service code. |
| `notifications/industry-notification-templates.ts` | 1 | Templates registry; verify same pattern. |
| `workflows/industry-workflow-definitions.ts` | 1 | Verify same pattern. |
| `approval-chains/addons/financial-approval.addon.ts` | 1 | Singleton; verify DI binding. |

**Refactor target:** Audit each to confirm they read from `Record<slug, ...>` not from `switch (industry)` chains. Any `switch` becomes a refactor.

### 3.6 Total duplication surface to eliminate

| Category | Lines of duplicated code | Effort to eliminate |
|---|---:|---:|
| String literals (8 group slugs × 50 sites × 2 sides) | ~100 | 1 dev-day |
| Per-Industry seeder boilerplate | ~600 across 9 seeders | 1.5 dev-days |
| Per-Industry service code (if any `switch` found) | TBD | 0.5–1 dev-day |
| **Total** | **~700+ lines** | **~3 dev-days** |

This is the §4 refactor work that must land **before any Phase begins**.

---

## 4. Refactor targets before any Phase begins

These 4 refactors are **gating** — no Phase 2.A work starts until each is verified by the §2.7 SOLID guard CI gate.

### 4.1 R1 — Industry-group constants module (both sides)

**Goal:** Every string literal for a group slug or tier slug flows through one constants module.

**Backend:**
- Create `backend/src/modules/industry/industry-group.constants.ts`:

```typescript
export const INDUSTRY_GROUP = {
  FINANCIAL_COMPLIANCE: 'financial-compliance',
  BUSINESS_TECHNOLOGY: 'business-technology',
  CONSUMER_COMMERCE: 'consumer-commerce',
  PUBLIC_SOCIAL: 'public-social',
  OTHER: 'other',
  // cut groups kept for DB row presence + grandfathering
  HEALTHCARE: 'healthcare',
  INDUSTRIAL_INFRASTRUCTURE: 'industrial-infrastructure',
  AGRICULTURE_FOOD: 'agriculture-food',
} as const;

export type IndustryGroupSlug = typeof INDUSTRY_GROUP[keyof typeof INDUSTRY_GROUP];

export const ACTIVE_INDUSTRY_GROUPS: ReadonlySet<IndustryGroupSlug> = new Set([
  INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
  INDUSTRY_GROUP.BUSINESS_TECHNOLOGY,
  INDUSTRY_GROUP.CONSUMER_COMMERCE,
  INDUSTRY_GROUP.PUBLIC_SOCIAL,
  INDUSTRY_GROUP.OTHER,
]);
```

- Replace 50 hardcoded `'financial-compliance'` with `INDUSTRY_GROUP.FINANCIAL_COMPLIANCE`.
- Re-export from `@/modules/industry` barrel.

**Frontend:**
- Mirror module at `frontend-tenant/src/lib/industryGroups.ts`.
- Replace `'financial-compliance'` in `IconRail.tsx`, `Customer.tsx`, `IndustryStubPage.tsx`, `IndustryWorkspacePage.tsx`, `tenantStore.ts`.

**Tier constants:**
- `backend/prisma/seed-tier-slugs.cjs` (new): `TIER_SLUG = { STARTER: 'starter', PROFESSIONAL: 'professional', ENTERPRISE: 'enterprise' } as const;`.
- All seeders import this. `seed-financial-services-packages.cjs` gets its T1 tier-slug migration simultaneously (§5.2.1).

**Files touched:** ~15 backend files + ~8 frontend files = ~23 PRs OR one mass-replace commit. Recommend mass-replace + ESLint guard.
**Effort:** 1 dev-day.

### 4.2 R2 — Seeder helpers (3 modules, full spec)

**Goal:** Every per-Industry seeder becomes a single literal config + one `require()` call. Removes ~600 lines of duplicated boilerplate across 9 existing seeders.

#### 4.2.1 File 1 — `backend/prisma/seed-helpers/load-env.cjs`

**Purpose:** Single point that reads `.env.production` (preferred) then `.env`. Every seeder requires this instead of duplicating the env-loader block.

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envProd = path.join(__dirname, '..', '..', '.env.production');
  const envDev  = path.join(__dirname, '..', '..', '.env');
  for (const file of [envProd, envDev]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

module.exports = { loadEnv };
```

#### 4.2.2 File 2 — `backend/prisma/seed-helpers/seed-tenant-template.cjs`

**Purpose:** Idempotent upsert of one `DepartmentTemplate` row + its `AgentTemplate` rows + their `TierAgentPool` entries. Used by every per-Industry tenant-template seeder.

```javascript
'use strict';
const { PrismaClient } = require('@prisma/client');

/**
 * @param {Object} args
 * @param {PrismaClient} args.prisma
 * @param {string} args.slug                e.g. "financial-services-bank"
 * @param {string} args.name                e.g. "Financial Services Bank"
 * @param {string} args.category            DEPRECATED post-P13: free-text now, enum after 5.A.
 *                                          Use a value from the IndustryGroupSlug union for forward-compat.
 * @param {Array<{name:string, description:string, type:'EXECUTIVE'|'CORE'|'FUNCTIONAL', parentSlug?:string}>} args.structure
 * @param {Array<{slug:string, name:string, roleDescription:string, departmentSlug:string}>} args.agents
 * @param {Object} [args.options]
 * @param {boolean} [args.options.isPublic=true]
 * @param {string[]} [args.options.tags=[]]
 * @param {boolean} [args.options.dryRun=false]
 * @returns {Promise<{templateId:string, agentIds:string[]}>}
 */
async function seedTenantTemplate({ prisma, slug, name, category, structure, agents, options = {} }) {
  const { isPublic = true, tags = [], dryRun = false } = options;

  if (dryRun) {
    console.log(`[DRY] DepartmentTemplate ${slug}: ${structure.length} depts, ${agents.length} agents`);
    return { templateId: 'dry-run', agentIds: [] };
  }

  const upserted = await prisma.departmentTemplate.upsert({
    where: { slug },
    create: { slug, name, category, structure, isPublic, tags },
    update: { name, category, structure, isPublic, tags },
  });

  const agentIds = [];
  for (const a of agents) {
    const upsertedAgent = await prisma.agentTemplate.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, name: a.name, roleDescription: a.roleDescription },
      update: { name: a.name, roleDescription: a.roleDescription },
    });
    agentIds.push(upsertedAgent.id);
  }

  return { templateId: upserted.id, agentIds };
}

module.exports = { seedTenantTemplate };
```

**Why this shape:** Idempotent (upsert on slug), single Prisma call per template + per agent, returns IDs for downstream `TierAgentPool` linking.

#### 4.2.3 File 3 — `backend/prisma/seed-helpers/seed-package.cjs`

**Purpose:** Upsert one `Package` row + M2M departments/agents/features. Used by every per-Industry package seeder.

```javascript
'use strict';
const { PrismaClient } = require('@prisma/client');

/**
 * @param {Object} args
 * @param {PrismaClient} args.prisma
 * @param {string} args.industrySlug        e.g. "financial-services"
 * @param {string} args.tierSlug            canonical: "starter" | "professional" | "enterprise"
 * @param {Object} args.packageDef
 * @param {string} args.packageDef.slug
 * @param {string} args.packageDef.name
 * @param {string} [args.packageDef.description]
 * @param {'FUNCTIONAL'|'VERTICAL'} args.packageDef.scope
 * @param {string[]} [args.packageDef.departmentTemplateSlugs=[]]
 * @param {string[]} [args.packageDef.agentTemplateSlugs=[]]
 * @param {string[]} [args.packageDef.featureKeys=[]]
 * @param {string} [args.packageDef.parentPackageSlug]  // T8 cross-group reference
 * @param {string} [args.packageDef.parentPackageId]    // resolved internally
 * @param {boolean} [args.dryRun=false]
 */
async function seedPackage({ prisma, industrySlug, tierSlug, packageDef, dryRun = false }) {
  const industry = await prisma.industry.findUnique({ where: { slug: industrySlug } });
  if (!industry) throw new Error(`Industry not found: ${industrySlug}`);
  const tier = await prisma.tier.findUnique({ where: { slug: tierSlug } });
  if (!tier) throw new Error(`Tier not found: ${tierSlug}`);

  let parentPackageId = packageDef.parentPackageId ?? null;
  if (packageDef.parentPackageSlug) {
    const parent = await prisma.package.findFirst({
      where: { slug: packageDef.parentPackageSlug, industryId: industry.id, tierId: tier.id },
    });
    if (!parent) throw new Error(`Parent package not found: ${packageDef.parentPackageSlug}`);
    parentPackageId = parent.id;
  }

  if (dryRun) {
    console.log(`[DRY] Package ${packageDef.slug} (${industrySlug}/${tierSlug}, ${packageDef.scope})`);
    return;
  }

  const upserted = await prisma.package.upsert({
    where: { industryId_tierId_slug: { industryId: industry.id, tierId: tier.id, slug: packageDef.slug } },
    create: {
      slug: packageDef.slug,
      name: packageDef.name,
      description: packageDef.description,
      scope: packageDef.scope,
      industryId: industry.id,
      tierId: tier.id,
      parentPackageId,
    },
    update: {
      name: packageDef.name,
      description: packageDef.description,
      scope: packageDef.scope,
      parentPackageId,
    },
  });

  // M2M departments
  if (packageDef.departmentTemplateSlugs?.length) {
    const depts = await prisma.departmentTemplate.findMany({
      where: { slug: { in: packageDef.departmentTemplateSlugs } },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { departments: { set: depts.map((d) => ({ id: d.id })) } },
    });
  }

  // M2M agents
  if (packageDef.agentTemplateSlugs?.length) {
    const ags = await prisma.agentTemplate.findMany({
      where: { slug: { in: packageDef.agentTemplateSlugs } },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { aiAgents: { set: ags.map((a) => ({ id: a.id })) } },
    });
  }

  // M2M features
  if (packageDef.featureKeys?.length) {
    const feats = await prisma.feature.findMany({
      where: { key: { in: packageDef.featureKeys } },
    });
    await prisma.package.update({
      where: { id: upserted.id },
      data: { features: { set: feats.map((f) => ({ id: f.id })) } },
    });
  }
}

module.exports = { seedPackage };
```

**Why this shape:** Idempotent on `(industryId, tierId, slug)`. Resolves M2M by slug → ID. Supports T8 `parentPackageId`. Matches the existing unique constraint in `schema.prisma:4200`.

#### 4.2.4 File 4 — `backend/prisma/seed-helpers/seed-project-types.cjs`

**Purpose:** Bulk-load all 16 `prisma/seeds/project-types/*.json` files. Single entry point that replaces 16 individual JSON readers.

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

const PROJECT_TYPES_DIR = path.join(__dirname, '..', 'seeds', 'project-types');

/**
 * @param {Object} args
 * @param {PrismaClient} args.prisma
 * @param {string} [args.industrySlug]   If set, only seed that Industry's project types.
 *                                       If omitted, seed all 16.
 * @param {boolean} [args.dryRun=false]
 */
async function seedProjectTypesFromJson({ prisma, industrySlug, dryRun = false }) {
  const files = fs.readdirSync(PROJECT_TYPES_DIR).filter((f) => f.endsWith('.json'));
  let total = 0;

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(PROJECT_TYPES_DIR, file), 'utf8'));
    if (industrySlug && raw.industry !== industrySlug) continue;

    if (dryRun) {
      console.log(`[DRY] ${raw.industry}: ${(raw.types ?? []).length} project types`);
      total += (raw.types ?? []).length;
      continue;
    }

    // Upsert each project type + its stages + its approvals.
    // Implementation detail: parse raw.types[*].stages[*] and
    // raw.types[*].approvalTemplate[*]; upsert ProjectTypeStage +
    // ProjectTypeApproval rows. (Schema lives at schema.prisma — verify
    // model names exist before writing this seeder.)
    total += await upsertOne(prisma, raw);
  }

  return total;
}

module.exports = { seedProjectTypesFromJson };
```

#### 4.2.5 Example: refactored `seed-financial-services-department-template.cjs`

After R2, this file shrinks from ~150 lines (current pattern) to ~50 lines:

```javascript
'use strict';
const { loadEnv } = require('./seed-helpers/load-env.cjs');
loadEnv();
const { PrismaClient } = require('@prisma/client');
const { seedTenantTemplate } = require('./seed-helpers/seed-tenant-template.cjs');

const prisma = new PrismaClient();

const TEMPLATE = {
  slug: 'financial-services-bank',
  name: 'Financial Services Bank',
  category: 'financial-compliance', // post-P13 will be enum
  structure: [
    { name: 'Bank Manager / Firm Principal', description: '...', type: 'EXECUTIVE' },
    { name: 'Client Onboarding',             description: '...', type: 'CORE' },
    { name: 'Front Office / Teller Ops',     description: '...', type: 'CORE' },
    { name: 'Lending Operations',            description: '...', type: 'CORE' },
    { name: 'Compliance & Risk',             description: '...', type: 'CORE' },
    { name: 'AML / BSA Specialist',          description: '...', type: 'FUNCTIONAL', parentSlug: 'Compliance & Risk' },
    { name: 'Wealth Advisor',                description: '...', type: 'FUNCTIONAL', parentSlug: 'Front Office / Teller Ops' },
    { name: 'Operations Coordinator',        description: '...', type: 'FUNCTIONAL' },
  ],
  agents: [
    { slug: 'firm-principal',          name: 'Firm Principal',          roleDescription: '...', departmentSlug: 'Bank Manager / Firm Principal' },
    { slug: 'kyc-officer',              name: 'KYC Officer',             roleDescription: '...', departmentSlug: 'Client Onboarding' },
    { slug: 'client-relationship-mgr', name: 'Client Relationship Mgr', roleDescription: '...', departmentSlug: 'Front Office / Teller Ops' },
    { slug: 'loan-officer',             name: 'Loan Officer',            roleDescription: '...', departmentSlug: 'Lending Operations' },
    { slug: 'compliance-analyst',       name: 'Compliance Analyst',      roleDescription: '...', departmentSlug: 'Compliance & Risk' },
    { slug: 'aml-analyst',              name: 'AML Analyst',             roleDescription: '...', departmentSlug: 'AML / BSA Specialist' },
    { slug: 'wealth-advisor',           name: 'Wealth Advisor',          roleDescription: '...', departmentSlug: 'Wealth Advisor' },
    { slug: 'operations-coordinator',   name: 'Operations Coordinator',  roleDescription: '...', departmentSlug: 'Operations Coordinator' },
  ],
};

(async () => {
  if (process.argv.includes('--check')) {
    await seedTenantTemplate({ prisma: new PrismaClient(), ...TEMPLATE, options: { dryRun: true } });
    process.exit(0);
  }
  const result = await seedTenantTemplate({ prisma, ...TEMPLATE });
  console.log(`✓ Financial Services tenant template seeded (templateId=${result.templateId}, ${result.agentIds.length} agents)`);
  await prisma.$disconnect();
})();
```

**~50 lines total** vs the current ~150 lines of `seed-financial-compliance-templates.cjs`. **No boilerplate.**

#### 4.2.6 Files touched + effort

- **4 new helpers:** `load-env.cjs`, `seed-tenant-template.cjs`, `seed-package.cjs`, `seed-project-types.cjs`. ~350 lines total.
- **9 existing seeders refactored:** `seed-accounting-packages.cjs`, `seed-financial-services-packages.cjs`, `seed-business-composition.cjs`, `seed-package-catalogue.cjs`, `seed-business-technology-templates.cjs`, `seed-healthcare-department-template.cjs`, `seed-financial-compliance-templates.cjs`, `seed-industrial-infra-templates.cjs`, `seed-public-social-templates.cjs`, `seed-consumer-commerce-templates.cjs`. Total ~1700 lines → ~700 lines (≈60% reduction).
- **6 future seeders** (per Phase) get the new pattern from day 1 (~50 lines each).
- **Net lines removed:** ~600. **Net effort:** 1.5 dev-days including dry-run verification against Mali (re-run accounting seeder; verify identical output).

#### 4.2.7 Risk + mitigation (R2-specific)

| Risk | Mitigation |
|---|---|
| Refactored seeders produce different output than original | Run both old + new against a test DB; diff the `Package` + `DepartmentTemplate` + `AgentTemplate` rows; commit only if identical. |
| `prisma generate` fails after M2M enum changes | Refactor must happen BEFORE Phase 5.A's P13 enum migration (5.A.1). |
| `seedPackage` M2M resolution conflicts with concurrent seeder runs | Run with `--check` first; production seeder is one-shot, idempotent. |

### 4.3 R3 — Industry provider interfaces (5 contracts)

**Goal:** Every Industry-aware service depends on a narrow interface, not on Prisma + a switch chain. Pure DI refactor; no behavior change.

#### 4.3.1 File 1 — `backend/src/modules/industry/interfaces/industry-metadata.provider.ts`

```typescript
export const INDUSTRY_METADATA = Symbol('INDUSTRY_METADATA');
export interface IndustryMetadataProvider {
  getIndustry(slug: string): Promise<Industry>;
  getGroupForIndustry(slug: string): Promise<string>;
  listIndustriesInGroup(group: IndustryGroupSlug): Promise<Industry[]>;
  listActiveIndustries(): Promise<Industry[]>;   // For Phase 2.A — replaces backend filter
}
```

#### 4.3.2 File 2 — `backend/src/modules/industry/interfaces/industry-nav.provider.ts`

```typescript
export const INDUSTRY_NAV = Symbol('INDUSTRY_NAV');
export interface IndustryNavProvider {
  getNavConfig(groupSlug: IndustryGroupSlug): IndustryNavConfig;
  getSubIndustryFilter(groupSlug: IndustryGroupSlug, industrySlug: string): string[];
}
```

#### 4.3.3 File 3 — `backend/src/modules/industry/interfaces/industry-customer-field.provider.ts`

```typescript
export const INDUSTRY_CUSTOMER_FIELD = Symbol('INDUSTRY_CUSTOMER_FIELD');
export interface IndustryCustomerFieldProvider {
  getFieldsForIndustry(slug: string): CustomerFieldDef[];
  getFieldsByGroup(groupSlug: IndustryGroupSlug): CustomerFieldDef[];
}
```

#### 4.3.4 File 4 — `backend/src/modules/industry/interfaces/industry-approval-addon.registry.ts`

```typescript
export const INDUSTRY_APPROVAL_ADDONS = Symbol('INDUSTRY_APPROVAL_ADDONS');
export interface IndustryApprovalAddonRegistry {
  register(addon: ApprovalAddon): void;
  getAddons(context: ApprovalContext): ApprovalAddon[];
}
```

#### 4.3.5 File 5 — `backend/src/modules/industry/interfaces/industry-widget.provider.ts`

```typescript
export const INDUSTRY_WIDGETS = Symbol('INDUSTRY_WIDGETS');
export interface IndustryWidgetProvider {
  getWidgetsFor(groupSlug: IndustryGroupSlug, tenantTier: TierSlug): WidgetDefinition[];
}
```

#### 4.3.6 Bindings — `backend/src/modules/industry/industries.module.ts`

```typescript
@Module({
  imports: [],
  controllers: [IndustriesController],
  providers: [
    IndustriesService,
    IndustryGroupsService,
    // R3: bind each interface to its concrete impl.
    { provide: INDUSTRY_METADATA, useClass: IndustriesService },
    { provide: INDUSTRY_NAV, useExisting: IndustryGroupsService },  // already exists; just exposes the symbol
    { provide: INDUSTRY_CUSTOMER_FIELD, useClass: IndustryCustomerFieldsService },
    { provide: INDUSTRY_APPROVAL_ADDONS, useClass: ApprovalAddonRegistry },
    { provide: INDUSTRY_WIDGETS, useExisting: WidgetRegistry },
  ],
  exports: [
    INDUSTRY_METADATA,
    INDUSTRY_NAV,
    INDUSTRY_CUSTOMER_FIELD,
    INDUSTRY_APPROVAL_ADDONS,
    INDUSTRY_WIDGETS,
  ],
})
export class IndustriesModule {}
```

#### 4.3.7 Files touched + effort

- **5 new interface files:** ~150 lines.
- **6 service refactors:** `compliance/industry-compliance.service.ts`, `widgets/widget-registry.ts`, `customer-fields/industry-customer-fields.service.ts`, `industry/industry.service.ts`, `approval-chains/financial-approval.addon.ts`, `industries.module.ts`. Each gets `constructor(@Inject(TOKEN) private readonly provider: ProviderType)`.
- **1 module file:** `industries.module.ts` (bindings + exports).
- **Net behavior change:** zero. Pure DI refactor; same queries, same data.
- **Net effort:** 1.5 dev-days including a NestJS integration test asserting all 5 symbols resolve + a Service Worker smoke test (PM2 stays up).

#### 4.3.8 Risk + mitigation (R3-specific)

| Risk | Mitigation |
|---|---|
| Refactor breaks a NestJS module that wasn't expecting the new injection | Run `pnpm build` + `pnpm test` after each service refactor (6 commits, not 1). |
| `useExisting` causes a circular reference (e.g. IndustryGroupsService needs INDUSTRY_NAV at construction) | Use `useClass` instead of `useExisting`; OR refactor IndustryGroupsService to expose its own `getNavConfig()` method that doesn't need INDUSTRY_NAV at construction time. |
| Sidecar (Hermes, accounting-sidecar) doesn't use these interfaces — bypasses DI | Add a defensive log: any service that injects `PrismaService` directly and queries `Industry` table gets a `// R3: should use INDUSTRY_METADATA` TODO comment + a unit test that asserts no direct query for industry metadata. |

### 4.4 R4 — SOLID guard CI gate

**Goal:** A failing CI build if any of the §2 grep patterns reappear in a PR.

**Implementation status (2026-07-31):** `neurecore/scripts/solid-guard.sh` written and verified passing locally (0 violations). **CI wiring is the user's one-line YAML:**

```yaml
# .github/workflows/solid-guard.yml (user adds; 1 dev-step)
name: SOLID Guard
on: [pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/solid-guard.sh
```

**Or pre-commit hook** at `.kilo/hooks/pre-commit.yml`:
```yaml
hooks:
  pre-commit:
    commands:
      solid-guard:
        run: bash scripts/solid-guard.sh
```

**Files touched:** 1 workflow YAML (user choice of hook location).
**Effort:** 0.5 dev-day — but most of it is the YAML + verifying the script runs in CI's checkout context (test fixtures excluded).

### 4.5 R-effort total

| Refactor | Effort | Blocks |
|---|---:|---|
| R1 — Constants modules | 1 dev-day | Phase 2.A |
| R2 — Seeder helpers | 1.5 dev-days | Phase 2.B+ (per-Industry seeder creation) |
| R3 — Provider interfaces | 1.5 dev-days | Phase 2.A (FE-side guard depends on the interfaces being injectable) |
| R4 — SOLID guard CI | 0.5 dev-day | All PRs after R1+R2+R3 |
| **Total** | **~5 dev-days** | Sequential before any Phase |

**Recommendation:** Land R1+R2+R3+R4 in **one sprint** with **all four engineers** (or one engineer × 1 week) before Phase 2.A starts. Once the SOLID guard is green, Phase 2.A can begin.

---

## 5. Per-Phase implementation steps

Every Phase below follows the **same 6-step pattern**:

1. **Refactor prerequisites** (which R1–R4 items + which P1–P13 items must be live).
2. **Data seeding** — Tenant Template + Packages + Project Types per the catalog §X.1/§X.2/§X.3.
3. **UI updates** — Tenant FE nav (per P3 if sub-industry filter), Admin UI verification per §3.7.
4. **Backend module updates** — New endpoints, addons, widgets per Industry needs.
5. **SIM runner** — Write SIM-XX runner per §7.
6. **Cert gate** — SIM-XX PASS in CI before Phase marked done.

The §5.1 through §5.8 below enumerate each Phase's unique work; the cross-cutting P1/P2 (workspace builder, SIM base class) are in §6.

### 5.1 Phase 2.A — Picker cut-down + sub-industry filter + Industry gating

**Prereqs (must be live):** R1, R3, R4. P5 (allocator audit), P6 (isolation test), P7 (`Industry.isActive`).

#### 5.1.1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 2.A.1 | Migration: add `Industry.isActive Boolean @default(true)` | `backend/prisma/schema.prisma`, new migration `20260801_industry_is_active` | S — single source on Industry table |
| 2.A.2 | Industry module update: include `isActive` in list/detail/getByGroup queries; PickerService filters | `backend/src/modules/industry/industries.service.ts`, `industries.controller.ts` | L — all consumers see same data shape |
| 2.A.3 | Onboarding module update: picker + customer-Industry dropdown filter on `isActive === true` | `backend/src/modules/onboarding/onboarding.service.ts`, `frontend-tenant/src/components/onboarding/IndustryPicker.tsx` | O — picker closes for new Industries; existing tenants unaffected |
| 2.A.4 | Customer module update: form dropdown reads only `isActive === true` Industries | `frontend-tenant/src/components/customers/CustomerForm.tsx` (the chunk shown earlier) | O — Industry cut → dropdown auto-closes |
| 2.A.5 | Admin `/industries` page: add "Active" toggle column wired to `isActive` | `frontend-admin/src/app/industries/page.tsx` | O — toggle is a single column, not a new page |
| 2.A.6 | P3 sub-industry nav filter: add `subIndustries?: string[]` to `RailItem`; `IconRail.tsx:214` filters against `tenant.industry` | `frontend-tenant/src/lib/industryNavigation.ts`, `frontend-tenant/src/components/layout/IconRail.tsx` | O — new Industry = new nav entry, not an `if (industry ===)` branch |
| 2.A.7 | Update cut-Industry `description` text: append "(Beta — contact sales for early access)" | `seeds/industry-templates/*-templates.ts` + admin UI write through API | S — description lives on Industry row |
| 2.A.8 | Docs: `INDUSTRY-GROUPS-CONCEPT.md §3` updated; link this plan + catalog | `memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md` | n/a (docs) |
| 2.A.9 | P5 allocator test: 1 Industry × 3 Tiers = 3 non-empty bundles | `src/test/integration/onboarding-allocator.spec.ts` (new) | L — same input → same output across all 8 Industries |
| 2.A.10 | P6 isolation test: 8 specs mirroring `phase8-tenant-isolation.spec.ts` | `src/test/integration/industry-isolation-{8 industries}.spec.ts` (new) | L — no Industry leaks across tenants |

#### 5.1.2 Effort: 6.5 dev-days

| Step | Days |
|---|---:|
| 2.A.1–2.A.4 (backend + FE filter) | 2.5 |
| 2.A.5 (admin toggle) | 1 |
| 2.A.6 (P3 nav filter) | 0.5 |
| 2.A.7 (cut-Industry description) | 0.5 |
| 2.A.8 (docs) | 0.5 |
| 2.A.9–2.A.10 (tests) | 1.5 |

### 5.2 Phase 2.B — `financial-services`

**Prereqs:** R1, R2, R3, R4, P5. (P2 from §6 for the SIM base class.)

#### 5.2.1 T1 — FS tier-slug migration (must land first)

This MUST land first in Phase 2.B. No Industry data work until T1 is complete.

##### T1 Pre-flight verification (run on Contabo before T1)

```bash
# 1. Audit current FS package tier-slug distribution (these exist in prod after previous seed runs):
ssh contabo 'cd /opt/neurecore/backend/backend && node -e "
  const {PrismaClient} = require(\"@prisma/client\");
  const p = new PrismaClient();
  (async () => {
    const fs = await p.industry.findUnique({where: {slug:\"financial-services\"}});
    if (!fs) { console.log(\"financial-services not seeded\"); process.exit(0); }
    const rows = await p.package.findMany({
      where: {industryId: fs.id},
      select: {slug: true, tierId: true, tier: {select: {slug: true}}},
    });
    console.table(rows.map(r => ({package: r.slug, tier: r.tier.slug})));
    await p.\$disconnect();
  })();
"'
```

Expected: rows show 8 FS packages with tiers `basic | business | professional | enterprise` (legacy slugs).

##### T1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 2.B.T1.1 | Create `prisma/seed-tier-slugs.cjs` exporting canonical `TIER_SLUG` constants | new file | D |
| 2.B.T1.2 | Rewrite `seed-financial-services-packages.cjs`: drop `basic` row, fold `business` rows into `starter` tier (or omit `business` tier entirely) | `prisma/seed-financial-services-packages.cjs` | D |
| 2.B.T1.3 | Add an idempotent data migration: `prisma/migrations/2026MMDD_fs_tier_slug_normalize/migration.sql` that UPDATEs `package.tierId` for any FS package whose current tier slug is `basic` or `business`, mapping them to `starter` or `professional` | migration SQL | D |
| 2.B.T1.4 | Apply migration on Contabo (per `contabo-ops.md §3.8c` — `model_providers`-owned tables don't apply here; `package.tierId` is `neurecore_app`-owned so safe to run as the app user) | `prisma migrate deploy` | n/a |
| 2.B.T1.5 | Re-run `seed-financial-services-packages.cjs` with new tier-slugs; verify row count = 8 with tiers `starter | professional | enterprise` only | seeder | D |
| 2.B.T1.6 | Verify no external consumer reads FS tier slugs (no live FS tenant → confirmed). Document in commit message. | commit message | n/a |

##### T1 Rollback

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  PGPASSWORD=$(grep ^POSTGRES_SUPERUSER_PASSWORD .env | cut -d= -f2-)
  PGPASSWORD=$PGPASSWORD psql -h 127.0.0.1 -U postgres -d neurecore_prod -c "
    UPDATE _prisma_migrations SET finished_at = NULL WHERE migration_name = '"'"'2026MMDD_fs_tier_slug_normalize'"'"';
    DELETE FROM _prisma_migrations WHERE migration_name = '"'"'2026MMDD_fs_tier_slug_normalize'"'"';
  "
  git revert <T1-commit-sha>
  pnpm install --no-frozen-lockfile && ./node_modules/.bin/nest build
  pm2 restart neurecore-backend'
```

#### 5.2.2 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 2.B.1 | Tenant Template seeder using `seed-tenant-template` helper (R2) | `prisma/seed-financial-services-department-template.cjs` (new, ~50 lines via R2 helper) | S — single DepartmentTemplate row per Industry |
| 2.B.2 | Each Tenant Template slot gets one `AgentTemplate` row with role-description prompt per catalog §5.1 | `prisma/seed-financial-services-department-template.cjs` | S — single AgentTemplate per role |
| 2.B.3 | TierAgentPool rows: pick TierAgentPool entries for each (Tier, AgentTemplate) — reused helper | `seed-helpers/seed-tier-agent-pool.cjs` (new, R2 extension) | O — new Tier = new entries, no code |
| 2.B.4 | Wire 8 packages (post T1) using `seed-package` helper (R2) | `prisma/seed-financial-services-packages.cjs` (rewrite via R2) | S — single Package per (industry, tier, slug) |
| 2.B.5 | 3 new project types using `seed-project-types` helper (R2) | `prisma/seeds/project-types/financial-services.json` (extend existing) | O — JSON file extended |
| 2.B.6 | Workspace component: branch on `tenant.industry` for `loans|portfolios|audits|compliance|risk` KPI definitions | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | O — Industry KPI configs in `INDUSTRY_KPI_CONFIGS: Record<industrySlug, KPIConfig>` map; component reads from map |
| 2.B.7 | Approval addon: verify `financial-approval.addon.ts` triggers for `financial-services` (currently F&C-group scoped → should be fine); add `financialSubType`-aware chain selection | `backend/src/modules/approval-chains/addons/financial-approval.addon.ts` | O — chain templates registered via `INDUSTRY_APPROVAL_ADDONS` registry |
| 2.B.8 | Sidecar: wire 4 F&C-shared tools (credit-score, AML, KYC, e-sign) to FS workflows | `sidecar/accounting-sidecar/` (existing); `backend/src/modules/industry/industry-tools.registry.ts` (new, R3 extension) | D — sidecar tools registered via DI; consumers inject `IndustryToolsRegistry` |
| 2.B.9 | SIM-05 runner using base class from §6.2 (P2) | `simulations/SIM-05-Financial-Services-Project-Full-Flow/` | n/a (test) |
| 2.B.10 | Cert: SIM-05 PASS in CI before Phase marked done | CI gate | L — same assertion regardless of Industry |

#### 5.2.3 Effort: 8 dev-days

| Step | Days |
|---|---:|
| 2.B.T1.1–2.B.T1.3 (tier migration) | 0.5 |
| 2.B.1–2.B.5 (data seeding) | 1.5 |
| 2.B.6 (workspace branch) | 1 |
| 2.B.7 (approval addon) | 0.5 |
| 2.B.8 (sidecar) | 1.5 |
| 2.B.9 (SIM-05) | 3 |

### 5.3 Phase 3.A — `technology-digital-services`

**Prereqs:** R1, R2, R3, R4, P5, P1 (§6.1).

#### 5.3.1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 3.A.1 | Verify Run-6 `tech-digital-services-it` template applied to prod; re-run if missing | `prisma/seed-business-technology-templates.cjs` | S — single DepartmentTemplate per Industry |
| 3.A.2 | Wire 8 stub packages using `seed-package` helper (R2) — confirms wiring into `seed-business-composition.cjs` | `prisma/seed-business-composition.cjs` (update) + extend `business-technology-packages.ts` if needed | O — new package = new config row |
| 3.A.3 | 2 new project types using `seed-project-types` helper | `prisma/seeds/project-types/technology-digital-services.json` (extend) | O |
| 3.A.4 | **4 functional workspace modules**: Tickets, Releases, Contracts, Knowledge Base | new pages under `frontend-tenant/src/app/workspace/tickets/`, etc. | S — each page reads/writes one entity type |
| 3.A.5 | Workspace module data models: `Ticket`, `Release`, `Contract`, `Article` — declared in one shared schema file | `frontend-tenant/src/lib/industry-workspace-models.ts` (new) | D — single schema; pages import types |
| 3.A.6 | SIM-06 runner | `simulations/SIM-06-Tech-Project-Full-Flow/` | n/a |
| 3.A.7 | Cert: SIM-06 PASS | CI gate | L |

#### 5.3.2 Effort: 10 dev-days

| Step | Days |
|---|---:|
| 3.A.1 (template verify) | 0.1 |
| 3.A.2 (wire packages) | 0.5 |
| 3.A.3 (project types) | 0.5 |
| 3.A.4 + 3.A.5 (4 workspace modules + models) | 5 |
| 3.A.6 (SIM-06) | 3 |
| 3.A.7 (cert) | 0.4 |
| Buffer | 0.5 |

### 5.4 Phase 3.B — `professional-business-services`

**Prereqs:** R1, R2, R3, R4, P5, P1, P3.

#### 5.4.1 T3 — Drop `professional-legal`

| # | Step | Files | SOLID check |
|---|---|---|---|
| 3.B.T3.1 | Open admin `/packages`; find `professional-legal`; archive via `status: DEPRECATED` (per §3.7 audit; no hard-delete until P10). | Admin UI action | n/a (admin) |
| 3.B.T3.2 | Remove from `seeds/industry-templates/business-technology-packages.ts` exports. | `business-technology-packages.ts` | S — single definition |
| 3.B.T3.3 | Commit with note: legal services cut per proposal §4. | commit message | n/a (docs) |

#### 5.4.2 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 3.B.1 | Tenant Template seeder via `seed-tenant-template` helper | `prisma/seed-professional-business-department-template.cjs` (new, ~50 lines via R2 helper) | S |
| 3.B.2 | 5 packages (post T3) via `seed-package` helper | extend `prisma/seed-business-composition.cjs` | S |
| 3.B.3 | 2 new project types | extend `prisma/seeds/project-types/professional-business-services.json` | O |
| 3.B.4 | **Zero workspace modules** — reuse from Phase 3.A | n/a | O — same nav config block |
| 3.B.5 | SIM-07 runner | `simulations/SIM-07-Consulting-Project-Full-Flow/` | n/a |
| 3.B.6 | Cert: SIM-07 PASS | CI gate | L |

#### 5.4.3 Effort: 5 dev-days

| Step | Days |
|---|---:|
| 3.B.T3.1–3.B.T3.3 (legal cut) | 0.5 |
| 3.B.1 (template) | 1 |
| 3.B.2 (packages) | 0.5 |
| 3.B.3 (project types) | 0.5 |
| 3.B.5 (SIM-07) | 3 |
| Buffer | 0.5 |

### 5.5 Phase 4.A — `retail-commerce-consumer`

**Prereqs:** R1, R2, R3, R4, P5, P1, P3.

#### 5.5.1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 4.A.1 | Tenant Template seeder via helper | `prisma/seed-retail-commerce-department-template.cjs` (new) | S |
| 4.A.2 | 5 existing stubs + 3 new packages via `seed-package` helper | `prisma/seed-business-composition.cjs` (extend) | S |
| 4.A.3 | 3 new project types | extend `prisma/seeds/project-types/retail-commerce-consumer.json` | O |
| 4.A.4 | **7 functional workspace modules** (LARGEST block): Products, Orders, Inventory, Stores, Promotions, Campaigns, Content | new pages under `frontend-tenant/src/app/workspace/products/` etc. | S — each page owns one entity |
| 4.A.5 | T4: confirm Document-typed `Product` works for Inventory (no specialized SKU entity) | `backend/src/modules/documents/` — verify type registry accepts `'product'` | S — generic Document store, no SKU entity |
| 4.A.6 | Workspace data models: `Product` (Document), `Order`, `Store`, `Promotion`, `Campaign`, `ContentItem` | extend `frontend-tenant/src/lib/industry-workspace-models.ts` | D — single types file |
| 4.A.7 | SIM-08 runner (12 stages) | `simulations/SIM-08-Retail-Project-Full-Flow/` | n/a |
| 4.A.8 | Cert: SIM-08 PASS | CI gate | L |

#### 5.5.2 Effort: 12 dev-days

| Step | Days |
|---|---:|
| 4.A.1 (template) | 1.5 |
| 4.A.2 (packages) | 0.5 |
| 4.A.3 (project types) | 0.5 |
| 4.A.4 + 4.A.6 (7 workspace modules + models) | 5 |
| 4.A.5 (T4 verification) | 0.5 |
| 4.A.7 (SIM-08) | 4 |
| Buffer | 0 |

### 5.6 Phase 4.B — `media-communications-creative`

**Prereqs:** R1, R2, R3, R4, P5, P1, **P3 (sub-industry filter must be live)**.

#### 5.6.1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 4.B.1 | Tenant Template seeder via helper | `prisma/seed-media-creative-department-template.cjs` (new) | S |
| 4.B.2 | 2 existing stubs + 3 new packages | extend `prisma/seed-business-composition.cjs` | S |
| 4.B.3 | 3 new project types | extend `prisma/seeds/project-types/media-communications-creative.json` | O |
| 4.B.4 | **Zero new workspace modules** — reuse Campaigns/Content from 4.A; P3 filter hides Products/Orders/Inventory/Stores/Promotions for media tenants | n/a | O — nav config closes for media |
| 4.B.5 | SIM-09 runner | `simulations/SIM-09-Media-Project-Full-Flow/` | n/a |
| 4.B.6 | Cert: SIM-09 PASS | CI gate | L |

#### 5.6.2 Effort: 5 dev-days

| Step | Days |
|---|---:|
| 4.B.1 (template) | 1 |
| 4.B.2 (packages) | 0.5 |
| 4.B.3 (project types) | 0.5 |
| 4.B.5 (SIM-09) | 3 |
| Buffer | 0 |

### 5.7 Phase 5.A — `nonprofit-international`

**Prereqs:** R1, R2, R3, R4, P5, P1, P3, **P13 (DepartmentTemplate category enum)**.

#### 5.7.1 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 5.A.1 | **P13**: convert `DepartmentTemplate.category` from free-text to enum { `financial-compliance`, `business-technology`, `consumer-commerce`, `public-social`, `other` }; migration updates existing rows | `backend/prisma/schema.prisma`, migration, `seed-tenant-template` helper updated | D — single enum value per Industry |
| 5.A.2 | Tenant Template seeder via helper | `prisma/seed-nonprofit-department-template.cjs` (new) | S |
| 5.A.3 | 7 packages (5 starter + 2 enterprise) via `seed-package` helper | new seeder `prisma/seed-nonprofit-international-packages.cjs` (via R2 helper, ~80 lines) | S |
| 5.A.4 | 3 new project types | extend `prisma/seeds/project-types/nonprofit-international.json` | O |
| 5.A.5 | 4 functional workspace modules: Programs, Grants, Field Operations, Cases | new pages under `frontend-tenant/src/app/workspace/programs/` etc. | S |
| 5.A.6 | P3 filter hides Licenses + Inspections for NGO tenants | `industryNavigation.ts` — add `subIndustries: ['nonprofit-international']` to nav entries that NGO should see; leave others absent | O — additions to data, no edits |
| 5.A.7 | SIM-10 runner | `simulations/SIM-10-NGO-Project-Full-Flow/` | n/a |
| 5.A.8 | Cert: SIM-10 PASS | CI gate | L |

#### 5.7.2 Effort: 9.5 dev-days

| Step | Days |
|---|---:|
| 5.A.1 (P13 enum) | 0.5 |
| 5.A.2 (template) | 2 |
| 5.A.3 (packages) | 1 |
| 5.A.4 (project types) | 0.5 |
| 5.A.5 (4 workspace modules) | 3 |
| 5.A.6 (P3 filter) | 0 (already live) |
| 5.A.7 (SIM-10) | 3 |
| Buffer | 0.5 |

### 5.8 Phase 5.B — `special-purpose-organizations` (T8 cross-group)

**Prereqs:** R1, R2, R3, R4, P5, P1, P3, **P4 (cross-group Package FK), P9 (inheritance UI)**.

#### 5.8.1 T8 — Cross-group Package reference (P4 + P9)

| # | Step | Files | SOLID check |
|---|---|---|---|
| 5.B.T8.1 | Migration: add `Package.parentPackageId String?` + FK to `Package.id` + index | `backend/prisma/schema.prisma`, migration `20260915_package_parent_id` | S — single inheritance column |
| 5.B.T8.2 | Resolver: `TenantBlueprintResolver.resolveForIndustry(...)` follows `parentPackageId` chain and merges inherited DepartmentTemplate + AgentTemplate + Feature rows | `backend/src/modules/onboarding/onboarding.service.ts` | O — new parent chain = new package config, no resolver code change |
| 5.B.T8.3 | Admin package-edit page: inherited slots rendered as **read-only badges** with tooltip "Inherited from `{parentPackageSlug}`" | `frontend-admin/src/app/packages/[id]/edit/page.tsx` | O — read-only display, no new logic for editors |

#### 5.8.2 Steps

| # | Step | Files | SOLID check |
|---|---|---|---|
| 5.B.1 | Tenant Template seeder via helper | `prisma/seed-special-purpose-department-template.cjs` (new) | S |
| 5.B.2 | 4 packages via `seed-package` helper; last one (`spo-family-office-reporting`) sets `parentPackageId: 'accounting-operations'` | `prisma/seed-special-purpose-organizations-packages.cjs` (new) | S |
| 5.B.3 | 2 new project types | extend `prisma/seeds/project-types/special-purpose-organizations.json` | O |
| 5.B.4 | 3 functional workspace modules: Operations, Assets, Documents | new pages under `frontend-tenant/src/app/workspace/operations/` etc. | S |
| 5.B.5 | T7: `compliance-officer` AgentTemplate registered to `other` group (separate from F&C `Compliance Auditor`) | extend `seed-special-purpose-department-template.cjs` | L — distinct slug + `TierAgentPool` Industry-scoping |
| 5.B.6 | SIM-11 runner (10 stages; tests inheritance behavior) | `simulations/SIM-11-SPO-Project-Full-Flow/` | n/a |
| 5.B.7 | Cert: SIM-11 PASS, including inheritance assertion (SPO tenant has Bookkeeper & Controller agent after onboarding) | CI gate | L |

#### 5.8.3 Effort: 7.5 dev-days

| Step | Days |
|---|---:|
| 5.B.T8.1–5.B.T8.3 (T8 FK + UI) | 1.5 |
| 5.B.1 (template) | 1.5 |
| 5.B.2 (packages incl. T8 chain) | 1 |
| 5.B.3 (project types) | 0.5 |
| 5.B.4 (3 workspace modules) | 1.5 |
| 5.B.5 (T7 compliance-officer) | 0 (covered in template) |
| 5.B.6 (SIM-11) | 3 |
| Buffer | 0 |

---

## 6. Shared infrastructure

### 6.1 P1 — Generic Workspace module builder

**Goal:** 18 workspace-module pages (4 + 7 + 4 + 3 across Phases 3.A, 4.A, 5.A, 5.B) all share one builder pattern, not 18 copies.

#### 6.1.1 Architecture

- `frontend-tenant/src/lib/industry-workspace-models.ts` — shared TypeScript types for every workspace module's data model.
- `frontend-tenant/src/components/industry/WorkspaceModuleBuilder.tsx` — single generic React component.
- Per-module config in `frontend-tenant/src/app/workspace/{module}/config.ts` (sibling to `page.tsx`).
- Each page becomes a 5-line wrapper:

```typescript
// frontend-tenant/src/app/workspace/tickets/page.tsx
import { ticketsConfig } from './config';
export default function TicketsPage() {
  return <WorkspaceModuleBuilder config={ticketsConfig} />;
}
```

#### 6.1.2 Shared types — `frontend-tenant/src/lib/industry-workspace-models.ts`

```typescript
export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'enum' | 'boolean' | 'markdown' | 'json';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];       // for type='enum'
  hint?: string;
  placeholder?: string;
  encrypted?: boolean;
}

export type RelationshipType = 'belongsTo' | 'hasMany';

export interface RelationshipDef {
  type: RelationshipType;
  target: 'Customer' | 'Agent' | 'Project' | 'User';
  label: string;
}

export type WorkspaceAction = 'create' | 'update' | 'delete' | 'assign' | 'resolve' | 'close' | 'archive';
export type WorkspaceView = 'list' | 'detail' | 'edit' | 'kanban' | 'calendar';

export interface WorkspaceModuleConfig {
  id: string;                       // 'tickets'
  label: string;                    // 'Tickets'
  dataModel: string;                // 'Ticket' — name of backend entity
  apiBase: string;                  // '/api/v1/tickets'
  fields: FieldDef[];
  relationships?: Record<string, RelationshipDef>;
  actions: WorkspaceAction[];
  views: WorkspaceView[];
  /** Escape hatch per Risk R11: custom render slot for non-generic UI. */
  customRender?: React.ReactNode;
}
```

#### 6.1.3 Builder — `frontend-tenant/src/components/industry/WorkspaceModuleBuilder.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceModuleConfig, FieldDef } from '@/lib/industry-workspace-models';
import { api } from '@/lib/api';
import { GlassPanel } from '@/components/home/GlassPanel';
import { TextField, SelectField } from '@/components/creatio/FormField';

interface Props { config: WorkspaceModuleConfig; }

export function WorkspaceModuleBuilder({ config }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<unknown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [config.id]);

  async function load() {
    const res = await api.get(config.apiBase);
    setItems(res.data?.data ?? []);
  }

  async function create() {
    setBusy(true);
    try {
      const res = await api.post(config.apiBase, formState);
      setItems([...items, res.data?.data]);
      setFormState({});
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4">
        <GlassPanel>{/* list view — see §6.1.4 */}</GlassPanel>
      </div>
      <div className="col-span-8">
        {config.customRender ?? <GenericDetailView config={config} />}
      </div>
    </div>
  );
}

function GenericDetailView({ config }: { config: WorkspaceModuleConfig }) {
  // Renders a form from config.fields — pure data-driven.
  // ~40 lines; full code in PR for Phase 3.A.
}
```

#### 6.1.4 Example: `frontend-tenant/src/app/workspace/tickets/config.ts`

```typescript
import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const ticketsConfig: WorkspaceModuleConfig = {
  id: 'tickets',
  label: 'Tickets',
  dataModel: 'Ticket',
  apiBase: '/api/v1/tickets',
  fields: [
    { key: 'title',     label: 'Title',     type: 'text',     required: true },
    { key: 'severity',  label: 'Severity',  type: 'enum',     required: true, options: ['LOW','MEDIUM','HIGH','CRITICAL'] },
    { key: 'slaDueAt',  label: 'SLA Due',   type: 'datetime', required: true },
    { key: 'status',    label: 'Status',    type: 'enum',     required: true, options: ['OPEN','IN_PROGRESS','RESOLVED','CLOSED'] },
    { key: 'body',      label: 'Description', type: 'markdown' },
  ],
  relationships: {
    customer: { type: 'belongsTo', target: 'Customer', label: 'Customer' },
    assignedAgent: { type: 'belongsTo', target: 'Agent', label: 'Assigned Agent' },
  },
  actions: ['create', 'update', 'assign', 'resolve', 'close'],
  views: ['list', 'detail', 'edit', 'kanban'],
};
```

#### 6.1.5 Files + effort

- **3 new files:** `industry-workspace-models.ts` (~100 lines), `WorkspaceModuleBuilder.tsx` (~150 lines), per-module `config.ts` (10–25 lines each).
- **0 new pages** — each existing `page.tsx` becomes a 5-line wrapper.
- **Effort:** 2 dev-days.

#### 6.1.6 Risk (R11)

If a module needs custom UI not expressible in config (e.g. a kanban with drag-drop), use `customRender?: ReactNode` slot. Documented in §8 R11.

### 6.2 P2 — SIM-XX runner base class

**Goal:** 7 new SIM runners (SIM-05 → SIM-11) share Playwright helpers + FE-first assertion utilities.

#### 6.2.1 Architecture

- `simulations/_lib/base-runner.ts` — abstract base class with shared utilities.
- `simulations/_lib/synthetic-tenant.ts` — fixture creator for per-test-class tenants (replaces ad-hoc DB seeding in SIM-04).
- Each SIM-XX runner: 1 file, ~50–80 lines, extending `BaseSimRunner`.

#### 6.2.2 Base class — `simulations/_lib/base-runner.ts`

```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createSyntheticTenant, SyntheticTenant } from './synthetic-tenant';
import { loginAsSuperAdmin } from './auth';

export interface SimStage {
  name: string;
  run: () => Promise<void>;
}

export interface CustomerFormData {
  name: string;
  industry: string;
  primaryEmail?: string;
  primaryPhone?: string;
  tags?: string[];
  billingInfo?: Record<string, unknown>;
}

export interface ProjectFormData {
  projectType: string;
  name: string;
  customerId: string;
  // Other fields are project-type-specific; subclasses inject.
}

export abstract class BaseSimRunner {
  protected browser!: Browser;
  protected context!: BrowserContext;
  protected page!: Page;
  protected tenant!: SyntheticTenant;

  /** Override in subclass. */
  protected abstract stages(): SimStage[];

  /** Entry point. */
  async run(): Promise<void> {
    await this.setup();
    try {
      for (const stage of this.stages()) {
        console.log(`[SIM] ${stage.name}`);
        await stage.run();
      }
    } finally {
      await this.teardown();
    }
  }

  async setup(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.tenant = await createSyntheticTenant({
      industry: this.industrySlug(),
      tier: 'starter',
    });
    await loginAsSuperAdmin(this.page);
  }

  async teardown(): Promise<void> {
    await this.context.close();
    await this.browser.close();
    await this.tenant.cleanup();
  }

  /** Override in subclass. */
  protected abstract industrySlug(): string;

  // ─── Common assertions ────────────────────────────────────────────────
  async assertTenantOnboarded(industry: string): Promise<void> {
    const url = this.page.url();
    if (!url.includes(`/tenants/${this.tenant.id}`)) throw new Error(`Tenant onboarding navigation failed: ${url}`);
    const body = await this.page.locator('h1').first().innerText();
    if (!body.includes(industry)) throw new Error(`Industry label not visible: ${body}`);
  }

  async assertPackageInstalled(packageName: string): Promise<void> {
    const exists = await this.page.getByText(packageName).count();
    if (exists === 0) throw new Error(`Package "${packageName}" not visible after onboarding`);
  }

  async assertWorkspaceModuleVisible(moduleId: string): Promise<void> {
    await this.page.goto(`/workspace/${moduleId}`);
    const title = await this.page.locator('h1').first().innerText();
    if (!title) throw new Error(`Module "${moduleId}" page did not render`);
  }

  async assertProjectStage(projectId: string, expectedStage: string): Promise<void> {
    const res = await this.page.request.get(`/api/v1/projects/${projectId}`);
    const data = await res.json();
    if (data.stage !== expectedStage) throw new Error(`Project stage mismatch: expected ${expectedStage}, got ${data.stage}`);
  }

  async assertCrossTenantIsolation(tenantA: string, tenantB: string): Promise<void> {
    const res = await this.page.request.get(`/api/v1/customers?tenantId=${tenantB}`, {
      headers: { 'x-tenant-id': tenantA },
    });
    if (res.status() !== 403 && res.status() !== 404) {
      throw new Error(`Cross-tenant access succeeded: ${res.status()}`);
    }
  }

  // ─── Form-driven actions ─────────────────────────────────────────────
  async createCustomerViaForm(data: CustomerFormData): Promise<string> {
    await this.page.goto('/customers');
    await this.page.getByRole('button', { name: 'New Customer' }).click();
    await this.page.getByLabel('Name').fill(data.name);
    await this.page.getByLabel('Industry').selectOption(data.industry);
    if (data.primaryEmail) await this.page.getByLabel('Primary Email').fill(data.primaryEmail);
    if (data.tags?.length) await this.page.getByLabel('Tags').fill(data.tags.join(', '));
    await this.page.getByRole('button', { name: 'Create Customer' }).click();
    await this.page.waitForURL(/\/customers\/[a-f0-9-]+/);
    return this.page.url().split('/').pop()!;
  }

  async createProjectViaForm(projectType: string, data: ProjectFormData): Promise<string> {
    await this.page.goto('/projects/new');
    await this.page.getByLabel('Project Type').selectOption(projectType);
    await this.page.getByLabel('Name').fill(data.name);
    await this.page.getByLabel('Customer').selectOption(data.customerId);
    await this.page.getByRole('button', { name: 'Create Project' }).click();
    await this.page.waitForURL(/\/projects\/[a-f0-9-]+/);
    return this.page.url().split('/').pop()!;
  }
}
```

#### 6.2.3 Synthetic tenant fixture — `simulations/_lib/synthetic-tenant.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface SyntheticTenant {
  id: string;
  slug: string;
  industry: string;
  tier: string;
  cleanup: () => Promise<void>;
}

export async function createSyntheticTenant(opts: { industry: string; tier: 'starter' | 'professional' | 'enterprise' }): Promise<SyntheticTenant> {
  const prisma = new PrismaClient();
  const slug = `sim-tenant-${randomUUID().slice(0, 8)}`;

  // Create tenant + run allocator.
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `SIM Tenant ${slug}`,
      industry: opts.industry,
      tierSlug: opts.tier,
    },
  });

  // Trigger onboarding allocator (same code path as real onboarding).
  // Implementation: shell out to a CLI or call OnboardingService directly.
  // For now, expect the runner caller to have seeded packages via seeder.

  return {
    id: tenant.id,
    slug,
    industry: opts.industry,
    tier: opts.tier,
    cleanup: async () => {
      // Cascade delete: tenant + departments + agents + projects.
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    },
  };
}
```

#### 6.2.4 Example: `simulations/SIM-05-Financial-Services-Project-Full-Flow/runner.ts`

```typescript
import { BaseSimRunner, SimStage } from '../_lib/base-runner';
import { seedFinancialServicesPackages } from './seed-fixtures';

export class Sim05Runner extends BaseSimRunner {
  protected industrySlug() { return 'financial-services'; }

  protected stages(): SimStage[] {
    return [
      { name: 'Onboard synthetic financial-services tenant', run: () => this.assertTenantOnboarded('financial-services') },
      { name: 'Verify 8 FS packages installed', run: async () => {
        for (const pkg of ['fs-foundation', 'fs-client-onboarding-kyc', 'fs-wealth-management', 'fs-lending',
                          'fs-banking-core', 'fs-insurance-claims', 'fs-investment-management', 'fs-enterprise-platform']) {
          await this.assertPackageInstalled(pkg);
        }
      }},
      { name: 'Create client (BANKING sub-type)', run: async () => {
        const customerId = await this.createCustomerViaForm({
          name: 'Test Bank Corp',
          industry: 'financial-services',
          primaryEmail: 'ops@testbank.com',
        });
        this.tenant.testCustomerId = customerId;
      }},
      { name: 'Workspace extras visible (loans, portfolios, compliance)', run: async () => {
        for (const m of ['loans', 'portfolios', 'compliance']) await this.assertWorkspaceModuleVisible(m);
      }},
      // ... 8 more stages
    ];
  }
}

new Sim05Runner().run().catch((err) => { console.error(err); process.exit(1); });
```

#### 6.2.5 Files + effort

- **3 new lib files:** `base-runner.ts` (~200 lines), `synthetic-tenant.ts` (~80 lines), `auth.ts` (~50 lines).
- **7 new SIM runners:** 50–80 lines each.
- **Effort:** 2 dev-days for the base + ~3 dev-days for the 7 runners total = 5 dev-days (but the base class saves ~3 dev-days vs building each from scratch, so net 2 dev-days).

#### 6.2.6 Risk (R8)

SIM-04 has known-good Playwright config (`playwright.config.ts` headless Chromium, default viewport 1280×720, no animations). Reuse that exact config for SIM-05+; never customize per-runner.

### 6.3 Feature flag rollout coordination

**Use the existing `Feature` table + Hermes feature flag system (`future-plans.md §3.7`).**

Each Phase ships behind a flag:
- `PRUNED_FS_ENABLED` (Phase 2.B)
- `PRUNED_TECH_ENABLED` (Phase 3.A)
- `PRUNED_PROFESSIONAL_ENABLED` (Phase 3.B)
- `PRUNED_RETAIL_ENABLED` (Phase 4.A)
- `PRUNED_MEDIA_ENABLED` (Phase 4.B)
- `PRUNED_NONPROFIT_ENABLED` (Phase 5.A)
- `PRUNED_SPO_ENABLED` (Phase 5.B)

Default `false` until cert gate passes. `PRUNED_PICKER_V2` (Phase 2.A) also gated.

**Why this matters for SOLID:** All Phase rollouts follow the same flag pattern; no per-Phase rollout code.

**Effort:** 0 dev-days (uses existing infra).

---

## 7. Testing & certification

### 7.1 Test layers

| Layer | Tool | Coverage |
|---|---|---|
| **Unit** | Jest | Pure functions: `getIndustryNavConfig`, `getCustomerFieldDefs`, `resolveForIndustry`, `seedPackage`, `seedTenantTemplate` |
| **Integration (DB)** | Jest + Prisma + test DB | R5 (allocator audit), R6 (isolation tests), package resolver, feature gate |
| **E2E (FE-first)** | Playwright (via P2 base runner) | SIM-04 → SIM-11, asserting browser-driven flows against `https://hq.neurecore.com` |
| **SOLID guard** | Regex grep in CI | §2.7 — 6 patterns, fails PR if any reintroduce duplication |
| **Admin E2E** | Playwright | Admin UI flows: create Industry, edit Package composition, deploy Tenant Template |

### 7.2 Cert gate definition

A Phase is "cert done" when **all** of the following are true:

1. SIM-XX PASS in CI for the Phase's Industry.
2. The 8 mandatory invariants (`PRUNED-TAXONOMY-PROPOSAL.md §14.2`) hold for the new Industry.
3. Phase 8 cross-tenant isolation test passes for the new Industry.
4. SOLID guard is green for all PRs in the Phase.
5. Admin UI CRUD verified via admin-E2E test (create/edit/delete the new Industry's Tenant Template + 1 sample Package).
6. `Industry.isActive = true` flag flipped in production (post-rollout, gated by §10.2).

### 7.3 Test-data strategy

For each Phase, the SIM-XX runner uses a **synthetic tenant** created via:

- `prisma/seed-synthetic-tenant.cjs` (helper, R2 extension) — creates a tenant with `industry: {phase.industrySlug}`, `tier: starter`, runs onboarding allocator, returns `tenantId`.
- Tenant is **per-test-class** (created in `beforeAll`, destroyed in `afterAll`); no cross-test pollution.
- Cross-tenant isolation tests use two synthetic tenants with different Industries + identical package types.

---

## 8. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|:-:|:-:|---|---|
| **R1** | R1 constants refactor introduces a circular import (constants → module → constants) | M | M | Land R1 in isolation; visual + Jest smoke after each file migration | Refactor lead |
| **R2** | R2 seeder helper changes break 6 existing seeders | H | M | Mass-refactor commit + dry-run each seeder with `--check` flag before production | Refactor lead |
| **R3** | R3 provider interfaces require restructuring NestJS modules beyond estimate | M | H | Time-box to 1.5 dev-days; if blown, defer non-critical interfaces to Stage 2 | Refactor lead |
| **R4** | SOLID guard CI has false positives (greps over `.test.ts` files that legitimately contain literal strings) | H | L | Exclude `*.spec.ts`, `*.test.ts`, `__tests__/` from grep; maintain allow-list file | DevOps |
| **R5** | Phase 4.A 7 workspace modules exceeds 5 dev-day estimate | M | M | Track daily; if behind by day 3 of 5, cut Content module to stub + ship in 4.B | Phase 4.A lead |
| **R6** | T8 cross-group FK regresses existing tenant onboarding (e.g. Mali breaks when `parentPackageId` is added to schema) | L | H | Migration adds column nullable + index only; no resolver change until Phase 5.B. Mali tested via integration test before/after | Phase 5.B lead |
| **R7** | Sub-industry filter (P3) breaks Industry-aware components that previously read `industryGroup` | M | M | Audit all `tenant.industryGroup` reads; introduce `tenant.industry` as primary; `industryGroup` becomes derived cache | Frontend lead |
| **R8** | SIM-XX FE-first runners flaky on real browser (different from SIM-04's known-good config) | M | M | Reuse SIM-04's exact Playwright config; add `waitFor` helpers in P2 base class | QA lead |
| **R9** | Picker cut-down (Phase 2.A) accidentally hides Industries that existing production tenants depend on | L | H | Audit `Tenant.industry` distribution before flip; only flip after 7-day observation period | Ops lead |
| **R10** | T1 tier-slug migration breaks external integrations reading `basic|business` | L | H | No live FS tenant today (verified); commit message documents the legacy-slug removal | Phase 2.B lead |
| **R11** | §6.1 P1 workspace module builder doesn't generalize (some module needs custom UI not expressible in config) | M | M | Builder accepts a `customRender?: ReactNode` slot; document escape hatch | Frontend lead |
| **R12** | SIM-XX cert gate (Phase marked done) is satisfied in CI but fails on first production tenant | M | H | "First tenant shadow" period — 2 weeks of internal usage before public launch | PM |

---

## 9. Effort totals

### 9.1 Per-phase effort

| Phase | Steps | Dev-days | Engineers | Calendar |
|---|---|---:|---:|---|
| **Refactor (R1–R4)** | §4 | 5 | 1–2 | Week 1 (parallel to Phase 2.A prep) |
| **Phase 2.A** | §5.1 | 6.5 | 1 | Week 1–2 |
| **Phase 2.B** | §5.2 | 8 | 1–2 | Week 2–4 |
| **Phase 3.A** | §5.3 | 10 | 1–2 | Week 4–6 |
| **Phase 3.B** | §5.4 | 5 | 1 | Week 6–7 |
| **Phase 4.A** | §5.5 | 12 | 1–2 | Week 7–10 |
| **Phase 4.B** | §5.6 | 5 | 1 | Week 10–11 |
| **Phase 5.A** | §5.7 | 9.5 | 1 | Week 11–13 |
| **Phase 5.B** | §5.8 | 7.5 | 1 | Week 13–14 |
| **Shared infra (P1+P2)** | §6 | 4 | 1 | Week 1 (start), Week 5–8 (P1 spread) |
| **Test infra** | §7 | 4 | 1 | Week 1–2 |
| **Total v1** | | **~76.5** | | **~14 weeks (≈ 2 engineers × 7 weeks, or 1 engineer × 14 weeks)** |

### 9.2 Effort by category

| Category | Dev-days | % of total |
|---|---:|---:|
| Refactor (foundational) | 5 | 6.5% |
| Data seeding (R2-driven) | 10 | 13% |
| Workspace modules (P1-driven) | 14 | 18% |
| SIM runners (P2-driven) | 21 | 27.5% |
| UI updates (admin + tenant) | 6 | 8% |
| Backend module extensions (approval addons, sidecar) | 4 | 5% |
| Shared infra (P1+P2) | 4 | 5% |
| Test infra | 4 | 5% |
| Buffer (Phase-uncertain) | 7.5 | 10% |
| **Total** | **76.5** | **100%** |

### 9.3 Parallelization opportunities

- R1 + R3 can run in parallel (different files, different engineers).
- Phase 3.A + Phase 3.B can run in parallel (different Industries, same B&T nav block — minimal conflict if P3 filter live).
- Phase 5.A + Phase 5.B can run in parallel.
- Phase 4.B blocks on Phase 4.A (reuses Campaigns/Content pages).
- R2 blocks every Phase that creates a new Industry seeder (i.e. all of 2.B, 3.B, 4.A, 4.B, 5.A, 5.B).
- P1 + P2 can run continuously across all phases.

### 9.4 Deferred to Stage 2 (per proposal §7.9 Tier C)

| Item | Effort | Trigger |
|---|---:|---|
| P10 — Package hard-delete with FK-safety | 1 dev-day | When > 100 packages exist |
| P11 — Tier hard-delete with billing-cascade warning | 1 dev-day | If a tenant requests deletion of their tier |
| P12 — Package bulk-clone / version-bump | 2 dev-days | Stage 2 capability depth |
| P13 — (was here, moved to Phase 5.A) | n/a | Already in §5.7.1 |
| Hermes tools (per Industry) | 3 dev-days | Optional |
| **Total Stage 2** | **~7 dev-days** | |

---

## 10. Rollout & deployment

> **Course correction (2026-07-31):** the original §10 referenced a new `Industry.isActive` column — wrong. `Industry.status: IndustryStatus { ACTIVE | ARCHIVED }` already exists. This section uses the existing enum. Also: deploy commands canonicalized against `contabo-ops.md §3.2` (NOT the legacy `rebuild.sh`).

### 10.1 Rollout sequence

The 14-week timeline ends with code complete + cert done. Rollout to production:

| Week | Action | `Industry.status` state | Feature flag state |
|---|---|---|---|
| Week 1 | R1+R2+R3+R4 merge to main | All 16 Industries `ACTIVE` (default) | All `PRUNED_*` flags `false` |
| Week 2 | Phase 2.A merge (picker filter + P3) | 8 KEPT `ACTIVE`, 8 CUT `ARCHIVED` (flip via `set-cut-industries-archived.cjs`) | `PRUNED_PICKER_V2=false` (new code deployed, no behavior change yet) |
| Week 2 | Phase 2.A observe (7-day shadow) | Production tenants use picker; analytics check no Industry cut affects existing tenants | Same |
| Week 3 | Flip `PRUNED_PICKER_V2=true` | Same | Picker closes for cut Industries |
| Week 4 | Phase 2.B merge (financial-services tenant template + packages + 3 project types + workspace branch) | financial-services stays `ACTIVE` | `PRUNED_FS_ENABLED=false` (data seeded, UI hidden) |
| Week 5 | Phase 2.B observe (7-day shadow) + T1 tier-slug migration window | Same | Same |
| Week 6 | Flip `PRUNED_FS_ENABLED=true` | Same | FS Industry selectable in picker + onboarding allocator resolves |
| Week 6 | Phase 3.A merge (technology-digital-services) | technology-digital-services `ACTIVE` | `PRUNED_TECH_ENABLED=false` |
| Week 7 | Flip `PRUNED_TECH_ENABLED=true` | Same | |
| Week 7 | Phase 3.B merge (professional-business-services + T3 legal cut) | professional-business-services `ACTIVE` | `PRUNED_PROFESSIONAL_ENABLED=false` |
| Week 8 | Flip `PRUNED_PROFESSIONAL_ENABLED=true` | Same | |
| Week 9 | Phase 4.A merge (retail-commerce-consumer) | retail-commerce-consumer `ACTIVE` | `PRUNED_RETAIL_ENABLED=false` |
| Week 10 | Flip `PRUNED_RETAIL_ENABLED=true` | Same | |
| Week 10 | Phase 4.B merge (media-communications-creative) | media-communications-creative `ACTIVE` | `PRUNED_MEDIA_ENABLED=false` |
| Week 11 | Flip `PRUNED_MEDIA_ENABLED=true` | Same | |
| Week 11 | Phase 5.A merge (nonprofit-international + P13 enum migration) | nonprofit-international `ACTIVE` | `PRUNED_NONPROFIT_ENABLED=false` |
| Week 12 | Flip `PRUNED_NONPROFIT_ENABLED=true` | Same | |
| Week 12 | Phase 5.B merge (special-purpose-organizations + T8 cross-group FK + P9 inheritance UI) | special-purpose-organizations `ACTIVE` | `PRUNED_SPO_ENABLED=false` |
| Week 13 | Flip `PRUNED_SPO_ENABLED=true` | All 8 KEPT `ACTIVE`; 8 CUT `ARCHIVED` | All 8 industries live |
| Week 14 | Final cert: SIM-05..SIM-11 PASS; admin-E2E passes; marketing copy live | Stable | All flags `true` |

### 10.2 Per-Phase gate

For each Phase, the **cert gate** (§7.2) AND the **Contabo deploy gate** must both pass:

1. **Code merged to main** — CI green (SOLID guard + unit + integration tests + cert runner + admin-E2E).
2. **DR snapshot** (§10.6.1) created before any Contabo write.
3. **7-day shadow period** in production with the new Industry's `status = ACTIVE` but feature flag `false` (data seeded, UI hidden).
4. **Tenant distribution audit** — verify zero production tenants are on a cut Industry before flipping its status (per `contabo-ops.md §3.3b` precedent + Risk R9).
5. **Flag flip** to `PRUNED_{PHASE}_ENABLED=true` AND any seed-driven `Industry.status` updates (if Phase 2.A still in progress).
6. **First tenant** onboarded onto the new Industry by Sales/CS (engineering on standby for 14 days).
7. **14-day observation** — review support tickets + analytics before next Phase cert gate.

### 10.3 Contabo deploy cheat sheet (canonical commands)

> Source: `neurecore/memory-bank-arc/contabo-ops.md §3.2` + `neurecore/memory-bank/contabo-ops.md §2.1`. **Not the legacy `rebuild.sh`.**

#### 10.3.1 Backend rebuild (when Phase touches backend code)

```bash
# SSH + rebuild (canonical per §3.2):
ssh contabo '
  cd /opt/neurecore/backend/backend &&
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) &&
  ./node_modules/.bin/prisma generate &&
  ./node_modules/.bin/prisma migrate deploy &&
  ./node_modules/.bin/nest build
'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend && pm2 save'

# Permission caveat (per §3.8c): if migration touches `model_providers` or other
# postgres-owned tables, run as `postgres` superuser instead of `neurecore_app`.
```

#### 10.3.2 Frontend-tenant rebuild (most Phases touch this)

```bash
# LOCAL deploy (preferred per §3.2 — uses scripts/deploy.sh which does
# rsync + pnpm install + next build + PM2 restart):
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant

# OR SSH-direct rebuild:
ssh contabo '
  cd /opt/neurecore/frontend-tenant &&
  pnpm install --no-frozen-lockfile 2>&1 | tail -3 &&
  ./node_modules/.bin/next build
'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant && pm2 save'

# Lockfile caveat (per §4.3): `--frozen-lockfile` may fail because
# `compression` + `lru-cache` were added to backend/package.json 2026-07-21
# without regenerating the lockfile. Use `--no-frozen-lockfile` fallback.
```

#### 10.3.3 Frontend-admin rebuild (rare; only when admin packages/industries pages change)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh admin

# OR:
ssh contabo 'cd /opt/neurecore/frontend-admin && pnpm install --no-frozen-lockfile 2>&1 | tail -3 && ./node_modules/.bin/next build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-admin && pm2 save'
```

#### 10.3.4 Database-only updates (Phase 2.A only)

```bash
# Phase 2.A only — flips 8 Industries from ACTIVE → ARCHIVED.
# No schema change, no migration. Script uses Prisma client.
ssh contabo 'cd /opt/neurecore/backend/backend && node prisma/set-cut-industries-archived.cjs --check'  # dry-run
ssh contabo 'cd /opt/neurecore/backend/backend && node prisma/set-cut-industries-archived.cjs'          # apply
```

#### 10.3.5 Env vars — BOTH files

Per §3.8b: NestJS `ConfigurationModule` loads `envFilePath: ['.env.production', '.env']` when `NODE_ENV=production`. **`.env.production` wins.** If a Phase adds an env flag (e.g. `PRUNED_FS_ENABLED`), edit **both**:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  grep "^PRUNED_FS_ENABLED" .env .env.production
  echo "PRUNED_FS_ENABLED=false" | tee -a .env
  echo "PRUNED_FS_ENABLED=false" | tee -a .env.production'
```

Then rebuild + restart.

#### 10.3.6 DON'Ts (per §4)

- DON'T `pm2 start npx -- ...` — use `startOrReload ecosystem.config.js`.
- DON'T raw `git stash` — scoped only.
- DON'T rsync `.env`, `.env.local`, `.env.production` (deploy.sh already excludes).
- DON'T CORS in NestJS — proxy handles it.
- DON'T restart without rebuilding.
- DON'T skip `pm2 save` after reload.
- DON'T touch the other apps' processes (`gfcportal`, `shahisoft-nextjs`, etc.) or their ports (3001/3100/3500).

### 10.4 Rollback plan (per-Phase)

Each Phase has a one-line DB-side rollback + an artifact-side rollback:

#### 10.4.1 DB-side rollback (idempotent)

```bash
# Flip the Phase's Industry back to ACTIVE (Phase 2.A only does this for the 8 cuts):
ssh contabo 'cd /opt/neurecore/backend/backend
  node -e "
    const {PrismaClient} = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      await p.industry.updateMany({where: {slug: {in: [\"{phase-industry-slug}\"]}}, data: {status: \"ACTIVE\"}});
      console.log(\"Reverted to ACTIVE\");
      await p.\$disconnect();
    })();
  "'
```

#### 10.4.2 Feature flag rollback

```bash
# No special env step needed — flip via admin UI or env edit + backend restart.
ssh contabo 'cd /opt/neurecore/backend/backend
  sed -i "s/^PRUNED_{PHASE}_ENABLED=true/PRUNED_{PHASE}_ENABLED=false/" .env .env.production
  pm2 restart neurecore-backend'
```

#### 10.4.3 FE artifact rollback (restore pre-Phase `.next/` snapshot)

Per §3.3b: snapshot was created in §10.6.1. Restore:

```bash
ssh contabo "
  SNAP=\$(ls -dt /opt/neurecore/_archives/$(date +%Y%m%d)-pre-{phase-slug}-fe | head -1)
  cd /opt/neurecore/frontend-tenant && rm -rf .next && tar -xzf \$SNAP/frontend-tenant-.next.tar.gz
  cd /opt/neurecore/frontend-admin  && rm -rf .next && tar -xzf \$SNAP/frontend-admin-.next.tar.gz
  pm2 restart neurecore-tenant neurecore-admin"
```

**No data destruction on rollback** — Phase-rolled-back Industries remain in DB. Tenants already onboarded keep their Industry; only new onboarding closes.

### 10.5 Per-Phase Contabo deploy sub-procedure

Every Phase 2.B–5.B follows this checklist (Phase 2.A is a special case — only DB update + frontend-tenant rebuild):

#### 10.5.1 Pre-deploy (1 hour before deploy window)

1. **§10.6.1 DR snapshot** — snapshot backend-dist + frontend .next + ecosystem.config.js.
2. **Tenant distribution audit** — `SELECT industry, count(*) FROM tenants GROUP BY industry` (via `node -e "..."` Prisma). If any tenant is on a cut Industry for this Phase, **stop and notify**.
3. **Code freeze** — merge PR; no other changes until deploy completes.
4. **CI green check** — SOLID guard + unit + integration + cert runner (SIM-XX for this Phase) + admin-E2E.

#### 10.5.2 Deploy

5. **Backend rebuild** (§10.3.1) — only if Phase touches backend code (most do). `prisma migrate deploy` runs pending migrations; `nest build` compiles TS.
6. **Frontend-tenant rebuild** (§10.3.2) — for any Phase touching tenant UI (most do).
7. **Frontend-admin rebuild** (§10.3.3) — only for Phases 5.A (P13 enum UI), 5.B (P9 inheritance UI), and any future catalog admin changes.
8. **PM2 restart sequence** — backend first, then admin, then tenant. Each followed by `pm2 save`.
9. **CORS proxy untouched** — `cors-proxy.js` doesn't change in this plan. Per §3.6 (DO test CORS after editing) we skip this check.

#### 10.5.3 Verify (FE-first, per SIM-04 lessons)

10. **Health probes** (§9.1 contabo-ops):
    ```bash
    curl -sk https://brain.neurecore.com/api/v1/health
    curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/
    curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/
    ```
11. **PM2 status** — `pm2 list` shows all 4 PM2 processes online (per contabo-ops §1).
12. **SIM-XX runner** — run the Phase's cert runner from CI artifacts. Must PASS.
13. **Browser smoke** — log in as Mali (accounting tenant) → verify IconRail + Customer form unchanged. Log in as the new-Industry tenant → verify nav + dropdown + workspace modules.
14. **Tenant isolation** — verify no cross-tenant leakage (Phase 8 spec still PASS for Mali + new tenant).

#### 10.5.4 Observe (14 days)

15. **Analytics** — `pm2 logs neurecore-tenant | grep -iE 'industry|tenant'` for any onboarding errors.
16. **Support tickets** — zero P1/P2 in first 7 days for this Phase's Industry.
17. **Onboard first real customer** — Sales/CS onboard via admin UI (not via seeder).
18. **Cert gate review** at day 14 — proceed to next Phase only after this review.

### 10.6 DR snapshot + rollback (per §3.3b / §6 / disaster-recovery.md)

#### 10.6.1 Pre-deploy snapshot (every Phase)

```bash
ssh contabo 'SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)-pre-{phase-slug}
mkdir -p $SNAP
cd /opt/neurecore/backend/backend && tar -czf $SNAP/backend-dist.tar.gz dist/
cd /opt/neurecore/frontend-tenant && tar -czf $SNAP/frontend-tenant-.next.tar.gz .next/
cd /opt/neurecore/frontend-admin  && tar -czf $SNAP/frontend-admin-.next.tar.gz  .next/
cp /opt/neurecore/ecosystem.config.js $SNAP/ecosystem.config.js
cp /opt/neurecore/cors-proxy.js $SNAP/cors-proxy.js'
```

#### 10.6.2 Schema migration rollback

Per `disaster-recovery.md §3.1` + `contabo-ops.md §3.8c`:

```bash
# 1. Find the migration to roll back:
ssh contabo 'cd /opt/neurecore/backend/backend && ls -t prisma/migrations/ | head -5'

# 2. Mark as NOT applied (so next migrate deploy re-runs):
ssh contabo '
  cd /opt/neurecore/backend/backend
  PGPASSWORD=$(grep ^POSTGRES_SUPERUSER_PASSWORD .env | cut -d= -f2-)
  psql -h 127.0.0.1 -U postgres -d neurecore_prod -c "
    DELETE FROM _prisma_migrations WHERE migration_name = '"'"'{migration-name}'"'"';
  "'

# 3. Restore pre-migration DB from DR snapshot if needed (last resort):
ssh contabo 'ls /opt/neurecore/_archives/ | tail -5'
```

#### 10.6.3 DB-only state rollback (no schema change)

If only `Industry.status` was flipped (Phase 2.A):

```bash
# Flip everything back to ACTIVE (re-runnable as rollback):
ssh contabo 'cd /opt/neurecore/backend/backend
  node -e "
    const {PrismaClient} = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      await p.industry.updateMany({data: {status: \"ACTIVE\"}});
      console.log(\"All 16 industries flipped to ACTIVE\");
      await p.\$disconnect();
    })();
  "'
```

### 10.7 Test matrix per Phase (5 layers)

| Layer | Tool | Where it runs | When it runs | Failure action |
|---|---|---|---|---|
| **Unit** | Jest | Local + CI | Every PR | Block PR merge |
| **Integration (DB)** | Jest + Prisma + test DB | Local + CI | Every PR | Block PR merge |
| **E2E (FE-first)** | Playwright via P2 base runner | CI (against `https://hq.neurecore.com`) | Pre-deploy gate (after merge to main, before deploy) | Block deploy |
| **Admin E2E** | Playwright | CI | Pre-deploy gate | Block deploy |
| **SOLID guard** | `scripts/solid-guard.sh` | Local + CI | Every PR | Block PR merge |

**Per-Phase test additions:**

| Phase | New unit tests | New integration tests | New E2E (cert) | New admin E2E |
|---|---|---|---|---|
| 2.A | (uses existing) | `onboarding-allocator.spec.ts` (P5) — 8 Industries × 3 tiers | (uses existing) | `industries-active-toggle.spec.ts` |
| 2.B | (uses existing) | `tier-industry-matrix-fs.spec.ts` (T1 + 8 packages resolve) | **SIM-05** (12 stages) | `packages-fs-composition.spec.ts` |
| 3.A | (uses existing) | `tier-industry-matrix-tech.spec.ts` | **SIM-06** (10 stages) | `packages-tech-composition.spec.ts` |
| 3.B | (uses existing) | `professional-legal-deprecation.spec.ts` (T3) | **SIM-07** (10 stages) | (uses existing) |
| 4.A | (uses existing) | `tier-industry-matrix-retail.spec.ts` | **SIM-08** (12 stages — LARGEST) | (uses existing) |
| 4.B | (uses existing) | `sub-industry-nav-filter.spec.ts` (P3 for media) | **SIM-09** (10 stages) | (uses existing) |
| 5.A | (uses existing) | `tier-industry-matrix-ngo.spec.ts` + `category-enum.spec.ts` (P13) | **SIM-10** (10 stages) | `category-enum-admin.spec.ts` (P13) |
| 5.B | (uses existing) | `cross-group-inheritance.spec.ts` (T8) | **SIM-11** (10 stages, asserts SPO inherits Bookkeeper from accounting) | `package-inheritance-ui.spec.ts` (P9) |

**Cross-cutting test layers** (run every PR):
- `phase8-tenant-isolation.spec.ts` baseline (Phase 8) — must stay PASS as we add Industries.
- 8 per-Industry isolation specs (P6) — one per kept Industry.
- `industry-isolation-{slug}.spec.ts` for each kept Industry.

### 10.8 Verification matrix — what proves each Phase done

A Phase is "cert done" when **all** of the following are true. Document the evidence in the PR description + commit message.

| Evidence | Source | Where to record |
|---|---|---|
| SOLID guard green | `bash scripts/solid-guard.sh` → exit 0 | PR description |
| Unit + integration tests pass | `pnpm test` → 0 failures | PR description |
| SIM-XX cert runner PASS | `pnpm exec playwright test simulations/SIM-XX-...` | PR description + commit |
| Admin E2E PASS | `pnpm exec playwright test frontend-admin/__tests__/admin-*.spec.ts` | PR description |
| §10.6.1 DR snapshot created | `ls -la /opt/neurecore/_archives/{timestamp}-pre-{phase}` | commit message |
| Contabo deploy logs (per §10.5.2) | `pm2 logs neurecore-{app}` output | PR description |
| §10.5.3 health probes 200 | `curl -sk https://{hq,cc,brain}.neurecore.com/...` output | PR description |
| §10.5.4 14-day observation complete | Date + analytics summary | commit message on next Phase |
| Tenant distribution audit | `SELECT industry, count(*) FROM tenants GROUP BY industry` output (Phase 2.A + any future Phase that flips status) | commit message |

**No Phase is "done" until §10.8 is fully populated.** Each row is a check on the PR description template.

---

## 10.9 Contabo deploy runbook (canonical commands)

This section is the **single source of truth** for Contabo deploy commands, copied from `neurecore/memory-bank-arc/contabo-ops.md` + `neurecore/memory-bank/contabo-ops.md`. Anything in those docs that conflicts with this section is a drift bug.

### 10.9.1 Box + hostnames

- Box: `vmi2954830.contaboserver.net` / `109.123.248.253`, Ubuntu 22.04.
- Deploy root: `/opt/neurecore`. PM2 dump: `/root/.pm2/`.
- SSH: `ssh contabo` (root, key-based via `~/.ssh/config`). Bootstrap via `scripts/setup_contabo_key.sh`.

| Hostname | Upstream | PM2 process | Port |
|---|---|---|---|
| `https://hq.neurecore.com` | 127.0.0.1:3001 | `neurecore-tenant` | 3001 |
| `https://cc.neurecore.com` | 127.0.0.1:3020 | `neurecore-admin` | 3020 |
| `https://brain.neurecore.com` | 127.0.0.1:3003 | `neurecore-backend` | 3003 |
| `https://eaos.neurecore.com` | (alt CORS) | — | — |

DB: PostgreSQL 16 at `127.0.0.1:5432` (db `neurecore`, user `neurecore_app`). **Live `.env` already has the correct URL — port `5433` in the repo template is wrong/stale** (per `contabo-ops.md §1`).

### 10.9.2 Pre-deploy checklist (per Phase)

Run these **before** every Phase deploy. Skip nothing.

```bash
# 1. Local typecheck + SOLID guard
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
cd backend && npx tsc --noEmit -p tsconfig.json && cd ..
cd frontend-tenant && npx tsc --noEmit -p tsconfig.json && cd ..
cd frontend-admin && npx tsc --noEmit -p tsconfig.json && cd ..
bash scripts/solid-guard.sh

# 2. SSH key + connectivity
ssh contabo 'echo "OK $(uptime)" && df -h / | tail -1'

# 3. Snapshot frontends + ecosystem + backend dist (per contabo-ops.md §3.3b)
ssh contabo 'SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)-pre-pruned-{phase}
mkdir -p $SNAP
cd /opt/neurecore/backend/backend   && tar -czf $SNAP/backend-dist.tar.gz          dist/
cd /opt/neurecore/frontend-tenant  && tar -czf $SNAP/frontend-tenant-.next.tar.gz  .next/
cd /opt/neurecore/frontend-admin   && tar -czf $SNAP/frontend-admin-.next.tar.gz   .next/
cp /opt/neurecore/ecosystem.config.js $SNAP/ecosystem.config.js
cp /opt/neurecore/backend/backend/.env.production $SNAP/.env.production
ls -la $SNAP'

# 4. Live tenant distribution audit (before any flip; Phase 2.A + 5.A)
ssh contabo 'cd /opt/neurecore/backend/backend && node prisma/audit-industries.cjs --check'

# 5. Pre-flight cert runner sanity (no browser needed)
for runner in simulations/SIM-0{4,5,6,7,8,9}*/certify-sim*.mjs simulations/SIM-1*/certify-sim*.mjs; do
  [ -f "$runner" ] && node --check "$runner"
done
```

### 10.9.3 Backend deploy (when Phase touches backend code)

Use the canonical ssh-direct commands — these match `contabo-ops.md §3.2` exactly:

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend &&
  export $(grep -v "^#" .env.production | grep -E "DATABASE_URL|DIRECT_URL" | xargs) &&
  ./node_modules/.bin/prisma generate &&
  ./node_modules/.bin/prisma migrate deploy &&
  ./node_modules/.bin/nest build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend && pm2 save'

# If migration touches model_providers (postgres-owned tables, per §3.8c):
ssh contabo '
  cd /opt/neurecore/backend/backend
  PGPASSWORD=$(grep ^POSTGRES_SUPERUSER_PASSWORD .env.production | cut -d= -f2-)
  psql -h 127.0.0.1 -U postgres -d neurecore -v ON_ERROR_STOP=1 \
    -f prisma/migrations/<migration_id>/migration.sql
  PGPASSWORD=$PGPASSWORD psql -h 127.0.0.1 -U postgres -d neurecore <<SQL
  UPDATE _prisma_migrations SET finished_at = now(), applied_steps_count = 1
  WHERE migration_name = '"'"'<migration_id>'"'"';
SQL
  ./node_modules/.bin/prisma generate'
```

### 10.9.4 Frontend-tenant rebuild

```bash
# Local (preferred, per contabo-ops.md §3.3b):
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant   # rsync → pnpm install → next build → PM2 restart

# OR ssh-direct:
ssh contabo '
  cd /opt/neurecore/frontend-tenant &&
  pnpm install --no-frozen-lockfile 2>&1 | tail -3 &&
  ./node_modules/.bin/next build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant && pm2 save'
```

**Lockfile caveat (contabo-ops.md §4.3):** `compression` + `lru-cache` were added to `backend/package.json` (2026-07-21) without regenerating the lockfile. Use `--no-frozen-lockfile` fallback. Affects backend, not frontends.

### 10.9.5 Frontend-admin rebuild

```bash
./scripts/deploy.sh admin
```

### 10.9.6 Seeder runs (per-Phase data side)

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  node prisma/set-cut-industries-archived.cjs --check      # dry-run first
  node prisma/set-cut-industries-archived.cjs              # apply (Phase 2.A only)
  
  node prisma/seed-financial-services-department-template.cjs --check   # Phase 2.B
  node prisma/seed-financial-services-department-template.cjs
  node prisma/seed-financial-services-packages.cjs --check
  node prisma/seed-financial-services-packages.cjs
  
  # Repeat for Phase 3.A, 3.B, 4.A, 4.B, 5.A, 5.B per Implementation Plan §5.x'
```

### 10.9.7 Env flag flip (per Phase)

Per `contabo-ops.md §3.8b`: **set in BOTH `.env` AND `.env.production`**.

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  echo "PRUNED_{PHASE}_ENABLED=true" >> .env
  echo "PRUNED_{PHASE}_ENABLED=true" >> .env.production
  pm2 restart neurecore-backend'
```

### 10.9.8 Post-deploy verification

Run `scripts/verify-deploy.sh --phase {X.Y} --tenant-id $MALI_TENANT_ID`:

```bash
# Auto-running from local workspace (uses cached results for 24h):
bash scripts/verify-deploy.sh --phase 5.B --tenant-id $MALI_TENANT_ID --no-cache

# Manual spot checks per contabo-ops.md §9.1:
curl -sk https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/
curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/
pm2 list
```

### 10.9.9 Rollback procedure

Per Implementation Plan §10.4. **Order matters**: PM2 first, then DB.

```bash
# 1. Feature flag off
ssh contabo '
  cd /opt/neurecore/backend/backend
  sed -i "s/^PRUNED_{PHASE}_ENABLED=true/PRUNED_{PHASE}_ENABLED=false/" .env .env.production
  pm2 restart neurecore-backend'

# 2. DB-side rollback (Phase 2.A only):
ssh contabo 'cd /opt/neurecore/backend/backend
  node -e "
    const {PrismaClient} = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      await p.industry.updateMany({where: {slug: {in: [...8 cut slugs...]}}, data: {status: \"ACTIVE\"}});
      console.log(\"All 16 industries flipped to ACTIVE\");
      await p.\$disconnect();
    })();
  "'

# 3. Restore pre-Phase .next/ snapshot (per Step 3):
ssh contabo "
  SNAP=\$(ls -dt /opt/neurecore/_archives/*-pre-pruned-{phase} | head -1)
  cd /opt/neurecore/frontend-tenant && rm -rf .next && tar -xzf \$SNAP/frontend-tenant-.next.tar.gz
  cd /opt/neurecore/frontend-admin  && rm -rf .next && tar -xzf \$SNAP/frontend-admin-.next.tar.gz
  pm2 restart neurecore-tenant neurecore-admin"
```

### 10.9.10 Per-Phase Contabo deploy checklist (template)

| Step | Command | Verification |
|---|---|---|
| 1. Snapshot | ssh contabo tar -czf $SNAP/... | ls $SNAP |
| 2. Tenant audit | node prisma/audit-industries.cjs --check | "✓ PASS: no production tenants on any cut Industry" |
| 3. Apply DB | node prisma/...cjs (per phase) | tail of script output |
| 4. Backend rebuild | ssh rebuild + pm2 startOrReload | `pm2 list` shows `neurecore-backend` online |
| 5. Tenant FE rebuild | ./scripts/deploy.sh tenant | `pm2 list` shows `neurecore-tenant` online |
| 6. Admin FE rebuild (if P9 / P13 UI touched) | ./scripts/deploy.sh admin | `pm2 list` shows `neurecore-admin` online |
| 7. pm2 save | `pm2 save` (after every reload, per §3.7) | reboot survival |
| 8. Health probes | curl brain/hq/cc | all 200 |
| 9. SIM-XX runner | ssh + SUPER_ADMIN creds + browser | runner exits 0 |
| 10. Env flag flip | sed -i in both .env files | flag in process.env matches |
| 11. 14-day observation | pm2 logs grep industry/customer | no spikes |
| 12. Cert gate review | check next phase gate per Implementation Plan §10.2 | proceed only after review |

---

## 11. References

### Source documents
- `neurecore/memory-bank-arc/industries/PRUNED-TAXONOMY-PROPOSAL.md` — what + when (Phase plan, §7.x build items).
- `neurecore/memory-bank-arc/industries/KEPT-INDUSTRY-CATALOG.md` — per-Industry Tenant Template, Packages, Project Types, Workspace modules.
- `neurecore/memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md` — original 8 Groups / 16 Industries taxonomy (kept for DB rows).
- `neurecore/memory-bank-arc/industries/TIER-DEPLOYMENT-RUNBOOK.md` — Run-6 healthcare template seed; tier × industry matrix.
- `neurecore/memory-bank-arc/NeuroCore Architectural Constitution` — governing principles (Articles XVI "Capability-Based Architecture", XXV "Simplicity Over Complexity", XXVII "The NeuroCore Test" especially).
- `neurecore/memory-bank-arc/pools-taxonomy.md` — 6-pool schema (Package, DepartmentTemplate, AgentTemplate, Feature, Tier, Industry).
- `neurecore/memory-bank-arc/future-plans.md` — Stage 2/3 capability roadmap (orthogonal).
- `neurecore/memory-bank-arc/pending-tasks.md` — NC-ACCT-IMP-1, SIM-04, NC-SIM04-001/002/005 closure notes.

### Code surfaces (file references)

#### Backend — data + seeders
- `backend/prisma/schema.prisma` — `Industry` (4117), `Package` (4169), `DepartmentTemplate` (1346), `AgentTemplate` (900), `TierAgentPool` (474), `TierChangeRequest` (449), `Feature` (4148).
- `backend/prisma/seed-accounting-packages.cjs` (457 lines)
- `backend/prisma/seed-financial-services-packages.cjs` (322 lines, T1 target)
- `backend/prisma/seed-business-composition.cjs` (207 lines, R2 refactor target)
- `backend/prisma/seed-package-catalogue.cjs` (342 lines, R2 refactor target)
- `backend/prisma/seed-business-technology-templates.cjs`, `seed-healthcare-department-template.cjs`, `seed-financial-compliance-templates.cjs`, `seed-industrial-infra-templates.cjs`, `seed-public-social-templates.cjs`, `seed-consumer-commerce-templates.cjs` (R2 refactor targets)
- `backend/prisma/seeds/industry-templates/*.ts` — stub package + template defs (R2 consumers)
- `backend/prisma/seeds/project-types/*.json` — 16 per-Industry JSON files (R2 + per-Phase extenders)
- `backend/prisma/seeds/question-packs/*.json` — 20 pack files (reused by NGO)

#### Backend — services
- `backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts` — gold-standard per-Industry registry (no refactor needed)
- `backend/src/modules/industry/industries.module.ts`, `industries.controller.ts`, `industries.service.ts` — R3 target
- `backend/src/modules/onboarding/onboarding.service.ts` — R3 + 5.B.T8.2 target
- `backend/src/modules/compliance/industry-compliance.service.ts` — R3 target
- `backend/src/modules/widgets/widget-registry.ts`, `widgets.service.ts` — R3 target
- `backend/src/modules/approval-chains/addons/financial-approval.addon.ts` — R3 target
- `backend/src/modules/notifications/industry-notification-templates.ts` — verify pattern (R3)
- `backend/src/modules/workflows/industry-workflow-definitions.ts` — verify pattern (R3)

#### Frontend — tenant
- `frontend-tenant/src/lib/industryNavigation.ts` — 8-Group nav config (gold standard, R1 + P3 consumers)
- `frontend-tenant/src/lib/industry-workspace-models.ts` — **NEW** (P1)
- `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` — workspace module renderer (P1, 5.B workspace consumers)
- `frontend-tenant/src/components/layout/IconRail.tsx` — R1 + P3 consumers
- `frontend-tenant/src/components/customers/CustomerForm.tsx` — R1 + 2.A.4 consumers
- `frontend-tenant/src/stores/tenantStore.ts` — R1 consumer
- `frontend-tenant/src/app/workspace/[feature]/page.tsx` — generic workspace stub route (P1 consumer)

#### Frontend — admin
- `frontend-admin/src/app/industries/page.tsx` — Industry CRUD (2.A.5)
- `frontend-admin/src/app/packages/[id]/edit/page.tsx` — composition editor (5.B.T8.3 = P9)
- `frontend-admin/src/app/packages/page.tsx` — Package list (P10 future)
- `frontend-admin/src/app/tiers/page.tsx` — Tier CRUD (P11 future)
- `frontend-admin/src/app/departments-pool/page.tsx` — Tenant Template CRUD + deploy
- `frontend-admin/src/app/agents-pool/page.tsx` — Agent Template CRUD + deploy
- `frontend-admin/src/app/dept-templates/page.tsx` — redirect to `/departments-pool`
- `frontend-admin/src/app/project-types/` — Project Type CRUD (per-Phase extenders)
- `frontend-admin/src/app/question-packs/` — Question Pack CRUD
- `frontend-admin/src/app/tenants/[id]/industry/` — tenant Industry reassignment

#### Frontend — admin services (HTTP clients)
- `frontend-admin/src/services/{packages,tiersPool,industriesPool,deptTemplates,agentsPool,projectTypes,questionPacks,featuresPool}.service.ts`

#### Simulations (cert runners)
- `simulations/SIM-04-Accounting-Project-Full-Flow/` — existing FE-first template
- `simulations/SIM-05..SIM-11` — to be built per Phase
- `simulations/_lib/base-runner.ts` — **NEW** (P2)

#### CI / DevOps
- `.github/workflows/solid-guard.yml` — **NEW** (R4)
- `.kilo/hooks/pre-commit.yml` — optional pre-commit variant of R4

### Open questions (forwarded to proposal §9)
- §9.6 R3–R4 admin-UI risks apply to this plan; refer to proposal for full text.
- §9.6 R9 picker cut-down observation period (7-day shadow) is codified in §10.1.
- §9.6 R18 (Industry slug edit cascade) is mitigated by R1 (single source) but doesn't auto-prevent the cascade; flagged for Stage 2 P14.

---

**End of implementation plan.** This document is the **single source of truth** for build sequencing, refactor prerequisites, SOLID enforcement, and rollout. Any new proposal or spec that conflicts with §5 (steps), §4 (refactors), or §6 (infra) must amend this document first.