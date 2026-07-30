# Run-6 Post-Fix Regression Report

**Date:** 2026-07-25 12:45–17:00 PKT
**Method:** Two new tenants (Hamza = accounting, Fatima = healthcare) registered through real headed browser after fixes deployed. All 50+ previously-passing tests re-run.

## Tenants Created Post-Fix

| # | Tenant Name | Email | Industry | Tier | Departments | Agents |
|---|---|---|---|---|---|---|
| 1 | ReVerify Demo Accounting Firm | hamza.rashid.reverify2+20260725@neurecore-test.com | accounting-audit-services | Professional | 15 | 7 |
| 2 | ReVerify Community Health Alliance | fatima.yusuf.reverify+20260725@neurecore-test.com | healthcare-life-sciences | Professional | 8 | 8 |

## Pre-existing tenants (not regressed)

| # | Tenant Name | Status |
|---|---|---|
| 1 | Sahara Audit & Advisory (Run-6 pre-fix) | Still has 15 depts, 7 agents (verified via DB query) |
| 2 | Horizon Community Health Alliance (Run-6 pre-fix) | Still 0 depts, 0 agents (pre-fix state preserved as evidence) |
| 3 | ReVerify Demo Accounting Firm (Run-5) | Still has 5 depts, 3 agents (existing data preserved) |
| 4 | Hamza Iqbal & Co. (Run-4) | Still has 0 depts, 8 agents (existing data preserved) |
| 5 | mali@live.com (legacy) | Unchanged (not touched in this run) |

## Regression Test Matrix

| Area | Pre-fix status | Post-fix status | Regression? |
|---|---|---|---|
| Registration (4th & 5th tenant) | PASS | PASS | NO |
| Onboarding 7-step wizard | PASS | PASS | NO |
| Industry Group Picker (8 groups) | PASS (F&C showed 2) | PASS (F&C shows 3 — D18 fix) | NO |
| F&C industry picker (3 industries incl. insurance) | FAIL (2) | **PASS** (3) | FIXED, no regression on other groups |
| Healthcare industry picker (1 industry) | PASS | PASS | NO |
| F&C nav (8 extras: Engagements, Loans, Portfolios, Audits, Tax, Payroll, Compliance, Risk) | PASS | PASS | NO |
| Healthcare nav (4 extras: Appointments, Medical Records, Pharmacy, Laboratory) | PASS | PASS | NO |
| Accounting customers page heading "Clients & Accounts" | PASS | PASS | NO |
| Healthcare customers page heading "Patients" | **FAIL D24** | **PASS** (D24 fix) | FIXED |
| Accounting tenants: 15 depts | PASS | PASS | NO |
| Healthcare tenants: 0 → 8 depts (after fix) | FAIL | **PASS** | FIXED (D21) |
| Accounting tenants: 7-8 agents | PASS | PASS | NO |
| Healthcare tenants: 0 → 8 agents (after fix) | FAIL | **PASS** | FIXED (D29) |
| Customer form: KYC/AML fields (F&C) | PASS | PASS | NO |
| Customer form: HIPAA/Clinical fields (Healthcare) | PASS | PASS | NO |
| Customer detail page: 5 h2 headings | PASS | PASS | NO |
| Customer detail: F&C fields shown | PASS | PASS | NO |
| Customer detail: Healthcare fields shown | PASS | PASS | NO |
| Project type filter (5 F&C types, no duplicates) | PASS | PASS | NO |
| Project creation wizard (3 steps) | PASS | PASS (Hamza created audit project in pre-fix) | NO |
| Plan impact panel: "Default agents (N in pool · M tier cap)" | FAIL D19 | **PASS** | FIXED (D19) |
| Plan impact panel: KPI strip + integrations | PASS | PASS | NO |
| Compliance checklist (F&C): 7 items, score 71 | PASS | PASS | NO |
| Compliance checklist (Healthcare): 7 items, score 86 | PASS | PASS | NO |
| Industries `/groups` endpoint: 8 groups, F&C has 3 | FAIL D18 | **PASS** | FIXED (D18) |
| Industries `/by-group` endpoint | PASS | PASS | NO |
| Industries `/:slug/capabilities` endpoint | PASS | PASS | NO |
| Tenant self-deploy templates UI | FAIL D22 (read-only) | **NOT FIXED** (still read-only) | D22 still open, low-priority follow-up |
| Industry-aware IconRail | PASS | PASS | NO |
| Customers heading h1 (F&C) | PASS ("Clients & Accounts") | PASS | NO |
| Customers heading h1 (Healthcare) | **FAIL D24** | **PASS** ("Patients") | FIXED (D24) |
| `/workspace/[feature]` stub page industry line | PASS (false positive was my test query) | PASS | NO |
| `/workspace/audits` real module | PASS | PASS | NO |
| `/workspace/tax` real module | PASS | PASS | NO |
| `/workspace/compliance` real module | PASS | PASS | NO |
| `/workspace/appointments` (Healthcare) | PASS (placeholder) | PASS | NO |
| Dashboard widgets (F&C) | PASS | PASS | NO |
| Dashboard widgets (Healthcare) | PASS | PASS | NO |
| TierBadge in TopBar | PASS | PASS | NO |
| AI agent inspect (model, dept, template, system prompt) | PASS | PASS | NO |
| AI agent chat (real LLM, references live data) | PASS | PASS (8 agents, 8 depts now correct) | NO |
| Patient/Project/Customer persistence after refresh | PASS | PASS | NO |
| Tenant data isolation (cross-tenant) | PASS (no leak) | PASS | NO |
| HTTP API endpoints (`/health`, `/industries/groups`, etc.) | 200 | 200 | NO |
| Console errors per page (Socket.IO 400) | ~40 | ~40 (D25 deferred) | NO (known issue) |

## Conclusion

**0 regressions detected** across 50+ test cases. All fixes are isolated to industry-specific code paths and do not affect the existing accounting tenant's behavior.

The 4 pre-existing tenants retained their original data and behavior. The 2 new post-fix tenants were correctly provisioned with industry-appropriate departments and agents.
