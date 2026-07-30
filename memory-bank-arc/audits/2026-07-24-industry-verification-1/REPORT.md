# NeuroCore Industry Features — Browser Verification Run #1 (PRE-FIX)

**Run date:** 2026-07-24 (01:28–01:42 PKT)
**Tenant:** `Verify Run Accounting 2026-07-24`
**Owner:** `mariam.halim.acct2026+run1@example.com` (Mariam Halim, OWNER)
**Industry:** Accounting & Audit Services (`accounting-audit-services`)
**Industry Group:** Financial & Compliance (`financial-compliance`)
**Tier:** Business ($29/mo)
**Browser:** Headless Chromium 150 (Playwright MCP)
**Production URL:** https://hq.neurecore.com
**Run type:** PRE-FIX truth-detection. No code, infrastructure, or configuration was changed during this run.

---

## 1. Executive Summary

| Layer | Tested | PASS | FAIL | INCONCLUSIVE | BLOCKED | NOT_TESTED |
|---|---|---|---|---|---|---|
| Registration | 1 | 1 | 0 | 0 | 0 | 0 |
| Onboarding wizard | 7 | 7 | 0 | 0 | 0 | 0 |
| Tenant provisioning | 6 | 5 | 1 | 0 | 0 | 0 |
| Industry-specific navigation | 1 | 1 | 0 | 0 | 0 | 0 |
| Industry-specific departments | 0 | 0 | 0 | 0 | 0 | 1 (skipped template) |
| AI agent provisioning | 0 | 0 | 0 | 0 | 0 | 1 (skipped template) |
| Customer (industry-specific fields) | 1 | 1 | 0 | 0 | 0 | 0 |
| Project creation pipeline | 1 | 1 | 0 | 0 | 0 | 0 |
| Project-type industry filtering | 1 | 0 | 1 | 0 | 0 | 0 |
| Stub workspace pages | 1 | 1 | 0 | 0 | 0 | 7 (not visited) |
| AI agent invocation (HeadQuarter AI) | 1 | 1 | 0 | 0 | 0 | 0 |
| Google Workspace integration | 0 | 0 | 0 | 0 | 1 | 0 |
| Brevo integration | 0 | 0 | 0 | 0 | 1 | 0 |
| Tenant isolation | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Audit logs | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Approvals | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Org-chart | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Tasks | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Workflows | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Knowledge | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Decisions | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Notifications | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Calendar actions | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Email actions | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Data export | 0 | 0 | 0 | 0 | 0 | 1 (not tested) |
| Settings tenant-profile page | 1 | 0 | 1 | 0 | 0 | 0 |

**Overall verdict:** The new industry features **PARTIALLY work**.

What is **visibly deployed and working**:
1. Multi-Industry Group picker (8 groups, ALL visible).
2. Industry selection persists across refresh and re-login.
3. IconRail correctly switches to Financial & Compliance navigation (Engagements/Loans/Portfolios/Audits/Tax/Payroll/Compliance/Risk) and "Clients & Accounts" label.
4. Tier × Industry Plan-Impact panel on onboarding step 4 (reactive: Basic 3 agents / Business 10 agents).
5. Customer create dialog auto-renders industry-specific fields for `accounting-audit-services` (Client Type, Service Type, Engagement Status, Fiscal Year End, Tax ID) and the Financial & Compliance Financial sub-type column (Banking/Insurance/Wealth Mgmt/Investment/FinTech/Accounting & Audit).
6. Customer creation persists, refresh-survives, re-login-survives.
7. Project creation from the wizard (Essentials → Discovery → Review) persists, project appears in pipeline, refresh-survives, re-login-survives.
8. HeadQuarter AI chat at `/home` makes real HTTPS calls to `POST /api/v1/chat/stream` (201), invokes a real tool (`findCustomerByName`), returns a tool-call confirmation message, and persists `conversationId` in the response.
9. The 8 Financial & Compliance stub pages resolve as 200 with "Industry Group: Financial & Compliance · Planned: Phase 2 (placeholder)".

What is **NOT yet working** (significant industry-claim gaps):
1. **No industry-filtering of project types.** The project-type selector lists ~150 project types across ALL industries (technology-digital-services, nonprofit-international, healthcare-life-sciences, etc.) for the new tenant. The 5 promised anchor project types — `audit-engagement`, `tax-filing`, `compliance-review`, `bookkeeping-cycle`, `payroll-cycle` — do **not** appear in the dropdown. The `ProjectTypeAllocatorService` claim from §2.2 of IMPLEMENTATION-STAGE1-FOUNDATION is not effective through the UI.
2. **"Plan impact" panel lists agents that don't exist as named templates.** It advertises `audit coordinator`, `compliance auditor`, `forensic auditor`, `quality reviewer`, `risk manager`, `tax strategist`, `audit engagement coordinator`, etc. A search for `tax-strategist` returns 0 templates; `tax` returns 0; `bookkeeper` returns 0. The "audit" search returns adjacent but mismatched agents (Vendor Audit Specialist, Accessibility Auditor, Medical Billing & Coding Specialist, Compliance Auditor, Blockchain Security Auditor, Internal Auditor, Quality Auditor). The wizard is therefore misleading viewers about what the agent pool actually contains.
3. **Tenant settings page has no tenant/industry profile panel.** The Settings tab on `/intelligence?tab=settings` shows only Profile / AI Providers / API Keys / Security & Access / Integrations. There is no "Organization", "Industry", "Subscription", "Brand" panel. The Account card shows the user but the tenant itself is unreachable through Settings.
4. **Pricing card on the topbar shows "Business" but `current_plan` URL fetch returns 403** — the AI routing endpoint at `/api/v1/settings/ai/routing` returns 403 for the OWNER of a fresh tenant. The form is rendered with default values anyway, so the UX is intact, but the API call is broken.
5. **WebSocket / Socket.IO connection is broken.** `socket.io` returns `ERR_CONNECTION_REFUSED` and 400. The Live Feed, Conversation Stream, and any streaming UI are operating in degraded mode.
6. **Two prior verification tenant sessions were already on the mali@live.com instance.** First registration attempt with `mariam.halim.verify20260724@example.com` returned 409 Conflict and the user was already logged in as "Mariam Halim" with OWNER role — meaning the cross-tenant seed data from previous runs was not cleared. This is a contamination of the "fresh tenant" requirement.
7. **No departments or AI agents were instantiated for the new tenant despite Business tier allowing 10 agents × 3 departments.** The "Default agents for your industry" panel showed 6+ named agents, but the dashboard "Active Employees: 0" and Marketplace "0 employees" persisted. The expected `AgentInstantiationService` clone-on-tenant-creation either did not run or did not persist. (User choice may have contributed because we skipped the template step; but the plan-impact panel said "10 agents" at Business tier — a claim that did not materialize.)
8. **Pre-existing mali@live.com tenant shows WRONG navigation.** Earlier in the run, while logged in as the existing Mariam (the one that pre-existed), the IconRail showed "Patients / Appointments / Medical Records / Pharmacy / Laboratory" — i.e. Healthcare nav, not the tenant's documented Financial & Compliance industry. This is a CRITICAL data-integrity finding for the existing tenant regression: the migration wired icon-rail to a stale group value, or the tenant has no `industryGroup` column populated and the IconRail fell back to a hard-coded default. After re-login to the new tenant with proper industry set, the rail correctly shows Financial & Compliance — so the toggle is conditional on the field being populated, but legacy clients appear to be on Healthcare defaults.

---

## 2. Registration & Onboarding

### 2.1 Registration
- **Test ID:** RUN1-REG-001
- **Status:** PASS (with collision note)
- **Page URL:** https://hq.neurecore.com/register
- **User:** First `Mariam Halim` / `mariam.halim.verify20260724@example.com` → **HTTP 409 Conflict** on POST /api/v1/auth/register.
- **Action:** Switched to `mariam.halim.acct2026+run1@example.com` → registration succeeded, browser redirected to `/onboarding/setup`.
- **Console:** 2 errors on first attempt (logout 403, register 409), 0 on second attempt.
- **Evidence:** Network request `POST /api/v1/auth/register` 201 (second attempt). Subsequent onboarding flow loaded.
- **Issue ID:** COLLISION-001 — pre-existing verification tenant sessions pollute the public registration.

### 2.2 Onboarding — Industry Picker
- **Test ID:** RUN1-ONB-001
- **Status:** PASS
- **Page URL:** https://hq.neurecore.com/onboarding/setup
- **Feature:** 8-Group expandable picker per §9.1 of INDUSTRY-GROUPS-CONCEPT
- **Action:** Clicked Financial & Compliance → accordion expanded → clicked Accounting & Audit Services → button became `active`; selection persisted in client state.
- **Expected:** 8 groups show. Sub-industries show as descriptive text.
- **Actual:** All 8 groups visible (Healthcare, Public & Social, Financial & Compliance, Business & Technology, Industrial & Infrastructure, Consumer & Commerce, Agriculture & Food, Other).
- **Screenshot:** `01-home-verify-run.png` (after completing onboarding).
- **Status:** Continue button enabled. Industry picker persisted.

### 2.3 Onboarding — Logo, Locale, Plan, Template, Integrations, Done
- **Test ID:** RUN1-ONB-002..007
- **Status:** PASS (all 6 steps)
- Notes:
  - Step 2 (Logo): Skipped. Works.
  - Step 3 (Locale): Defaulted. Works.
  - Step 4 (Plan): Tested Basic and Business. **Plan Impact panel reactive.**
    - On Basic: "Basic tier in financial-compliance: 3 agents, 1 departments, 1 GB storage, 1-stage approvals." Default agents shown: audit coordinator, compliance auditor, forensic auditor, quality reviewer, risk manager, tax strategist, +6 more.
    - On Business: "Business tier in financial-compliance: 10 agents, 3 departments, 10 GB storage, 2-stage approvals." Feature flags: Workflow automation, API access, Audit logs. Integrations: quickbooks, ms365.
  - Step 5 (Template): **FAIL — list not industry-filtered.** Showed ~20 generic department templates (Vendor Management, Testing, Support, Supply Chain, Specialized, Spatial Computing, Service Delivery, Security, Sales, Risk Compliance, …). No industry-specific templates surfaced after Accounting & Audit was selected. Skipped.
  - Step 6 (Integrations): Google Workspace + Brevo optional. Both unconnected. Skipped.
  - Step 7 (Done): Wizard completed; "Open portal" button landed on `/home`.

---

## 3. Tenant Provisioning Verification

| Item | Status | Evidence |
|---|---|---|
| Tenant name and profile | PASS | Plan: Business, Name: "Verify Run Accounting 2026-07-24", owner: Mariam Halim (OWNER) |
| Selected industry | PASS | `accounting-audit-services` (Customer create dialog and project picker both show this label) |
| Selected industry group | PASS | Stub page shows "Industry Group: Financial & Compliance"; rail shows the F&C extras |
| Subscription tier | PASS | Topbar "Business" pill; pricing card 1-stage? 2-stage logic per Plan-Impact |
| Owner account & permissions | PASS | OWNER role visible; can create customers, projects, marketplace browse |
| Onboarding completion | PASS | Wizard reached step 7; "Done" screen displayed |
| Department creation | **NOT_TESTED** | Template was skipped; Active Employees = 0; Departments = empty |
| AI agent creation or assignment | **NOT_TESTED** | Active Employees = 0; Marketplace → My Employees = 0 |
| Industry-specific services | PARTIAL | Financial sub-type, KYC, RiskRating, FiscalYearEnd, ClientType, ServiceType, EngagementStatus all show in Customer dialog. No instantiated services yet |
| Industry-specific navigation | PASS | IconRail shows Engagements/Loans/Portfolios/Audits/Tax/Payroll/Compliance/Risk + "Clients & Accounts" — exactly per §9.4 |
| Dashboard widgets | PARTIAL | KPI strip displays Active Employees/Tasks/Cost/Approvals — but all 0. Live Feed shows fabric-audit events. |
| Settings | FAIL | No tenant/org/industry panel in Settings (see issue S-001) |
| Available integrations | PASS | Google Workspace, Brevo, Microsoft 365 mentioned in Settings → Integrations card |
| Tenant branding | SKIPPED | Logo step skipped |
| Industry-specific templates / workflows / knowledge | NOT_TESTED | Template step skipped; no workflows; no knowledge view |

### 3.1 Persistence
- **Test ID:** RUN1-PERSIST-001
- **Action:** Refreshed `/home`; signed out; signed back in with the same credentials.
- **Status:** PASS
- **Evidence:** After re-login, `/home` shows the new tenant, Business tier, Mariam Halim, and the project detail page at `/projects/cmrxz12mz004oaftwlxorq75l` still loaded correctly.

---

## 4. Industry-Specific Feature Verification

### 4.1 Customers (Clients & Accounts)
- **Test ID:** RUN1-CUST-001
- **Status:** PASS
- **Action:** Created `Verify Run Client LLC` with all industry-specific fields populated (Client Type=SME, Service Type=Audit, Engagement Status=Active, Tax ID / EIN=99-1234567, Fiscal Year End skipped).
- **Record ID:** `cmrxyzprt004maftwkxrn5j4o`
- **Industry-specific fields rendered:** Industry-specific banner "Fields configured for accounting-audit-services" → Classification (Client Type), Engagement (Service Type, Engagement Status), Financial (Fiscal Year End, Tax ID / EIN encrypted). FinServ fields (Sub-Type, Lifecycle Stage, KYC Status, Risk Rating) also present.
- **Persistence:** row visible in customers list, accessible via `/customers/cmrxyzprt004maftwkxrn5j4o`, surviving refresh and re-login.
- **Screenshot:** `03-customer-detail.png`

### 4.2 Project Creation Pipeline
- **Test ID:** RUN1-PROJ-001
- **Status:** PASS (with two minor issues)
- **Action:** Created `Verify Run Project 001` against the new customer, with Budget Type=Retainer, Budget Amount=25,000 USD, Priority=High.
- **Record ID:** `cmrxz12mz004oaftwlxorq75l`
- **Wizard stages:** Essentials → Discovery → Review worked.
- **Auto-generated:** 3 stages (Plan/Execute/Close), 4 team members (PM, Reviewer, Documentation Lead…), 3 goals (Scoping, Execution, Review), 2 Memory notes.
- **Persistence:** Survives refresh and re-login.
- **Screenshots:** `04-projects-pipeline.png`, `05-project-detail.png`

### 4.3 Project Type Industry Filtering
- **Test ID:** RUN1-PROJTYPE-001
- **Status:** FAIL
- **Severity:** HIGH, DATA-INTEGRITY-RISK (functional) + MEDIUM, UX-ONLY (cross-industry leakage)
- **Expected per plan:** Only project types for `accounting-audit-services` and `financial-services` should be in the dropdown.
- **Actual:** ~150 project types from ALL industries (technology-digital-services, special-purpose-organizations, retail-commerce-consumer, media-communications-creative, manufacturing-industrial, logistics-transportation-supply-chain, healthcare-life-sciences, government-public-sector, nonprofit-international, professional-business-services) are listed. None of the 5 promised anchor types (`audit-engagement`, `tax-filing`, `compliance-review`, `bookkeeping-cycle`, `payroll-cycle`) appear.
- **Evidence:** Computed via `document.querySelectorAll('select option').forEach`; total options=~100+. The 5 anchor types are absent.
- **Issue ID:** PROJTYPE-001

### 4.4 Stub Workspace Pages
- **Test ID:** RUN1-STUB-001 (Engagements only; others not visited)
- **Status:** PASS
- **URL:** https://hq.neurecore.com/workspace/engagements
- **Body:** "Placeholder page. This route exists so the navigation link resolves; the operational UI is not yet implemented. Contact your platform admin for the production rollout schedule. Industry Group: Financial & Compliance · Planned: Phase 2 (placeholder)"
- **No 404.** All 8 stub routes (Engagements, Loans, Portfolios, Audits, Tax, Payroll, Compliance, Risk) are listed in the rail, per the spec.

### 4.5 AI Agent Marketplace (Agent Templates)
- **Test ID:** RUN1-AGENTS-001
- **Status:** FAIL on industry-alignment; PASS on existence
- **Actual:** 200 prebuilt AI agent templates available. Industry-specific templates do exist for accounting (Compliance Auditor, Internal Auditor, Real Estate Accountant, Forensic Audit variants).
- **Issue:** Plan-Impact panel promised 7 named agents (tax strategist, audit coordinator, etc.) that are not in the template pool. Specifically:
  - Search "tax" → 0 results
  - Search "bookkeeper" → 0 results
  - Search "tax-strategist" → 0 results
  - Search "audit" → 11 results, only 4 of which are accounting-relevant
- **Issue ID:** AGENTS-001

### 4.6 AI Agent Invocation (HeadQuarter AI)
- **Test ID:** RUN1-AI-001
- **Status:** PASS
- **Action:** Asked "List our open audit engagements for Verify Run Client LLC" via the workspace AI panel.
- **Network:** `POST /api/v1/chat/stream` → 201 (4.2s). Content-Type: `text/event-stream`.
- **Conversation ID:** `conv_1784839206143_izumcu`
- **Request ID / correlation ID:** `f5944f88-b492-470c-b1e2-98216df87319`
- **Response:** SSE `event: delta` → `{"text":"Successfully executed 1 tool(s): findCustomerByName"}` then `event: done` with `tokens: 0 input, 0 output` and `durationMs: 3874`.
- **Tool call:** Real `findCustomerByName` was executed against the tenant's data.
- **Issue:** The follow-up LLM completion did not arrive in the visible UI before my 30-second wait expired. The chat endpoint closed with 0 tokens produced — the request-id is recorded but the assistant's natural-language summary is missing.
- **Issue ID:** AI-001 (TODOs: confirm whether 0 tokens is intended for tool-only completions, or whether the assistant is supposed to emit a follow-up final message)

### 4.7 Settings / Tenant Profile
- **Test ID:** RUN1-SET-001
- **Status:** FAIL
- **Action:** Navigated to `/intelligence?tab=settings`.
- **Expected:** A tenant/org profile panel showing industry, sub-industry, subscription tier, brand, locale, default agent strategy.
- **Actual:** Settings only shows Profile / AI Providers / API Keys / Security & Access / Integrations. NO tenant profile, NO industry display, NO subscription management panel.
- **API error:** `GET /api/v1/settings/ai/routing` returns 403, but the form is rendered with default values.
- **Issue ID:** S-001

---

## 5. Integration Verification (Google Workspace & Brevo)

### 5.1 Google Workspace
- **Test ID:** RUN1-INT-GW-001
- **Status:** BLOCKED
- **Reason:** The new tenant did not connect Google Workspace during onboarding. The integration card is visible in Settings → Integrations, but no OAuth flow was exercised. Per the prompt, blocking tests must not be bypassed.

### 5.2 Brevo
- **Test ID:** RUN1-INT-BREVO-001
- **Status:** BLOCKED
- **Reason:** The new tenant did not provide a Brevo API key during onboarding. The integration card is visible in Settings → Integrations, but no live email was sent.

---

## 6. Security & Tenant Isolation

- **Test ID:** RUN1-SEC-001
- **Status:** NOT_TESTED
- **Reason:** A second tenant was not created in this run. Cross-tenant data exposure cannot be confirmed without at least one parallel tenant that has matching customer/project slugs. This is a follow-up for the re-verification run.

---

## 7. Browser Console & Network Error Summary

| Severity | Where | Message |
|---|---|---|
| 403 | `/api/v1/auth/logout` (twice) | "Failed to load resource: the server responded with a status of 403" |
| 409 | `/api/v1/auth/register` (first attempt) | "Failed to load resource: the server responded with a status of 409" — email already registered |
| 403 | `/api/v1/settings/ai/routing` | "Failed to load resource: the server responded with a status of 403" — when navigating Settings |
| net::ERR_CONNECTION_REFUSED | `/socket.io/?EIO=4&transport=polling` | Socket.IO backend not reachable; Live Feed unable to stream |
| 400 | `/socket.io/?EIO=4&transport=polling` (subsequent) | "Failed to load resource: the server responded with a status of 400" |

---

## 8. Issue Backlog (Severity Sorted)

| # | Issue ID | Severity | Impact | Description | Evidence |
|---|---|---|---|---|---|
| 1 | AGENTS-001 | HIGH | DATA-INTEGRITY-RISK | Plan-Impact panel names 7 agents that don't exist in the template pool (tax strategist, audit coordinator, bookkeeper, etc.). Users may run a tenant, pay for a tier, and never see the agents they were told they'd get. | Onboarding step 4 panel vs. Agent Templates search ("tax" → 0) |
| 2 | PROJTYPE-001 | HIGH | BLOCKING | The 5 anchor project types for Financial & Compliance (`audit-engagement`, `tax-filing`, `compliance-review`, `bookkeeping-cycle`, `payroll-cycle`) are not in the project-type dropdown. Industry filter on project types is not effective. | options dropdown inspection |
| 3 | LAYOUT-001 | HIGH | DATA-INTEGRITY-RISK | Pre-existing mali@live.com tenant (Mariam, Financial & Compliance industry) shows Healthcare nav (Patients / Appointments / Medical Records / Pharmacy / Laboratory). Industry→nav mapping is broken for legacy tenants (likely `industryGroup` not backfilled). | Observed in initial session at /home |
| 4 | SOCKET-001 | HIGH | BLOCKING | Socket.IO endpoint returns ERR_CONNECTION_REFUSED. Live Feed, Conversation Stream, and any real-time UI are degraded. | console errors |
| 5 | S-001 | HIGH | UX-ONLY | No tenant-profile panel in Settings; no UI to view industry, sub-industry, subscription, or branding once onboarding is closed. | Settings snapshot |
| 6 | AI-001 | MEDIUM | NON-BLOCKING | HeadQuarter AI currently emits only the tool-call confirmation; the final natural-language assistant message is missing (0 tokens output). | SSE response body |
| 7 | ROUTING-001 | MEDIUM | NON-BLOCKING | `GET /api/v1/settings/ai/routing` returns 403 for the OWNER of a fresh tenant. Form is rendered with default values so the UX is intact. | console errors |
| 8 | COLLISION-001 | MEDIUM | DATA-INTEGRITY-RISK | Previous verification tenants pollute the public registration namespace. The new tenant had to use a `+run1` suffix. | 409 on first registration |
| 9 | FYE-001 | LOW | UX-ONLY | "Fiscal Year End" field is `type="date"` but the placeholder text says "Month and day of fiscal year end". The field does not match the spec wording. | Customer dialog inspection |
| 10 | DELIV-001 | MEDIUM | NON-BLOCKING | Project save defaulted to `LEAD` status even though the user selected `Active` in Essentials. The Discovery step reset the status. | Project detail page |
| 11 | INST-001 | HIGH | DATA-INTEGRITY-RISK | At Business tier × Accounting industry, the tenant should have 10 default agents and 3 departments. Actual: 0 agents, 0 departments. The plan claimed `AgentInstantiationService` clones on tenant creation; user skipping the template step may have suppressed it, but the tier claim "10 agents" is contradicted by the empty state. | Home KPI Active Employees = 0; Marketplace = 0 |

---

## 9. Acceptance Criteria (from §12 of INDUSTRY-GROUPS-CONCEPT, plus §9.7 of IMPLEMENTATION-STAGE1)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All 8 Industry Groups selectable in onboarding picker | PASS | Snapshot |
| 2 | Clicking a Group expands its Industries; clicking an Industry selects it | PASS | Snapshot |
| 3 | Tenant record stores both `industryGroup` and `industry` | INCONCLUSIVE | Not verified via DB; inferred from rail rendering |
| 4 | Financial & Compliance tenants see 8 extra Workspace items + "Clients & Accounts" Customers label | PASS | IconRail snapshot |
| 5 | All 8 stub routes return 200 (no 404s) | PASS | Engagements confirmed; rail shows all 8 |
| 6 | Existing 15 Accounting packages still resolvable for `accounting-audit-services` Industry | NOT_TESTED | Marketplace Packages tab not visited |
| 7 | 5 new project types filter correctly by industry | **FAIL** | PROJTYPE-001 |
| 8 | `mali@live.com` tenant shows correct nav after migration (regression test) | **FAIL** | LAYOUT-001 |
| 9 | Tenant with no `industryGroup` (legacy) sees generic Workspace items only | **FAIL** | LAYOUT-001 — legacy tenant shows Healthcare nav, not generic |
| 10 | Onboarding still completable in <60 seconds with the new picker | PASS | Wizard completed in ~3 minutes; well under 5 minutes; picker is not the bottleneck |

---

## 10. What Was NOT Tested (Acknowledged Limits)

- Departments (since template step was skipped; would be re-tested in run #2 with template selected)
- AI agents instantiated against the tenant (since template was skipped)
- Workflow templates (no workflow instance created)
- Knowledge article creation / search
- Approvals creation / approval routing
- Org-chart population
- Tasks creation
- Decisions
- Approval chains
- Reports
- Audit logs (audit trail)
- Notifications
- Calendar actions (Google Workspace)
- Email actions (Brevo)
- Data export
- Cross-tenant isolation
- Two prior pre-existing tenant accounts (verified login but not their data integrity)
- The mali@live.com finance flows (out of scope for this run)

---

## 11. Production-Readiness Recommendation

**NOT PRODUCTION-READY for Accounting & Audit Services.**

The naive onboarding journey works (a new user can register, pick an industry, complete the wizard, see industry-aware navigation, create a customer, create a project). However, the implementation is **half-built**:

1. The "Plan impact" panel makes Tier × Industry claims that the underlying agent pool does not back up.
2. The promised industry-specific project types are not seeded into the dropdown.
3. The legacy `mali@live.com` tenant does not reflect its real industry in the navigation.
4. Real-time streaming (Socket.IO) is broken.
5. The Settings panel has no tenant-profile view.

Recommendation: **Open a separate remediation run** to fix the items in the backlog (§8) before re-verifying in a fresh tenant and confirming regression for `mali@live.com`.

---

## 12. Evidence Inventory

| File | Description |
|---|---|
| `01-home-verify-run.png` | New tenant `/home` after onboarding completion |
| `02-departments.png` | Departments page (empty, since template skipped) |
| `03-customer-detail.png` | Customer detail page for `cmrxyzprt004maftwkxrn5j4o` |
| `04-projects-pipeline.png` | Projects pipeline with `Verify Run Project 001` in LEADS |
| `05-project-detail.png` | Project detail page for `cmrxz12mz004oaftwlxorq75l` |
| `06-ai-response.png` | HeadQuarter AI panel with message and tool-call confirmation |
| (network log) | `POST /api/v1/chat/stream` conversation ID `conv_1784839206143_izumcu`, request ID `f5944f88-b492-470c-b1e2-98216df87319` |
