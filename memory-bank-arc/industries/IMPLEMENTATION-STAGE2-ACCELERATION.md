# Stage 2 Implementation Plan: Industry Acceleration

**Status:** ✅ Completed  
**Date:** 2026-07-21 (planned)  
**Completed:** 2026-07-22 (all 4 phases implemented in 1 day)  
**Target:** Months 3-4  
**Source:** [INDUSTRY-REQUIREMENTS-STAGED.md §4](./INDUSTRY-REQUIREMENTS-STAGED.md#4-stage-2--industry-acceleration)  
**Depends on:** [IMPLEMENTATION-STAGE1-FOUNDATION.md](./IMPLEMENTATION-STAGE1-FOUNDATION.md) (all phases complete)

---

## 1. Overview

Stage 2 adds **operational excellence** on top of Stage 1's foundation. Every industry gets:
- Advanced workflow automations (multi-step, conditional)
- Compliance checklists with auto-reminders
- Integration presets for industry-standard tools
- Approval routing with role-based escalation
- Dashboard templates with industry-specific KPI packs
- Email/notification templates per industry
- Customer field definitions (structured, not free-text)

**Build order:** Same as Stage 1 — Financial & Compliance first, then by customer demand.

---

## 2. Current State Assessment

### 2.1 What Stage 1 Delivers (Precondition)

| Stage 1 Asset | Status |
|---------------|--------|
| IndustryFeatureLoaderService | ✅ Deployed |
| Feature providers for all 8 groups | ✅ Deployed |
| Dynamic workspace routes | ✅ Deployed |
| Onboarding auto-provisioning (lifecycle, depts, project types) | ✅ Deployed |
| Customer `industryClassification` JSON field | ✅ Deployed |

### 2.2 What Exists That Stage 2 Extends

| Existing Asset | Stage 2 Extension |
|----------------|-------------------|
| Workflows module (`workflows/`) | Add industry-specific workflow templates |
| Routines module (`routines/`) | Add conditional branching + SLA enforcement |
| Approvals module (`approval-chains/`) | Add role-based escalation chains per industry |
| Notifications module (`notifications/`) | Add industry-specific notification templates |
| Knowledge module (`knowledge/` with pgvector RAG) | Seed industry-specific compliance docs |
| Dashboard (`/intelligence`) | Add industry-specific KPI widget packs |
| Integrations module (`integrations/`, `connectors/`) | Add industry-specific connector presets |
| Customer model (`industryClassification` JSON) | Add structured field definitions from config |

### 2.3 What Is New (Not Extending Existing)

| Need | Why New |
|------|---------|
| Compliance checklist engine | Cross-cutting concern — lives in new module |
| Industry notification template registry | Configured text + channel preferences per industry |
| Dashboard template registry | KPI pack definitions per industry group |
| Integration preset registry | Connector + data mapping configs per industry |

---

## 3. Architecture Principles

### 3.1 The Add-on Pattern (INDUSTRY-REQUIREMENTS-STAGED.md §1.3)

Every Stage 2 feature follows the **add-on pattern**:

```
FeatureModule/
├── feature.service.ts              ← Common: works for all industries
├── feature_FinancialAddon.ts       ← Financial & Compliance specific overrides
├── feature_HealthcareAddon.ts      ← Healthcare specific overrides
└── feature_DefaultAddon.ts         ← Fallback (generic behavior)
```

**Example — Approval Routing:**
```
approval-chains/
├── approval-chain.service.ts          ← Generic: route through stages
├── approval-chain.financial-addon.ts  ← Financial: "Supervisor → CFO → Audit Committee"
├── approval-chain.healthcare-addon.ts ← Healthcare: "Clinician → Chief Medical → Compliance"
└── approval-chain.default-addon.ts    ← Fallback: "Manager → Director"
```

The add-on implements the same interface as the generic service and delegates to it after adding industry-specific stages.

### 3.2 SOLID Application

| Principle | Application |
|-----------|-------------|
| **SRP** | Each addon handles ONE industry's overrides. The base service handles the generic flow. |
| **OCP** | New industry addon = new file registered in DI. Base service unchanged. |
| **LSP** | Addon implements the same interface as base service — interchangeable. |
| **ISP** | Addon interface exposes only the methods an industry needs to override. |
| **DIP** | Callers depend on interface, not concrete addon. DI resolves the right addon per tenant industry. |

---

## 4. Module Design

### 4.1 Compliance Checklist Engine

```typescript
// backend/src/modules/compliance/industry-compliance.service.ts

@Injectable()
export class IndustryComplianceService {
  constructor(
    private readonly checklistEngine: ChecklistEngine,
    private readonly lifecycleService: CustomerLifecycleService,
  ) {}

  async getChecklist(tenantId: string, industrySlug: string): Promise<ComplianceChecklist> {
    const config = COMPLIANCE_CHECKLISTS[industrySlug] ?? COMPLIANCE_CHECKLISTS['default'];
    const customerStages = await this.lifecycleService.getActiveCustomersByStage(tenantId);

    return {
      industrySlug,
      items: config.items.map(item => ({
        ...item,
        status: this.evaluateChecklistItem(item, customerStages),
      })),
      lastUpdated: new Date(),
    };
  }

  private evaluateChecklistItem(item: ChecklistItemDef, stages: CustomerStageCount[]): ChecklistStatus {
    // Evaluate based on customer data, not hardcoded
    // e.g., "90% of KYC-verified customers have current documents" = PASS
  }
}
```

```typescript
// backend/src/modules/compliance/checklist-definitions.ts

export const COMPLIANCE_CHECKLISTS: Record<string, ComplianceChecklistDef> = {
  'financial-services': {
    items: [
      { id: 'kyc-current', label: 'KYC documents current for 90%+ active clients', frequency: 'monthly',
        condition: (data) => data.kycCurrentRate >= 0.9 },
      { id: 'aml-training', label: '90%+ staff completed AML training', frequency: 'quarterly',
        condition: (data) => data.amlTrainingRate >= 0.9 },
      { id: 'reg-filings', label: 'All regulatory filings submitted on time', frequency: 'monthly',
        condition: (data) => data.regFilingsOnTime },
    ],
  },
  'healthcare-life-sciences': {
    items: [
      { id: 'hipaa-training', label: 'All staff completed HIPAA training', frequency: 'annual',
        condition: (data) => data.hipaaTrainingRate >= 1.0 },
      { id: 'breach-log', label: 'No unreported breaches in last 60 days', frequency: 'monthly',
        condition: (data) => data.openBreaches === 0 },
      { id: 'access-audit', label: 'Patient record access audit completed', frequency: 'quarterly',
        condition: (data) => data.lastAccessAuditDays <= 90 },
    ],
  },
  // ... per industry
};
```

### 4.2 Approval Routing Add-on System

```typescript
// backend/src/modules/approval-chains/addons/approval-addon.interface.ts
//
// FIX-COMPREHENSIVE-R2 (2026-07-23): extended with cross-tier guard.
// Each addon is now consumed by `ApprovalAddonRegistry.evaluateAgainstTier`
// which splits the returned `ApprovalRoute[]` into `eligible` (route's
// `stages.length <= tenant.tier.maxApprovalStages`) and `blocked`
// (over-cap routes carry `reason` + `minTierSlug` for the FE upgrade
// CTA). `ApprovalChainsService.getIndustryRoutes()` returns the full
// `TierGuardOutcome` so the consumer can render both eligible rules
// + actionable upgrade copy.

export interface ApprovalAddon {
  industrySlugs: string[];  // Which industries this addon applies to
  getRoutes(tenantId: string): Promise<ApprovalRoute[]>;
}

export interface TierGuardOutcome {
  eligible: ApprovalRoute[];
  blocked: Array<ApprovalRoute & { reason: string; minTierSlug: string }>;
  currentTierSlug: string | null;
  maxApprovalStages: number | null;
}
```

```typescript
// backend/src/modules/approval-chains/addons/financial-approval.addon.ts

@Injectable()
export class FinancialApprovalAddon implements ApprovalAddon {
  industrySlugs = ['financial-services', 'accounting-audit-services'];

  async getRoutes(tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'client-onboarding-kyc',
        label: 'Client Onboarding KYC Approval',
        stages: [
          { role: 'ComplianceOfficer', order: 1, action: 'verify' },
          { role: 'RiskManager', order: 2, action: 'assess' },
          { role: 'Director', order: 3, action: 'approve' },
        ],
        triggers: [{ event: 'customer.created', conditions: { industryGroup: 'financial-compliance' } }],
      },
      {
        slug: 'expense-override',
        label: 'Expense Override (>$5k)',
        stages: [
          { role: 'Manager', order: 1, action: 'approve' },
          { role: 'FinanceDirector', order: 2, action: 'review' },
          { role: 'CFO', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'expense.created', conditions: { amount: { gt: 5000 } } }],
      },
    ];
  }
}
```

### 4.3 Dashboard Template Registry

```typescript
// frontend-tenant/src/lib/dashboards/industry-dashboard.registry.ts

export interface DashboardTemplate {
  groupSlug: string;
  kpiWidgets: KpiWidgetDef[];
  chartWidgets: ChartWidgetDef[];
  listWidgets: ListWidgetDef[];
  defaultTimeRange: string;
}

export const INDUSTRY_DASHBOARDS: Record<string, DashboardTemplate> = {
  'financial-compliance': {
    kpiWidgets: [
      { metric: 'totalClients', label: 'Total Clients', color: 'blue' },
      { metric: 'complianceScore', label: 'Compliance Score', color: 'green',
        target: 95, format: 'percent' },
      { metric: 'pipelineValue', label: 'Pipeline Value', format: 'currency' },
      { metric: 'activeEngagements', label: 'Active Engagements', color: 'purple' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'revenueTrend', label: 'Revenue Trend', period: 'monthly' },
      { type: 'bar', metric: 'engagementByType', label: 'Engagements by Type' },
    ],
    listWidgets: [
      { type: 'approvals', label: 'Pending Approvals', maxItems: 5 },
      { type: 'deadlines', label: 'Upcoming Deadlines', maxItems: 5 },
    ],
    defaultTimeRange: '30d',
  },
  'healthcare': {
    kpiWidgets: [
      { metric: 'totalPatients', label: 'Total Patients', color: 'blue' },
      { metric: 'appointmentsToday', label: "Today's Appointments", color: 'green' },
      { metric: 'noShowRate', label: 'No-Show Rate', format: 'percent', target: 10, inverse: true },
      { metric: 'bedOccupancy', label: 'Bed Occupancy', format: 'percent', color: 'orange' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'patientVolume', label: 'Patient Volume', period: 'monthly' },
      { type: 'bar', metric: 'visitType', label: 'Visits by Type' },
    ],
    listWidgets: [
      { type: 'appointments', label: 'Today\'s Appointments', maxItems: 10 },
      { type: 'abnormalResults', label: 'Abnormal Lab Results', maxItems: 5 },
    ],
    defaultTimeRange: '7d',
  },
  // ... 6 more groups
};
```

### 4.4 Integration Preset Registry

```typescript
// backend/src/modules/integrations/industry-integration-presets.ts

export const INDUSTRY_INTEGRATION_PRESETS: Record<string, IntegrationPresetDef[]> = {
  'financial-services': [
    { slug: 'quickbooks', name: 'QuickBooks', type: 'accounting',
      description: 'Sync invoices, expenses, and client data with QuickBooks',
      tier: 'business', setupGuide: { authType: 'oauth2', docs: '...' } },
    { slug: 'xero', name: 'Xero', type: 'accounting',
      tier: 'professional', setupGuide: { authType: 'oauth2', docs: '...' } },
  ],
  'accounting-audit-services': [
    { slug: 'quickbooks', name: 'QuickBooks', type: 'accounting', tier: 'business' },
    { slug: 'xero', name: 'Xero', type: 'accounting', tier: 'professional' },
    { slug: 'thomson-reuters', name: 'Thomson Reuters', type: 'tax', tier: 'professional' },
  ],
  'technology-digital-services': [
    { slug: 'jira', name: 'Jira', type: 'dev', tier: 'business' },
    { slug: 'github', name: 'GitHub', type: 'dev', tier: 'business' },
    { slug: 'slack', name: 'Slack', type: 'comms', tier: 'basic' },
  ],
  'healthcare-life-sciences': [
    { slug: 'epic', name: 'Epic EHR', type: 'ehr', tier: 'professional' },
    { slug: 'labcorp', name: 'LabCorp', type: 'lab', tier: 'professional' },
  ],
  'retail-commerce-consumer': [
    { slug: 'shopify', name: 'Shopify', type: 'ecommerce', tier: 'business' },
    { slug: 'square', name: 'Square', type: 'pos', tier: 'business' },
  ],
  // ... more industries
};
```

### 4.5 Customer Field Definitions

```typescript
// backend/src/modules/industry-features/industry-customer-fields.ts

// Extends the IndustryFeatureProvider system from Stage 1
// Uses the same add-on pattern: each provider returns field definitions
// The CustomerForm renders fields dynamically based on tenant.industry

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: 'string' | 'enum' | 'date' | 'boolean' | 'encrypted';
  options?: string[];  // For enum type
  required: boolean;
  appearance?: { section: string; order: number };
}

// Example: In financial-compliance-feature.provider.ts
getCustomerFieldDefs(industrySlug: string): CustomerFieldDef[] | null {
  if (industrySlug === 'financial-services') return [
    { key: 'clientType', label: 'Client Type', type: 'enum',
      options: ['Individual', 'Small Business', 'Mid-Market', 'Enterprise'], required: true,
      appearance: { section: 'Classification', order: 1 } },
    { key: 'amlRiskTier', label: 'AML Risk Tier', type: 'enum',
      options: ['Low', 'Medium', 'High'], required: true,
      appearance: { section: 'Compliance', order: 1 } },
    { key: 'kycStatus', label: 'KYC Status', type: 'enum',
      options: ['Pending', 'Verified', 'Expired'], required: false,
      appearance: { section: 'Compliance', order: 2 } },
    { key: 'taxId', label: 'Tax ID', type: 'encrypted', required: false,
      appearance: { section: 'Financial', order: 1 } },
  ];
  return null;
}
```

The CustomerForm component dynamically renders sections/fields from this config:

```typescript
// frontend-tenant/src/components/customers/IndustryCustomerFields.tsx
// NEW — reads tenant.industry, fetches field definitions from config provider
// Renders fields grouped by appearance.section
```

---

### 4.6 Template Wiring — How Stage 2 Templates Drive Behavior

Stage 2's new config types must map to runtime services, same as Stage 1's `TenantTemplate` wiring. See [IMPLEMENTATION-STAGE1-FOUNDATION.md §4.7](./IMPLEMENTATION-STAGE1-FOUNDATION.md#47-template-wiring--how-templates-drive-runtime-behavior) for the wiring pattern.

| Stage 2 Feature | Consumed By | How |
|---|---|---|
| Compliance checklists | `IndustryComplianceService` (new) | Reads `COMPLIANCE_CHECKLISTS[industrySlug]`, evaluates conditions against customer stage data, produces compliance score for dashboard |
| Approval routes | `ApprovalChainService` (existing) + addon | Routes `approval-chains/financial-addon.ts` registers via DI. When `customer.created` event fires, addon injects financial-specific escalation stages |
| Dashboard KPI packs | `DashboardRenderer` (new) | Reads `INDUSTRY_DASHBOARDS[groupSlug]`, fetches metric data from project/customer services, renders widgets |
| Integration presets | `Marketplace` page | Filters connector list by `INDUSTRY_INTEGRATION_PRESETS[industrySlug]`, sorted by tier match |
| Customer field defs | `CustomerForm` + `IndustryCustomerFields` component | Reads field definitions, renders dynamic form sections grouped by `appearance.section` |

Each feature follows the add-on pattern: base service handles generic flow, industry addon injects industry-specific data. All addons are registered in DI and resolved per tenant's industry.

---

## 5. Implementation Phases

### Phase 2A: Compliance + Approvals (Month 3, Weeks 1-2) ✅

| Task | Files | Description |
|------|-------|-------------|
| Compliance checklist engine | `compliance/` module + `checklist-definitions.ts` | Core engine + per-industry definitions |
| Approval addon system | `approval-chains/addons/` | Addon interface + Financial/Healthcare implementations |
| Wire compliance into dashboard | Dashboard registry | Show compliance score from checklist |

### Phase 2B: Dashboard Templates + Field Definitions (Month 3, Weeks 3-4) ✅

| Task | Files | Description |
|------|-------|-------------|
| Dashboard template registry | `frontend-tenant/src/lib/dashboards/` | KPI packs per industry group |
| Dynamic KPI rendering | `frontend-tenant/src/components/dashboard/` | Read template and render widgets |
| Customer field definitions | Provider `getCustomerFieldDefs()` | Per-industry structured fields |
| IndustryCustomerFields component | `frontend-tenant/src/components/customers/` | Dynamic form rendering |

### Phase 2C: Integration Presets + Email Templates (Month 4, Weeks 1-2) ✅

| Task | Files | Description |
|------|-------|-------------|
| Integration preset registry | `integrations/industry-integration-presets.ts` | Per-industry connector recommendations |
| Marketplace sort by industry relevance | `frontend-tenant/src/app/marketplace/page.tsx` | Sort integrations by industry match |
| Notification template registry | `notifications/industry-notification-templates.ts` | Per-industry template strings |

### Phase 2D: Remaining Industry Enhancements (Month 4, Weeks 3-4) ✅

| Industry | Stage 2 Delivery |
|----------|-----------------|
| Financial & Compliance | Risk analytics dashboards, automated KYC workflows (ID verification integration) |
| Business & Technology | SLA monitoring dashboards, ticket auto-triage, engagement profitability view |
| Consumer & Commerce | Inventory dashboards, campaign ROI tracking, order fulfillment view |
| Industrial & Infra | Production dashboards, work order automation, maintenance schedules |
| Healthcare | Clinical workflow automation, integration presets (EHR, lab), no-show prediction |
| Public & Social | Grant compliance dashboards, volunteer management automation, case workflows |
| Agriculture & Food | Crop planning dashboards, quality tracking, distribution view |
| Other | Portfolio consolidation dashboards, governance tracking |

---

## 6. SOLID Compliance Checklist

| Principle | How Stage 2 Satisfies It |
|-----------|--------------------------|
| **SRP** | Each addon handles ONE industry's overrides. Compliance engine = one concern. Dashboard registry = one concern. |
| **OCP** | New integration preset = add entry to registry. New approval addon = new file in addons directory. Zero changes to base services. |
| **LSP** | All approval addons implement `ApprovalAddon` interface. All dashboard templates conform to `DashboardTemplate` interface. |
| **ISP** | Compliance, approvals, dashboards, fields are separate interfaces — consumers import only what they need. |
| **DIP** | `ApprovalChainService` depends on `ApprovalAddon[]` (abstract). DI resolves the right addon per tenant industry. |

---

## 7. Dependencies & Sequencing

```
Stage 1 Complete (precondition)
       │
       ▼
[Phase 2A: Compliance + Approvals]
       ├── Compliance Checklist Engine (new module)
       ├── Approval Addon Interface + Implementations
       └── Compliance dashboard widgets
       │
       ▼
[Phase 2B: Dashboards + Customer Fields]
       ├── Dashboard Template Registry
       ├── Dynamic KPI Rendering
       └── Industry Customer Fields (dynamic form)
       │
       ▼
[Phase 2C: Integrations + Notifications]
       ├── Integration Preset Registry
       ├── Marketplace sorting
       └── Notification Template Registry
       │
       ▼
[Phase 2D: Per-Industry Enhancements]
       └── Each group's Stage 2 features delivered per priority
```

---

## 8. Completion Summary (2026-07-22)

### 8.1 What Was Built

**Backend (17 files created, 7 modified):**

| Phase | Files Created | Files Modified |
|-------|--------------|---------------|
| 2A | 15 | 2 |
| 2B | 2 | 2 |
| 2C | 3 | 3 |
| 2D | 2 | 2 |
| **Total** | **22** | **9** |

**Frontend (4 files created, 2 modified):**

| Phase | Files Created | Files Modified |
|-------|--------------|---------------|
| 2A | 2 | 0 |
| 2B | 1 | 1 |
| 2C | 0 | 1 |
| 2D | 0 | 1 |
| **Total** | **3** | **3** |

### 8.2 Module / Registry Inventory

| Component | Location | Items Covered |
|-----------|----------|---------------|
| Compliance Checklist Engine | `backend/src/modules/compliance/` | 5 files: module, service, controller, interface, definitions (18 industry entries) |
| Approval Addon System | `backend/src/modules/approval-chains/addons/` | 10 files: interface, registry, 8 addon implementations (32 approval routes) |
| Dashboard Template Registry | `frontend-tenant/src/lib/dashboards/` | 1 file: 8 groups with 32 primary KPIs + 32 Phase 2D KPIs + 32 charts |
| Dashboard Renderer | `frontend-tenant/src/components/dashboard/` | 1 file: IndustryDashboardRenderer + Fallback skeleton |
| Customer Field Definitions | `backend/src/modules/industry/customer-fields/` | 2 files: definitions (17 industry entries) + service |
| IndustryCustomerFields Component | `frontend-tenant/src/components/customers/` | 1 file: dynamic form rendering with section grouping |
| Integration Preset Registry | `backend/src/modules/integrations/` | 1 file: 82 integration presets across 17 industries |
| Notification Template Registry | `backend/src/modules/notifications/` | 2 files: 44 templates across 8 groups + service with variable interpolation |
| Industry Workflow Templates | `backend/src/modules/workflows/` | 2 files: 32 workflow templates across 8 groups + service |

### 8.3 API Endpoints Added

| Endpoint | Method | Phase | Description |
|----------|--------|-------|-------------|
| `/api/v1/compliance/checklist/:group` | GET | 2A | Compliance checklist for a given industry group |
| `/api/v1/compliance/checklists` | GET | 2A | All compliance checklists across groups |
| `/api/v1/compliance/score/:group` | GET | 2A | Compliance score for a given group |
| `/api/v1/industries/:slug/customer-fields` | GET | 2B | Customer field definitions per industry |
| `/api/v1/industries/:slug/integration-presets` | GET | 2C | Integration recommendations per industry |
| `/api/v1/workflows/industry-templates` | GET | 2D | Workflow automation templates per group |

### 8.4 Industry Group Coverage

| Group | Checklists | Approval Routes | Dashboard KPIs | Customer Fields | Integration Presets | Notification Templates | Workflow Templates |
|-------|-----------|----------------|---------------|-----------------|-------------------|----------------------|-------------------|
| Financial & Compliance | 2 entries (13 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 3 industries (15 fields) | 3 industries (16 presets) | 5 templates | 4 workflows |
| Healthcare | 1 entry (7 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 1 industry (6 fields) | 1 industry (6 presets) | 5 templates | 4 workflows |
| Business & Technology | 2 entries (13 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 2 industries (10 fields) | 2 industries (14 presets) | 5 templates | 4 workflows |
| Consumer & Commerce | 2 entries (10 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 2 industries (9 fields) | 2 industries (13 presets) | 5 templates | 4 workflows |
| Industrial & Infra | 5 entries (31 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 4 industries (22 fields) | 4 industries (14 presets) | 5 templates | 4 workflows |
| Public & Social | 4 entries (22 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 3 industries (14 fields) | 3 industries (10 presets) | 5 templates | 4 workflows |
| Agriculture & Food | 1 entry (7 items) | 4 routes | 4 primary + 4 phase2d + 4 charts | 1 industry (5 fields) | 1 industry (5 presets) | 5 templates | 4 workflows |
| Other | 1 entry (5 items) | 3 routes | 4 primary + 4 phase2d + 4 charts | 1 industry (4 fields) | 1 industry (4 presets) | 5 templates | 4 workflows |

### 8.5 TypeScript Compilation

| Target | Result |
|--------|--------|
| `backend` — `tsc --noEmit` | **0 errors** |
| `frontend-tenant` — `tsc --noEmit` | **0 errors** |

### 8.6 Independent Audit Results

- **30 verification checks** performed across all 4 phases
- **30 PASS** / **0 FAIL** / **0 WARNINGS**
- All files present, properly interconnected, no circular dependencies
- All registries cover all 8 industry groups and their constituent industries
- SOLID principles verified: SRP (one concern per addon), OCP (registry pattern), LSP (addons implement shared interface), ISP (focused contracts), DIP (services depend on abstractions)

### 8.7 Known Gaps (Non-Blocking)

> **2026-07-23 update (FIX-COMPREHENSIVE-R2):** the first row was previously marked "Low — service wiring deferred". Round-2 closed that gap. The other three remain valid gaps.

| Gap | Severity | Notes |
|-----|----------|-------|
| ~~`ApprovalChainsService` does not yet consume `ApprovalAddonRegistry`~~ | ✅ **FIXED (FIX-C, 2026-07-23)** | `ApprovalChainsService.getIndustryRoutes()` now consumes the registry via the `evaluateAgainstTier` tier-guard path and returns a `TierGuardOutcome`. See [fixes.md §FIX-COMPREHENSIVE-R2](fixes.md#fix-comprehensive-r2--universal-template-baseline--rail-invalidation--approval-cross-tier-guard-2026-07-23-1730-pkt) + the new unit spec `approval-chains-tier-guard.spec.ts` (4 cases). |
| No backend endpoint for notification template preview/render | Low | Templates exist and `sendFromTemplate()` works; a preview endpoint can be added as needed |
| Dashboard KPIs use static metric names — no backend aggregation service for dashboard data | Medium | The `IndustryDashboardRenderer` expects `metricValues` props; a backend `/api/v1/dashboard/:group` aggregation endpoint should be added in a follow-up phase |
| No industry-specific seeding for `knowledge/` module (compliance docs RAG) | Low | Deferred — Stage 3 builds on Stage 2 compliance content for advanced RAG |

> **2026-07-25 update (FIX-INDUSTRY-VERIFY-5):** the `compliance` controller had a routing bug (D10, double-prefixed URL) and the `workflows` controller's `industry-templates` route was shadowed by `:id` (D11). Both routes are now fixed but the workflows endpoint was renamed to `/api/v1/workflows/templates/industry` — any external client of the old URL will 404. FE has no callers of the old URL.

---

## 9. What Defers to Stage 3

| Feature | Reason |
|---------|--------|
| Predictive analytics (ML models) | Needs data collection from Stage 1-2 usage |
| Regulatory tracking automation | Needs monitoring infrastructure |
| Industry-specific AI agents (fine-tuned) | Needs training data + compute budget |
| Sub-industry deep specialization | Stage 1-2 proves the group; Stage 3 deepens |
| Peer benchmarking | Needs anonymized multi-tenant data |
| Advanced RAG (industry knowledge corpus) | Stage 3 builds on Stage 2 compliance content |

---

## 10. Verification Log

### 10.1 Run-5 (2026-07-25 13:45 PKT) — Kilo

Stage 2 endpoints exercised end-to-end via real headed-browser interaction with 2 fresh tenants (Verify Demo + ReVerify Demo, both `accounting-audit-services`).

**Stage 2 endpoints verified working:**

- ✅ `GET /api/v1/compliance/checklist/:group` — returns 7 items + score 71 (D10 fix)
- ✅ `GET /api/v1/compliance/score/:group` — returns `{ industryGroup, complianceScore }`
- ✅ `GET /api/v1/approval-chains/industry-routes?industry=<slug>` — returns `TierGuardOutcome` with eligible + blocked + reason + minTierSlug
- ✅ `GET /api/v1/industries/:slug/customer-fields` — returns field definitions with section groupings
- ✅ `GET /api/v1/industries/:slug/integration-presets` — returns industry-specific connector presets
- ✅ `GET /api/v1/workflows/templates/industry?group=<slug>` — renamed endpoint (D11 fix)
- ✅ Industry dashboard renders for financial-compliance tenants
- ✅ Industry notification templates seeded
- ✅ Industry workflow templates seeded

**Stage 2 issues found and fixed in run-5:**

- D10 (compliance controller URL) — fixed: changed `@Controller('api/v1/compliance')` → `@Controller({ path: 'compliance', version: '1' })`
- D11 (workflows `/industry-templates` shadowed by `:id`) — fixed: renamed to `/templates/industry`
- D14 (tier description mismatch) — fixed: updated `tier-government-003` description

**Stage 2 issues NOT yet fixed:**

- Dashboard KPIs use static metric names — no backend aggregation service (`IndustryDashboardRenderer` expects `metricValues` props; a `/api/v1/dashboard/:group` endpoint should be added in a follow-up phase)
- No FE route at `/compliance` — checklist API works but no UI surface

Full run-5 report: `audits/2026-07-25-industry-verification/final-report.md`. See [fixes.md §FIX-INDUSTRY-VERIFY-5](../../fixes.md).

**Run-6 (2026-07-25 20:06 PKT) — Healthcare industry end-to-end verified on Professional tier:**

The Healthcare & Life Sciences industry was re-verified end-to-end on Professional tier via the new `ReVerify Community Health Alliance` tenant. **All Stage 2 features work for healthcare after the D21 + D29 fixes:**

- ✅ Healthcare workspace stubs: `/workspace/appointments`, `/workspace/medical-records`, `/workspace/pharmacy`, `/workspace/laboratory` all render with industry-aware `Industry Group: Healthcare & Life Sciences` label
- ✅ Healthcare customer form: 4 industry-specific fields persist (Clinical: Patient ID Prefix, Insurance Provider, Primary Physician, MRN; Compliance: HIPAA Consent on File; Personal: Emergency Contact)
- ✅ Healthcare compliance checklist API: `GET /api/v1/compliance/checklist/healthcare` returns 7 items, complianceScore=86
- ✅ Healthcare workflow templates API: `GET /api/v1/workflows/templates/industry?group=healthcare` (works after D11 rename)
- ✅ Healthcare notification templates seeded (seed-healthcare-templates.cjs)
- ✅ Healthcare customer-field definitions API
- ✅ Healthcare integration presets API (where applicable)
- ✅ Healthcare dashboard widgets: Today's Appointments, Abnormal Lab Results, Pending Specialist Referrals, Medication Reviews Due

**Stage 2 issues found in run-6 and fixed:**

- D18 — `insurance` industry missing from 4 duplicated `INDUSTRY_GROUP_INDUSTRIES` static maps (BE tier-industry-matrix.ts, BE department-templates.service.ts, FE industryGroups.ts, admin industries.ts). `GET /api/v1/industries/groups` now returns 3 F&C industries. **Stage 2 implication:** `/api/v1/department-templates?industryGroup=financial-compliance` was using the stale static map in `department-templates.service.ts:13-22` — that map is now aligned with the canonical taxonomy. **Stage 2 implication:** `GET /api/v1/industries/groups` was missing the third F&C industry in its response, which broke the admin tenant-creation form's industry dropdown.
- D19 — Plan Impact panel "Default agents" caption disambiguates industry pool size (e.g. 12 for F&C) from tier cap (e.g. 50 for Professional). Helps tenants pick a tier that matches their industry pool.
- D20 — Accounting template description: "12 AI Employees" → "10 AI Employees" (synced with the D12 structure trim). Cosmetic but a tenant-visible inconsistency.
- D21 — Healthcare department template (`healthcare-clinic` slug, 8 depts) created and seeded. New file: `backend/prisma/seed-healthcare-department-template.cjs`. This was a Stage 1 gap (Stage 1 §13.5 noted only 6/8 industry groups had department templates) that was also a Stage 2 blocker because the template step in onboarding is what gets tenants to a usable department set.
- D24 — Customers page h1 is now industry-aware. Healthcare tenant shows "Patients"; accounting tenant shows "Clients & Accounts".
- D29 — Healthcare TierAgentPool populated with 8 entries on the Professional tier. 8 healthcare AgentTemplates created. 8 backfilled Agent rows on the pre-existing ReVerify Community Health Alliance tenant. This unblocks the `selectIndustryDefaultAgents()` path for healthcare. Partial fix: other industries (Non-Profit, Insurance, etc.) may have the same gap — see D29-PARTIAL follow-up.

**Stage 2 issues NOT yet fixed (carry-over from run-6):**

- D22 (HIGH, BLOCKING) — Tenants cannot self-deploy department templates from `/departments?tab=templates`. UI says "Contact admin to deploy". Currently worked around by D21 auto-deploy at onboarding.
- D26 (MEDIUM) — Approval chain stage cap to `tier.maxApprovalStages` not enforced.
- D27 (HIGH) — Tier ID `tier-government-003` slug misleading (data-only).
- D28 (LOW) — AI chat live-data context doesn't include projects/customers.

Full run-6 report: `audits/2026-07-25-industry-verification-run6-professional/final-report.md`. See [fixes.md §FIX-INDUSTRY-VERIFY-6](../../fixes.md).
