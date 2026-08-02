# Kept-Industry Package & Template Catalog

**Status:** Working catalog (builds on the proposal — see §11 References)
**Author:** Kilo
**Date:** 2026-07-31
**Audience:** Engineering leads planning the build (Phases 2.B → 5.B), SUPER_ADMIN configuring tenants post-onboarding, and the marketing team writing Industry value-prop copy.

---

## Table of Contents

1. [Purpose & how to read this document](#1-purpose--how-to-read-this-document)
2. [Document conventions](#2-document-conventions)
3. [Industry index](#3-industry-index)
4. [`accounting-audit-services`](#4-accounting-audit-services) ✅ Live
5. [`financial-services`](#5-financial-services) 🟡 Ready to certify
6. [`technology-digital-services`](#6-technology-digital-services) 🟡 Mostly built
7. [`professional-business-services`](#7-professional-business-services) 🟡 Stub only
8. [`retail-commerce-consumer`](#8-retail-commerce-consumer) 🔴 Build required
9. [`media-communications-creative`](#9-media-communications-creative) 🔴 Build required
10. [`nonprofit-international`](#10-nonprofit-international) 🔴 Build required
11. [`special-purpose-organizations`](#11-special-purpose-organizations) 🔴 Build required
12. [Cross-Industry summary tables](#12-cross-industry-summary-tables)
13. [References](#13-references)

---

## 1. Purpose & how to read this document

The proposal doc (`PRUNED-TAXONOMY-PROPOSAL.md`) defines **what** the 8 kept Industries are and **when** each ships. This document is the **reference catalog** answering:

- For a given Industry: which Departments exist on Day 1, what each Department does, which AI Agents populate them, what each Agent does
- For a given Industry: which Packages a tenant gets at each Tier, what's inside each Package, what features light up
- For a given Industry: which Project Types are available, what workflow stages and approval chains each uses
- For a given Industry: which workspace modules appear in the IconRail, what each module's data model is

Each Industry section is **self-contained** — you can scroll to one and have everything you need without flipping back. Cross-Industry summaries live in §12.

**Status legend per Industry:**
- ✅ **Live** — Industry has live tenants and certified SIM runner (today: accounting only).
- 🟡 **Ready to certify / Mostly built** — Seeders exist; needs SIM runner + possibly small fixes.
- 🔴 **Build required** — No Tenant Template yet, no packages seeded, or both.

---

## 2. Document conventions

| Notation | Meaning |
|---|---|
| `slug` | URL/DB key (lowercase, hyphenated, matches `^[a-z0-9-]+$`) |
| `tier` | `starter` \| `professional` \| `enterprise` (canonical since `seed-package-catalogue.cjs`; FS seeder still uses legacy `basic\|business\|professional\|enterprise` — proposal §7.2 T1 fixes this) |
| `scope` | `FUNCTIONAL` (reusable across Industries) \| `VERTICAL` (Industry-specific) |
| `type` (department) | `EXECUTIVE` \| `CORE` \| `FUNCTIONAL` (per `DepartmentTemplate.structure` `type` field) |
| `parent` (department) | Slot-slug this department nests under, or `—` for top-level |
| `agent` | The `AgentTemplate.slug` that is pre-selected for this Department on Day 1; slot may have multiple agents |
| 🟢 / 🟡 / 🔴 | Per-row shipping status: shipped / partial / to-build |
| `[Feature+]` | A "+"-prefixed feature means it stacks on top of the features inherited from the FUNCTIONAL package at the same tier (e.g. `+api_access` means this VERTICAL package adds API access the starter FUNCTIONAL package didn't include) |

---

## 3. Industry index

| # | Industry | Group | Status | Tenant template | Packages | Project types | Cert runner |
|---|---|---|---|---:|---:|---:|---|
| 4 | `accounting-audit-services` | financial-compliance | ✅ Live | ✅ 1 (12 depts / 14 agents) | ✅ 15 | ✅ 1 | SIM-04 ✅ |
| 5 | `financial-services` | financial-compliance | 🟡 Ready | 🔴 1 to build | ✅ 8 (need T1 fix) | ✅ 1 + 3 to add | SIM-05 🔴 |
| 6 | `technology-digital-services` | business-technology | 🟡 Mostly | ✅ Run-6 | 🟡 8 stubs to wire | ✅ 1 + 2 to add | SIM-06 🔴 |
| 7 | `professional-business-services` | business-technology | 🟡 Stub | 🔴 1 to build | 🟡 5 stubs (drop `professional-legal`) | ✅ 1 + 2 to add | SIM-07 🔴 |
| 8 | `retail-commerce-consumer` | consumer-commerce | 🔴 Build | 🔴 1 to build | 🟡 5 stubs + 3 to add | ✅ 1 + 3 to add | SIM-08 🔴 |
| 9 | `media-communications-creative` | consumer-commerce | 🔴 Build | 🔴 1 to build | 🟡 2 stubs + 3 to add | ✅ 1 + 3 to add | SIM-09 🔴 |
| 10 | `nonprofit-international` | public-social | 🔴 Build | 🔴 1 to build | 🔴 5 to build | ✅ 1 + 3 to add | SIM-10 🔴 |
| 11 | `special-purpose-organizations` | other | 🔴 Build | 🔴 1 to build | 🔴 3 to build (T8 cross-ref) | ✅ 1 + 2 to add | SIM-11 🔴 |

---

## 4. `accounting-audit-services`

**Status:** ✅ **Live.** Tenant `mali@live.com`. SIM-04 PASS.
**Source seeders:** `prisma/seed-accounting-packages.cjs`, `prisma/add-industry-accounting.cjs`, `seeds/project-types/accounting-audit-services.json`, `seeds/industry-templates/financial-compliance-templates.ts`.
**Cert runner:** `simulations/SIM-04-Accounting-Project-Full-Flow/` (12 FE-first stages).

### 4.1 Tenant Template

**DepartmentTemplate slug:** (the 12-department accounting template is seeded directly via `seed-accounting-packages.cjs` agents; no separate `DepartmentTemplate` row exists — agents are linked to packages, not to a template). When onboarding, `seed-onboarding-allocator.cjs` creates 12 `Department` rows + 14 `Agent` rows for the tenant.

| Slot | Department name | Type | Day-1 agent |
|---:|---|---|---|
| 01 | Executive Office | EXECUTIVE | Executive Summary Generator |
| 02 | Administration | CORE | Document Generator, Jira Workflow Steward |
| 03 | Accounting | CORE | Bookkeeper & Controller, Cost Accountant, GL Accountant, AP Specialist, AR Specialist, Fixed Assets Accountant, Intercompany Accounting Specialist, Finance Administrator |
| 04 | Audit Practice | CORE | Audit Coordinator, Internal Auditor, Integrity Auditor |
| 05 | Tax Practice | CORE | Tax Preparation Specialist, Tax Advisory Specialist |
| 06 | Risk Compliance | CORE | Compliance Auditor, Compliance Officer, Legal Compliance Checker |
| 07 | Quality Assurance | FUNCTIONAL | Compliance QA Specialist |
| 08 | Client Services | FUNCTIONAL | Client Relationship Manager |
| 09 | Marketing & Business Development | FUNCTIONAL | Business Development Specialist |
| 10 | Payroll Services | FUNCTIONAL | Payroll Administrator |
| 11 | Forensic Audit | FUNCTIONAL | Forensic Audit Specialist |
| 12 | Multi-Office Operations | FUNCTIONAL | Operations Coordinator |

### 4.2 Packages (15)

| # | Package slug | Tier | Scope | Departments | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `firm-business-management` | starter | FUNCTIONAL | Accounting, Administration | Bookkeeper & Controller, Finance Tracker, Cost Accountant | `ms365_integration`, `audit_logs`, `sso` |
| 2 | `firm-office-administration` | starter | FUNCTIONAL | Administration | Jira Workflow Steward, Document Generator, Executive Summary Generator | `ms365_integration`, `workflow_automation`, `audit_logs` |
| 3 | `firm-financial-management` | starter | FUNCTIONAL | Accounting | Bookkeeper & Controller, Cost Accountant, AR Specialist, Finance Tracker | `ms365_integration`, `erp_integration`, `two_factor`, `audit_logs` |
| 4 | `firm-compliance-management` | starter | FUNCTIONAL | Risk Compliance, Legal | Compliance Auditor, Compliance Officer, Legal Compliance Checker | `audit_logs`, `sso`, `workflow_automation` |
| 5 | `accounting-operations` | professional | VERTICAL | Accounting | GL Accountant, AP Specialist, AR Specialist, Fixed Assets Accountant, Intercompany Accounting Specialist, Bookkeeper & Controller, Finance Administrator | `ms365_integration`, `google_workspace`, `erp_integration`, `audit_logs`, `workflow_automation`, `sso`, `two_factor` |
| 6 | `audit-practice-management` | professional | VERTICAL | Accounting, Risk Compliance | Audit Coordinator, Internal Auditor, Integrity Auditor, Compliance Auditor, Quality Auditor, Compliance QA Specialist | `ms365_integration`, `audit_logs`, `sso`, `custom_reports`, `workflow_automation` |
| 7 | `tax-advisory-services` | professional | VERTICAL | Accounting, Legal | Tax Preparation Specialist, Tax Advisory Specialist | `ms365_integration`, `audit_logs`, `workflow_automation` |
| 8 | `payroll-services` | professional | VERTICAL | Accounting, Administration | Payroll Administrator, Cost Accountant | `erp_integration`, `two_factor`, `audit_logs` |
| 9 | `accounting-firm-management` | professional | VERTICAL | Executive Office, Administration, Accounting | Executive Summary Generator, Finance Administrator, Operations Coordinator | `ms365_integration`, `google_workspace`, `custom_reports`, `audit_logs`, `sso` |
| 10 | `multi-office-operations` | professional | FUNCTIONAL | Multi-Office Operations | Operations Coordinator | `ms365_integration`, `google_workspace`, `sso`, `workflow_automation` |
| 11 | `bookkeeping-services` | professional | VERTICAL | Accounting | Bookkeeper & Controller, Finance Tracker, AR Specialist | `ms365_integration`, `erp_integration`, `workflow_automation` |
| 12 | `forensic-audit-services` | enterprise | VERTICAL | Forensic Audit, Risk Compliance | Forensic Audit Specialist, Compliance Auditor, Integrity Auditor | `audit_logs`, `custom_reports`, `sso`, `two_factor` |
| 13 | `tax-specialist-services` | enterprise | VERTICAL | Accounting, Tax Practice | Tax Preparation Specialist, Tax Advisory Specialist, GL Accountant | `custom_reports`, `audit_logs`, `workflow_automation`, `two_factor` |
| 14 | `enterprise-compliance` | enterprise | VERTICAL | Risk Compliance, Legal | Compliance Auditor, Compliance Officer, Legal Compliance Checker, Quality Auditor | `audit_logs`, `sso`, `two_factor`, `custom_reports`, `workflow_automation` |
| 15 | `quality-management` | enterprise | VERTICAL | Quality Assurance, Risk Compliance | Compliance QA Specialist, Quality Auditor | `custom_reports`, `audit_logs`, `workflow_automation` |

### 4.3 Project Types (1)

| Project type | Classification | Stage template | Approval template |
|---|---|---|---|
| `audit-engagement` | CLIENT_ENGAGEMENT | Planning (14d) → Fieldwork (45d) → Review (14d) → Reporting (10d) → Issuance (5d) | `audit-signoff`: 4-step chain — Audit Junior (PREPARER, LOW risk) → Audit Senior (REVIEW, LOW/MEDIUM, blockedByPriorStep) → Audit Manager (MANAGER) → Audit Partner (PARTNER) |

### 4.4 Workspace modules

(Inherited from F&C-group `industryNavigation.ts:62` — `INDUSTRY_NAV_CONFIGS['financial-compliance']`)

| Module id | Label | Route | Status | Purpose |
|---|---|---|:-:|---|
| `engagements` | Engagements | `/workspace/engagements` | 🟢 functional | Service delivery pipeline, billable hours, retainer status |
| `loans` | Loans | `/workspace/loans` | 🟢 functional | Active loans, payment schedule, compliance status |
| `portfolios` | Portfolios | `/workspace/portfolios` | 🟢 functional | Holdings dashboard, allocation view, performance tracking |
| `audits` | Audits | `/workspace/audits` | 🟢 functional | Audit planning, fieldwork, reporting, follow-up tracking |
| `tax` | Tax | `/workspace/tax` | 🟢 functional | Tax filing calendar, return status, e-signature workflow |
| `payroll` | Payroll | `/workspace/payroll` | 🟢 functional | Payroll processing, tax withholding, employee compensation |
| `compliance` | Compliance | `/workspace/compliance` | 🟢 functional | Compliance frameworks, controls, evidence collection, audit trails |
| `risk` | Risk | `/workspace/risk` | 🟢 functional | Portfolio risk metrics, concentration alerts, correlation analysis |

**Customers label/icon override:** "Clients & Accounts" / `Landmark` icon (per `industryNavigation.ts:66`).

### 4.5 Customer form (F&C-group special)

Per `Customer.tsx` FE guard + `industry-customer-field-definitions.ts`:
- First-class columns populated: `financialSubType`, `lifecycleStage`, `kycStatus`, `riskRating`, `taxId` (encrypted), `kycExpiresAt`.
- For accounting: `financialSubType === 'ACCOUNTING_AUDIT'` only.
- Subroute `POST /customers/:id/lifecycle` records lifecycle events (SIM-04 commit `c9f099c3`).
- Dynamic fields from `industry-customer-field-definitions.ts:99` (accounting block).

### 4.6 Known open items

None blocking. Per `pending-tasks.md §0`: NC-ACCT-IMP-1 fully complete; NC-SIM04-002 (FE modal z-index) and NC-SIM04-005 (chat tool binding for natural language) closed-via-frontend-fix and tracked separately.

---

## 5. `financial-services`

**Status:** 🟡 **Ready to certify.** 8 packages seeded; no Tenant Template; needs T1 (tier-slug fix), 1 template build, 3 project types, workspace branching, SIM-05, sidecar tools.
**Source seeders:** `prisma/seed-financial-services-packages.cjs` (packages), `seeds/industry-templates/financial-compliance-templates.ts` (lifecycle), `seeds/project-types/financial-services.json` (1 type).
**Target cert runner:** SIM-05 (12 stages).

### 5.1 Tenant Template (build: `seed-financial-services-department-template.cjs`)

```
DepartmentTemplate slug: financial-services-bank
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ──────────────────────────────
  01    Bank Manager / Firm Principal  EXECUTIVE   —       firm-principal
  02    Client Onboarding             CORE        —       kyc-officer
  03    Front Office / Teller Ops     CORE        —       client-relationship-mgr
  04    Lending Operations            CORE        —       loan-officer
  05    Compliance & Risk             CORE        —       compliance-analyst
  06    AML / BSA Specialist          FUNCTIONAL  05      aml-analyst
  07    Wealth Advisor                FUNCTIONAL  03      wealth-advisor
  08    Operations Coordinator        FUNCTIONAL  —       operations-coordinator
```

**Slot-by-slot responsibilities** (for the seeder's `description` field):

| Slot | Department | One-line responsibility |
|---:|---|---|
| 01 | Bank Manager / Firm Principal | Oversees firm-wide operations, regulatory standing, and strategic direction. Single accountable owner for SAFE/BSA audits. |
| 02 | Client Onboarding | Performs KYC intake, beneficial-ownership verification, sanctions screening, and risk rating at account opening. |
| 03 | Front Office / Teller Ops | Day-to-day client servicing: deposits, withdrawals, transfers, statement reconciliation, dispute intake. |
| 04 | Lending Operations | Loan origination, underwriting, documentation, servicing, and collections. |
| 05 | Compliance & Risk | Policy management, regulatory reporting (SAR/CTR), internal audit coordination, model risk oversight. |
| 06 | AML / BSA Specialist | Transaction monitoring, alert triage, suspicious activity investigation, 314(a) requests. Nests under Compliance. |
| 07 | Wealth Advisor | Portfolio construction, client suitability, rebalancing proposals, performance reporting. Nests under Front Office. |
| 08 | Operations Coordinator | Cross-department scheduling, document routing, vendor management, workflow SLAs. |

**Per-slot default agent role descriptions** (for `AgentTemplate.description`):

| Agent | Default role prompt |
|---|---|
| `firm-principal` | Senior principal responsible for firm-wide governance. Reviews escalation queues, signs off on regulatory filings, and approves high-risk client onboarding. |
| `kyc-officer` | Performs KYC intake: collects beneficial-ownership documents, runs sanctions/PEP screening, sets risk rating, and queues compliance review. |
| `client-relationship-mgr` | Day-to-day client service: handles service requests, coordinates with operations, prepares account reviews. |
| `loan-officer` | Loan origination specialist: structures credit memos, runs underwriting, prepares approval packages, monitors covenants. |
| `compliance-analyst` | Compliance generalist: reviews marketing materials, monitors transactions against policy, prepares regulatory reports. |
| `aml-analyst` | AML/BSA specialist: investigates monitoring alerts, drafts SAR narratives, escalates to compliance officer when threshold exceeded. |
| `wealth-advisor` | Portfolio construction: proposes allocations matching client suitability profile, prepares quarterly performance reports. |
| `operations-coordinator` | Operational hub: routes documents, tracks workflow SLAs, escalates blockers, coordinates vendor interactions. |

### 5.2 Packages (8 — after T1 tier-slug fix)

**T1 first:** rewrite `seed-financial-services-packages.cjs` to use canonical `starter | professional | enterprise` instead of `basic | business | professional | enterprise`.

| # | Package slug | Tier | Scope | Departments (slots from §5.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `fs-foundation` | starter | FUNCTIONAL | 01, 02, 08 | firm-principal, kyc-officer, client-relationship-mgr, operations-coordinator | `workflow_automation`, `audit_logs`, `sso`, `two_factor` |
| 2 | `fs-client-onboarding-kyc` | professional | VERTICAL | 02, 05 | kyc-officer, compliance-analyst, aml-analyst | `[Feature+]` `kyc_pack`, `aml_screening`, `document_templates`, `crm_integration` |
| 3 | `fs-wealth-management` | professional | VERTICAL | 07 | wealth-advisor, client-relationship-mgr | `[Feature+]` `portfolio_pack`, `custom_reports` |
| 4 | `fs-lending` | professional | VERTICAL | 04 | loan-officer, compliance-analyst | `[Feature+]` `lending_pack`, `document_templates`, `custom_reports` |
| 5 | `fs-banking-core` | enterprise | VERTICAL | all 8 | all 8 | `[Feature+]` `api_access`, `webhooks`, `two_factor`, `erp_integration`, `custom_reports` |
| 6 | `fs-insurance-claims` | enterprise | VERTICAL | 05, 06 | aml-analyst, compliance-analyst | `[Feature+]` `claims_pack`, `document_templates` |
| 7 | `fs-investment-management` | enterprise | VERTICAL | 07, 04 | wealth-advisor, loan-officer | `[Feature+]` `portfolio_pack`, `lending_pack`, `custom_reports` |
| 8 | `fs-enterprise-platform` | enterprise | VERTICAL | all 8 | all 8 | `[Feature+]` `api_access`, `webhooks`, `sso`, `two_factor`, `erp_integration`, `ms365_integration`, `custom_reports` |

**Package-by-package value proposition** (for marketing copy / sales enablement):

| Package | One-line value | Target customer |
|---|---|---|
| `fs-foundation` | "Stand up a regulated entity's back office in a day." | Seed-stage FinTech with 1-5 employees preparing for SOC review. |
| `fs-client-onboarding-kyc` | "Automated KYC from intake to risk-rating, with a human review queue." | Any FinTech onboarding >50 clients/quarter. |
| `fs-wealth-management` | "RIA-grade portfolio construction with automated suitability checks." | Independent RIAs, family offices (also SPO-coupled). |
| `fs-lending` | "Loan origination + underwriting + covenant tracking in one workspace." | Specialty lenders, CDFIs, microfinance. |
| `fs-banking-core` | "Core banking + compliance + risk in a single bundle." | Community banks, challenger banks. |
| `fs-insurance-claims` | "Claims triage + investigation + regulatory filing workflow." | InsurTech startups, MGAs. |
| `fs-investment-management` | "Combined portfolio + lending for diversified wealth platforms." | Robo-advisors adding lending, private credit funds. |
| `fs-enterprise-platform` | "All features on, white-label ready." | Enterprise-tier tenants, M&A rollups. |

### 5.3 Project Types (1 today + 3 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `client-onboarding` (existing) | CLIENT_ENGAGEMENT | Prospect → KYC Intake → Document Review → Risk Rating → Approval → Active (6 stages) | Standard 3-stage (KYC Officer → Compliance Analyst → Firm Principal) |
| 2 | `account-opening` (to add) | CLIENT_ENGAGEMENT | Application → Document Collection → Verification → Activation → Maintenance (5 stages) | 2-stage (KYC Officer → Firm Principal) |
| 3 | `loan-origination` (to add) | CLIENT_ENGAGEMENT | Application → Underwriting → Credit Memo → Approval → Documentation → Funding → Servicing (7 stages) | 3-stage (Loan Officer → Compliance Analyst → Firm Principal) with risk-tier gating |
| 4 | `wealth-review` (to add) | CLIENT_ENGAGEMENT | Suitability Review → Allocation Proposal → Client Approval → Implementation → Quarterly Rebalancing (5 stages, recurring) | 2-stage (Wealth Advisor → Compliance Analyst) |

### 5.4 Workspace modules

Same 8 modules as accounting (F&C-group shared); workspace component must branch on `tenant.industry` to render meaningful KPIs (per proposal §7.2 row "FE: workspace extras"). For `financial-services`:
- `loans` — show portfolio yield + delinquency rate, not tax-bill rate.
- `portfolios` — show AUM + asset allocation, not accounting GL.
- `audits` — show regulatory-exam prep status, not accounting-audit engagement.
- `compliance` — show KYC backlog + SAR count, not accounting-controls coverage.
- `risk` — show VaR + concentration, not client-risk-rating distribution.

### 5.5 Customer form (F&C-group special)

Same first-class columns as accounting; `financialSubType` enum values used: `BANKING`, `WEALTH_MANAGEMENT`, `INVESTMENT`, `FINTECH`. Dynamic fields from `industry-customer-field-definitions.ts:48` (FS block).

### 5.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 5.6.1 | T1 tier-slug rewrite (`basic\|business\|professional\|enterprise` → `starter\|professional\|enterprise`) | Eng | SIM-05 |
| 5.6.2 | Tenant Template seeder | Eng | Onboarding allocator test (P5) |
| 5.6.3 | 3 new project types | Eng | SIM-05 stages |
| 5.6.4 | Workspace component branch (loans/portfolios/audits/compliance/risk) | FE | UI verification |
| 5.6.5 | Approval addon verify for `financial-services` sub-industry | Eng | Onboarding E2E |
| 5.6.6 | Sidecar tools (credit-score, AML, KYC, e-sign) wired to FS workflows | Eng | SIM-05 financial flows |
| 5.6.7 | SIM-05 runner (12 FE-first stages) | QA | Cert |

---

## 6. `technology-digital-services`

**Status:** 🟡 **Mostly built.** Tenant Template applied in Run-6 (verify prod state); 8 packages stub-defined but not yet wired into `seed-business-composition.cjs`; needs 2 project types + 4 workspace modules + SIM-06.
**Source seeders:** `prisma/seed-business-technology-templates.cjs` (template), `seeds/industry-templates/business-technology-packages.ts` (stub defs), `seeds/industry-templates/business-technology-templates.ts` (lifecycle), `seeds/project-types/technology-digital-services.json`.
**Target cert runner:** SIM-06 (10 stages).

### 6.1 Tenant Template

```
DepartmentTemplate slug: tech-digital-services-it
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ─────────────────────────
  01    Managing Director / Partner   EXECUTIVE   —       tech-delivery-lead
  02    Engineering                   CORE        —       technical-lead
  03    Product                       CORE        —       product-manager
  04    DevOps                        CORE        —       devops-specialist
  05    Quality Assurance             CORE        —       qa-engineer
  06    Client Success                FUNCTIONAL  —       client-success-manager
  07    Operations Coordinator        FUNCTIONAL  —       operations-coordinator
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Managing Director / Partner | Owns P&L, signs off on new client engagements, partners with sales on enterprise deals. |
| 02 | Engineering | Technical delivery: architecture, code review, technical risk assessment. |
| 03 | Product | Roadmap, requirements, user research, prioritization. |
| 04 | DevOps | CI/CD, infrastructure, observability, incident response. |
| 05 | Quality Assurance | Test strategy, automation, regression, release gating. |
| 06 | Client Success | Post-sale relationship: SLA monitoring, renewals, expansion. |
| 07 | Operations Coordinator | Cross-team coordination, vendor management, billing ops. |

| Agent | Default role prompt |
|---|---|
| `tech-delivery-lead` | Senior delivery lead: owns project plan, escalates risks, runs weekly steering. |
| `technical-lead` | Engineering authority: reviews architecture, signs off on technical decisions, mentors engineers. |
| `product-manager` | Product owner: writes specs, prioritizes backlog, validates outcomes. |
| `devops-specialist` | Infrastructure + reliability: owns CI/CD, on-call rotation, capacity planning. |
| `qa-engineer` | Quality gate: designs test plans, automates regressions, blocks releases on failure. |
| `client-success-manager` | Post-sale success: monitors SLA, drives renewal, identifies expansion. |
| `operations-coordinator` | Operational backbone: tracks vendor SLAs, coordinates cross-team deliverables. |

### 6.2 Packages (8 stubs to wire)

| # | Package slug | Tier | Scope | Departments (slots from §6.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `it-project-delivery` | starter | FUNCTIONAL | 01, 02, 07 | tech-delivery-lead, technical-lead, qa-engineer, operations-coordinator | `workflow_automation`, `audit_logs`, `sso` |
| 2 | `it-client-success` | starter | FUNCTIONAL | 06 | client-success-manager, tech-delivery-lead | `crm_integration`, `workflow_automation`, `two_factor` |
| 3 | `it-devops-infrastructure` | professional | FUNCTIONAL | 04, 02 | devops-specialist, technical-lead, qa-engineer | `[Feature+]` `api_access`, `webhooks`, `custom_reports` |
| 4 | `it-product-development` | professional | FUNCTIONAL | 03, 02, 05 | technical-lead, tech-delivery-lead, qa-engineer, devops-specialist | `[Feature+]` `api_access`, `webhooks`, `audit_logs` |
| 5 | `it-quality-engineering` | professional | FUNCTIONAL | 05, 02 | qa-engineer, technical-lead | `[Feature+]` `api_access`, `custom_reports` |
| 6 | `it-saas-operations` | enterprise | VERTICAL | all 7 | all 7 | `[Feature+]` `api_access`, `webhooks`, `sso`, `two_factor`, `ms365_integration`, `google_workspace`, `custom_reports` |
| 7 | `it-managed-services` | enterprise | VERTICAL | 06, 04 | client-success-manager, devops-specialist, qa-engineer | `[Feature+]` `crm_integration`, `api_access`, `webhooks`, `two_factor` |
| 8 | `it-enterprise-platform` | enterprise | VERTICAL | all 7 | all 7 | `[Feature+]` `ms365_integration`, `google_workspace`, `erp_integration`, `custom_reports` |

**Value proposition per package** (for sales):

| Package | One-line value | Target customer |
|---|---|---|
| `it-project-delivery` | "Run client engagements from kickoff to close." | Any IT services firm, digital agency. |
| `it-client-success` | "Ticket queue + SLA tracking + renewal playbook." | SaaS support orgs, MSPs. |
| `it-devops-infrastructure` | "Incident response + infrastructure as code, audit-logged." | DevOps consultancies, SRE teams. |
| `it-product-development` | "Spec-to-launch lifecycle with engineering rigor." | Product studios, internal product teams. |
| `it-quality-engineering` | "Test strategy + automation gates for every release." | QA consulting, regulated software. |
| `it-saas-operations` | "SaaS operations: customer success + DevOps + engineering." | SaaS vendors <50 employees. |
| `it-managed-services` | "MSP toolkit: client onboarding + infrastructure + QA." | Managed service providers. |
| `it-enterprise-platform` | "All features on, all integrations on." | Enterprise tenants, multi-brand IT firms. |

### 6.3 Project Types (1 today + 2 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `it-project-delivery` (existing) | CLIENT_ENGAGEMENT | Discovery → Design → Build → Test → Deploy → Hypercare (6 stages) | Standard 3-stage (Tech PM → Technical Lead → MD/Partner) |
| 2 | `product-launch` (to add) | INTERNAL_INITIATIVE | Concept → Spec → Build → Beta → GA → Post-Launch Review (6 stages) | 2-stage (Product Manager → Technical Lead) |
| 3 | `support-escalation` (to add) | CLIENT_ENGAGEMENT | Ticket Intake → Triage → Investigation → Resolution → Post-Mortem (5 stages, recurring) | 2-stage (Support Engineer → QA Engineer) with severity-based escalation |

### 6.4 Workspace modules (4 to build)

From `industryNavigation.ts:108` — `business-technology` group nav config (shared with `professional-business-services`):

| Module id | Label | Route | Data model |
|---|---|---|---|
| `tickets` | Tickets | `/workspace/tickets` | `Ticket{id, title, description, severity: enum(LOW\|MEDIUM\|HIGH\|CRITICAL), slaDueAt, status, assignedAgentId, customerId}` — CRUD + SLA counter |
| `releases` | Releases | `/workspace/releases` | `Release{id, name, version, targetDate, status, features: ReleaseFeature[], rollbackPlan}` — milestone tracker |
| `contracts` | Contracts | `/workspace/contracts` | `Contract{id, customerId, startDate, endDate, slaTerms, billingSchedule, valueAmount}` — template + expiry |
| `knowledge` | Knowledge Base | `/workspace/knowledge` | `Article{id, title, contentMarkdown, category, ownerAgentId, lastUpdatedAt}` — markdown wiki |

**Customers label/icon override:** "Clients" / `UserCircle` icon (per `industryNavigation.ts:111`).

### 6.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:242` (tech block):
- `techStack`: array of strings (e.g. `["React", "Node.js", "PostgreSQL"]`).
- `contractType`: enum `TIME_AND_MATERIALS | FIXED_FEE | RETAINER | MANAGED_SERVICE`.
- `monthlyRecurringRevenue`: decimal (auto-calculated from active contracts).
- `serviceTier`: enum `BRONZE | SILVER | GOLD | PLATINUM`.

### 6.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 6.6.1 | Verify Run-6 actually applied `tech-digital-services-it` to prod (`SELECT * FROM department_templates WHERE slug = 'tech-digital-services-it';`) | Ops | Onboarding E2E |
| 6.6.2 | Wire 8 stub packages into `seed-business-composition.cjs` | Eng | Onboarding allocator (P5) |
| 6.6.3 | 2 new project types | Eng | SIM-06 |
| 6.6.4 | 4 functional workspace modules (Tickets, Releases, Contracts, Knowledge Base) | FE | SIM-06 workspace E2E |
| 6.6.5 | SIM-06 runner (10 FE-first stages) | QA | Cert |

---

## 7. `professional-business-services`

**Status:** 🟡 **Stub only.** 5 packages stub-defined (including `professional-legal` to be **dropped** — T3); no Tenant Template; needs 1 template build + cleaned package list + 2 project types + SIM-07. **Reuses all 4 workspace modules from Phase 3.A with zero new build.**
**Source seeders:** `seeds/industry-templates/business-technology-packages.ts` (5 stubs), `seeds/project-types/professional-business-services.json`.
**Target cert runner:** SIM-07 (10 stages).

### 7.1 Tenant Template (build: `seed-professional-business-department-template.cjs`)

```
DepartmentTemplate slug: professional-business-services-firm
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ────────────────────────────────
  01    Managing Partner / Principal  EXECUTIVE   —       engagement-manager
  02    Consulting Practice           CORE        —       subject-matter-expert
  03    Business Development          CORE        —       business-development
  04    Research & Knowledge          CORE        —       research-specialist
  05    Recruiting & Talent           FUNCTIONAL  03      business-development, operations-coordinator
  06    Operations Coordinator        FUNCTIONAL  —       operations-coordinator
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Managing Partner / Principal | Owns practice P&L, signs off on new engagements, partners with sales on key accounts. |
| 02 | Consulting Practice | Engagements delivery: scoping, analysis, recommendations, implementation oversight. |
| 03 | Business Development | Pipeline: prospecting, qualification, proposals, closes. |
| 04 | Research & Knowledge | Internal IP library: research notes, frameworks, case studies, training material. |
| 05 | Recruiting & Talent | Bench management: candidate sourcing, vetting, placement for client projects. Nests under BD. |
| 06 | Operations Coordinator | Cross-engagement coordination, billing ops, vendor management. |

| Agent | Default role prompt |
|---|---|
| `engagement-manager` | Owns delivery: scoping, plan, weekly steering, risk escalation, client status reporting. |
| `subject-matter-expert` | Domain authority: provides analysis, validates recommendations, supports pitches. |
| `business-development` | Pipeline owner: qualifies leads, drafts proposals, negotiates SOWs. |
| `research-specialist` | Knowledge curator: runs secondary research, drafts frameworks, maintains internal wiki. |
| `operations-coordinator` | Operational hub: tracks engagement budgets, coordinates vendor interactions, prepares client invoices. |

### 7.2 Packages (5 after T3 cut)

**T3:** **Drop `professional-legal`** from the wired package list before commit. Legal services = malpractice + jurisdiction-bound regulation = cut criteria #1 violation.

| # | Package slug | Tier | Scope | Departments (slots from §7.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `professional-consulting` | starter | FUNCTIONAL | 01, 02, 06 | engagement-manager, subject-matter-expert, operations-coordinator | `workflow_automation`, `crm_integration`, `sso` |
| 2 | `professional-business-dev` | starter | FUNCTIONAL | 03, 06 | business-development, operations-coordinator | `crm_integration`, `workflow_automation`, `two_factor` |
| 3 | `professional-research-knowledge` | professional | FUNCTIONAL | 04, 02 | research-specialist, subject-matter-expert | `[Feature+]` `document_templates`, `custom_reports` |
| 4 | `professional-recruiting` | professional | VERTICAL | 05 | business-development, operations-coordinator, engagement-manager | `[Feature+]` `crm_integration`, `workflow_automation`, `api_access` |
| 5 | `professional-advisory-firm` | enterprise | VERTICAL | all 6 | all 6 | `[Feature+]` `api_access`, `sso`, `two_factor`, `ms365_integration`, `custom_reports`, `document_templates` |

**Value proposition per package**:

| Package | One-line value | Target customer |
|---|---|---|
| `professional-consulting` | "Engagement scoping → delivery → client sign-off, one workspace." | Boutique management consultancies. |
| `professional-business-dev` | "Pipeline + proposals + close, all tracked." | Advisory firms, fractional-CFO practices. |
| `professional-research-knowledge` | "Internal knowledge base that improves every engagement." | Any firm wanting reusable IP. |
| `professional-recruiting` | "Bench management + candidate pipeline + placement." | Recruiting firms, talent consultancies. |
| `professional-advisory-firm` | "Full advisory firm back-office + client delivery." | Multi-practice firms. |

### 7.3 Project Types (1 today + 2 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `consulting-engagement-base` (existing) | CLIENT_ENGAGEMENT | (existing seed) | Standard 3-stage |
| 2 | `consulting-engagement` (to add) | CLIENT_ENGAGEMENT | Discovery → Analysis → Recommendation → Implementation → Close (5 stages) | 2-stage (Engagement Manager → Managing Partner) |
| 3 | `recruiting-search` (to add) | INTERNAL_INITIATIVE | Sourcing → Vetting → Client Review → Placement (4 stages) | 2-stage (Recruiter → Engagement Manager) |

### 7.4 Workspace modules

**Zero new build** — reuses `business-technology` group nav config (Tickets/Releases/Contracts/Knowledge Base from Phase 3.A). Customers label: "Clients" / `UserCircle`.

### 7.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:286` (professional block):
- `engagementModel`: enum `PROJECT_BASED | RETAINER | HOURLY | VALUE_BASED`.
- `industryVertical`: free-text (which vertical the client operates in — used to route SMEs).
- `npsScore`: integer 0-10 (post-engagement NPS).
- `referralSource`: enum `EXISTING_CLIENT | NETWORK | MARKETING | RFP | OTHER`.

### 7.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 7.6.1 | T3 — drop `professional-legal` from wired package list (archive in admin UI) | Eng + Admin | Phase 3.B start |
| 7.6.2 | Tenant Template seeder | Eng | Onboarding allocator (P5) |
| 7.6.3 | Wire 5 packages (post-cut) into `seed-business-composition.cjs` | Eng | Onboarding E2E |
| 7.6.4 | 2 new project types | Eng | SIM-07 |
| 7.6.5 | SIM-07 runner (10 FE-first stages) | QA | Cert |

---

## 8. `retail-commerce-consumer`

**Status:** 🔴 **Build required.** 5 packages stub-defined, 1 project type, no Tenant Template, 7 workspace modules all stubs. **Largest workspace build of the proposal.**
**Source seeders:** `seeds/industry-templates/industry-packages.ts` (5 stubs), `seeds/project-types/retail-commerce-consumer.json`.
**Target cert runner:** SIM-08 (12 stages).

### 8.1 Tenant Template (build: `seed-retail-commerce-department-template.cjs`)

```
DepartmentTemplate slug: retail-commerce-store
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ───────────────────────────────
  01    Store Director / GM            EXECUTIVE   —       operations-manager
  02    Store Operations              CORE        —       operations-manager, customer-service-rep
  03    Merchandising                 CORE        —       merchandiser
  04    Marketing & Campaigns         CORE        —       marketing-manager
  05    Customer Service              CORE        —       customer-service-rep
  06    Analytics & Insights          FUNCTIONAL  01      analytics-manager
  07    E-Commerce Operations         FUNCTIONAL  04      operations-manager, marketing-manager
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Store Director / GM | Single accountable owner for store P&L, staffing, customer satisfaction. |
| 02 | Store Operations | Daily store operations: opening/closing, cash reconciliation, shift scheduling. |
| 03 | Merchandising | Assortment planning, pricing strategy, promotional mix, supplier management. |
| 04 | Marketing & Campaigns | Campaign planning, audience targeting, content calendar, channel mix. |
| 05 | Customer Service | Returns, complaints, loyalty program questions, post-purchase follow-up. |
| 06 | Analytics & Insights | Sales analytics, customer segmentation, campaign performance. Nests under GM. |
| 07 | E-Commerce Operations | Online store ops: product listing, order fulfillment, digital marketing. Nests under Marketing. |

| Agent | Default role prompt |
|---|---|
| `operations-manager` | Owns daily store ops: shift schedule, cash reconciliation, opening/closing checklists. |
| `customer-service-rep` | Frontline service: handles returns, complaints, loyalty queries. |
| `merchandiser` | Assortment + pricing: plans category mix, sets promotional prices, negotiates with suppliers. |
| `marketing-manager` | Campaign owner: plans promotions, briefs creative, monitors ROAS. |
| `analytics-manager` | Insight generator: produces weekly sales/customer reports, identifies trends. |

### 8.2 Packages (5 stubs + 3 to add)

| # | Package slug | Tier | Scope | Departments (slots from §8.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `retail-store-operations` | starter | FUNCTIONAL | 01, 02 | operations-manager, customer-service-rep | `workflow_automation`, `two_factor`, `sso` |
| 2 | `retail-customer-loyalty` | starter | FUNCTIONAL | 05, 04 | customer-service-rep, marketing-manager | `crm_integration`, `workflow_automation` |
| 3 | `retail-merchandising` | professional | FUNCTIONAL | 03, 06 | merchandiser, analytics-manager | `[Feature+]` `custom_reports`, `document_templates` |
| 4 | `retail-marketing-campaigns` | professional | FUNCTIONAL | 04, 06 | marketing-manager, analytics-manager | `[Feature+]` `crm_integration`, `custom_reports`, `webhooks` |
| 5 | `retail-ecommerce` | professional | VERTICAL | 07 | operations-manager, marketing-manager, analytics-manager | `[Feature+]` `api_access`, `webhooks`, `workflow_automation` |
| 6 | `retail-multistore` (to add) | enterprise | VERTICAL | all 7 | all 7 | `[Feature+]` `api_access`, `webhooks`, `sso`, `two_factor`, `ms365_integration`, `google_workspace`, `custom_reports` |
| 7 | `retail-seasonal-campaigns` (to add) | enterprise | FUNCTIONAL | 04, 03 | marketing-manager, merchandiser | `[Feature+]` `crm_integration`, `document_templates`, `custom_reports` |
| 8 | `retail-enterprise-platform` (to add) | enterprise | VERTICAL | all 7 | all 7 | `[Feature+]` `erp_integration`, `ms365_integration`, `api_access`, `webhooks`, `custom_reports` |

**Value proposition per package**:

| Package | One-line value | Target customer |
|---|---|---|
| `retail-store-operations` | "Daily store ops from open to close, audit-logged." | Single-store retailers, pop-ups. |
| `retail-customer-loyalty` | "Loyalty program + retention campaigns." | DTC brands, restaurants. |
| `retail-merchandising` | "Assortment + pricing + promo planning." | Category managers, buyers. |
| `retail-marketing-campaigns` | "Multi-channel campaign orchestration." | Marketing teams at retail brands. |
| `retail-ecommerce` | "Online store ops + digital marketing + analytics." | eCommerce-only brands. |
| `retail-multistore` | "Multi-location ops dashboard + consolidated reporting." | Regional chains, franchises. |
| `retail-seasonal-campaigns` | "Seasonal promotion playbook with pre-built workflows." | Holiday-heavy retailers. |
| `retail-enterprise-platform` | "Full retail stack for enterprise tenants." | National chains, retail rollups. |

### 8.3 Project Types (1 today + 3 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `store-opening` (existing) | INTERNAL_INITIATIVE | (existing seed) | Standard 3-stage |
| 2 | `seasonal-campaign` (to add) | INTERNAL_INITIATIVE | Planning → Setup → Launch → In-Flight → Post-Mortem (5 stages) | 2-stage (Marketing Manager → Store Director) |
| 3 | `product-launch` (to add) | INTERNAL_INITIATIVE | Sourcing → Setup → Launch → Review (4 stages) | 2-stage (Merchandiser → Marketing Manager) |
| 4 | `loyalty-program` (to add) | INTERNAL_INITIATIVE | Design → Pilot → Rollout → Optimize (4 stages) | 3-stage (Customer Service → Marketing Manager → Store Director) |

### 8.4 Workspace modules (7 to build — LARGEST)

From `industryNavigation.ts:137` — `consumer-commerce` group nav config (shared with media; filtered via P3):

| Module id | Label | Route | Data model |
|---|---|---|---|
| `products` | Products | `/workspace/products` | Document-typed: `Document{type:'product', name, sku, category, priceAmount, stockLevel, attributes:{}}` |
| `orders` | Orders | `/workspace/orders` | `Order{id, customerId, items: OrderItem[], totalAmount, status: enum(PLACED\|FULFILLED\|RETURNED\|CANCELLED), placedAt}` |
| `inventory` | Inventory | `/workspace/inventory` | Stock-level view over Documents where `type='product'`; reorder alerts |
| `stores` | Stores | `/workspace/stores` | `Store{id, name, address, openingHours, managerAgentId, performanceMetrics:{}}` |
| `promotions` | Promotions | `/workspace/promotions` | `Promotion{id, name, discountPercent, validFrom, validTo, applicableProducts[], status, ROIEstimate}` |
| `campaigns` | Campaigns | `/workspace/campaigns` | `Campaign{id, name, channel: enum(EMAIL\|SOCIAL\|PAID\|OFFLINE), budget, targetAudience, status, performanceMetrics:{}}` |
| `content` | Content | `/workspace/content` | `ContentItem{id, title, type: enum(BLOG\|VIDEO\|SOCIAL\|EMAIL), publishDate, status, performanceMetrics:{}}` |

**T4:** Inventory uses Document store, no specialized SKU entity (cut criteria #2).

**Customers label/icon override:** "Customers & Members" / `Heart` icon (per `industryNavigation.ts:140`).

### 8.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:335` (retail block):
- `loyaltyTier`: enum `NONE | BRONZE | SILVER | GOLD | PLATINUM`.
- `lifetimeValue`: decimal (auto-calc from completed orders).
- `preferredChannel`: enum `IN_STORE | ONLINE | MOBILE_APP | PHONE`.
- `birthday`: month-day (for birthday promos).
- `acquisitionSource`: enum `ORGANIC_SEARCH | PAID_AD | REFERRAL | WALK_IN | SOCIAL | OTHER`.

### 8.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 8.6.1 | Tenant Template seeder | Eng | Onboarding allocator (P5) |
| 8.6.2 | Wire 5 stubs + 3 new packages | Eng | Onboarding E2E |
| 8.6.3 | 3 new project types | Eng | SIM-08 |
| 8.6.4 | **7 functional workspace modules** (largest single block of work in the proposal) | FE | SIM-08 workspace E2E |
| 8.6.5 | SIM-08 runner (12 FE-first stages) | QA | Cert |

---

## 9. `media-communications-creative`

**Status:** 🔴 **Build required.** 2 packages stub-defined, 1 project type, no Tenant Template. **Reuses Campaigns + Content from Phase 4.A;** Products/Orders/Inventory/Stores/Promotions hidden via P3 (sub-industry filter).
**Source seeders:** `seeds/industry-templates/industry-packages.ts` (2 stubs), `seeds/project-types/media-communications-creative.json`.
**Target cert runner:** SIM-09 (10 stages).

### 9.1 Tenant Template (build: `seed-media-creative-department-template.cjs`)

```
DepartmentTemplate slug: media-creative-agency
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ─────────────────────────────
  01    Creative Director             EXECUTIVE   —       creative-director
  02    Creative / Design             CORE        —       copywriter
  03    Production                    CORE        —       content-producer
  04    Client Services               CORE        —       project-manager-creative
  05    Operations Coordinator        FUNCTIONAL  04      operations-coordinator
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Creative Director | Owns creative output quality, approves final deliverables, pitches on key accounts. |
| 02 | Creative / Design | Concepting, design execution, copy. |
| 03 | Production | Content production: shoot/edit/publish across formats. |
| 04 | Client Services | Client-facing: briefs, status, approvals, billing. |
| 05 | Operations Coordinator | Resource scheduling, vendor coordination. Nests under Client Services. |

| Agent | Default role prompt |
|---|---|
| `creative-director` | Creative authority: signs off on concepts + final deliverables, mentors creative team. |
| `copywriter` | Brand voice + content craft: writes copy across formats, maintains tone consistency. |
| `content-producer` | Production lead: schedules shoots, manages editors, ships deliverables on time. |
| `project-manager-creative` | Client interface: runs status, manages scope, shepherds approvals. |

### 9.2 Packages (2 stubs + 3 to add)

| # | Package slug | Tier | Scope | Departments (slots from §9.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `media-content-production` | starter | FUNCTIONAL | 03, 04 | content-producer, project-manager-creative | `workflow_automation`, `document_templates`, `sso` |
| 2 | `media-brand-development` | professional | FUNCTIONAL | 01, 02 | creative-director, copywriter | `[Feature+]` `document_templates`, `custom_reports` |
| 3 | `media-social-management` (to add) | professional | VERTICAL | 03, 04 | content-producer, project-manager-creative | `[Feature+]` `crm_integration`, `webhooks`, `custom_reports` |
| 4 | `media-video-production` (to add) | enterprise | VERTICAL | 03, 02 | content-producer, copywriter | `[Feature+]` `api_access`, `webhooks`, `custom_reports`, `document_templates` |
| 5 | `media-pr-campaigns` (to add) | enterprise | VERTICAL | 04, 01 | project-manager-creative, creative-director | `[Feature+]` `crm_integration`, `custom_reports`, `document_templates` |

**Value proposition per package**:

| Package | One-line value | Target customer |
|---|---|---|
| `media-content-production` | "Content calendar + production pipeline." | Small agencies, in-house content teams. |
| `media-brand-development` | "Brand strategy + identity + rollout." | Brand consultancies, creative boutiques. |
| `media-social-management` | "Social content + scheduling + community management." | Social media agencies, DTC marketing teams. |
| `media-video-production` | "Video production lifecycle: brief → shoot → edit → deliver." | Video studios, production houses. |
| `media-pr-campaigns` | "PR campaign orchestration + media list + coverage tracking." | PR agencies, comms teams. |

### 9.3 Project Types (1 today + 3 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `media-campaign-base` (existing) | CLIENT_ENGAGEMENT | (existing seed) | Standard 3-stage |
| 2 | `campaign-launch` (to add) | CLIENT_ENGAGEMENT | Brief → Concept → Production → Review → Launch → Recap (6 stages) | 2-stage (Creative Director → Project Manager Creative) |
| 3 | `brand-refresh` (to add) | CLIENT_ENGAGEMENT | Audit → Strategy → Identity → Rollout → Measure (5 stages) | 3-stage (Creative Director → Copywriter → Client Services) |
| 4 | `content-series` (to add) | INTERNAL_INITIATIVE | Plan → Produce → Publish → Measure (4 stages, recurring) | 2-stage (Content Producer → Project Manager Creative) |

### 9.4 Workspace modules

**Reused from `consumer-commerce` group nav config** with sub-industry filter (P3):
- ✅ Available: `campaigns`, `content` (built in Phase 4.A)
- ❌ Hidden via P3: `products`, `orders`, `inventory`, `stores`, `promotions`

Customers label/icon override: same as retail ("Customers & Members" / `Heart`) — or override to "Clients" / `UserCircle` if desired (admin choice).

### 9.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:391` (media block):
- `brandGuidelines`: text (link to or summary of brand voice document).
- `contractType`: enum `RETAINER | PROJECT | MONTHLY_HOURS | A LA CARTE`.
- `creativeApprovalContact`: text (name + email of client's brand approver).
- `contentApprovalSLA`: integer hours (default turnaround for content approval).

### 9.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 9.6.1 | Tenant Template seeder | Eng | Onboarding allocator (P5) |
| 9.6.2 | Wire 2 stubs + 3 new packages | Eng | Onboarding E2E |
| 9.6.3 | 3 new project types | Eng | SIM-09 |
| 9.6.4 | SIM-09 runner (10 FE-first stages) | QA | Cert |
| 9.6.5 | P3 sub-industry nav filter must be live (ships Phase 2.A) | FE | Tenant FE render |

---

## 10. `nonprofit-international`

**Status:** 🔴 **Build required.** 0 packages, 0 Tenant Template, 1 project type. 6 workspace stubs (4 to build, 2 to hide via P3).
**Source seeders:** `seeds/project-types/nonprofit-international.json`.
**Target cert runner:** SIM-10 (10 stages).

### 10.1 Tenant Template (build: `seed-nonprofit-department-template.cjs`)

```
DepartmentTemplate slug: nonprofit-international-ngo
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ──────────────────────────────
  01    Executive Director            EXECUTIVE   —       program-manager
  02    Programs                      CORE        —       program-manager
  03    Development / Fundraising     CORE        —       grant-writer
  04    Operations                    CORE        —       operations-coordinator
  05    Donor Stewardship             FUNCTIONAL  03      donor-stewardship
  06    Compliance & Reporting        FUNCTIONAL  01      operations-coordinator
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Executive Director | Owns mission delivery + financial sustainability + board reporting. |
| 02 | Programs | Program design, beneficiary engagement, field operations. |
| 03 | Development / Fundraising | Grant pipeline, major donor cultivation, foundation relationships. |
| 04 | Operations | Day-to-day org ops: HR, finance (non-grant), facilities, IT. |
| 05 | Donor Stewardship | Donor CRM: acknowledgments, impact reporting, retention. Nests under Development. |
| 06 | Compliance & Reporting | Regulatory compliance (state charity filings, international NGO rules), board reporting. Nests under ED. |

| Agent | Default role prompt |
|---|---|
| `program-manager` | Owns program delivery: plans, executes, measures, reports on outcomes. |
| `grant-writer` | Pipeline owner: researches funders, drafts proposals, shepherds submissions, reports on grants. |
| `donor-stewardship` | Donor relations: sends acknowledgments, prepares impact reports, drives retention. |
| `operations-coordinator` | Operational backbone: HR, vendor management, internal comms. |

**T6:** NGO uses `operations-coordinator` + `+compliance_pack` feature flag for compliance; no dedicated `compliance-officer` agent (that role is F&C-bound).

### 10.2 Packages (5 to build)

**Reuses** the 11 existing `seeds/question-packs/` files: `core, stakeholders, budget, timeline, deliverables, compliance, grant, hr, training, research, field-mission`.

| # | Package slug | Tier | Scope | Departments (slots from §10.1) | Agents | Features |
|---:|---|---|---|---|---|---|
| 1 | `ngo-foundation` | starter | FUNCTIONAL | 01, 04 | program-manager, operations-coordinator | `workflow_automation`, `audit_logs`, `sso`, `two_factor` |
| 2 | `ngo-program-delivery` | starter | FUNCTIONAL | 02, 04 | program-manager, operations-coordinator | `[Feature+]` `field_mission_pack`, `hr_pack`, `stakeholder_pack` |
| 3 | `ngo-donor-crm` | professional | FUNCTIONAL | 05, 03 | donor-stewardship, grant-writer | `[Feature+]` `crm_integration`, `grant_pack`, `custom_reports` |
| 4 | `ngo-grant-acquisition` | professional | VERTICAL | 03, 05 | grant-writer, donor-stewardship, program-manager | `[Feature+]` `grant_pack`, `document_templates`, `custom_reports` |
| 5 | `ngo-volunteer-management` | professional | FUNCTIONAL | 02, 04 | program-manager, operations-coordinator | `[Feature+]` `hr_pack`, `stakeholder_pack`, `workflow_automation` |
| 6 | `ngo-impact-reporting` | enterprise | VERTICAL | 06, 02 | operations-coordinator, program-manager | `[Feature+]` `custom_reports`, `document_templates`, `audit_logs` |
| 7 | `ngo-enterprise-platform` | enterprise | VERTICAL | all 6 | all 6 | `[Feature+]` `api_access`, `webhooks`, `sso`, `two_factor`, `ms365_integration`, `google_workspace`, `custom_reports` |

**Value proposition per package**:

| Package | One-line value | Target customer |
|---|---|---|
| `ngo-foundation` | "Day-1 ops for a small NGO: program + operations + compliance." | Seed-stage NGOs (<5 staff). |
| `ngo-program-delivery` | "Program planning + field mission tracking + beneficiary reporting." | Operating NGOs running ≥1 program. |
| `ngo-donor-crm` | "Donor database + stewardship + retention." | Any NGO with ≥50 active donors. |
| `ngo-grant-acquisition` | "Grant pipeline + proposal drafting + submission tracking." | NGOs seeking institutional funding. |
| `ngo-volunteer-management` | "Volunteer onboarding + scheduling + impact tracking." | Volunteer-driven NGOs. |
| `ngo-impact-reporting` | "Outcome measurement + board reporting + funder reporting." | NGOs reporting to funders/boards. |
| `ngo-enterprise-platform` | "Full NGO stack for multi-program organizations." | International NGOs with multiple programs. |

### 10.3 Project Types (1 today + 3 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `ngo-program-base` (existing) | INTERNAL_INITIATIVE | (existing seed) | Standard 3-stage |
| 2 | `grant-application` (to add) | INTERNAL_INITIATIVE | Research → Drafting → Internal Review → Submission → Decision → Reporting (6 stages) | 3-stage (Grant Writer → Program Manager → Executive Director) |
| 3 | `field-mission` (to add) | INTERNAL_INITIATIVE | Planning → Mobilization → Implementation → Reporting → Closeout (5 stages) | 2-stage (Program Manager → Operations Coordinator) |
| 4 | `beneficiary-program` (to add) | INTERNAL_INITIATIVE | Design → Pilot → Rollout → Operation → Evaluation (5 stages) | 3-stage (Program Manager → Operations Coordinator → Executive Director) |

### 10.4 Workspace modules (4 to build, 2 hidden)

From `industryNavigation.ts:93` — `public-social` group nav config:

| Module id | Label | Route | Status (NGO) | Data model |
|---|---|---|:-:|---|
| `programs` | Programs | `/workspace/programs` | 🔴 build | `Program{id, name, beneficiaryCount, budget, status, startDate, endDate, kpis[]}` — directory + status + KPI |
| `grants` | Grants | `/workspace/grants` | 🔴 build | `Grant{id, funderName, amount, status: enum(PROSPECTING\|DRAFTING\|SUBMITTED\|AWARDED\|REJECTED\|REPORTING), dueDate, ownerAgentId}` — pipeline + calendar |
| `field-operations` | Field Operations | `/workspace/field-operations` | 🔴 build | `FieldMission{id, programId, siteName, startDate, endDate, teamSize, beneficiaryCount, status}` |
| `cases` | Cases | `/workspace/cases` | 🔴 build | `BeneficiaryCase{id, beneficiaryId, caseNumber, openedAt, status, interventions[], assignedAgentId}` |
| `licenses` | Licenses | `/workspace/licenses` | 🟡 hide via P3 | (Not used by NGO — would be for government sub-industry) |
| `inspections` | Inspections | `/workspace/inspections` | 🟡 hide via P3 | (Not used by NGO) |

**Customers label/icon override:** "Citizens & Beneficiaries" / `Users` icon (per `industryNavigation.ts:96`).

### 10.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:719` (nonprofit block):
- `beneficiaryId`: text (anonymized identifier for the beneficiary).
- `programEnrollments`: array of `ProgramEnrollment{programId, enrolledAt, status}`.
- `consentOnFile`: boolean (data-handling consent per GDPR/local).
- `preferredLanguage`: enum (common languages; helps multilingual programs).

### 10.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 10.6.1 | Tenant Template seeder | Eng | Onboarding allocator (P5) |
| 10.6.2 | Build 7 packages (reuses existing question-packs) | Eng | Onboarding E2E |
| 10.6.3 | 3 new project types | Eng | SIM-10 |
| 10.6.4 | 4 functional workspace modules | FE | SIM-10 |
| 10.6.5 | P3 sub-industry filter must be live (ships Phase 2.A) | FE | Tenant FE render |
| 10.6.6 | P13 (DepartmentTemplate category enum) should ship alongside Phase 5.A | Eng | Catalog hygiene |
| 10.6.7 | SIM-10 runner (10 FE-first stages) | QA | Cert |

---

## 11. `special-purpose-organizations`

**Status:** 🔴 **Build required.** 0 packages, 0 Tenant Template, 1 project type. **The only Industry that reuses another group's packages via cross-group reference (T8).**
**Source seeders:** `seeds/project-types/special-purpose-organizations.json`.
**Target cert runner:** SIM-11 (10 stages).

### 11.1 Tenant Template (build: `seed-special-purpose-department-template.cjs`)

```
DepartmentTemplate slug: special-purpose-organizations-holding
  slot  name                          type        parent  default agent(s)
  ────  ────────────────────────────  ──────────  ──────  ────────────────────────────────
  01    Managing Director / Principal  EXECUTIVE   —       operations-coordinator
  02    Operations                    CORE        —       operations-coordinator
  03    Finance & Accounting          CORE        —       finance-controller
  04    Compliance & Governance       CORE        —       compliance-officer
```

**Slot responsibilities + agent role descriptions**:

| Slot | Department | Responsibility |
|---:|---|---|
| 01 | Managing Director / Principal | Owns holding company strategy, inter-entity coordination, board governance. |
| 02 | Operations | Inter-entity operations, shared services coordination. |
| 03 | Finance & Accounting | Multi-entity accounting, treasury, consolidated reporting. |
| 04 | Compliance & Governance | Corporate filings, beneficial ownership tracking, regulatory compliance. |

| Agent | Default role prompt |
|---|---|
| `operations-coordinator` | Operational backbone: inter-entity scheduling, vendor management, shared services. |
| `finance-controller` | Multi-entity accountant: consolidates financials across entities, manages intercompany, prepares reports. |
| `compliance-officer` | Governance + regulatory: corporate filings (annual reports, beneficial ownership), board minutes, regulatory tracking. **Generic** — separate from F&C's `Compliance Auditor` (which is audit-bound). |

**T7:** Generic `compliance-officer` agent does NOT collide with F&C `Compliance Auditor`. Both are registered as separate `AgentTemplate` rows; `TierAgentPool` is Industry-scoped via `Package.industryId`, so they cannot both default-select for the same tenant.

### 11.2 Packages (3 to build, with T8 cross-ref)

| # | Package slug | Tier | Scope | Departments (slots from §11.1) | Agents | Features | `parentPackageId` |
|---:|---|---|---|---|---|---|---|
| 1 | `spo-foundation` | starter | FUNCTIONAL | 01, 02 | operations-coordinator | `workflow_automation`, `audit_logs`, `sso`, `two_factor` | — |
| 2 | `spo-multi-entity-operations` | professional | VERTICAL | 02, 04 | operations-coordinator, compliance-officer | `[Feature+]` `document_templates`, `custom_reports`, `audit_logs` | — |
| 3 | `spo-portfolio-oversight` | professional | VERTICAL | 03, 01 | finance-controller, operations-coordinator | `[Feature+]` `custom_reports`, `document_templates` | — |
| 4 | `spo-family-office-reporting` | enterprise | VERTICAL | 03, 04 | finance-controller, compliance-officer | `[Feature+]` `custom_reports`, `audit_logs`, `document_templates` | `accounting-operations` (inherits Bookkeeper & Controller, GL Accountant) |

**T8:** The enterprise package reuses `accounting-operations` (accounting) agents via `Package.parentPackageId` FK. Resolver at onboarding follows the parent → child chain and merges inherited department/agent rows.

**Value proposition per package**:

| Package | One-line value | Target customer |
|---|---|---|
| `spo-foundation` | "Single-entity holding company back office." | Newly-formed family offices, small holding cos. |
| `spo-multi-entity-operations` | "Inter-entity coordination + governance." | Holdings with 2-5 entities. |
| `spo-portfolio-oversight` | "Portfolio tracking + intercompany reporting." | Multi-asset family offices. |
| `spo-family-office-reporting` | "Full FOC reporting: consolidated financials + governance + inherited accounting." | Mature family offices (5+ entities). |

### 11.3 Project Types (1 today + 2 to add)

| # | Project type slug | Classification | Stage template | Approval template |
|---:|---|---|---|---|
| 1 | `spo-base` (existing) | INTERNAL_INITIATIVE | (existing seed) | Standard 3-stage |
| 2 | `entity-restructure` (to add) | INTERNAL_INITIATIVE | Plan → Approve → File → Migrate → Notify → Close (6 stages) | 3-stage (Operations Coordinator → Compliance Officer → Managing Director) |
| 3 | `annual-review` (to add) | INTERNAL_INITIATIVE | Plan → Collect → Review → Report → Archive (5 stages) | 2-stage (Finance Controller → Managing Director) |

### 11.4 Workspace modules (2 to build, "Custom Modules" hidden)

From `industryNavigation.ts:173` — `other` group nav config:

| Module id | Label | Route | Status (SPO) | Data model |
|---|---|---|:-:|---|
| `operations` | Operations | `/workspace/operations` | 🔴 build | Inter-entity coordination: shared services, vendor tracking, efficiency KPIs. |
| `assets` | Assets | `/workspace/assets` | 🔴 build | `Asset{id, name, type: enum(REAL_ESTATE\|EQUITY\|PRIVATE_INVESTMENT\|CASH\|OTHER), ownerEntityId, currentValuation, lastReviewedAt}` |
| `documents` | Documents | `/workspace/documents` | 🔴 build | Document library: governance records, board minutes, filings — indexed + versioned. |
| `custom` | Custom Modules | `/workspace/custom` | 🟡 hide via P3 | (Cut per §7.8 T-cut) |

### 11.5 Customer form

Generic + per-Industry fields from `industry-customer-field-definitions.ts:827` (SPO block):
- `entityType`: enum `INDIVIDUAL | LLC | CORPORATION | TRUST | PARTNERSHIP | FOUNDATION`.
- `jurisdiction`: text (state/country of formation).
- `taxId`: text (encrypted at app layer; mirrors F&C field).
- `beneficialOwners`: array of `{name, ownershipPercent, kycVerified: boolean}`.

### 11.6 Open items before certification

| # | Item | Owner | Blocks |
|---|---|---|---|
| 11.6.1 | Tenant Template seeder | Eng | Onboarding allocator (P5) |
| 11.6.2 | Build 4 packages (3 with `parentPackageId` chain via T8) | Eng | Onboarding E2E |
| 11.6.3 | T8 — `Package.parentPackageId` migration (P4) | Eng | Inheritance resolver |
| 11.6.4 | P9 — `/packages/[id]/edit` shows inherited slots as read-only badges | FE | Admin UX |
| 11.6.5 | 2 new project types | Eng | SIM-11 |
| 11.6.6 | 3 functional workspace modules (Operations, Assets, Documents) | FE | SIM-11 |
| 11.6.7 | P3 sub-industry filter must be live (ships Phase 2.A) | FE | Tenant FE render |
| 11.6.8 | SIM-11 runner (10 FE-first stages) | QA | Cert |

---

## 12. Cross-Industry summary tables

### 12.1 Department count by Industry (Day-1 org chart size)

| Industry | EXECUTIVE | CORE | FUNCTIONAL | Total departments | Total default-selected agents |
|---|---:|---:|---:|---:|---:|
| `accounting-audit-services` | 1 | 6 | 5 | 12 | 14 |
| `financial-services` | 1 | 4 | 3 | 8 | 8 |
| `technology-digital-services` | 1 | 4 | 2 | 7 | 7 |
| `professional-business-services` | 1 | 3 | 2 | 6 | 6 |
| `retail-commerce-consumer` | 1 | 4 | 2 | 7 | 5 |
| `media-communications-creative` | 1 | 3 | 1 | 5 | 4 |
| `nonprofit-international` | 1 | 3 | 2 | 6 | 4 |
| `special-purpose-organizations` | 1 | 3 | 0 | 4 | 3 |

### 12.2 Package count by Industry × Tier

| Industry | starter | professional | enterprise | Total |
|---|---:|---:|---:|---:|
| `accounting-audit-services` | 4 | 6 | 5 | 15 |
| `financial-services` | 1 | 3 | 4 | 8 |
| `technology-digital-services` | 2 | 3 | 3 | 8 |
| `professional-business-services` | 2 | 2 | 1 | 5 |
| `retail-commerce-consumer` | 2 | 3 | 3 | 8 |
| `media-communications-creative` | 1 | 2 | 2 | 5 |
| `nonprofit-international` | 2 | 3 | 2 | 7 |
| `special-purpose-organizations` | 1 | 2 | 1 | 4 |
| **Total** | **15** | **24** | **21** | **60** |

### 12.3 Project type count by Industry

| Industry | Existing | To add | Total |
|---|---:|---:|---:|
| `accounting-audit-services` | 1 | 0 | 1 |
| `financial-services` | 1 | 3 | 4 |
| `technology-digital-services` | 1 | 2 | 3 |
| `professional-business-services` | 1 | 2 | 3 |
| `retail-commerce-consumer` | 1 | 3 | 4 |
| `media-communications-creative` | 1 | 3 | 4 |
| `nonprofit-international` | 1 | 3 | 4 |
| `special-purpose-organizations` | 1 | 2 | 3 |
| **Total** | **8** | **18** | **26** |

### 12.4 Workspace module count by Industry

| Industry | Functional | Stub (build req) | Hidden via P3 | Total nav items |
|---|---:|---:|---:|---:|
| `accounting-audit-services` | 8 | 0 | 0 | 8 |
| `financial-services` | 8 (shared w/ accounting) | 0 | 0 | 8 |
| `technology-digital-services` | 0 | 4 | 0 | 4 |
| `professional-business-services` | 4 (reused from B&T) | 0 | 0 | 4 |
| `retail-commerce-consumer` | 0 | 7 | 0 | 7 |
| `media-communications-creative` | 2 (reused from retail) | 0 | 5 | 7 |
| `nonprofit-international` | 0 | 4 | 2 | 6 |
| `special-purpose-organizations` | 0 | 3 | 1 | 4 |
| **Total unique modules** | **22** | **18** | — | — |

### 12.5 Build-effort by Industry (data + workspace + SIM, in dev-days)

| Industry | Tenant template | Packages | Project types | Workspace modules | SIM runner | Total |
|---|---:|---:|---:|---:|---:|---:|
| `accounting-audit-services` | ✅ shipped | ✅ shipped | ✅ shipped | ✅ shipped | ✅ shipped | 0 |
| `financial-services` | 1 | 0.5 (T1 fix) | 0.5 | 1 (workspace branch) | 4 (SIM-05) + 1.5 (sidecar) | **8.5** |
| `technology-digital-services` | ✅ Run-6 verify | 0.5 | 0.5 | 5 | 3 (SIM-06) | **10** |
| `professional-business-services` | 1 | 0.5 (post T3 cut) | 0.5 | 0 (reuses Phase 3.A) | 3 (SIM-07) | **5** |
| `retail-commerce-consumer` | 1.5 | 0.5 | 0.5 | 5 | 4 (SIM-08) | **12** |
| `media-communications-creative` | 1 | 0.5 | 0.5 | 0 (reuses Phase 4.A) | 3 (SIM-09) | **5** |
| `nonprofit-international` | 2 | 1 | 0.5 | 3 | 3 (SIM-10) | **9.5** |
| `special-purpose-organizations` | 1.5 | 1 (incl. T8) | 0.5 | 1.5 | 3 (SIM-11) | **7.5** |
| **Total** | **8** | **4.5** | **3.5** | **15.5** | **21.5** | **~57** |

---

## 13. References

### Primary source documents
- `neurecore/memory-bank-arc/industries/PRUNED-TAXONOMY-PROPOSAL.md` — The proposal this catalog implements. §3 (audit), §7 (build items per Industry), §8 (effort), §9 (open questions).
- `neurecore/memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md` — Original 8 Groups / 16 Industries concept; kept for context.
- `neurecore/memory-bank-arc/pools-taxonomy.md` — 6-pool schema (Package, DepartmentTemplate, AgentTemplate, Feature, Tier, Industry).

### Per-Industry seeders (existing)
- `prisma/seed-accounting-packages.cjs` — Accounting packages (15).
- `prisma/seed-financial-services-packages.cjs` — FS packages (8; needs T1 fix).
- `prisma/seed-business-technology-templates.cjs` — B&T Tenant Template (Run-6).
- `prisma/seed-healthcare-department-template.cjs` — Healthcare Tenant Template (reference pattern, not in pruned taxonomy).

### Per-Industry seeders (to build)
- `prisma/seed-financial-services-department-template.cjs` — FS Tenant Template.
- `prisma/seed-professional-business-department-template.cjs` — Pro Services Tenant Template.
- `prisma/seed-retail-commerce-department-template.cjs` — Retail Tenant Template.
- `prisma/seed-media-creative-department-template.cjs` — Media Tenant Template.
- `prisma/seed-nonprofit-department-template.cjs` — NGO Tenant Template.
- `prisma/seed-special-purpose-department-template.cjs` — SPO Tenant Template.

### Per-Industry project types
- `prisma/seeds/project-types/*.json` — All 16 Industry JSON files; proposal adds ~18 new types total (per §12.3).

### Per-Industry lifecycle + customer-field defs
- `backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts` — All 16 Industries wired (this catalog references the line ranges for each).
- `prisma/seeds/industry-templates/*-templates.ts` — Customer-lifecycle templates per Industry.

### Workspace nav config
- `frontend-tenant/src/lib/industryNavigation.ts` — 8-Group nav config; this catalog's §12.4 references the group-level entries.

### Question packs reused
- `prisma/seeds/question-packs/*.json` — 20 packs; NGO (§10.2) explicitly reuses 11 of them.

### Certification runners
- `simulations/SIM-04-Accounting-Project-Full-Flow/` — Existing FE-first template.
- `simulations/SIM-05..SIM-11` — To be built per Phase.

### Admin UI surfaces (per §3.7 of the proposal)
- All seed-script outputs are immediately admin-editable in production via `/packages/[id]/edit`, `/departments-pool`, `/agents-pool`, `/project-types`, `/industries`, `/tiers`. The catalog above is the *baseline*; SUPER_ADMIN can diverge per-tenant post-seed.

---

## 14. Contabo deploy touchpoints (per Industry)

For each kept Industry, this is exactly **what lands on the Contabo box** and **when** it lands. Source: `neurecore/memory-bank/contabo-ops.md` + `neurecore/memory-bank-arc/contabo-ops.md`.

### 14.1 Production hostnames + ports

| Surface | Hostname | Upstream PM2 process | Port |
|---|---|---|---|
| Tenant frontend | `https://hq.neurecore.com` | `neurecore-tenant` | 3001 |
| Admin frontend | `https://cc.neurecore.com` | `neurecore-admin` | 3020 |
| Backend API | `https://brain.neurecore.com` | `neurecore-backend` | 3003 |
| CORS proxy | (localhost) | `neurecore-cors-proxy` | 3004 |
| Accounting sidecar | (localhost) | `accounting-sidecar` (systemd) | 8091 |

Every Phase in `PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN.md` touches one or more of these. See §10.3 of the plan for the canonical commands.

### 14.2 Per-Industry deploy footprint

| Industry | Backend rebuild? | Frontend-tenant rebuild? | Frontend-admin rebuild? | Database-only update? | New env vars | New systemd services | Cert runner |
|---|:-:|:-:|:-:|---|---|---|---|
| `accounting-audit-services` | n/a | n/a | n/a | n/a (already shipped) | n/a | n/a | SIM-04 ✅ |
| `financial-services` (Phase 2.B) | ✅ | ✅ (workspace KPI branch) | ❌ | seed script + T1 tier-slug | `PRUNED_FS_ENABLED` | ❌ | SIM-05 |
| `technology-digital-services` (Phase 3.A) | ✅ (P1 generic workspace builder; backend maybe) | ✅ (4 modules: Tickets/Releases/Contracts/KB) | ❌ | seed script (wire stubs) | `PRUNED_TECH_ENABLED` | ❌ | SIM-06 |
| `professional-business-services` (Phase 3.B) | ❌ (T3 just archives a package) | ✅ (workspace reuses Phase 3.A) | ✅ (archive `professional-legal` in `/packages`) | T3 archive via admin UI | `PRUNED_PROFESSIONAL_ENABLED` | ❌ | SIM-07 |
| `retail-commerce-consumer` (Phase 4.A) | ✅ (workspace module routes) | ✅✅ (LARGEST — 7 modules: Products/Orders/Inventory/Stores/Promotions/Campaigns/Content) | ❌ | seed script + P4 verify | `PRUNED_RETAIL_ENABLED` | ❌ | SIM-08 |
| `media-communications-creative` (Phase 4.B) | ❌ | ✅ (Campaigns/Content reused from 4.A) | ❌ | seed script | `PRUNED_MEDIA_ENABLED` | ❌ | SIM-09 |
| `nonprofit-international` (Phase 5.A) | ✅ (P13 enum migration) | ✅ (4 modules: Programs/Grants/Field Operations/Cases) | ✅ (P13 enum UI) | seed script + P13 enum migration | `PRUNED_NONPROFIT_ENABLED` | ❌ | SIM-10 |
| `special-purpose-organizations` (Phase 5.B) | ✅ (T8 cross-group Package FK migration) | ✅ (3 modules: Operations/Assets/Documents) | ✅ (P9 inheritance UI in `/packages/[id]/edit`) | T8 migration + seed script | `PRUNED_SPO_ENABLED` | ❌ | SIM-11 |

**No new PM2 processes or systemd services are introduced** by this plan. All 4 PM2 processes (`neurecore-backend`, `neurecore-tenant`, `neurecore-admin`, `neurecore-cors-proxy`) and 3 systemd services (`hermes-sidecar`, `hermes-events-bridge`, `accounting-sidecar`) continue to run unchanged.

### 14.3 DR snapshot points (per Industry)

Per `contabo-ops.md §3.3b` + `disaster-recovery.md`, every Phase ships with a DR snapshot BEFORE the rebuild. Snapshot location: `/opt/neurecore/_archives/{YYYYMMDD-HHMMSS}-pre-{phase-slug}/`.

What gets snapshotted:
- `/opt/neurecore/backend/backend/dist/` → `backend-dist.tar.gz`
- `/opt/neurecore/frontend-tenant/.next/` → `frontend-tenant-.next.tar.gz`
- `/opt/neurecore/frontend-admin/.next/` → `frontend-admin-.next.tar.gz`
- `/opt/neurecore/ecosystem.config.js`
- `/opt/neurecore/cors-proxy.js`
- `/opt/neurecore/backend/backend/.env.production` (NOT rsynced in deploy.sh but snapshotted manually pre-deploy)
- `/opt/neurecore/backend/backend/prisma/migrations/` (full directory)

The progress doc (`PRUNED-INDUSTRIES-PROGRESS-2026-07-31.md`) Step 1 has the exact snapshot command template.

### 14.4 Per-Industry env flags

Every Phase adds `PRUNED_{PHASE}_ENABLED` env var (default `false`). Per `contabo-ops.md §3.8b`, **set in BOTH `.env` AND `.env.production`**. Per-Phase list:

| Phase | New env var | Default |
|---|---|---|
| 2.A | `PRUNED_PICKER_V2` | false |
| 2.B | `PRUNED_FS_ENABLED` | false |
| 3.A | `PRUNED_TECH_ENABLED` | false |
| 3.B | `PRUNED_PROFESSIONAL_ENABLED` | false |
| 4.A | `PRUNED_RETAIL_ENABLED` | false |
| 4.B | `PRUNED_MEDIA_ENABLED` | false |
| 5.A | `PRUNED_NONPROFIT_ENABLED` | false |
| 5.B | `PRUNED_SPO_ENABLED` | false |

Future capability sidecars (e.g. `fs-tools-sidecar` for KYC/AML if Phase 2.B scope grows) would be added as systemd services at ports 8081/8083/8084/8091-8093 — **never 8090** (CyberPanel `lscpd`). Per `contabo-ops.md §1` and `sidecar-deploy-procedure.md`.

### 14.5 Tenant-onboarding Contabo surface

Every new tenant onboarding flows through:

1. **Public picker** (`https://hq.neurecore.com/onboarding`) — `frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx` (filtered to 8 kept Industries post-Phase 2.A).
2. **Onboarding API** — `POST /api/v1/onboarding` on `neurecore-backend` (port 3003) — calls `OnboardingService` which runs the `TenantBlueprintResolver` (R3 target).
3. **Allocator** — `prisma/seed-onboarding-allocator.cjs` (already wired; verified per Phase 2.A's P5).
4. **Provisioning** — Departments + Agents created from `DepartmentTemplate` rows (seeded by per-Industry tenant-template seeder).
5. **First login** — Tenant signs in via `https://brain.neurecore.com/api/v1/auth/login`, gets JWT cookie, sees IconRail filtered by `industryGroup` (F&C) + `industry.slug` (P3 sub-industry).

This is unchanged by the plan — only the picker filter and sub-industry nav filter change.

### 14.6 Cross-Industry hot path observations

After Phase 2.A deploy, watch for these regressions in `pm2 logs neurecore-tenant | grep -iE 'industry|customer'` (per §10.5.4):

- **Mali (accounting tenant)**: no behavioral change expected. F&C first-class columns (`financialSubType`, `kycStatus`, etc.) still rendered.
- **Any tenant on a cut Industry** (per §10.5.1 audit): will still see their existing Industry in their tenant record; the **picker hides** new onboarding to that Industry. Document in the rollout commit message.
- **Cross-tenant isolation**: `phase8-tenant-isolation.spec.ts` baseline must remain PASS.

---

**End of catalog.** For build sequencing and prerequisite dependencies, see `PRUNED-TAXONOMY-PROPOSAL.md §7–§9`. For admin-UI capability matrix, see proposal §3.7. For customer-lifecycle stage templates per Industry, see `seeds/industry-templates/*-templates.ts`. For Contabo deploy specifics, see `PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN.md §10` and this document's §14.

---

## 15. Build artifacts shipped (2026-07-31, session 2)

This catalog's data is the **baseline**; the build was fully executed in `PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN.md §5.x`. The actual ship list:

### 15.1 Backend

| Artifact | Path | Purpose |
|---|---|---|
| R2 helpers (5 files) | `backend/prisma/seed-helpers/*.cjs` | Load-env, seed-tenant-template, seed-package, seed-project-types (metadata loader), seed-tenant-template-rows |
| R3 interfaces (5 contracts + barrel) | `backend/src/modules/industry/interfaces/` | IndustryMetadataProvider, IndustryNavProvider, IndustryCustomerFieldProvider, IndustryApprovalAddonRegistry, IndustryWidgetProvider |
| R3 impls (4 concrete + barrel) | `backend/src/modules/industry/providers/` | Each provider implements its interface |
| R3 DI bindings | `backend/src/modules/industry/industries.module.ts` | Exports 5 symbols |
| Schema additions | `backend/prisma/schema.prisma` | `enum DepartmentTemplateCategory` + `Package.parentPackageId` self-relation |
| P13 migration | `backend/prisma/migrations/phase5a-p13-20260731/` | String → enum conversion with safe rollback |
| T8 migration | `backend/prisma/migrations/phase5b-t8-20260731/` | Nullable FK + index with safe rollback |
| Per-Phase seeders (8 tenant templates + 8 package seeders + T3 cut in seed-industry-packages.cjs) | `backend/prisma/seed-*-department-template.cjs` + `seed-*-packages.cjs` | Use R2 helpers |
| Status-flip script | `backend/prisma/set-cut-industries-archived.cjs` | Idempotent ARCHIVED flip for 8 cut Industries |

### 15.2 Frontend — tenant

| Artifact | Path | Purpose |
|---|---|---|
| P1 types | `frontend-tenant/src/lib/industry-workspace-models.ts` | Shared `WorkspaceModuleConfig` + field/relationship types |
| P1 builder | `frontend-tenant/src/components/industry/WorkspaceModuleBuilder.tsx` | Generic list+detail+create form |
| Industry KPI registry | `frontend-tenant/src/lib/industryWorkspaceKpi.ts` | Per-Industry KPI cards for F&C modules |
| 18 workspace module configs + pages | `frontend-tenant/src/app/workspace/{tickets,releases,contracts,knowledge,products,orders,inventory,stores,promotions,campaigns,content,programs,grants,field-operations,cases,operations,assets,documents}/` | Each is `config.ts` + `page.tsx` |
| P3 sub-industry nav filter | `industryNavigation.ts:63` `RailItem.subIndustries` + `IconRail.tsx` consumer | Hides retail-only items for media tenants |
| Industry constants | `frontend-tenant/src/lib/industryGroups.ts` | `INDUSTRY_GROUP`, `INDUSTRY_GROUPS` metadata, `INDUSTRY_GROUP_INDUSTRIES` map |

### 15.3 Frontend — admin

| Artifact | Path | Purpose |
|---|---|---|
| P9 inheritance banner | `frontend-admin/src/components/packages/PackageInheritanceBanner.tsx` | Read-only badge shown when a package inherits another (T8) |
| P9 wired | `frontend-admin/src/app/packages/[id]/edit/page.tsx` | Renders banner above composition picker |

### 15.4 Simulations

| Artifact | Path | Stages |
|---|---|---|
| P2 base class | `simulations/_lib/base-runner.mjs` | Abstract; subclasses declare `stages()` |
| SIM-05 (FS) | `simulations/SIM-05-Financial-Services-Project-Full-Flow/certify-sim05.mjs` | 12 stages |
| SIM-06 (tech) | `simulations/SIM-06-Technology-Digital-Services-Project-Full-Flow/certify-sim06.mjs` | 10 stages |
| SIM-07 (pro) | `simulations/SIM-07-Professional-Business-Services-Project-Full-Flow/certify-sim07.mjs` | 10 stages; T3 cut assertion |
| SIM-08 (retail) | `simulations/SIM-08-Retail-Commerce-Consumer-Project-Full-Flow/certify-sim08.mjs` | 12 stages; T4 Document-store assertion |
| SIM-09 (media) | `simulations/SIM-09-Media-Communications-Creative-Project-Full-Flow/certify-sim09.mjs` | 10 stages; P3 sub-industry filter assertion |
| SIM-10 (NGO) | `simulations/SIM-10-Nonprofit-International-Project-Full-Flow/certify-sim10.mjs` | 10 stages; P3 NGO filter assertion |
| SIM-11 (SPO) | `simulations/SIM-11-Special-Purpose-Organizations-Project-Full-Flow/certify-sim11.mjs` | 10 stages; P9 banner assertion |

### 15.5 Course corrections captured here

1. **`seed-project-types.cjs` is a METADATA LOADER, not a DB seeder.** `ProjectType` is tenant-scoped (`schema.prisma:2210` — `tenantId` required for uniqueness). The 16 JSON files in `seeds/project-types/` are onboarding-time blueprints consumed by `OnboardingService.provisionProjectTypes()`. See `prisma/seed-helpers/seed-project-types.cjs` for the loader API: `loadProjectTypesForIndustry(slug)`.

2. **Two tenant-template models exist.** `DepartmentTemplate` (`schema.prisma:1346`) models a department structure JSON. `TenantTemplate` (`schema.prisma:5435`) is the richer lifecycle/role model. Every new Phase 2.B+ tenant-template seeder writes to **both** via `seed-tenant-template.cjs` + `seed-tenant-template-rows.cjs`.

3. **T8 FK is intra-group only.** `Package.parentPackageId` is a same-`(industryId, tierId)` FK. Cross-group inheritance (SPO inherits F&C accounting-operations) is documented via `parentPackageSlug` on the seed config and resolved at onboarding time by the `TenantBlueprintResolver`. The P9 admin banner surfaces the relationship read-only.

4. **`ApprovalAddon` interface uses `industrySlugs` + `getRoutes(tenantId)` + `getRoutesForEvent(tenantId, event)`.** Not `supports(context)` / `buildRoutes(context)` as plan §4.3.4 originally specified. The R3 `ApprovalAddonRegistry` impl matches the actual interface.

5. **FS tier-slug legacy.** `seed-financial-services-packages.cjs` was rewritten to use canonical `starter | professional | enterprise` (T1 fix). Was `basic | business | professional | enterprise`.

6. **`professional-legal` package CUT.** Removed from `seed-industry-packages.cjs` per T3 (legal services = cut criteria #1 violation). DB rows from prior seeds are not deleted (preserved for audit) but won't re-materialize on re-seed.

### 15.6 Per-Industry surface count

| Industry | Dept slot count | Agent default-selected | Packages | Project types | Workspace modules |
|---|---:|---:|---:|---:|---:|
| accounting-audit-services | 12 | 14 | 15 | 5 | 8 (all F&C) |
| financial-services | 8 | 8 | 8 | 13 | 8 (shared F&C, KPI-branch) |
| technology-digital-services | 7 | 7 | 8 | 12 | 4 (Tickets/Releases/Contracts/KB) |
| professional-business-services | 6 | 6 | 5 (post-T3) | 12 | 4 (reuse B&T) |
| retail-commerce-consumer | 7 | 5 | 8 | 13 | 7 (retail-only) |
| media-communications-creative | 5 | 4 | 5 | 13 | 2 (Campaigns/Content; others hidden via P3) |
| nonprofit-international | 6 | 4 | 7 | 13 | 4 (Programs/Grants/Field Ops/Cases) |
| special-purpose-organizations | 4 | 3 | 4 | 12 | 3 (Operations/Assets/Documents) |
| **Total** | **55** | **51** | **60** | **93** | **18 unique modules** |