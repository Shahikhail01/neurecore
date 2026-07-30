# NeureCore Industry-Specific Tenant Setup — Concept & Implementation Plan

**Status:** Draft  
**Date:** 2026-07-21  
**Owner:** Platform Team  

---

## Table of Contents

1. [Concept](#1-concept)
2. [Current State Audit](#2-current-state-audit)
3. [Gaps Identified](#3-gaps-identified)
4. [Completeness Review — What Else Needs Industry Awareness](#4-completeness-review--what-else-needs-industry-awareness)
5. [Implementation Plan](#5-implementation-plan)
6. [Files to Change](#6-files-to-change)

### Appendices
- [A: Data Flow Diagrams](#appendix-a-data-flow-diagrams)
- [B: Package Composition Matrix](#appendix-b-package-composition-matrix-target-state)
- [C: Audit Summary](#appendix-c-audit-summary--whats-done-vs-whats-not)

---

## 1. Concept

### 1.1 The Vision

A tenant picks an **Industry** at onboarding (e.g. `accounting-audit-services`). From that moment, every system adapts:

| Layer | What changes |
|-------|-------------|
| **Navigation** | Workspace extras + Customers label/icon change per Industry Group |
| **Project Creation** | Hermes gets `industryHint` → synthesizes better project shapes |
| **Agent Selection** | The tenant's industry determines which agents are available in Marketplace, which are auto-deployed |
| **Project Types** | Only project types matching the tenant's industry appear in the creation flow |
| **Packages** | Industry + Tier composition determines available packages |
| **Marketplace** | Package cards show industry badges; filters by industry |
| **Dashboard KPIs** | KPI strip adapts per industry group |
| **Customer Fields** | Customer dropdown values change per industry |
| **Hermes Context** | Industry-aware context plane shapes agent behavior |

### 1.2 Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Industry is the anchor, not Industry Group** | The 16 `Industry` rows are the canonical taxonomy. Groups are for filtering/bundling. |
| D2 | **Package is the composition root** | Industry + Tier + Agents + Departments + Features converge at the Package level. |
| D3 | **Hermes synthesis is the default project path** | Template-driven path (ProjectType) is an optional accelerator. |
| D4 | **3 layers of industry specificity** | Platform-wide (generic) → Industry-level → Tenant-level (optional overrides). |
| D5 | **Hermes receives industry context from 3 sources** | `industryHint` from tenant → RAG corpus of past projects → LLM training data. |
| D6 | **Sub-industries are descriptive only** | Listed in `Industry.description` bullets, NOT a separate table or selectable entity. |
| D7 | **Industry is set once at onboarding, never changed by tenant** | Tenant can re-run onboarding (from settings) to change Tier/Departments/Agents, but the Industry step is skipped. Only Super Admin can change industry from `frontend-admin`. |

### 1.3 Architecture: How Industry Flows Through the System

```
 INITIAL ONBOARDING (frontend-tenant)
 ┌─────────────────────────────────────────────────────┐
 │ Tenant picks: Industry + Tier + Departments + Agents │
 │ → Tenant.industry + Tenant.industryGroup derived      │
 │ → TierAgentPool assigns agents per tier               │
 └────────────────────────┬────────────────────────────┘
                          │
                          ▼
 ONBOARDING RE-RUN (frontend-tenant, from settings)
 ┌─────────────────────────────────────────────────────┐
 │ Tenant changes: Tier / Departments / Agents          │
 │ Industry step is **SKIPPED** — read-only display     │
 │ Only Super Admin can change Industry (admin UI)      │
 └────────────────────────┬────────────────────────────┘
                          │
                          ▼
 ICON RAIL
   IconRail reads industryGroup → shows workspace extras + customer label
                          │
                          ▼
 PROJECT CREATION (Hermes)
   CreateProjectTool reads Tenant.industry → industryHint → synthesis prompt
                          │
                          ▼
 HERMES SYNTHESIS
   ProjectShapeSynthesisService gets RAG corpus for industry + few-shot examples
                          │
                          ▼
 DERIVED SHAPE APPLIER
   Reads ProjectShape.members → spawns agents matching project roles
   (agents are selected from the tenant's available pool per tier)
                          │
                          ▼
 MARKETPLACE
   Package list filtered by Tenant.industry + Tenant.tier → shows relevant packages
                          │
                          ▼
 DASHBOARD
   Industry-specific KPI widgets per group
                          │
                          ▼
 KNOWLEDGE BASE
   RAG content seeded per industry → Hermes queries during synthesis
```

---

## 2. Current State Audit

### 2.1 Industry Pool (✅ Complete)

**Status: FULLY IMPLEMENTED**

| Feature | File(s) | Details |
|---------|---------|---------|
| 16 canonical industries | `schema.prisma:3893-3956` | Each with slug, name, icon, status, sortOrder |
| 8 Industry Groups | `industry-groups.service.ts`, `frontend-*/industryGroups.ts` | Static metadata, no DB table |
| Industry ↔ Group mapping | `seed-industries-majors.cjs`, `add-industry-accounting.cjs` | `industryGroup` column on Industry model |
| Sub-industries in description | Seed scripts | Descriptive bullets in `Industry.description` |
| Public API endpoints | `industries.controller.ts` | `GET /groups`, `GET /groups/:slug`, `GET /:slug/capabilities?tier=` |
| Tier × Industry matrix | `tier-industry-matrix.ts` | Capability matrix per (group, tier) combination |
| Soft-delete via status | `PoolService` base | `ACTIVE \| ARCHIVED` enum |

**What the seed data contains:**

```typescript
// 16 industry slugs seeded to DB:
[
  'healthcare-life-sciences',       // group: healthcare
  'government-public-sector',       // group: public-social
  'nonprofit-international',        // group: public-social
  'education-research',             // group: public-social
  'financial-services',             // group: financial-compliance
  'accounting-audit-services',      // group: financial-compliance
  'technology-digital-services',    // group: business-technology
  'professional-business-services', // group: business-technology
  'manufacturing-industrial',       // group: industrial-infrastructure
  'construction-engineering-infrastructure', // group: industrial-infrastructure
  'energy-utilities-natural-resources',      // group: industrial-infrastructure
  'logistics-transportation-supply-chain',   // group: industrial-infrastructure
  'retail-commerce-consumer',       // group: consumer-commerce
  'media-communications-creative',  // group: consumer-commerce
  'agriculture-food-systems',       // group: agriculture-food
  'special-purpose-organizations',  // group: other
]
```

### 2.2 Tenant Industry Field (✅ Complete)

**Status: FULLY IMPLEMENTED**

| Feature | File(s) | Details |
|---------|---------|---------|
| `Tenant.industry` | `schema.prisma:481` | Free-text string, stores industry slug |
| `Tenant.industryGroup` | `schema.prisma:483` | Denormalized group slug for fast filtering |
| Auto-derivation | `onboarding.service.ts:98-106` | Sets `industryGroup` from Industry table when `industry` changes via onboarding |
| API exposure | `tenants.service.ts`, `onboarding.service.ts` | Both fields exposed in response DTOs |

**Code path for setting tenant.industry:**
```
Admin: POST /api/v1/tenants          → TenantsService.create()           Sets industry, NOT industryGroup
Admin: PATCH /api/v1/tenants/:id     → TenantsService.update()           Sets industry, NOT industryGroup
Owner: PATCH /api/v1/tenants/me      → TenantsService.updateMine()       Sets industry, NOT industryGroup
Owner: PUT /api/v1/onboarding/state   → OnboardingService.updateState()  Sets BOTH industry + industryGroup ✓
```

### 2.3 Onboarding Industry Picker (✅ Complete)

**Status: FULLY IMPLEMENTED**

| Component | File | Status |
|-----------|------|--------|
| `IndustryGroupPicker` | `frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx` | Accordion UI with search, single-select |
| `CompanyStep` | `frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx` | Fetches groups from API, renders picker |
| Setup wizard | `frontend-tenant/src/app/onboarding/setup/page.tsx` | 6-step wizard orchestrator |

### 2.4 Navigation (✅ Complete)

**Status: FULLY IMPLEMENTED**

| Feature | File | Details |
|---------|------|---------|
| `industryNavigation.ts` | `frontend-tenant/src/lib/industryNavigation.ts` | Config for all 8 groups |
| `buildRailSections(industryGroup)` | `IconRail.tsx:182` | Injects industry extras into Workspace |
| Industry-specific customer label/icon | `IconRail.tsx` | Resolves per group |
| Stub pages | `frontend-tenant/src/components/industry/IndustryStubPage.tsx` | 8 routes for Financial & Compliance group |

### 2.5 Package System (✅ Complete — Accounting only)

**Status: PARTIALLY COMPLETE** — 68 packages exist but only 15 (accounting) have full composition.

| Feature | Count | Details |
|---------|-------|---------|
| Total packages | 68 | Anchored to (Industry, Tier) pairs |
| With full composition | 15 | Only `accounting-audit-services` industry |
| With empty composition | 53 | All other industries — packages exist but no agents/departments/features assigned |
| Package ↔ Industry link | `Package.industryId` | Required FK, `onDelete: Restrict` |
| Package ↔ Tier link | `Package.tierId` | Required FK, `onDelete: Restrict` |

### 2.6 Agent System (✅ Complete — Platform pool)

**Status: FULLY IMPLEMENTED** (pool level), but **not linked to industries** except through Packages.

| Feature | Count | Details |
|---------|-------|---------|
| AgentTemplate (platform pool) | ~715 | 15 hand-crafted + ~700 bulk-imported agency agents |
| TierAgentPool entries | Per-tier | Bridges Tier → AgentTemplate for runtime allocation |
| Agent runtime instances | Per-tenant | Created via `DeploymentService.spawnFromTemplate()` |
| Agent ↔ Industry link | NONE | No FK, no relation on AgentTemplate or Agent models |
| Agent ↔ Package link | M2M | Via `Package.aiAgents` (named `"PackageAgents"`) |

### 2.7 Project Types (✅ Complete)

**Status: FULLY IMPLEMENTED**

| Feature | Details |
|---------|---------|
| Total project types | 150+ with backfilled templates |
| Industry filtering | `ProjectType.industry` field, filtered during onboarding allocation |
| Goal templates | Array of `{ title, measurableCriteria }` per ProjectTypeVersion |
| Role templates | Array of `{ role, agentType }` per ProjectTypeVersion |
| Allocation | `ProjectTypeAllocatorService.allocateForTenant()` clones system types matching tenant industry |

### 2.8 Hermes AI Synthesis (✅ Complete — Core pipeline)

**Status: FULLY IMPLEMENTED** (core pipeline), but with gaps.

| Feature | File | Details |
|---------|------|---------|
| `ProjectShapeSynthesisService` | `project-shape-synthesis.service.ts` | LLM-driven shape synthesis with repair loop |
| `DerivedShapeApplier` | `derived-shape-applier.service.ts` | Materializes shape into DB (stages, goals, agents) |
| `CreateProjectTool` | `neurecore-tools.ts:630-804` | Accepts `industryHint` + `useAiSynthesis` |
| `ProjectShapeSchema` | `project-shape.types.ts` | Zod schema: industry, stages, goals, members, customFields |
| `industryHint` flow | Through prompt | LLM gets hint as text, infers industry in output |

### 2.9 Knowledge / RAG (❌ Not Implemented)

**Status: NOT CONNECTED** — RAG pipeline exists but has no industry awareness.

| Feature | Status |
|---------|--------|
| `RAGPipeline` service | ✅ Exists, pgvector-backed |
| Industry-specific RAG corpus | ❌ Does not exist |
| RAG retrieval in synthesis | ❌ `ProjectShapeSynthesisService` uses zero-shot prompt only |
| Industry knowledge seeds | ❌ Not seeded |

### 2.10 Dashboard (❌ Not Implemented)

**Status: NOT CONNECTED** — No industry-specific dashboard widgets.

---

## 3. Gaps Identified

### 3.1 Critical Gaps (Blocking Industry Experience)

| # | Gap | Impact | Files |
|---|-----|--------|-------|
| G1 | **`industryGroup` not auto-derived when set outside onboarding** | Admin creates/updates tenant → `industryGroup` stays null/stale | `tenants.service.ts:create/update/updateMine` |
| G2 | **`ProjectShape.industry` not persisted on Project model** | No way to query "all projects in X industry" without parsing JSONB | `derived-shape-applier.service.ts`, `schema.prisma Project` |
| G3 | **`industryHint` has no effect on agent template selection** | Hermes synthesizes roles but `findAgentTemplate()` matches purely by role name, not industry | `derived-shape-applier.service.ts:findAgentTemplate()` |
| G4 | **No RAG for industry knowledge in Hermes prompts** | Zero-shot prompt only; LLM gets no industry-specific context beyond the one-line hint | `project-shape-synthesis.service.ts:buildPrompt()` |
| G5 | **RailCustomizeModal not industry-aware** | Uses `buildRailSections(null)` — industry extras invisible in customize UI | `RailCustomizeModal.tsx`, `railPreferencesStore.ts` item IDs |

### 3.2 Medium Gaps (Degraded Experience)

| # | Gap | Impact | Files |
|---|-----|--------|-------|
| G6 | **No admin UI for industry change post-onboarding** | Super Admin cannot change tenant's industry from admin panel — must direct DB edit | `frontend-admin` needs new page |
| G7 | **Onboarding re-run doesn't skip industry step** | Tenant re-running onboarding sees industry picker they shouldn't be able to change | `CompanyStep.tsx`, `onboarding.service.ts` |
| G8 | **Only Financial & Compliance has stub pages** | Other 7 groups would 404 on workspace extras links | All stub pages |
| G9 | **CustomerForm uses free-text industry** | Not integrated with IndustryGroupPicker or industry slug system | `CustomerForm.tsx` |
| G10 | **Admin `industries.ts` missing `accounting-audit-services`** | Admin UI can't reference 16th industry | `frontend-admin/src/lib/industries.ts` |
| G11 | **AgentTemplate has no industryId** | Agents can only be linked to industries indirectly through Packages | `schema.prisma:839-876` |

### 3.3 Enhancement Opportunities

| # | Opportunity | Description |
|---|-------------|-------------|
| E1 | Industry-aware Dashboard KPIs | Different KPI strips per industry group |
| E2 | Industry knowledge seeds | Seed pgvector with industry-specific process docs, regulations, best practices |
| E3 | Tenant industry → synthesis context wiring | Auto-populate `industryHint` from `Tenant.industryGroup` in `CreateProjectTool` |
| E4 | TenantsService `industryGroup` auto-derivation | Add lookup to Industry table in all 3 write paths |
| E5 | RAG retrieval step in synthesis | Query RAG corpus for industry-specific few-shot examples before LLM call |
| E6 | Sub-industry-aware agent override map | `tier-industry-matrix.ts` should support sub-industry priority overrides |

---

## 4. Completeness Review — What Else Needs Industry Awareness

The audit confirmed 12 backend modules have **zero** industry references: Invoices, Expenses, Integrations, Connectors, Workflows, Routines, Knowledge, Chat, Comms, Notifications, Email, Reports, Tasks. Below is what each area needs, ordered by impact.

### 4.1 Dedicated Pages per Industry Group

**Current state:** Only Financial & Compliance has stub routes (8 pages). The other 7 groups define workspace extras in `industryNavigation.ts` but have no pages — clicking nav items would 404.

**What's needed:**

| Industry Group | Route Stubs Needed | What Full Pages Should Do |
|---|---|---|
| Healthcare | `/workspace/appointments`, `/medical-records`, `/pharmacy`, `/laboratory` | Appointment calendar, patient record views, prescription tracking, lab result dashboards |
| Public & Social | `/workspace/programs`, `/grants`, `/field-operations`, `/cases`, `/licenses` | Program dashboards, grant management, case tracking, license renewal workflows |
| Financial & Compliance | 8 existing stubs | Loans pipeline (kanban), audit engagement tracker, tax filing calendar, compliance checklist, portfolio dashboard |
| Business & Technology | `/workspace/tickets`, `/releases`, `/contracts`, `/knowledge-base` | Ticket board, release calendar, contract lifecycle, knowledge article library |
| Industrial & Infra | `/workspace/sites`, `/production`, `/work-orders`, `/equipment`, `/shipments`, `/fleet`, `/warehouses` | Site dashboards, production schedules, work order tracker, fleet management |
| Consumer & Commerce | `/workspace/products`, `/orders`, `/inventory`, `/stores`, `/promotions`, `/campaigns`, `/content` | Product catalog, order dashboard, inventory tracker, campaign analytics |
| Agriculture & Food | `/workspace/fields`, `/livestock`, `/harvest`, `/production` | Field maps, livestock tracking, harvest planning, production dashboards |
| Other | (uses generic items only) | No extra pages for this group |

**Build order (by customer demand):** Financial & Compliance (existing stubs → full pages) → Business & Technology (tickets, releases, contracts) → Consumer & Commerce (products, orders, campaigns) → Industrial & Infra (work-orders, sites, production) → Healthcare → Public & Social → Agriculture → Other.

**Implementation note:** Stub pages currently hardcode `industryGroup="Financial & Compliance"`. They should read `tenant.industryGroup` dynamically from the API, or the `IndustryStubPage` component should accept no hardcoded group and detect it itself.

### 4.2 Features — What Each Area Needs

#### A. Industry-Specific Agent Configurations

**Current state:** 715 agent templates exist but are industry-agnostic. A "Compliance Officer" agent has the same systemPrompt whether the tenant is in banking, healthcare, or manufacturing.

**What's needed:** Per-industry system prompt overrides. When an agent is spawned for a tenant in `financial-services`, its systemPrompt should include financial compliance context (KYC, AML, FINRA). For `healthcare-life-sciences`, it should include HIPAA context.

```typescript
// backend/src/modules/agents/industry-agent-overrides.ts
export const AGENT_PROMPT_OVERRIDES: Record<string, Record<string, string>> = {
  'compliance-officer': {
    'financial-services': 'Focus on KYC/AML, FINRA regulations, SEC filing requirements...',
    'healthcare-life-sciences': 'Focus on HIPAA compliance, patient data privacy, FDA regulations...',
    'manufacturing-industrial': 'Focus on OSHA workplace safety, ISO quality standards...',
  },
};
```

#### B. Industry-Specific Routines & Automation

**Current state:** `routines/` and `workflows/` modules have zero industry references. All tenants get the same automation.

**What's needed:** Industry-specific routine templates that auto-activate on onboarding.
- **Financial & Compliance:** "End-of-month reconciliation", "Tax filing deadline reminder", "Compliance audit preparation"
- **Healthcare:** "Patient follow-up scheduling", "Lab result notification", "Prescription refill workflow"
- **Manufacturing:** "Equipment maintenance schedule", "Quality inspection trigger", "Production line status report"

#### C. Industry-Specific Reports

**Current state:** `reports/` module has zero industry references. `project-health` has `IndustryMargin` but it groups by projectTypeId, not actual industry.

**What's needed:** Per-industry report templates available under `/intelligence/reports`.
- **Financial:** Audit completion rate, Tax filing status, Client portfolio performance
- **Healthcare:** Patient volume trends, Appointment no-show rate, Bed occupancy
- **Manufacturing:** Production output, Defect rate, Equipment uptime

#### D. Industry-Specific Task Templates

**Current state:** `tasks/` module has zero industry references.

**What's needed:** Common task templates that auto-seed when a project is created in that industry.
- **Accounting:** "Collect financial statements", "Prepare working papers", "Draft management letter"
- **Healthcare:** "Verify insurance coverage", "Schedule follow-up", "Update medical record"

#### E. Industry-Specific Integrations

**Current state:** `integrations/` and `connectors/` modules have zero industry references. The `TierAgentPool` gates integrations by tier, not industry.

**What's needed:** Industry-specific connector presets. The tier-industry-matrix already defines `integrationsAvailable` per group+tier. These should appear in the Marketplace/Connectors page sorted by relevance.

| Industry Group | Recommended Integrations |
|---|---|
| Financial & Compliance | QuickBooks, Xero, Stripe, Salesforce Financial Cloud |
| Healthcare | EHR systems, Lab systems, Insurance portals |
| Industrial & Infra | IoT platforms, ERP systems, SCADA |
| Consumer & Commerce | Shopify, WooCommerce, payment gateways |
| Business & Technology | Jira, GitHub, Slack, MS Teams |

#### F. Industry-Specific Email/Notification Templates

**Current state:** `notifications/`, `email/`, `comms/` modules have zero industry references.

**What's needed:** Per-industry notification presets. When a tenant in healthcare creates a project, notifications use medical-appropriate language. When an accounting firm creates a project, the language reflects engagement/client terminology.

### 4.3 Departments — Per-Industry Structure

**Current state:** 66 department templates exist (seeded). The Package system composes departments per industry+tier. But department structure beyond templates is not defined.

**What's needed per Industry Group:**

| Industry Group | Default Department Structure |
|---|---|
| Financial & Compliance | Finance, Compliance, Audit, Tax, Client Services, Risk Management |
| Healthcare | Clinical Operations, Nursing, Pharmacy, Laboratory, Patient Services, Billing |
| Public & Social | Programs, Grants, Field Operations, Policy, Community Outreach |
| Business & Technology | Engineering, Product, Sales, Marketing, Support, Professional Services |
| Industrial & Infra | Operations, Production, Quality, Maintenance, Logistics, Safety |
| Consumer & Commerce | Merchandising, Marketing, Sales, Supply Chain, Store Operations |
| Agriculture & Food | Farming, Livestock, Processing, Distribution, Quality |
| Other | General, Administration, Finance, HR |

This structure auto-populates during onboarding after industry selection. Tenants can add/remove departments, but the template gives them a starting point.

### 4.4 Employees (Agents) — Per-Industry Role Definitions

**Current state:** 715 agents, no industry linkage except through Packages. The audit confirmed: no `industryId` on `AgentTemplate`, no industry-specific prompts.

**What's needed beyond Package composition:**

1. **Per-industry agent naming convention**: Agents spawned for a financial tenant should have role-specific names ("Sarah - Tax Specialist") vs healthcare ("Dr. Review - Medical Records").

2. **Per-industry agent KPIs**: Performance metrics differ by industry. A "Compliance Officer" in financial services should be measured on audit pass rate; in healthcare, on HIPAA violation count.

3. **Per-industry agent escalation paths**: In finance, compliance issues escalate to CCO → Board. In healthcare, to Legal → Regulatory Affairs.

4. **Agent discoverability**: The Marketplace should sort agents by industry relevance. A healthcare tenant sees "Medical Records Clerk" first; a manufacturer sees "Production Line Auditor" first.

### 4.5 Other Missing Aspects

#### A. Industry-Specific Customer Lifecycle

**Current state:** `Customer` model has `industry String?` field (free-text, not picker). No lifecycle stages exist.

**What's needed:** Each industry has different customer stages.
- **Financial Services:** Prospect → KYC Verification → Active → Dormant → Closed
- **Healthcare:** Referral → Intake → Active Patient → Discharged → Follow-up
- **Professional Services:** Lead → Proposal → Engaged → Delivered → Retained

#### B. Industry-Specific Compliance Requirements

Each industry has different compliance needs. The Knowledge base should be pre-seeded with relevant regulations, and the "Compliance" workspace page should show industry-specific checklists.

| Industry Group | Key Compliance Frameworks |
|---|---|
| Financial & Compliance | KYC/AML, SOX, GDPR, PCI-DSS |
| Healthcare | HIPAA, HITECH, FDA |
| Public & Social | FOIA, FISMA, Grants compliance |
| Industrial & Infra | OSHA, ISO 9001/14001, EPA |
| Consumer & Commerce | PCI-DSS, GDPR, CCPA |

#### C. Industry-Specific Onboarding Question Packs

**Current state:** `seed-question-packs.cjs` exists with 131 questions but does NOT filter by industry — it's capability-based. The design doc (INDUSTRY-GROUPS-CONCEPT.md §9.2) says questions filter by `appliesWhen.classification` keyed to Industry, but this isn't wired yet.

**What's needed:** Industry-specific question packs that ask about workflows specific to that vertical.

#### D. Workspace Defaults per Industry

**Current state:** No industry-aware workspace defaults beyond navigation.

**What's needed:**
- Default Kanban board layouts per industry
- Default dashboard widget sets per industry
- Default project view (list/board/timeline) per industry type
- Default notification preferences per industry

#### E. Stub Pages Hardcode Bug

**Current state confirmed by audit:** All 8 Financial & Compliance stub pages hardcode `industryGroup="Financial & Compliance"` in the JSX. They do NOT read `tenant.industryGroup`. This means:
1. If a healthcare tenant somehow navigates to `/workspace/loans`, the stub says "Financial & Compliance" — wrong.
2. The stub pages are not reusable across groups.

**Fix:** `IndustryStubPage` should accept no hardcoded group and detect it from `tenant.industryGroup` via the user store.

### 4.6 Updated Implementation Priorities

**Build priority per Industry Group (driven by customer reality, not feature parity):**

| Group | Customer Demand | Package Build Priority | Workspace Pages Priority |
|-------|----------------|----------------------|-------------------------|
| **Financial & Compliance** | **P0 — Ship now.** Accounting firms exist, 15 packages built. | Build financial-services packages next. | Complete 8 existing stubs → full pages. |
| **Business & Technology** | **P1 — Short cycle.** SaaS/consulting/agencies buy tech. | 2-3 starter packages for IT consulting. | Build tickets + releases + contracts pages. |
| **Consumer & Commerce** | **P2 — Medium.** DTC brands, content studios, franchise groups. | 2-3 packages for e-commerce ops. | Build products + orders + campaigns pages. |
| **Industrial & Infra** | **P2 — Medium.** Small manufacturers, contractors need work order mgmt. | 2-3 packages for shop-floor ops. | Build work-orders + sites + production pages. |
| **Healthcare** | **P3 — Long.** Private clinics, telehealth (not hospitals). | 2-3 packages for clinic ops. | Build appointments + medical-records stubs. |
| **Public & Social** | **P3 — Long.** Non-profits, foundations (grant-driven). | 1-2 packages for grant mgmt. | Build programs + grants stubs. |
| **Agriculture & Food** | **P4 — Niche.** Specialty food producers, AgTech. | 1 package for traceability. | Build fields + harvest stubs. |
| **Other** | **P4 — Niche.** Family offices, holding companies. | No packages, generic items only. | No extra pages needed. |

**Feature build priorities across all groups:**

| # | Area | Current | Target | Phase |
|---|------|---------|--------|-------|
| 1 | Workspace stub pages | Only Financial & Compliance (8 stubs) | Business & Tech first, then Consumer/Industrial stubs | P1 |
| 2 | Stub pages dynamic group detection | Hardcoded string | Read from tenant store | P0 |
| 3 | Agent industry prompts | Same for all industries | Per-industry overrides (start with accounting + IT consulting) | P2 |
| 4 | Industry routine templates | None | 3-5 for Financial & Compliance first | P2 |
| 5 | Industry report templates | None | 2-3 for Financial & Compliance first | P2 |
| 6 | Industry task templates | None | Accounting first (tax filing, audit prep tasks) | P2 |
| 7 | Integration presets per industry | None in UI | QuickBooks/Xero first (accounting), then Jira/GitHub (IT) | P2 |
| 8 | Email/notification templates per industry | None | Per-industry language styles | P3 |
| 9 | Department default structures | None | Accounting firm depts first | P1 |
| 10 | Agent naming per industry | Same for all | Role-specific naming | P2 |
| 11 | Customer lifecycle stages | None | Accounting client lifecycle first | P3 |
| 12 | Compliance checklists | None | KYC/AML for financial first, HIPAA for healthcare next | P2 |
| 13 | Onboarding question packs | Capability-based | Industry + capability filtered | P2 |
| 14 | Workspace defaults per industry | None | Save for P3, after pages are built | P3 |
| 15 | Knowledge/RAG seeds per industry | None | Accounting/audit regs first | P2 |

See [INDUSTRY-GROUPS-CONCEPT.md §5](../industries/INDUSTRY-GROUPS-CONCEPT.md#5-target-customer-profiles--who-actually-subscribes) for the full customer profile analysis that drives these priorities.

---

## 5. Implementation Plan

### Phase 0: Fix Critical Gaps (This Sprint)

#### 0.1 — Auto-derive `industryGroup` on all tenant write paths

**Problem:** `TenantsService.create()`, `update()`, and `updateMine()` set `industry` but don't derive `industryGroup`.

```typescript
// backend/src/modules/tenants/tenants.service.ts

// Add a private helper:
private async resolveIndustryGroup(industry?: string | null): Promise<string | null> {
  if (!industry) return null;
  const ind = await this.prisma.industry.findUnique({
    where: { slug: industry },
    select: { industryGroup: true },
  });
  return ind?.industryGroup ?? null;
}

// Then use in create():
async create(dto: CreateTenantDto) {
  const industryGroup = await this.resolveIndustryGroup(dto.industry);
  const tenant = await this.prisma.tenant.create({
    data: {
      ...dto,
      industryGroup,  // NEW
      status: TenantStatus.TRIAL,
      tierId,
    },
  });
}

// Also in update() and updateMine() — same pattern
// In updateMine(), after building updateData:
if (updateData.industry !== undefined) {
  updateData.industryGroup = await this.resolveIndustryGroup(updateData.industry as string);
}
```

#### 0.2 — Persist `industry` on the `Project` model

**Problem:** `ProjectShape.industry` lives only in the JSONB `derivedShape` blob.

```prisma
// schema.prisma — add to Project model
industry       String?    // Extracted from derivedShape for queryability
```

```typescript
// backend/src/modules/projects/services/derived-shape-applier.service.ts
// During apply(), set project.industry from shape
await this.prisma.project.update({
  where: { id: projectId },
  data: { industry: derivedShape.industry },
});
```

#### 0.3 — Auto-populate `industryHint` from tenant in `CreateProjectTool`

**Problem:** `industryHint` is optional and must be manually passed.

```typescript
// backend/src/modules/tools/built-in/neurecore-tools.ts
// In executeImpl(), resolve tenant's industry
async executeImpl(input, context) {
  // ... existing code ...
  
  // Auto-populate industryHint from tenant if not provided
  if (!input.industryHint) {
    const tenant = await this.tenantsService.findById(context.tenantId);
    input.industryHint = tenant.industry ?? tenant.industryGroup ?? undefined;
  }
  
  // ... rest of flow ...
}
```

#### 0.4 — Wire RAG retrieval into synthesis service

**Problem:** Zero-shot prompt with no industry context.

```typescript
// backend/src/modules/project-shape/project-shape-synthesis.service.ts

// In synthesizeShape(), BEFORE calling LLM:
async synthesizeShape(input: SynthesizeShapeInput) {
  let fewShotExamples: ProjectShapeExample[] = [];
  
  // 1. Try RAG retrieval from knowledge base
  if (input.industryHint) {
    const ragResults = await this.ragPipeline.ask({
      query: `${input.industryHint} project workflows stages roles`,
      tenantId: input.tenantId,
      limit: 3,
    });
    if (ragResults.length > 0) {
      fewShotExamples = this.transformRagToExamples(ragResults);
    }
  }
  
  // 2. Fallback to hardcoded corpus
  if (fewShotExamples.length === 0) {
    fewShotExamples = INDUSTRY_SHAPE_CORPUS[input.industryHint]?.slice(0, 3) ?? [];
  }
  
  // 3. Build prompt with examples
  const prompt = this.buildPrompt(input.goal, input.industryHint, fewShotExamples);
  // ... call LLM ...
}
```

#### 0.5 — Fix `railPreferencesStore` ItemId type and `RailCustomizeModal`

**Problem:** Industry-specific workspace items not toggleable in customize modal.

```typescript
// frontend-tenant/src/stores/railPreferencesStore.ts
// Add all industry-specific item IDs to the union:
export type ItemId = 
  // ... existing IDs ...
  | 'engagements' | 'loans' | 'portfolios' | 'audits' | 'tax' | 'payroll' | 'compliance' | 'risk'
  | 'appointments' | 'medical-records' | 'pharmacy' | 'laboratory'
  | 'programs' | 'grants' | 'field-operations' | 'cases' | 'licenses'
  | 'tickets' | 'releases' | 'contracts' | 'knowledge-base'
  | 'sites' | 'production' | 'work-orders' | 'equipment' | 'shipments' | 'fleet' | 'warehouses'
  | 'products' | 'orders' | 'inventory' | 'stores' | 'promotions' | 'campaigns' | 'content'
  | 'fields' | 'livestock' | 'harvest' | 'production';
```

```typescript
// frontend-tenant/src/components/layout/RailCustomizeModal.tsx
// Use industry-aware RAIL_SECTIONS:
// Instead of: const sections = RAIL_SECTIONS;
// Use: const sections = buildRailSections(tenant.industryGroup ?? null);
```

### Phase 1: Medium Gaps (Next Sprint)

#### 1.1 — Admin UI for industry change

Create a page in `frontend-admin` where Super Admin can change a tenant's industry. This is the ONLY place industry can be changed post-onboarding.

```typescript
// frontend-admin/src/app/tenants/[id]/industry/page.tsx
// Route: /admin/tenants/:id/industry
// Uses IndustryGroupPicker (import from shared lib), on save → PATCH /api/v1/tenants/:id { industry }
// Also auto-derives industryGroup on backend (via Phase 0.1 fix)
```

#### 1.2 — Onboarding re-run skips industry step

When tenant re-runs onboarding from settings, the industry step should show the current industry as read-only and skip to Tier/Departments/Agents.

```typescript
// frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx
// Check if tenant already has an industry set:
const isReRun = !!tenant?.industry;
// If re-run: hide industry picker, show read-only badge with current industry name
// If initial run: show IndustryGroupPicker as normal
```

```typescript
// backend/src/modules/onboarding/onboarding.service.ts
// In getState(), add isReRun flag:
getState(tenantId) {
  const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
  return {
    company: {
      name: tenant.name,
      industry: tenant.industry,
      industryGroup: tenant.industryGroup,
    },
    isReRun: !!tenant.onboardingCompletedAt, // NEW — signals FE to skip step
    onboardingStep: tenant.onboardingStep,
  };
}
```

#### 1.3 — Stub pages for remaining 7 groups

Create stub pages matching `industryNavigation.ts` workspace extras for all groups:

```typescript
// For each route in INDUSTRY_NAV_CONFIGS, create a stub page:
// healthcare: appointments, medical-records, pharmacy, laboratory
// public-social: programs, grants, field-operations, cases, licenses
// business-technology: tickets, releases, contracts, knowledge-base
// industrial-infrastructure: sites, production, work-orders, equipment, shipments, fleet, warehouses
// consumer-commerce: products, orders, inventory, stores, promotions, campaigns, content
// agriculture-food: fields, livestock, harvest, production
// other: (no extras, uses generic items only)
```

#### 1.4 — Integrate CustomerForm with industry system

Replace free-text industry field with a lookup seeded from relevant industry taxonomy.

#### 1.5 — Sync admin `industries.ts` to 16 entries

Add `accounting-audit-services` to the admin frontend's industry list.

### Phase 2: Industry-Specific Agent Compositions (Next Month)

**Build order driven by customer demand** (per [INDUSTRY-GROUPS-CONCEPT.md §5.9]): Financial & Compliance first → Business & Technology → Consumer & Commerce → Industrial & Infra → rest.

#### 2.1 — Fill package compositions by priority

Currently only `accounting-audit-services` has packages with full composition. Build in this order:

**P0 — Financial & Compliance (has real customers today):**
```typescript
// backend/prisma/seed-financial-services-packages.cjs
// 8-10 packages for financial-services industry:
// - Starter: Relationship Manager agent, Compliance Officer agent
// - Business: Underwriter agent, Risk Analyst agent
// - Professional: Wealth Advisor agent, Portfolio Manager agent
// - Professional: Product Manager agent (FinTech), Compliance Officer agent
// - Enterprise: All agents + custom
```

**P1 — Business & Technology (tech buyers, short sales cycle):**
```typescript
// backend/prisma/seed-business-technology-packages.cjs
// 4-6 packages for IT consulting / agencies:
// - Starter: Project Manager agent, Client Liaison agent
// - Business: +Developer agent, QA agent
// - Professional: +Tech Lead agent, Product Manager agent
```

**P2 — Consumer & Commerce (e-commerce, content studios):**
```typescript
// 2-3 packages for retail / e-commerce:
// - Starter: Campaign Manager agent
// - Business: +Inventory Manager agent, Customer Support agent
```

#### 2.2 — Industry knowledge seeds

```sql
-- Seed pgvector with industry-specific knowledge
INSERT INTO knowledge_entries (tenant_id, title, content, embedding, metadata) 
SELECT NULL, 'KYC/AML Requirements by Jurisdiction', 
  '...', 
  pgvector('[0.01, 0.02, ...]'),
  '{"industryGroups": ["financial-compliance"], "category": "regulatory"}';
```

### Phase 3: Advanced (Next Quarter)

#### 3.1 — Industry-aware Dashboard

```typescript
// frontend-tenant/src/lib/industryDashboard.ts
export const INDUSTRY_DASHBOARD_CONFIGS: Record<string, DashboardConfig> = {
  'financial-compliance': {
    widgets: [
      { type: 'kpi', metric: 'totalClients', label: 'Total Clients' },
      { type: 'kpi', metric: 'complianceScore', label: 'Compliance Score' },
      { type: 'chart', chartType: 'pipeline', label: 'Active Engagements' },
    ],
  },
  'healthcare': {
    widgets: [
      { type: 'kpi', metric: 'totalPatients', label: 'Total Patients' },
      { type: 'kpi', metric: 'appointmentsToday', label: "Today's Appointments" },
    ],
  },
};
```

#### 3.2 — AgentTemplate.industryId (optional enhancement)

If direct industry→agent queries become necessary, add an optional `industryId` to `AgentTemplate`:

```prisma
model AgentTemplate {
  // ... existing fields ...
  industryId String?   // Optional direct link to Industry
  industry   Industry? @relation(fields: [industryId], references: [id])
}
```

This would allow queries like "find all agents for financial-services" without going through Packages.

#### 3.3 — Sub-industry-aware agent priority overrides

In `tier-industry-matrix.ts`, add a sub-industry override map:

```typescript
export const SUB_INDUSTRY_AGENT_PRIORITIES: Record<string, Record<string, number>> = {
  'financial-services': {
    'relationship-manager': 1,     // Higher priority for banking sub-industry
    'loan-processor': 2,
    'compliance-officer': 3,
    'underwriter': 1,              // Higher priority for insurance sub-industry
    'wealth-advisor': 2,
  },
};
```

---

## 6. Files to Change

### Phase 0 — Critical Fixes

| File | Change | Priority |
|------|--------|----------|
| `backend/src/modules/tenants/tenants.service.ts` | Add `resolveIndustryGroup()` helper; call in create/update/updateMine | P0 |
| `backend/prisma/schema.prisma` (Project model) | Add `industry String?` column | P0 |
| `backend/src/modules/projects/services/derived-shape-applier.service.ts` | Persist `derivedShape.industry` to `Project.industry` | P0 |
| `backend/src/modules/tools/built-in/neurecore-tools.ts` | Auto-populate `industryHint` from tenant industry | P0 |
| `backend/src/modules/project-shape/project-shape-synthesis.service.ts` | Wire RAG retrieval before LLM call; fallback to hardcoded corpus | P0 |
| `frontend-tenant/src/stores/railPreferencesStore.ts` | Add industry-specific item IDs to `ItemId` type | P0 |
| `frontend-tenant/src/components/layout/RailCustomizeModal.tsx` | Use `buildRailSections(industryGroup)` instead of static `RAIL_SECTIONS` | P0 |

### Phase 1 — Medium Fixes

| File | Change | Priority |
|------|--------|----------|
| `frontend-admin/src/app/tenants/[id]/industry/page.tsx` | NEW — Admin page for Super Admin to change tenant industry | P1 |
| `frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx` | Skip industry picker on re-run (read-only display) | P1 |
| `backend/src/modules/onboarding/onboarding.service.ts` | Add `isReRun` flag to state response | P1 |
| `frontend-tenant/src/app/workspace/` (7 group stub pages) | Create stub pages for remaining groups | P1 |
| `frontend-tenant/src/components/customers/CustomerForm.tsx` | Replace free-text industry with picker | P1 |
| `frontend-admin/src/lib/industries.ts` | Add `accounting-audit-services` to 16-industry list | P1 |

### Phase 2 — Compositions (by customer priority)

| File | Change | Priority |
|------|--------|----------|
| `backend/prisma/seed-financial-services-packages.cjs` | NEW — seed packages for financial-services (P0 customer: accounting firms) | P2 |
| `backend/prisma/seed-business-technology-packages.cjs` | NEW — seed packages for IT consulting/agencies (P1 customer: tech buyers) | P2 |
| `backend/prisma/seed-consumer-commerce-packages.cjs` | NEW — seed packages for e-commerce/content studios (P2 customer) | P2 |
| Knowledge seed data | Industry-specific RAG content for Hermes (start with accounting/audit regs) | P2 |

### Phase 3 — Advanced

| File | Change | Priority |
|------|--------|----------|
| `frontend-tenant/src/lib/industryDashboard.ts` | NEW — industry-specific dashboard widget configs | P3 |
| `backend/prisma/schema.prisma` (AgentTemplate) | Optional `industryId` FK | P3 |
| `backend/src/modules/industry/tier-industry-matrix.ts` | Sub-industry-aware agent priority overrides | P3 |

---

## Appendix A: Data Flow Diagrams

### A.1 Current: How IndustryHint Flows

```
Tenant.industry (set at onboarding)
       │
       ▼  (optionally read by CreateProjectTool if manually passed)
CreateProjectTool.input.industryHint
       │
       ▼
ProjectShapeSynthesisService.synthesizeShape({ industryHint })
       │
       ▼  (injected as text in LLM prompt)
LLM prompt line: "Industry hint from caller: financial-services"
       │
       ▼
LLM returns ProjectShape.industry = "financial-services"
       │
       ▼  (stored only in JSONB blob)
Project.derivedShape.json.industry
```

### A.2 Target: How Industry Should Flow

```
Tenant.industry (always set)
       │
       ▼
CreateProjectTool reads tenant.industry → auto-populates industryHint
       │
       ▼
ProjectShapeSynthesisService.synthesizeShape({ industryHint })
       │
       ├─ 1. Query RAG corpus for ${industryHint} — get few-shot examples
       │
       ├─ 2. Inject examples + hint into LLM prompt
       │
       ├─ 3. LLM returns ProjectShape with industry
       │
       ▼
DerivedShapeApplier.apply()
       │
       ├─ Persists Project.industry (queryable column)
       ├─ Spawns agents from tenant's available pool
       └─ Uses industry-aware role-to-agent mapping
```

### A.3 Tenant → Navigation → User

```
Tenant.industryGroup = "financial-compliance"
       │
       ▼
TenantSelf API response includes industryGroup
       │
       ▼
IconRail.buildRailSections("financial-compliance")
       │
       ├─ Workspace: [Departments, Org Chart, Tasks, ...] + [Loans, Audits, Tax, ...] (industry extras)
       ├─ Customers: label="Clients & Accounts", icon="Landmark"
       └─ Marketplace: filtered by financial-services + accounting-audit-services
```

---

## Appendix B: Package Composition Matrix (Target State)

### Financial & Compliance Group

| Package | Industry | Tier | Agents | Departments | Features |
|---------|----------|------|--------|-------------|----------|
| Retail Banking | `financial-services` | Business | Relationship Manager, Compliance Officer | Banking, Compliance | Workflow, API |
| Insurance Underwriting | `financial-services` | Business | Underwriter, Risk Analyst | Underwriting, Risk | Workflow, API |
| Wealth Management | `financial-services` | Professional | Wealth Advisor, Portfolio Manager, Risk Analyst | Wealth, Investments | +SSO, Branding |
| FinTech Launch | `financial-services` | Professional | Product Manager, Compliance Officer, CTO | Product, Compliance | +SSO, Branding |
| Enterprise Banking | `financial-services` | Enterprise | All above + Fraud Analyst, Credit Analyst | Full org | All features |
| Accounting Starter | `accounting-audit-services` | Basic | Bookkeeper, GL Accountant | Accounting | Core only |
| Accounting Business | `accounting-audit-services` | Business | +AP/AR Specialist, Tax Junior | +Admin | +Workflow, API |
| Accounting Pro | `accounting-audit-services` | Professional | +Audit Coordinator, Tax Strategist, Payroll | +HR, Legal | +SSO, Branding |
| Accounting Enterprise | `accounting-audit-services` | Enterprise | +Forensic Auditor, Risk Manager | Full org | All features |

### Other Groups (Phase 2+)

_To be defined per group as they ship._

---

## Appendix C: Audit Summary — What's Done vs What's Not

| Feature Area | Status | % Complete |
|-------------|--------|------------|
| Industry Pool (16 rows, 8 groups) | ✅ Done | 100% |
| Industry seeded data (descriptions, icons) | ✅ Done | 100% |
| Industry Groups metadata service | ✅ Done | 100% |
| Tier × Industry capability matrix | ✅ Done | 100% |
| API endpoints for groups/capabilities | ✅ Done | 100% |
| Tenant.industry + tenant.industryGroup | ✅ Done | 100% |
| Onboarding IndustryGroupPicker | ✅ Done | 100% |
| IconRail industry-aware navigation | ✅ Done | 100% |
| Industry-specific customer labels/icons | ✅ Done | 100% |
| Industry Navigation config (all 8 groups) | ✅ Done | 100% |
| Package system (68 packages, 15 composed) | ⚠️ Partial | 22% |
| Agent pool (715 templates) | ✅ Done | 100% |
| Project types (150+, filtered by industry) | ✅ Done | 100% |
| Hermes AI project shape synthesis | ✅ Done | 100% |
| ProjectShapeSchema with industry field | ✅ Done | 100% |
| industryHint in CreateProjectTool | ✅ Done | 100% |
| RAG pipeline service | ✅ Done | 100% |
| --- | | |
| `industryGroup` auto-derivation outside onboarding | ❌ Gap | 0% |
| `Project.industry` persisted as column | ❌ Gap | 0% |
| Industry-specific agent template selection | ❌ Gap | 0% |
| RAG for industry knowledge in synthesis | ❌ Gap | 0% |
| RailCustomizeModal industry-aware | ❌ Gap | 0% |
| Industry change settings UI | ❌ Gap | 0% |
| Stub pages for non-Financial groups | ❌ Gap | 0% |
| Customer form industry picker | ❌ Gap | 0% |
| Admin 16-industry sync | ❌ Gap | 0% |
| Dashboard industry awareness | ❌ Gap | 0% |
| Package compositions for non-accounting | ❌ Gap | 0% |
| Industry knowledge seeds | ❌ Gap | 0% |
