# NeureCore Autonomous Work Layer — Implementation & Refactor Plan

**Document ID:** NC-AWL-IMP-1
**Roadmap Reference:** NC-AWL-R1 v1.1
**Version:** 1.1 — Technical Correction
**Date:** 2026-07-26
**Status:** DRAFT — Execute Phase 0 Only; Later Phases Require Gate Approval
**Scope:** Bounded reconstruction of the autonomous work layer following the golden-path-first principle
**Total Duration:** 17–21 weeks

---

## Document Purpose

This document provides the systematic, phase-by-phase implementation and refactor plan for the NeureCore Autonomous Work Layer Reconstruction. It translates the strategic roadmap (NC-AWL-R1) into actionable technical deliverables with:

- **Enforceable architecture boundaries:** Dependency and mutation rules are checked in CI
- **Single authoritative mutation ownership:** Business state changes have one named command owner
- **Measurable reliability:** Idempotency, tenant isolation, recovery, and evidence are verified at phase gates

> Code blocks in this document are contract sketches, not copy-paste-ready implementation. Phase 0 must verify the deployed repository structure, module names, existing schemas, and runtime paths before final file paths or classes are approved.

---

## 1. Architectural Foundation

### 1.1 SOLID Compliance Strategy

| Principle | Application Strategy |
|-----------|---------------------|
| **S**ingle Responsibility | Each class/service has one reason to change; boundaries align with bounded contexts |
| **O**pen/Closed | Extensions via composition/DI, never modification of sealed contracts |
| **L**iskov Substitution | All implementations are swappable via interfaces; behavioral contracts are explicit |
| **I**nterface Segregation | Thin, focused interfaces per consumer; no fat contracts |
| **D**ependency Inversion | All high-level policies depend on abstractions; modules declare dependencies via DI |

### 1.2 Golden Path Invariants

For every implementation decision, verify:

1. Exactly one authoritative source for each mutation
2. Tenant identity validated at every hop
3. Idempotency guaranteed for every mutation
4. Failure is always visible and recoverable
5. Backend state is the single source of truth

### 1.3 Command Mutation Path (Canonical)

```
UI/Hermes/System Trigger
        ↓
Application Command
        ↓
Policy and Authorization
        ↓
Domain Service
        ↓
Database Transaction + Outbox
        ↓
Durable Worker
        ↓
Projection/Audit/Notification
```

**Rule:** No component may skip levels or implement parallel mutation paths.

### 1.4 Phase Authorization

- This document authorizes Phase 0 discovery and reversible tracing only.
- G0 approves the recovery branch and verified repository paths.
- Each later phase requires its preceding gate evidence and a phase-start approval.
- File paths and class names shown below become binding only after they are reconciled with the deployed repository.
- A phase is complete only when its runtime gate passes; elapsed time or merged code is not completion.
- Necessary-but-not-sufficient refactors require architecture-owner approval, characterization tests, and a named golden-path dependency.

---

## 2. Phase 0: Freeze, Baseline, and Runtime Forensics

**Duration:** 1.5–2 weeks
**Objective:** Establish the actual deployed execution path; stop architectural drift

### 2.1 Feature Freeze Declaration

Implement immediately:

```markdown
## Frozen Scope (until G0 passes)

### Prohibited
- Additional industries or sub-industries
- New AI employee templates unrelated to golden path
- New dashboards, navigation areas, or workspace variants
- Additional autonomy modes
- Multi-agent collaboration beyond golden path requirements
- Cosmetic redesign unrelated to usability blockers
- Broad marketplace expansion
- New orchestration frameworks
- New infrastructure products without approved architectural need
- Unrelated refactors that do not enable, protect, or reduce risk in the golden path

### Preserved (Safe)
- Authentication, authorization, tenant isolation
- Customers, departments, projects, industry configuration
- Existing frontend shell and workspace patterns
- Prisma/PostgreSQL persistence where validated
- AI employee templates and deployment concepts
- Approval, audit, observability, policy concepts
- LangGraph where it serves governed orchestration
- Existing in-process and database-polling mechanisms (temporary)
```

### 2.2 Runtime Forensics Inventory

#### 2.2.1 Mutation Entry Point Inventory

Do not create a manually maintained source registry during forensics. Generate an evidence artifact from reproducible searches and AST analysis:

`docs/reconstruction/phase-0/mutation-entry-points.csv`

Required columns:

```text
id, category, module, file, symbol, line, aggregateTypes,
tenantScoped, idempotent, mutationOwner, bypassesCommand,
runtimeReachability, deployedEvidence, disposition
```

Inventory sources:

- Controller mutation handlers
- Hermes and agent tool registrations and implementations
- Prisma mutation calls and repository adapters
- Event handlers, timers, cron jobs, database pollers, and queue processors
- LangGraph nodes capable of requesting business mutations
- Socket handlers and administrative operations

The discovery command/script and its version must be retained so CI can later detect new entry points.

#### 2.2.2 Direct Prisma Bypass Register

Generate:

`docs/reconstruction/phase-0/direct-prisma-bypasses.csv`

Classify each mutation as:

- Approved persistence adapter
- Test/fixture/seed
- Emergency operator command
- Legacy business bypass
- Golden-path blocker
- False positive

No bypass becomes “allowed” merely because it appears in the register. Any temporary exception requires an owner, justification, tenant/aggregate scope, compensating controls, expiry date, and removal issue.

### 2.3 Golden Path Runtime Trace

#### 2.3.1 Correlation ID Infrastructure

Phase 0 should first use existing trace facilities. Add minimal reversible instrumentation only when the current stack cannot correlate one request. The production design is approved in Phase 1 and must use:

- `AsyncLocalStorage` for HTTP and socket request context
- `crypto.randomUUID()`, UUIDv7, or ULID for identifiers
- Tenant and actor derived from authenticated server context
- Explicit serialized metadata on commands, events, jobs, graph runs, and tool calls
- A fresh worker context reconstructed from persisted event/job metadata
- No static or global mutable tenant state

Canonical metadata contract:

```typescript
export interface CommandMetadata {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  occurredAt: string;
  schemaVersion: number;
}
```

Ambient context is a convenience for logging and inbound adapters; commands and repositories must still receive explicit tenant-scoped identifiers.

### 2.4 Worker/Queue/Scheduler Inventory

Generate `docs/reconstruction/phase-0/worker-runtime-inventory.csv` from source and runtime inspection. Include timers, DB pollers, cron jobs, BullMQ if present, webhooks, graph entry points, lease behavior, retry behavior, horizontal-scaling behavior, shutdown handling, and deployed reachability.

### 2.5 Queue Durability Decision

**Decision Required at G0:**

| Option | When to Choose | Implementation |
|--------|---------------|----------------|
| **PostgreSQL-backed outbox + leased worker** | Minimizing infrastructure; acceptable queue throughput | See Phase 3 |
| **PostgreSQL outbox + Redis/BullMQ** | Operational requirements justify separate queue | See Phase 3 |

**Rule:** No phase may use assumed queue capability as evidence that work is durable.

### 2.6 Test Infrastructure Design

**File:** `src/test/test-harness.module.ts`

```typescript
// Deterministic test tenant provisioning
export interface TestTenant {
  id: string;
  name: string;
  industry: string;
  tier: string;
  reset(): Promise<void>;
}

// Synthetic data fixtures for golden scenario
export interface GoldenScenarioData {
  customer: { name: string; industry: string };
  project: { name: string; goal: string; task: string };
  aiEmployee: { role: string; capabilities: string[] };
}
```

Phase 0 designs and estimates—not postpones—the parallel certification workstream:

- Deterministic reconstruction tenant provisioning/reset
- Synthetic accounting data and attachments
- Unique run IDs and record labeling
- Safe cleanup without touching unrelated tenant data
- Correlation capture across frontend, backend, events, workers, graphs, and tools
- Machine-readable results and evidence index
- Failure-injection seams for duplicate submission, worker termination, provider failure, session expiry, and realtime loss

Implementation begins in Phase 1 and grows with each phase. Phase 9 only executes the completed certification harness.

### 2.7 Phase 0 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Deployed-system manifest | Platform/Operations | SHA verification |
| Current-state runtime sequence diagram | Architecture | Code trace evidence |
| Mutation-entry-point inventory | Backend Lead | Reproducible search |
| Worker/queue/runtime inventory | Backend Lead | Live inspection |
| Direct-Prisma bypass register | Backend Lead | Source audit |
| Confirmed root-cause report | Architecture | Gate approval |
| Frozen-scope register | Product Owner | Documented |
| Baseline golden-path test report | QA Lead | 1 clean run minimum |
| Queue/polling durability assessment | Architecture | Decision recorded |
| CI/CD and enforcement-gap assessment | Platform/Operations | Gap list |
| Feature-flag capability assessment | Backend Lead | Test proof |
| Test-infrastructure design | QA Lead | Backlog created |

### 2.8 Gate G0 Criteria

**All must pass before proceeding to Phase 1:**

- [ ] Every golden-path hop is classified: implemented | partial | absent | bypassed | unverified
- [ ] Hermes failure is localized to specific runtime boundary
- [ ] Team knows whether execution worker exists and how triggered
- [ ] Tool-bypass count is exact and reproducible
- [ ] No critical decision rests solely on code comment or browser symptom
- [ ] Program has selected (or has evidence-backed plan for) PostgreSQL workers vs Redis/BullMQ
- [ ] Test infrastructure, tenant-scoped flags, CI enforcement estimated as first-class work

**Escalation if G0 cannot produce trustworthy map:**

| Finding | Decision |
|---------|----------|
| Autonomous layer structurally recoverable | Proceed with reconstruction |
| Platform sound but orchestration/integration broken | Proceed with integration focus |
| Core boundaries, state ownership, tenant/security fundamentally compromised | Scoped replace-vs-rebuild decision |
| Deployed system cannot be reconciled with source | Pause until integrity restored |

---

## 3. Phase 1: Contracts, States, and Architectural Enforcement

**Duration:** 1.5 weeks
**Objective:** Establish one enforceable application boundary before repairing individual features

### 3.1 Canonical State Machines

#### 3.1.1 Enterprise Initiation States

**File:** `src/modules/enterprise-initiation/domain/initiation-states.ts`

```typescript
export enum InitiationStatus {
  DRAFT = 'DRAFT',
  DISCOVERING = 'DISCOVERING',
  READY_FOR_CONFIRMATION = 'READY_FOR_CONFIRMATION',
  APPROVED = 'APPROVED',
  MATERIALIZING = 'MATERIALIZING',
  COMPLETED = 'COMPLETED',
  // Exceptional
  NEEDS_INPUT = 'NEEDS_INPUT',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
  CANCELLED = 'CANCELLED',
}

export const INITIATION_TRANSITIONS: Record<InitiationStatus, InitiationStatus[]> = {
  [InitiationStatus.DRAFT]: [InitiationStatus.DISCOVERING],
  [InitiationStatus.DISCOVERING]: [InitiationStatus.READY_FOR_CONFIRMATION, InitiationStatus.NEEDS_INPUT],
  [InitiationStatus.READY_FOR_CONFIRMATION]: [InitiationStatus.APPROVED, InitiationStatus.DISCOVERING, InitiationStatus.CANCELLED],
  [InitiationStatus.APPROVED]: [InitiationStatus.MATERIALIZING],
  [InitiationStatus.MATERIALIZING]: [InitiationStatus.COMPLETED, InitiationStatus.FAILED_RETRYABLE],
  [InitiationStatus.COMPLETED]: [],
  [InitiationStatus.NEEDS_INPUT]: [InitiationStatus.DISCOVERING],
  [InitiationStatus.FAILED_RETRYABLE]: [InitiationStatus.MATERIALIZING, InitiationStatus.FAILED_FINAL],
  [InitiationStatus.FAILED_FINAL]: [InitiationStatus.CANCELLED],
  [InitiationStatus.CANCELLED]: [],
};
```

#### 3.1.2 Project Automation States

**File:** `src/modules/project-automation/domain/automation-states.ts`

```typescript
export enum ProjectAutomationStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
}

export const AUTOMATION_TRANSITIONS: Record<ProjectAutomationStatus, ProjectAutomationStatus[]> = {
  [ProjectAutomationStatus.NOT_REQUESTED]: [ProjectAutomationStatus.REQUESTED],
  [ProjectAutomationStatus.REQUESTED]: [ProjectAutomationStatus.PROCESSING],
  [ProjectAutomationStatus.PROCESSING]: [ProjectAutomationStatus.COMPLETED, ProjectAutomationStatus.PARTIAL, ProjectAutomationStatus.FAILED_RETRYABLE],
  [ProjectAutomationStatus.COMPLETED]: [],
  [ProjectAutomationStatus.PARTIAL]: [ProjectAutomationStatus.PROCESSING],
  [ProjectAutomationStatus.FAILED_RETRYABLE]: [ProjectAutomationStatus.PROCESSING, ProjectAutomationStatus.FAILED_FINAL],
  [ProjectAutomationStatus.FAILED_FINAL]: [],
};
```

#### 3.1.3 Task States

**File:** `src/modules/tasks/domain/task-states.ts`

```typescript
export enum TaskStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  ASSIGNED = 'ASSIGNED',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  NEEDS_INPUT = 'NEEDS_INPUT',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
  CANCELLED = 'CANCELLED',
}

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.DRAFT]: [TaskStatus.READY],
  [TaskStatus.READY]: [TaskStatus.ASSIGNED, TaskStatus.BLOCKED, TaskStatus.CANCELLED],
  [TaskStatus.ASSIGNED]: [TaskStatus.QUEUED, TaskStatus.READY],
  [TaskStatus.QUEUED]: [TaskStatus.IN_PROGRESS, TaskStatus.READY],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.NEEDS_INPUT, TaskStatus.NEEDS_REVIEW, TaskStatus.BLOCKED, TaskStatus.FAILED_RETRYABLE],
  [TaskStatus.NEEDS_INPUT]: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
  [TaskStatus.NEEDS_REVIEW]: [TaskStatus.APPROVED, TaskStatus.QUEUED, TaskStatus.CANCELLED],
  [TaskStatus.APPROVED]: [TaskStatus.COMPLETED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.BLOCKED]: [TaskStatus.READY],
  [TaskStatus.FAILED_RETRYABLE]: [TaskStatus.QUEUED, TaskStatus.FAILED_FINAL, TaskStatus.CANCELLED],
  [TaskStatus.FAILED_FINAL]: [],
  [TaskStatus.CANCELLED]: [],
};
```

Transition arrays are not sufficient authorization. Each transition must also define its command, authorized actor types/roles, guard conditions, emitted event, audit payload, idempotency key, and concurrency/version check. Project commercial lifecycle remains separate from task/execution state.

#### 3.1.4 Execution Attempt States

**File:** `src/modules/execution/domain/attempt-states.ts`

```typescript
export enum ExecutionAttemptStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  WAITING_FOR_TOOL = 'WAITING_FOR_TOOL',
  PRODUCING_EVIDENCE = 'PRODUCING_EVIDENCE',
  SUBMITTED_FOR_REVIEW = 'SUBMITTED_FOR_REVIEW',
  PAUSED = 'PAUSED',
  NEEDS_INPUT = 'NEEDS_INPUT',
  TIMED_OUT = 'TIMED_OUT',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
  CANCELLED = 'CANCELLED',
}

export const ATTEMPT_TRANSITIONS: Record<ExecutionAttemptStatus, ExecutionAttemptStatus[]> = {
  [ExecutionAttemptStatus.CREATED]: [ExecutionAttemptStatus.QUEUED],
  [ExecutionAttemptStatus.QUEUED]: [ExecutionAttemptStatus.RUNNING],
  [ExecutionAttemptStatus.RUNNING]: [
    ExecutionAttemptStatus.WAITING_FOR_TOOL,
    ExecutionAttemptStatus.PRODUCING_EVIDENCE,
    ExecutionAttemptStatus.PAUSED,
    ExecutionAttemptStatus.NEEDS_INPUT,
    ExecutionAttemptStatus.TIMED_OUT,
    ExecutionAttemptStatus.FAILED_RETRYABLE,
  ],
  [ExecutionAttemptStatus.WAITING_FOR_TOOL]: [ExecutionAttemptStatus.RUNNING, ExecutionAttemptStatus.FAILED_RETRYABLE],
  [ExecutionAttemptStatus.PRODUCING_EVIDENCE]: [ExecutionAttemptStatus.SUBMITTED_FOR_REVIEW, ExecutionAttemptStatus.FAILED_RETRYABLE],
  [ExecutionAttemptStatus.SUBMITTED_FOR_REVIEW]: [],
  [ExecutionAttemptStatus.PAUSED]: [ExecutionAttemptStatus.RUNNING, ExecutionAttemptStatus.CANCELLED],
  [ExecutionAttemptStatus.NEEDS_INPUT]: [ExecutionAttemptStatus.RUNNING],
  [ExecutionAttemptStatus.TIMED_OUT]: [ExecutionAttemptStatus.FAILED_RETRYABLE],
  [ExecutionAttemptStatus.FAILED_RETRYABLE]: [ExecutionAttemptStatus.QUEUED, ExecutionAttemptStatus.FAILED_FINAL],
  [ExecutionAttemptStatus.FAILED_FINAL]: [],
  [ExecutionAttemptStatus.CANCELLED]: [],
};
```

#### 3.1.5 Review Decision States

**File:** `src/modules/reviews/domain/review-states.ts`

```typescript
export enum ReviewDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
```

### 3.2 Command Catalog

#### 3.2.1 Command Interface (ISP)

**File:** `src/common/commands/command.interface.ts`

```typescript
import { CommandMetadata } from '../../correlation/correlation.service';

export interface ICommand<TRESULT = void, TERROR = void> {
  readonly commandType: string;
  readonly version: string;
  execute(metadata: CommandMetadata): Promise<CommandResult<TRESULT, TERROR>>;
}

export interface CommandResult<TRESULT, TERROR> {
  success: boolean;
  data?: TRESULT;
  error?: TERROR;
  correlationId: string;
  occurredAt: Date;
}
```

#### 3.2.2 Typed Commands

**File:** `src/modules/enterprise-initiation/commands/index.ts`

```typescript
// All commands for enterprise initiation
export * from './approve-initiation.command';
export * from './create-project-from-initiation.command';
export * from './request-automation.command';
```

**File:** `src/modules/enterprise-initiation/commands/approve-initiation.command.ts`

```typescript
import { ICommand, CommandResult } from '../../../../common/commands/command.interface';
import { CommandMetadata } from '../../../../common/correlation/correlation.service';
import { InitiationStatus } from '../domain/initiation-states';

export const APPROVE_INITIATION_COMMAND = 'ApproveEnterpriseInitiationCommand';

export interface ApproveInitiationInput {
  initiationId: string;
  approvedByActorId: string;
  approvalComment?: string;
}

export interface ApproveInitiationResult {
  initiationId: string;
  previousStatus: InitiationStatus;
  newStatus: InitiationStatus;
  automationRequested: boolean;
}

export class ApproveEnterpriseInitiationCommand implements ICommand<ApproveInitiationResult> {
  readonly commandType = APPROVE_INITIATION_COMMAND;
  readonly version = '1.0';

  constructor(private readonly input: ApproveInitiationInput) {}

  async execute(metadata: CommandMetadata): Promise<CommandResult<ApproveInitiationResult>> {
    // Implementation in command handler
  }
}
```

**File:** `src/modules/enterprise-initiation/commands/create-project-from-initiation.command.ts`

```typescript
export const CREATE_PROJECT_FROM_INITIATION_COMMAND = 'CreateProjectFromInitiationCommand';

export interface CreateProjectFromInitiationInput {
  initiationId: string;
  projectName: string;
  projectDescription?: string;
  customerId?: string;
  targetDate?: Date;
  automationConfig?: {
    generateGoals: boolean;
    generateTasks: boolean;
    autoAssign: boolean;
  };
}

export interface CreateProjectFromInitiationResult {
  projectId: string;
  initiationId: string;
  automationStatus: string;
  correlationId: string;
}

export class CreateProjectFromInitiationCommand implements ICommand<CreateProjectFromInitiationResult> {
  readonly commandType = CREATE_PROJECT_FROM_INITIATION_COMMAND;
  readonly version = '1.0';

  constructor(private readonly input: CreateProjectFromInitiationInput) {}

  async execute(metadata: CommandMetadata): Promise<CommandResult<CreateProjectFromInitiationResult>> {
    // Implementation in command handler
  }
}
```

**File:** `src/modules/project-automation/commands/request-automation.command.ts`

```typescript
export const REQUEST_PROJECT_AUTOMATION_COMMAND = 'RequestProjectAutomationCommand';

export interface RequestProjectAutomationInput {
  projectId: string;
  requestedByActorId: string;
}

export interface RequestProjectAutomationResult {
  automationRequestId: string;
  projectId: string;
  status: string;
}

export class RequestProjectAutomationCommand implements ICommand<RequestProjectAutomationResult> {
  readonly commandType = REQUEST_PROJECT_AUTOMATION_COMMAND;
  readonly version = '1.0';

  constructor(private readonly input: RequestProjectAutomationInput) {}

  async execute(metadata: CommandMetadata): Promise<CommandResult<RequestProjectAutomationResult>> {
    // Implementation in command handler
  }
}
```

**File:** `src/modules/tasks/commands/index.ts`

```typescript
export * from './create-goal.command';
export * from './create-task.command';
export * from './assign-task.command';
export * from './request-task-execution.command';
export * from './submit-task-for-review.command';
export * from './approve-task.command';
export * from './request-task-revision.command';
export * from './advance-project-stage.command';
```

### 3.3 Idempotency Matrix

**File:** `src/common/idempotency/idempotency-matrix.ts`

```typescript
export interface IdempotencySpec {
  aggregateType: string;
  operation: string;
  uniquenessConstraint: string; // e.g., "initiationId + commandType"
  replayBehavior: 'RETURN_CACHE' | 'REPLAY' | 'REJECT';
}

export const IDEMPOTENCY_MATRIX: IdempotencySpec[] = [
  {
    aggregateType: 'EnterpriseInitiation',
    operation: 'ApproveEnterpriseInitiation',
    uniquenessConstraint: 'initiationId',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Project',
    operation: 'CreateProjectFromInitiation',
    uniquenessConstraint: 'initiationId + commandType',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'ProjectAutomation',
    operation: 'RequestAutomation',
    uniquenessConstraint: 'projectId + commandType',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Goal',
    operation: 'CreateGoal',
    uniquenessConstraint: 'tenantId + projectId + automationVersion + templateGoalKey',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Task',
    operation: 'CreateTask',
    uniquenessConstraint: 'tenantId + projectId + automationVersion + templateTaskKey',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'TaskAssignment',
    operation: 'AssignTask',
    uniquenessConstraint: 'tenantId + taskId + assignmentGeneration',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'ExecutionAttempt',
    operation: 'RequestExecution',
    uniquenessConstraint: 'tenantId + taskId + executionRequestId',
    replayBehavior: 'RETURN_CACHE',
  },
];
```

Every matrix entry must be backed by a database uniqueness constraint and a durable stored result/reference. Business names are never idempotency keys. Durable business idempotency records do not expire through a short TTL. Attempt numbers are allocated transactionally and are descriptive, not the concurrency boundary.

### 3.4 Architecture Dependency Rules

**File:** `src/common/enterprise/architecture-rules.ts`

```typescript
// Architectural rules enforced by ESLint plugin and CI

export const ARCHITECTURE_RULES = {
  layers: ['domain', 'application', 'adapters', 'composition'],

  // Domain is independent. Application depends on domain and owns ports.
  // Adapters implement ports. Composition wires implementations.
  allowedDependencyPaths: [
    ['application', 'domain'],
    ['adapters', 'application'],
    ['adapters', 'domain'],
    ['composition', 'adapters'],
    ['composition', 'application'],
    ['composition', 'domain'],
  ],
};
```

Enforcement must be AST/import based, not class-name regex matching:

- Restrict Prisma imports to approved persistence-adapter directories.
- Use `no-restricted-imports` plus Dependency Cruiser, Nx boundaries, or an equivalent architecture test.
- Generate a dependency graph in CI.
- Fail CI on adapter-to-adapter business dependencies, domain framework imports, tool/controller persistence imports, or undeclared module cycles.
- Prove enforcement with negative fixture tests.
- Local hooks are advisory; protected-branch CI is authoritative.

The architecture owner may approve a necessary-but-not-sufficient refactor—such as breaking circular NestJS modules—when it names the golden-path blocker, includes characterization tests, avoids unrelated cleanup, and records the decision.

### 3.5 Tenant-Scoped Feature Flags

**File:** `src/modules/tenant-flags/tenant-flags.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { TenantFlagsService } from './tenant-flags.service';
import { TenantFlagsController } from './tenant-flags.controller';

@Global
@Module({
  controllers: [TenantFlagsController],
  providers: [TenantFlagsService],
  exports: [TenantFlagsService],
})
export class TenantFlagsModule {}
```

**File:** `src/modules/tenant-flags/tenant-flags.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

export enum FeatureFlag {
  CANONICAL_INITIATION = 'CANONICAL_INITIATION',
  DURABLE_AUTOMATION = 'DURABLE_AUTOMATION',
  AUTO_ASSIGNMENT = 'AUTO_ASSIGNMENT',
  AUTONOMOUS_EXECUTION = 'AUTONOMOUS_EXECUTION',
  HUMAN_REVIEW_WORKFLOW = 'HUMAN_REVIEW_WORKFLOW',
  NEW_LIFECYCLE_GUARDS = 'NEW_LIFECYCLE_GUARDS',
  NEW_TIMELINE = 'NEW_TIMELINE',
}

export interface FlagConfig {
  key: FeatureFlag;
  defaultValue: boolean;
  tenantOverride?: boolean;
  globalDefault: boolean;
  killSwitch: boolean; // Emergency disable
}

@Injectable()
export class TenantFlagsService {
  private readonly flags: Record<FeatureFlag, FlagConfig> = {
    [FeatureFlag.CANONICAL_INITIATION]: {
      key: FeatureFlag.CANONICAL_INITIATION,
      defaultValue: false,
      tenantOverride: true,
      globalDefault: false,
      killSwitch: false,
    },
    // ... other flags
  };

  async isEnabled(flag: FeatureFlag, tenantId: string): Promise<boolean> {
    // Check kill switch first
    if (this.flags[flag].killSwitch) return false;

    // Check tenant override
    const override = await this.getTenantOverride(flag, tenantId);
    if (override !== null) return override;

    // Return global default
    return this.flags[flag].globalDefault;
  }

  private async getTenantOverride(flag: FeatureFlag, tenantId: string): Promise<boolean | null> {
    // Implementation looks up TenantFeatureFlagOverride table
  }
}
```

The object above illustrates evaluation order only; it is not the persistence design. Phase 1 must implement:

- Persistent global defaults and tenant overrides
- Unique `(tenantId, flagKey)` constraints
- Administrative authorization and audit history
- Optimistic concurrency/versioning for changes
- Multi-instance cache invalidation or bounded no-cache reads
- Emergency kill-switch ownership and runbook
- Evaluation telemetry without high-cardinality labels
- Safe default behavior when the flag store is unavailable
- Server-side evaluation for all security or mutation decisions

Client-visible flags are presentation hints only and cannot authorize backend behavior.

### 3.6 ADR Set

**File:** `src/docs/adrs/ADR-001-command-boundary.md`

```markdown
# ADR-001: Command Boundary

## Status: Accepted

## Context
Business mutations must have a single authoritative entry point to ensure:
- Idempotency is guaranteed
- Tenant isolation is enforced
- Audit trail is complete
- Failure is recoverable

## Decision
All business mutations MUST go through typed Application Commands:
1. UI/Tools/System triggers invoke Command
2. Command validates input and authorization
3. Command calls Domain Service
4. Domain Service performs mutation within transaction
5. Transactional Outbox event is emitted

## Consequences
- Tools must be rewritten to call Commands, not Prisma directly
- Direct Prisma mutations become prohibited (except for seeds/fixtures)
```

### 3.7 Phase 1 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Command and event catalog | Backend Lead | Typed, versioned, tested |
| State-transition specification | Architecture | Guards implemented |
| Error-code catalog | Backend Lead | No error code reuse |
| Idempotency matrix | Backend Lead | Tests prove idempotency |
| Architecture dependency rules | Architecture | ESLint + CI enforced |
| CI enforcement configuration | Platform/Operations | CI rejects violations |
| Tenant-scoped feature-flag foundation | Backend Lead | Isolation tested |
| Initial automated test-tenant harness | QA Lead | Deterministic reset |
| ADR set (12 ADRs) | Architecture | Documented |
| Migration impact assessment | Backend Lead | No breaking changes |

### 3.8 Gate G1 Criteria

**All must pass before proceeding to Phase 2:**

- [ ] Tools can no longer introduce new direct Prisma business mutations
- [ ] Every golden-path mutation has one named command owner
- [ ] Every state has a single authoritative writer
- [ ] Duplicate delivery and retry semantics are defined before queue work begins
- [ ] CI rejects prohibited tool-layer mutations
- [ ] Tenant-scoped flags can isolate canonical path from legacy behavior
- [ ] Test harness can provision or reset at least one deterministic reconstruction tenant

---

## 4. Phase 2: Secure Initiation and Project Creation

**Duration:** 2 weeks
**Objective:** Make conversational initiation create exactly one recoverable project through canonical command path

### 4.1 Hermes Tool Registration Fix

**File:** `src/modules/hermes/tools/tool-registry.ts`

```typescript
// Verify and correct Hermes tool registration for runtime type
export interface ToolRegistration {
  name: string;
  description: string;
  schema: object;
  handler: string; // Reference to command handler
  requiredPermissions: string[];
  hermesTypes: string[]; // Which Hermes types can use this tool
}

// Ensure CREATE_PROJECT is registered for the actual runtime Hermes type
export const HERMES_TOOL_SETS: Record<string, ToolRegistration[]> = {
  // This must be verified against actual deployed Hermes type
};
```

### 4.2 Enterprise Initiation Module

**File:** `src/modules/enterprise-initiation/enterprise-initiation.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EnterpriseInitiationController } from './enterprise-initiation.controller';
import { EnterpriseInitiationService } from './enterprise-initiation.service';
import { InitiationStateMachine } from './domain/initiation-state-machine';
import { InitiationQueryRepository } from './repositories/initiation-query.repository';

export const CommandHandlers = [];
export const EventHandlers = [];

@Module({
  imports: [CqrsModule],
  controllers: [EnterpriseInitiationController],
  providers: [
    EnterpriseInitiationService,
    InitiationStateMachine,
    InitiationQueryRepository,
    ...CommandHandlers,
    ...EventHandlers,
  ],
  exports: [EnterpriseInitiationService],
})
export class EnterpriseInitiationModule {}
```

**File:** `src/modules/enterprise-initiation/enterprise-initiation.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TenantFlagsService, FeatureFlag } from '../../tenant-flags/tenant-flags.service';
import { ApproveEnterpriseInitiationCommand } from './commands/approve-initiation.command';
import { CreateProjectFromInitiationCommand } from './commands/create-project-from-initiation.command';
import { CommandMetadata } from '../../../common/correlation/correlation.service';

@Injectable()
export class EnterpriseInitiationService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantFlags: TenantFlagsService,
  ) {}

  async approveInitiation(input: ApproveInitiationInput, metadata: CommandMetadata): Promise<InitiationResult> {
    // Check canonical flag
    const isCanonical = await this.tenantFlags.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );

    if (!isCanonical) {
      throw new Error('CANONICAL_INITIATION flag must be enabled for golden path');
    }

    // Execute via command bus (single authoritative path)
    const result = await this.commandBus.execute(
      new ApproveEnterpriseInitiationCommand(input),
      metadata,
    );

    return result;
  }
}
```

### 4.3 Transactional Project Creation

**File:** `src/modules/projects/application/project-domain.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { IProjectRepository } from '../repositories/project.repository.interface';
import { IInitiationRepository } from '../../enterprise-initiation/repositories/initiation.repository.interface';
import { IOutboxRepository } from '../../../common/outbox/outbox.repository.interface';
import { ProjectAutomationStatus } from '../../project-automation/domain/automation-states';

@Injectable()
export class ProjectDomainService {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly initiationRepo: IInitiationRepository,
    private readonly outbox: IOutboxRepository,
  ) {}

  async createFromApprovedInitiation(
    initiationId: string,
    metadata: CommandMetadata,
  ): Promise<{ projectId: string; automationRequestId: string }> {
    // All reads and writes that establish this invariant occur in one transaction.
    const result = await this.outbox.executeInTransaction(async (tx) => {
      const initiation = await this.initiationRepo.findApprovedForUpdate(
        metadata.tenantId,
        initiationId,
        tx,
      );
      if (!initiation) {
        throw new DomainError('INITIATION_NOT_APPROVED_OR_NOT_FOUND');
      }

      // Database uniqueness on (tenantId, initiationId) is the concurrency boundary.
      const existing = await this.projectRepo.findResultByInitiation(
        metadata.tenantId,
        initiationId,
        tx,
      );
      if (existing) return existing;

      const project = await this.projectRepo.createCanonical({
        tenantId: metadata.tenantId,
        name: initiation.projectName,
        description: initiation.projectDescription,
        customerId: initiation.customerId,
        targetDate: initiation.targetDate,
        initiationId: initiation.id,
        automationStatus: ProjectAutomationStatus.REQUESTED,
        executionEngineVersion: 'canonical-v1',
        createdByActorId: metadata.actorId,
      }, tx);

      await this.initiationRepo.markMaterializing(
        metadata.tenantId,
        initiationId,
        project.id,
        tx,
      );

      const outboxEvent = await this.outbox.create({
        tenantId: metadata.tenantId,
        eventType: 'ProjectAutomationRequested',
        aggregateType: 'Project',
        aggregateId: project.id,
        payload: {
          projectId: project.id,
          initiationId: initiation.id,
          requestedBy: metadata.actorId,
        },
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        idempotencyKey: `automation.requested.${project.id}`,
        schemaVersion: 1,
        availableAt: new Date(),
      }, tx);

      await this.auditRepo.record({
        tenantId: metadata.tenantId,
        action: 'PROJECT_CREATED_FROM_INITIATION',
        aggregateId: project.id,
        actorId: metadata.actorId,
        correlationId: metadata.correlationId,
      }, tx);

      return {
        projectId: project.id,
        automationRequestId: outboxEvent.id,
      };
    });

    return result;
  }
}
```

Phase 2 therefore includes the minimum outbox persistence foundation: schema/migration, repository, atomic transaction API, uniqueness constraints, event insertion, and operation-status query. Phase 3 adds polling/publication, leasing, workers, retry, dead-letter handling, and operations. G2 cannot pass using an outbox interface whose persistence is deferred.

### 4.4 Transitional Degradation Contract

**File:** `src/modules/enterprise-initiation/legacy-isolation.ts`

```typescript
// Legacy route isolation
export interface LegacyIsolationConfig {
  tenantId: string;
  mutationType: 'initiation' | 'project_creation';
  route: 'legacy' | 'canonical';
}

export const LEGACY_ISOLATION_RULES = {
  // Resolution requires tenant flag + mutation type + persisted aggregate owner.
  // Project age or the existence of any old project is never sufficient.
  resolveRoute: (
    tenantFlag: 'legacy' | 'canonical',
    mutationType: string,
    aggregateEngine?: 'legacy' | 'canonical-v1',
  ): 'legacy' | 'canonical' => {
    if (aggregateEngine === 'canonical-v1' && tenantFlag !== 'canonical') {
      throw new Error('CANONICAL_AGGREGATE_ROUTE_DISABLED');
    }
    if (aggregateEngine === 'legacy' && tenantFlag === 'canonical') {
      throw new Error('LEGACY_AGGREGATE_REQUIRES_MIGRATION');
    }
    return aggregateEngine === 'canonical-v1' || tenantFlag === 'canonical'
      ? 'canonical'
      : 'legacy';
  },
};
```

Degradation contract:

- Canonical operations fail visibly and retryably; they never fall back automatically to legacy writes.
- Legacy routes remain only for explicitly flagged legacy aggregates/tenants.
- Canonical and legacy paths share database uniqueness constraints where they could otherwise duplicate a business entity.
- Engine switches require a preflighted migration command, audit record, and rollback plan.
- Telemetry identifies the selected engine for every mutation.

### 4.5 Frontend Initiation UI

**File:** `frontend-tenant/src/components/initiation/InitiationComposer.tsx`

```typescript
// New initiation composer component
export interface InitiationComposerProps {
  onSubmit: (input: InitiationInput) => Promise<void>;
  onCancel: () => void;
}

// Shows structured discovery draft
// Clear Approve, Revise, Cancel buttons
// Disable repeat approval while pending
// Recover authoritative result after refresh
```

### 4.6 Phase 2 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Hermes tool registration verified | Backend Lead | Runtime trace |
| Discovery/draft separation | Frontend Lead | UI tested |
| Explicit confirmation before project creation | Backend Lead | UX tested |
| Canonical command routing | Backend Lead | Single path verified |
| Transaction atomicity (project + outbox) | Backend Lead | Rollback tested |
| Idempotency implementation | Backend Lead | Duplicate test |
| Legacy route isolation | Backend Lead | Flag isolation tested |
| Frontend state recovery | Frontend Lead | Refresh test |

### 4.7 Gate G2 Criteria

**Across at least 20 controlled repetitions:**

- [ ] One approval creates exactly one project
- [ ] Zero duplicate projects
- [ ] No tool performs a direct business mutation
- [ ] Project and outbox event commit together
- [ ] Refresh/relogin resolves to correct result
- [ ] Failure never returns misleading success
- [ ] Canonical and legacy routes cannot both process same initiation

---

## 5. Phase 3: Transactional Outbox and Durable Automation

**Duration:** 2 weeks
**Objective:** Reliably convert created project into goals, tasks, and initial assignment requests

### 5.1 Outbox Infrastructure

**File:** `src/common/outbox/outbox.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxWorker } from './outbox.worker';

@Global
@Module({
  providers: [OutboxService, OutboxRepository, OutboxWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
```

**File:** `src/common/outbox/outbox.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

export interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DEAD_LETTER';
  attemptCount: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  processedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  createdAt: Date;
}

@Injectable()
export class OutboxService {
  async publish(event: Omit<OutboxEvent, 'id' | 'status' | 'attemptCount' | 'lockedAt' | 'lockedBy' | 'processedAt' | 'lastErrorCode' | 'lastErrorSummary' | 'createdAt'>): Promise<string> {
    // Atomic create-or-return under unique (tenantId, scope, idempotencyKey).
    return this.repo.createOrGetId(event);
  }

  async executeInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // Wraps operations in Prisma transaction + outbox event creation
  }
}
```

**File:** `src/common/outbox/outbox.worker.ts`

```typescript
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly PROCESS_INTERVAL_MS = 1000;
  private readonly MAX_ATTEMPTS = 3;
  private readonly LEASE_TIMEOUT_MS = 30000;

  async processPending(): Promise<void> {
    // 1. Claim events using lease (prevents duplicate processing)
    const events = await this.outboxRepo.claimAvailable({
      maxCount: 10,
      leaseTimeoutMs: this.LEASE_TIMEOUT_MS,
      workerId: this.workerId,
    });

    // 2. Process each event idempotently
    for (const event of events) {
      try {
        await this.processEvent(event);
        await this.outboxRepo.markCompleted(event.id);
      } catch (error) {
        await this.handleFailure(event, error);
      }
    }
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    // Route to appropriate handler based on eventType
    const handler = this.handlers.get(event.eventType);
    if (!handler) {
      throw new Error(`No handler for event type: ${event.eventType}`);
    }
    await handler(event);
  }
}
```

Before implementation, specify and test:

- How polling starts, prevents overlapping loops, and stops gracefully
- Transaction-safe claim semantics using row locks or expiring leases
- Lease renewal and stale-lease recovery
- Multi-replica behavior
- Exponential backoff with jitter
- Retry classification and maximum attempts
- Dead-letter transition and controlled replay
- Event schema-version compatibility
- Poison-event isolation
- Transaction boundary between handler effects and processed-event records
- Deployment/readiness behavior when the worker is unavailable

In-process timers may wake a PostgreSQL worker but are not the durability boundary.

### 5.2 Project Automation Worker

**File:** `src/modules/project-automation/project-automation.worker.ts`

```typescript
@Injectable()
export class ProjectAutomationWorker {
  async handleProjectAutomationRequested(event: OutboxEvent): Promise<void> {
    const { projectId } = event.payload;

    // Each step is idempotent
    await this.materializeGoals(projectId, event);
    await this.materializeTasks(projectId, event);
    await this.createRoleRequirements(projectId, event);
    await this.createAssignmentRequests(projectId, event);

    await this.updateAutomationStatus(projectId, ProjectAutomationStatus.COMPLETED);
  }

  private async materializeGoals(projectId: string, event: OutboxEvent): Promise<void> {
    const goals = await this.goalFactory.createFromProject(projectId);
    for (const goal of goals) {
      // Unique: tenantId + projectId + automationVersion + templateGoalKey.
      await this.goalRepo.upsertCanonical(goal);
    }

    await this.emitAuditEvent('GoalsCreated', { projectId, count: goals.length }, event);
  }

  private async materializeTasks(projectId: string, event: OutboxEvent): Promise<void> {
    // Similar idempotent pattern
  }

  private async createRoleRequirements(projectId: string, event: OutboxEvent): Promise<void> {
    // Create role requirement records for assignment
  }

  private async createAssignmentRequests(projectId: string, event: OutboxEvent): Promise<void> {
    // Emit TaskAssignmentRequested events
  }
}
```

Every generated goal, task, role requirement, and assignment request must have a deterministic source key and database uniqueness constraint. Never treat “at least one record exists” as proof that a partially completed collection is complete. A retry reconciles each required item individually. Events are serialized data and never carry a live transaction object.

### 5.3 Idempotency Implementation

Durable idempotency is enforced through aggregate uniqueness constraints plus a database-backed command/event processing record:

```text
tenantId, scope, idempotencyKey, requestHash, status,
resultType, resultId, correlationId, createdAt, completedAt
```

Requirements:

- Atomically reserve the key with the associated mutation.
- Reject reuse with a different request hash.
- Return the persisted authoritative result on a matching replay.
- Do not rely on check-then-insert application logic.
- Do not expire keys protecting durable business mutations.
- Redis, if selected, may optimize coordination but is not the durable idempotency source of truth.

### 5.4 Failure Visibility

**File:** `src/modules/project-automation/automation-status.service.ts`

```typescript
export interface AutomationStatus {
  projectId: string;
  status: ProjectAutomationStatus;
  lastProcessedAt: Date | null;
  lastError: string | null;
  retryScheduledAt: Date | null;
  progress: {
    goalsCreated: number;
    tasksCreated: number;
    assignmentsCreated: number;
  };
}

@Injectable()
export class AutomationStatusService {
  async getStatus(projectId: string, tenantId: string): Promise<AutomationStatus> {
    // Returns current automation status for UI display
  }
}
```

### 5.5 Phase 3 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Transactional outbox implementation | Backend Lead | Transaction test |
| Outbox publisher with retry/backoff | Backend Lead | Failure injection |
| Stable event IDs as job IDs | Backend Lead | Trace verified |
| ProjectAutomationWorker implementation | Backend Lead | Integration test |
| Idempotent automation steps | Backend Lead | Duplicate delivery test |
| Automation progress tracking | Backend Lead | UI verified |
| Dead-letter visibility | Backend Lead | Manual test |
| Worker crash recovery | Backend Lead | Restart test |

### 5.6 Gate G3 Criteria

- [ ] Project automation survives worker restart
- [ ] Duplicate delivery produces no duplicate goals, tasks, roles, or assignments
- [ ] Every failure is visible and retryable or terminal with reason
- [ ] Project never silently remains half-initialized
- [ ] Replaying completed event has no additional business effect
- [ ] Canonical automation does not depend on legacy fallback
- [ ] Legacy fallback may be disabled for reconstruction tenant

---

## 6. Phase 4: Task-to-AI Assignment

**Duration:** 1.5 weeks
**Objective:** Assign eligible AI employee through explicit, explainable, overridable logic

### 6.1 Agent Capability Metadata

**File:** `src/modules/agents/domain/agent-capability.ts`

```typescript
export interface AgentCapability {
  agentId: string;
  tenantId: string;
  role: string;
  specializations: string[];
  permissions: string[];
  maxConcurrency: number;
  currentWorkload: number;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ARCHIVED';
  dataClassification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}
```

### 6.2 Assignment Service

**File:** `src/modules/assignments/assignment.service.ts`

```typescript
export interface AssignmentInput {
  tenantId: string;
  taskId: string;
  requiredRole: string;
  requiredCapabilities: string[];
  departmentConstraints?: string[];
  dataClassification?: string;
}

export interface AssignmentDecision {
  agentId: string;
  rationale: string;
  eligibilityScore: number;
  alternatives: Array<{ agentId: string; score: number }>;
}

@Injectable()
export class AssignmentService {
  async findEligibleAgents(input: AssignmentInput): Promise<Agent[]> {
    // Deterministic eligibility filtering
    return this.agentRepo.findEligible({
      tenantId: input.tenantId,
      role: input.requiredRole,
      capabilities: input.requiredCapabilities,
      departmentId: input.departmentConstraints,
      availability: 'AVAILABLE',
      archived: false,
    });
  }

  async assign(input: AssignmentInput, metadata: CommandMetadata): Promise<AssignmentDecision> {
    // 1. Filter to eligible
    const eligible = await this.findEligibleAgents(input);

    if (eligible.length === 0) {
      throw new DomainError('NO_ELIGIBLE_AI_EMPLOYEE');
    }

    // 2. Score and rank using a versioned deterministic scoring policy
    const scored = await this.scoreAgents(eligible, input);

    // 3. Command revalidates eligibility and reserves capacity transactionally.
    const decision = await this.commandBus.execute(
      new AssignTaskCommand({
        taskId: input.taskId,
        agentId: scored[0].agentId,
        rationale: this.buildRationale(scored[0]),
      }),
      metadata,
    );

    return decision;
  }

  private async scoreAgents(agents: Agent[], input: AssignmentInput): Promise<ScoredAgent[]> {
    // Scoring: weighted combination of:
    // - Capability match (40%)
    // - Current workload (30%)
    // - Department alignment (20%)
    // - Historical performance (10%)
  }
}
```

The assignment command—not the search result—owns correctness. Within one transaction it must revalidate tenant, capability, availability, data classification, concurrency, and current assignment generation; reserve capacity; persist the decision and rationale; transition the task; and emit `TaskAssigned`. Use optimistic concurrency or row locking to prevent two workers from consuming the same capacity. Define ties, no-match, assignment expiry, release, reassignment, and active-execution behavior.

### 6.3 Agent Picker UI

**File:** `frontend-tenant/src/components/assignments/AgentPicker.tsx`

```typescript
export interface AgentPickerProps {
  taskId: string;
  requiredRole: string;
  requiredCapabilities: string[];
  onAssign: (agentId: string) => Promise<void>;
  onCancel: () => void;
}

// Shows searchable list with:
// - Name, role, capabilities
// - Availability status
// - Current workload
// - Department
// Manual override option for authorized users
```

### 6.4 Phase 4 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Agent capability metadata | Backend Lead | Schema verified |
| Deterministic eligibility filtering | Backend Lead | Unit tests |
| Scored selection | Backend Lead | Scoring logic tests |
| Assignment decision persistence | Backend Lead | Audit verified |
| Searchable agent picker | Frontend Lead | UX tested |
| Manual override with authorization | Backend Lead | Permission tested |
| Reassignment/unassignment behavior | Backend Lead | Lifecycle tested |

### 6.5 Gate G4 Criteria

- [ ] Golden task receives one eligible AI employee
- [ ] Users never enter UUIDs manually
- [ ] Assignment rationale is visible
- [ ] Invalid or cross-tenant assignment is rejected
- [ ] Manual override is attributable and auditable
- [ ] Assignment persists consistently across views

---

## 7. Phase 5: Governed Execution Runtime

**Duration:** 3–4 weeks
**Objective:** Execute one assigned task durably within explicit policy and resource limits

### 7.1 Execution Orchestration

**File:** `src/modules/execution/execution-orchestrator.ts`

```typescript
export interface ExecutionContext {
  attemptId: string;
  taskId: string;
  agentId: string;
  tenantId: string;
  policySnapshot: ExecutionPolicy;
  taskInstructions: string;
  projectContext: ProjectContext;
  approvedInputs: ApprovedInput[];
  toolPolicy: ToolPermission[];
  resourceLimits: ResourceLimits;
}

@Injectable()
export class ExecutionOrchestrator {
  async executeTask(assignment: TaskAssignment, metadata: CommandMetadata): Promise<ExecutionAttempt> {
    // Command transactionally creates the attempt, reserves concurrency,
    // transitions the task to QUEUED, and inserts TaskExecutionRequested.
    return this.commandBus.execute(
      new RequestTaskExecutionCommand({
        taskId: assignment.taskId,
        agentId: assignment.agentId,
        executionRequestId: metadata.idempotencyKey,
      }),
      metadata,
    );
  }
}
```

Attempt numbers are allocated inside the transaction under a database uniqueness constraint. Attempt creation and the outbox event must never be separate commits.

### 7.2 Execution Worker

**File:** `src/modules/execution/execution.worker.ts`

```typescript
@Injectable()
export class ExecutionWorker implements OnModuleInit {
  private readonly MAX_CONCURRENT = 5;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private readonly STALE_THRESHOLD_MS = 120000;

  async handleTaskExecutionRequested(event: OutboxEvent): Promise<void> {
    const { attemptId } = event.payload;
    const attempt = await this.attemptRepo.claimForExecution(
      event.tenantId,
      attemptId,
      event.id,
    );

    // Load immutable snapshots
    const context = await this.buildExecutionContext(attempt);

    // Execute within policy limits
    const result = await this.executeWithLimits(context);

    // One application command atomically persists evidence metadata,
    // submits the attempt, transitions the task, creates the review request,
    // and emits audit/projection events.
    await this.commandBus.execute(
      new SubmitTaskForReviewCommand({
        attemptId,
        evidence: result.evidence,
        outputSummary: result.summary,
      }),
      this.metadataFromEvent(event),
    );
  }

  private async executeWithLimits(context: ExecutionContext): Promise<ExecutionResult> {
    // Per-tenant concurrency limits
    // Per-agent concurrency limits
    // Attempt timeout
    // Heartbeat and stale-run recovery
    // Maximum tool calls
    // Token and cost budget
    // Circuit breaker
  }
}
```

Phase 5 requires a separate approved runtime design covering:

- Persisted immutable task, policy, input, prompt/graph, model, and tool-version snapshots
- Per-tenant and per-agent concurrency reservations
- Heartbeat ownership, stale-attempt recovery, and fencing tokens
- Cooperative cancellation and hard timeout behavior
- Retry classification and attempt lineage
- Token/tool/time/cost budgets
- Circuit breakers and provider degradation
- Tool-call ledger and side-effect approval
- Secret/PII redaction and artifact access controls
- Evidence checksum, immutability, and storage lifecycle
- Crash boundaries before, during, and after tool execution

Comments such as “heartbeat” or “circuit breaker” are not implementation completion. Each control requires a design, tests, metrics, and a failure-injection case before G5.

### 7.3 Policy Snapshot

**File:** `src/modules/execution/domain/execution-policy.ts`

```typescript
export interface ExecutionPolicy {
  taskId: string;
  autonomyLevel: 0 | 1 | 2 | 3 | 4;
  allowedTools: string[];
  deniedTools: string[];
  maxToolCalls: number;
  maxTokens: number;
  maxCost: number;
  timeoutMs: number;
  requiresHumanApproval: boolean;
  externalSideEffectApproval: boolean;
  inputSources: string[];
}

export enum AutonomyLevel {
  L0_SUGGEST = 0,    // AI proposes; human does all
  L1_DRAFT_EXECUTION = 1, // AI executes approved task to draft; human reviews
  L2_INTERNAL_EXECUTION = 2, // AI executes pre-authorized internal tasks
  L3_CONDITIONAL_SIDE_EFFECTS = 3, // AI may perform approved side effects
  L4_BROAD_DELEGATION = 4, // Reserved; requires mature governance
}
```

### 7.4 Evidence Artifact

**File:** `src/modules/execution/domain/evidence-artifact.ts`

```typescript
export interface EvidenceArtifact {
  id: string;
  tenantId: string;
  projectId: string;
  taskId: string;
  executionAttemptId: string;
  artifactType: 'DRAFT' | 'REPORT' | 'DOCUMENT' | 'DATA' | 'OUTPUT';
  storageRef: string;
  mimeType: string;
  checksum: string;
  source: 'AI_GENERATED' | 'HUMAN_PROVIDED' | 'SYSTEM_DERIVED';
  createdByActorId: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}
```

### 7.5 Failure Classification

**File:** `src/modules/execution/domain/execution-failures.ts`

```typescript
export enum FailureClassification {
  TRANSIENT_INFRASTRUCTURE = 'TRANSIENT_INFRASTRUCTURE',
  INVALID_INPUT = 'INVALID_INPUT',
  POLICY_DENIAL = 'POLICY_DENIAL',
  TOOL_FUNCTIONAL_FAILURE = 'TOOL_FUNCTIONAL_FAILURE',
  MODEL_QUALITY_FAILURE = 'MODEL_QUALITY_FAILURE',
  CANCELLATION = 'CANCELLATION',
  BUDGET_EXHAUSTION = 'BUDGET_EXHAUSTION',
}

export const FAILURE_HANDLING: Record<FailureClassification, FailureHandling> = {
  [FailureClassification.TRANSIENT_INFRASTRUCTURE]: { retryable: true, backoff: true },
  [FailureClassification.INVALID_INPUT]: { retryable: false, requiresInput: true },
  [FailureClassification.POLICY_DENIAL]: { retryable: false, requiresApproval: true },
  [FailureClassification.TOOL_FUNCTIONAL_FAILURE]: { retryable: true, ifClassifiedRetryable: true },
  [FailureClassification.MODEL_QUALITY_FAILURE]: { retryable: true, withinLimit: true },
  [FailureClassification.CANCELLATION]: { retryable: false, safeStop: true },
  [FailureClassification.BUDGET_EXHAUSTION]: { retryable: false, visibleFailure: true },
};
```

### 7.6 Phase 5 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Execution attempt creation | Backend Lead | Unique identity |
| Concurrency controls (tenant/agent) | Backend Lead | Load test |
| Timeout and heartbeat | Backend Lead | Stale detection |
| Cancellation support | Backend Lead | User test |
| Tool call limits | Backend Lead | Policy test |
| Token/cost budget | Backend Lead | Budget test |
| Circuit breaker | Backend Lead | Failure injection |
| Evidence persistence | Backend Lead | Review test |

### 7.7 Gate G5 Criteria

For synthetic bookkeeping task:

- [ ] One assignment creates one active attempt
- [ ] Worker restart does not lose or duplicate attempt
- [ ] AI uses only authorized context and tools
- [ ] Missing inputs produce NEEDS_INPUT, not fabrication
- [ ] Draft deliverable and evidence artifact are persisted
- [ ] Task reaches NEEDS_REVIEW
- [ ] No AI-controlled path can approve its own work

---

## 8. Phase 6: Human Review, Revision, and Lifecycle

**Duration:** 1.5 weeks
**Objective:** Close the governed work loop

### 8.1 Review Service

**File:** `src/modules/reviews/review.service.ts`

```typescript
export interface ReviewInput {
  taskId: string;
  executionAttemptId: string;
  decision: ReviewDecision;
  comment?: string;
  revisionInstructions?: string;
}

@Injectable()
export class ReviewService {
  async submitReview(input: ReviewInput, metadata: CommandMetadata): Promise<ReviewResult> {
    // One command validates tenant/reviewer authority and atomically records
    // the decision, transitions task state, creates a revision request when
    // applicable, evaluates lifecycle guards, and emits audit/outbox events.
    return this.commandBus.execute(
      new DecideTaskReviewCommand(input),
      metadata,
    );
  }
}
```

The review transaction must use optimistic concurrency or locking so a pending review cannot be decided twice. Revision creates a new execution request linked to the immutable prior attempt; approval cannot rewrite evidence.

### 8.2 Lifecycle Transition Guards

**File:** `src/modules/projects/application/lifecycle-guards.ts`

```typescript
@Injectable()
export class LifecycleGuardService {
  async canTransition(
    projectId: string,
    fromStage: ProjectStage,
    toStage: ProjectStage,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Rule: REVIEW → COMPLETED requires all mandatory tasks approved
    if (fromStage === ProjectStage.REVIEW && toStage === ProjectStage.COMPLETED) {
      const pendingTasks = await this.taskRepo.findPendingMandatory(projectId);
      if (pendingTasks.length > 0) {
        return {
          allowed: false,
          reason: `${pendingTasks.length} mandatory tasks require approval before completion`,
        };
      }
    }

    return { allowed: true };
  }

  async advanceStage(
    projectId: string,
    toStage: ProjectStage,
    metadata: CommandMetadata,
    waiverReason?: string,
  ): Promise<void> {
    const currentStage = await this.projectRepo.getStage(projectId);
    const guard = await this.canTransition(projectId, currentStage, toStage);

    if (!guard.allowed) {
      if (!waiverReason) throw new DomainError('TRANSITION_GUARD_FAILED', guard.reason);

      await this.policy.assertCanWaiveTransition({
        tenantId: metadata.tenantId,
        actorId: metadata.actorId,
        projectId,
        fromStage: currentStage,
        toStage,
      });
      await this.recordStructuredWaiver(
        projectId,
        currentStage,
        toStage,
        waiverReason,
        metadata,
      );
    }

    await this.commandBus.execute(
      new AdvanceProjectStageCommand({ projectId, toStage }),
      metadata,
    );
  }
}
```

### 8.3 Phase 6 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Review inbox | Frontend Lead | UX tested |
| Execution summary display | Frontend Lead | Evidence visible |
| Approve/Revision/Reject/Cancel | Backend Lead | State tested |
| Revision creates new attempt | Backend Lead | Linkage verified |
| Prior evidence immutability | Backend Lead | No mutation test |
| Stage transition guards | Backend Lead | Guard tested |
| Project completion guard | Backend Lead | Completion test |

### 8.4 Gate G6 Criteria

- [ ] Reviewer identity and decision are persisted
- [ ] Revision produces distinguishable new attempt
- [ ] Prior evidence remains immutable
- [ ] Approval advances task and stage exactly once
- [ ] Project completion guard works
- [ ] Refresh and relogin show authoritative state

---

## 9. Phase 7: Execution UX and Unified Timeline

**Duration:** 1.5 weeks
**Objective:** Make autonomous system understandable and controllable

### 9.1 Required UI Surfaces

| Surface | Description | Priority |
|---------|-------------|----------|
| Enterprise initiation status | Track initiation from draft to completion | P0 |
| Project automation status | Visible automation progress | P0 |
| Project task board | Kanban-style task view | P0 |
| Searchable AI assignment | Agent picker with filters | P0 |
| Execution attempt detail | Full attempt trace | P0 |
| Evidence viewer | Download/view artifacts | P0 |
| Review inbox | Pending reviews list | P0 |
| Unified activity timeline | Chronological event stream | P1 |
| Retry/cancel controls | Operator actions | P1 |
| Failure recovery guidance | Help text for errors | P1 |

### 9.2 Timeline Event Schema

**File:** `src/modules/timeline/timeline.types.ts`

```typescript
export interface TimelineEvent {
  id: string;
  tenantId: string;
  entityType: 'Initiation' | 'Project' | 'Goal' | 'Task' | 'ExecutionAttempt' | 'Review';
  entityId: string;
  eventType: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  actorId: string;
  actorName: string;
  payload: Record<string, unknown>;
  correlationId: string;
  occurredAt: Date;
}

// Timeline events for golden path
export const GOLDEN_PATH_EVENTS = [
  'InitiationCreated',
  'InitiationRevised',
  'InitiationApproved',
  'ProjectCreated',
  'AutomationRequested',
  'AutomationStarted',
  'AutomationCompleted',
  'GoalCreated',
  'TaskCreated',
  'AIAgentAssigned',
  'AIAgentReassigned',
  'ExecutionQueued',
  'ExecutionStarted',
  'ExecutionPaused',
  'ExecutionResumed',
  'ExecutionFailed',
  'ExecutionSubmitted',
  'EvidenceCreated',
  'ReviewRequested',
  'ReviewApproved',
  'RevisionRequested',
  'TaskCompleted',
  'StageAdvanced',
  'ProjectCompleted',
  'OperatorRetry',
  'WaiverGranted',
];
```

### 9.3 Realtime Behavior

**File:** `src/modules/events/timeline.gateway.ts`

```typescript
@Injectable()
export class TimelineGateway {
  // Socket.IO gateway for timeline events
  // Proxies to EventsGateway
  // Falls back to polling if socket disconnected

  async onModuleInit() {
    this.socketGateway.on('timeline:entity', (entityType, entityId) => {
      // Subscribe to entity timeline
    });
  }

  // After missed events: polling fallback
  async fetchMissedEvents(since: Date, entityType: string, entityId: string): Promise<TimelineEvent[]> {
    return this.timelineRepo.findSince(since, entityType, entityId);
  }
}
```

### 9.4 Phase 7 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Initiation status display | Frontend Lead | UX tested |
| Automation status display | Frontend Lead | Progress visible |
| Task board | Frontend Lead | Drag/drop tested |
| Agent picker | Frontend Lead | Search tested |
| Execution detail view | Frontend Lead | Trace visible |
| Evidence viewer | Frontend Lead | Download works |
| Review inbox | Frontend Lead | Actions work |
| Unified timeline | Frontend Lead | All events shown |
| Recovery controls | Frontend Lead | Retry tested |

### 9.5 Gate G7 Criteria

- [ ] No dead controls
- [ ] Every long-running action has visible status
- [ ] Errors explain impact and recovery
- [ ] Timeline reconstructs entire golden workflow
- [ ] UI correct with Socket.IO disabled and manual refresh
- [ ] Desktop and narrow-width usable
- [ ] Keyboard navigation covers primary actions

---

## 10. Phase 8: Security, Observability, and Operations

**Duration:** 2–3 weeks of dedicated capacity, beginning during Phase 3 and closing after Phase 7
**Objective:** Make reconstructed workflow safe and operable

### 10.1 Security Enforcement

Tenant security is enforced independently at every boundary:

1. HTTP and socket adapters derive tenant/actor from authenticated server state.
2. `AsyncLocalStorage` may carry request context for logging, but no global mutable context is permitted.
3. Commands contain explicit tenant/actor metadata.
4. Events and jobs persist tenant metadata and reconstruct a fresh worker context.
5. Repositories require tenant-scoped keys and include tenant predicates.
6. Tool policies validate tenant, actor, task, and allowed action.
7. Artifacts enforce tenant ownership at storage and application layers.
8. Cross-tenant identifiers return a safe not-found/denied result without revealing existence.

HTTP interceptors do not protect workers, timers, graph runs, or socket handlers; each requires its own authenticated or persisted context boundary.

### 10.2 Metrics Catalog

**File:** `src/modules/observability/metrics.service.ts`

```typescript
export const GOLDEN_PATH_METRICS = {
  // Initiation metrics
  initiations_created_total: new Counter({ name: 'initiations_created_total', help: '' }),
  initiations_approved_total: new Counter({ name: 'initiations_approved_total', help: '' }),
  initiations_failed_total: new Counter({ name: 'initiations_failed_total', help: '' }),

  // Project metrics
  project_command_success_total: new Counter({ name: 'project_command_success_total', help: '' }),
  project_command_duplicate_suppressed_total: new Counter({ name: 'project_command_duplicate_suppressed_total', help: '' }),

  // Outbox metrics
  outbox_event_age_seconds: new Histogram({ name: 'outbox_event_age_seconds', help: '' }),
  outbox_backlog_size: new Gauge({ name: 'outbox_backlog_size', help: '' }),
  event_processing_latency_seconds: new Histogram({ name: 'event_processing_latency_seconds', help: '' }),
  job_retries_total: new Counter({ name: 'job_retries_total', help: '' }),
  job_dead_letters_total: new Counter({ name: 'job_dead_letters_total', help: '' }),

  // Automation metrics
  automation_completion_rate: new Gauge({ name: 'automation_completion_rate', help: '' }),
  assignment_success_total: new Counter({ name: 'assignment_success_total', help: '' }),
  assignment_failure_total: new Counter({ name: 'assignment_failure_total', help: '' }),

  // Execution metrics
  execution_queue_time_seconds: new Histogram({ name: 'execution_queue_time_seconds', help: '' }),
  execution_duration_seconds: new Histogram({ name: 'execution_duration_seconds', help: '' }),
  attempt_success_total: new Counter({ name: 'attempt_success_total', help: '' }),
  attempt_retry_total: new Counter({ name: 'attempt_retry_total', help: '' }),
  attempt_failure_total: new Counter({ name: 'attempt_failure_total', help: '' }),
  needs_input_total: new Counter({ name: 'needs_input_total', help: '' }),
  needs_review_total: new Counter({ name: 'needs_review_total', help: '' }),

  // Human review metrics
  approval_total: new Counter({ name: 'approval_total', help: '' }),
  revision_requested_total: new Counter({ name: 'revision_requested_total', help: '' }),

  // Tool metrics
  tool_failure_total: new Counter({ name: 'tool_failure_total', help: '' }),
  token_usage_total: new Counter({ name: 'token_usage_total', help: '' }),
  estimated_cost_total: new Counter({ name: 'estimated_cost_total', help: '' }),

  // Socket metrics
  socket_reconnect_total: new Counter({ name: 'socket_reconnect_total', help: '' }),
  socket_error_total: new Counter({ name: 'socket_error_total', help: '' }),
  session_refresh_failure_total: new Counter({ name: 'session_refresh_failure_total', help: '' }),
};
```

### 10.3 Correlated Logging

**File:** `src/common/logging/correlation-logger.service.ts`

```typescript
@Injectable()
export class CorrelationLogger {
  logWithCorrelation(
    level: LogLevel,
    message: string,
    correlation: CorrelationContext,
    extra?: Record<string, unknown>,
  ): void {
    this.logger.log({
      level,
      message,
      ...correlation,
      ...extra,
      searchableBy: [
        correlation.tenantId,
        correlation.correlationId,
        correlation.actorId,
      ],
    });
  }

  // Every golden-path operation searchable by:
  // - Tenant ID
  // - Correlation ID
  // - Initiation ID
  // - Project ID
  // - Task ID
  // - Execution attempt ID
  // - Event/Job ID
}
```

Operational metrics must use non-empty help text and controlled low-cardinality labels. Tenant, project, task, attempt, event, and correlation identifiers belong in logs/traces—not metric labels.

### 10.4 Runbook Inventory

| Runbook | Trigger | Procedure |
|---------|---------|-----------|
| Outbox backlog | Backlog > 100 or age > 5min | `src/docs/runbooks/outbox-backlog.md` |
| Poison event | Dead letter count > 0 | `src/docs/runbooks/poison-event.md` |
| Stuck execution | Attempt running > 30min | `src/docs/runbooks/stuck-execution.md` |
| Provider outage | Circuit open > 5min | `src/docs/runbooks/provider-outage.md` |
| Duplicate project | Duplicate detected | `src/docs/runbooks/duplicate-project.md` |
| Failed automation | Automation status = FAILED | `src/docs/runbooks/failed-automation.md` |
| Session refresh failure | 5xx on refresh | `src/docs/runbooks/session-failure.md` |
| Socket failure | 10+ reconnects | `src/docs/runbooks/socket-failure.md` |
| Cross-tenant incident | Any suspected leak | `src/docs/runbooks/cross-tenant.md` |
| Model rollback | Quality failure > 10% | `src/docs/runbooks/model-rollback.md` |

### 10.5 Phase 8 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Tenant checks at all layers | Security | Negative test |
| Role/permission matrix | Security | Matrix doc |
| Tool allowlists | Security | Policy test |
| Side-effect approval gates | Security | Approval test |
| Prompt injection boundaries | Security | Injection test |
| Secret/PII redaction | Security | Redaction test |
| Artifact access controls | Security | Access test |
| Audit immutability | Security | Immutable test |
| Metrics dashboard | Operations | Charts populated |
| Correlated logs | Operations | Search test |
| Runbooks (10) | Operations | Tested |

### 10.6 Gate G8 Criteria

- [ ] On-call can locate any failed golden run from one correlation ID
- [ ] Alerts exist for stuck/backlogged/failed core work
- [ ] Dead-letter replay is controlled and idempotent
- [ ] Security tests show no cross-tenant access
- [ ] Runbooks tested through tabletop or controlled exercise

---

## 11. Phase 9: Golden-Path Certification

**Duration:** 1.5 weeks for certification and correction after all prerequisites pass
**Objective:** Prove product readiness for narrowly defined autonomous workflow

### 11.1 Certification Infrastructure

Certification infrastructure is a parallel workstream, not Phase 9 construction:

| Phase | Required test-infrastructure increment |
|---|---|
| 0 | Design, environment gaps, tenant/reset strategy, correlation requirements |
| 1 | Deterministic reconstruction tenant, synthetic-data generator, CI foundation |
| 2 | Duplicate submission, transaction rollback, session/relogin tests |
| 3 | Duplicate delivery, lease expiry, worker restart, dead-letter injection |
| 4 | Capacity race, no-eligible-agent, reassignment fixtures |
| 5 | Provider/tool failure, cancellation, timeout, budget, stale-worker injection |
| 6 | Review race, revision lineage, waiver and lifecycle fixtures |
| 7 | Browser automation, narrow viewport, socket-disabled and refresh recovery |
| 8 | Result dashboard, trace correlation, alert and runbook exercises |
| 9 | Execute certification and correct defects; do not build missing prerequisites |

G8 must confirm this infrastructure is operational before Phase 9 begins.

**File:** `src/test/certification/certification-runner.ts`

```typescript
export interface CertificationRun {
  runId: string;
  timestamp: Date;
  scenarios: CertificationScenario[];
  results: CertificationResult[];
}

export interface CertificationScenario {
  id: string;
  type: 'clean_run' | 'duplicate_submission' | 'worker_restart' | 'transient_failure' | 'revision_cycle' | 'session_expiry' | 'socket_disabled' | 'cross_tenant_negative';
  tenantId: string;
  inputs: GoldenScenarioData;
  expectedOutcomes: ExpectedOutcome[];
}

export interface ExpectedOutcome {
  entityType: string;
  expectedCount: number;
  idempotencyKey: string;
}
```

### 11.2 Certification Test Suites

| Suite | Description | Count |
|-------|-------------|-------|
| State machine unit tests | Transition guards, idempotency | Per state |
| Command handler integration | Real PostgreSQL | Per command |
| Repository transaction tests | Outbox atomicity | Per mutation |
| Worker tests with real infra | PostgreSQL + selected queue | Per worker |
| Contract tests | Commands, events, tools | Per contract |
| Worker restart tests | Duplicate delivery | 10 runs |
| Provider/tool failure tests | Classification handling | 10 runs |
| Security/tenant isolation | Negative tests | Per boundary |
| Golden workflow executions | Layered harness against deployed stack | 50 runs |
| Browser workflow tests | Critical frontend route and recovery | Risk-based subset of clean runs |
| Accessibility smoke tests | Keyboard nav, screen reader | Per surface |
| Session expiry tests | Refresh, relogin | 5 runs |

### 11.3 Certification Run Requirements

| Test Type | Minimum Runs |
|-----------|-------------|
| Clean golden-path executions | 50 |
| Duplicate-submission executions | 10 |
| Worker-restart executions | 10 |
| Transient-provider-failure executions | 10 |
| Revision cycles | 10 |
| Session-expiry/relogin executions | 5 |
| Socket-disabled executions | 5 |
| Cross-tenant negative tests | Every mutation/read boundary |

### 11.4 Phase 9 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Automated test-tenant provisioning verification | QA Lead | Deterministic |
| Synthetic accounting datasets | QA Lead | Complete |
| Unique run IDs and labeling | QA Lead | Traceable |
| Safe record cleanup | QA Lead | No side effects |
| Failure-injection suite execution | QA Lead | Proven |
| Correlation-ID propagation | Backend Lead | End-to-end |
| Machine-readable results | QA Lead | Dashboard |
| Certification dashboard | QA Lead | Reports |

### 11.5 Gate G9 Criteria (Release Gate)

**Release only if:**

- [ ] 100% critical-path tests pass
- [ ] No open Critical or High defect
- [ ] Zero duplicate projects/tasks/attempts from retries
- [ ] Zero cross-tenant data exposure
- [ ] All certification runs preserve data integrity
- [ ] At least 98% clean runs complete without engineering intervention
- [ ] All injected transient failures recover or surface controlled retryable state
- [ ] Every completed task has evidence and attributable human approval
- [ ] P95 time targets defined and met for command acknowledgement and UI state visibility
- [ ] Rollback tested
- [ ] Product claims match certified capability

---

## 12. Phase 10: Controlled Expansion

**Start Condition:** G9 passed and stable for agreed observation period

### 12.1 Expansion Order

1. Additional accounting tasks within same workflow
2. Multiple tasks with dependencies
3. Multiple AI employees within one project
4. Parallel work with concurrency controls
5. One additional project type in accounting
6. One additional industry
7. Enterprise autonomy missions (only after UI and policies use same command/execution boundary)

**Rule:** Every expansion requires its own golden scenario and certification gate.

---

## 13. Migration and Refactoring Strategy

### 13.1 Strangler Pattern

**File:** `src/common/enterprise/strangler-strategy.ts`

```typescript
// Legacy isolation strategy
export interface IsolationStrategy {
  executionEngineVersion: 'legacy' | 'canonical';
  ownershipMarker: string; // Project or Initiation ID
  telemetryTag: string; // Which engine processed
}

export const STRANGLER_CONFIG = {
  isolationMechanism: 'persisted_execution_engine_version',

  getRoute: (entity: { id: string; executionEngineVersion?: string }): 'legacy' | 'canonical' => {
    if (!entity.executionEngineVersion) return 'legacy';
    return entity.executionEngineVersion === 'canonical' ? 'canonical' : 'legacy';
  },

  migrate: async (entityId: string, targetEngine: 'canonical'): Promise<void> => {
    // Preflight check
    // Audit record
    // Migration command
    // Rollback plan
  },
};
```

Routing is resolved by tenant flag, mutation type, and the persisted aggregate owner. A legacy aggregate cannot be written by canonical commands until a controlled migration succeeds; a canonical aggregate cannot be written by legacy code. Shared uniqueness constraints prevent both engines from creating the same business entity.

A separate database schema or shadow tables may support comparison/projections only if Phase 0 proves they are necessary. Do not operate two authoritative project/task stores.

### 13.2 Direct Prisma Remediation

| Class | Treatment |
|-------|-----------|
| Read/query | May remain in query repository with tenancy controls |
| Internal persistence owned by one domain service | Encapsulate behind repository/service |
| Business mutation from tool/controller | Route through application command |
| Test fixture/seed | Keep isolated from production runtime |
| Emergency operator action | Use controlled command with audit and authorization |

### 13.3 Existing Data Migration

**File:** `src/modules/projects/migrations/automation-state-backfill.ts`

```typescript
export interface AutomationStateBackfill {
  projectId: string;
  classification: 'complete' | 'eligible_for_initialization' | 'needs_manual_review' | 'legacy_no_automation';
  recommendedAction?: string;
}

export const BACKFILL_CLASSIFICATION = {
  complete: 'Has goals, tasks, and assignments with evidence',
  eligible_for_initialization: 'Has project but no automation; eligible for setup',
  needs_manual_review: 'Partially automated; needs human assessment',
  legacy_no_automation: 'Created before automation system; requires migration',
};
```

### 13.4 Migration-Period User Experience

The backend exposes one project capability contract:

```typescript
export interface ProjectAutomationCapability {
  engine: 'legacy' | 'canonical-v1';
  state:
    | 'AUTOMATION_READY'
    | 'SETUP_IN_PROGRESS'
    | 'SETUP_INCOMPLETE'
    | 'LEGACY_PROJECT'
    | 'MIGRATION_NEEDS_REVIEW'
    | 'AUTOMATION_FAILED';
  canRequestSetup: boolean;
  canRetry: boolean;
  blockingReasons: string[];
}
```

The frontend renders the returned state rather than embedding legacy/canonical conditions across pages. Eligible projects receive **Request automation setup**, which:

1. Runs a tenant-scoped preflight.
2. Shows proposed goals, tasks, assignments, conflicts, and retained records.
3. Requires authorized confirmation.
4. Calls an idempotent canonical initialization command.
5. Does not start task execution without separate approval.
6. Preserves a complete audit and rollback plan.

---

## 14. Quality Assurance

### 14.1 Test Pyramid

```
        ┌─────────────────┐
        │   Browser Tests  │  ← Minimal, high-value E2E
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │  Contract Tests │  ← Frontend ↔ Backend ↔ Events
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │ Integration Tests│  ← Real PostgreSQL + selected queue
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │   Unit Tests    │  ← State machines, policies, idempotency
        └─────────────────┘
```

### 14.2 Mandatory Invariant Tests

| Invariant | Test |
|-----------|------|
| Same idempotency key cannot create two projects | Test |
| Same event cannot create duplicate tasks | Test |
| Same execution request cannot create two active attempts | Test |
| AI cannot approve its own task | Test |
| Cross-tenant IDs are rejected | Test |
| Project cannot complete with mandatory unapproved tasks | Test |
| Failed transaction creates neither aggregate nor outbox event | Test |
| Committed aggregate always has required outbox event | Test |
| Worker retry cannot overwrite approved artifact | Test |
| Revision never mutates prior attempt evidence | Test |

---

## 15. Performance Targets

| Measure | Initial Objective |
|---------|------------------|
| Synchronous command acknowledgement | P95 < 2 seconds |
| UI sees committed state | P95 < 5 seconds |
| Outbox event begins processing | P95 < 10 seconds |
| Duplicate-effect rate | 0 |
| Lost committed events | 0 |
| Stuck executions without alert | 0 |
| Cross-tenant authorization failures incorrectly allowed | 0 |

---

## 16. Implementation Notes

### 16.1 SOLID Compliance Checklist

For every new file, verify:

- [ ] **S**: Does this class have exactly one reason to change?
- [ ] **O**: Can I extend behavior without modifying this class?
- [ ] **L**: Can I substitute implementations without breaking callers?
- [ ] **I**: Are interfaces focused on specific clients?
- [ ] **D**: Do high-level policies depend on abstractions, not concretions?

### 16.2 Mutation-Ownership and Duplication Checklist

- [ ] Every domain concept has exactly one authoritative owner
- [ ] No two services implement the same mutation path
- [ ] State transitions defined in one place (state machine)
- [ ] Commands versioned and unique by type+version
- [ ] Events use single canonical type registry

### 16.3 Error-Control Checklist

- [ ] All inputs validated before processing
- [ ] All errors caught and classified
- [ ] Error messages are safe (no secrets/stack traces)
- [ ] Failed operations are idempotent and retryable
- [ ] Transactions rollback completely on failure

---

## 17. Timeline Summary

| Week | Primary Outcome |
|------|----------------|
| 1–2 | Freeze, deployed-runtime forensics, infrastructure and exact failure map |
| 3 | Commands, events, states, ADRs, CI enforcement, tenant flags |
| 4–5 | Approved initiation creates exactly one isolated canonical project |
| 6–7 | Durable outbox/worker infrastructure and project automation |
| 8 | Idempotent goals/tasks and usable AI assignment |
| 9–12 | Governed execution runtime with failure/recovery iterations |
| 13 | Human review, revision, and lifecycle guards |
| 14 | Execution UX, timeline, recovery controls |
| 15–16 | Security, observability, operations, and test infrastructure completion |
| 17–18 | Certification, defect correction, and rollback validation |
| 19 | Controlled tenant rollout |
| 20–21 | Contingency for gate iteration and production hardening |

---

## 18. Executive Scorecard

Report weekly using evidence, not percentage-complete estimates.

| Indicator | Red | Amber | Green |
|-----------|-----|-------|-------|
| Golden workflow | Cannot reach task execution | Reaches review with manual recovery | Completes repeatedly |
| Duplicate effects | Any unresolved duplicate | Suppressed but gaps remain | Zero in certification |
| Silent failure | Core failures log-only | Some visible states | All core failures actionable |
| AI evidence | Missing/unlinked | Produced inconsistently | Persisted and reviewable |
| Human control | AI can bypass approval | Guards partial | All required gates enforced |
| Tenant isolation | Any suspected breach | Coverage incomplete | Negative suite passes |
| Recovery | Engineering DB repair required | Operator retry works partially | Controlled retry/resume |
| Observability | Failure cannot be traced | Multiple IDs/manual stitching | One correlation trace |

---

**Document End — NC-AWL-IMP-1 v1.1**
