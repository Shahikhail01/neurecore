# NeureCore–Hermes Integration

## Comprehensive Phased Implementation Plan

**Document status:** Proposed for approval  
**Implementation strategy:** Bounded vertical-slice integration  
**Primary validation scenario:** SIM-04  
**Architecture standard:** SOLID, contract-first, zero functional duplication  
**Decision:** NeureCore is the enterprise control plane; upstream NousResearch Hermes Agent is a replaceable execution plane.

---

## 1. Executive decision

NeureCore will integrate the upstream `NousResearch/hermes-agent` runtime as an isolated Python service. NeureCore will continue to own tenants, identity, projects, goals, tasks, RBAC, approvals, audit, billing, notifications, business records, and user interfaces. Hermes will own planning, iterative execution, working context, skill selection, execution review, and subagent delegation.

The current internal “Hermes” implementation is not an upstream integration. It will be renamed to remove the brand collision and will receive no new orchestration capabilities. During the bounded experiment, the existing `OfficialAgentGraph` remains the supported execution path for simple chat and retrieval.

The integration will proceed only through SIM-04 until it passes the certification gates. Failure at the final gate triggers a documented tombstone: the renamed wrapper is removed from the chat call path, upstream integration is disabled, and `OfficialAgentGraph` remains the sole supported runtime.

---

## 2. Non-negotiable outcomes

The implementation is successful only when it delivers all of the following:

1. One complete SIM-04 workflow executes from a natural-language business request.
2. Hermes produces and follows a structured plan without receiving direct database access.
3. Every tool call is tenant-scoped, authorized, schema-validated, idempotent, observable, and auditable.
4. Regulated or high-impact actions pause reliably for human approval.
5. Execution resumes from the persisted checkpoint after approval or service restart.
6. No fabricated identifiers reach a domain command.
7. No duplicate customers, projects, goals, tasks, approvals, notifications, or external actions are created.
8. All 707 prompt templates remain unavailable as operational employees until individually certified.
9. The integration can be disabled instantly without interrupting the existing supported chat path.
10. Phase 3 failure leaves no abandoned runtime on the production call path.

---

## 3. Scope

### 3.1 In scope

- Rename the misleading internal Hermes classes, tables, flags, environment variables, metrics, documentation, and UI labels.
- Quarantine the 707 prompt-only agent templates.
- Deploy upstream Hermes as an isolated service.
- Build a NeureCore-owned runtime adapter and execution lifecycle.
- Build a secure, scoped tool gateway for SIM-04.
- Implement pause, approval, resume, cancel, timeout, retry, and recovery behavior.
- Implement SIM-04 as a single certified accounting workflow.
- Capture execution events, plans, steps, tool calls, approvals, results, errors, costs, and final evidence.
- Establish automated functional, security, resilience, and quality evaluation.
- Define migration, rollback, and failure tombstone procedures.

### 3.2 Explicitly out of scope

- Porting upstream Hermes into TypeScript.
- Allowing Hermes direct access to PostgreSQL, Redis, message brokers, internal service credentials, or unrestricted network egress.
- Replacing NeureCore’s domain backend.
- Activating the 707 prompt templates as operational agents.
- Exposing the existing 75–106 flat CRUD tools to Hermes.
- Building Finance, HR, Sales, Marketing, or other domain packs before SIM-04 certification.
- Replacing all simple chat and retrieval traffic with Hermes.
- Automatic promotion of unreviewed Hermes-generated skills into production.
- Open-ended reconstruction of `NeureCoreRuntimeService`.

---

## 4. Architecture principles

### 4.1 Single source of truth

Each business concept has exactly one authoritative owner:

| Concern | Authoritative owner |
|---|---|
| Tenant, user and membership | NeureCore Identity/RBAC |
| Customer and accounting record | NeureCore domain module |
| Project, goal, stage and task | NeureCore project modules |
| Approval policy and decision | NeureCore Approval module |
| Business audit record | NeureCore Audit module |
| Notifications | NeureCore Notification module |
| Billing and usage ledger | NeureCore Billing module |
| Agent plan and execution loop | Upstream Hermes |
| Working execution state | Hermes execution workspace |
| Durable execution checkpoint index | NeureCore Execution module |
| Approved reusable skills | Tenant-scoped Hermes skill store |
| UI-visible agent profile | NeureCore Agent Profile module |

No second table, service, cache, or event consumer may become an alternative source of truth for these concerns.

### 4.2 SOLID enforcement

#### Single Responsibility Principle

Every module has one reason to change:

- `ExecutionApplicationService`: execution use cases only.
- `HermesRuntimeAdapter`: translation to and from the upstream runtime only.
- `ToolGateway`: tool dispatch pipeline only.
- `AuthorizationPolicy`: permission decisions only.
- `ApprovalCoordinator`: approval lifecycle only.
- Domain command handlers: business mutation rules only.
- `ExecutionEventRecorder`: durable execution-event recording only.
- `RuntimeRoutingPolicy`: selects the execution runtime only.

No class may combine orchestration, persistence, authorization, domain mutation, and transport concerns.

#### Open/Closed Principle

New runtimes and domain tools are added through interfaces and registered implementations, without editing the core execution use cases. New tools must implement the common tool contract and pass the same policy pipeline.

#### Liskov Substitution Principle

Every runtime adapter must satisfy the same lifecycle semantics:

- start returns a durable execution identifier;
- pause produces a resumable checkpoint;
- resume is safe after process restart;
- cancel is idempotent;
- status is monotonic and contract-valid;
- events use the canonical schema;
- failures never masquerade as completion.

Contract tests will run against the Hermes adapter and a deterministic fake adapter.

#### Interface Segregation Principle

Avoid a single large runtime or tool interface. Use narrow interfaces:

```typescript
interface ExecutionStarter {
  start(command: StartExecutionCommand): Promise<ExecutionRef>;
}

interface ExecutionResumer {
  resume(command: ResumeExecutionCommand): Promise<void>;
}

interface ExecutionCanceller {
  cancel(command: CancelExecutionCommand): Promise<void>;
}

interface ExecutionStatusReader {
  getStatus(executionId: ExecutionId): Promise<ExecutionStatus>;
}

interface ApprovalDecisionSubmitter {
  submitDecision(command: ApprovalDecisionCommand): Promise<void>;
}
```

Tools will similarly separate read queries, domain commands, external effects, approval classification, and evidence projection.

#### Dependency Inversion Principle

Application services depend on ports, never on Hermes SDK classes, Prisma clients, HTTP clients, queues, or controllers. Infrastructure adapters implement those ports.

The domain dependency direction is:

```text
UI/Transport → Application → Domain
Infrastructure ────────────────┘
Hermes Adapter → Application ports
```

The domain layer must have no imports from NestJS, Prisma, HTTP, Socket.IO, BullMQ, Hermes, or model-provider packages.

---

## 5. Anti-duplication policy

“No duplication” means no duplicate responsibilities, execution paths, schemas, business rules, or sources of truth. It does not prohibit small, deliberate value objects that preserve module independence.

### 5.1 Mandatory rules

1. One canonical execution lifecycle and state machine.
2. One canonical tool envelope and one validation pipeline.
3. One authorization decision service for tool execution.
4. One approval policy engine and one approval record.
5. One domain command handler per business operation.
6. One idempotency strategy used by chat, API, retries, and runtime tools.
7. One event schema for audit, UI streaming, metrics, and evaluations.
8. One runtime-routing policy; controllers may not select runtimes.
9. One public agent catalog; shadow templates are excluded by policy, not filtered independently in multiple UIs.
10. One configuration source with schema validation.

### 5.2 Prohibited duplication

- Hermes writing business records while NeureCore writes equivalent records.
- REST controllers and agent tools implementing separate business rules.
- Separate approval logic in the UI, tool gateway, and domain handlers.
- Tool-specific authentication implementations.
- Multiple mappings for statuses or enums.
- A second chat history for Hermes.
- Copying tool descriptions or JSON schemas into prompts manually.
- Maintaining both legacy and new tools for the same operation on the active runtime path.
- Re-seeding catalog rows under new identifiers during deployments.
- Retrying mutations without the original idempotency key.

### 5.3 Enforcement mechanisms

- Architecture dependency tests.
- Unique database constraints and idempotency records.
- Generated schemas and clients from canonical contracts.
- Code-owner approval for new runtime, tool, approval, and agent-template modules.
- Static checks for forbidden imports and duplicate route/tool names.
- Contract registry that rejects duplicate operation identifiers.
- CI inventory comparing domain commands, exposed tools, and ownership declarations.
- Removal checklist for every replaced component.

---

## 6. Target logical architecture

### 6.1 Components

| Component | Responsibility | Must not do |
|---|---|---|
| Unified Chat UI | Capture request and display execution state | Select runtime or authorize tools |
| Runtime Routing Policy | Choose simple graph or Hermes | Execute work |
| Execution Application Service | Coordinate lifecycle use cases | Contain Hermes-specific logic |
| Hermes Runtime Adapter | Translate canonical commands/events | Apply business rules |
| Hermes Runtime Service | Plan, execute, review, delegate | Access NeureCore databases |
| Tool Gateway | Validate and dispatch scoped tools | Own domain records |
| Policy Enforcement Point | Authenticate and authorize every call | Trust prompt claims |
| Approval Coordinator | Pause, decide, resume and expire | Execute approved business action itself |
| Domain Command/Query Handlers | Enforce business invariants | Know about Hermes |
| Event Recorder | Persist canonical execution events | Interpret business policy |
| Audit Projection | Produce immutable audit view | Become execution state |
| Skill Promotion Service | Review and publish learned skills | Auto-promote untrusted content |

### 6.2 Runtime routing

The routing policy will use deterministic classification:

- Simple read, explanation, summarization, or single safe query → `OfficialAgentGraph`.
- Multi-step project work, cross-domain coordination, resumable work, or delegated execution → Hermes, only for enabled certified scenarios.
- Unsupported or uncertified work → explicit user-facing limitation; never silently route to an experimental implementation.

Feature flags are tenant-scoped and scenario-scoped:

- `agent_runtime.hermes.enabled`
- `agent_runtime.hermes.sim04.enabled`
- `agent_runtime.hermes.external_effects.enabled`
- `agent_runtime.hermes.skill_promotion.enabled`

The global kill switch overrides all tenant flags.

---

## 7. Canonical contracts

### 7.1 Execution states

```text
CREATED
QUEUED
RUNNING
WAITING_FOR_APPROVAL
WAITING_FOR_INPUT
COMPLETED
FAILED
CANCELLED
TIMED_OUT
```

Terminal states are `COMPLETED`, `FAILED`, `CANCELLED`, and `TIMED_OUT`. State transitions are validated centrally. No adapter or UI may invent additional lifecycle states.

### 7.2 Execution command envelope

Every command contains:

- `commandId`
- `executionId`
- `tenantId`
- `actorId`
- `projectId` when resolved
- `correlationId`
- `causationId`
- `idempotencyKey`
- `issuedAt`
- `schemaVersion`
- typed payload

Tenant and actor identity come from verified NeureCore authentication, never from model-generated arguments.

### 7.3 Canonical execution event

Events include:

- execution created, queued, started;
- plan proposed and plan revised;
- step started, completed, failed;
- tool requested, authorized, rejected, succeeded, failed;
- approval requested, granted, rejected, expired;
- execution paused, resumed, cancelled, timed out;
- evidence attached;
- execution completed or failed.

All downstream consumers use this event schema. UI events, audit projections, metrics, and test traces must not invent parallel payloads.

### 7.4 Tool contract

Every tool definition includes:

- globally unique operation ID;
- version;
- purpose and bounded description;
- sealed JSON input schema;
- sealed output schema;
- risk classification;
- required permissions;
- approval policy key;
- timeout and retry classification;
- idempotency behavior;
- maximum response size;
- evidence fields;
- data classification;
- owner module.

Unknown fields are rejected. Identifiers are resolved by trusted lookup tools or NeureCore context; fabricated identifiers are never accepted merely because they are syntactically valid UUIDs.

---

## 8. Security and isolation baseline

### 8.1 Network

- Default-deny egress for the Hermes process tree.
- Explicit allowlist for the scoped tool gateway, approved model provider endpoints, and required telemetry.
- Explicit deny rules for PostgreSQL, Redis, internal message brokers, metadata endpoints, and administrative networks.
- No inbound access except through the authenticated adapter/gateway channel.
- Network policy tests run in CI or a production-equivalent environment.

### 8.2 Identity and secrets

- Short-lived, execution-scoped tokens.
- Claims limited to tenant, execution, scenario, allowed operations, and expiry.
- No tenant credentials stored in prompts, skills, logs, or runtime files.
- Key rotation and immediate revocation.
- Secrets injected at runtime and excluded from crash dumps and telemetry.

### 8.3 Storage

Use three layers:

1. Immutable read-only Hermes runtime template.
2. Encrypted tenant-scoped persistent store for approved skills and approved durable memory.
3. Ephemeral per-execution workspace for working files, caches, temporary state, and sensitive intermediate output.

Cross-tenant mounts are prohibited. Durable memory promotion requires classification, policy checks, and audit.

### 8.4 Resource controls

- CPU, memory, storage, process, token, tool-call, wall-clock, and subagent limits.
- Maximum delegation depth and concurrency.
- Execution deadline and inactivity timeout.
- Circuit breaker for repeated tool or model failures.
- Immediate global and tenant-level kill switches.

---

## 9. Phased implementation

## Phase 0 — Governance, baseline and freeze

**Duration:** 2–3 working days  
**Objective:** Stop architectural drift and establish an evidence-based baseline.

### Deliverables

1. Approve this architecture decision and assign accountable owners.
2. Freeze new features in the current internal Hermes wrapper.
3. Capture the current SIM-04 dataset, prompts, steps, expected records, approvals, outputs, and failure evidence.
4. Record the existing chat/tool performance baseline.
5. Inventory:
   - all Hermes-named code and configuration;
   - all runtime and orchestration services;
   - all tools and duplicate operations;
   - all agent templates and visibility rules;
   - all approval entry points;
   - all execution and chat persistence tables.
6. Create an ownership matrix for every retained component.
7. Establish architectural dependency rules and CI checks.

### Exit criteria

- Architecture decision is approved.
- No unowned orchestration component remains in the inventory.
- SIM-04 baseline is reproducible.
- Freeze is enforced through code ownership and backlog controls.
- Every existing tool maps to one domain owner or is marked for retirement.

---

## Phase 1 — Rename and catalog quarantine

**Duration:** 2–4 working days  
**Objective:** Remove the brand collision without changing supported behavior.

### Rename plan

- `HermesRuntimeService` → `NeureCoreRuntimeService`
- `HermesAgent` → `AgentProfile`
- `HermesMemoryEntry` → `AgentMemoryEntry`
- `HERMES_*` internal variables → `NEURECORE_RUNTIME_*`
- Internal metrics, queues, events, API paths, documentation, feature flags, and UI strings updated consistently.

Use compatibility migrations only at external boundaries. Do not maintain two active internal names.

### Template quarantine

- Add explicit lifecycle: `SHADOW`, `CERTIFICATION`, `ACTIVE`, `RETIRED`.
- Migrate all 707 templates to `SHADOW`.
- Exclude `SHADOW` templates from public employee selection, sales demos, tenant provisioning, and runtime routing.
- Retain content for later certification; do not present it as executable capability.
- Require an operational manifest before activation:
  - certified runtime;
  - allowed toolset;
  - required permissions;
  - approval policy;
  - evaluation suite;
  - owner;
  - version.

### Tests

- Schema migration and rollback tests.
- API compatibility tests.
- UI catalog visibility tests.
- Search and tenant provisioning tests.
- Static scan proving misleading runtime identifiers are removed except migration aliases and historical documentation.

### Exit criteria

- Existing supported chat behavior is unchanged.
- No public UI shows shadow templates as operational employees.
- No active internal runtime class or environment variable uses the ambiguous Hermes name.
- Migrations are reversible and production rehearsal succeeds.

---

## Phase 2 — Canonical execution core

**Duration:** 1 week  
**Objective:** Build runtime-independent lifecycle contracts before integrating upstream Hermes.

### Deliverables

- Execution aggregate and canonical state machine.
- Narrow application ports for start, pause, resume, cancel, status, events, approvals, and checkpoints.
- Deterministic fake runtime adapter.
- Runtime routing policy.
- Canonical execution event recorder.
- Idempotency service and database constraints.
- Execution query projection for UI and operations.
- Kill-switch service.

### Design rules

- No Hermes SDK imports outside the future infrastructure adapter.
- No Prisma access from domain objects.
- No runtime selection in controllers.
- No approval policy embedded in prompts.
- No business mutation in event consumers.

### Required tests

- State-transition property tests.
- Contract tests against the fake adapter.
- Idempotent start, resume, cancel, and event ingestion.
- Duplicate-event handling.
- Out-of-order event handling.
- Crash/restart recovery.
- Tenant isolation.
- Architecture dependency tests.

### Exit criteria

- The fake adapter passes the complete runtime contract suite.
- Duplicate commands and events create no duplicate effects.
- Invalid lifecycle transitions are rejected consistently.
- UI can render lifecycle state from the canonical projection without runtime-specific fields.

---

## Phase 3 — Upstream Hermes isolation and adapter spike

**Duration:** 1–2 weeks  
**Objective:** Prove the bridge and lifecycle plumbing using stub tools only.

### Deliverables

- Version-pinned upstream Hermes runtime image.
- Software bill of materials and dependency/security scan.
- Isolated runtime deployment manifest.
- `HermesRuntimeAdapter` implementing canonical ports.
- Authenticated event stream or callback channel.
- Stub toolset with deterministic safe operations.
- Checkpoint and restart recovery.
- Kill-switch and resource enforcement.
- Structured logs, metrics, traces, and audit projection.

### Mandatory demonstration

The following sequence must work end-to-end:

1. `startExecution`
2. Hermes produces a plan.
3. Hermes invokes a safe stub tool.
4. Hermes requests a gated stub action.
5. NeureCore records an approval and moves to `WAITING_FOR_APPROVAL`.
6. The Hermes process is restarted.
7. A human submits an approval decision.
8. `resumeExecution` restores the correct checkpoint.
9. Hermes completes the approved stub action exactly once.
10. Execution reaches `COMPLETED`.
11. The audit projection contains the full ordered evidence chain.

### Failure cases to prove

- Approval rejected.
- Approval expires.
- Duplicate approval submission.
- Duplicate resume.
- Invalid/expired execution token.
- Tool timeout.
- Model timeout.
- Runtime crash before and after tool completion.
- Event delivery duplication and reordering.
- Kill switch during active execution.
- Attempted network connection to prohibited resources.
- Cross-tenant workspace access.

### Hard exit gate

Phase 4 cannot begin until the complete start–pause–approve–restart–resume–complete lifecycle passes with stub tools, audit events, idempotency, isolation, and recovery. No real domain API may be connected before this gate.

---

## Phase 4 — Secure SIM-04 tool gateway

**Duration:** 1–1.5 weeks  
**Objective:** Build the product-grade capability boundary between Hermes and NeureCore.

### Initial toolset

Expose only the minimum operations required by SIM-04, expected to be 8–12 tools:

- resolve customer;
- create customer;
- read customer onboarding requirements;
- create project from certified workflow;
- read project execution context;
- create or update a bounded task batch;
- attach evidence;
- request approval;
- prepare review package;
- send approved notification;
- read execution status;
- report completion.

Exact operations must follow the domain APIs already present. Where an existing API is inadequate, improve the domain command once; do not implement special business rules inside the tool.

### Common gateway pipeline

Every invocation passes through the same ordered pipeline:

1. Authenticate execution token.
2. Establish tenant and actor context.
3. Match operation against execution allowlist.
4. Validate sealed input schema.
5. Resolve references using trusted context.
6. Authorize through NeureCore RBAC.
7. Evaluate approval policy.
8. Enforce idempotency.
9. Dispatch to the canonical domain command/query handler.
10. Normalize errors and redact sensitive data.
11. Truncate or paginate output.
12. Attach evidence metadata.
13. Record audit and execution events.
14. Return the sealed response envelope.

### Error taxonomy

- `VALIDATION_REJECTED`
- `REFERENCE_NOT_FOUND`
- `AUTHENTICATION_FAILED`
- `AUTHORIZATION_DENIED`
- `APPROVAL_REQUIRED`
- `APPROVAL_REJECTED`
- `CONFLICT`
- `RATE_LIMITED`
- `DEPENDENCY_UNAVAILABLE`
- `TIMEOUT`
- `DOMAIN_RULE_VIOLATION`
- `INTERNAL_ERROR`

Raw stack traces and database errors never reach the model. Retryability is an explicit response field, not inferred from message text.

### Anti-duplication requirements

- Tool schemas generated from or checked against canonical DTO schemas.
- Tools call existing application commands/queries, never Prisma.
- One operation identifier per domain capability.
- No aliases with overlapping descriptions.
- Batch tools replace repeated item-level CRUD calls when atomicity permits.
- Existing flat tools for the same operations are removed from the Hermes exposure registry.

### Exit criteria

- All exposed tools pass contract, authorization, idempotency, tenancy, error, and response-size tests.
- Invalid and fabricated IDs cannot mutate state.
- No tool bypasses the approval policy engine.
- Retried mutations create exactly one business effect.
- The gateway can revoke an execution immediately.

---

## Phase 5 — SIM-04 project-execution vertical slice

**Duration:** 2–3 weeks  
**Objective:** Deliver one complete, demonstrably agentic business workflow.

### Canonical user request

> Onboard Acme Corp, prepare its Q3 return workflow, and notify me when it is ready for review.

### Expected flow

1. Interpret goal and confirm missing mandatory information.
2. Resolve the real customer or create it idempotently.
3. Generate a structured execution plan linked to the project.
4. Create the project from a versioned certified workflow definition.
5. Create goals, stages, and task batch through canonical domain commands.
6. Execute permitted preparation work.
7. Collect and attach evidence to the correct tasks.
8. Pause before regulated, irreversible, or external actions.
9. Render an in-conversation approval card.
10. Resume from the saved checkpoint after an authorized decision.
11. Prepare the review package.
12. Send a notification only after the applicable approval.
13. Complete tasks based on verified evidence, not model assertion.
14. Produce a final summary with completed actions, pending items, approvals, evidence, and exceptions.

### Approval card

The card must display:

- requested action;
- business object and tenant;
- reason and expected effect;
- evidence and relevant inputs;
- risk classification;
- requesting agent/execution;
- expiry;
- approve and reject actions;
- optional reviewer comment.

The UI does not decide whether approval is required. It renders the canonical approval record and submits a decision to the Approval module.

### Completion definition

Hermes cannot mark an execution or task complete directly. It submits evidence and a completion proposal. NeureCore validates required outcomes and transitions authoritative business records.

### Exit criteria

- The complete workflow runs in a test tenant.
- Every created record is tenant-correct and linked to the same project.
- Approval pause/resume works through the real UI.
- Notification is sent exactly once and only when authorized.
- All claimed completions have evidence.
- Final output reconciles with authoritative NeureCore records.

---

## Phase 6 — Evaluation, hardening and certification

**Duration:** 1–2 weeks  
**Objective:** Prove reliability and safety before any production expansion.

### Golden evaluation set

At least 20 scenarios covering:

- complete customer information;
- missing information;
- existing customer;
- duplicate-looking customer;
- invalid quarter/status;
- insufficient actor permission;
- approval granted;
- approval rejected;
- approval timeout;
- cancellation;
- model/tool timeout;
- runtime restart;
- duplicate events;
- stale project context;
- conflicting business state;
- tool dependency outage;
- malicious prompt content in customer data;
- attempted unauthorized operation;
- response truncation;
- concurrent execution against the same customer.

### Certification metrics

| Metric | Release threshold |
|---|---:|
| End-to-end successful completion | ≥ 90% |
| Fabricated IDs reaching domain mutation | 0 |
| Unauthorized tool execution | 0 |
| Mandatory approval bypass | 0 |
| Successful resume after valid approval | 100% |
| Duplicate business records/effects | 0 |
| Complete execution audit chain | 100% |
| Cross-tenant access | 0 |
| Unsupported completion claims | 0 |
| Kill-switch enforcement | 100% |

### Quality metrics

- Plan correctness.
- Tool-selection accuracy.
- Error-recovery success.
- Human intervention rate.
- Average tool calls per successful run.
- Approval latency.
- Execution duration.
- Token and infrastructure cost.
- Evidence completeness.
- Determinism of business outcomes.

### Release decision

Certification requires joint sign-off from:

- Product owner;
- architecture owner;
- domain owner;
- security owner;
- QA/evaluation owner;
- operations owner.

Averages cannot hide safety failures. Any unauthorized execution, approval bypass, cross-tenant access, or duplicate external effect is an automatic failure.

---

## Phase 7 — Controlled pilot

**Duration:** 1–2 weeks  
**Objective:** Validate production behavior with minimal blast radius.

### Rollout

1. Internal tenant only.
2. Read-only and reversible tools first.
3. External effects disabled initially.
4. Enable approvals.
5. Enable one approved external notification operation.
6. Expand to a small named tenant cohort only after stable observation.

### Operational requirements

- On-call ownership and escalation path.
- Live execution dashboard.
- Runtime health, queue depth, stuck execution, approval age, failure rate, token cost, and tool latency alerts.
- One-click tenant and global kill switches.
- Runbooks for pause, cancel, checkpoint recovery, token revocation, corrupted workspace, and upstream regression.
- Version rollback rehearsal.

### Exit criteria

- No critical or high-severity safety incident.
- Production metrics remain within certification thresholds.
- Operators can diagnose and terminate an execution without database intervention.
- Upstream version rollback succeeds in rehearsal.

---

## Phase 8 — Expansion by certified domain pack

**Start condition:** SIM-04 production pilot passes.  
**Objective:** Expand without recreating the flat-tool failure.

Each new domain pack must contain:

- bounded business capability;
- explicit owner;
- versioned workflow definition;
- minimal non-overlapping toolset;
- permissions and approval matrix;
- canonical context projection;
- golden evaluation scenarios;
- risk assessment;
- operational runbook;
- activation manifest for eligible agent profiles.

### Certification sequence

1. Select one workflow, not an entire department.
2. Reuse canonical execution and gateway pipelines.
3. Add only missing domain operations.
4. Prove no overlap with existing operations.
5. Run contract and architecture tests.
6. Run workflow golden evaluations.
7. Pilot behind scenario and tenant flags.
8. Activate only the agent profiles certified for that pack.

No agent profile becomes `ACTIVE` merely because its system prompt exists.

---

## Phase 9 — Legacy retirement and consolidation

**Objective:** Remove superseded code after verified traffic migration.

### Candidates

- Renamed `NeureCoreRuntimeService` wrapper.
- Duplicate Hermes nodes and registries.
- Retired state-machine types.
- Flat tools replaced by gateway operations.
- Duplicate chat history or execution persistence.
- UI panels superseded by unified execution views.
- Dead feature flags, queues, metrics, environment variables, and documentation.

### Removal process

1. Prove zero production traffic.
2. Identify all imports, runtime registrations, flags, queues, tables, and dashboards.
3. Remove call path and dependency injection registration.
4. Run complete regression and migration checks.
5. Remove data structures only after retention/export decision.
6. Update architecture inventory and ownership matrix.
7. Record deletion in an architectural tombstone.

### Rule

Deprecated components receive no feature additions. A proposed exception requires a new architecture decision with cost, duration, and deletion impact.

---

## 10. Data and idempotency design

### 10.1 Core records

Prefer extending existing records where ownership already exists. Add only execution-specific records that have no current authoritative equivalent:

- `AgentExecution`
- `AgentExecutionCheckpoint`
- `AgentExecutionEvent`
- `AgentToolInvocation`
- `AgentExecutionEvidence`

Approvals, projects, tasks, customers, notifications, and agent profiles remain in their existing authoritative modules.

### 10.2 Uniqueness

Representative constraints:

- unique execution request by `(tenantId, idempotencyKey)`;
- unique tool effect by `(tenantId, executionId, operationId, idempotencyKey)`;
- unique event by `(executionId, eventId)`;
- unique approval decision per approval record;
- unique notification effect by business-purpose idempotency key;
- workflow-specific customer identity constraints.

### 10.3 Transactions

- Domain mutation and outbox event commit atomically.
- External effects use an outbox/worker and durable idempotency record.
- Execution events do not claim success before domain commit.
- Retries reuse the original idempotency key.

---

## 11. Testing strategy

### 11.1 Test pyramid

- Domain unit tests for invariants and state transitions.
- Application tests with fake ports.
- Contract tests for every runtime adapter and tool.
- Integration tests for persistence, queues, policy, and gateway.
- End-to-end tests for approval UI and SIM-04.
- Security tests for tenancy, token scope, egress, secrets, and injection.
- Resilience tests for crashes, delays, duplication, reordering, and dependency outages.
- Golden agent evaluations for behavioral quality.

### 11.2 Required CI gates

- Formatting, linting, type checking.
- Unit and integration suites.
- Architecture dependency rules.
- Duplicate operation/schema scan.
- Database migration validation.
- Contract compatibility.
- Security and dependency scan.
- Container and infrastructure policy validation.
- Golden evaluation smoke subset.
- Full nightly golden evaluation suite.

### 11.3 No mock-only certification

Mocks validate application logic but cannot certify the integration. Release certification must use:

- real upstream Hermes version;
- production-equivalent isolation;
- real NeureCore gateway;
- real policy and approval modules;
- seeded test tenants;
- controlled model access;
- observable audit records.

---

## 12. Observability

### 12.1 Correlation

Every log, event, trace, tool call, approval, task mutation, and notification must carry:

- `tenantId`
- `executionId`
- `correlationId`
- `causationId`
- `operationId` where applicable

Sensitive prompt or customer content must not become a default metric or log label.

### 12.2 Dashboards

- Executions by state and age.
- Success/failure by scenario and runtime version.
- Tool calls by outcome and latency.
- Approval requests by age and outcome.
- Retry and idempotency conflicts.
- Runtime crashes and checkpoint recovery.
- Token/cost consumption.
- Policy denials and kill-switch events.
- Cross-tenant and prohibited-network attempts.

### 12.3 Trace retention

Preserve model inputs/outputs only according to data-classification and tenant policy. Always retain structured decisions and evidence sufficient for audit without unnecessarily retaining sensitive free text.

---

## 13. Team responsibilities

| Role | Primary accountability |
|---|---|
| Architecture lead | Boundaries, contracts, SOLID and duplication controls |
| NeureCore backend lead | Execution core, gateway and domain integration |
| Hermes integration lead | Upstream deployment and adapter |
| Security lead | Isolation, tokens, secrets, network and threat testing |
| Frontend lead | Execution timeline and approval card |
| Domain lead | SIM-04 rules, evidence and completion criteria |
| QA/evaluation lead | Golden set, regression and certification |
| Platform/SRE lead | Deployment, observability, kill switch and recovery |
| Product owner | Scope control and release decision |

No phase is self-approved by its implementer.

---

## 14. Definition of done

A phase is done only when:

- code and configuration are complete;
- tests pass;
- security controls are verified;
- observability is present;
- documentation and runbooks are updated;
- ownership is assigned;
- deprecated code introduced by the phase is removed;
- exit criteria are demonstrated with retained evidence;
- the next phase does not inherit an undocumented workaround.

“Implemented,” “wired,” or “test passed once” is not sufficient.

---

## 15. Rollback and failure destination

### 15.1 Immediate rollback

1. Activate global Hermes kill switch.
2. Stop new upstream executions.
3. Cancel or quarantine active executions according to risk.
4. Revoke execution tokens.
5. Preserve audit evidence and checkpoints.
6. Route supported simple chat to `OfficialAgentGraph`.
7. Disable scenario and external-effect flags.

### 15.2 Phase 6 certification failure

If the evaluation gates fail within the approved experiment window:

- upstream Hermes is removed from the supported production path;
- `NeureCoreRuntimeService` is formally deprecated and removed from chat routing;
- `OfficialAgentGraph` becomes the only supported execution path;
- all experimental UI entry points and feature flags are disabled;
- execution data is retained or archived according to policy;
- no additional runtime reconstruction begins without a new architecture decision;
- the postmortem identifies whether NeureCore remains a workflow platform, adopts another runtime, or narrows its AI-employee claims.

This is a tombstone, not a soft landing.

---

## 16. Indicative schedule

| Phase | Duration | Cumulative estimate |
|---|---:|---:|
| 0. Governance and baseline | 2–3 days | Week 1 |
| 1. Rename and quarantine | 2–4 days | Week 2 |
| 2. Canonical execution core | 1 week | Week 3 |
| 3. Hermes adapter spike | 1–2 weeks | Weeks 4–5 |
| 4. Secure tool gateway | 1–1.5 weeks | Weeks 6–7 |
| 5. SIM-04 vertical slice | 2–3 weeks | Weeks 8–10 |
| 6. Evaluation and hardening | 1–2 weeks | Weeks 11–12 |
| 7. Controlled pilot | 1–2 weeks | Weeks 13–14 |

The estimate assumes a focused cross-functional team and no concurrent expansion into other domain packs. Passing a gate early does not authorize skipping the next gate.

---

## 17. Approval checklist

Approve implementation only if leadership accepts:

- the upstream Hermes runtime is experimental until certified;
- the current internal Hermes wrapper will not be enhanced;
- the 707 templates will be quarantined;
- SIM-04 is the only initial business workflow;
- the tool gateway is a first-class product component;
- direct database access from Hermes is prohibited;
- network and storage isolation are enforced technically;
- safety failures override average success metrics;
- unsuccessful certification triggers the defined tombstone;
- no new orchestration system may be introduced during the experiment.

---

## 18. Final recommendation

Approve Phases 0–3 as the initial funded checkpoint. Release funding for Phases 4–7 only after the stub-tool lifecycle gate passes.

This plan preserves NeureCore’s valuable enterprise platform, obtains upstream Hermes capabilities through a controlled boundary, prevents another duplicate orchestration stack, and makes continued investment conditional on measurable business execution. The objective is not to demonstrate that an agent can call tools. It is to prove that NeureCore can safely complete one real business workflow, recover from failure, involve a human at the correct moment, and leave an authoritative evidence trail.
