# NeureCore — Industry Groups & Industries: Concept and Implementation Plan

**Status:** 📋 Draft for review
**Date:** 2026-07-21
**Owner:** Product + Platform team
**First vertical to ship:** Financial & Compliance Group
**Related docs:** [pools-taxonomy.md §3](../pools-taxonomy.md#3-industries-pool--canonical-16-majors-), [system-state.md](../system-state.md), [left-rail-icon.md](../left-rail-icon.md), [TENANT-GUIDE-project-creation.md](../TENANT-GUIDE-project-creation.md), [fixes.md §FIX-039](../fixes.md)

---

## 1. The Problem

NeureCore's `Industry` pool has **16 rows** on production (per `pools-taxonomy.md` §3, seeded 2026-07-05). Each row carries 5-10 sub-industries as bullet text inside `Industry.description`. Three problems flow from this:

1. **Cognitive overload.** Showing 16 industries to a new tenant at onboarding is too many choices — they freeze or pick arbitrarily.
2. **The "Special Purpose Organizations" bucket is vague.** It catches Family Offices, Holding Companies, Religious Orgs, Cooperatives — users have no signal whether they belong there.
3. **No link to runtime behavior.** The industry is stored on `Tenant.industry String?` but nothing downstream (navigation, project types, package recommendations) actually branches on it. It's currently a label, not a behaviour driver.

A user asked: *"Instead of asking the user to choose from a list of 16 every time, organize them into 5-7 industry families. This reduces cognitive load while still allowing specialization underneath."*

This document is the response.

---

## 2. Decisions Locked In

After review, the following are agreed:

| # | Decision | Rationale |
|---|---|---|
| **D1** | Rename **Major Industry** → **Industry** | The 16 rows are the canonical taxonomy. "Major" was internal jargon; users don't need that distinction. |
| **D2** | Introduce a new top-level concept: **Industry Group** | An Industry Group is a folder containing 1-3 Industries. Used in onboarding picker and grouping logic. |
| **D3** | **8 Industry Groups**, 16 Industries | Healthcare, Public & Social, Financial & Compliance, Business & Technology, Industrial & Infrastructure, Consumer & Commerce, Agriculture & Food, Other |
| **D4** | Onboarding picker is a **single expandable list**, not a 3-step wizard | Click a Group to expand its Industries; click an Industry to select it. No separate sub-industry step. |
| **D5** | Sub-industries remain as **descriptive metadata** in `Industry.description` | No new `SubIndustry` table. Users see them as bullets under the Industry they pick. |
| **D6** | Tenant stores both `industryGroup` (slug) and `industry` (slug) | Group is for filtering/bundling; Industry is the precise anchor for packages, project types, and nav. |
| **D7** | Only **Financial & Compliance Group** ships in Phase 1 | Proof-of-concept. Other Groups follow the same pattern once D7 lands. |
| **D8** | **80/20 navigation principle** | 80% of the IconRail is identical across all Industries. Only Workspace + Customers change. |

---

## 3. The 8 Industry Groups

| # | Group slug | Group label | Industries in group | Industry slugs |
|---|---|---|---|---|
| 1 | `healthcare` | Healthcare | Healthcare & Life Sciences | `healthcare-life-sciences` |
| 2 | `public-social` | Public & Social | Government & Public Sector, Education & Research, Non-Profit & International | `government-public-sector`, `education-research`, `nonprofit-international` |
| 3 | `financial-compliance` | Financial & Compliance | Financial Services, Accounting & Audit Services | `financial-services`, `accounting-audit-services` |
| 4 | `business-technology` | Business & Technology | Technology & Digital Services, Professional & Business Services | `technology-digital-services`, `professional-business-services` |
| 5 | `industrial-infrastructure` | Industrial & Infrastructure | Manufacturing & Industrial, Construction/Engineering/Infrastructure, Energy/Utilities/Natural Resources, Logistics/Transportation/Supply Chain | `manufacturing-industrial`, `construction-engineering-infrastructure`, `energy-utilities-natural-resources`, `logistics-transportation-supply-chain` |
| 6 | `consumer-commerce` | Consumer & Commerce | Retail/Commerce/Consumer, Media/Communications/Creative | `retail-commerce-consumer`, `media-communications-creative` |
| 7 | `agriculture-food` | Agriculture & Food | Agriculture & Food Systems | `agriculture-food-systems` |
| 8 | `other` | Other | Special Purpose Organizations | `special-purpose-organizations` |

---

## 4. Why these 8 (not 7, not 10, not 16)

### Why 8 (not 7)

The user's first proposal had 7 families: they merged Financial + Accounting, and Technology + Professional Services into one "Commercial & Professional Services" family. After review, two refinements emerged:

- **Financial + Accounting** share enough workflow (audits, compliance, reports, clients) to belong together.
- **Technology + Professional Services** also share enough (projects, clients, knowledge, billing) to belong together.

But combining both pairs into ONE family (`Commercial & Professional Services`) makes it too broad — banking workflows and software agency workflows have little in common. **Splitting them into 2 families** (Financial & Compliance / Business & Technology) preserves workflow coherence at the cost of one extra picker row. The 80/20 principle prefers coherence over minimising option count.

### Why 8 (not 10 or 16)

| Option count | Tradeoff |
|---|---|
| 5 | Loses meaningful workflow distinctions (Healthcare buried inside Public & Social) |
| **8 (chosen)** | Sweet spot — each Group has a coherent operational shape, no Group feels too broad |
| 10 | Requires forced merges that destroy meaning (Education ≠ Government ≠ NGO) |
| 16 | Cognitive overload at onboarding, which is the original problem |

### Why "Other" is its own Group (not deleted)

The user correctly flagged "Special Purpose Organizations" as vague. Renaming to "Other" is more honest about its catch-all nature. Family Offices, Holding Companies, Conglomerates do share **structural** similarity (multi-entity, portfolio thinking) even if their workflows differ wildly. Keeping it as a Group — and being explicit that it's the catch-all — is better than forcing them into something more specific that doesn't fit.

---

## 5. Target Customer Profiles — Who Actually Subscribes

Not every industry in the taxonomy will realistically buy an AI platform like NeureCore. Large enterprises (banks, hospitals, government) have locked-in vendor ecosystems. The real customers are **small to mid-size organizations** that need affordable AI-powered operations but can't afford or aren't locked into SAP, Epic, or core banking systems.

### 5.1 Healthcare — `healthcare-life-sciences`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Private medical clinics & urgent care centers** | Need appointment scheduling, patient records, billing — no budget for Epic/Cerner | Happily use SaaS; need affordable ops automation |
| **Telehealth / digital health startups** | Tech-native founders, remote-first ops, need AI agents | Built for cloud; will adopt Hermes quickly |
| **Wellness & med spas** | Client management, marketing campaigns, appointment ops | Simple needs, no legacy system lock-in |
| **Private dental / optometry / physio practices** | Multi-location, need scheduling + billing + patient comms | Under-served market; existing options are outdated |

**NOT realistic customers:** Large hospital systems (Epic/Cerner lock-in), public health authorities.

### 5.2 Public & Social — `government-public-sector`, `education-research`, `nonprofit-international`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Non-profits & NGOs** | Cost-sensitive, need grant tracking, volunteer mgmt, donor comms | Love affordable tools; SaaS is their default |
| **Training & vocational institutes** | Student management, course scheduling, certification tracking | Private education; not locked into university ERP |
| **Foundations & grant-making orgs** | Portfolio tracking, grant lifecycle, compliance reporting | Admin-heavy, need efficiency, no enterprise IT mandates |
| **Think tanks & research orgs** | Project-based knowledge work, publication workflows | Small teams, project-driven, need AI |

**NOT realistic customers:** Government agencies (RFPs, security clearance), public universities (legacy ERP).

### 5.3 Financial & Compliance — `financial-services`, `accounting-audit-services`

**This is the Phase 1 vertical — highest priority.**

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Small to mid-size accounting & bookkeeping firms** | 15 packages built for them. Need client engagement mgmt, tax filing, audit workflows. | Exists today. `mali@live.com` is real. Most likely early adopter. |
| **Independent wealth advisors & RIAs** | Portfolio management, client reporting, compliance. No core banking system to fight. | Agile, tech-adopting, need affordable CRM+portfolio tools. |
| **FinTech startups** | Project management, regulatory sandbox tracking, product launches. Tech-native. | Built for cloud, love AI, no legacy. |
| **Tax advisory & consulting firms** | Engagement-based work. Tax filing pipelines, compliance calendars, client deliverables. | Similar to accounting firms — project-driven, AI-ready. |
| **Payroll & bookkeeping service bureaus** | Multi-client ops, recurring deliverables, compliance deadlines. | Already use SaaS tools; NeureCore can consolidate. |

**NOT realistic customers:** Banks (core banking lock-in, IT compliance), insurance carriers (legacy policy admin), large audit firms (Big 4 own their stacks).

### 5.4 Business & Technology — `technology-digital-services`, `professional-business-services`

**Most natural fit — technology buyers buying technology.**

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **SaaS / software companies** | They sell tech, they buy tech. Need product dev, support tickets, release mgmt. | Ideal customer — get AI, will evangelize. |
| **IT consulting & dev shops** | Project-based. Need resource planning, time tracking, client deliverables. | Agency model maps perfectly to NeureCore's project system. |
| **Management & strategy consulting firms** | Engagement-heavy. Need knowledge management, deliverable tracking, AI research. | Will pay for AI edge. Hermes for research = huge value. |
| **Marketing & creative agencies** | Campaign management, client comms, content production, approvals. | High-volume project work, AI content generation is a major draw. |
| **Architecture & design studios** | Project-based. Drawings, revisions, client reviews, permit tracking. | Under-served by CRM; need workflow automation badly. |

**NOT realistic customers:** Enterprise SI (Accenture/Deloitte — own platforms), freelancers (too small, won't pay).

### 5.5 Industrial & Infrastructure — `manufacturing-industrial`, `construction-engineering-infrastructure`, `energy-utilities-natural-resources`, `logistics-transportation-supply-chain`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Small to mid-size manufacturers** | Need production tracking, quality control, work orders — without SAP/MES budget. | Under-served by expensive ERP. NeureCore fills the gap. |
| **General contractors & construction firms** | Site management, project mgmt, subcontractor coordination, permit tracking. | Construction tech adoption rising. Project-driven = good fit. |
| **Logistics brokers & 3PLs** | Shipment tracking, fleet coordination, client reporting. | Need ops tooling without a TMS implementation. |
| **Renewable energy developers** | Project-heavy (solar/wind farm builds), grant compliance, site mgmt. | Startup-like culture, tech-forward, multi-project. |

**NOT realistic customers:** Heavy industry (SAP lock-in), oil & gas majors (proprietary systems), large logistics (enterprise TMS).

### 5.6 Consumer & Commerce — `retail-commerce-consumer`, `media-communications-creative`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **DTC / e-commerce brands** | Growth-focused. Need ops, campaign management, customer support, inventory. | Tech-native founders, no retail legacy. Shopify-native. |
| **Digital media & content studios** | Creative workflows, campaign production, client approvals, content calendars. | AI content tools are a huge draw. High-volume project work. |
| **Restaurant groups & franchises** | Multi-location ops. Need standardization, supplier mgmt, HR across locations. | Under-served by restaurant tech. NeureCore as ops backbone. |
| **Fashion & lifestyle brands** | Product lifecycle (design → sample → production), campaign planning. | Project-driven, seasonal rushes, need workflow automation. |

**NOT realistic customers:** Large retail chains (SAP/Oracle lock-in), grocery chains (specialized systems).

### 5.7 Agriculture & Food — `agriculture-food-systems`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Specialty food & beverage producers** | Small-batch production, traceability, quality tracking, distribution. | Need affordable ops. Under-served by agri-ERP. |
| **AgTech startups** | Tech-native, precision farming data, field mgmt, crop planning. | Built for cloud. Love AI and automation. |
| **Organic farms & cooperatives** | Certification tracking, harvest planning, supply chain. | Growing market adopting tech slowly — NeureCore can be early. |

**NOT realistic customers:** Large agribusiness (John Deere ops center), commodity grain farms.

### 5.8 Other — `special-purpose-organizations`

| Profile | Why They Subscribe | Why They're Realistic |
|---------|-------------------|----------------------|
| **Family offices** | Multi-entity portfolio tracking, investment reporting, compliance. | High willingness to pay. Need consolidated view. |
| **Holding companies** | Subsidiary oversight, consolidated financials, board reporting. | Admin-heavy, need dashboard across entities. |
| **Religious organizations** | Membership mgmt, donation tracking, volunteer coordination, event planning. | Under-served by specialized tools. NeureCore as ops base. |
| **Cooperatives** | Member management, governance, distribution tracking. | Need affordable, flexible platform. |

### 5.9 Realistic Acquisition Priority

Based on product fit, willingness to pay, and sales cycle:

| Priority | Profile | Rationale |
|----------|---------|-----------|
| **P0 — Ship now** | Accounting & bookkeeping firms | 15 packages exist. `mali@live.com` is live. Compliance workflows ready. |
| **P1 — Short cycle** | SaaS / IT consulting / agencies | Tech buyers. Understand AI value. Short sales cycle. |
| **P1 — Short cycle** | Marketing & creative agencies | AI content = huge draw. Project-heavy = perfect fit. |
| **P2 — Medium cycle** | FinTech startups | Tech-native, need compliance + project mgmt. |
| **P2 — Medium cycle** | Non-profits & foundations | Cost-sensitive but loyal. Grant tracking is a clear need. |
| **P2 — Medium cycle** | Small manufacturers & contractors | Under-served by ERP. Need work orders + project tracking. |
| **P3 — Long cycle** | Wealth advisors & tax firms | Compliance-heavy, need trust. Longer sales. |
| **P3 — Long cycle** | DTC brands & content studios | High churn risk. Need proven ROI first. |
| **P4 — Niche** | Family offices, co-ops, religious orgs | Small market. Low volume but high willingness to pay. |

---

## 6. Data Model Changes

### 6.1 Schema additions

```prisma
model Industry {
  id              String         @id @default(uuid())
  slug            String         @unique
  name            String
  industryGroup   String         // NEW — slug of the IndustryGroup
  description     String?        @db.Text
  icon            String?
  status          IndustryStatus @default(ACTIVE)
  sortOrder       Int            @default(0)
  groupSortOrder  Int            @default(0)  // NEW — sort within group

  packages Package[]

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([industryGroup, groupSortOrder])
  @@index([status, sortOrder])
  @@map("industries")
}

model Tenant {
  // ... existing fields
  industry        String?  // existing — slug of selected Industry
  industryGroup   String?  // NEW — slug of selected Industry Group (denormalised for fast filtering)
  // ...
}
```

**Why denormalise `industryGroup` on `Tenant`?**

Because the IconRail, Marketplace filter, and project-type filter all need to filter by group quickly. Joining `Tenant → Industry` on every nav render would be wasteful. Store both fields, update them in a transaction when the tenant picks a new Industry.

### 6.2 No new table for IndustryGroup

The 8 Groups are static and well-known. Embed them as a TypeScript constant in the frontend + a Zod enum in the backend. If a 9th Group ever needs to be added, the only edit is the constant/enum.

```ts
// frontend-tenant/src/lib/industryGroups.ts
export const INDUSTRY_GROUPS = [
  { slug: 'healthcare',                label: 'Healthcare',                  icon: 'HeartPulse' },
  { slug: 'public-social',             label: 'Public & Social',             icon: 'Landmark' },
  { slug: 'financial-compliance',      label: 'Financial & Compliance',      icon: 'Building' },
  { slug: 'business-technology',       label: 'Business & Technology',       icon: 'Briefcase' },
  { slug: 'industrial-infrastructure', label: 'Industrial & Infrastructure', icon: 'Factory' },
  { slug: 'consumer-commerce',         label: 'Consumer & Commerce',         icon: 'ShoppingBag' },
  { slug: 'agriculture-food',          label: 'Agriculture & Food',          icon: 'Wheat' },
  { slug: 'other',                     label: 'Other',                       icon: 'Layers' },
] as const;

export type IndustryGroupSlug = typeof INDUSTRY_GROUPS[number]['slug'];
```

### 6.3 Migration plan

```bash
# 1. Add columns (nullable first to avoid breaking existing tenants)
psql: ALTER TABLE industries ADD COLUMN "industryGroup" VARCHAR(50);
psql: ALTER TABLE industries ADD COLUMN "groupSortOrder" INT DEFAULT 0;
psql: ALTER TABLE tenants ADD COLUMN "industryGroup" VARCHAR(50);

# 2. Run a data migration script
node prisma/migrate-industry-groups.cjs
#   - Reads each Industry row by slug
#   - Sets industryGroup based on a hard-coded slug→group map
#   - Sets groupSortOrder based on existing sortOrder mod 10 (10, 20, 30 → within-group order)

# 3. Backfill Tenant.industryGroup from existing Tenant.industry
node prisma/backfill-tenant-industry-group.cjs
#   - For every tenant, look up the Industry row, copy its industryGroup

# 4. Once verified, make columns NOT NULL
psql: ALTER TABLE industries ALTER COLUMN "industryGroup" SET NOT NULL;
```

The `mali@live.com` tenant fix (per `system-state.md` 2026-07-12, where `industry: 'ACCOUNTING'` was remapped to `'financial-services'`) is a precedent — the migration needs to handle unknown `industry` values by leaving `industryGroup` null and surfacing a warning.

---

## 7. Onboarding UX: Expandable List Picker

The agreed flow (per user's confirmation): **single expandable list, click Group → expand → click Industry inside it → select**.

### 7.1 Visual

```
┌────────────────────────────────────────────┐
│ Choose your industry                       │
│                                            │
│ ▼ Healthcare                               │
│      Healthcare & Life Sciences            │
│                                            │
│ ▶ Public & Social                          │
│ ▶ Financial & Compliance  ← click to open │
│   ─────────────────────────────────────    │
│   ▼ Financial & Compliance                 │
│      • Financial Services                  │
│      • Accounting & Audit Services         │
│                                            │
│ ▶ Business & Technology                    │
│ ▶ Industrial & Infrastructure             │
│ ▶ Consumer & Commerce                      │
│ ▶ Agriculture & Food                       │
│ ▶ Other                                    │
│                                            │
│ Sub-industries (descriptive only):         │
│   Banks, Insurance, Wealth Mgmt,           │
│   Tax Advisory, Audit, Payroll             │
│                                            │
│            [ Continue ]                    │
└────────────────────────────────────────────┘
```

### 7.2 Behaviour

- **One Group open at a time** — opening a Group auto-collapses the previous one (accordion behaviour).
- **Clicking an Industry** selects it and shows the sub-industry bullets below as descriptive text (not selectable).
- **Searchable** — type-ahead filters Groups first, then Industries inside matching Groups.
- **Selection persists** to `tenant.industry` + `tenant.industryGroup` via `PATCH /onboarding/state`.
- **Skip available** — Industry is optional for non-regulated tenants (per existing `onboarding-flow.md` behaviour).

### 7.3 Component file

```
frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx
```

State machine: `closed | group-expanded | industry-selected`. Uses existing `CompanyStep.tsx` shell, replaces the current `<select>` with the expandable list.

### 7.4 Affected existing files

| File | Change |
|---|---|
| `CompanyStep.tsx` | Replace industry `<select>` with `<IndustryGroupPicker>` |
| `domain.types.ts` | Add `industryGroup` to Tenant type |
| `tenants.service.ts` | Accept `industryGroup` in `updateOnboardingState()` |
| Backend `OnboardingStateDto` | Accept `industryGroup` string field |

---

## 8. The 80/20 Navigation Principle

User confirmed: **80% of IconRail stays identical across all Industries; only Workspace + Customers sections change**.

### 8.1 What stays the same (all Industries)

From `left-rail-icon.md` §3.2, the canonical rail has 6 sections / 19 items. The 80% common set:

| Section | Items | Behaviour |
|---|---|---|
| Home | Home | Always visible, always at top |
| (no section) | — | — |
| **Workspace** | Departments, Org Chart, Tasks, Workflows, Routines, Goals, Projects | **Dynamic** — see §7.2 |
| **Customers** | Customers | **Dynamic** — see §7.3 |
| Marketplace | Marketplace, Agents, Connectors, AI Skills | Always visible |
| Service Desk | Service Desk, Inbox, Approvals, Activity | Always visible |
| Finance | Finance | Always visible |
| Intelligence | Intelligence, Settings | Always visible |

### 8.2 What changes in Workspace per Industry Group

The 7 generic Workspace items above stay for all. **Additional items appear/disappear** per Group:

| Industry Group | Extra Workspace items |
|---|---|
| Healthcare | Appointments, Medical Records, Pharmacy, Laboratory |
| Public & Social | Programs, Grants, Field Operations, Cases, Licenses |
| Financial & Compliance | Loans, Portfolios, Compliance, Audits, Tax Returns, Engagements, Risk |
| Business & Technology | Tickets, Releases, Contracts, Knowledge Base |
| Industrial & Infrastructure | Sites, Production, Work Orders, Equipment, Shipments, Fleet, Warehouses |
| Consumer & Commerce | Products, Orders, Inventory, Stores, Promotions, Campaigns, Content |
| Agriculture & Food | Fields, Livestock, Harvest, Production |
| Other | (uses generic Workspace items only) |

Each extra item is a route stub (`/workspace/<item>`) that currently renders an empty page with a "Coming soon" placeholder. The route exists so the IconRail item can be clicked without 404, but the full feature ships in later phases.

### 8.3 What changes in Customers per Industry Group

**The `Customers` icon and label change per Group**; the underlying route stays `/customers`:

| Industry Group | Icon | Label |
|---|---|---|
| Healthcare | `Stethoscope` | Patients |
| Public & Social | `Users` | Citizens & Beneficiaries |
| Financial & Compliance | `Landmark` | Clients & Accounts |
| Business & Technology | `UserCircle` | Clients |
| Industrial & Infrastructure | `Truck` | Customers & Suppliers |
| Consumer & Commerce | `Heart` | Customers & Members |
| Agriculture & Food | `Tractor` | Buyers & Suppliers |
| Other | `Users` | Organizations |

The Customer model itself doesn't change. Same `Customer` table; the label/icon and the default filter applied on the Customers list page change per Group.

### 8.4 Navigation config file

```ts
// frontend-tenant/src/lib/industryNavigation.ts

export interface IndustryNavConfig {
  groupSlug: string;
  workspaceExtras: RailItem[];
  customersLabel: string;
  customersIcon: string;
}

export const INDUSTRY_NAV_CONFIGS: Record<string, IndustryNavConfig> = {
  'healthcare': {
    groupSlug: 'healthcare',
    workspaceExtras: [
      { id: 'appointments', label: 'Appointments', href: '/workspace/appointments', icon: Calendar },
      { id: 'medical-records', label: 'Medical Records', href: '/workspace/medical-records', icon: FileText },
      { id: 'pharmacy', label: 'Pharmacy', href: '/workspace/pharmacy', icon: Pill },
      { id: 'laboratory', label: 'Laboratory', href: '/workspace/laboratory', icon: TestTube },
    ],
    customersLabel: 'Patients',
    customersIcon: 'Stethoscope',
  },
  'financial-compliance': { /* see §8.4 */ },
  // ... 6 more
};
```

The `IconRail` reads `tenant.industryGroup` from the user store, looks up the config, and appends `workspaceExtras` to the existing Workspace section. Customers section uses the per-group label/icon.

---

## 9. Phase 1: Financial & Compliance Group (First Vertical)

The user explicitly chose this Group as the first full implementation. Reasons:

1. **Accounting already has 15 packages with full composition** (per `pools-taxonomy.md` §6.5). It's the only Industry with non-empty packages.
2. **The `mali@live.com` tenant** is already in this Group — real production usage to validate against.
3. **Workload coverage** — Finance, Audit, Tax all have heavy compliance / approval workflows, which exercise the most platform capabilities.

### 9.1 Group shape

| Industry | Slug | Sub-industries |
|---|---|---|
| Financial Services | `financial-services` | Banking, Islamic Banking, Insurance, Takaful, Wealth Management, Investment Firms, FinTech, Payment Providers, Microfinance |
| Accounting & Audit Services | `accounting-audit-services` | Public Accounting Firms, Audit & Assurance, Tax Advisory, Bookkeeping, Forensic Audit, Payroll, Financial Advisory, CPA Practices, Chartered Accounting Firms |

### 9.2 Phase 1 scope

| Layer | What ships | What defers |
|---|---|---|
| **Onboarding** | 8-Group picker with Financial & Compliance accordion expanded by default when tenant picks either Industry | — |
| **Tenant model** | `industryGroup` column added; both `industry` and `industryGroup` persisted | — |
| **Navigation** | Financial & Compliance extras in Workspace (Loans, Compliance, Audits, etc.); Customers label → "Clients & Accounts" | Per-route page implementations beyond stub |
| **Packages** | 15 Accounting packages stay as-is; verify Financial Services packages exist or add 8-10 more | Fill composition for non-Accounting packages |
| **Project Types** | Audit Engagement, Tax Filing, Compliance Review, Bookkeeping, Payroll Cycle as anchor project types | Additional sub-type variants |
| **AI Agents** | General Ledger Accountant, AP/AR Specialist, Audit Coordinator, Tax Strategist, Compliance Auditor — all 706 already seeded | Per-tenant agent customisation |
| **Workflow Templates** | "Audit Lifecycle" workflow template (Plan → Fieldwork → Reporting → Follow-up) | Approval chains per sub-industry |
| **Dashboard** | KPI strip shows compliance score, audit pipeline, client count, outstanding invoices | Per-sub-industry customisation |
| **Customer fields** | Add `industry: 'banking' \| 'insurance' \| 'audit' \| 'tax' \| ...` discriminator on `Customer` | — |

### 9.3 New routes (Phase 1 stub pages)

All new routes in Phase 1 are **stubs** — they exist so nav links don't 404, but the page body is a placeholder. Real implementations come in Phase 2+.

| Route | Page component | Stub content |
|---|---|---|
| `/workspace/loans` | `app/workspace/loans/page.tsx` | "Loans module — coming soon" |
| `/workspace/portfolios` | `app/workspace/portfolios/page.tsx` | "Portfolios — coming soon" |
| `/workspace/compliance` | `app/workspace/compliance/page.tsx` | "Compliance — coming soon" |
| `/workspace/audits` | `app/workspace/audits/page.tsx` | "Audits — coming soon" |
| `/workspace/tax` | `app/workspace/tax/page.tsx` | "Tax — coming soon" |
| `/workspace/engagements` | `app/workspace/engagements/page.tsx` | "Engagements — coming soon" |
| `/workspace/risk` | `app/workspace/risk/page.tsx` | "Risk — coming soon" |
| `/workspace/payroll` | `app/workspace/payroll/page.tsx` | "Payroll — coming soon" |

All 8 stubs share a single component `<IndustryStubPage title="Loans module" description="..." />` to keep the code small.

### 9.4 Navigation config for Financial & Compliance

```ts
'financial-compliance': {
  groupSlug: 'financial-compliance',
  workspaceExtras: [
    { id: 'engagements',  label: 'Engagements',  href: '/workspace/engagements',  icon: Briefcase },
    { id: 'loans',        label: 'Loans',        href: '/workspace/loans',        icon: Landmark },
    { id: 'portfolios',   label: 'Portfolios',   href: '/workspace/portfolios',   icon: PieChart },
    { id: 'audits',       label: 'Audits',       href: '/workspace/audits',       icon: ClipboardCheck },
    { id: 'tax',          label: 'Tax',          href: '/workspace/tax',          icon: Receipt },
    { id: 'payroll',      label: 'Payroll',      href: '/workspace/payroll',      icon: Wallet },
    { id: 'compliance',   label: 'Compliance',   href: '/workspace/compliance',   icon: ShieldCheck },
    { id: 'risk',         label: 'Risk',         href: '/workspace/risk',         icon: AlertTriangle },
  ],
  customersLabel: 'Clients & Accounts',
  customersIcon: 'Landmark',
},
```

### 9.5 Customer model extension

Add a single optional discriminator field to `Customer`:

```prisma
model Customer {
  // ... existing fields
  financialSubType String?  // NEW — 'banking' | 'insurance' | 'audit' | 'tax' | 'advisory' | null
  taxId            String?  // NEW — Tax identification (encrypted)
  riskRating       String?  // NEW — 'low' | 'medium' | 'high'
  kycStatus        String?  // NEW — 'pending' | 'verified' | 'rejected'
  // ...
}
```

The new fields are nullable and only populated for tenants in the Financial & Compliance Group. Existing Customer rows are unaffected.

### 9.6 Project Type seeding

Add 5 anchor project types for Financial & Compliance:

| Project type slug | Classification | Industries |
|---|---|---|
| `audit-engagement` | `CLIENT_ENGAGEMENT` | `accounting-audit-services` |
| `tax-filing` | `CLIENT_ENGAGEMENT` | `accounting-audit-services` |
| `compliance-review` | `OPERATIONAL_PROGRAM` | `accounting-audit-services`, `financial-services` |
| `bookkeeping-cycle` | `OPERATIONAL_PROGRAM` | `accounting-audit-services` |
| `payroll-cycle` | `OPERATIONAL_PROGRAM` | `accounting-audit-services` |

These join the existing 150 project types. They filter by `industry` in the project-type selector (existing behaviour, per `fixes.md` FIX-039).

### 9.7 Approval chain wiring

Financial & Compliance workflows are approval-heavy. Wire the existing `approval-chains` module with 3 chain templates:

| Chain | Stages |
|---|---|
| Audit Sign-off | Manager → Partner → Quality Review → Client |
| Expense > $5k | Manager → Finance Director → CFO |
| Compliance Exception | Compliance Officer → Risk Manager → CCO |

These templates auto-load when a tenant in this Group creates a project with the relevant project type.

---

## 10. Tier × Industry Interaction Model

### 10.1 Orthogonal axes

Industry and Tier are **independent configuration axes** that affect different aspects of the tenant experience:

| Axis | Industry | Tier |
|---|---|---|
| Question | "What kind of business are you?" | "How much are you paying / how big are you?" |
| Stored on | `Tenant.industry`, `Tenant.industryGroup` | `Tenant.tierId` (FK to `Tier` table) |
| Values | 16 Industries in 8 Groups | 4 Tiers: Starter, Growth, Pro, Enterprise |
| What it controls | Which agents/departments/workflows appear + how nav looks | How many agents, how much storage, which features unlock |
| Mutable | Editable in settings anytime | Tied to billing; changeable on upgrade/downgrade |
| Who picks | User, at onboarding | System (billing) or admin override |

**Concrete example:** A solo CPA firm and a 200-person accounting firm both have `industry = accounting-audit-services` (Group = `financial-compliance`), but the solo firm is `tier = starter` (max 3 agents) while the large firm is `tier = enterprise` (unlimited). Same Industry shape; different scale.

### 10.2 What Industry does (5 things)

1. **Loads the right AI team + departments.** Industry anchors `Package` rows with curated composition. `accounting-audit-services` already ships 15 packages with full Department/Agent/Feature composition per `pools-taxonomy.md` §6.5.
2. **Drives navigation defaults.** Workspace extras + Customers label/icon change per Industry Group (§7).
3. **Filters project types.** Per `fixes.md` FIX-039, the project-type selector filters by `Tenant.industry`. Without a valid industry, the filter returns 0 types.
4. **Drives onboarding question selection.** The 20 Question Packs (`seed-question-packs.cjs`, 131 questions) filter by `appliesWhen.classification` keyed to Industry.
5. **Shapes Hermes context.** The assembled Context Plane (Phase 3 per `system-state.md`) includes Industry, so the same prompt produces different agent behaviour per business type.

### 10.3 What Industry does NOT do

- Does **not** change pricing, limits, or storage — that's Tier.
- Does **not** lock the tenant out of features — they can always toggle items via `RailCustomizeModal`.
- Does **not** migrate existing data — only affects future agent instantiation, project creation, and nav defaults.

### 10.4 How Tier constrains Industry expression

Tier doesn't restrict which Industry a tenant can pick, but it caps how much of the Industry's full package the tenant can activate:

| # | Interaction | Effect |
|---|---|---|
| 1 | Tier limits cap Industry agents | `starter` cap = 3 agents. Of 12+ agents seeded for accounting (Bookkeeper, Auditor, Tax Strategist, AP/AR, etc.), only the top 3 by `Package.priority` are active. |
| 2 | Tier gates Industry features | `ms365_integration`, `white_label`, `sso`, `audit_export` are tier-gated per `pools-taxonomy.md` §5. A `starter` accounting firm can't sync Outlook or enable SSO. |
| 3 | Tier gates Industry integrations | `crm_integration`, `erp_integration` are tier-gated. A `starter` accounting firm can't pull from QuickBooks/Xero — must upgrade. |
| 4 | Tier limits approval-chain depth | Approval chains are constrained by Tier: `starter` = 1 stage, `growth` = 2 stages, `pro` = 3 stages, `enterprise` = 4 stages. Affects Financial & Compliance workflows heavily. |
| 5 | Tier limits project-type availability | `enterprise-acct-ops` package is Enterprise-only per `pools-taxonomy.md` §6.5. `starter` accounting firm can't run multi-office operations. |
| 6 | Tier limits analytics depth | `advanced_analytics`, `custom_reports` features are tier-gated. Starter sees basic KPIs; pro+ sees predictive analytics. |
| 7 | Tier limits storage | `maxStorageGB` is Tier-specific (1 GB starter → 1 TB enterprise). Affects document-heavy industries (Healthcare records, Legal contracts). |
| 8 | Industry doesn't change Tier limits | Picking `manufacturing-industrial` doesn't give more storage than picking `financial-services` at the same Tier. |

### 10.5 Tier × Industry Matrix — Financial & Compliance

Concrete values for Phase 1 implementation. Tier names use the refactored [TIER-SYSTEM-CONCEPT.md](./TIER-SYSTEM-CONCEPT.md) (Basic / Business / Professional / Enterprise):

| Capability | Basic | Business | Professional | Enterprise |
|---|---|---|---|---|
| **Max agents** | 3 | 10 | 50 | Unlimited |
| **Max departments** | 1 | 3 | 10 | Unlimited |
| **Active by default** | Generic Bookkeeper only | + AP Specialist, Tax Junior, AR Specialist | + Audit Junior, Payroll, Tax Strategist, Audit Coordinator, Compliance Auditor | + Forensic Auditor, Risk Manager, Quality Reviewer |
| **Max storage** | 1 GB | 10 GB | 100 GB | 1 TB |
| **Approval stages** | 1 | 2 | 3 | 4 |
| **Available packages** | Trial bundle (read-only) | Business set (4) | + Professional set (8) | + Enterprise set (3) |
| **Integrations** | None | QuickBooks, Square, MS365, Google Workspace | + Xero, Sage, Salesforce, HubSpot, ERP | + Custom ERP via API, on-prem |
| **Features** | Core only | + Workflow Automation, Audit Logs, API Access | + SSO, 2FA, Custom Branding | + White Label, Multi-tenant, Audit Export |
| **Project types visible** | None (preview only) | Bookkeeping-cycle, Payroll-cycle | + Tax-filing, Compliance-review, Audit-engagement | + Forensic, Multi-office |
| **Analytics** | Basic KPIs | + Custom reports | + Predictive, custom dashboards | + Full BI, data warehouse export |
| **Customer model fields** | `financialSubType` only | + `kycStatus` | + `riskRating` | + `taxId` (encrypted) |

### 10.6 Default agent selection algorithm

When a tenant in `financial-compliance` lands at `basic` Tier:

1. Query `Package` rows where `industryId` matches AND `tierId` matches.
2. Sort by `Package.priority` (descending).
3. Take top N where N = `Tier.maxAgents`.
4. Instantiate those agents on the tenant.
5. Hide remaining packages from the Marketplace until Tier upgrade.

Example output for `business` × `accounting-audit-services`:
- Agent 1: Bookkeeper & Controller (priority: highest)
- Agent 2: Accounts Payable Specialist
- Agent 3: Tax Compliance Specialist (junior)

The 9 remaining accounting agents remain in the pool but are not instantiated. User can see them in Marketplace but they're marked "Upgrade to Professional to activate".

### 10.7 User-facing copy

The onboarding flow should explain both axes in plain language:

> **Industry picker:** *"Your industry selection shapes NeureCore to fit your business. We'll load the right AI team (accountants for a firm, doctors for a clinic), organize your navigation around your workflows, and ask the right questions when you start projects. You can change this any time — your data stays the same."*

> **Tier display (in settings):** *"Your tier sets how big NeureCore can grow: how many AI employees you can hire, how much data you can store, and which advanced features you unlock. Upgrade any time."*

### 10.8 Phase 1 deliverable addition

Before Phase 1 ships, the following must be added to the implementation:

1. **Tier × Industry matrix JSON** at `backend/src/modules/industries/tier-industry-matrix.json` — codifies §9.5.
2. **`GET /api/v1/industries/:slug/capabilities?tier=<slug>`** endpoint — returns the matrix row for a given Industry + Tier combination. Used by the onboarding "Plan impact" panel.
3. **Onboarding "Plan impact" panel** — shows: "At Professional tier with Financial & Compliance, you'll get: 50 agents, 10 departments, Xero/QuickBooks sync, 3-stage approvals." Helps users understand the combined effect before committing.
4. **Default-agent selection logic** in `OnboardingService.createTenant()` — implements §9.6 algorithm.
5. **Tier-upgrade path** — when Tier changes (admin or self-service), the missing agents from the Industry pool auto-activate, new features enable, and approval-chain depth increases. Existing data is unaffected.

---

## 11. Implementation Sequence (Phase 1, Financial & Compliance)

| Step | Task | Touches | Estimate |
|---|---|---|---|
| 1 | Schema migration: add `industryGroup`, `groupSortOrder` to `Industry`; add `industryGroup` to `Tenant` | DB | 0.5 day |
| 2 | Data migration script: populate `industryGroup` + `groupSortOrder` for the 16 existing rows | DB | 0.5 day |
| 3 | Backfill script: populate `Tenant.industryGroup` from existing `Tenant.industry` | DB | 0.5 day |
| 4 | Update `seed-industries-majors.cjs` + `add-industry-accounting.cjs` to write new fields | Seeder | 0.5 day |
| 5 | Update both `frontend-tenant/src/lib/industries.ts` and `frontend-admin/src/lib/industries.ts`; add `industryGroups.ts` | FE | 0.5 day |
| 6 | Build `<IndustryGroupPicker>` component; replace `<select>` in `CompanyStep.tsx` | FE | 1.5 days |
| 7 | Backend: accept `industryGroup` in `OnboardingStateDto` | BE | 0.5 day |
| 8 | Add `industryNavigation.ts` config file with all 8 Group entries (stubs for non-Phase-1 Groups) | FE | 1 day |
| 9 | Modify `IconRail.tsx` to read `industryGroup` from user store and inject extras | FE | 1 day |
| 10 | Create 8 stub pages for Financial & Compliance routes | FE | 0.5 day |
| 11 | Customer model migration: add 4 financial fields | DB + BE | 1 day |
| 12 | Customer list page: filter by `financialSubType` when Group = Financial & Compliance | FE | 1 day |
| 13 | Seed 5 Financial & Compliance project types | DB | 0.5 day |
| 14 | Seed 3 approval chain templates | DB | 0.5 day |
| 15 | End-to-end test: new tenant picks Financial & Compliance → sees correct nav → creates audit project → routes work | QA | 1 day |
| **Total** | | | **~11 days** |

### Rollout

1. Deploy to Contabo behind a feature flag `INDUSTRY_GROUPS_V2`
2. Run data migration in parallel (idempotent)
3. Smoke test with `mali@live.com` (already in this Group)
4. Enable flag for 1 tenant → verify → enable for all → remove flag in next sprint

---

## 12. Success Criteria

Phase 1 ships when:

- [ ] All 8 Industry Groups selectable in onboarding picker
- [ ] Clicking a Group expands its Industries; clicking an Industry selects it
- [ ] Tenant record stores both `industryGroup` and `industry`
- [ ] Financial & Compliance tenants see 8 extra Workspace items + "Clients & Accounts" Customers label
- [ ] All 8 stub routes return 200 (no 404s)
- [ ] Existing 15 Accounting packages still resolvable for `accounting-audit-services` Industry
- [ ] 5 new project types filter correctly by industry
- [ ] `mali@live.com` tenant shows correct nav after migration (regression test)
- [ ] Tenant with no `industryGroup` (legacy) sees generic Workspace items only
- [ ] Onboarding still completable in <60 seconds with the new picker

---

## 13. What defers to Phase 2+

| Item | Phase |
|---|---|
| Real implementations of the 8 stub pages (Loans, Audits, Tax, etc.) | Phase 2 (next quarter) |
| Healthcare Group (Patient model, Appointment scheduling, Medical Records) | Phase 3 |
| Public & Social Group (Program/Grant/Beneficiary model) | Phase 4 |
| Business & Technology extras (Tickets, Releases, Contracts) | Phase 5 |
| Industrial & Infrastructure extras (Sites, Work Orders, Fleet) | Phase 6 |
| Consumer & Commerce extras (Products, Orders, Promotions) | Phase 7 |
| Agriculture & Food extras (Fields, Livestock, Harvest) | Phase 8 |
| Per-sub-industry AI agent specialisation | Continuous |
| Industry-aware pricing or billing | Not planned |

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing tenant has invalid `industry` value (e.g. `'ACCOUNTING'` from the mali@live.com incident) | Migration script logs unknown values; admin UI surfaces a "Industry needs remapping" banner |
| Customers change Industry after tenant already has data | Industry field stays editable in Tenant settings; nav updates on next render |
| Two Industries in same Group have very different workflow needs (e.g. Banking vs Insurance) | Sub-industries show as descriptive text under the Industry; users can ignore them; per-sub-industry nav customisation deferred to Phase 2 |
| 8 Groups feels too few once users push for specificity | Per-Industry nav customisation already enabled via existing `railPreferencesStore` |
| Other 7 Groups deliver no value beyond stubs | Each stub route signals "this is where your data will live" — sets expectations without committing engineering |
| Default-agent selection silently picks wrong agents for Tenant's actual sub-industry | Algorithm in §9.6 picks by `Package.priority` (global ranking), not sub-industry fit. A starter tenant in Insurance gets the same 3 agents as a starter tenant in Banking — but Insurance needs Underwriting Junior, not AP Specialist | Mitigation: add sub-industry-aware priority overrides in `tier-industry-matrix.json` per §9.5. Phase 1 ships with the global priority; Phase 1.1 adds the override map. |
| Tier upgrade doesn't auto-activate dormant agents | User upgrades from Starter to Growth, but the 5 newly-available agents don't appear in their workspace | Mitigation: wire `TierUpgradeService` (already exists per `tiers` module) to emit `TenantTierChanged` event; `AgentInstantiationService` subscribes and activates matching dormant agents. |
| Tier downgrade silently breaks workflows | User downgrades from Pro to Starter; agents they relied on get archived, in-flight approvals with 4 stages collapse to 1 stage | Mitigation: warn user before downgrade; offer 30-day grace period; archive (don't delete) so data is preserved. |

---

## 15. Open Questions

1. Should the "Other" Group be visible at all, or hidden behind an "I don't see my industry" link? — **Recommendation:** visible but with lowest sortOrder.
2. Should `Tenant.industryGroup` be editable separately from `Tenant.industry`? — **Recommendation:** no, always derived from `Tenant.industry` to prevent drift.
3. Should we expose Group in the API responses (e.g. `GET /tenants/me/current`)? — **Recommendation:** yes, easier for clients to branch UI without joining tables.
4. What happens when the tenant picks an Industry, then their business pivots? — **Recommendation:** Industry is NOT editable by the tenant. Only a Super Admin can change it from `frontend-admin`. Tenant can re-run onboarding to change Tier / Departments / Agents, but the Industry step is skipped on re-run. See [INDUSTRY-SETUP-CONCEPT.md §1.2 D7](./INDUSTRY-SETUP-CONCEPT.md#12-key-design-decisions).

---

## 16. Related Files

| Concern | Path |
|---|---|
| Industry seeder (canonical 15) | `neurecore/backend/prisma/seed-industries-majors.cjs` |
| Industry additive add (Major #16) | `neurecore/backend/prisma/add-industry-accounting.cjs` |
| Existing Industry list (FE) | `neurecore/frontend-tenant/src/lib/industries.ts` |
| Existing Industry list (admin) | `neurecore/frontend-admin/src/lib/industries.ts` |
| Onboarding company step | `neurecore/frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx` |
| IconRail canonical reference | `neurecore/memory-bank-new/left-rail-icon.md` |
| Rail preferences store | `neurecore/frontend-tenant/src/stores/railPreferencesStore.ts` |
| Accounting packages seeder | `neurecore/backend/prisma/seed-accounting-packages.cjs` |
| Pools taxonomy (canonical 16) | `neurecore/memory-bank-new/pools-taxonomy.md` |
| Industry model in schema | `neurecore/backend/prisma/schema.prisma:3867` |
| Tenant industry field | `neurecore/backend/prisma/schema.prisma:414` |

---

## 17. Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-21 | Initial draft for review | Kilo |
| 2026-07-21 | Added §9 Tier × Industry Interaction Model — clarifies Industry vs Tier distinction, codifies the Tier × Industry matrix for Financial & Compliance, defines default-agent selection algorithm, adds "Plan impact" onboarding panel requirement | Kilo |
| 2026-07-21 | Aligned Tier names with [TIER-SYSTEM-CONCEPT.md](./TIER-SYSTEM-CONCEPT.md) refactor: Basic / Business / Professional / Enterprise | Kilo |
