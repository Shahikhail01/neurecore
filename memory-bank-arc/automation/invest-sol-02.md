# Investigation SOL-02: A Thin, Reliable AI Employee Core

Date: 2026-08-10  
Status: Code-based investigation and consolidation design  
Scope: NeureCore backend, Prisma schema, and tenant frontend

## Evidence basis

This document is derived from the executable TypeScript, Prisma schema,
controllers, module wiring, tests, and tenant frontend callers in the current
repository. It does not use implementation plans, memory-bank claims, status
reports, certification narratives, or other design documents as evidence.

The principal code inspected includes:

- `backend/src/modules/agents/`
- `backend/src/modules/agent-runtime/`
- `backend/src/modules/skill-registry/`
- `backend/src/modules/work-runtime/`
- `backend/src/modules/execution/`
- `backend/src/modules/enterprise-autonomy/`
- `backend/src/modules/enterprise-cognition/`
- `backend/src/modules/approval-port/`
- `backend/src/modules/chat/`
- `backend/src/modules/tools/`
- `backend/src/modules/ai-gateway/`
- relevant models in `backend/prisma/schema.prisma`
- agent, task, execution, chat, and operator surfaces in `frontend-tenant/src/`

## Executive conclusion

NeureCore does not currently have one AI Employee core. It has three partially
overlapping execution paths:

1. **Legacy Agent task execution** in `modules/agents`.
2. **Skill-oriented Agent Runtime** in `modules/agent-runtime`.
3. **Governed Work Runtime** in `modules/work-runtime`, plus a separate
   task/attempt worker system in `modules/execution`.

Each path owns part of the desired behavior, but none is the complete,
authoritative AI Employee lifecycle. The result is duplicated concepts,
different run records, inconsistent approval semantics, and frontend screens
that display an Employee without a dependable single answer to “what is this
Employee doing?”

The simplest sound consolidation is:

> Keep `Agent` as the tenant-owned Employee identity. Keep the Skill Registry
> as the library of reasoning/content capabilities. Make `WorkRun` the only
> durable execution state machine. Expose one `AIEmployeeCore` application
> service that resolves the Employee, creates a Work Run, executes it, and
> returns one run view. Place cognition, autonomy, events, advanced execution,
> reviews, budgets, and enterprise governance around that port only when a
> request actually needs them.

The intended core is small:

```text
request/trigger
     |
     v
AIEmployeeCore.run(employeeId, objective, context)
     |-- resolve tenant Agent identity and policy
     |-- create one WorkRun
     |-- plan from authorized capabilities
     |-- execute registered tools/skills
     |-- pause for a real approval request when needed
     |-- persist result/evidence
     v
one EmployeeRunView
```

Everything else should be a caller, adapter, policy provider, trigger, or
projection—not another execution core.

## 1. What the current code actually implements

### 1.1 Tenant Employee identity: `Agent`

The Prisma `Agent` model is the strongest existing representation of an AI
Employee identity. It already contains:

- tenant ownership;
- name, role, description, prompt, and instructions;
- model preference;
- capability and permission metadata;
- daily budget;
- concurrency and availability;
- department membership;
- selected/active/archive lifecycle;
- email and Drive identity;
- task, memory, execution, cost, and routine relations.

This model should remain. Replacing it would discard useful tenant setup and
break many frontend surfaces. However, it currently is not the identity used by
the Phase-23 Agent Runtime. That runtime uses static catalog IDs such as
`CR-AI-0501`, while tenant Agents use UUIDs. `AgentRun.agentId` is a plain
string and has no relation to `Agent`.

Consequences:

- an Agent shown in the tenant UI is not necessarily the agent recorded by
  `AgentRun`;
- tenant-specific prompt, permissions, model, budget, and department are not
  naturally authoritative in the skill runtime;
- a static executor catalog and a tenant Employee catalog can drift;
- activity cannot be reliably joined to the Employee without conventions.

### 1.2 Legacy task executor: `AgentExecutorService`

`AgentExecutorService` supports direct task dispatch from:

- `POST /agents/:id/dispatch`;
- `POST /agents/:id/task`;
- the streaming agent controller.

Its step method can call the older `ToolsService`, but a step without a tool
returns a generated “completed” object. More importantly, its local task path
loads the task and constructs a success payload describing that task; it does
not plan or perform the requested business work. It then updates the Task to
`COMPLETED`.

The governance pre-check has two unsafe/incomplete semantics:

- if governance says approval is required, the code emits/logs the condition
  but continues execution;
- if governance evaluation itself errors, the failure is treated as non-fatal
  and execution continues.

This path is not suitable as the canonical AI Employee executor. It can create
false-positive completion and uses a different tool/governance mechanism from
the Work Runtime.

Recommended disposition: retain the routes temporarily as compatibility
adapters, but replace their implementation with `AIEmployeeCore.runTask()`.
Then remove `AgentExecutorService` after caller migration.

### 1.3 Skill Agent Runtime: useful, but not a durable action runtime

`AgentRuntime` has good structural properties:

- deterministic routing to six executors;
- tenant assertion;
- narrow executor interfaces;
- Skill Registry dispatch;
- run persistence;
- evidence metadata;
- clear failure/clarification statuses;
- chat and HTTP adapters.

It is well suited to short, single-skill operations such as summarize,
rewrite, translate, extract, compare, draft a report, or draft an email.

However, it is not yet a complete AI Employee core:

- it uses static catalog IDs rather than tenant `Agent` identities;
- each run invokes one selected skill, not a general multi-step plan;
- its router uses prefix/substring rules rather than the Employee's configured
  capabilities and tenant context;
- explicit chat dispatch passes the generic intent `chat.agent-intent`, while
  executors validate against specialist intent catalogs, creating a route that
  can reject otherwise meaningful messages;
- `APPROVAL_REQUIRED` is a terminal-looking status without a resume operation
  on `IAgentRuntime`;
- `WriteStep` calls only `evaluateRequirement()`; it does not call
  `approvalPort.request()`, persist an approval ID, or subscribe/resume after a
  decision;
- the set named `APPROVAL_SENSITIVE_SKILLS` includes content drafting skills.
  Drafting content is not necessarily a side effect; sending/publishing is.
- `AgentRunAuditSink.record()` uses a deterministic audit ID based only on the
  run ID. It therefore cannot append multiple state-transition rows for the
  same run despite the schema/comment describing an append-only transition
  history.

Recommended disposition: keep its executors and Skill Registry integration as
a **skill adapter** inside the new core. Do not keep `AgentRun` as a parallel
top-level run state machine in the final design.

### 1.4 Skill Registry: keep it

The Skill Registry is a useful thin capability layer. It:

- validates skill input;
- resolves tenant-scoped text, file, thread, and record sources;
- calls the AI Gateway instead of providers directly;
- parses skill output;
- carries citations, confidence, limits, duration, and usage telemetry;
- provides concrete content skills.

It should remain the canonical implementation for model-based, mostly
non-mutating capabilities such as document analysis and report generation.

The core should expose Skill Registry entries to the Work Runtime through a
`RuntimeTool` adapter. This avoids a second execution state machine while
preserving all existing skills.

Example adapter names:

```text
skill.summarize
skill.extract
skill.compare
skill.translate
skill.draft_report
skill.draft_email
skill.article_draft
```

The adapter must classify drafting as `READ` or `INTERNAL_WRITE` depending on
whether it persists an artifact. Separate tools such as `email.send` or
`article.publish` must own the external side effect and approval requirement.

### 1.5 Work Runtime: best candidate for the canonical run state machine

`WorkRuntimeService` already implements the largest portion of the required
core:

- tenant and actor-scoped context assembly;
- context provenance snapshots;
- persistent Work Runs and steps;
- structured planning through the AI Gateway;
- strict plan validation and bounded repair;
- authorized tool views;
- per-step governance;
- approval pauses;
- tool input validation;
- timeout and bounded retry behavior;
- idempotency keys on steps;
- status, summary, and failure persistence;
- lifecycle events;
- resume and cancel operations.

Its narrow `RuntimeToolsProvider` is a good pattern: registered tools call
public capability services rather than reaching directly into arbitrary
Prisma tables.

Current limitations that must be fixed before it becomes the Employee core:

- `WorkRun` has no direct `agentId`/Employee relation; it has optional
  `hermesAgentId`, but that is not the tenant `Agent` identity;
- the HTTP controller creates Human-authored runs only;
- `createRun()` persists a run but does not execute it;
- Enterprise Cognition and Enterprise Autonomy call `createRun()` without
  subsequently calling `execute()`, leaving created runs in `CREATED` unless
  another caller explicitly acts;
- the Work Runtime event consumer projects events to sockets but does not
  execute newly created runs;
- the initial runtime tool catalog is narrow and does not expose the Skill
  Registry;
- `tasks.create` does not accept/validate an assignee, project, goal, due date,
  or capability requirements, so it cannot yet satisfy “create a task and give
  it to the relevant Employee”;
- there is no core-level trigger/idempotency key on Work Run creation, only
  step-level idempotency;
- the safe planner fallback selects a read tool but supplies `{}` input, which
  will fail for read tools requiring `projectId` or `customerId`;
- status projection across Employee, Task, Mission, and Work Run is not unified.

These are smaller and safer gaps to close than trying to evolve the legacy
executor or the single-skill Agent Runtime into a durable orchestration system.

### 1.6 Task execution and `ExecutionAttempt`: advanced, but still synthetic

The `execution` module has valuable enterprise mechanics:

- transactional request creation;
- task/agent eligibility checks;
- idempotency on execution request;
- outbox dispatch;
- durable attempts;
- worker leases, heartbeat, sweeper, retries, cancellation, and fencing;
- evidence and tool-call tables;
- review and revision lineage.

But its actual `runExecution()` currently returns:

```text
Draft execution for: <task instructions>
```

with zero tool calls. Thus the surrounding worker infrastructure is more
mature than its business execution engine.

Recommended disposition: do not make `ExecutionAttempt` the first thin core.
Keep it as an optional **durability/review envelope** for high-value Task-based
work. Initially, make its worker delegate actual execution to
`AIEmployeeCore.run()`/Work Runtime and store the returned Work Run ID. Later,
merge overlapping status/evidence data if operational experience justifies it.

### 1.7 Enterprise Cognition and Autonomy: callers, not the core

Enterprise Cognition can produce recommendations and mark them for Work Run
handoff. Enterprise Autonomy can observe conditions, plan a mission, and
create Work Runs. These are advanced trigger and decision layers.

They should never own tool execution. Their correct role is:

```text
observe/reason -> request AIEmployeeCore.run(...)
```

At present they call `WorkRuntime.createRun()` only. The consolidated API must
make “create and start” one atomic application-level operation so callers
cannot accidentally leave runs dormant.

### 1.8 Tenant frontend: identity and attempt views exist, unified run UX does not

The frontend actively consumes:

- `/agents` for Employee inventory, departments, marketplace, inspector, and
  orchestration views;
- `/execution/attempts` and attempt details for operator evidence/review;
- agent streaming endpoints;
- task and assignment endpoints.

It has little direct production usage of `/agent-runtime` and
`/work-runtime`; Work Runtime references are concentrated in browser tests.
The current orchestration endpoint also supplies random performance metrics
when metadata is missing, which can make the control room look alive without
grounded execution data.

The frontend should keep the existing Agent inventory and inspector, but its
activity/status panels must read one Employee Run API backed by Work Runs.
Random performance fallback must be removed and replaced with zero/unknown or
aggregated run facts.

## 2. Target thin AI Employee core

### 2.1 Core responsibilities

The core should do exactly seven things:

1. Resolve and authorize a tenant Employee.
2. Accept an objective plus bounded context references.
3. Create one durable, idempotent run.
4. Plan against only authorized registered capabilities.
5. Execute steps with governance and real approval pauses.
6. Persist output, evidence, costs, and terminal state.
7. Return one stable Employee Run view.

It should not own:

- enterprise health scoring;
- mission decomposition across departments;
- long-term learning;
- model registry administration;
- certification harnesses;
- UI projections;
- socket transport;
- complex review workflows for every run;
- domain-specific business logic.

Those systems integrate through ports and events.

### 2.2 Proposed public contract

Add a small module, for example `modules/ai-employee-core/`, with a single
application service and token:

```ts
export const AI_EMPLOYEE_CORE = Symbol('AI_EMPLOYEE_CORE');

export interface StartEmployeeRunInput {
  tenantId: string;
  employeeId: string;          // Agent UUID
  requestedBy: {
    actorId: string;
    actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  };
  objective: string;
  context?: {
    projectId?: string;
    customerId?: string;
    taskId?: string;
    fileIds?: string[];
    threadId?: string;
  };
  trigger?: {
    type: 'USER' | 'TASK' | 'SCHEDULE' | 'EVENT' | 'MISSION';
    sourceId?: string;
  };
  idempotencyKey: string;
}

export interface AIEmployeeCore {
  start(input: StartEmployeeRunInput): Promise<EmployeeRunView>;
  get(tenantId: string, runId: string): Promise<EmployeeRunView | null>;
  list(tenantId: string, filter?: EmployeeRunFilter): Promise<EmployeeRunView[]>;
  resume(tenantId: string, runId: string): Promise<EmployeeRunView>;
  cancel(tenantId: string, runId: string, reason: string): Promise<EmployeeRunView>;
}
```

`start()` must create and execute until `COMPLETED`, `FAILED`, or
`WAITING_FOR_APPROVAL`. Callers should not have to remember to invoke a second
method.

### 2.3 One canonical persistence record

Use `WorkRun` as the canonical run. Add only the identity and correlation
fields the code currently lacks:

```text
WorkRun
+ employeeId          String? -> Agent.id
+ taskId              String?
+ triggerType         String
+ triggerSourceId     String?
+ idempotencyKey      String
+ parentRunId         String?
+ approvalState       derived from steps, not duplicated if possible
+ requestedByActorId  String
```

Add:

```text
@@unique([tenantId, idempotencyKey])
@@index([tenantId, employeeId, createdAt])
@@index([tenantId, taskId])
```

Avoid introducing a fourth run table. During migration, `AgentRun` and
`ExecutionAttempt` may store `workRunId` to link legacy views to the canonical
run.

### 2.4 Employee resolution

Create `EmployeeResolver` with these checks:

- Agent exists under `tenantId`;
- `isActive`, `isSelected`, and not archived;
- availability allows a new run;
- concurrency is below `maxConcurrency`;
- requested context does not cross tenant;
- task assignment, when present, matches the Employee or is explicitly being
  assigned by an authorized actor;
- Agent capabilities/permissions determine the authorized tool view;
- Agent prompt/instructions are appended to planning context, not trusted as a
  source of authorization;
- model selection remains delegated to AI Gateway.

Do not use `Agent.status` as the source of running truth. Derive current
activity from non-terminal Work Runs and project it to the UI. Status updates
may remain as a cache/projection.

### 2.5 Unified capability model

Use Work Runtime's `RuntimeTool` as the common execution contract. Register
three categories:

1. **Reasoning/content skills** via Skill Registry adapters.
2. **Internal business commands** such as create task, assign task, add memory,
   or update an allowed record.
3. **External/irreversible commands** such as send email, publish, delete,
   payment, or lifecycle completion.

Every registration must declare:

- stable name;
- description;
- capability;
- effect: `READ`, `INTERNAL_WRITE`, or `EXTERNAL_WRITE`;
- required authority;
- approval sensitivity;
- input validation;
- timeout and retries;
- implementation through a public capability service/command.

Do not permit execution through both `ToolsService` and `ToolRegistry`. Adapt
any still-needed legacy tools into `RuntimeTool`, then retire direct legacy
dispatch.

Minimum useful tool set:

```text
skill.summarize
skill.extract
skill.compare
skill.draft_report
documents.get_text
reports.save_draft
tasks.create
tasks.assign
tasks.get
projects.get_summary
customers.get_summary
memory.get_project
memory.add_project
```

This supports the requested basic Employee behaviors:

- analyze a document;
- create and persist a report;
- create a task;
- select and assign a relevant Employee;
- record evidence and outcome.

### 2.6 Task assignment should be deterministic first

Do not ask an LLM to invent an Employee ID. Add a read tool or internal
resolver:

```ts
findEligibleEmployees({
  tenantId,
  requiredCapabilities,
  departmentId?,
  classification?,
})
```

Rank by:

1. tenant and active/selected status;
2. required capability coverage;
3. data-classification eligibility;
4. department/role match;
5. current non-terminal Work Run count;
6. stable tie-breaker such as Agent ID.

Then expose `tasks.assign` with validated `taskId` and `employeeId`. The planner
may choose criteria, but the server resolves and verifies IDs.

### 2.7 Real approval and resume

Use one approval mechanism: the existing Approval Port.

When Work Runtime governance returns `REQUIRE_APPROVAL`, it must:

1. call `approvalPort.request()`;
2. persist `approvalId` on the Work Run step;
3. set step and run to `WAITING_FOR_APPROVAL`;
4. stop before executing the tool;
5. resume only from an approval event/consumer tied to that approval ID;
6. revalidate tenant, Employee authority, tool registration, inputs, and
   approval freshness;
7. execute the same persisted step once;
8. treat rejection as a terminal or revision outcome with a reason.

Remove the parallel `WriteStep` approval state machine after skill writes are
adapted into runtime tools. In particular, distinguish **drafting** from
**sending/publishing**. Creating a private report draft can normally be an
internal write; sending it externally requires approval.

### 2.8 Outputs and evidence

For the thin core, Work Run step results plus an artifact reference are enough.
Do not duplicate full results into Task, AgentRun, ExecutionAttempt, timeline,
and multiple audit tables synchronously.

Recommended approach:

- Work Run and steps: canonical status and execution metadata;
- EvidenceArtifact or a small artifact service: report/document output;
- enterprise events: immutable lifecycle facts;
- Task: link to `workRunId` and store only operator-friendly summary/state;
- projections: build timeline, metrics, mission status, and notifications
  asynchronously.

Never store only “completed” without an artifact, tool result, or explicit
completion criterion.

## 3. How advanced systems fit around the core

| Existing system | Role after consolidation | Activation rule |
|---|---|---|
| Agent/tenant templates | Provision Employee identity and defaults | Employee creation/deployment only |
| Skill Registry | Reasoning and content capability library | Planner selects a skill tool |
| AI Gateway | Model routing, usage, provider failover | Any LLM-backed plan/skill |
| Context Plane | Authorized context assembly | Every run, with bounded requested scope |
| Governance | Per-tool authorization policy | Every step |
| Approval Port | Create/decide/resume sensitive actions | Only `REQUIRE_APPROVAL` steps |
| Enterprise Events | Durable lifecycle publication | State transitions |
| Sockets | Best-effort UI projection | Never required for correctness |
| Enterprise Cognition | Recommend objectives/runs | Advisory or enabled auto-handoff |
| Enterprise Autonomy | Scheduled/event trigger and mission grouping | Only enabled tenant rules |
| ExecutionAttempt worker | Extra leases/review/revision for high-value Tasks | Policy or task type requires it |
| Reviews | Quality/HITL review after output | Output/task policy requires review |
| Cost ceilings | Hard stop around AI Gateway/tool spend | Tenant config enabled; preferably always available |
| Hermes/sidecar | Specialized sandboxed execution | Tool requires isolated workspace/runtime |
| Memory/knowledge | Context input and approved output retention | Explicit tools, never hidden global mutation |
| Analytics/observability | Read projections from run facts | Asynchronous/reporting path |

The rule is simple: advanced layers may decide whether to call the core,
constrain the core through a port, or consume its events. They must not create
another way to execute Employee work.

## 4. Migration plan

### Phase 0: freeze new execution paths

- Declare `WORK_RUNTIME` plus `AI_EMPLOYEE_CORE` as the only allowed new
  execution dependency.
- Add an architecture test that rejects new imports of
  `AgentExecutorService.executeTask()` outside its compatibility adapter.
- Add an architecture test that prevents direct Skill Registry mutation calls
  from controllers once adapters exist.
- Inventory runtime routes and label them canonical or compatibility in code.

### Phase 1: make Work Run Employee-aware

- Add `employeeId`, `taskId`, trigger, correlation, and run idempotency fields.
- Add `EmployeeResolver`.
- Add `AIEmployeeCore.start/get/list/resume/cancel`.
- Make `start()` call both `createRun()` and `execute()`.
- Add an Employee Run controller:

```text
POST /api/v1/ai-employees/:employeeId/runs
GET  /api/v1/ai-employees/:employeeId/runs
GET  /api/v1/employee-runs/:runId
POST /api/v1/employee-runs/:runId/cancel
```

- Keep JWT actor identity separate from `employeeId`.

### Phase 2: bring basic skills into Work Runtime

- Create a generic `SkillRuntimeToolAdapter` or explicit adapters.
- Register summarize, extract, compare, and draft-report first.
- Add document/file SourceRef support to tool inputs.
- Add a `reports.save_draft` tool returning an artifact ID.
- Verify that a document-analysis run produces persisted output and citations.

### Phase 3: complete task creation and assignment

- Expand `tasks.create` input with project/goal/due date/capability metadata.
- Add deterministic eligible-Employee lookup.
- Add `tasks.assign` with tenant and eligibility validation.
- Link created Task to its originating Work Run.
- When assigned work should execute, call the same `AIEmployeeCore.start()`
  with a task idempotency key.

### Phase 4: unify approvals

- Inject Approval Port into Work Runtime governance execution.
- Persist real approval requests and IDs.
- Confirm approval consumer resumes the persisted step.
- Adapt write-oriented skills to runtime tools.
- Remove `WriteStep` approval behavior and Agent Runtime's unresumable
  `APPROVAL_REQUIRED` path.

### Phase 5: migrate existing callers

Migrate in this order:

1. `/agents/:id/dispatch` and `/agents/:id/task` -> core compatibility adapter.
2. agent streaming execution -> core run/event stream.
3. `/agents/:id/run` and `/agent-runtime/run` -> core with skill hints.
4. chat `/agent` dispatch -> core.
5. Enterprise Cognition auto-handoff -> `core.start()`.
6. Enterprise Autonomy scheduling -> `core.start()`.
7. project activation/task auto-execution -> `core.start()` or the advanced
   ExecutionAttempt adapter according to policy.

For each migrated endpoint, preserve its response shape temporarily while
including the canonical `workRunId`.

### Phase 6: simplify persistence and remove false projections

- Stop creating new `AgentRun` rows after all callers use Work Runs.
- Retain read compatibility or migrate historical rows if valuable.
- Remove random orchestration performance fallback.
- Derive Employee status and metrics from real Work Runs.
- Decide later whether `ExecutionAttempt` remains a high-assurance envelope or
  can merge with Work Run; do not perform a risky immediate schema merger.

### Phase 7: activate self-starting behavior

Only after the core is reliable:

- add one tenant-controlled schedule/event trigger;
- use a database lease and run-level idempotency key;
- call `AIEmployeeCore.start()`;
- monitor non-terminal Work Runs and surface blocked/approval states;
- expand autonomous rules one at a time.

## 5. Minimal first vertical slice

Implement one end-to-end scenario before broad migration:

> A tenant user assigns a document-analysis objective to a selected AI
> Employee. The Employee reads the uploaded document, summarizes risks,
> creates and saves a report artifact, creates a follow-up Task, resolves an
> eligible Employee, assigns the Task, and returns one traceable run result.

Required tools:

```text
documents.get_text       READ
skill.summarize          READ
skill.extract            READ
skill.draft_report       READ
reports.save_draft       INTERNAL_WRITE
employees.find_eligible  READ
tasks.create             INTERNAL_WRITE
tasks.assign             INTERNAL_WRITE
```

No external effect is necessary, so the demonstration can complete without
approval. Add an optional `email.send` final step to demonstrate real approval
pause and resume.

Expected single result:

```json
{
  "runId": "...",
  "employeeId": "tenant-agent-uuid",
  "status": "COMPLETED",
  "objective": "Analyze the uploaded contract and delegate follow-up",
  "summary": "Report created and follow-up task assigned",
  "artifacts": [{ "id": "...", "type": "REPORT" }],
  "createdTaskIds": ["..."],
  "steps": [
    { "tool": "documents.get_text", "status": "SUCCEEDED" },
    { "tool": "skill.draft_report", "status": "SUCCEEDED" },
    { "tool": "reports.save_draft", "status": "SUCCEEDED" },
    { "tool": "employees.find_eligible", "status": "SUCCEEDED" },
    { "tool": "tasks.create", "status": "SUCCEEDED" },
    { "tool": "tasks.assign", "status": "SUCCEEDED" }
  ]
}
```

## 6. Tenant frontend changes

Keep the current Employee inventory, marketplace, department, and inspector
surfaces. Add one shared Employee activity client:

```ts
startEmployeeRun(employeeId, request)
getEmployeeRun(runId)
listEmployeeRuns(employeeId, filters)
cancelEmployeeRun(runId, reason)
```

Update the UI so:

- Agent cards show real last-run/current-run facts;
- the inspector has a Run/Activity tab;
- Task inspector links to its Employee Work Run;
- execution detail can render Work Run steps or delegates to one shared run
  timeline component;
- approval banners link to the persisted approval;
- polling is the correctness fallback; sockets only accelerate updates;
- unknown metrics display as unknown, not randomized values.

The frontend should not need to know whether Cognition, Autonomy, Hermes, or an
ExecutionAttempt wrapper initiated the run. It consumes one EmployeeRunView.

## 7. Required correctness tests

### Core unit tests

1. Reject a foreign-tenant Employee.
2. Reject inactive, unselected, archived, or unavailable Employee.
3. Return the existing run for a repeated idempotency key.
4. Filter tools by Employee authority/capabilities.
5. Reject planner references to unknown/unauthorized tools.
6. Never mark a run complete when a step failed.
7. Never execute an approval-sensitive tool before approval.
8. Resume the same persisted step exactly once after approval.

### Integration tests

1. Analyze text/file -> save report artifact.
2. Create task -> select eligible Employee -> assign tenant-safely.
3. Concurrent identical starts create one Work Run and one task effect.
4. Planner outage either produces a valid input-complete safe fallback or
   fails honestly; it must not create an invalid `{}` tool call.
5. AI Gateway failure leaves a clear failed/paused state.
6. Socket failure does not affect the durable run.
7. Run evidence and citations remain queryable after completion.

### Compatibility tests

1. Legacy dispatch route returns accepted plus canonical `workRunId`.
2. Chat agent command returns the core run output.
3. Cognition handoff creates and starts a run, rather than leaving `CREATED`.
4. Autonomy mission stores the started run ID and reflects its status.

### Browser test

Use one fresh tenant and real backend persistence:

1. choose an Employee;
2. select/upload a document;
3. request analysis and delegation;
4. observe real step progress;
5. open the report;
6. open the assigned Task and Employee;
7. repeat the request with the same idempotency key and prove no duplicate;
8. optionally approve an external-send step and observe resume.

## 8. Operational invariants

The thin core is ready only when these invariants hold:

- one tenant Agent UUID identifies the Employee in every new run;
- one Work Run is the source of truth for execution state;
- every tool call is registered, authorized, validated, and tenant-scoped;
- no controller or trigger invokes business tools directly;
- no synthetic output can mark business work completed;
- one idempotency key cannot create multiple active runs/effects;
- approval-required work creates a real approval and cannot self-approve;
- approval resumes the exact same step with revalidation;
- failed infrastructure cannot silently become successful business state;
- socket/UI failure cannot change execution correctness;
- every completed run has outcome evidence or an explicit no-artifact
  completion criterion;
- Employee dashboards use grounded run data.

## 9. What to retain, adapt, and retire

### Retain

- Prisma `Agent` and tenant Employee management;
- AI Gateway;
- Skill Registry and source resolvers;
- Work Runtime planner, registry, governance, executor, repository, and status
  machine;
- Context Plane;
- Approval Port;
- enterprise event transport;
- Task, artifact, review, and tenant isolation capabilities.

### Adapt

- Agent Runtime executors -> skill selection/advice or RuntimeTool adapters;
- legacy agent endpoints -> AIEmployeeCore adapters;
- ExecutionAttempt worker -> optional high-assurance wrapper delegating actual
  work to the core;
- Cognition/Autonomy -> core callers;
- frontend orchestration and execution views -> EmployeeRunView projections;
- old ToolsService tools -> RuntimeTool registrations where still useful.

### Retire after migration

- synthetic local completion in `AgentExecutorService`;
- direct fire-and-forget legacy task dispatch;
- parallel AgentRun state as a top-level execution truth;
- unresumable `WriteStep` approval signaling;
- duplicate planner/tool execution routes;
- randomized Employee performance metrics;
- any route that can execute a business effect outside the canonical core.

## 10. Practical decision rule for advanced systems

For every existing or future module, ask:

1. Does it identify an Employee? Use `Agent`/EmployeeResolver.
2. Does it initiate work? Call `AIEmployeeCore.start()`.
3. Does it perform an action? Register a RuntimeTool.
4. Does it reason over content? Register/use a Skill adapter.
5. Does it constrain an action? Implement a governance/approval/context port.
6. Does it react to outcomes? Subscribe to canonical run events.
7. Does it only display state? Read the Employee Run projection.

If a module answers none of these and instead creates its own run, planner,
tool dispatcher, approval flag, or completion record, it is recreating the
core and should not be added.

## Final recommendation

Do not rewrite NeureCore. The code already contains a viable core in pieces.
Consolidate around the tenant `Agent`, Skill Registry, and Work Runtime:

```text
Agent identity
   +
Skill-backed and command-backed RuntimeTools
   +
WorkRun state machine
   +
real Approval Port resume
   =
thin AI Employee core
```

First prove document analysis, report creation, task creation, and deterministic
Employee assignment through this one path. Then reconnect Cognition, Autonomy,
ExecutionAttempt, reviews, schedules, events, and specialized runtimes as
optional layers. This preserves the valuable advanced work while removing the
current ambiguity over which system actually makes an AI Employee perform.

