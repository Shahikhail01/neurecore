# Pools Taxonomy (Industry / Tier / Feature / Department / Agent / Package)

> Source of truth for what each of the six business-composition pools contains
> on production, how it was seeded, and how it can be re-seeded safely.
>
> Created 2026-07-05 after the canonical Industry-major decision.
> Supersedes ad-hoc industry coverage in `backend.md`, `system-state.md`,
> `future-plans.md`.

The six pools (Phase 10, "business composition model") are:

```
Pool #1  Agents      (AgentTemplate)            /agents-pool
Pool #2  Departments (DepartmentTemplate)       /departments-pool
Pool #3  Industries  (Industry)                 /industries   ← canonical 16 majors
Pool #4  Tiers       (TierTemplate)             /tier-templates
Pool #5  Features    (Feature)                  /features
Pool #6  Packages    (Package, composite root)  /packages
```

Packages are a **reference graph**: they compose an `Industry × Tier × M2M(Departments, Agents, Features)` triple. They never instantiate runtime rows (deferred `POST /:id/instantiate` — see `future-plans.md` §3.X).

---

## 1. AI Agents Pool

- **Model**: `AgentTemplate` (seeded in `seed-platform-templates.cjs`).
- **Scope on production**: ~700+ ready-to-use AI Employee templates spanning Executive, Operations, Finance, Sales, Marketing, Customer Support, HR, Legal, Tech, Product, Procurement, Data, Investment, Compliance, Executive Support, R&D, Facilities, Platform, Self-Improvement, etc.
- **Admin page**: `/agents-pool` with enable/disable toggle, version field, Hermes-aligned visibility filters.
- **Lifecycle**: Admin edits only the template; Hermes layer owns abilities, prompts, memory, tools, workflows, reasoning.
- **Pool module**: `backend/src/modules/agents-pool/`. Service: `agents-pool.service.ts`.

---

## 2. Departments Pool

- **Model**: `DepartmentTemplate`.
- **Scope on production**: 66 master library departments seeded by `seed-platform-templates.cjs` (categories: `executive`, `operations`, `finance`, `sales`, `marketing`, `customer-support`, `hr`, `legal`, `tech`, `product`, `procurement`, `data`, `investment`, `compliance`, `executive-support`, `r-d`, `facilities`, `platform`, `self-improvement`, `legacy-tier`, `startup`, `scaleup`, `ecommerce`, `saas`, `enterprise`).
- **Admin page**: `/departments-pool`.
- **Pool module**: `backend/src/modules/departments-pool/`. `legacy-tier` rows are excluded from default listings.

---

## 3. Industries Pool — **Canonical 16 Majors** ✓

### Decision date

2026-07-05. Replaced the 30-row compact industry seed (an interim build) with the canonical 16-Major taxonomy aligned to the broader market — Healthcare, Government, NGO, Banking, Education, Manufacturing, Energy, Construction, Retail, Logistics, Tech, Professional Services, Accounting & Audit, Agriculture, Media, Special Purpose.

### Final list (production, sortOrder groups)

| sortOrder | slug | Major Industry | Sub-industries embedded in `description` |
|---|---|---|---|
| 10 | `healthcare-life-sciences` | Healthcare & Life Sciences | Hospitals, Clinics, Diagnostic Labs, Mental Health, Public Health, Pharmaceuticals, Biotechnology, Medical Devices, Telemedicine, Home Healthcare |
| 20 | `government-public-sector` | Government & Public Sector | National Government, Local Government, Municipalities, Defence, Police, Judiciary, Public Health Authorities, Regulatory Authorities |
| 30 | `nonprofit-international` | Non-Profit & International Organizations | NGOs, INGOs, UN Agencies, Foundations, Charities, Humanitarian Orgs, Faith-Based Orgs |
| 35 | `accounting-audit-services` | Accounting & Audit Services | Public Accounting Firms, Audit & Assurance, Tax Advisory, Bookkeeping Services, Forensic Audit, Payroll Services, Financial Advisory, CPA Practices, Chartered Accounting Firms |
| 40 | `financial-services` | Financial Services | Banking, Islamic Banking, Insurance, Takaful, Wealth Management, Investment Firms, FinTech, Payment Providers, Microfinance |
| 50 | `education-research` | Education & Research | Schools, Colleges, Universities, Research Institutes, Online Education, Vocational Training |
| 60 | `manufacturing-industrial` | Manufacturing & Industrial | General Mfg, Automotive, Electronics, Food Processing, Chemicals, Textiles, Heavy Industry |
| 70 | `energy-utilities-natural-resources` | Energy, Utilities & Natural Resources | Oil & Gas, Renewable Energy, Electricity, Water Utilities, Mining, Environmental Services |
| 80 | `construction-engineering-infrastructure` | Construction, Engineering & Infrastructure | Construction Companies, Engineering Firms, Architecture, Real Estate Dev, Property Mgmt, Facilities Mgmt |
| 90 | `retail-commerce-consumer` | Retail, Commerce & Consumer Business | Retail Chains, eCommerce, Wholesale, Fashion, Supermarkets, Restaurants, F&B, Hospitality, Travel & Tourism |
| 100 | `logistics-transportation-supply-chain` | Logistics, Transportation & Supply Chain | Logistics, Freight, Warehousing, Shipping, Aviation, Rail, Courier Services |
| 110 | `technology-digital-services` | Technology & Digital Services | SaaS, Software Companies, AI Companies, IT Services, Telecommunications, Cloud Providers, Cybersecurity |
| 120 | `professional-business-services` | Professional & Business Services | Consulting, Accounting, Audit, Legal, Marketing Agencies, HR Firms, BPO, Recruitment |
| 130 | `agriculture-food-systems` | Agriculture & Food Systems | Agriculture, Livestock, Dairy, Fisheries, Forestry, Food Production, Agritech |
| 140 | `media-communications-creative` | Media, Communications & Creative Industries | Media Houses, Publishing, Broadcasting, Advertising, Film Production, Design Studios, Gaming |
| 150 | `special-purpose-organizations` | Special Purpose Organizations | Family Offices, Holding Companies, Investment Groups, Conglomerates, Religious Orgs, Cooperatives |

### Schema usage

- Sub-industries are stored as human-readable bullets in the `description` Text field (no schema change required; `@db.Text` has no length limit).
- `slug` is `^[a-z0-9-]+$`, lowercase, kebab-case, two-or-more chars.
- Sort order is set in 10-step buckets so future cross-cutting additions slot in cleanly.

### Seeders

| File | Status | Notes |
|---|---|---|
| `prisma/seed-business-composition.cjs` | **legacy** | First run shipped 8 industries (Phase 10). Safe to keep; idempotent. |
| `prisma/seed-industries-compact.cjs` | **superseded** | Expanded to 30 narrow rows on 2026-07-04; immediately replaced 2026-07-05. Idempotent. Supports `--check`. |
| `prisma/seed-industries-majors.cjs` | **canonical** | Current source of truth. Transactional `deleteMany` + `createMany`. Supports `--check` for diff-only preview. |
| `prisma/add-industry-accounting.cjs` | **additive** | Adds Major #16 (`accounting-audit-services`). Idempotent, no `deleteMany`. Run when extending the pool. |
| `prisma/seed-accounting-packages.cjs` | **additive composition** | Seeds **15 packages** anchored to `accounting-audit-services` with full Departments + AI Agents + Features composition. First major with non-empty packages; serves as the composition-fill template for future verticals. |

Run from `backend/`:
```bash
node prisma/seed-industries-majors.cjs --check   # diff only
node prisma/seed-industries-majors.cjs           # apply
```

Safety guarantees baked in:
- Pre-flight check: refuses to delete-replace if any `Package.industryId` row exists (Restrict FK would error at DB level too, but the script exits cleanly with code 2).
- Single transaction: either all 16 majors land, or nothing changes.
- Dry-run prints the full diff (added / kept / updated / dropped) so it's obvious what will change before committing.

### Migration history on production

| Date | Action | DB count after |
|---|---|---|
| 2026-07-04 18:53 | `seed-business-composition.cjs` (Phase 10 original) | 8 |
| 2026-07-04 ~19:30 | `seed-industries-compact.cjs` (interim 30-row) | 30 |
| 2026-07-05 01:03 | `seed-industries-majors.cjs` (canonical 15-major) | **15** |
| 2026-07-05 01:29 | `add-industry-accounting.cjs` (Major #16: Accounting & Audit Services) | **16** |
| 2026-07-05 01:50 | `seed-accounting-packages.cjs` (15 packages with composition for Accounting) | **16 majors · 15 packages anchored + 53 empty elsewhere** |

Every Package row was verified at 0 before the 2026-07-05 migration. Industry IDs changed across these runs, but with zero packages referencing any of them, no data was lost.

---

## 4. Tiers Pool

- **Model**: `Tier` (single canonical table per TIER-SYSTEM-CONCEPT.md §6.1 — `TierTemplate` was dropped in the 2026-07-21 tier-system refactor).
- **Scope**: 4 canonical tiers — `basic`, `business`, `professional`, `enterprise` — seeded by `seed-business-composition.cjs` (renamed from `starter/professional/enterprise/government` via the `20260721_tier_system_refactor` migration + `backfill-tier-system.cjs`). Tenants reference the tier via `Tenant.tierId`; packages reference via `Package.tierId`.
- **Admin page**: `/tiers`.

(Stable post-refactor; original `tier-templates` routes return 404. See `TIER-DEPLOYMENT-RUNBOOK.md` for the migration history.)

---

## 5. Features Pool

- **Model**: `Feature` (enum `FeatureCategory`: `INTEGRATION`, `API`, `COMMUNICATION`, `BRANDING`, `ANALYTICS`, `AUTOMATION`, `SECURITY`, `PLATFORM`).
- **Scope**: 19 features on production — `ms365_integration`, `google_workspace`, `whatsapp`, `erp_integration`, `crm_integration`, `api_access`, `webhooks`, `voice_calling`, `sms`, `white_label`, `custom_branding`, `advanced_analytics`, `custom_reports`, `workflow_automation`, `routines`, `sso`, `audit_logs`, `two_factor`, `multi_tenant`.
- **Seeder**: `prisma/seed-business-composition.cjs` (FEATURES array).
- **Admin page**: `/features`.

---

## 6. Packages Pool

- **Model**: `Package` (composite root; `status: PackageStatus { DRAFT | PUBLISHED | ARCHIVED }`; `scope: PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`; `version: Int @default(1)`; unique `[industryId, tierTemplateId, slug]`).
- **Endpoints**:
  - `GET /api/v1/packages`
  - `GET /api/v1/packages/:id`
  - `POST /api/v1/packages`
  - `PATCH /api/v1/packages/:id`
  - `PATCH /api/v1/packages/:id/composition` (atomic M2M replace of departments/agents/features)
  - `POST /api/v1/packages/preview` (dry-run validation)
  - `DELETE /api/v1/packages/:id`
- **Count on production**: **68** as of 2026-07-05 (empty composition, see Master Package Pool below).
- **Admin page**: `/packages`. 4-step composer at `/packages/new`.

### 6.1 Master Package Pool

Introduced 2026-07-05 — replaces the previous "one (industry, tier, package) combo per cell" approach with a **reusable pool**.

- **Schema additions** (migration `20260705_package_catalogue`):
  - `Package.scope` (`PackageScope` enum) — `FUNCTIONAL | VERTICAL | HYBRID`. Distinguishes cross-industry packages from vertical-specific ones.
  - `Package.version` (`Int`, default 1) — enables future tenant-pinned versions when a borrowed package evolves.
- **Pool shape**: **68 unique `Package` rows** anchored to a primary `(industry, tier)` cell. Functional packages are designed to be borrowed across industries; vertical packages stay anchored to one family of industries.
- **Composition**: all 68 rows are intentionally **empty** at seed time (no departments, agents, or features attached). Filling is the next planned pass.

| Bucket | Count | Notes |
|---|---|---|
| Total packages | **68** | All DRAFT, version=1 |
| By tier — Starter | 6 | doc ↔ `starter` exact |
| By tier — Professional | 43 | includes 22 pool "Business" (mapped to our `professional` since we have no `business` tier yet — mapping is reversible) |
| By tier — Enterprise | 19 | |
| By tier — Government | 0 | no primary anchors in the package-pool doc body |
| By scope — FUNCTIONAL | 47 | cross-industry reusable |
| By scope — VERTICAL | 21 | industry-specific |
| By scope — HYBRID | 0 | reserved for future use |

### 6.2 Industry-tier availability (planned, not yet shipped)

The pool model anticipates a future `PackageAvailability(packageId, industryId, tierTemplateId, sortOrder, isPrimary)` table so any (industry, tier) cell can borrow packages from any other. Until that ships, packages are visible only at their primary anchor.

### 6.3 Tier naming note

The package pool spec defines five tiers (Starter / Professional / Business / Enterprise / Government). Our production `TierTemplate` pool has four (Starter / Professional / Enterprise / Government). Two options for alignment:
- **(a)** Rename `professional` → `business` (single rename; matches spec).
- **(b)** Add `business` between `professional` and `enterprise`.

Until a decision is made, the seeder maps pool "Business" → our `professional` and tags those rows with `description` annotated as `*(pool tier: Business)*`. The mapping is reversible once the tier shape is finalised.

### 6.4 Seeders

| File | Status | Notes |
|---|---|---|
| `prisma/seed-package-catalogue.cjs` | **canonical** | Idempotent. Supports `--check`. Inserts only-empty packages (no composition). Maps pool "Business" → our `professional`. |

Run from `backend/`:
```bash
node prisma/seed-package-catalogue.cjs --check   # diff only
node prisma/seed-package-catalogue.cjs           # apply
```

---

## 6.5 Accounting & Audit Services — first vertical with full composition

The first major with a populated vertical package set. **15 packages** anchored to `accounting-audit-services`. All composition (Departments + AI Agents + Features) is filled.

### Tier breakdown

| Tier (pool) | # | Packages |
|---|---|---|
| Starter | 4 | Firm Business Management · Firm Office Administration · Firm Financial Management · Firm Compliance Management |
| Professional | 4 (pool "Pro") + 4 (pool "Business") | Accounting Operations · Audit Practice Management · Tax Advisory Services · Payroll Services · Accounting Firm Management · Multi-Office Operations · Firm Workforce Management · Firm Customer Experience |
| Enterprise | 3 | Enterprise Accounting Operations · Enterprise Firm Operations · Firm Executive Analytics |

> The "Business"-row packages are anchored to tierTemplate `professional` because the pool has no `business` tier. Their `description` field carries `*(pool tier: Business)*` marker — see [`pending-tasks.md` D9](pending-tasks.md) for the tier-rename decision.

### Composition patterns observed

- **Accounting Operations** (vertical, pro tier) pulls in 1 dept (`Accounting`) + 7 agents (incl. `General Ledger Accountant`, `Accounts Payable/Receivable Specialist`, `Fixed Assets Accountant`, `Intercompany Accounting Specialist`) + 7 features (MS365, Google Workspace, ERP, Audit Logs, SSO, Two-Factor, Workflow Automation).
- **Audit Practice Management** composes `Risk Compliance` + 6 audit-role agents (incl. `Audit Coordinator`, `Internal Auditor`, `Quality Auditor`, `Compliance QA Specialist`).
- **Tax Advisory Services** brings in `Legal` + tax-specialised agents (`Tax Compliance Specialist`, `Tax Strategist`, `Legal Compliance Checker`).
- **Firm Business / Office / Compliance / Financial Management** are cross-tier-functional packages (3 depts / 3–4 agents / 3–4 features) — these can be **borrowed** by any other Major once `PackageAvailability` ships (D8).

### Cross-tier reuse pattern

The same agent (`Bookkeeper & Controller`, `Finance Tracker`, `Compliance Auditor`, etc.) shows up across Starter, Professional, Business, and Enterprise tiers. This is intentional — composition-by-tier is a curated subset, not exclusive. Future tiers could add/remove specific agents via the existing `PATCH /:id/composition` endpoint.

See [`pools-taxonomy.md` §6.1](pools-taxonomy.md) for the package-pool model and the borrowing story.

---

## Composition rules of thumb

A Package row on production today:

```
{ slug, name, description, status, sortOrder, industryId, tierTemplateId,
  departments[], aiAgents[], features[], suggestedAgentCount?, suggestedDepartmentCount? }
```

- Identity + anchors (industry, tier) — `POST /packages`.
- Composition (M2M triple) — `PATCH /packages/:id/composition` (single transactional call).
- Optional counts stored as metadata for the admin UI matrix.

A reasonable package theme for any (Industry × Tier) pairs:

```
Healthcare & Life Sciences × Enterprise tier →
  • Hospital Operations Package       (Depts: ER, Surgery; Agents: Triage, Bed Allocator; Features: M365, SSO)
  • Clinic Management Package         (Depts: Reception, Records; Agents: Scheduler; Features: M365)
  • Emergency Response Package        (Depts: ER, ICU; Agents: Triage; Features: Voice, SMS)
  • Executive Management Package      (Depts: Executive, Finance; Agents: CEO, CFO Agents; Features: M365, Analytics)
```

More themes across all majors are the subject of the pending composition seeder.

---

## Related files

| Concern | File |
|---|---|
| Industry seeder (canonical) | `neurecore/backend/prisma/seed-industries-majors.cjs` |
| Industry additive add (Major #16) | `neurecore/backend/prisma/add-industry-accounting.cjs` |
| Accounting packages seeder (vertical #1 with composition) | `neurecore/backend/prisma/seed-accounting-packages.cjs` |
| Industry seeder (legacy compact) | `neurecore/backend/prisma/seed-industries-compact.cjs` |
| Industry seeder (Phase 10 original) | `neurecore/backend/prisma/seed-business-composition.cjs` |
| **Package pool seeder** | `neurecore/backend/prisma/seed-package-catalogue.cjs` |
| Package migration (`scope` + `version`) | `neurecore/backend/prisma/migrations/20260705_package_catalogue/migration.sql` |
| Industry module (controller/service/DTO) | `neurecore/backend/src/modules/industry/` |
| Package module | `neurecore/backend/src/modules/packages/` |
| Tier module | `neurecore/backend/src/modules/tier-templates/` |
| Feature module | `neurecore/backend/src/modules/features/` |
| Departments pool | `neurecore/backend/src/modules/departments-pool/` |
| Agents pool | `neurecore/backend/src/modules/agents-pool/` |
| Plan that produced this taxonomy | `neurecore/memory-bank-new/plans/admin-business-composition.md` |

---

_Last updated: 2026-07-25 11:20 PKT — Industry pool = 16 majors, **15 Accounting packages with composition shipped**._

> **2026-07-25 update:** Industry Verification Run-3 closed every defect filed in Run-1 + Run-2. The Accounting & Audit Services tenant (`sara.ahmed+verify-2026-07-24r4post@demo.neurecore.com`) is now production-ready end-to-end. See [audits/2026-07-25-industry-verification-3-remediation/REPORT.md](audits/2026-07-25-industry-verification-3-remediation/REPORT.md) for the full evidence matrix and the live Brevo SMTP delivery proof (`messageId: <202607250454.93699028513@smtp-relay.mailin.fr>`).
