# Implementation Plan SOL-02: Thin, Reliable AI Employee Core

Date: 2026-08-10  
Status: Proposed implementation plan  
Companion: `memory-bank-arc/automation/invest-sol-02.md`

## 1. Objective

Establish one canonical AI Employee execution path without rewriting NeureCore:

```text
Tenant Agent identity
    + authorized context
    + Skill-backed and command-backed RuntimeTools
    + WorkRun state machine
    + real approval pause/resume
    = reliable AI Employee core
```

The first production-shaped outcome must allow a tenant AI Employee to:

1. analyze a tenant-owned document;
2. create and persist a report with citations/evidence;
3. create a follow-up task;
4. resolve and assign the task to an eligible Employee;
5. expose one accurate run timeline and outcome;
6. optionally pause before an external action and resume after human approval;
7. avoid duplicate runs and effects under retries or concurrent requests.

This plan does not promise that defects are impossible. It prevents avoidable
corruption by requiring additive migrations, transactional boundaries,
idempotency, compatibility adapters, focused tests, full validation, and a
rollback point before every behavioral cutover.

## 2. Non-negotiable engineering rules

### 2.1 SOLID rules

#### Single Responsibility Principle

- `AIEmployeeCoreService` coordinates one Employee run; it does not implement
  tools, persistence queries, model calls, approvals, or frontend projections.
- `EmployeeResolver` resolves and authorizes an Employee only.
- `WorkRuntimeService` owns the execution state machine only.
- `WorkPlanner` produces validated plans only.
- `ToolRegistry` registers and retrieves executable capabilities only.
- each RuntimeTool adapts one public capability operation only;
- `ApprovalPort` owns approval request/decision/status behavior only;
- projections translate canonical events into UI/read models only.

#### Open/Closed Principle

- add capabilities by registering RuntimeTools, not by editing the core loop;
- add triggers by implementing an `EmployeeRunTrigger` adapter;
- add policies through governance ports;
- add output types through artifact adapters;
- do not add domain-specific `if/else` branches to `AIEmployeeCoreService`.

#### Liskov Substitution Principle

- every port implementation must preserve typed success/failure semantics;
- fake/test adapters must enforce tenant scope and failure behavior equivalent
  to production adapters;
- no adapter may return success when the underlying capability did not perform
  its declared effect;
- RuntimeTools must honor their declared effect, timeout, and retry metadata.

#### Interface Segregation Principle

- callers depend on small ports such as `start/get/list/resume/cancel`, not a
  broad service exposing internals;
- tools receive a narrow `ToolContext`;
- Employee resolution does not expose arbitrary Prisma records;
- UI clients consume a stable `EmployeeRunView`, not backend persistence
  models.

#### Dependency Inversion Principle

- the core depends on `IWorkRuntime`, `IEmployeeResolver`, and other tokens;
- controllers, chat, cognition, autonomy, and workers depend on
  `AI_EMPLOYEE_CORE`, not concrete services;
- domain capability adapters call public service/command ports, never arbitrary
  Prisma tables;
- model access remains behind `AiGatewayService`;
- approval access remains behind `IApprovalPort`.

### 2.2 Data integrity rules

- all identifiers are server-resolved and tenant-scoped;
- all write effects have database-backed idempotency;
- run creation and its idempotency record are atomic;
- no destructive schema migration occurs during consolidation;
- new columns are nullable or safely defaulted before code depends on them;
- old routes remain available until compatibility tests pass;
- existing tables are not dropped in this plan;
- a completed run must have satisfied completion criteria and persisted
  evidence/output references;
- approval-required tools never execute before a persisted approval decision;
- sockets and background projections are never correctness dependencies.

### 2.3 Worktree and change-control rules

- preserve unrelated user changes;
- one phase per reviewable change set;
- no bulk formatting of unrelated files;
- run schema validation before generating migrations;
- inspect generated SQL before application;
- record a rollback procedure for every migration;
- do not cut over callers while required validation is failing;
- never hide failures through synthetic success, empty catch blocks, or random
  fallback data.

## 3. Scope

### In scope

- canonical AI Employee application port;
- Employee-aware and idempotent Work Runs;
- Skill Registry to RuntimeTool adapters;
- document analysis and report artifact creation;
- deterministic Employee eligibility and task assignment;
- real approval request and resume in Work Runtime;
- compatibility adapters for current execution routes;
- one frontend Employee activity/run view;
- migration of chat, cognition, and autonomy handoff;
- correctness, integration, compatibility, and browser tests;
- observability and rollback controls.

### Out of scope

- deleting historical execution tables;
- general-purpose autonomous enterprise behavior;
- self-modifying agents;
- multi-agent negotiation;
- autonomous payments or publishing;
- replacing every domain tool;
- redesigning the full tenant frontend;
- immediately merging `ExecutionAttempt` and `WorkRun`;
- broad certification across every industry.

## 4. Target module boundaries

Create:

```text
backend/src/modules/ai-employee-core/
├── ai-employee-core.module.ts
├── ai-employee-core.tokens.ts
├── application/
│   └── ai-employee-core.service.ts
├── contracts/
│   ├── ai-employee-core.interface.ts
│   ├── employee-resolver.interface.ts
│   ├── employee-run.types.ts
│   └── employee-trigger.interface.ts
├── identity/
│   └── employee-resolver.service.ts
├── controllers/
│   └── ai-employee-core.controller.ts
├── adapters/
│   ├── legacy-agent-dispatch.adapter.ts
│   ├── skill-runtime-tool.adapter.ts
│   └── execution-attempt.adapter.ts
└── projections/
    └── employee-run-view.mapper.ts
```

The core module imports `AgentsModule` read capability, `WorkRuntimeModule`,
and only the narrow modules necessary for ports. Avoid circular imports by
moving shared interfaces to contracts and injecting symbols.

## 5. Canonical contracts

### 5.1 Start contract

```ts
export interface StartEmployeeRunInput {
  tenantId: string;
  employeeId: string;
  requestedBy: {
    actorId: string;
    actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  };
  objective: string;
  context?: {
    projectId?: string;
    customerId?: string;
    taskId?: string;
    fileIds?: readonly string[];
    threadId?: string;
    includeCapabilities?: readonly string[];
  };
  trigger: {
    type: 'USER' | 'TASK' | 'SCHEDULE' | 'EVENT' | 'MISSION';
    sourceId?: string;
  };
  idempotencyKey: string;
}
```

Validation requirements:

- trim and bound objective length;
- require a real tenant and Employee UUID;
- reject wildcard tenant IDs;
- validate context identifiers structurally;
- cap file IDs and included capabilities;
- require an idempotency key with bounded length;
- ignore any client-supplied authority, role, tool allowlist, model, or tenant.

### 5.2 Public core interface

```ts
export interface IAIEmployeeCore {
  start(input: StartEmployeeRunInput): Promise<EmployeeRunView>;
  get(tenantId: string, runId: string): Promise<EmployeeRunView | null>;
  list(
    tenantId: string,
    filter?: EmployeeRunFilter,
  ): Promise<readonly EmployeeRunView[]>;
  resume(tenantId: string, runId: string): Promise<EmployeeRunView>;
  cancel(
    tenantId: string,
    runId: string,
    reason: string,
  ): Promise<EmployeeRunView>;
}
```

### 5.3 Stable view

```ts
export interface EmployeeRunView {
  id: string;
  tenantId: string;
  employee: {
    id: string;
    name: string;
    role: string | null;
  };
  objective: string;
  status:
    | 'CREATED'
    | 'PLANNING'
    | 'RUNNING'
    | 'WAITING_FOR_APPROVAL'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  trigger: { type: string; sourceId: string | null };
  taskId: string | null;
  summary: string | null;
  failure: { code: string; reason: string } | null;
  approvalId: string | null;
  artifacts: readonly ArtifactReference[];
  steps: readonly EmployeeRunStepView[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
```

Do not expose raw tool inputs/results, secrets, prompts, or unrestricted
context snapshots in this view.

## 6. Database migration strategy

### 6.1 Additive WorkRun fields

Add to `WorkRun`:

```prisma
employeeId        String?
taskId            String?
triggerType       String        @default("USER")
triggerSourceId   String?
idempotencyKey    String?
parentRunId       String?
requestedByActorId String?

employee Agent? @relation(fields: [employeeId], references: [id], onDelete: SetNull)

@@unique([tenantId, idempotencyKey])
@@index([tenantId, employeeId, createdAt(sort: Desc)])
@@index([tenantId, taskId])
```

If Prisma/PostgreSQL uniqueness with nullable keys behaves as expected,
existing null rows remain compatible. New core-created rows must always have a
non-null idempotency key.

Add the reverse `workRuns` relation to `Agent` if Prisma requires it.

### 6.2 Optional compatibility links

Add nullable `workRunId` to `AgentRun` and `ExecutionAttempt` only when the
corresponding adapter is implemented. Do not require these fields initially.

### 6.3 Migration verification

Before application:

1. run `pnpm prisma validate`;
2. generate migration SQL without applying it;
3. verify there are no table drops, column drops, destructive casts, or
   accidental default rewrites;
4. verify indexes are tenant-prefixed;
5. test migration on a database copy or disposable database;
6. run row-count and nullability checks before and after;
7. verify the old backend can still start against the additive schema;
8. document rollback as code rollback plus optional harmless columns retained.

## 7. Phase-by-phase implementation

Each phase has a hard exit gate. Do not begin the next behavioral cutover
until the current gate passes.

### Phase 0 — Establish a clean baseline

Goal: distinguish pre-existing failures from new regressions.

Tasks:

1. Capture `git status` and preserve all unrelated changes.
2. Run and record:
   - backend TypeScript check;
   - backend build;
   - focused agent-runtime/work-runtime tests;
   - frontend TypeScript check;
   - frontend unit tests relevant to Agents/Tasks/Execution;
   - Prisma validation.
3. Classify every failure as pre-existing or plan-blocking.
4. Fix plan-blocking baseline errors before modifying core behavior.
5. Add an architecture test preventing new direct uses of legacy
   `AgentExecutorService.executeTask()`.

Exit gate:

- the baseline is reproducible;
- required focused tests pass;
- TypeScript/build gates used for later comparison are known;
- no unidentified schema drift exists.

### Phase 1 — Add contracts and Employee resolution

Goal: establish the SOLID application boundary without behavior cutover.

Tasks:

1. Create core tokens and interfaces.
2. Implement `EmployeeResolver` using a narrow query/select.
3. Return an immutable `ResolvedEmployee` containing only:
   - identity and tenant;
   - role/instructions;
   - capability and permission sets;
   - authority inputs;
   - lifecycle/concurrency facts;
   - model preference as advisory metadata.
4. Reject inactive, unselected, archived, unavailable, foreign-tenant, or
   over-concurrency Employees.
5. Derive concurrency from non-terminal Work Runs, not mutable status alone.
6. Add unit and real-database tenant-isolation tests.

Exit gate:

- all Employee resolution branches are tested;
- no write occurs in the resolver;
- no wildcard tenant path exists;
- no controller consumes the new core yet.

### Phase 2 — Make WorkRun Employee-aware and idempotent

Goal: create one canonical Employee run safely.

Tasks:

1. Apply the additive migration.
2. Extend Work Runtime create parameters with Employee, trigger, task, and
   idempotency metadata.
3. Implement repository `createOrGetByIdempotencyKey()` transactionally.
4. Ensure a repeated key returns the original run without re-planning or
   re-executing completed effects.
5. Persist `requestedByActorId` separately from executing `employeeId`.
6. Include Employee ID in lifecycle event payloads.
7. Implement the Employee Run view mapper.

Concurrency test:

- start the same tenant/key from two promises/processes;
- assert one Work Run row;
- assert one set of steps/effects;
- assert both callers receive the same run ID.

Exit gate:

- migration verified;
- existing Work Runtime tests remain green;
- idempotent concurrency test passes against PostgreSQL;
- old rows remain readable.

### Phase 3 — Implement `AIEmployeeCoreService`

Goal: provide one create-and-execute operation.

Algorithm:

```text
validate request
  -> resolve Employee
  -> create-or-get WorkRun
  -> if existing terminal/waiting/running, return it
  -> execute WorkRun
  -> map to EmployeeRunView
```

Tasks:

1. Implement only orchestration in the service.
2. Never call tools, Prisma, AI Gateway, or Approval Port directly.
3. Treat `start()` as create-and-execute until terminal/approval pause.
4. Prevent a second caller from executing the same active run concurrently;
   use existing optimistic state transitions and add a lease only if tests
   show it is necessary.
5. Implement `get`, `list`, `resume`, and `cancel` as thin delegations.
6. Add controller DTO validation and JWT-derived actor/tenant context.
7. Never accept `actorType=AI_AGENT` from a normal tenant HTTP request.

Exit gate:

- one HTTP call produces a canonical run;
- tenant isolation tests pass;
- duplicate start cannot duplicate execution;
- cancellation and get/list are tested.

### Phase 4 — Adapt read-only skills

Goal: perform real document/content reasoning through Work Runtime.

Tasks:

1. Define a `SkillRuntimeToolFactory` or explicit tool classes depending on
   which produces clearer validation.
2. Register:
   - `skill.summarize`;
   - `skill.extract`;
   - `skill.compare`;
   - `skill.draft_report`.
3. Each adapter:
   - validates typed input;
   - builds tenant-scoped SourceRefs;
   - invokes `SkillRegistry.dispatch()`;
   - returns content, confidence, citations, and limits;
   - declares no external side effect.
4. Add `documents.get_text` only if the Skill Registry SourceRef path cannot
   directly satisfy planner/tool composition cleanly.
5. Never place full document content in Work Run event payloads or logs.
6. Correct safe planner fallback:
   - use only tools whose required input can be constructed from supplied
     context; or
   - produce an empty/clarification plan and pause honestly.

Exit gate:

- a tenant file cannot be read by another tenant;
- report drafting returns real model output or an honest typed failure;
- citations/evidence persist;
- no legacy AgentRun is needed for this path.

### Phase 5 — Persist reports and artifacts

Goal: make generated work durable and inspectable.

Tasks:

1. Identify the existing artifact/public service appropriate for report
   storage; do not add direct Prisma access to the tool.
2. Register `reports.save_draft` as `INTERNAL_WRITE`.
3. Validate title, content size, MIME type, source run, project/customer scope,
   and tenant.
4. Use a step/run-derived idempotency key so retries return the same artifact.
5. Store artifact ID/checksum, not full artifact content, in run result/events.
6. Add artifact references to `EmployeeRunView`.

Exit gate:

- exactly one artifact under retry;
- artifact is tenant-scoped and downloadable by an authorized user;
- completed report run links to persisted evidence.

### Phase 6 — Add deterministic Employee selection and task assignment

Goal: support “create a task and give it to the relevant Employee.”

Tasks:

1. Implement `EmployeeEligibilityPort` separately from Employee resolution.
2. Query only tenant Employees meeting:
   - active/selected/non-archived requirements;
   - required capability coverage;
   - data-classification eligibility;
   - optional department/role constraints;
   - concurrency limits.
3. Rank deterministically by capability coverage, department/role match,
   workload, then stable Agent ID.
4. Register `employees.find_eligible` as `READ`.
5. Expand `tasks.create` to accept validated project, goal, due date,
   acceptance criteria, expected output, and capability metadata.
6. Register `tasks.assign` as `INTERNAL_WRITE`.
7. Revalidate Employee eligibility inside `tasks.assign`; never trust planner
   output alone.
8. Add idempotency to task creation/assignment using run-step keys.
9. Link the Task to originating Work Run through the least disruptive
   available relation/metadata; prefer an explicit nullable field if needed.

Exit gate:

- planner cannot assign a fabricated or foreign Employee ID;
- one task is created and assigned under retry/concurrency;
- overloaded/ineligible Employees are not selected;
- frontend can follow Task -> Employee -> Work Run.

### Phase 7 — Implement real approval request and resume

Goal: remove approval flags that cannot resume.

Tasks:

1. Inject `IApprovalPort` into the Work Runtime approval collaborator, not the
   core service.
2. When governance returns `REQUIRE_APPROVAL`:
   - call `request()` once using step idempotency/correlation;
   - persist approval ID on the step;
   - set step/run waiting states;
   - publish approval-requested event;
   - stop before tool execution.
3. On approval event:
   - locate run/step by approval ID and tenant;
   - verify decision is approved;
   - revalidate Employee, tool registration, authority, policy, and input;
   - atomically claim the step;
   - execute once;
   - continue remaining steps.
4. On rejection, persist reason and terminate/pause according to policy.
5. Prohibit requester/AI Employee self-approval through Approval Port policy.
6. Split draft versus external action:
   - `skill.draft_email`/`reports.save_draft`: internal/no external effect;
   - `email.send`/`report.publish`: external and approval-sensitive.
7. Do not remove `WriteStep` until compatibility callers have migrated.

Exit gate:

- approval record exists and appears in tenant UI;
- sensitive tool is proven not called before approval;
- approval resumes the same run/step exactly once;
- rejection never executes the tool;
- stale/cross-tenant/self approvals are denied.

### Phase 8 — Compatibility adapters and caller migration

Goal: eliminate competing execution behavior without breaking routes.

#### 8.1 Legacy agent dispatch

- adapt `/agents/:id/dispatch` and `/agents/:id/task` to start the assigned
  Task through `AIEmployeeCore`;
- preserve `202 Accepted` initially;
- include canonical `workRunId`;
- remove fire-and-forget promise handling after a durable start is confirmed;
- adapt cancellation to cancel the Work Run.

#### 8.2 Agent Runtime routes and chat

- map static catalog roles/skills to the selected tenant Employee;
- route `/agents/:id/run`, `/agent-runtime/run`, and chat `/agent` through the
  core;
- allow a skill hint but never bypass the planner/tool authorization;
- preserve clarification as a valid paused/failed view where required;
- stop creating new AgentRun rows once all response compatibility is proven.

#### 8.3 Cognition and Autonomy

- replace `runtime.createRun()` calls with `core.start()`;
- pass `actorType` and trigger type explicitly;
- store returned run IDs;
- never swallow all scheduling failures: persist blocked outcome and reason;
- add tests proving runs do not remain dormant in `CREATED`.

#### 8.4 ExecutionAttempt

- retain the worker/attempt envelope for high-assurance Task policies;
- delegate actual business execution to the core;
- persist/link `workRunId`;
- do not report attempt completion unless the canonical run completed;
- remove synthetic `Draft execution for:` completion from active paths.

Exit gate:

- every active execution entry point reaches Work Runtime;
- compatibility response tests pass;
- no active route reaches synthetic local completion;
- no duplicate run is created during adapter retries.

### Phase 9 — Tenant frontend consolidation

Goal: show one truthful Employee activity model.

Tasks:

1. Add a typed `employee-runs.service.ts`.
2. Add an Employee Run/Activity tab to the existing Agent inspector.
3. Display:
   - objective;
   - current status;
   - step timeline;
   - approval link;
   - artifact/evidence links;
   - task links;
   - failure reason;
   - start/completion timestamps.
4. Update Task inspector to link the originating/current Work Run.
5. Reuse the existing execution detail components where contracts align;
   extract a shared timeline rather than duplicating UI.
6. Poll every 5–10 seconds while non-terminal; use sockets as acceleration.
7. Remove randomized orchestration metrics and show grounded aggregates or
   `Unknown`.
8. Complete approval rejection reason and review navigation for this path.

Exit gate:

- UI state matches persisted backend state after refresh;
- socket interruption does not break progress visibility;
- no fabricated activity/performance is displayed;
- accessibility and type checks pass for changed surfaces.

### Phase 10 — Activate one self-starting trigger

Goal: demonstrate basic autonomous operation only after manual execution is
reliable.

Tasks:

1. Implement one tenant-controlled project-health trigger.
2. Keep trigger configuration disabled by default.
3. Use a database lease and deterministic daily/window idempotency key.
4. Resolve the configured Employee.
5. Call `AIEmployeeCore.start()`; never call tools directly.
6. Reconcile non-terminal runs and surface blocked/approval states.
7. Provide `Run now` through the same trigger code path for demonstration.

Exit gate:

- timer starts work without chat/Execute;
- concurrent ticks create one run/effect;
- repeated tick shows deduplication;
- operator can see and control the run;
- failures are bounded and visible.

### Phase 11 — Retire redundant behavior

Goal: reduce ambiguity after all callers are proven migrated.

Tasks:

1. Mark legacy routes deprecated in API metadata and logs.
2. Remove `AgentExecutorService` from controller execution paths.
3. Remove synthetic local task completion.
4. Remove Agent Runtime `WriteStep` as an approval state machine.
5. Stop writing new AgentRun rows; retain historical reads as needed.
6. Remove duplicate planner/tool dispatch code only when no runtime caller
   remains.
7. Do not drop tables during this phase; schedule data cleanup separately.

Exit gate:

- static search finds no unintended legacy executor callers;
- full backend build/tests pass;
- tenant browser flow passes;
- production-like observation shows no fallback route usage.

## 8. Verification matrix

| Concern | Required proof |
|---|---|
| Tenant isolation | unit + PostgreSQL integration + foreign-ID API tests |
| Idempotency | concurrent start and repeated tool-effect tests |
| Planning safety | unauthorized/unknown tool rejection and valid fallback |
| Tool correctness | contract test for every registered core tool |
| Approval | before/after call spy, persisted approval, resume/reject tests |
| Evidence | artifact, checksum/reference, citations, final run linkage |
| Failure honesty | injected AI/tool/DB/socket failures never become success |
| Compatibility | old route response and canonical run linkage tests |
| Frontend | type check, unit tests, browser vertical slice |
| Migration | disposable DB forward migration and old/new binary compatibility |
| Performance | bounded context, run list pagination, indexed Employee queries |
| Observability | correlation across trigger, run, step, approval, task, artifact |

## 9. Required commands at phase gates

Use the repository's installed package manager and current scripts. At minimum:

```bash
cd neurecore/backend
pnpm prisma validate
pnpm exec tsc --noEmit
pnpm jest --config jest.config.js --runInBand \
  src/modules/ai-employee-core \
  src/modules/work-runtime \
  src/modules/agent-runtime \
  src/modules/approval-port
pnpm build

cd ../frontend-tenant
pnpm type-check
pnpm test
pnpm build
```

Because the current repository has known type-check drift, Phase 0 must first
establish and repair the relevant baseline. No new error introduced by this
implementation may be waived as “pre-existing.”

Before final cutover, additionally run:

- real PostgreSQL integration tests;
- tenant isolation scans;
- route duplication scan;
- focused approval and idempotency certification;
- the fresh-tenant browser vertical slice;
- the relevant existing certification suites after confirming they test real
  paths rather than simulations.

## 10. Error handling policy

Use typed domain/application errors:

```text
EMPLOYEE_NOT_FOUND
EMPLOYEE_NOT_AVAILABLE
EMPLOYEE_CONCURRENCY_EXCEEDED
CROSS_TENANT_ACCESS_DENIED
RUN_IDEMPOTENCY_CONFLICT
RUN_CONTEXT_UNAVAILABLE
PLAN_INVALID
TOOL_NOT_AUTHORIZED
TOOL_INPUT_INVALID
APPROVAL_REQUIRED
APPROVAL_REJECTED
APPROVAL_STALE
ARTIFACT_PERSIST_FAILED
TASK_ASSIGNMENT_INELIGIBLE
```

Rules:

- controllers map errors to stable HTTP responses;
- internal details are logged with correlation IDs, not exposed to clients;
- expected business failures are not logged as infrastructure crashes;
- infrastructure failures do not default to write permission;
- reads may degrade only when the result is explicitly marked unavailable;
- no catch block converts an unknown failure into success;
- retries apply only to classified transient failures and remain bounded.

## 11. Observability

Every run must correlate:

```text
tenantId
employeeId
workRunId
idempotencyKey (hashed/redacted in logs when appropriate)
triggerType/sourceId
taskId
stepId
toolName
approvalId
artifactId
correlationId/causationId
```

Minimum metrics:

- runs started/completed/failed/waiting by Employee and trigger type;
- planning duration/failure;
- step/tool duration and failure classification;
- approval wait and resume duration;
- duplicate start suppression;
- artifacts/tasks produced;
- stale non-terminal runs;
- compatibility route usage;
- cost/token usage through AI Gateway.

Do not log document bodies, prompts containing tenant secrets, raw tool inputs,
email content, tokens, or credentials.

## 12. Rollout and rollback

### Feature flags

Use tenant-scoped flags:

```text
ai_employee_core.enabled
ai_employee_core.skill_tools.enabled
ai_employee_core.task_assignment.enabled
ai_employee_core.approval_resume.enabled
ai_employee_core.legacy_adapter.enabled
ai_employee_core.autopilot.enabled
```

Flags select the entry path, not security behavior. Tenant isolation and
approval checks are never disabled by a flag.

### Rollout

1. local/disposable DB;
2. test tenant with manual runs;
3. one internal tenant with compatibility adapters;
4. one tenant with document-analysis vertical slice;
5. one tenant with approval step;
6. one tenant with self-starting trigger;
7. gradual opt-in expansion.

### Rollback

- disable the affected core feature flag;
- stop new starts while preserving existing rows;
- allow safe inspection/cancellation of existing Work Runs;
- revert code to the prior compatibility path only if it does not re-enable
  synthetic completion or unsafe approval bypass;
- retain additive schema fields;
- never delete runs/artifacts to perform rollback;
- reconcile partially completed steps using idempotency keys before retry.

## 13. Pull request/change-set structure

Recommended sequence:

1. contracts, architecture tests, baseline repairs;
2. additive Prisma migration and repository idempotency;
3. EmployeeResolver and core service;
4. read-only skill tools;
5. artifact persistence;
6. task eligibility/create/assign tools;
7. Approval Port request/resume;
8. legacy route adapters;
9. chat/cognition/autonomy migration;
10. ExecutionAttempt delegation;
11. tenant frontend run activity;
12. self-starting trigger;
13. legacy behavior retirement.

Each change set must include tests and must not mix unrelated refactoring.

## 14. Definition of done

Implementation is complete only when:

- every new AI Employee execution uses a tenant `Agent` UUID;
- Work Run is the canonical state machine;
- all active entry points delegate to `AIEmployeeCore`;
- a real document is analyzed through a registered skill tool;
- a report artifact with evidence is persisted;
- a task is created and assigned to a deterministically eligible Employee;
- retries and concurrent starts create no duplicate run, artifact, or task;
- sensitive external action creates a real approval request;
- approval/rejection is tenant-safe and cannot be performed by the AI itself;
- approval resumes the same step exactly once;
- no synthetic executor can mark unfinished work complete;
- frontend activity is grounded in canonical runs and survives refresh;
- backend and frontend type checks/builds pass;
- focused and integration tests pass;
- schema migration is verified on PostgreSQL;
- a fresh-tenant browser run proves the vertical slice;
- rollback and feature-flag controls are tested;
- no new high-severity security, tenant-isolation, or data-integrity defect is
  open.

## 15. Immediate first action

Do not begin by deleting code. Begin with Phase 0 and Phase 1:

1. repair/record the current validation baseline;
2. add architecture guards against new legacy execution callers;
3. introduce the narrow core contracts;
4. implement and test Employee resolution;
5. add Employee identity and idempotency to Work Run additively.

Only after those foundations are green should real execution callers be moved.
This sequence preserves existing capabilities while steadily replacing
competing runtimes with one reliable core.

