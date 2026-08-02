# Industry Pruning Proposal — From 16 to 8

**Status:** Proposal (open for review)
**Author:** Kilo
**Date:** 2026-07-31
**Supersedes (in part):** `INDUSTRY-GROUPS-CONCEPT.md §3` (16 Industries) — the *taxonomy* stays as data; this proposal **cuts which Industries we ship & sell to**.
**Source docs:** `memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md`, `INDUSTRY-REQUIREMENTS-STAGED.md`, `IMPLEMENTATION-STAGE1/2/3`, `TIER-DEPLOYMENT-RUNBOOK.md`, `pools-taxonomy.md`, `memory-bank/00-index.md`, `memory-bank-arc/future-plans.md`, `memory-bank-arc/pending-tasks.md`.

---

## 1. Background

The platform's product surface today ships to **one Industry** in production:

| Industry | Tenant(s) live | Status |
|---|---|---|
| `accounting-audit-services` | `mali@live.com` (Mali Accounting) | ✅ Production-ready (SIM-04 certified 2026-07-25; NC-ACCT-IMP-1 complete 2026-07-30) |
| `financial-services` | (none — seed-only, 8 packages defined) | 🟡 Schema + seed ready, no live tenant |
| 14 others | (none — schema + nav + customer-field definitions exist) | ⚪ Stub: Industry row + customer-field defs + nav config + project-types JSON; no tenant template (DepartmentTemplate), no packages, no agents, no projects live |

The conceptual 8 Groups / 16 Industries taxonomy in `INDUSTRY-GROUPS-CONCEPT.md §3` defines the **full data model** the DB holds. It does **not** mean we promise to *support* each as a go-to-market vertical. Supporting every Industry requires:

1. Industry-specific customer field schema (✅ exists for all 16 — see §3.2 below).
2. Industry-specific packages with departments + agents (⚠️ only `accounting-audit-services` has 15 + `financial-services` has 8; the other 14 have **zero**).
3. Industry-specific workspace extras (✅ nav config exists for all 8 Groups; pages are stubs).
4. Industry-specific compliance / approval / widget add-ons (⚠️ only `financial-compliance` group has dedicated add-ons: `financial-approval.addon.ts`, `fc-widgets.ts`).
5. Customer validation: HIPAA / FERPA / SOX / KYC-AML / fiduciary duty are **not optional** in some verticals.

This proposal selects the subset of the 16 Industries we will **actively sell to**, **onboard**, and **certify**, phased by quarter. The DB still has 16 rows; we just stop promising capability for 8 of them.

---

## 2. Selection Criteria

The user-stated criteria, restated precisely so the cut list is defensible:

1. **Low legal risk for the platform.** We must not become a *de facto* covered entity or business associate under HIPAA, a fiduciary under ERISA, a broker-dealer under SEC, a carrier under state insurance law, an education record holder under FERPA, or a contractor under government procurement law. Legal exposure we are not staffed to handle gets cut.
2. **No industry-specialized primitives.** Every feature we ship must be reusable by **≥ 2 of the 8 picked Industries**. If a primitive (e.g. patient, prescription, lien, KYC, federal grant, bonded contract) is only used by one Industry in our pick list, it doesn't ship — that Industry gets cut instead.
3. **Generic 80/20 nav.** Workspace extras must collapse to the same 5–7 shared modules (Projects, Tasks, Customers, Documents, Approvals, Reports, Communications). Industry-specific extras are restricted to **labels + descriptions**, not new entities.

---

## 3. Present Production Capability (audit, 2026-07-31)

This is the evidence base — what's actually wired in code today, not what's planned.

### 3.1 Industry & Group taxonomy (DB rows)

- Source: `prisma/seed-industries-majors.cjs` (canonical 15) + `add-industry-accounting.cjs` (Major #16).
- Migrations applied: `20260721_industry_groups` populates `Industry.industryGroup` + `Industry.groupSortOrder`.
- All 16 Industries are live in production DB. `Industry` table is the source of truth; nothing in this proposal requires deleting rows.

### 3.2 Per-Industry customer field definitions (✅ all 16 wired)

`backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts:46` exports a `Record<industrySlug, CustomerFieldDef[]>` covering **every one of the 16 Industries**. The first-class columns on `Customer` (`financialSubType`, `lifecycleStage`, `kycStatus`, `riskRating`, `taxId`, `kycExpiresAt`) are nullable and only surface in the form when the tenant's `industryGroup === 'financial-compliance'` (FE guard `IndustryStubPage.tsx:116`, SIM-04 commit `c9f099c3`).

### 3.3 Per-Group nav config (✅ all 8 Groups wired)

`frontend-tenant/src/lib/industryNavigation.ts:62` defines `INDUSTRY_NAV_CONFIGS` for all 8 Groups. `IconRail.tsx:191` reads it at runtime; `workspace/[feature]/page.tsx:34` resolves per-tenant. The `financial-compliance` group is the only one where the workspace extras are *substantively* wired (loans, audits, tax, payroll, compliance, risk have backend modules); the other 7 Groups route to stub pages.

### 3.4 Per-Industry packages, agents, templates

| Industry | Packages | Tenant template (Department + agent pool) | Project types |
|---|---|---|---|
| `accounting-audit-services` | **15** (`seed-accounting-packages.cjs`) | ✅ Accounting (12 depts / 14 agents) | ✅ 1 (Audit Engagement) |
| `financial-services` | **8** (`seed-financial-services-packages.cjs`) | ⚠️ None seeded | ✅ 1 (Client Onboarding) |
| `technology-digital-services` | 8 stub-defs in `seeds/industry-templates/business-technology-packages.ts` | ✅ seeded (Run-6 / TIER-DEPLOYMENT-RUNBOOK.md) | ✅ 1 |
| `professional-business-services` | 5 stub-defs (same file) | ⚠️ none seeded | ✅ 1 |
| `retail-commerce-consumer` | 5 stub-defs in `seeds/industry-templates/industry-packages.ts` | ⚠️ none seeded | ✅ 1 |
| `media-communications-creative` | 2 stub-defs (same file) | ⚠️ none seeded | ✅ 1 |
| `manufacturing-industrial` | 0 | ✅ `seed-industrial-infra-templates.cjs` | ✅ 1 |
| `construction-engineering-infrastructure` | 0 | ⚠️ none seeded | ✅ 1 |
| `energy-utilities-natural-resources` | 0 | ⚠️ none seeded | ✅ 1 |
| `logistics-transportation-supply-chain` | 0 | ⚠️ none seeded | ✅ 1 |
| `healthcare-life-sciences` | 0 | ✅ `seed-healthcare-department-template.cjs` (D21/D22 fix) | ✅ 1 |
| `government-public-sector` | 0 | ⚠️ none seeded | ✅ 1 |
| `education-research` | 0 | ⚠️ none seeded | ✅ 1 |
| `nonprofit-international` | 0 | ⚠️ none seeded | ✅ 1 |
| `agriculture-food-systems` | 0 | ❌ no template file exists | ✅ 1 |
| `special-purpose-organizations` | 0 | ❌ no template file exists | ✅ 1 |

> "Stub-defs" = TypeScript constants in `seeds/industry-templates/*-packages.ts` not yet wired into a runnable seeder (`seed-business-composition.cjs` exists as the entry point but only references some Groups).

### 3.5 Compliance / approval / widget add-ons

- `backend/src/modules/approval-chains/addons/financial-approval.addon.ts` — KYC-aware 3-stage approval chain (F&C group only).
- `backend/src/modules/widgets/fc-widgets.ts` — Financial & Compliance KPI widgets (Loans, Compliance, Portfolios).
- `backend/src/modules/notifications/industry-notification-templates.ts` — registry for per-Industry notification copy; F&C populated, others empty.
- `backend/src/modules/workflows/industry-workflow-definitions.ts` — `CUSTOMER_LIFECYCLE` + `PROJECT_STAGE_TEMPLATE` per Industry. All 16 industries have a lifecycle (see `seeds/industry-templates/*-templates.ts`).

### 3.6 Onboarding + certification

- `prisma/seed-onboarding-allocator.cjs` wires Industry → Tier → Department/Agent pool.
- `seed-package-catalogue.cjs` wires Tier → Package composition.
- `seed-business-composition.cjs` aggregates FUNCTIONAL + INDUSTRY packages per Industry into a tenant-deployable bundle.
- SIM-04 (Accounting full-flow, FE-first runner) is the only industry certification runner; it asserts 12 stages through the real browser against `https://hq.neurecore.com`. **No other industry has an FE-first certification.**

### 3.7 Admin UI CRUD + tenant-deploy capability (audit 2026-07-31)

This is the layer **platform operators** use to manage the catalog above. All admin pages live in `neurecore/frontend-admin/src/app/`. Every edit page is gated to `user?.role === 'SUPER_ADMIN'`; non-SUPER_ADMIN viewers see read-only cards with a hint "Ask a SUPER_ADMIN to seed this pool."

| Entity | Admin page | List | Create | Edit | Delete / archive | Deploy to tenant | Notes |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| **Industry** | `/industries` (350 lines, modal-based) | ✅ | ✅ | ✅ slug/name/desc/icon/status | ✅ confirm modal | ❌ N/A by design | Status enum is `ACTIVE \| ARCHIVED`; no separate `isActive` field yet — that's §7.9 P7. |
| **Package** | `/packages` + `/packages/new` + `/packages/[id]` + `/packages/[id]/edit` (1200+ lines total) | ✅ | ✅ full form | ✅ **composition editor**: industry + tier + scope + departments + agents + features (multi-select) | ❌ no delete button — soft-disable via `PackageStatus: DRAFT \| PUBLISHED \| DEPRECATED` toggle | ❌ by design — *"No tenant data is affected — packages are SKUs, not deployments"* (`packages/page.tsx:196`). Resolves to tenant at onboarding via `seed-onboarding-allocator.cjs`. | The composition editor is the single richest pool editor in the admin. |
| **Tier** | `/tiers` (426 lines, modal-based) | ✅ | ✅ | ✅ slug/name/price/limits/features (`allowSso`, `allowApiAccess`, `allowAuditExport`, `allowPredictiveAnalytics`, `allowWhiteLabel`, `allowMultiOffice`) | ❌ no delete button — only `isActive` toggle + `isDefault` flag | ❌ — tenant tier changes flow through `TierChangeRequest` (schema:449) audit-logged workflow | Tier edit modal: "All changes are logged to tier_audit_logs for traceability." |
| **Tenant Template** (DepartmentTemplate) | `/departments-pool` (real list) + `/dept-templates` (redirect stub → `/departments-pool`) | ✅ | ✅ | ✅ structure JSON + category + tags + isPublic | ✅ confirm | ✅ **`deployToTenant(tenantId, templateId, withAgents)`** modal — picks tenant, posts to `/deploy/tenants/{id}/dept-template`. Optionally deploys linked agents in the same call. | **Only entity with a true "deploy to tenant" action.** |
| **Agent Template** | `/agents-pool` (rich editor with prompts/memory/tools) | ✅ | ✅ | ✅ name/role/prompts/permissions | ✅ confirm | ✅ **`POST /deploy/agents/from-template/{id}`** + bulk **`POST /deploy/tenants/{id}/agents`** | Has duplicate + toggle-enabled + deploy variants. |
| **Project Type** | `/project-types` + `/new` + `/[id]/edit` + `/[id]/versions` + `/[id]/packs` | ✅ | ✅ | ✅ name/classification/packs/stages/approvals | ✅ archive | ❌ N/A | Versioning view exists (`[id]/versions`); useful for future pack evolution. |
| **Question Pack** | `/question-packs` + `/new` + `/[id]/edit` | ✅ | ✅ | ✅ question text/options/conditions | ✅ confirm | ❌ N/A | Reused by NGO packages per §7.7. |
| **Tenant's Industry** | `/tenants/[id]/industry` | n/a | n/a | ✅ change tenant's industry with confirm + dirty-state guard | n/a | n/a | Only place a non-pool admin UI writes to the `Industry` table. |
| **Tenant's Tier** | `/tenants/[id]/page.tsx` (read-only display) + `TierChangeRequest` workflow | — | — | ⚠️ no direct edit; change requests flow through approval | — | — | Read-only display in tenant detail; intentional split of concerns. |
| **Feature** | `/features` | ✅ | ✅ | ✅ | ✅ | ❌ N/A | Building blocks for Package composition. |
| **Agent Template (catalog)** | `/agent-templates` | ✅ | ✅ | ✅ | ✅ | n/a | Read-only catalog view distinct from `/agents-pool`. |

**Key takeaways for the proposal:**

1. **The proposal's data artifacts (Industry / Package / Tenant Template / Agent Template / Project Type / Question Pack) are already fully editable in production.** The proposal does not need to build any new admin CRUD — it only needs the new seed scripts and the `Industry.isActive` flag (P7).
2. **The one catalog-level gap is "Package inheritance UI"** (P9, added below). When §7.8 T8 ships `Package.parentPackageId`, the package-edit composition editor must surface inherited slots as read-only badges or SPO admin users will think slots are missing.
3. **Two soft-delete gaps exist** that the proposal does NOT need to close for v1: Package hard-delete (DB-level cascade risk if any Tenant has resolved it) and Tier hard-delete (Tier is billing-related). Both are intentionally absent today; keep it that way.
4. **Tenant Template + Agent Template are the only entities that can be deployed to a tenant directly from admin.** This is by design — Packages/Industries/Tiers are *catalog definitions* that resolve to tenant state through the onboarding allocator and tier-change workflow, not by direct deployment.

---

---

## 4. The Cut List (8 Industries dropped, 8 kept)

| Kept | Industry | Group | Why kept |
|---|---|---|---|
| ✅ | `accounting-audit-services` | financial-compliance | Already live. Highest-velocity vertical. 15 packages. `mali@live.com`. SIM-04 PASS. |
| ✅ | `financial-services` | financial-compliance | Same workflow grammar as accounting. Already has 8 packages and F&C add-ons (KYC, AML, risk rating). Cuts onboarding cycle for FinTech startups (target customer per INDUSTRY-GROUPS-CONCEPT.md §5.3). |
| ✅ | `technology-digital-services` | business-technology | Tech-native buyers, no regulated record-keeping, fastest sales cycle. Tickets/Releases/Contracts/KB are generic B2B SaaS primitives. |
| ✅ | `professional-business-services` | business-technology | Same shape as tech: engagements, consulting, recruiting. Legal sub-industry is **out of scope** for the kept package set; we ship generic consulting only. |
| ✅ | `retail-commerce-consumer` | consumer-commerce | High-volume simple ops. No regulated workflow. Marketing/CRM primitives already exist. |
| ✅ | `media-communications-creative` | consumer-commerce | Marketing & creative agencies. Pure content production — no patient/contractor/regulated data. |
| ✅ | `nonprofit-international` | public-social | 501(c)(3) reporting is well-trodden SaaS territory. Grant tracking + donor CRM + volunteer ops = generic Projects/Customers. |
| ✅ | `special-purpose-organizations` | other | Family offices / holding companies. Multi-entity accounting already lives in F&C group. Zero new specialized functions required. |

| Cut | Industry | Group | Why cut |
|---|---|---|---|
| ❌ | `healthcare-life-sciences` | healthcare | HIPAA / state medical-records law. Forces Patient, Appointment, Rx, Lab entities none of the other 15 Industries need. "Wellness/med spa" sub-industries claimed in §5.1 are not actually our customers per the cut-criteria. |
| ❌ | `manufacturing-industrial` | industrial-infrastructure | ISO certs, OSHA, supply-chain chain-of-custody. Forces BOM / work-order entities. Reusable by zero other kept Industry. |
| ❌ | `construction-engineering-infrastructure` | industrial-infrastructure | Lien law, bonded contracts, OSHA. Forces site / subcontractor entities. |
| ❌ | `energy-utilities-natural-resources` | industrial-infrastructure | NERC, environmental, mining law. Forces asset / regulatory entities. |
| ❌ | `logistics-transportation-supply-chain` | industrial-infrastructure | DOT, customs, hazmat. Forces shipment / customs entities. |
| ❌ | `government-public-sector` | public-social | FOIA, procurement law, security clearance. "Training institutes" and "think tanks" sub-industries in §5.2 are not our customers; RFP-locked agencies are not our customers. |
| ❌ | `education-research` | public-social | FERPA + minors + accreditation. Forces student / grade entities. |
| ❌ | `agriculture-food-systems` | agriculture-food | FDA FSMA, USDA, organic cert, pesticide records. Forces field / harvest entities. |

> **Net effect:** the 8 Industry Groups become **5 active** (Financial & Compliance, Business & Technology, Consumer & Commerce, Public & Social, Other). Public & Social is reduced to NGO/Non-Profit only. Agriculture & Food and Healthcare groups are *removed from the picker* (still in DB; see §6.1). Industrial & Infrastructure group is *removed from the picker*.

---

## 5. Final Pruned Taxonomy — 5 Groups, 8 Industries to Ship

```
1. Financial & Compliance      → accounting-audit-services, financial-services
2. Business & Technology       → technology-digital-services, professional-business-services
3. Consumer & Commerce         → retail-commerce-consumer, media-communications-creative
4. Public & Social             → nonprofit-international
5. Other                       → special-purpose-organizations
```

This supersedes the "8 Group picker" shipped today for the *picker UI* only; the DB still has 16 rows (the 8 cut Industries remain selectable via API for power-user/early-access tenants; see §6.1).

---

## 6. What this proposal does NOT do

1. **Does not delete DB rows.** The 8 cut Industries stay in the `Industry` table. Existing tenants (none today, but future-proof) on those Industries keep working — we just don't sell into them.
2. **Does not change the data model.** `Industry.industryGroup`, `Customer.financialSubType`, project-type JSON, nav config all stay.
3. **Does not block existing shipping code.** Financial-Compliance nav, packages, add-ons continue to work.
4. **Does not require a UI redesign.** The 8-Group picker becomes a 5-Group picker (see §7.1). The accordion / search / sub-industry list stays.

---

## 7. Build Requirements

Notation:
- 🟢 = already shipped, no work.
- 🟡 = partial (seed data only, needs certification + first tenant).
- 🔴 = not shipped, build required.

### 7.0 The two artifacts every Industry needs

Every kept Industry gets exactly **two data artifacts** seeded (plus nav/customer-field/config which are already wired for all 16 — see §3.2, §3.3). Both are pure data; no schema migration is required for any phase of this proposal. The proposal's "build a seeder" line items below are one-time scripts under `backend/prisma/seed-*.cjs`.

#### Artifact A — **Tenant Template** (`DepartmentTemplate` + `AgentTemplate` + `TierAgentPool` rows)

The blueprint for what the tenant's org chart and Employees page look like on Day 1.

| Field | Source model | Example value |
|---|---|---|
| Template slug | `DepartmentTemplate.slug` | `nonprofit-international-ngo` |
| Template structure | `DepartmentTemplate.structure: Json[]` | list of `{name, description, type: 'EXECUTIVE'\|'CORE'\|'FUNCTIONAL', parentSlug?}` slots |
| Category tag | `DepartmentTemplate.category` | `nonprofit` |
| Per-slot agent | `AgentTemplate` row + `TierAgentPool` row | `program-manager` (slot 1, required, default-selected) |

Spec format used below — one row per Department slot:

```
DepartmentTemplate slug: <industry-slug>-<archetype>
  slot   name                          type        parent        default agent(s)
  ─────  ────────────────────────────  ──────────  ────────────  ────────────────────
  01     <Exec role>                    EXECUTIVE   —             <exec-agent>
  02     <Core function A>              CORE        —             <agent-A>
  03     <Core function B>              CORE        —             <agent-B>
  04     <Functional specialist 1>      FUNCTIONAL  <core A>      <agent-C>
  ...
```

The **template is industry-scoped, tier-agnostic**. Tier-agent selection happens via `TierAgentPool` rows that reference the `AgentTemplate` (different tiers may select different subsets).

#### Artifact B — **Packages** (`Package` rows per Industry × Tier)

The commercial SKU bundle the tenant gets when they pick `(industry, tier)` during onboarding.

| Field | Source model | Example value |
|---|---|---|
| Package slug | `Package.slug` | `ngo-grant-acquisition` |
| Industry FK | `Package.industryId` | `nonprofit-international` |
| Tier FK | `Package.tierId` | `starter` |
| Scope | `Package.scope` (`FUNCTIONAL` = reusable across industries, `VERTICAL` = industry-specific) | `VERTICAL` |
| Departments | M2M `Package.departments: DepartmentTemplate[]` | links back to Artifact A slots |
| Agents | M2M `Package.aiAgents: AgentTemplate[]` | links to specific agents within those templates |
| Features | M2M `Package.features: Feature[]` | `audit_logs, crm_integration, workflow_automation, ms365_integration, sso, two_factor` |
| Counts | `Package.suggestedAgentCount`, `suggestedDepartmentCount` | `12` / `4` |

Spec format used below — one table per Industry, one row per Package, columns are **the four M2M refs that drive provisioning**:

```
Package slug                          tier        scope      departments (from A)     agents (subset of A)             features
─────────────────────────────────────  ──────────  ─────────  ───────────────────────  ───────────────────────────────  ──────────────────────────────────
ngo-foundation                        starter     FUNCTIONAL Foundation + 2 CORE     4 (exec + 2 core + 1 func)     workflow_automation, audit_logs, sso
ngo-grant-acquisition                 professional VERTICAL  +Programs +Development   +Grant Writer +Programs Mgr    +grant_pack, crm_integration
...
```

> **Tier naming convention (target):** `starter | professional | enterprise` — matches `seed-package-catalogue.cjs` and `seed-accounting-packages.cjs`. The `seed-financial-services-packages.cjs` uses `basic | business | professional | enterprise`; this is an inconsistency that Phase 2.B must fix (proposal item §7.2.T1).

#### Build order per Industry

For each Industry we ship, the build sequence is **strict**:

1. **Tenant Template** (Artifact A) — must exist before Packages reference its departments/agents.
2. **Packages** (Artifact B) — link to Template slots via M2M.
3. **Project types** — reference Packages' feature sets.
4. **Workspace modules** — functional pages that read from those projects.
5. **SIM-XX runner** — certifies the full flow.

Skipping step 1 → 2 is the most common mistake and produces Packages that reference template slots that don't exist (silent FK failure on resolve).

#### Per-Industry effort budget (data-seeding only)

| Industry | Tenant Template (A) | Packages (B) | Total seed-dev-days |
|---|---|---|---|
| `accounting-audit-services` | ✅ shipped | ✅ shipped (15) | 0 |
| `financial-services` | 🔴 build | 🟡 rewrite tier slugs (8) | 1 |
| `technology-digital-services` | ✅ Run-6 | 🟡 wire 8 stubs | 0.5 |
| `professional-business-services` | 🔴 build | 🟡 wire 5 stubs (drop legal) | 1 |
| `retail-commerce-consumer` | 🔴 build | 🟡 wire 5 + add 3 | 1.5 |
| `media-communications-creative` | 🟢 reuse retail | 🟡 wire 2 + add 3 | 1 |
| `nonprofit-international` | 🔴 build | 🔴 build 5 | 2 |
| `special-purpose-organizations` | 🔴 build | 🔴 build 3 (cross-ref F&C) | 1.5 |
| **Total** | | | **~8.5 dev-days** (data only) |

The remaining ~46 dev-days of proposal effort are workspace modules (§7.x rows), certification runners (§7.x SIM rows), and shared prerequisites (§7.9).

---

### 7.1 Phase 2.A — Picker & onboarding cut-down (1 dev-day, frontend only)

| Item | Surface | Status | Build |
|---|---|---|---|
| Reduce 8-Group picker to 5 Groups | `frontend-tenant/src/app/onboarding/...` | 🟢 industry-list already read from DB; need to filter to 5 group slugs | Add `ALLOWED_INDUSTRY_GROUPS` constant in a shared module (e.g. `frontend-tenant/src/lib/industry-pruning.ts`); filter the picker + onboarding accordion. |
| Hide "sub-industries" descriptive text for cut Industries | `frontend-tenant/src/components/industry/...` | 🟢 nav config already drives this | The accordion already shows the kept 8 industries' sub-industries from `Industry.description`. No change needed beyond the filter above. |
| Hide cut Industries from "Industry" Customer dropdown | `frontend-tenant/src/components/customers/...` | 🟢 dropdown is DB-driven | Filter client-side using the same constant. |
| Admin UI: mark cut Industries as `isActive=false` flag | admin Industry CRUD | 🔴 | Add `Industry.isActive Boolean @default(true)` migration; admin toggle; onboarding + Customer dropdown filter on `isActive`. |
| Docs: update `INDUSTRY-GROUPS-CONCEPT.md` §3 "Target Customer Profiles" table | memory-bank-arc | 🟢 doc-only | Mark the 8 cut Industries with "**DEPRECATED for v1 — not in scope**" + link this proposal. |

### 7.2 Phase 2.B — Financial & Compliance: second vertical (`financial-services`) 🟡 → 🟢

**Status:** 8 packages seeded but tier-slugs are inconsistent; no Tenant Template; needs 3 more project types + certification.

#### Artifact A — Tenant Template (build: `prisma/seed-financial-services-department-template.cjs`)

```
DepartmentTemplate slug: financial-services-bank
  slot  name                          type        parent      default agent
  ────  ────────────────────────────  ──────────  ──────────  ────────────────────
  01    Bank Manager / Firm Principal  EXECUTIVE   —          firm-principal
  02    Client Onboarding              CORE        —          kyc-officer
  03    Front Office / Teller Ops      CORE        —          client-relationship-mgr
  04    Lending Operations             CORE        —          loan-officer
  05    Compliance & Risk              CORE        —          compliance-analyst
  06    AML / BSA Specialist           FUNCTIONAL  Compliance  aml-analyst
  07    Wealth Advisor                 FUNCTIONAL  Client     wealth-advisor
  08    Operations Coordinator         FUNCTIONAL  —          operations-coordinator
```

Reuses the F&C group's customer first-class columns (`financialSubType`, `kycStatus`, `riskRating`, `taxId`, `lifecycleStage`) — these are already wired and surface automatically for any `industryGroup === 'financial-compliance'` tenant (`Customer.tsx` FE guard). Sub-types this template uses: `BANKING`, `WEALTH_MANAGEMENT`, `INVESTMENT`, `FINTECH`.

#### Artifact B — Packages (rewrite: `prisma/seed-financial-services-packages.cjs`)

**T1. Fix tier-slug inconsistency first.** Current FS seeder uses `basic | business | professional | enterprise`. Canonical is `starter | professional | enterprise` (matches `seed-package-catalogue.cjs`, `seed-accounting-packages.cjs`). Migration: rewrite `tierSlug` values in the FS seeder; re-run.

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `fs-foundation` | starter | FUNCTIONAL | 01 + 02 + 08 | firm-principal, kyc-officer, client-relationship-mgr, operations-coordinator | `workflow_automation, audit_logs, sso, two_factor` |
| `fs-client-onboarding-kyc` | professional | VERTICAL | 02 + 05 | kyc-officer, compliance-analyst, aml-analyst | `+kyc_pack, aml_screening, document_templates, crm_integration` |
| `fs-wealth-management` | professional | VERTICAL | 07 | wealth-advisor, client-relationship-mgr | `+portfolio_pack, custom_reports` |
| `fs-lending` | professional | VERTICAL | 04 | loan-officer, compliance-analyst | `+lending_pack, document_templates, custom_reports` |
| `fs-banking-core` | enterprise | VERTICAL | all 8 | all 8 | `+api_access, webhooks, two_factor, erp_integration, custom_reports` |
| `fs-insurance-claims` | enterprise | VERTICAL | 05 + 06 | aml-analyst, compliance-analyst | `+claims_pack, document_templates` |
| `fs-investment-management` | enterprise | VERTICAL | 07 + 04 | wealth-advisor, loan-officer | `+portfolio_pack, lending_pack, custom_reports` |
| `fs-enterprise-platform` | enterprise | VERTICAL | all 8 | all 8 | `+api_access, webhooks, sso, two_factor, erp_integration, ms365_integration, custom_reports` |

> **Why FUNCTIONAL at starter tier?** Starter tenants need a runnable org + clients, not the full vertical. Vertical packages unlock on professional/enterprise when the tenant has volume to justify the complexity. Mirrors accounting's pattern (`firm-business-management` at starter, `accounting-operations` at professional).

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/financial-services.json` | 🟢 1 type | Add 3 more: `Account Opening`, `Loan Origination`, `Wealth Review`. |
| Approval-chain addon | `backend/src/modules/approval-chains/addons/financial-approval.addon.ts` | 🟢 F&C-group scoped | Verify addon triggers for FS sub-industry. Currently keyed by group; may need to inspect `Customer.financialSubType` to pick chain (BANKING vs WEALTH). ~0.5 dev-day. |
| FE: workspace extras (Engagements, Loans, Portfolios, Audits, Tax, Payroll, Compliance, Risk) | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🟢 rendered for F&C | **Verify `loans` + `portfolios` modules render meaningfully for `financial-services`** — they currently share the same KPI strip as accounting (`fixes.md §A.1`). Branch on `tenant.industry` to load industry-specific KPI definitions. ~1 dev-day. |
| Tenant isolation | `backend/src/modules/industry/*` | 🟢 | All `/industries/:slug/*` endpoints filter by `req.user.tenantId`. |
| SIM-05 runner | `simulations/SIM-05-Financial-Services-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 12 stages: tenant onboarding → pick financial-services → create client (BANKING sub-type) → create KYC project → KYC workflow → AML check → Loan origination → Approvals → Compliance reporting. FE-first. |
| Sidecar: FS tools | `sidecar/accounting-sidecar/` | 🔴 | 4 of 11 TIER-2 tools in `pending-tasks.md §0` are F&C-shared: `credit-score`, `aml-check`, `kyc-verify`, `e-sign`. Wire to FS workflows. |
| Browser-first happy-path gate | tests | 🔴 | Same as SIM-04 §8a. |

**Phase 2.B effort: ~8 dev-days** (1 day template + 0.5 days package rewire + 1 day workspace branch + 4 days SIM-05 + 1.5 days sidecar + 0.5 day tier-slug migration + 0.5 day approval addon).

**Admin-UI implications:** Once the FS tenant template + 8 packages land, SUPER_ADMIN can edit them via `/packages/[id]/edit` composition editor and `/departments-pool` deploy modal — no new admin build needed. The T1 tier-slug fix is a data migration; admin UI renders the corrected slugs after the migration runs. Sidecar tools are admin-configured via the existing `accounting-sidecar` registry (no new admin page).

### 7.3 Phase 3.A — Business & Technology: `technology-digital-services` 🟡 → 🟢

**Status:** Tenant Template applied in Run-6 (verify prod state). 8 packages stub-defined but not wired into `seed-business-composition.cjs`. Needs 2 more project types + 4 functional workspace modules + certification.

#### Artifact A — Tenant Template (verify: `prisma/seed-business-technology-templates.cjs`)

```
DepartmentTemplate slug: tech-digital-services-it
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Managing Director / Partner   EXECUTIVE   —         tech-delivery-lead
  02    Engineering                   CORE        —         technical-lead
  03    Product                       CORE        —         product-manager
  04    DevOps                        CORE        —         devops-specialist
  05    Quality Assurance             CORE        —         qa-engineer
  06    Client Success                FUNCTIONAL  —         client-success-manager
  07    Operations Coordinator        FUNCTIONAL  —         operations-coordinator
```

**T2.** Verify Run-6 actually applied this template to prod: `SELECT * FROM department_templates WHERE slug = 'tech-digital-services-it';`. If empty, re-run the seeder. ~0.1 dev-day.

#### Artifact B — Packages (wire stubs in `seed-business-composition.cjs`)

Stub defs already exist in `seeds/industry-templates/business-technology-packages.ts`. They need to be referenced from `seed-business-composition.cjs` so they're persisted.

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `it-project-delivery` | starter | FUNCTIONAL | 01 + 02 + 07 | tech-delivery-lead, technical-lead, qa-engineer, operations-coordinator | `workflow_automation, audit_logs, sso` |
| `it-client-success` | starter | FUNCTIONAL | 06 | client-success-manager, tech-delivery-lead | `crm_integration, workflow_automation, two_factor` |
| `it-devops-infrastructure` | professional | FUNCTIONAL | 04 + 02 | devops-specialist, technical-lead, qa-engineer | `+api_access, webhooks, custom_reports` |
| `it-product-development` | professional | FUNCTIONAL | 03 + 02 + 05 | technical-lead, tech-delivery-lead, qa-engineer, devops-specialist | `+api_access, webhooks, audit_logs` |
| `it-quality-engineering` | professional | FUNCTIONAL | 05 + 02 | qa-engineer, technical-lead | `+api_access, custom_reports` |
| `it-saas-operations` | enterprise | VERTICAL | all 7 | all 7 | `+api_access, webhooks, sso, two_factor, ms365_integration, google_workspace, custom_reports` |
| `it-managed-services` | enterprise | VERTICAL | 06 + 04 | client-success-manager, devops-specialist, qa-engineer | `+crm_integration, api_access, webhooks, two_factor` |
| `it-enterprise-platform` | enterprise | VERTICAL | all 7 | all 7 | `+ms365_integration, google_workspace, erp_integration, custom_reports` |

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/technology-digital-services.json` | 🟢 1 type | Add 2 more: `Product Launch` (classification: `INTERNAL_INITIATIVE`), `Support Escalation` (classification: `CLIENT_ENGAGEMENT`). |
| Approval chains | `approval-chains` module | 🟢 generic | Use existing `standard-3-stage` template; no addon. |
| **Workspace modules** | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🔴 stub renders today | **Build 4 functional pages: Tickets (CRUD + SLA counter), Releases (milestone tracker), Contracts (template + expiry), Knowledge Base (markdown wiki).** This is the bulk of Phase 3.A — ~5 dev-days. |
| Industry tools | Hermes | 🔴 | `tech-jira-import`, `tech-github-sync`, `tech-release-notes-gen`. ~1 dev-day; can defer to Stage 2. |
| SIM-06 runner | `simulations/SIM-06-Tech-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 10 stages: onboard → pick tech-digital-services → create client → create IT project → assign tickets → track release → contract renewal → close. FE-first. |

**Phase 3.A effort: ~10 dev-days** (0.5 data wiring + 5 workspace modules + 3 SIM-06 + 1 tools + 0.5 misc).

**Admin-UI implications:** The tech-digital-services Tenant Template is **already seeded** (Run-6 per `TIER-DEPLOYMENT-RUNBOOK.md`); first action in this phase is to verify prod via `SELECT * FROM department_templates WHERE slug = 'tech-digital-services-it';` — if missing, re-run seeder. Once 8 packages are wired, `/packages` lists them; `/packages/[id]/edit` composition editor allows SUPER_ADMIN to add/remove departments/agents/features without re-running seeders (audit confirmed). No new admin UI.

### 7.4 Phase 3.B — Business & Technology: `professional-business-services` 🟡 → 🟢

**Status:** 5 packages stub-defined, **including `professional-legal` which is cut**. Reuses the B&T group agent pool. Needs Tenant Template + cleaned-up package list + certification.

#### Artifact A — Tenant Template (build: `prisma/seed-professional-business-department-template.cjs`)

```
DepartmentTemplate slug: professional-business-services-firm
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Managing Partner / Principal  EXECUTIVE   —         engagement-manager
  02    Consulting Practice           CORE        —         subject-matter-expert
  03    Business Development          CORE        —         business-development
  04    Research & Knowledge          CORE        —         research-specialist
  05    Recruiting & Talent           FUNCTIONAL  03        business-development, operations-coordinator
  06    Operations Coordinator        FUNCTIONAL  —         operations-coordinator
```

**T3. Cut `professional-legal` from the package list** before wiring — it violates cut criteria #1 (legal services = malpractice + jurisdiction-bound regulation). The 3 Industries we keep in this group (technology, professional consulting, recruiting) have no specialized legal surfaces.

#### Artifact B — Packages (clean + wire: `seed-business-composition.cjs`)

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `professional-consulting` | starter | FUNCTIONAL | 01 + 02 + 06 | engagement-manager, subject-matter-expert, operations-coordinator | `workflow_automation, crm_integration, sso` |
| `professional-business-dev` | starter | FUNCTIONAL | 03 + 06 | business-development, operations-coordinator | `crm_integration, workflow_automation, two_factor` |
| `professional-research-knowledge` | professional | FUNCTIONAL | 04 + 02 | research-specialist, subject-matter-expert | `+document_templates, custom_reports` |
| `professional-recruiting` | professional | VERTICAL | 05 | business-development, operations-coordinator, engagement-manager | `+crm_integration, workflow_automation, api_access` |
| `professional-advisory-firm` | enterprise | VERTICAL | all 6 | all 6 | `+api_access, sso, two_factor, ms365_integration, custom_reports, document_templates` |

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/professional-business-services.json` | 🟢 1 type | Add 2 more: `Consulting Engagement` (CLIENT_ENGAGEMENT, 5 stages: Discovery → Analysis → Recommendation → Implementation → Close), `Recruiting Search` (INTERNAL_INITIATIVE, 4 stages: Sourcing → Vetting → Client Review → Placement). |
| Workspace modules | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🟢 reused | **Zero new build** — same nav config block as Phase 3.A; Tickets/Releases/Contracts/KB already built. This is the leverage point of pruning to 8. |
| Industry tools | Hermes | 🔴 (deferrable) | `consulting-bench-research` (LinkedIn / public profiles for bench candidates). |
| SIM-07 runner | `simulations/SIM-07-Consulting-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 10 stages. FE-first. |

**Phase 3.B effort: ~5 dev-days** (1 template + 0.5 data wiring + 3 SIM-07 + 0.5 misc). The fact that this Industry reuses Phase 3.A's 4 workspace modules with zero new build is **the primary ROI of the pruning decision**.

**Admin-UI implications:** **T3 (drop `professional-legal`) is a one-time data edit** — admin opens `/packages`, finds `professional-legal`, and either archives it (`status: DEPRECATED`) or hard-deletes (P10 not yet shipped → recommend archive for safety). After that, wire 5 stub packages into `seed-business-composition.cjs` so they appear in `/packages` list. The 4 workspace modules (Tickets/Releases/Contracts/KB) are zero-build reuses — no admin work, just `/packages/[id]/edit` composition assertions.

### 7.5 Phase 4.A — Consumer & Commerce: `retail-commerce-consumer` 🟡 → 🟢

**Status:** 5 packages stub-defined, 1 project type, no Tenant Template, all 7 workspace modules are stubs. **Largest workspace build of the proposal.**

#### Artifact A — Tenant Template (build: `prisma/seed-retail-commerce-department-template.cjs`)

```
DepartmentTemplate slug: retail-commerce-store
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Store Director / GM            EXECUTIVE   —         operations-manager
  02    Store Operations              CORE        —         operations-manager, customer-service-rep
  03    Merchandising                 CORE        —         merchandiser
  04    Marketing & Campaigns         CORE        —         marketing-manager
  05    Customer Service              CORE        —         customer-service-rep
  06    Analytics & Insights          FUNCTIONAL  01        analytics-manager
  07    E-Commerce Operations         FUNCTIONAL  04        operations-manager, marketing-manager
```

**T4. Inventory stays in the document store** — no specialized SKU entity. Rationale: cut criteria #2 (no specialized primitives). A SKU is generic enough to model as a Document with type=`product`, attributes as key-value, stock-level as a numeric field. This keeps the data model stable across all 8 kept Industries.

#### Artifact B — Packages (wire 5 stubs + add 3 in `seed-business-composition.cjs`)

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `retail-store-operations` | starter | FUNCTIONAL | 01 + 02 | operations-manager, customer-service-rep | `workflow_automation, two_factor, sso` |
| `retail-customer-loyalty` | starter | FUNCTIONAL | 05 + 04 | customer-service-rep, marketing-manager | `crm_integration, workflow_automation` |
| `retail-merchandising` | professional | FUNCTIONAL | 03 + 06 | merchandiser, analytics-manager | `+custom_reports, document_templates` |
| `retail-marketing-campaigns` | professional | FUNCTIONAL | 04 + 06 | marketing-manager, analytics-manager | `+crm_integration, custom_reports, webhooks` |
| `retail-ecommerce` | professional | VERTICAL | 07 | operations-manager, marketing-manager, analytics-manager | `+api_access, webhooks, workflow_automation` |
| `retail-multistore` | enterprise | VERTICAL | all 7 | all 7 | `+api_access, webhooks, sso, two_factor, ms365_integration, google_workspace, custom_reports` |
| `retail-seasonal-campaigns` | enterprise | FUNCTIONAL | 04 + 03 | marketing-manager, merchandiser | `+crm_integration, document_templates, custom_reports` |
| `retail-enterprise-platform` | enterprise | VERTICAL | all 7 | all 7 | `+erp_integration, ms365_integration, api_access, webhooks, custom_reports` |

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/retail-commerce-consumer.json` | 🟢 1 type (Store Opening) | Add 3 more: `Seasonal Campaign` (INTERNAL_INITIATIVE, 5 stages: Planning → Setup → Launch → In-Flight → Post-Mortem), `Product Launch` (INTERNAL_INITIATIVE, 4 stages: Sourcing → Setup → Launch → Review), `Loyalty Program` (INTERNAL_INITIATIVE, 4 stages: Design → Pilot → Rollout → Optimize). |
| **Workspace modules (largest single block of work)** | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🔴 7 stubs | Build 7 functional pages: **Products** (catalog CRUD via Documents), **Orders** (order pipeline + Customer FK + status tracking), **Inventory** (stock-level per Document, reorder alerts), **Stores** (multi-location dashboard), **Promotions** (campaign + ROI), **Campaigns** (audience + budget + performance), **Content** (calendar + publishing pipeline). **~5 dev-days.** |
| Industry tools | Hermes | 🔴 (deferrable) | `retail-inventory-import-csv`, `retail-loyalty-roi-calc`. |
| SIM-08 runner | `simulations/SIM-08-Retail-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 12 stages: onboard → pick retail → create product (Document) → create store → seasonal campaign → order pipeline → inventory reorder → loyalty program rollout. FE-first. |

**Phase 4.A effort: ~12 dev-days** (1.5 template + 0.5 data wiring + 5 workspace modules + 4 SIM-08 + 1 misc).

**Admin-UI implications:** T4 (Inventory as Document) requires zero schema change — `Department` and `Document` are already wired. Admin sees Products/Orders/Inventory/etc. as `/workspace/*` route stubs in the tenant FE; nothing in admin changes. The 5 stub packages + 3 new packages are all created via `seed-business-composition.cjs`; admin can compose additional packages per-tenant via `/packages/new`. Note: `Product` and `Inventory` in `/workspace/*` are tenant-side pages, not admin-side — admin only sees the underlying Documents via `/customers` or the document explorer (if it exists; logged for Stage 2 audit).

### 7.6 Phase 4.B — Consumer & Commerce: `media-communications-creative` 🟡 → 🟢

**Status:** 2 packages stub-defined, 1 project type, no Tenant Template. **Reuses Phase 4.A's Tenant Template (creative + production + client services ≈ a re-shuffle of retail's marketing + content + e-commerce roles).**

#### Artifact A — Tenant Template (build: `prisma/seed-media-creative-department-template.cjs`)

**Decision: separate Tenant Template, not retail-reuse.** Rationale: a media agency org chart has Production + Creative + Client Services as peers; retail has Operations + Merchandising + Marketing. Different `EXECUTIVE` slot too (Creative Director vs Store Director). The agents overlap (marketing-manager, content-producer) but the department shapes differ.

```
DepartmentTemplate slug: media-creative-agency
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Creative Director             EXECUTIVE   —         creative-director
  02    Creative / Design             CORE        —         copywriter
  03    Production                    CORE        —         content-producer
  04    Client Services               CORE        —         project-manager-creative
  05    Operations Coordinator        FUNCTIONAL  04        operations-coordinator
```

#### Artifact B — Packages (wire 2 stubs + add 3 in `seed-business-composition.cjs`)

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `media-content-production` | starter | FUNCTIONAL | 03 + 04 | content-producer, project-manager-creative | `workflow_automation, document_templates, sso` |
| `media-brand-development` | professional | FUNCTIONAL | 01 + 02 | creative-director, copywriter | `+document_templates, custom_reports` |
| `media-social-management` | professional | VERTICAL | 03 + 04 | content-producer, project-manager-creative | `+crm_integration, webhooks, custom_reports` |
| `media-video-production` | enterprise | VERTICAL | 03 + 02 | content-producer, copywriter | `+api_access, webhooks, custom_reports, document_templates` |
| `media-pr-campaigns` | enterprise | VERTICAL | 04 + 01 | project-manager-creative, creative-director | `+crm_integration, custom_reports, document_templates` |

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/media-communications-creative.json` | 🟢 1 type | Add 3 more: `Campaign Launch` (CLIENT_ENGAGEMENT, 6 stages: Brief → Concept → Production → Review → Launch → Recap), `Brand Refresh` (CLIENT_ENGAGEMENT, 5 stages: Audit → Strategy → Identity → Rollout → Measure), `Content Series` (INTERNAL_INITIATIVE, 4 stages: Plan → Produce → Publish → Measure). |
| Workspace modules | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🟢 reused from 4.A | **Reuses Campaigns + Content from Phase 4.A;** Products / Orders / Inventory / Stores / Promotions are filtered out per sub-industry (see T5). |
| Industry tools | Hermes | 🔴 (deferrable) | `media-content-calendar`, `media-mood-board-gen`. |
| SIM-09 runner | `simulations/SIM-09-Media-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 10 stages: onboard → pick media → create client → create campaign project → assign creative → assign production → brief → content series → launch → close. FE-first. |

**T5. Sub-industry nav filtering** (cross-cutting dependency, must ship in Phase 2.A): add `subIndustries: string[]` to `RailItem` and filter `IconRail.tsx:214` against `tenant.industry`. Without this, media tenants see Products / Orders / Inventory / Stores stubs in their nav. ~0.5 dev-day; ship with Phase 2.A.

**Phase 4.B effort: ~5 dev-days** (1 template + 0.5 data wiring + 3 SIM-09 + 0.5 misc).

**Admin-UI implications:** T5 (sub-industry nav filter) ships in Phase 2.A (P3 prerequisite), so by Phase 4.B the `/workspace/products`, `/workspace/orders`, `/workspace/inventory`, `/workspace/stores`, `/workspace/promotions` routes are already hidden for media tenants. Admin sees both retail and media packages in `/packages`; the sub-industry filter is tenant-FE-only. Media tenant template and 5 packages are all admin-editable post-seed via `/packages/[id]/edit` and `/departments-pool`.

### 7.7 Phase 5.A — Public & Social: `nonprofit-international` 🟡 → 🟢

**Status:** 0 packages, 0 tenant template, 1 project type, 6 workspace stubs (4 to build, 2 to hide via sub-industry filter from T5).

#### Artifact A — Tenant Template (build: `prisma/seed-nonprofit-department-template.cjs`)

```
DepartmentTemplate slug: nonprofit-international-ngo
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Executive Director            EXECUTIVE   —         program-manager
  02    Programs                      CORE        —         program-manager
  03    Development / Fundraising     CORE        —         grant-writer
  04    Operations                    CORE        —         operations-coordinator
  05    Donor Stewardship             FUNCTIONAL  03        donor-stewardship
  06    Compliance & Reporting        FUNCTIONAL  01        operations-coordinator
```

#### Artifact B — Packages (build from scratch: `seed-nonprofit-international-packages.cjs`)

Reuses the existing `seeds/question-packs/` set: `core, stakeholders, budget, timeline, deliverables, compliance, grant, hr, training, research, field-mission` — **all 11 already exist**, no new pack definitions required.

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `ngo-foundation` | starter | FUNCTIONAL | 01 + 04 | program-manager, operations-coordinator | `workflow_automation, audit_logs, sso, two_factor` |
| `ngo-program-delivery` | starter | FUNCTIONAL | 02 + 04 | program-manager, operations-coordinator | `+field_mission_pack, hr_pack, stakeholder_pack` |
| `ngo-donor-crm` | professional | FUNCTIONAL | 05 + 03 | donor-stewardship, grant-writer | `+crm_integration, grant_pack, custom_reports` |
| `ngo-grant-acquisition` | professional | VERTICAL | 03 + 05 | grant-writer, donor-stewardship, program-manager | `+grant_pack, document_templates, custom_reports` |
| `ngo-volunteer-management` | professional | FUNCTIONAL | 02 + 04 | program-manager, operations-coordinator | `+hr_pack, stakeholder_pack, workflow_automation` |
| `ngo-impact-reporting` | enterprise | VERTICAL | 06 + 02 | operations-coordinator, program-manager | `+custom_reports, document_templates, audit_logs` |
| `ngo-enterprise-platform` | enterprise | VERTICAL | all 6 | all 6 | `+api_access, webhooks, sso, two_factor, ms365_integration, google_workspace, custom_reports` |

> **T6. NGO tenant templates cannot use generic `compliance-officer` agent** — that role is bound to the F&C group in the addon registry. NGO uses `operations-coordinator` with a `+compliance_pack` feature flag, not a dedicated role. This is the inverse of the special-purpose case (§7.8) which **does** use a generic `compliance-officer`.

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/nonprofit-international.json` | 🟢 1 type | Add 3 more: `Grant Application` (INTERNAL_INITIATIVE, 6 stages: Research → Drafting → Internal Review → Submission → Decision → Reporting), `Field Mission` (INTERNAL_INITIATIVE, 5 stages: Planning → Mobilization → Implementation → Reporting → Closeout), `Beneficiary Program` (INTERNAL_INITIATIVE, 5 stages: Design → Pilot → Rollout → Operation → Evaluation). |
| Workspace modules | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🔴 6 stubs (4 to build) | **Build 4 functional pages: Programs (program directory + KPI tracker), Grants (pipeline + calendar), Field Operations (site data + logs), Cases (beneficiary case tracking).** Hide Licenses + Inspections via T5 sub-industry filter. ~3 dev-days. |
| Approval-chain addon | `approval-chains` module | 🟢 | Generic 3-stage chain is sufficient. |
| Industry tools | Hermes | 🔴 (deferrable) | `nonprofit-grant-search` (Foundation Directory API), `nonprofit-impact-report-gen`. |
| SIM-10 runner | `simulations/SIM-10-NGO-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 10 stages: onboard → pick nonprofit → create donor → create grant application project → field mission → volunteer ops → impact report. FE-first. |

**Phase 5.A effort: ~6 dev-days** (2 template + 1 data wiring + 3 workspace + 3 SIM-10 + 0.5 misc; runs parallel to template work).

**Admin-UI implications:** NGO is built from scratch — no existing stubs. 5 new packages + 1 new tenant template + 3 project types are all seeded; admin sees them in `/packages`, `/departments-pool`, `/project-types` respectively after seed runs. P13 (DepartmentTemplate category enum) should ship alongside this Phase so `category: 'nonprofit'` is added cleanly to the enum rather than free-text drift. T5 (sub-industry filter) hides `/workspace/licenses` and `/workspace/inspections` for NGO tenants automatically.

### 7.8 Phase 5.B — Other: `special-purpose-organizations` 🟡 → 🟢

**Status:** 0 packages, 0 tenant template, 1 project type, 4 workspace stubs (2 to build, "Custom Modules" to hide). **The only Industry that reuses another group's packages via cross-group reference.**

#### Artifact A — Tenant Template (build: `prisma/seed-special-purpose-department-template.cjs`)

```
DepartmentTemplate slug: special-purpose-organizations-holding
  slot  name                          type        parent    default agent
  ────  ────────────────────────────  ──────────  ────────  ────────────────────
  01    Managing Director / Principal  EXECUTIVE   —         operations-coordinator
  02    Operations                    CORE        —         operations-coordinator
  03    Finance & Accounting          CORE        —         finance-controller
  04    Compliance & Governance       CORE        —         compliance-officer
```

**T7. Generic `compliance-officer` agent must NOT collide with F&C `Compliance Auditor`.** `compliance-officer` here is a role for governance + regulatory tracking at a multi-entity level (corporate filings, board minutes, beneficial-ownership tracking). It is registered as a separate `AgentTemplate` row keyed to the `other` group only. Confirmed not to collide with F&C `Compliance Auditor` because Tenant Template slugs differ (`special-purpose-organizations-holding` vs `accounting` template) and `TierAgentPool` is Industry-scoped via `Package.industryId`.

#### Artifact B — Packages (build 3 with cross-group F&C reference)

| Package slug | tier | scope | departments (from A) | agents | features |
|---|---|---|---|---|---|
| `spo-foundation` | starter | FUNCTIONAL | 01 + 02 | operations-coordinator | `workflow_automation, audit_logs, sso, two_factor` |
| `spo-multi-entity-operations` | professional | VERTICAL | 02 + 04 | operations-coordinator, compliance-officer | `+document_templates, custom_reports, audit_logs` |
| `spo-portfolio-oversight` | professional | VERTICAL | 03 + 01 | finance-controller, operations-coordinator | `+custom_reports, document_templates` |
| `spo-family-office-reporting` | enterprise | VERTICAL | 03 + 04 | finance-controller, compliance-officer | `+custom_reports, audit_logs, document_templates` |

**T8. Cross-group package reference** (`Package.parentPackageId` FK → `Package.id`). Special-Purpose tenants at enterprise tier should *also* get the F&C `accounting-operations` package's agents (Bookkeeper & Controller, GL Accountant) — that's literally what family offices need. Implementation: add FK column + migration; let `Package.departments` and `Package.aiAgents` resolve through inheritance.

#### Other build items

| Item | Surface | Status | Build |
|---|---|---|---|
| Project types | `seeds/project-types/special-purpose-organizations.json` | 🟢 1 type | Add 2 more: `Entity Restructure` (INTERNAL_INITIATIVE, 6 stages: Plan → Approve → File → Migrate → Notify → Close), `Annual Review` (INTERNAL_INITIATIVE, 5 stages: Plan → Collect → Review → Report → Archive). |
| Workspace modules | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🔴 4 stubs (2 to build) | **Build 2 functional pages: Operations (inter-entity coordination + KPI tracker), Assets (asset register + portfolio oversight).** Hide "Custom Modules" via T5 sub-industry filter. ~1.5 dev-days. |
| Approval-chain addon | `approval-chains` module | 🟢 | Generic. |
| Industry tools | Hermes | 🔴 (deferrable) | All. |
| SIM-11 runner | `simulations/SIM-11-SPO-Project-Full-Flow/` | 🔴 | Mirror SIM-04. 10 stages: onboard → pick special-purpose → create entity → multi-entity ops → portfolio review → annual review. FE-first. |

**Phase 5.B effort: ~4 dev-days** (1.5 template + 1 data wiring including T8 FK migration + 1.5 workspace + 3 SIM-11 + 0.5 misc).

**Admin-UI implications:** This phase is the **only one that requires new admin UI** — T8 (P4 backend + P9 admin). After the migration, `/packages/[id]/edit` for any package with `parentPackageId` set (e.g. `spo-multi-entity-operations` → inherits from `accounting-operations`) must render inherited departments/agents as read-only badges with tooltip "Inherited from `{parentPackageSlug}`". Without P9, SUPER_ADMIN editing SPO packages will be confused why the composition editor shows fewer slots than expected. T7 generic `compliance-officer` agent is added to the SPO `DepartmentTemplate` via seed script; admin can edit it via `/departments-pool` post-seed. T5 hides `/workspace/custom` for SPO tenants.

### 7.9 Shared phase prerequisites

Classified by **dependency tier** — which phases block on each item, and which are one-time shared infra vs per-Industry deferred admin-UI work.

#### Tier A — Must ship before any Industry certification (one-time shared infra)

| # | Item | Surface | Status | Build | Blocks |
|---|---|---|---|---|---|
| **P1** | Generic Workspace module builder | `frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` | 🟢 already a generic stub renderer | Hardening: parameterize by `featureId` so the 28 stub pages across all kept Industries share one component, not 28 copies. **~2 dev-days.** | All workspace-module builds (Phase 2.B+). |
| **P2** | Per-Industry SIM-XX runner base class | `simulations/SIM-04-Accounting-Project-Full-Flow/` | 🟢 SIM-04 is the template | Extract common Playwright helpers + FE-first assertion utilities into `simulations/_lib/base-runner.ts`. Saves ~5 dev-days across SIM-05–SIM-11. **~2 dev-days.** | All SIM-XX runners. |
| **P3** | **Sub-industry nav filter** (T5) | `frontend-tenant/src/lib/industryNavigation.ts` + `IconRail.tsx:214` | 🔴 | Add `subIndustries?: string[]` to `RailItem`; filter against `tenant.industry` (not just `tenant.industryGroup`). **~0.5 dev-day.** Ship with Phase 2.A. | Phase 4.B (media hides Products/Orders/Inventory), Phase 5.A (NGO hides Licenses/Inspections), Phase 5.B (SPO hides Custom Modules). |
| **P5** | Tenant onboarding allocator audit | `prisma/seed-onboarding-allocator.cjs` | 🟢 seeded but not multi-Industry verified | Verify Industry → Tier → Department/Agent resolution works for all 8 kept Industries (currently only accounting is verified end-to-end). Add test asserting each Industry produces a non-empty bundle at each tier. **~0.5 dev-day.** | All Industry certifications. |
| **P6** | Per-Industry isolation tests | `src/test/integration/golden-path-invariants.integration.spec.ts` | 🟢 Phase 8 baseline | Add 7 new spec files mirroring `phase8-tenant-isolation.spec.ts`, one per kept Industry (accounting already covered). Asserts no cross-tenant data leak in the catalog-resolve path. **~1 dev-day.** | All Industry certifications (gating). |

**Tier A subtotal: ~6 dev-days.** Without these the SIM-XX runners and workspace modules will produce flaky certifications.

#### Tier B — Must ship before specific Phase(s) (data-model prerequisites)

| # | Item | Surface | Status | Build | Blocks |
|---|---|---|---|---|---|
| **P4** | Cross-group package reference (T8) | `backend/prisma/schema.prisma` + `seed-business-composition.cjs` | 🔴 | Add `Package.parentPackageId String?` + FK to `Package.id`; resolver honors inheritance when resolving an Industry × Tier bundle. **~1 dev-day** (migration + resolver). | Phase 5.B (SPO inherits F&C agents). |
| **P7** | `Industry.isActive` flag + admin toggle | `backend/prisma/schema.prisma` + admin `/industries` | 🔴 | Migration adds `Industry.isActive Boolean @default(true)`. Admin `/industries` page gains an "Active" toggle column. Onboarding picker + Customer Industry dropdown filter on `isActive` (cross-references §7.1). **~1 dev-day.** | Phase 2.A (picker cut-down). |
| **P9** | **Package inheritance UI surface** (T8 admin side) | `frontend-admin/src/app/packages/[id]/edit/page.tsx` | 🔴 | When T8 ships, the package-edit composition editor must surface inherited departments/agents from `parentPackageId` as **read-only badges** with tooltip "Inherited from `{parentPackageSlug}`". Otherwise SPO admin users editing `spo-family-office-reporting` will think slots are missing. ~0.5 dev-day. Ship with T8 in Phase 5.B. | Phase 5.B admin UX. |

**Tier B subtotal: ~2.5 dev-days.** Each one is unblocker for a specific phase.

#### Tier C — Deferrable admin-UI improvements (post-v1, tracked for Stage 2)

These are **catalog-management UX gaps** that don't block any certification but should be tracked because they affect platform operators' daily use of the admin.

| # | Item | Surface | Why defer | Estimated |
|---|---|---|---|---|
| **P10** | **Package hard-delete with FK-safety check** | `/packages/[id]/page.tsx` | Today packages can only be soft-disabled via `status: DEPRECATED`. A hard-delete UI must (a) check zero resolved tenants reference this `Package.id`, (b) cascade-remove M2M links to DepartmentTemplate/AgentTemplate/Feature, (c) be SUPER_ADMIN-only. Low value today (no operator has asked). | ~1 dev-day |
| **P11** | **Tier hard-delete with billing-cascade warning** | `/tiers/page.tsx` | Tiers are billing-related; a hard-delete must (a) check zero tenants have `tierId === this.id`, (b) require SUPER_ADMIN override, (c) write an audit entry. Today only `isActive` toggle exists, which is correct behavior for billing. | ~1 dev-day |
| **P12** | **Package bulk-clone / version-bump** | `/packages/page.tsx` | Operators cloning an existing package to make a v2 today must re-pick every department/agent/feature. A "Clone → edit → save as new version" flow would save ~5 minutes per clone. Useful once we ship Stage 2 (per-tenant version pinning). | ~2 dev-days |
| **P13** | **Tenant Template category taxonomy overhaul** | `/departments-pool/page.tsx` | Today `DepartmentTemplate.category` is free-text (`general`, `startup`, `enterprise`, `ecommerce`, `healthcare`, `nonprofit`, …). The proposal adds 3 more industries; free-text drift will bite. Should become a controlled enum aligned with the 5 kept Groups. ~0.5 dev-day; can ship independently. | ~0.5 dev-day |

**Tier C subtotal: ~4.5 dev-days** (post-v1; logged as Stage 2 work).

#### Tier D — Non-engineering prerequisites

| # | Item | Owner | Build |
|---|---|---|---|
| **P8** | Marketing copy (one paragraph each for the 8 kept Industries describing value prop) | Marketing | ~1 day marketing. Output lives in `memory-bank-new/website/copy/`. |

#### Prerequisite effort summary

| Tier | Items | Effort | Ships with |
|---|---|---:|---|
| A — Shared infra | P1, P2, P3, P5, P6 | ~6 dev-days | Phase 2.A (P3, P5, P6); parallel to all phases (P1, P2) |
| B — Phase unblockers | P4, P7, P9 | ~2.5 dev-days | Phase 2.A (P7), Phase 5.B (P4 + P9) |
| C — Deferrable admin UX | P10–P13 | ~4.5 dev-days | Post-v1 / Stage 2 |
| D — Non-engineering | P8 | 1 marketing-day | Anytime before public launch |
| **Total v1 prerequisite effort** | **A + B** | **~8.5 dev-days** | Spans weeks 1–9 of the timeline |

> **Note on Tier C vs the proposal.** None of P10–P13 blocks any kept-Industry certification. They are tracked here as catalog-management debt so future operators (or Stage 2) can pick them up without re-discovering the gap.

---

## 8. Phase Plan

### 8.1 Effort breakdown by category (v1 vs deferred)

| Category | v1 dev-days | Deferred (Stage 2) | Notes |
|---|---:|---:|---|
| **Data seeding** (Tenant Templates + Packages + Project types) | ~8.5 | — | §7.0 table; pure `prisma/seed-*.cjs` work; one engineer. |
| **Workspace modules** (functional CRUD pages per Industry) | ~14 | — | Largest single category: retail 5d, tech 5d, NGO 3d, SPO 1.5d, FS branch 1d, misc ~1.5d. |
| **SIM-XX certification runners** (FE-first Playwright) | ~21 | — | 3-4 dev-days each × 7 runners (SIM-05 through SIM-11). |
| **Prerequisite Tier A** (shared infra) | ~6 | — | Workspace module builder (P1), SIM base class (P2), sub-industry filter (P3), allocator audit (P5), isolation tests (P6). |
| **Prerequisite Tier B** (phase unblockers) | ~2.5 | — | `Industry.isActive` (P7), Package inheritance FK (P4), Package inheritance UI (P9). |
| **FE picker cut-down** (Phase 2.A) | ~1.5 | — | Frontend only. |
| **Sidecar F&C tools** (Phase 2.B: credit-score, AML, KYC, e-sign) | ~1.5 | — | Already half-shipped per `pending-tasks.md §0`. |
| **Industry-specific Hermes tools** (per Phase, all deferrable) | — | ~3 | Optional; ship in Stage 2. |
| **Deferrable admin-UX improvements** (Tier C prerequisites) | — | ~4.5 | P10 (Package delete), P11 (Tier delete), P12 (Package clone/version-bump), P13 (DeptTemplate category enum). All logged in §7.9 Tier C. |
| **Marketing copy** | 1 marketing-day | — | Non-engineering; §7.9 P8. |
| **v1 total engineering** | **~56 dev-days** | — | One engineer ≈ 3 months; parallelizable across 2 engineers ≈ 6 weeks. |
| **Deferred to Stage 2** | — | **~7.5 dev-days** | Hermes tools + admin UX polish. |

### 8.2 Timeline

| Phase | Quarter | Industries certified | Cert runner | Tenants target | Effort |
|---|---|---|---|---|---|
| **Done** | (2026-Q2) | `accounting-audit-services` | SIM-04 ✅ | 1 (mali) | shipped |
| **2.A** Picker + sub-industry nav filter | 2026-Q3 wk 1 | (all 8 Groups still pickable; flag deprecated) | — | — | 1.5 dev-days |
| **2.B** `financial-services` certified | 2026-Q3 wk 2-4 | `financial-services` | SIM-05 🔴 | +2 | 8 dev-days |
| **3.A** `technology-digital-services` | 2026-Q3 wk 5-8 | B&T (tech) | SIM-06 🔴 | +3 | 10 dev-days |
| **3.B** `professional-business-services` | 2026-Q3 wk 9-10 | B&T (consulting/recruiting) | SIM-07 🔴 | +2 | 5 dev-days |
| **4.A** `retail-commerce-consumer` | 2026-Q4 wk 1-4 | Consumer (retail) | SIM-08 🔴 | +3 | 12 dev-days |
| **4.B** `media-communications-creative` | 2026-Q4 wk 5-6 | Consumer (media) | SIM-09 🔴 | +2 | 5 dev-days |
| **5.A** `nonprofit-international` | 2026-Q4 wk 7-8 | Public-Social (NGO) | SIM-10 🔴 | +1 | 6 dev-days |
| **5.B** `special-purpose-organizations` | 2026-Q4 wk 9 | Other | SIM-11 🔴 | +1 | 4 dev-days |
| **Cross-cutting infra (Tier A+B prereqs)** | (parallel, weeks 1-9) | — | — | — | 8.5 dev-days |

**Total remaining dev effort: ~56 dev-days** (one engineer ~3 months, or parallelizable across 2 engineers in ~6 weeks). Plus 1 marketing-day (P8) and ~7.5 dev-days deferred to Stage 2 (P10–P13 + Hermes tools).

### 8.3 Parallelization opportunities

- Phases 3.A + 3.B can run in parallel (different engineers, same B&T nav block).
- Phases 4.A + 4.B cannot fully parallelize — media (4.B) reuses 4.A's Campaigns/Content modules, so 4.A must land first.
- Phases 5.A + 5.B can run in parallel.
- Cross-cutting infra (§7.9) can run continuously across the 9 weeks.
- SIM-XX runners are serial with their parent Phase but a single engineer can write 2 in a week given the SIM-04 base class extraction (§7.9 row 2).

---

## 9. Open Questions / Risks

### 9.1 Naming & taxonomy

1. **"Phase 1" naming.** The current docs (`INDUSTRY-GROUPS-CONCEPT.md §9`) call Financial & Compliance "Phase 1" and Stage 2/3 docs (`IMPLEMENTATION-STAGE2-ACCELERATION.md`, `IMPLEMENTATION-STAGE3-MASTERY.md`) assume different phasing. This proposal uses **Phase N for vertical certification** and **Stage N for capability depth** (predictive models, RAG, agent fine-tuning). Recommend renaming internal "Phase 1" → "Vertical 1" or "Cohort 1" to avoid the collision. Confirm with stakeholders.

### 9.2 Picker & onboarding

2. **Picker cut-down scope.** Do we (a) hide cut Industries entirely from the public picker but keep them in DB for grandfathering, or (b) show them with a "Beta — not recommended" badge? §7.1 proposes (a). Confirm.
3. **Sub-industry nav filtering (T5).** Adding `subIndustries: string[]` to `RailItem` is needed only for the `consumer-commerce` group (retail ≠ media). Confirm we ship T5 in Phase 2.A even though only Phase 4 uses it.

### 9.3 Data model

4. **FS tier-slug inconsistency (T1).** `seed-financial-services-packages.cjs` uses `basic | business | professional | enterprise`; canonical is `starter | professional | enterprise`. Phase 2.B row T1 fixes this. Is there external consumption of FS tier slugs we need to deprecate gracefully? (Don't think so — no live FS tenant — but confirm with sales.)
5. **Cross-group package reference (T8).** Special-Purpose Organizations (Phase 5.B) reuses F&C accounting primitives via a new FK on `Package`. Alternative is a deploy-time feature flag. §7.8 row T8 proposes FK. Confirm.
6. **NGO `compliance-officer` vs F&C `Compliance Auditor` (T6/T7).** NGO and SPO both need a "compliance" role; F&C has `Compliance Auditor` (audit-bound). Proposal: NGO uses `operations-coordinator` + `+compliance_pack` feature flag (no dedicated role); SPO uses a separate generic `compliance-officer` registered against the `other` group. Confirm neither collides with the F&C registry.
7. **`Inventory` as Document vs specialized SKU entity (T4).** Cut criteria #2 forbids specialized primitives. Retail Inventory modeled as `Document{type:'product', stockLevel:number}` works today (Documents are generic) but means reporting queries must hit document-store, not a relational table. Acceptable for Phase 4.A? If reporting becomes a hotspot in Stage 2, we'd revisit.

### 9.4 Lifecycle

8. **Healthcare + Industrial groups.** They have tenant templates + customer fields + nav config + project-types JSON but zero packages. **Do we delete the seed files now to reduce cognitive load**, or leave them for future Stage 4+ resurrection? Recommend leave-but-flag (Option (b) in #2).
9. **`Industry.isActive` flag migration.** Required for picker cut-down (§7.1) and admin UI. Single Boolean column. Confirm migration approach: additive migration vs DB-data-only soft-delete (`status` enum already exists — `IndustryStatus @default(ACTIVE)`). Prefer additive migration since the existing `status` enum is admin-internal and not picker-aware.

### 9.5 Certification & tooling

10. **SIM-04 lessons applied.** Every SIM-XX runner must be FE-first; no API fallback (per `pending-tasks.md §0` "Honest disclosures"). Confirmed in every SIM-XX row above.
11. **SIM base class extraction.** §7.9 row P2 proposes factoring out a Playwright FE-first base class from SIM-04. Confirm before Phase 2.B; saves ~5 dev-days across SIM-05 through SIM-11.
12. **Marketing pipeline alignment.** Are the 8 picked Industries the same 8 our go-to-market plan targets? Cross-check with sales/marketing before commitment.
13. **Accounting-specific surface not regressed.** The customer `financialSubType` enum + `lifecycleStage` + subroute `/customers/:id/lifecycle` (SIM-04 commit `c9f099c3`) are F&C-group scoped, not Industry-scoped. Confirm F&C-only restriction is preserved when we add `financial-services` (which should also see them — yes, F&C-group scoped, verified in `industry-customer-field-definitions.ts` + `Customer.tsx` FE guard).

### 9.6 Admin UI + catalog management

14. **Package hard-delete safety (P10).** Today packages can only soft-delete via `status: DEPRECATED`. After the proposal lands, SPO admins will edit `Package.parentPackageId` chains (T8). An accidental hard-delete of a `parentPackageId` source would silently break all child packages. Confirm we ship P10 before exposing `Package.parentPackageId` to general admin use, OR document that hard-delete is admin-blocked at the DB level until P10 ships.
15. **Tier delete vs Tier `isActive` toggle (P11).** Same concern at lower severity — Tier is billing-related and `isActive` toggle is correct behavior. Confirm operators are not asking for hard-delete; if they are, prioritize P11.
16. **`DepartmentTemplate.category` free-text drift (P13).** Proposal adds 3 more industries (Phase 5.A nonprofit, Phase 5.B special-purpose, plus implicit NGO sub-type). Free-text categories will fragment. Recommend shipping P13 alongside Phase 5.A so the category enum aligns with the 5 kept Groups (`financial-compliance`, `business-technology`, `consumer-commerce`, `public-social`, `other`). Trivial ~0.5 dev-day, but easy to forget.
17. **Per-Industry SUPER_ADMIN editing without re-running seeders.** The proposal's seed scripts write baseline catalog data; SUPER_ADMIN can then edit per-Industry in the UI without re-running seeders (audit confirmed). Confirm this is the desired workflow: seeders = "v1 baseline", admin UI = "live editing". If not, we need a "Reset to seeder baseline" button per Industry (additional ~2 dev-days, logged for Stage 2).
18. **Industry edit creates package orphans.** If an admin edits an `Industry.slug` via `/industries` UI today, every `Package.industryId` FK still resolves but display strings + URL paths break across the tenant frontend. Two options: (a) lock `Industry.slug` from edit once any Package references it, (b) cascade-update all dependent rows. Recommend (a); ship with P7.

---

## 10. References

### Concept & history
- `neurecore/memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md` — original 8 Groups / 16 Industries concept.
- `neurecore/memory-bank-arc/industries/INDUSTRY-REQUIREMENTS-STAGED.md` — staged capability buildout.
- `neurecore/memory-bank-arc/industries/IMPLEMENTATION-STAGE1-FOUNDATION.md`, `…STAGE2-ACCELERATION.md`, `…STAGE3-MASTERY.md`.
- `neurecore/memory-bank-arc/industries/TIER-DEPLOYMENT-RUNBOOK.md` — Run-6 healthcare template seed; tier × industry matrix.
- `neurecore/memory-bank-arc/pools-taxonomy.md` — 6-pool schema (packages, departments, agents, etc.).

### Tenant-frontend surfaces (read by IconRail, Customer form, Workspace stubs)
- `neurecore/backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts` — all 16 industries wired.
- `neurecore/frontend-tenant/src/lib/industryNavigation.ts` — all 8 Groups nav config wired.
- `neurecore/frontend-tenant/src/components/layout/IconRail.tsx` — runtime rail builder; reads nav config.
- `neurecore/frontend-tenant/src/app/workspace/[feature]/page.tsx` — generic workspace stub route.
- `neurecore/frontend-tenant/src/components/industry/IndustryWorkspacePage.tsx` — functional workspace module.

### Backend seeders (write the catalog)
- `neurecore/backend/prisma/seed-industries-majors.cjs` — canonical 15 majors.
- `neurecore/backend/prisma/add-industry-accounting.cjs` — Major #16 (accounting).
- `neurecore/backend/prisma/backfill-industry-groups.cjs` — Industry.industryGroup backfill.
- `neurecore/backend/prisma/seed-accounting-packages.cjs` — 15 accounting packages (the only fully-built Industry).
- `neurecore/backend/prisma/seed-financial-services-packages.cjs` — 8 FS packages.
- `neurecore/backend/prisma/seed-healthcare-department-template.cjs` — healthcare Tenant Template (D21/D22 fix).
- `neurecore/backend/prisma/seed-business-technology-templates.cjs` — B&T Tenant Template (Run-6).
- `neurecore/backend/prisma/seed-industrial-infra-templates.cjs`, `seed-public-social-templates.cjs`, `seed-consumer-commerce-templates.cjs`, `seed-financial-compliance-templates.cjs` — Tenant Template seeders for the other 4 Groups.
- `neurecore/backend/prisma/seeds/industry-templates/*.ts` — stub package + template defs for 4 Groups.
- `neurecore/backend/prisma/seeds/project-types/*.json` — 16 per-Industry project-type definitions.
- `neurecore/backend/prisma/seeds/question-packs/*.json` — 20 question-pack files reused across package types.
- `neurecore/backend/prisma/seed-onboarding-allocator.cjs` — Industry → Tier → Department/Agent resolution.
- `neurecore/backend/prisma/seed-package-catalogue.cjs` — Tier → Package composition.
- `neurecore/backend/prisma/seed-business-composition.cjs` — FUNCTIONAL + INDUSTRY bundle aggregator.

### Admin-frontend surfaces (audit 2026-07-31, §3.7)
- `neurecore/frontend-admin/src/app/industries/page.tsx` — Industry CRUD.
- `neurecore/frontend-admin/src/app/packages/page.tsx` + `/new` + `/[id]` + `/[id]/edit` — Package CRUD with composition editor.
- `neurecore/frontend-admin/src/app/tiers/page.tsx` — Tier CRUD.
- `neurecore/frontend-admin/src/app/departments-pool/page.tsx` — Tenant Template CRUD + deploy-to-tenant modal.
- `neurecore/frontend-admin/src/app/agents-pool/page.tsx` — Agent Template CRUD + deploy-to-tenant.
- `neurecore/frontend-admin/src/app/dept-templates/page.tsx` — redirect stub → `/departments-pool`.
- `neurecore/frontend-admin/src/app/project-types/` — Project Type CRUD + versions + packs.
- `neurecore/frontend-admin/src/app/question-packs/` — Question Pack CRUD.
- `neurecore/frontend-admin/src/app/features/` — Feature CRUD.
- `neurecore/frontend-admin/src/app/tenants/[id]/industry/` — tenant Industry reassignment.
- `neurecore/frontend-admin/src/app/tenants/[id]/page.tsx` — tenant detail (read-only tier display).
- `neurecore/frontend-admin/src/services/{packages,tiersPool,industriesPool,deptTemplates,agentsPool,projectTypes,questionPacks,featuresPool}.service.ts` — admin → backend HTTP clients.

### Certification & operations
- `neurecore/simulations/SIM-04-Accounting-Project-Full-Flow/` — FE-first runner template (12 stages).
- `neurecore/memory-bank-arc/pending-tasks.md` — NC-ACCT-IMP-1, SIM-04, NC-SIM04-001/002/005 closure notes.
- `neurecore/memory-bank-arc/future-plans.md` — Stage 2/3 capability roadmap (orthogonal to this proposal).

### Backend module hotspots
- `neurecore/backend/src/modules/approval-chains/addons/financial-approval.addon.ts` — F&C 3-stage approval chain.
- `neurecore/backend/src/modules/widgets/fc-widgets.ts` — F&C KPI widgets.
- `neurecore/backend/src/modules/notifications/industry-notification-templates.ts` — per-Industry notification copy registry.
- `neurecore/backend/src/modules/workflows/industry-workflow-definitions.ts` — `CUSTOMER_LIFECYCLE` + `PROJECT_STAGE_TEMPLATE` per Industry.
- `neurecore/backend/prisma/schema.prisma` — `Package` (line 4169), `Industry` (line 4117), `DepartmentTemplate` (line 1346), `AgentTemplate` (line 900), `TierAgentPool` (line 474), `TierChangeRequest` (line 449).

---

**End of proposal.** Reviewers: please flag any kept Industry whose legal exposure or specialized primitives were underestimated.