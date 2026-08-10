# Investigation SOL-01: Minimum Self-Starting AI Employee Showcase

Date: 2026-08-10  
Status: Investigation and minimum implementation guide  
Scope: NeureCore backend and tenant frontend

## Short verdict

NeureCore already has most of the difficult building blocks: tenant isolation,
AI Employees, cognition, governed Work Runs, registered tools, approvals,
evidence, idempotency, retries, and execution status. What is missing is a
small control loop that joins them together and makes an Employee start and
monitor work without a person pressing Execute each time.

For the first showcase, do not build a general autonomous enterprise. Build
one safe, visible loop for one tenant and one Employee:

> Every five minutes, inspect overdue or unhealthy projects. If action is
> needed, create one deduplicated mission, start its governed Work Run, show
> progress in the tenant UI, pause for human approval when required, and
> continue after approval.

This is enough to honestly demonstrate a self-starting, self-monitoring AI
Employee while retaining NeureCore's existing governance boundaries.

## What exists today

The reusable path is already present:

1. `EnterpriseAutonomyService.createMission()` observes context, asks
   Enterprise Cognition for recommendations, and can create Work Runs when
   `autoSchedule=true`.
2. `WorkRuntimeService` plans, governs, executes registered tools, persists
   steps, waits for approval, resumes, and records outcomes.
3. Project-health, budget, and approval-bottleneck watchers already produce
   grounded observations.
4. Approval consumers and the tenant approval screens already provide most of
   the human-in-the-loop path.
5. Work Run and execution views already expose persisted state that can drive
   an operator screen.

The missing links are:

- no timer or durable trigger continuously invokes the observation cycle;
- observations recommend actions but do not create a deduplicated mission;
- mission scheduling logs and swallows individual scheduling failures;
- there is no small supervisor that reconciles stuck runs and mission status;
- the tenant UI does not present the whole Employee-to-outcome story in one
  place;
- repository type checks and certification evidence are not currently clean
  enough for a production-readiness claim.

## Bare-minimum architecture

```text
5-minute timer
    |
    v
EmployeeAutopilotTick
    |-- acquire per-tenant lease
    |-- run existing watchers
    |-- select one actionable observation
    |-- deduplicate by tenant + rule + subject + time window
    v
EnterpriseAutonomy.createMission(autoSchedule=true)
    |
    v
Governed Work Runtime
    |-- execute safe read/internal-write tools
    |-- WAITING_FOR_APPROVAL for sensitive/external writes
    |-- resume through existing approval consumer
    v
Autopilot supervisor
    |-- update mission outcome
    |-- retry/reconcile stale runs
    |-- notify operator on blocked/failed work
    v
Tenant "AI Employee Activity" screen
```

Keep cognition probabilistic and execution deterministic. The new autopilot
chooses *when to ask for governed work*; it must not bypass the Work Runtime,
tool registry, tenant scope, approval rules, or evidence trail.

## Simplest implementation guide

### 1. Choose one showcase rule

Use only the existing project-health watcher:

- Trigger: project completeness is below 30%.
- Employee: one configured Operations/Chief-of-Staff AI Employee.
- Action: create a mission requesting a project-gap report and follow-up task.
- Allowed automatic effects: `READ` and `INTERNAL_WRITE` only.
- Approval: any external message, status completion, deletion, payment, or
  other `EXTERNAL_WRITE` remains approval-required.
- Completion: report/evidence exists and the follow-up task is created, or the
  run is visibly waiting for approval.

This rule uses data and services that already exist and avoids needing email,
calendar, or third-party connector readiness for the first demo.

### 2. Add one durable autopilot configuration

Add a minimal tenant-scoped record (or reuse a suitable tenant configuration
table if one already satisfies these fields):

```text
EmployeeAutopilot
- id
- tenantId
- employeeId
- enabled
- intervalMinutes (default 5)
- lastTickAt
- nextTickAt
- leaseOwner
- leaseExpiresAt
- ruleKey ("project-health-low-completeness")
- createdById
- createdAt / updatedAt
```

Only tenant owners/admins may enable it. Default it to disabled. For the demo,
permit only one enabled autopilot per tenant.

### 3. Add a small tick service

Create `employee-autopilot.service.ts` under `enterprise-autonomy` or a small
new `employee-autopilot` module. Its public operation should be approximately:

```ts
tick(tenantId: string, autopilotId: string): Promise<TickResult>
```

The tick must:

1. atomically claim a short database lease;
2. load the configured Employee and confirm it is active;
3. call the existing observation cycle;
4. keep only actionable, supported observations;
5. check the deduplication key;
6. call `createMission({ autoSchedule: true, actorType: 'SYSTEM', ... })`;
7. persist a tick result and correlation ID;
8. release the lease in `finally`.

Do not call tools directly from this service.

Recommended deduplication key:

```text
tenantId:ruleKey:projectId:YYYY-MM-DD
```

Enforce it with a database unique constraint, not only an in-memory check. A
failed or repeated timer tick must not create duplicate missions, tasks, or
effects.

### 4. Add the timer with the least infrastructure

For a single-instance showcase, use a Nest lifecycle-managed `setInterval`
that scans enabled rows whose `nextTickAt <= now`. Run every minute and let the
row's interval determine eligibility.

For more than one backend instance, the database lease is mandatory. Do not
assume the timer fires exactly once. If a queue system is already reliably
deployed, it can later replace the interval without changing `tick()`.

Also add a protected manual endpoint:

```text
POST /api/v1/employee-autopilots/:id/run-now
```

This uses the exact same `tick()` path and makes the showcase deterministic.
The scheduled timer proves self-starting behavior; Run now helps operators
test it without waiting.

### 5. Close mission-to-run lifecycle gaps

Change mission scheduling from “warn and continue” to an auditable result:

- no recommendation: mission becomes `WAITING` with a clear reason;
- every Work Run creation fails: mission becomes `BLOCKED`;
- at least one Work Run created: mission becomes `RUNNING`;
- all linked runs complete: mission becomes `COMPLETED`;
- any linked run waits for approval: mission exposes `WAITING_FOR_APPROVAL` in
  its derived/operator status;
- terminal failure after retry budget: mission becomes `BLOCKED` and creates
  an operator notification.

Add a supervisor pass to each tick (or a separate one-minute pass) that checks
non-terminal missions and reconciles their linked Work Runs. Reuse persisted
Work Run status; do not ask an LLM whether a run completed.

### 6. Add one minimal tenant screen

Add an **AI Employee Activity** panel, ideally to the existing home or command
center rather than creating a large new application area.

It only needs:

- Autopilot on/off;
- selected Employee and showcase rule;
- last check and next check;
- current mission and current Work Run status;
- a short step timeline;
- evidence/output link;
- approval-required banner linked to the existing approval flow;
- Run now button;
- blocked/failed reason.

Use polling every 5–10 seconds for the first showcase. Socket reliability is
not required to prove the control loop. WebSocket updates can remain an
enhancement.

Complete the approval UX needed by this path: collect a rejection reason and
make Review open the approval/run detail rather than only logging to the
browser console.

### 7. Add five essential tests

Do not expand the certification framework for the first slice. Add these five
high-value tests:

1. Due autopilot tick creates one mission and at least one Work Run.
2. Two concurrent ticks create only one mission/effect.
3. A sensitive tool pauses in `WAITING_FOR_APPROVAL` and cannot self-approve.
4. Human approval resumes the same run and preserves prior evidence.
5. A stale/failed run becomes visible as blocked and does not loop forever.

Add one browser test that enables the autopilot, clicks Run now, observes the
mission/run timeline, performs an approval if requested, and sees the final
outcome. Use a fresh tenant and retain the machine-readable summary.

## Showcase script

Prepare one fresh tenant with one incomplete project and one active AI
Employee.

1. Open **AI Employee Activity** and enable the project-health autopilot.
2. Show that no mission exists initially.
3. Click Run now for a fast demonstration (and also leave the timer enabled).
4. Show the Employee detecting low completeness and creating a mission without
   a user composing a prompt.
5. Show the governed Work Run planning and executing its safe steps.
6. If an approval step is present, approve it as the human operator and show
   the same run resuming.
7. Show the produced report/task, evidence trail, timestamps, Employee,
   tenant, and final status.
8. Run the tick again and show that the deduplication key prevents a duplicate
   mission or task.

The honest claim after this demo is:

> NeureCore has a minimum governed AI Employee autopilot that independently
> detects one supported business condition, starts deduplicated work, executes
> within policy, requests human approval for sensitive actions, monitors its
> run, and exposes the outcome and evidence to the tenant.

Do not yet claim general-purpose autonomous Employees, continuous learning,
self-modification, or reliable cross-domain automation.

## Definition of done

The minimum showcase is complete only when all are true:

- an enabled Employee starts the supported work from a timer without chat or
  an Execute click;
- repeated/concurrent ticks do not create duplicates;
- all execution goes through the governed Work Runtime;
- sensitive actions stop for approval and AI cannot approve itself;
- approval resumes the same persisted run;
- failures become visible and bounded rather than silently swallowed;
- the tenant can see last check, current work, approval, evidence, and outcome;
- backend and tenant TypeScript checks pass for the committed tree;
- the focused unit/integration tests pass;
- one fresh-tenant browser run produces a retained JSON result and screenshots.

## What to postpone

To keep this achievable, postpone:

- multiple autonomous rules and departments;
- adaptive scheduling and learning from operator behavior;
- autonomous external email/calendar/payment actions;
- multi-agent negotiation and delegation;
- complex queue infrastructure unless multiple backend replicas require it;
- real-time sockets as a dependency for correctness;
- broad industry certification.

First make one narrow loop boring, observable, deduplicated, and repeatable.
Then add new watcher-to-action rules one at a time behind tenant flags.

