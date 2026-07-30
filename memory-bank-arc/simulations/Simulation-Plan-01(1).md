# NeureCore Frontend Browser Simulation and Defect-Discovery Plan

**Simulation ID:** SIM-01  
**Scenario:** Accounting Project Management Through AI Employees  
**Version:** 2.0  
**Date:** 2026-07-25  
**Tenant:** `umarabdullah@gmail.com`  
**Tenant industry:** Accounting & Audit Services (`accounting-audit-services`)  
**Test customer:** Bakers Pizza  
**Primary frontend:** `https://hq.neurecore.com`  
**Execution method:** Headed browser automation through the supported Playwright browser tool  
**Status:** PENDING APPROVAL  

> This is a destructive-capable test in a live tenant. Use only the designated test tenant and clearly label all generated records with the simulation ID.

---

## 1. Mission

Fully exercise NeureCore through its frontend browser as a real tenant user, discover functional and user-experience defects, preserve evidence, and produce an actionable issue register for the development team.

The simulation must test more than the happy path. It must verify:

1. Authentication, session handling, and tenant isolation.
2. Navigation, responsive layout, forms, filters, search, tables, and details pages.
3. Customer and project creation, editing, persistence, relationships, and lifecycle controls.
4. AI employee discovery, assignment, execution, review, retry, and auditability.
5. Accounting-specific workflows and financial/reporting surfaces.
6. Validation, error recovery, duplicate prevention, refresh behavior, and browser-history behavior.
7. Accessibility basics, performance symptoms, console errors, and failed network requests.
8. Data integrity across every UI surface where the same record appears.
9. Cleanup or clear identification of all records created by the simulation.

The purpose is defect discovery, not merely demonstrating that the workflow can be completed.

---

## 2. Non-Negotiable Execution Rules

The testing AI must follow these rules:

1. **Frontend only:** Perform business actions through the browser UI. Do not use backend APIs, database access, scripts, or direct requests to create, modify, or delete business records.
2. **Browser tooling exception:** Browser developer telemetry may be inspected for console errors, page errors, request failures, status codes, and timing. It must not be used to bypass the UI.
3. **No invented success:** Mark a check as passed only when the expected state is visibly confirmed.
4. **No silent assumptions:** If a label, field, or workflow differs from the plan, record the actual behavior and determine whether it is an acceptable implementation difference or a defect.
5. **Record every issue:** Log all reproducible and non-reproducible anomalies, including visual defects, misleading copy, inconsistent labels, slow operations, console errors, and broken requests.
6. **Do not ignore known issues:** Previously known errors must be recorded when observed and linked to an existing issue if an identifier is available.
7. **Continue safely:** After a failure, capture evidence, try one safe recovery, and continue with independent tests. Do not repeatedly submit actions that may create duplicates.
8. **Avoid destructive production impact:** Do not modify unrelated tenant data, invite real users, send external messages, issue real invoices, initiate payments, or publish content.
9. **Credential hygiene:** Obtain the password from the approved secret/environment mechanism at runtime. Never write it into screenshots, reports, prompts, logs, source files, or issue records.
10. **Evidence first:** Capture the state before navigating away from a defect.
11. **Unique test data:** Prefix or suffix created records with `[SIM-01]` where the UI permits.
12. **Truthful coverage:** Untested, blocked, unavailable, and not-applicable checks must never be counted as passed.

---

## 3. Scope

### 3.1 In scope

- Login, logout, failed login, session persistence, session expiry behavior.
- Tenant identity and accounting-industry configuration.
- Global and contextual navigation.
- Dashboard widgets, empty/loading/error states, and links.
- Customers: list, search, sort, filter, pagination if present, create, validation, view, edit, and duplicate behavior.
- Projects: list, create, validation, customer relationship, edit, status/stage progression, tasks, deliverables, activity, and completion.
- Departments, Marketplace, Workspace, Finance, Intelligence, and Settings: visibility, routing, load state, and obvious role/industry relevance.
- AI employees: availability, assignment, prompt submission, execution states, output, error handling, review, retry, and activity trace.
- Accounting-specific project stages, financial controls, and report templates.
- Cross-page data consistency and persistence after refresh and relogin.
- Baseline accessibility, responsive behavior, visual consistency, and browser telemetry.

### 3.2 Out of scope unless explicitly approved

- Backend/API testing independent of UI activity.
- Database inspection or direct data repair.
- Load, stress, penetration, or vulnerability exploitation.
- Real financial transactions, payments, invoices, emails, or third-party messages.
- Destructive testing against pre-existing tenant records.
- Cross-browser certification beyond the configured primary browser.

---

## 4. Test Environment and Preconditions

| Item | Required state | Verification |
|---|---|---|
| Test authorization | Approved | Record approver and time |
| Frontend | Reachable at `https://hq.neurecore.com` | Load login page |
| Tenant account | Exists and is enabled | Successful login |
| Credential | Available securely at runtime | Do not expose value |
| Tenant industry | `accounting-audit-services` | Confirm in UI/settings |
| Browser | Headed Chromium/Chrome through supported tool | Record version if available |
| Viewports | Desktop and narrow/mobile-width smoke check | Record actual sizes |
| Evidence directory | Writable | Create before execution |
| Existing customer/project | Identify potential naming collisions | Search before create |
| Time zone | Record browser and tenant time zone | Compare timestamps |

### 4.1 Stop conditions

Stop the affected workflow and report a blocker if:

- The test tenant cannot be authenticated after one careful retry.
- The visible tenant is not the designated tenant.
- Testing risks modifying another tenant or unrelated production records.
- A page exposes another tenant’s data.
- An action may send a real payment, invoice, email, invitation, or external notification.
- Repeated submissions could corrupt or multiply records.
- The browser shows a security/privacy incident.

Tenant isolation or unintended data exposure is a **Critical** defect and must be escalated immediately.

---

## 5. Test Data

Use the following values where the UI supports them:

| Entity | Field | Value |
|---|---|---|
| Customer | Name | `[SIM-01] Bakers Pizza` |
| Customer | Industry | Restaurant / Food Service |
| Customer | Client type | Small Business |
| Customer | Service type | Bookkeeping Cycle |
| Customer | Engagement status | Prospect |
| Customer | Fiscal year end | December 31 |
| Project | Name | `[SIM-01] Bakers Pizza - Monthly Bookkeeping Q3 2026` |
| Project | Type | Bookkeeping Cycle |
| Project | Description | Monthly bookkeeping and financial close simulation for Bakers Pizza |
| Project | Priority | Medium |
| Project | Target date | 2026-09-30 |
| Task 1 | Title | `[SIM-01] Prepare bank reconciliation for July 2026` |
| Task 2 | Title | `[SIM-01] Record journal entries for July 2026` |
| Task 3 | Title | `[SIM-01] Reconcile July credit card statements` |

If a required option is unavailable, do not select an inaccurate substitute without recording the deviation.

Before creating an entity, search for the exact test name. Reuse a clearly incomplete record only if doing so will not invalidate the test; otherwise add a timestamp suffix and document it.

---

## 6. Evidence and Observation Protocol

### 6.1 Capture for every test case

- Test case ID and title.
- Start/end timestamp with time zone.
- Page URL and visible page title.
- Test data used, excluding secrets.
- Steps actually performed.
- Expected result.
- Actual result.
- Status: PASS, FAIL, BLOCKED, NOT RUN, or NOT APPLICABLE.
- Screenshot references.
- Console/page errors observed.
- Failed network requests or unexpected HTTP status codes caused by the action.
- Created entity IDs or visible identifiers, when available.
- Linked defect IDs.

### 6.2 Screenshot rules

- Capture full-page or sufficiently contextual screenshots.
- Capture immediately before and after critical mutations.
- Capture validation and error messages before dismissal.
- Redact credentials, tokens, personal data, and unrelated tenant data.
- Name files with stage, test case, result, and sequence.

Example: `S04-TC04-07_FAIL_ai-task-timeout_01.png`

### 6.3 Browser telemetry

At the start of each stage, establish a clean observation boundary when supported. During and after each critical action, record:

- Uncaught JavaScript exceptions.
- React/framework rendering errors.
- Failed resource and XHR/fetch requests.
- HTTP 4xx/5xx responses associated with the action.
- WebSocket/Socket.IO disconnects or repeated reconnect loops.
- Duplicate mutation requests.
- Requests left pending abnormally.
- Severe layout shift, frozen controls, or indefinite loading indicators.

Do not automatically classify third-party noise as a NeureCore defect. Record the request origin and visible impact.

---

## 7. Defect Classification

### 7.1 Severity

| Severity | Definition | Examples |
|---|---|---|
| Critical | Security/privacy breach, tenant isolation failure, data corruption, or system-wide inability to use the product | Another tenant’s data visible; destructive action affects unrelated records |
| High | Core workflow blocked with no reasonable workaround | Cannot login, create customer/project, assign AI employee, or save required data |
| Medium | Important function is incorrect or impaired but a workaround exists | Filters wrong, status not persisted, report fails while project remains usable |
| Low | Minor functional, copy, accessibility, or visual issue | Misaligned control, typo, weak focus indicator |

### 7.2 Priority

Use `P0` for immediate incident response, `P1` for release-blocking correction, `P2` for near-term correction, and `P3` for backlog improvement. Severity and priority must be recorded separately.

### 7.3 Defect status

`NEW → CONFIRMED → FIX READY → RETEST → VERIFIED/CLOSED`  
Use `DUPLICATE`, `CANNOT REPRODUCE`, or `DEFERRED` only with an explanation.

---

## 8. Issue Record Template

Create one record per distinct root-cause symptom. Do not combine unrelated issues.

```markdown
## NC-SIM01-###

- Title:
- Module/page:
- Severity:
- Priority:
- Reproducibility: Always / Intermittent / Once
- Test case:
- Environment:
- Browser and viewport:
- Tenant:
- First observed:
- Preconditions:

### Steps to reproduce
1.
2.
3.

### Expected result

### Actual result

### User/business impact

### Evidence
- Screenshots:
- Video/trace, if available:
- Console/page error:
- Failed request/status:
- Related entity identifiers:

### Recovery/workaround

### Frequency and retry result

### Suspected area
State only evidence-based observations; do not claim an unverified root cause.

### Acceptance criteria for fix
- [ ]

### Retest result
NOT RETESTED
```

For an intermittent issue, attempt reproduction up to two additional times if safe. Never create duplicate financial or project records merely to reproduce a problem.

---

## 9. Detailed Simulation

### Stage 0 — Baseline, Safety, and Environment

**Goal:** Confirm the correct environment and establish clean evidence.

| ID | Test | Expected result |
|---|---|---|
| S00-TC01 | Open frontend URL | HTTPS page loads without certificate or fatal rendering error |
| S00-TC02 | Record browser, viewport, date/time, URL | Baseline recorded |
| S00-TC03 | Check login page console and failed requests | No product-impacting uncaught errors or failed critical resources |
| S00-TC04 | Inspect login page at desktop and narrow width | Content remains usable without overlap or horizontal loss |
| S00-TC05 | Confirm no credential is visible in evidence | Secret remains protected |

### Stage 1 — Authentication and Session

**Goal:** Verify safe and predictable access to the designated tenant.

| ID | Action | Expected result |
|---|---|---|
| S01-TC01 | Submit empty login form | Required-field validation appears; no request or login occurs |
| S01-TC02 | Enter malformed email | Clear, accessible validation appears |
| S01-TC03 | Submit a deliberately incorrect password once | Generic rejection; no account enumeration or secret exposure |
| S01-TC04 | Enter valid credentials securely and submit once | One login action; authenticated landing page loads |
| S01-TC05 | Confirm visible tenant/user identity | Correct designated tenant is shown |
| S01-TC06 | Refresh authenticated page | Session and route remain valid |
| S01-TC07 | Use browser Back then Forward | No broken, blank, or unauthorized state |
| S01-TC08 | Open a known authenticated route in a new tab if supported | Access behavior is consistent and safe |
| S01-TC09 | Logout | Session ends and protected content is no longer accessible via normal navigation |
| S01-TC10 | Login again for remaining tests | Authentication succeeds without stale-state issues |

Record login timing, duplicate submissions, error copy, focus behavior, console errors, and request failures.

### Stage 2 — Dashboard and Global Navigation

**Goal:** Verify the tenant shell, industry context, and all primary routes.

Expected navigation, subject to actual product configuration:

- Home
- Customers
- Projects
- Departments
- Marketplace
- Workspace and accounting-specific tools
- Finance
- Intelligence
- Settings

For every visible primary item:

1. Click once.
2. Confirm the URL and active navigation state update.
3. Confirm the intended page renders, not a blank or placeholder error.
4. Record loading, empty, error, and permission states.
5. Check breadcrumbs, page heading, and browser Back/Forward behavior.
6. Return through visible navigation rather than editing the URL.

| ID | Test | Expected result |
|---|---|---|
| S02-TC01 | Verify dashboard identity and industry context | Correct tenant and Accounting & Audit Services context |
| S02-TC02 | Check all dashboard cards/widgets | Each loads or shows an intentional empty state |
| S02-TC03 | Test primary navigation routes | Correct route, heading, and active state |
| S02-TC04 | Collapse/expand navigation if available | State changes without clipping or inaccessible items |
| S02-TC05 | Narrow-width navigation smoke test | Menu remains operable and dismissible |
| S02-TC06 | Keyboard Tab through shell controls | Logical focus order and visible focus indicator |
| S02-TC07 | Inspect telemetry across routes | No unexplained fatal errors or repeated failing calls |

### Stage 3 — Customer Management

**Goal:** Verify customer discovery, creation, validation, persistence, editing, and duplicate handling.

#### 3A. List, search, filter, and table behavior

| ID | Test | Expected result |
|---|---|---|
| S03-TC01 | Open Customers | Page loads with correct heading and intentional list/empty state |
| S03-TC02 | Search exact `[SIM-01] Bakers Pizza` before creation | Existing collision is identified |
| S03-TC03 | Search a known fragment and a no-result term | Relevant results and clear no-result state |
| S03-TC04 | Clear search | Full list returns |
| S03-TC05 | Exercise one sort and available filters | Results and active filter indicators are correct |
| S03-TC06 | Test pagination or row count if present | Controls and counts remain consistent |

#### 3B. Validation and creation

1. Open New Customer.
2. Submit without required fields.
3. Confirm inline validation, focus placement, and preservation of entered values.
4. Test leading/trailing whitespace in the name if safe.
5. Fill the approved test data.
6. Verify dropdowns, dates, and statuses expose reasonable options.
7. Submit once and observe loading/disabled state.
8. Do not click again while the mutation is pending.

| ID | Test | Expected result |
|---|---|---|
| S03-TC07 | Open and cancel form | Cancel returns safely without creating a record |
| S03-TC08 | Submit blank required fields | Clear validation; record not created |
| S03-TC09 | Correct fields after validation | Errors clear appropriately and values persist |
| S03-TC10 | Create customer | One success response and one customer record |
| S03-TC11 | Verify detail fields | Saved values match submitted values |
| S03-TC12 | Refresh detail page | Record and values persist |
| S03-TC13 | Verify customer in list/search | Same name, status, and key values appear |
| S03-TC14 | Edit a harmless field and save | Change persists across detail, list, and refresh |
| S03-TC15 | Attempt duplicate-name path without committing if UI warns | Duplicate handling is clear and safe |

Confirm no duplicate customer was created by delayed response, refresh, or repeat navigation.

### Stage 4 — Project Management

**Goal:** Verify project creation, customer linkage, workflow configuration, editing, and persistence.

#### 4A. Project list behavior

Repeat the list/search/filter/sort/pagination checks used for Customers and record them as `S04-TC01` through `S04-TC05`.

#### 4B. Validation and creation

1. Open New Project.
2. Cancel once and verify no project is created.
3. Submit blank required fields and verify validation.
4. Enter project data.
5. Select `[SIM-01] Bakers Pizza` as the linked customer.
6. Confirm project type `Bookkeeping Cycle`.
7. Confirm date and priority behavior.
8. Submit once.

| ID | Test | Expected result |
|---|---|---|
| S04-TC06 | Cancel new-project form | No record created |
| S04-TC07 | Required-field validation | Clear errors and no mutation |
| S04-TC08 | Invalid/illogical date check if supported | Invalid state is rejected or clearly explained |
| S04-TC09 | Create project | Exactly one project is created |
| S04-TC10 | Verify initial lifecycle state | Actual initial state matches configured workflow; deviation documented |
| S04-TC11 | Verify customer relationship | Correct customer shown and link opens correct detail |
| S04-TC12 | Verify bookkeeping workflow | Expected stages exist or configured alternative is documented |
| S04-TC13 | Refresh and relogin persistence | Project, relationship, and values persist |
| S04-TC14 | Edit priority/description and save | Updated values propagate to all relevant views |
| S04-TC15 | Search/filter project | Project is discoverable with correct status and customer |

Expected bookkeeping stages, if this template is configured:

`Bank Reconciliation → Journal Entries → Reconciliation → Adjustments → Close`

Do not fail solely because labels differ. Fail when required business capability is absent, misleading, inconsistent, or broken.

### Stage 5 — Project Workspace and Tasks

**Goal:** Verify project tabs, task CRUD, validation, assignment controls, and state persistence.

1. Open every visible project tab: Overview, Tasks/Goals, Files, Activity, Financials, Deliverables, or equivalents.
2. Confirm each tab preserves project context.
3. Create the three approved tasks.
4. Verify blank-title validation and cancel behavior before the valid creation.
5. Confirm each task appears once and remains after refresh.
6. Open each task detail and confirm project/customer context.
7. Test available priority, due-date, assignee, and status controls.

| ID | Test | Expected result |
|---|---|---|
| S05-TC01 | Visit all project tabs | Correct content and no lost project context |
| S05-TC02 | Cancel task creation | No task created |
| S05-TC03 | Submit blank task | Validation shown and no task created |
| S05-TC04 | Create three tasks | Exactly three distinct tasks persist |
| S05-TC05 | Verify task details and parent relationship | Correct project/customer context |
| S05-TC06 | Refresh and navigate away/back | Tasks and state persist |
| S05-TC07 | Test task list filter/sort if present | Correct task set and clear active controls |
| S05-TC08 | Verify activity/timeline | Creation actions are attributable and timestamped |

### Stage 6 — AI Employee Assignment and Execution

**Goal:** Validate the core NeureCore value proposition end to end.

#### 6A. Employee availability and assignment

1. Open the relevant department/AI employees surface.
2. Confirm suitable roles such as Bookkeeper or Accounting Specialist exist.
3. Verify role descriptions and availability are understandable.
4. Assign an appropriate AI employee to one task.
5. Confirm assignment is visible on the task and project.
6. Attempt to assign an unsuitable or unavailable employee only if the UI offers this safely; verify the system warns or explains constraints.

#### 6B. Controlled execution prompt

Use a prompt that requests planning and simulated output without real-world actions:

```text
For project [SIM-01] Bakers Pizza - Monthly Bookkeeping Q3 2026, analyze the
assigned July 2026 bookkeeping task. Produce a concise execution plan, list
required source documents, identify assumptions and missing inputs, and prepare
a draft deliverable for human review. Do not send messages, create financial
transactions, contact external services, or claim access to documents that are
not attached. Cite the project and task context in your response.
```

#### 6C. Observe execution

| ID | Test | Expected result |
|---|---|---|
| S06-TC01 | Discover appropriate AI employee | Role is available and intelligible |
| S06-TC02 | Assign employee | Assignment persists on task/project |
| S06-TC03 | Submit controlled prompt once | Prompt is accepted once with clear feedback |
| S06-TC04 | Observe queued/in-progress state | State changes are visible and do not remain indefinitely |
| S06-TC05 | Navigate away and return during execution | Execution remains discoverable and consistent |
| S06-TC06 | Refresh during safe execution point | No duplicate run; current state is restored |
| S06-TC07 | Review response | Output follows instructions, acknowledges missing inputs, and avoids fabricated access/actions |
| S06-TC08 | Verify task context | Correct customer, project, task, and employee are referenced |
| S06-TC09 | Inspect activity/execution log | Prompt, actor, timestamps, state changes, and result are traceable |
| S06-TC10 | Review/approve or request revision | Human-in-the-loop control works and is recorded |
| S06-TC11 | Retry/revision path if available | New run is distinguishable; prior output remains auditable |
| S06-TC12 | Validate final task state | State reflects actual review outcome, not merely response generation |

Expected state model may resemble:

`QUEUED → IN_PROGRESS → NEEDS_REVIEW → APPROVED/COMPLETED`

Record actual states. Flag skipped required review, unexplained regression, stale state, contradictory states across pages, or false completion.

#### 6D. AI quality and safety checks

Evaluate whether the AI:

- Uses the correct tenant, customer, project, and task context.
- Separates known data from assumptions.
- Requests missing statements/documents rather than inventing them.
- Avoids fabricated balances, transactions, citations, completion claims, and file access.
- Does not expose hidden prompts, tokens, credentials, or other tenants’ data.
- Produces an actionable accounting workflow.
- Preserves the requested human-review boundary.
- Reports tool/execution failure honestly.
- Does not trigger external or irreversible actions without explicit approval.

Log quality defects even if the UI technically completes.

### Stage 7 — Project Lifecycle and Governance

**Goal:** Verify valid transitions, guardrails, audit trail, and completion rules.

Use the actual configured workflow. The anticipated model is:

`Lead → Proposal Sent → Won → Active → Review → Completed`

| ID | Test | Expected result |
|---|---|---|
| S07-TC01 | Inspect available transition actions | Only valid, understandable actions are offered |
| S07-TC02 | Attempt premature completion before task approval, if safe | System blocks or clearly warns |
| S07-TC03 | Lead → Proposal Sent | Status persists and activity is logged |
| S07-TC04 | Proposal Sent → Won | Status persists and activity is logged |
| S07-TC05 | Won → Active | Project becomes active without losing data |
| S07-TC06 | Active → Review | Review state and outstanding work are visible |
| S07-TC07 | Approve remaining simulated deliverables | Approval is attributable and logged |
| S07-TC08 | Review → Completed | Completion occurs only when rules are met |
| S07-TC09 | Verify completed/archive views | Project is discoverable with correct final state |
| S07-TC10 | Refresh/relogin final state | Status, tasks, outputs, and timeline remain consistent |
| S07-TC11 | Inspect completion summary | Summary reflects actual tasks, outputs, dates, and actors |

Never force an invalid transition through URL or API manipulation.

### Stage 8 — Finance and Accounting-Specific Surfaces

**Goal:** Verify availability, consistency, and safe behavior of accounting features.

| ID | Test | Expected result |
|---|---|---|
| S08-TC01 | Open project Financials or equivalent | Page loads in correct project context |
| S08-TC02 | Inspect budget/time fields | Labels, formats, defaults, and validation are clear |
| S08-TC03 | Enter safe test budget/time data if supported | Values save once and persist |
| S08-TC04 | Verify currency and number formatting | Consistent and tenant-appropriate |
| S08-TC05 | Inspect invoice milestones without issuing invoice | Milestones are visible and no external action occurs |
| S08-TC06 | Open Reports | Accounting templates load or intentional empty state explains next step |
| S08-TC07 | Generate preview-only report if supported | Report uses correct customer/project data |
| S08-TC08 | Cross-check totals and statuses | Values agree across project, finance, dashboard, and report |
| S08-TC09 | Check empty/missing-input behavior | No fabricated values or false completion |

Do not send, publish, export externally, invoice, or charge.

### Stage 9 — Secondary Modules Smoke Test

**Goal:** Detect broken top-level surfaces without expanding into unrelated business actions.

For Departments, Marketplace, Workspace, Finance, Intelligence, and Settings:

- Open the module.
- Verify correct heading, route, active navigation, loading/empty/error state.
- Exercise one safe primary interaction such as search, tab change, or filter.
- Check industry relevance and permission messaging.
- Inspect telemetry.
- Return using visible UI.

Record one test case per module as `S09-TC01` onward.

### Stage 10 — Cross-Cutting UX, Accessibility, and Resilience

**Goal:** Catch issues that happy-path workflow checks miss.

#### Usability and visual checks

- No clipped, overlapping, truncated, or off-screen critical controls.
- Consistent terminology for Customer/Client, Project/Engagement, Task/Goal, and AI Employee/Agent.
- Clear primary/secondary/destructive button hierarchy.
- Loading indicators appear and end.
- Empty states explain what to do next.
- Success toasts are accurate and not premature.
- Error messages explain recovery without exposing internals.
- Dates, times, currencies, and statuses are formatted consistently.
- Disabled controls look and behave disabled.

#### Accessibility baseline

- Keyboard access to primary navigation, forms, dialogs, tabs, and main actions.
- Visible focus indicator.
- Logical focus order.
- Form fields have persistent labels.
- Errors are associated with fields and not communicated by color alone.
- Dialog focus is contained and returns to the trigger on close.
- Escape closes dismissible overlays where expected.
- Images/icons used as controls have accessible names where observable.
- Text and essential controls have no obvious low-contrast failure.

#### Resilience

- Refresh list and detail pages after mutations.
- Use Back/Forward around forms and details.
- Avoid duplicate submission during loading.
- Confirm unsaved-change warning if the product claims to support it.
- Verify graceful error state and retry when a natural failure occurs.
- Observe stale data across tabs/routes.
- Confirm long content can scroll and remains actionable.

#### Responsive smoke check

At minimum, repeat login, dashboard navigation, customer detail, project detail, and AI response review at a narrow viewport. This is a usability smoke test, not full device certification.

---

## 10. Data Integrity Reconciliation

Before declaring completion, reconcile the same entities across all available surfaces.

| Data | Surfaces to compare |
|---|---|
| Customer name/status/type | Customer list, detail, project, search |
| Project name/status/customer | Project list, detail, customer detail, dashboard, completed view |
| Task title/status/assignee | Task list, task detail, project overview, activity |
| AI execution state/output | Task, AI workspace/chat, activity/execution log |
| Dates and timestamps | Detail pages, activity, completion summary |
| Financial values | Project financials, reports, dashboard if shown |

Any unexplained contradiction is a defect even if each individual page loads.

---

## 11. Cleanup and Test-Data Disposition

At the end:

1. Inventory every record created, including customer, project, tasks, runs, drafts, and reports.
2. Do not delete records unless deletion was explicitly authorized.
3. Prefer leaving clearly labeled `[SIM-01]` records for developer inspection.
4. If cleanup is authorized, use only visible UI controls, capture before/after evidence, and verify removal from search/list.
5. Record any item that could not be cleaned up.

---

## 12. Pass, Fail, and Release-Gate Rules

### Test status

- **PASS:** Expected result visibly confirmed with adequate evidence.
- **FAIL:** Actual behavior conflicts with expected behavior.
- **BLOCKED:** Cannot execute because a prerequisite or earlier defect prevents it.
- **NOT RUN:** Execution did not reach the test.
- **NOT APPLICABLE:** Capability is intentionally absent and this is confirmed.

### Overall simulation result

**PASS** only when all of the following are true:

- No open Critical or High defects.
- All critical-path tests pass.
- Customer, project, task, AI execution, human review, lifecycle, and persistence are verified end to end.
- No tenant-isolation, data-loss, or duplicate-mutation issue is observed.
- At least 95% of planned applicable tests were executed.
- All Medium defects have documented impact and disposition.
- Evidence and reconciliation are complete.

**CONDITIONAL PASS** when the critical path passes with no Critical/High defect, but limited Medium defects or documented noncritical coverage gaps remain.

**FAIL** when any Critical/High defect is open, a critical workflow is blocked, data integrity is unreliable, or the AI falsely claims work/actions central to the scenario.

**INCONCLUSIVE** when environment or access blockers prevent meaningful execution.

Critical-path tests include login, tenant verification, customer creation/persistence, project creation/linkage, task creation, AI assignment/execution, human review, lifecycle completion, and final-state persistence.

---

## 13. Deliverables and File Structure

```text
simulations/Simulation-01-Bakers-Pizza/
├── README.md
├── run-manifest.md
├── test-results.md
├── issue-register.md
├── final-report.md
├── created-records.md
├── telemetry/
│   ├── console-errors.md
│   ├── failed-requests.md
│   └── performance-observations.md
├── evidence/
│   ├── S00-baseline/
│   ├── S01-authentication/
│   ├── S02-navigation/
│   ├── S03-customers/
│   ├── S04-projects/
│   ├── S05-tasks/
│   ├── S06-ai-execution/
│   ├── S07-lifecycle/
│   ├── S08-finance-reports/
│   ├── S09-secondary-modules/
│   └── S10-cross-cutting/
└── defects/
    └── NC-SIM01-###.md
```

### Run manifest

Record:

- Run ID and simulation version.
- Approver and approval timestamp.
- Start/end time and time zone.
- Frontend environment.
- Browser/version and viewports.
- Tenant identifier and visible industry.
- Executor/tool version if known.
- Records created.
- Limitations and blocked areas.

### Final report

The final report must include:

1. Executive summary and overall result.
2. Scope and environment.
3. Coverage: planned, passed, failed, blocked, not run, and not applicable.
4. Critical-path outcome.
5. Defects grouped by severity and module.
6. Business impact and release recommendation.
7. AI quality/safety findings.
8. Data-integrity reconciliation.
9. UX, accessibility, responsive, and telemetry findings.
10. Evidence index.
11. Created-record inventory and cleanup status.
12. Recommended fix order.
13. Retest scope.

---

## 14. Execution Sequence

1. Obtain explicit approval and secure runtime credential access.
2. Create the evidence structure and run manifest.
3. Execute Stage 0 and verify the designated tenant.
4. Execute Stages 1–10 in order, continuing independent checks when safe.
5. Log defects immediately; do not postpone defect writing until the end.
6. Reconcile data across surfaces.
7. Inventory created records and apply the authorized cleanup policy.
8. Calculate coverage and determine PASS, CONDITIONAL PASS, FAIL, or INCONCLUSIVE.
9. Produce the issue register and final report.
10. After fixes, rerun failed cases plus regression checks for adjacent workflows.

---

## 15. Approval

Execution must not begin until the user approves this simulation and confirms that:

- The designated tenant may be modified with clearly labeled simulation data.
- Credentials will be supplied through a secure runtime mechanism.
- The tester may create customers, projects, tasks, AI runs, and draft reports.
- No real external communications or financial transactions are authorized.
- Test records should be retained unless separate cleanup authorization is given.

**Prepared for:** NeureCore frontend browser verification  
**Awaiting:** User approval to begin execution
