# SIM-04 — Complete Frontend Simulation, Backend Repair, and Production-Readiness Verification

## Mission

Execute Simulation SIM-04 for a new accounting customer under the NeureCore tenant:

* Tenant: `alipiracha@live.com` (Shahikhail@@0098)
* Tenant frontend: `https://hq.neurecore.com`
* Industry context: Accounting & Audit Services
* Simulation method: Real headed browser interaction
* Primary project-entry method: Create the accounting project conversationally through NeureCore Chat

Your objective is to verify, repair, and complete the entire reconstructed NeureCore AI-work lifecycle—from conversational project creation through successful project completion.

Do not merely test isolated pages. Demonstrate that the reconstructed system works as one complete, production-ready workflow.

## Your Two Roles

Operate simultaneously in two clearly separated roles.

### Role 1 — Human in the Loop

Act as the authorized tenant user through the browser at `https://hq.neurecore.com`.

You must:

* Perform all business operations through the frontend
* Respond to discovery questions
* Review generated project structures
* Confirm project creation
* Review AI employee outputs
* Approve acceptable work
* Request revisions when work is incomplete or incorrect
* Provide required human approvals
* Progress the project through its full lifecycle
* Verify every visible user-facing state

Do not use backend APIs, Prisma, SQL, scripts, or direct database operations to simulate successful user actions.

### Role 2 — Backend and Integration Specialist

When a frontend workflow fails, diagnose the complete technical path and implement the proper correction.

You may inspect and modify:

* Frontend source
* Backend source
* Application commands
* Domain services and state machines
* Ports and persistence adapters
* Hermes tools and gateway policies
* Transactional outbox
* Database workers
* Assignment services
* AI execution runtime
* Review and approval services
* Timeline and feed projections
* Authentication and session handling
* Feature flags
* Tests, observability, and deployment configuration

Backend changes must repair the frontend workflow. They must never substitute for successfully completing that workflow through the browser.

## Mandatory Preliminary Reading

Before opening the browser or changing code, read the relevant reconstruction documentation under:

`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/memory-bank-new/docs/reconstruction/`

You must specifically read completely:

`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md`

Also read all directly relevant:

* Reconstruction roadmap and implementation plan
* G0, G1, G1.1, and G1.1.1 evidence
* Architecture decisions
* Known gaps and risks
* State-machine specifications
* Migration and production-deviation records
* Test and gate reports
* Hermes, outbox, assignment, execution, review, and timeline documentation

Then inspect the deployed commit, enabled feature flags, database migration status, worker status, and current environment configuration.

Create a short pre-execution baseline identifying:

* Implemented capabilities expected in SIM-04
* Known remaining limitations
* Deployed frontend and backend commit SHAs
* Tenant configuration
* Relevant feature flags
* Active worker/outbox status
* Test customer and project names
* Evidence directory
* Correlation and simulation IDs

Do not rely solely on documentation. Reconcile documentation with the deployed source and runtime.

## Test Data

Create a new, clearly identifiable accounting customer through the frontend.

Use unique names such as:

* Customer: `[SIM-04] <New Customer Name>`
* Project: `[SIM-04] <Customer Name> — Monthly Accounting Close`
* Goal and task names: Prefix with `[SIM-04]` where supported

Before creating anything, search for naming collisions. Do not repeatedly submit actions that may create duplicate records.

Use synthetic accounting information only. Do not use real financial data, send real invoices, make payments, contact external parties, or issue external communications.

Obtain credentials through the approved secure runtime mechanism. Never record passwords, tokens, cookies, or secrets in screenshots, logs, reports, prompts, or source files.

## Non-Negotiable Operating Rules

1. Perform all business actions through the frontend browser.
2. Use backend access only to diagnose and repair system defects.
3. After every fix, deploy through the approved process and repeat the failed frontend action from the beginning of the affected workflow.
4. Do not mark a feature as working merely because an API, unit test, or database operation succeeds.
5. Do not fake, infer, or invent successful results.
6. Do not ignore any visible error, console exception, failed request, inconsistent state, dead button, misleading success message, or missing implemented feature.
7. Record every issue before fixing it.
8. Preserve tenant isolation and unrelated production data.
9. Never use direct Prisma or SQL writes to make SIM-04 appear successful.
10. All business mutations must follow the canonical application-command and transaction/outbox architecture.
11. Do not silently fall back to legacy mutation paths.
12. Verify fixes with automated tests and browser regression testing.
13. Continue through recoverable technical failures until the complete implemented workflow passes.
14. Do not broaden the project into unrelated features, industries, dashboards, or refactoring.
15. Do not claim production readiness while any mandatory SIM-04 capability remains failed, blocked, inconsistent, or unverified.

## Safety Stop Conditions

“Do not stop at errors” means diagnose, fix, deploy, and retest ordinary implementation defects. It does not authorize unsafe or destructive actions.

Stop and request authorization if completing the work would require:

* Destructive modification or deletion of unrelated production data
* Unreviewed destructive database migration
* Disabling tenant isolation or security controls
* Exposing another tenant’s data
* Sending real messages, invoices, invitations, or payments
* Using or extracting credentials outside approved mechanisms
* Rewriting shared production history
* Bypassing required human approval
* Making a major architectural replacement outside the approved reconstruction scope

A tenant-isolation or data-corruption problem is a Critical incident. Preserve evidence and escalate immediately.

## SIM-04 Workflow

### Stage 0 — Environment and Tenant Baseline

1. Open `https://hq.neurecore.com`.
2. Authenticate as `alipiracha@live.com`.
3. Confirm the visible tenant identity and accounting-industry configuration.
4. Verify the reconstruction feature flags for this tenant.
5. Confirm browser console, network, Socket.IO, authentication, and session state.
6. Record the deployed frontend/backend versions and correlation ID.
7. Verify no unrelated tenant data is visible.
8. Search for existing SIM-04 records before creating anything.

### Stage 1 — Create the Customer Through the Frontend

Create one new accounting customer through the Customers interface.

Verify:

* Required-field validation
* Accounting-specific fields
* Save-once behavior
* Duplicate-submission prevention
* Success feedback
* Customer list and detail consistency
* Search and filtering
* Persistence after refresh and relogin
* Activity/audit entry
* Correct tenant ownership

If customer creation fails, repair the system and repeat the browser workflow. Do not create the customer through an API or database.

### Stage 2 — Create the Accounting Project Through Chat

From the frontend Chat/Enterprise Initiation interface:

1. Ask NeureCore to create an accounting project for the new customer.
2. Provide the business objective, project type, dates, priority, and required outcomes conversationally.
3. Answer all discovery questions.
4. Verify Hermes recognizes the correct tenant and customer.
5. Review the synthesized project proposal.
6. Verify assumptions, stages, goals, tasks, AI roles, dates, dependencies, and expected deliverables.
7. Request corrections if the proposal is incomplete.
8. Approve the final proposal explicitly.
9. Confirm exactly one project is created.

Verify the complete runtime path:

`Browser → Hermes → Tool Gateway → Policy → Application Command → Domain Service → Database Transaction + Outbox → Worker → Frontend Status`

Confirm:

* The correct Hermes runtime type is used
* The correct tool is offered
* Gateway authorization succeeds
* No legacy direct-write fallback is used
* Project, initiation link, automation state, audit record, and outbox event are persisted correctly
* Duplicate submission creates no duplicate project
* Browser refresh resolves to the authoritative state
* Failure never produces a false success response

### Stage 3 — Project Materialization

Verify the project automation worker creates and exposes:

* Project stages
* Goals
* Tasks
* Role requirements
* Assignment requests
* Initial activity/timeline entries
* Automation progress and completion state

Verify item-level idempotency:

* No duplicate goals
* No duplicate tasks
* No duplicate stages
* No duplicate assignments
* Partial processing resumes safely
* Refresh or worker restart does not lose state
* Errors become visible and retryable

If any required item is missing, diagnose and fix the responsible template, command, transaction, outbox, handler, state machine, projection, or frontend rendering.

### Stage 4 — Departments and AI Employees

Verify that relevant AI employees are deployed or selected for the appropriate departments.

For every required employee:

* Confirm name, role, department, capabilities, availability, and tenant ownership
* Confirm the employee is eligible for the assigned task
* Confirm assignment rationale
* Confirm workload and concurrency rules
* Confirm assignment appears consistently across employee, task, project, department, and timeline views
* Confirm no UUID entry is required from the user
* Confirm cross-tenant or ineligible employees cannot be assigned
* Confirm manual override requires authorization and is audited

If no eligible employee exists, the system must show a truthful, actionable state rather than silently assigning an unsuitable employee.

### Stage 5 — Goals, Tasks, Dates, and Dependencies

Inspect every generated goal and task.

Verify:

* Correct accounting objective
* Clear task description
* Required inputs
* Assigned AI employee
* Priority
* Start date
* Due date
* Stage relationship
* Dependencies
* Mandatory/optional classification
* Status and allowed transitions
* Calendar visibility
* Timeline visibility
* Project-feed visibility

Test editing and persistence through the frontend where supported.

Ensure dates and statuses remain consistent across:

* Project overview
* Task detail
* Calendar
* Timeline
* Department workspace
* AI employee workspace
* Activity feed

### Stage 6 — Governed AI Execution

Start the assigned accounting work through the supported frontend control.

Use synthetic source data and instructions. The AI employee must:

* Understand the customer, project, goal, and task context
* Use only approved inputs and tools
* Identify missing information instead of fabricating it
* Produce an execution plan
* Perform the authorized internal task
* Create an evidence-backed draft deliverable
* Report progress
* Record tool actions
* Respect time, token, cost, and tool limits
* Stop or request approval before prohibited external effects
* Submit work for human review

Verify states such as:

`ASSIGNED → QUEUED → IN_PROGRESS → NEEDS_INPUT/NEEDS_REVIEW`

Verify:

* Exactly one execution attempt is created per request
* Attempt and execution event are committed atomically
* Worker restart does not lose or duplicate work
* Heartbeats and stale-run recovery work
* Cancellation behaves safely
* Failures are correctly classified
* Retry creates a distinguishable attempt
* Evidence belongs to the correct tenant, project, task, employee, and attempt
* AI cannot approve its own work

### Stage 7 — Feeds, Activity, Timeline, and Execution Logs

Verify all work is visible through the appropriate frontend surfaces.

Confirm the unified timeline records:

* Initiation created
* Discovery updated
* Proposal approved
* Project created
* Automation requested and completed
* Goals and tasks created
* AI employee assigned
* Execution queued and started
* Progress updates
* Evidence created
* Review requested
* Human decision
* Revision request, if any
* Task completion
* Stage progression
* Project completion

Verify feeds and logs remain accurate after refresh, relogin, Socket.IO interruption, and manual page navigation.

No execution-log button may be dead or disconnected.

### Stage 8 — Human Review and Revision

As the human reviewer:

1. Open the submitted AI deliverable.
2. Review the original task, inputs, execution summary, assumptions, evidence, tool history, time, and cost.
3. Determine whether the work meets the requested accounting standard.
4. If incomplete or incorrect, request a revision with specific instructions.
5. Verify a new execution attempt is created.
6. Confirm prior evidence remains immutable.
7. Review the revised result.
8. Approve only when satisfactory.

Verify:

* Reviewer authorization
* Attributable decision
* Double-decision protection
* Atomic review and task transition
* Revision lineage
* Immutable prior attempts
* Audit and timeline entries
* No AI self-approval

### Stage 9 — Calendar and Due-Date Verification

Verify:

* Project target date
* Stage dates
* Task due dates
* Review deadline
* Calendar rendering
* Time-zone handling
* Overdue indicators
* Date editing permissions
* Date persistence
* Consistency across calendar, project, tasks, timeline, and feeds

If reminders or notifications are implemented, verify their internal frontend behavior without sending external communications.

### Stage 10 — Lifecycle Progression

Progress the project through its configured lifecycle using visible frontend controls.

Expected model may include:

`LEAD → PROPOSAL_SENT → WON → ACTIVE → REVIEW → COMPLETED`

Use the actual configured workflow and record deviations.

Verify:

* Only valid transitions are offered
* Unauthorized transitions are rejected
* Transition guards work
* Mandatory tasks block premature completion
* Waivers require explicit authority and a documented reason
* Stage transitions are atomic and audited
* Project status is consistent across all frontend views
* Completion occurs only after required human approvals

### Stage 11 — Project Completion

Complete the project satisfactorily through the frontend.

Verify:

* All mandatory goals are satisfied
* All mandatory tasks are approved or properly waived
* Required evidence exists
* AI execution attempts are traceable
* Project stages are complete
* Final deliverable is accessible
* Completion summary is accurate
* Customer and project records remain linked
* Financial and reporting surfaces show consistent information
* Completed project is discoverable in the correct list/archive
* Final state survives refresh and relogin

## Issue-Repair Loop

For every issue:

1. Capture screenshot, URL, timestamp, correlation ID, console error, network failure, and relevant entity IDs.
2. Record expected versus actual behavior.
3. Classify severity and business impact.
4. Trace the full technical path.
5. Identify the verified root cause.
6. Add a failing test that reproduces the defect.
7. Implement the smallest correct architectural fix.
8. Run compilation, architecture, unit, integration, migration, and relevant regression tests.
9. Deploy through the approved pipeline.
10. Repeat the failed action through the frontend.
11. Verify adjacent workflows.
12. Mark the issue fixed only after browser verification.

Do not repeatedly retry a broken action before checking whether the previous request committed.

## Required Test Coverage

Maintain and expand:

* Architecture-boundary tests
* State-machine tests
* Command and event contract tests
* Real PostgreSQL transaction tests
* Durable idempotency tests
* Tenant-isolation tests
* Outbox lease/retry/dead-letter tests
* Worker-restart tests
* Assignment concurrency tests
* Execution timeout, heartbeat, cancellation, and retry tests
* Human-review race and revision tests
* Feature-flag tests
* Session-expiry tests
* Socket-disabled recovery tests
* Frontend browser regression tests

Integration tests must fail—not skip—when the required test database is unavailable in CI.

## Evidence Structure

Create:

```text
memory-bank-new/simulations/SIM-04/
├── README.md
├── run-manifest.md
├── test-results.md
├── issue-register.md
├── fix-register.md
├── regression-results.md
├── created-records.md
├── final-report.md
├── telemetry/
│   ├── correlation-traces.md
│   ├── console-errors.md
│   ├── failed-requests.md
│   ├── outbox-worker-observations.md
│   └── performance-observations.md
├── evidence/
│   ├── S00-baseline/
│   ├── S01-customer/
│   ├── S02-chat-initiation/
│   ├── S03-materialization/
│   ├── S04-ai-employees/
│   ├── S05-goals-tasks-dates/
│   ├── S06-execution/
│   ├── S07-feeds-timeline/
│   ├── S08-review-revision/
│   ├── S09-calendar/
│   ├── S10-lifecycle/
│   └── S11-completion/
└── defects/
    └── NC-SIM04-###.md
```

## Completion Standard

SIM-04 passes only when:

* The new customer is created through the frontend.
* The accounting project is created conversationally through Chat.
* Exactly one project is created.
* Stages, goals, and tasks are materialized correctly.
* Appropriate AI employees are assigned to relevant departments and tasks.
* At least one AI employee executes real governed work.
* Progress, evidence, feeds, and timelines are visible.
* Human review and revision work.
* Required approvals are completed.
* Calendar and due dates are consistent.
* Lifecycle transitions work.
* The project reaches `COMPLETED` through the frontend.
* All state persists after refresh and relogin.
* No Critical or High defect remains.
* No tenant-isolation, data-loss, duplicate-effect, or false-success issue exists.
* All implemented features described in `AI-IMPLEMENTATION-PLAN-v2.md` that apply to this scenario are tested.
* All fixes pass automated and frontend regression testing.
* Evidence supports every pass claim.

If a documented feature is not implemented, inaccessible, or fails, report it honestly. Do not redefine it as out of scope merely to pass SIM-04.

## Final Deliverables

Produce:

1. Executive final report
2. Complete test-result matrix
3. Issue register
4. Fix register with code and deployment references
5. Regression report
6. AI output-quality assessment
7. Tenant and data-integrity reconciliation
8. Created-record inventory and cleanup status
9. Remaining production risks
10. Clear final verdict:

* PASS
* CONDITIONAL PASS
* FAIL
* INCONCLUSIVE

The simulation cannot receive PASS while any critical-path feature remains failed, blocked, untested, or supported only by backend evidence without successful frontend completion.
