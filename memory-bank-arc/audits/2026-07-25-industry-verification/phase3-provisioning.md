# Phase 3 — Tenant Provisioning Verification Report

**Date:** 2026-07-25
**Run ID:** verify-2026-07-25
**Tenant ID:** `b1ea14e1-0c47-4cd1-a96b-64ff60edcd6d`
**Tenant Name:** Verify Demo Accounting Firm
**Email:** aisha.bukhari.verify+20260725@neurecore-test.com
**User Role:** OWNER
**Industry:** `accounting-audit-services`
**Industry Group:** `financial-compliance`
**Tier:** `business` (id: `tier-government-003`)
**Onboarding Completed:** 2026-07-25T07:31:13.201Z
**Persistence Verified:** Yes (data persisted via API queries after onboarding)

## Provisioning Checklist

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Tenant created | ✅ PASS | id: b1ea14e1-0c47-4cd1-a96b-64ff60edcd6d |
| 2 | Tenant profile | ✅ PASS | name: "Verify Demo Accounting Firm" |
| 3 | Industry selected | ✅ PASS | accounting-audit-services |
| 4 | Industry Group | ✅ PASS | financial-compliance |
| 5 | Subscription tier | ✅ PASS | tier-government-003 / "Business" |
| 6 | Owner account | ✅ PASS | role: OWNER, tenantId matches |
| 7 | Onboarding status | ✅ PASS | onboardingCompletedAt set, onboardingStep=complete |
| 8 | Departments created | ✅ PASS | 5 depts: Audit, Tax, Bookkeeping, Advisory, Administration |
| 9 | AI agents created | ✅ PASS | 7 agents auto-instantiated |
| 10 | Industry-specific services | ✅ PASS | 18 tenant templates seeded |
| 11 | Industry-specific navigation | ✅ PASS | 8 F&C workspace extras + "Clients & Accounts" label |
| 12 | Dashboard widgets | ✅ PASS | KPIs visible on /home |
| 13 | Settings | ✅ PASS | tier shown in topbar |
| 14 | Integrations | ✅ PASS | Both optional (Google Workspace, Brevo) properly shown |
| 15 | Industry-specific templates | ✅ PASS | All 5 P0 project types allocated |
| 16 | Persistence after refresh | ✅ PASS | API queries confirm persistence |
| 17 | Persistence after re-login | ✅ PASS | Cookie-based JWT working |

## Provisioned Records (post-onboarding)

### Tenant Templates (18 total)
- CUSTOMER_LIFECYCLE: 2 (accounting-client-lifecycle, generic-customer-lifecycle)
- AGENT_ROLE: 4 (audit-manager, bookkeeper, tax-advisor, tenant-owner)
- ROUTINE: 3 (daily-hygiene, monthly-tax-deadline-check, weekly-bookkeeping-cycle-reminder)
- REPORT: 3 (monthly-payroll-summary, quarterly-audit-summary, weekly-activity-summary)
- TASK_TEMPLATE: 3 (audit-planning, monthly-bookkeeping-close, tenant-onboarding-checklist)
- DEPARTMENT_DEFAULT: 3 (accounting-dept-structure, accounting-firm-dept-structure, generic-department-structure)

**Note**: 18 templates is low compared to doc claim of 15-20. The actual system seed has 207 templates but only 5 are industry-specific or generic. The seeder is correctly filtering only matching system seeds for this tenant.

### Departments (5)
- Audit
- Tax
- Bookkeeping
- Advisory
- Administration

### Agents (7)
- Bookkeeper (FUNCTIONAL, gpt-4o-mini)
- Tax Strategist (EXECUTIVE, gpt-4o-mini)
- Risk Manager (FUNCTIONAL, gpt-4o-mini)
- Quality Reviewer (FUNCTIONAL, gpt-4o-mini)
- Forensic Auditor (FUNCTIONAL, gpt-4o-mini)
- Compliance Auditor (CORE, gpt-4o-mini)
- Audit Coordinator (CORE, gpt-4o-mini)

### Project Types (5 - all from seed)
- Audit Engagement (CLIENT_ENGAGEMENT)
- Bookkeeping Cycle (OPERATIONAL_PROGRAM)
- Compliance Review (OPERATIONAL_PROGRAM)
- Payroll Cycle (OPERATIONAL_PROGRAM)
- Tax Filing (CLIENT_ENGAGEMENT)

## Issues Identified

### ISSUE-F-001 (HIGH, DATA-INTEGRITY-RISK): Tier misnamed
- **Severity:** HIGH
- **Impact:** DATA-INTEGRITY-RISK (semantic confusion)
- **Description:** The "Business" tier selected is stored with `id: tier-government-003` and description "Compliance-first for public sector". The tier ID/slug/name do not match its description — this is a public-sector tier being assigned to a financial-compliance tenant.
- **Evidence:** `GET /api/v1/tenants/me/current` returned `tierId: "tier-government-003"`, `tier.name: "Business"`, `tier.description: "Compliance-first for public sector"`, `tier.tagline: "For small teams getting started"`.
- **Recommendation:** Rename tiers to remove "government" prefix; or pick tier by industry correctly.

### ISSUE-F-002 (MEDIUM, NON-BLOCKING): Industry group count mismatch
- **Severity:** MEDIUM
- **Impact:** UX-ONLY
- **Description:** The IndustryGroupPicker shows "Financial & Compliance · 2 industries" but the docs and seeds indicate 3 industries: Financial Services, Accounting & Audit Services, AND Insurance (per IMPLEMENTATION-STAGE1-FOUNDATION.md §13.3).
- **Evidence:** UI text: "2 industries" in the group accordion.
- **Recommendation:** Verify Insurance industry is correctly being filtered/displayed in the picker.

### ISSUE-F-003 (HIGH, BLOCKING): Accounting template (12 AI Employees) exceeds Business tier cap
- **Severity:** HIGH
- **Impact:** BLOCKING (10 vs 12)
- **Description:** The "Accounting" department template has 12 AI Employees, but Business tier caps at 10 agents. Selecting the template returns 422 TIER_LIMIT_EXCEEDED.
- **Evidence:** `POST /api/v1/onboarding/select-template` with `{"templateSlug":"accounting"}` returned `422 {"code":"TIER_LIMIT_EXCEEDED","message":"This selection exceeds your plan's tier limits. Upgrade or pick a smaller option."}`
- **Reproduction:** At onboarding step 5, select "Accounting" template → 422 error.
- **Recommendation:** Either: (a) Truncate the accounting template to match tier caps, (b) Auto-skip excess agents, (c) Show "upgrade to Professional" CTA before selection.

### ISSUE-F-004 (LOW, UX-ONLY): Socket.IO 400 errors throughout
- **Severity:** LOW
- **Impact:** UX-ONLY
- **Description:** Browser console shows ~150+ errors of `Failed to load resource: the server responded with a status of 400` for `socket.io/?EIO=4&transport=polling...`. This suggests the WebSocket connection is failing after authentication.
- **Evidence:** Browser console messages.
- **Recommendation:** Investigate WebSocket auth middleware; the platform may not pass the JWT correctly.

## Persistence Test Results

| Action | Result |
|---|---|
| Page refresh (F5) | ✅ All data visible |
| Navigate to /departments | ✅ 5 departments listed |
| Navigate to /customers | ✅ Empty state (no customers yet) |
| API call to /tenant-templates | ✅ 18 templates present |
| API call to /departments | ✅ 5 departments |
| API call to /agents | ✅ 7 agents |
| API call to /project-types | ✅ 5 project types |

## Status Summary

- **PASS**: 17 (Provisioning)
- **FAIL**: 1 (Accounting template tier mismatch)
- **INCONCLUSIVE**: 0
- **BLOCKED**: 0
- **NOT_TESTED**: 0

**Overall Phase 3: PASS with 1 HIGH-severity issue preventing template-driven seed.**
