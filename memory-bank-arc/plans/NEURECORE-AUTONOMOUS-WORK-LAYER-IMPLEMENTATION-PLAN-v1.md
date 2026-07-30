# NeureCore Autonomous Work Layer — Implementation & Refactor Plan

**Document ID:** NC-AWL-IMP-1
**Roadmap Reference:** NC-AWL-R1 v1.1
**Version:** 1.1 — Technical Corrections
**Date:** 2026-07-26
**Status:** DRAFT — Technical Validation Required Before G0
**Scope:** Bounded reconstruction of the autonomous work layer following the golden-path-first principle
**Duration:** 17–21 weeks (parallel workstreams, not sequential days)

---

## Document Purpose

This document provides the systematic, phase-by-phase implementation and refactor plan for the NeureCore Autonomous Work Layer Reconstruction. It translates the strategic roadmap (NC-AWL-R1) into actionable technical deliverables.

**Status rationale:** This document is DRAFT because the Phase 0 technical investigations have not been completed. The architectural direction is approved by the roadmap, but the technical implementation details require validation through Phase 0 forensics before they can be considered execution-ready. All "APPROVED", "100% SOLID", "Zero Duplication", and "Zero Errors" claims from v1.0 are withdrawn.

---

## 0. Corrective Notes from v1.0

This version addresses 21 critical/high issues identified in the technical review of v1.0:

| Issue | Correction |
|-------|-----------|
| Document status premature | Changed to DRAFT — Technical Validation Required |
| Phase 0 implementing before investigating | Phase 0 is now inspect-only; implementation deferred |
| Correlation unsafe | Using crypto.randomUUID(), explicit propagation, AsyncLocalStorage |
| Dependency rules circular | Clean layers: Domain ← Application ← Inbound Adapters; Domain/Application ports ← Infrastructure |
| Lint regex insufficient | AST-based ESLint rules, dependency cruiser, Nx boundaries |
| Feature flags in-memory | Full Prisma schema, cache, multi-instance consistency, audit |
| Idempotency name-based | Stable domain keys with uniqueness constraints |
| Phase 2/3 sequencing | Phase 2 includes minimum outbox foundation; Phase 3 is worker+retry |
| Project creation transaction incomplete | Full ACID transaction design with tenant scoping |
| Legacy routing broad | Per-aggregate ownership markers, explicit migration state |
| Outbox worker sketch | Full lifecycle: init, polling, lease, backoff, dead-letter, shutdown |
| Automation idempotency per-item | Per-item upsert with template keys |
| Assignment concurrency | Transactional capacity reservation, row locking |
| Execution non-atomic | Attempt + event in single transaction |
| Review non-atomic | Coordinated transaction for review + task + lifecycle |
| Tenant context concurrency-unsafe | AsyncLocalStorage + explicit worker context |
| Certification too late | Parallel workstream beginning Phase 0 |
| Existing project UX missing | Full legacy state + migration UX |
| State machines incorrect | Fixed transitions with guards + events |
| Timeline arithmetic | Week ranges, effort estimates, parallel tracks |
| Duplication | Removed duplicate sections |

---

## 1. Architectural Foundation

### 1.1 Clean Architecture Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     Inbound Adapters                             │
│  Controllers · Hermes Tools · Scheduled Jobs · Queue Processors  │
└────────────────────────────┬──────────────────────────────────┘
                             │ invokes
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  Use Cases · Commands · Command Handlers · Query Handlers      │
│  Application services orchestrate domain operations              │
└────────────────────────────┬──────────────────────────────────┘
                             │ depends on interfaces (ports)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Layer                               │
│  Entities · Value Objects · Domain Services · Domain Events    │
│  Domain services implement domain logic; no external imports   │
└────────────────────────────┬──────────────────────────────────┘
                             ▲
┌─────────────────────────────────────────────────────────────────┐
│              Infrastructure Adapters (implements ports)          │
│  Prisma Repositories · Outbox · Redis · Socket.IO · AI Gateway │
│  Webhook · File Storage · External APIs                        │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency rules:**
- Domain: depends on nothing external
- Application: depends on Domain and Domain/Application interfaces
- Inbound Adapters: depend on Application
- Infrastructure: implements interfaces defined in Domain/Application

**Forbidden patterns:**
- Controllers importing Infrastructure directly
- Tools calling Prisma for business mutations
- Application services importing Prisma, HTTP, Socket.IO
- Circular dependencies between any layers

### 1.2 Ports and Adapters Interface Definitions

**File:** `src/common/ports/command-bus.port.ts`

```typescript
// Application layer port for command dispatch
export interface ICommandBus {
  execute<T>(command: ICommand<T>, metadata: CommandMetadata): Promise<CommandResult<T>>;
  executeWithTransaction<T>(command: ICommand<T>, metadata: CommandMetadata, tx: TransactionClient): Promise<CommandResult<T>>;
}

export interface IQueryBus {
  query<T>(query: IQuery<T>): Promise<QueryResult<T>>;
}
```

**File:** `src/common/ports/outbox.port.ts`

```typescript
// Domain/Application port for event emission
export interface IOutboxPort {
  // Persist event atomically with domain mutation (requires TransactionClient)
  persist<T>(event: DomainEvent<T>, tx: TransactionClient): Promise<void>;
  
  // Acknowledge event was delivered (called by worker after processing)
  acknowledge(eventId: string): Promise<void>;
  
  // Mark event as dead-lettered
  deadLetter(eventId: string, reason: string): Promise<void>;
}
```

**File:** `src/common/ports/repository.port.ts`

```typescript
// Generic repository port (domain uses this, infrastructure implements)
export interface IRepository<T, TId> {
  findById(id: TId, tx?: TransactionClient): Promise<T | null>;
  findByTenantId(tenantId: string, tx?: TransactionClient): Promise<T[]>;
}

export interface IMutableRepository<T, TId> extends IRepository<T, TId> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, tx?: TransactionClient): Promise<T>;
  update(id: TId, data: Partial<T>, tx?: TransactionClient): Promise<T>;
  delete(id: TId, tx?: TransactionClient): Promise<void>;
}
```

### 1.3 Golden Path Invariants

For every implementation decision, verify:

1. Exactly one authoritative source for each mutation
2. Tenant identity validated at every hop (not via ambient context alone)
3. Idempotency guaranteed via database uniqueness constraints, not application checks
4. Failure is always visible and recoverable
5. Backend state is the single source of truth
6. Transactions have explicit boundaries; no partial commits

---

## 2. Phase 0: Freeze, Baseline, and Runtime Forensics

**Duration:** 1.5–2 weeks (Weeks 1–2)
**Type:** INVESTIGATION ONLY — No implementation
**Objective:** Understand actual deployed behavior; stop architectural drift

### 2.1 Phase 0 Principle

> **Phase 0 does not modify the system.** It only observes, traces, inventories, and documents. Implementation begins only after G0 gate approval.

### 2.2 Feature Freeze

**File:** `docs/frozen-scope.md`

```markdown
# Frozen Scope — Autonomous Work Layer Reconstruction

## Prohibited Until G0
- Additional industries or sub-industries
- New AI employee templates unrelated to golden path
- New dashboards, navigation areas, or workspace variants
- Additional autonomy modes
- Multi-agent collaboration beyond golden path requirements
- Cosmetic redesign unrelated to usability blockers
- Broad marketplace expansion
- New orchestration frameworks
- New infrastructure products without approved architectural need
- Refactors that do not reduce golden-path risk
- New application architecture or module structure

## Preserved (Safe to Maintain)
- Authentication, authorization, tenant isolation
- Customers, departments, projects, industry configuration
- Existing frontend shell and workspace patterns
- Prisma/PostgreSQL persistence where validated
- AI employee templates and deployment concepts
- Approval, audit, observability, policy concepts
- LangGraph where it serves governed orchestration
- Existing in-process and database-polling mechanisms (temporary)
```

### 2.3 Runtime Forensics Inventory (Inspect Only)

#### 2.3.1 Mutation Entry Point Discovery

Use reproducible grep/ast commands to discover, not manual registries:

```bash
# Find all Prisma mutations in tools and controllers
grep -rn "prisma\.\(create\|update\|delete\|deleteMany\)" \
  --include="*.tool.ts" \
  --include="*.controller.ts" \
  src/modules/ | grep -v ".repository.ts" | grep -v "__tests__"

# Find all direct Prisma usage outside repositories
grep -rn "this\.prisma\." src/modules/*/ \
  --include="*.service.ts" | grep -v "this\.prisma\.\$" | head -50
```

Store results as JSON artifacts, not manually maintained TypeScript files.

#### 2.3.2 Worker/Queue Discovery

```bash
# Find all setInterval, setTimeout, cron patterns
grep -rn "setInterval\|setTimeout\|cron\|@Cron" src/ --include="*.ts"

# Find BullMQ/Kafka usage
grep -rn "bullmq\|kafka\|amqp" src/ --include="*.ts"

# Find EventEmitter usage
grep -rn "EventEmitter\|emit\|subscribe" src/modules/*/ --include="*.ts" | head -30
```

#### 2.3.3 Hermes Tool Registration Discovery

```bash
# Find HERMES_TOOL_SETS definitions
grep -rn "HERMES_TOOL_SETS\|setTools\|registerTool" src/ --include="*.ts"

# Find CreateProjectTool definition
grep -rn "createProject\|CreateProjectTool" src/ --include="*.ts"
```

### 2.4 Correlation ID Trace Protocol

For one correlation ID, trace through ALL layers:

1. Generate correlation ID at HTTP entry point
2. Propagate via `x-correlation-id` header through HTTP calls
3. Propagate via AsyncLocalStorage for async operations
4. Persist correlation ID in all database mutations
5. Include in all emitted events (outbox, Socket.IO)
6. Include in all log entries

**File:** `src/common/correlation/correlation.types.ts`

```typescript
// Minimal correlation types — no implementation until Phase 0 findings

export interface CorrelationContext {
  readonly correlationId: string;     // UUIDv7
  readonly causationId: string | null; // Parent event ID
  readonly tenantId: string;          // From JWT, never from header
  readonly actorId: string;           // From JWT
  readonly actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  readonly occurredAt: Date;         // UTC
  readonly idempotencyKey: string;   // Stable domain key
  readonly schemaVersion: string;
}
```

### 2.5 Queue Durability Assessment

Assess existing infrastructure:

| Component | Current State | Durable? | Requires Verification |
|-----------|---------------|----------|----------------------|
| In-process timers | `setInterval` in services | No | Crash recovery |
| Database polling | `setInterval` + `prisma.$query` | Partial | Lease mechanism? |
| Event emission | In-memory `EventEmitter` | No | Fan-out reliability |
| LangGraph execution | Direct call from controller | No | Async/queue? |
| Socket.IO | Real-time only | No | Persistence? |
| Redis/BullMQ | Not present | N/A | Confirm |

### 2.6 Phase 0 Deliverables (Artifacts)

| Deliverable | Format | Owner |
|-------------|--------|-------|
| Deployed commit SHAs | JSON manifest | Platform/Operations |
| Runtime sequence diagram | Mermaid + code refs | Architecture |
| Mutation entry point inventory | JSON (grep output) | Backend Lead |
| Worker/queue/runtime inventory | JSON (grep output) | Backend Lead |
| Direct Prisma bypass inventory | JSON (grep output) | Backend Lead |
| Root cause classification | Markdown table | Architecture |
| Frozen scope register | Markdown | Product Owner |
| Baseline golden-path trace | JSON + screenshots | QA Lead |
| Queue durability assessment | Markdown table | Architecture |
| CI/CD gap assessment | Markdown | Platform/Operations |
| Feature-flag capability inventory | JSON | Backend Lead |
| Test-infrastructure gap analysis | Markdown | QA Lead |

### 2.7 Gate G0 Criteria

**All must pass before Phase 1 begins:**

- [ ] Every golden-path hop is classified: implemented | partial | absent | bypassed | unverified
- [ ] Hermes failure is localized to specific runtime boundary
- [ ] Execution worker existence confirmed with trigger mechanism
- [ ] Tool-bypass count is exact and reproducible from grep output
- [ ] No critical decision rests solely on code comment or browser symptom
- [ ] Queue durability decision is made (PostgreSQL workers vs Redis/BullMQ)
- [ ] Test-infrastructure gap analysis complete with remediation plan
- [ ] Phase 0 contingency decision is made if map is untrustworthy

---

## 3. Phase 1: Contracts, States, and Architectural Enforcement

**Duration:** 1.5 weeks (Weeks 3–4)
**Type:** INVESTIGATION + MINIMAL FOUNDATION
**Prerequisite:** G0 passed

### 3.1 Phase 1 Principle

Phase 1 establishes the contracts and architectural rules. Implementation of infrastructure (outbox, workers, etc.) is deferred to Phase 2/3 based on G0 queue decision.

### 3.2 State Machine Specifications

Each state machine is defined as:

- Enum of valid states
- Transition table with guards
- Events emitted on each transition
- Actor permissions required for each transition
- Invariants (things that must be true after transition)

#### 3.2.1 Enterprise Initiation State Machine

**File:** `src/modules/enterprise-initiation/domain/initiation.sm.ts`

```typescript
// State
export enum InitiationStatus {
  DRAFT = 'DRAFT',
  DISCOVERING = 'DISCOVERING',
  READY_FOR_CONFIRMATION = 'READY_FOR_CONFIRMATION',
  APPROVED = 'APPROVED',
  MATERIALIZING = 'MATERIALIZING',
  COMPLETED = 'COMPLETED',
  NEEDS_INPUT = 'NEEDS_INPUT',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
  CANCELLED = 'CANCELLED',
}

// Transition
export interface InitiationTransition {
  from: InitiationStatus;
  to: InitiationStatus;
  guard?: (ctx: InitiationContext) => boolean;
  event: InitiationEvent;
  actorType?: ('HUMAN' | 'AI_AGENT' | 'SYSTEM')[];
}

export const INITIATION_TRANSITIONS: InitiationTransition[] = [
  { from: InitiationStatus.DRAFT, to: InitiationStatus.DISCOVERING, event: 'START_DISCOVERY' },
  { from: InitiationStatus.DISCOVERING, to: InitiationStatus.READY_FOR_CONFIRMATION, event: 'COMPLETE_DISCOVERY', guard: (ctx) => ctx.gapsIdentified },
  { from: InitiationStatus.DISCOVERING, to: InitiationStatus.NEEDS_INPUT, event: 'REQUIRES_INPUT' },
  { from: InitiationStatus.READY_FOR_CONFIRMATION, to: InitiationStatus.APPROVED, event: 'CONFIRM', actorType: ['HUMAN'] },
  { from: InitiationStatus.READY_FOR_CONFIRMATION, to: InitiationStatus.DISCOVERING, event: 'REVISE' },
  { from: InitiationStatus.READY_FOR_CONFIRMATION, to: InitiationStatus.CANCELLED, event: 'CANCEL', actorType: ['HUMAN'] },
  { from: InitiationStatus.APPROVED, to: InitiationStatus.MATERIALIZING, event: 'START_MATERIALIZATION' },
  { from: InitiationStatus.MATERIALIZING, to: InitiationStatus.COMPLETED, event: 'COMPLETE_MATERIALIZATION' },
  { from: InitiationStatus.MATERIALIZING, to: InitiationStatus.FAILED_RETRYABLE, event: 'MATERIALIZATION_FAILED' },
  { from: InitiationStatus.FAILED_RETRYABLE, to: InitiationStatus.MATERIALIZING, event: 'RETRY_MATERIALIZATION' },
  { from: InitiationStatus.FAILED_RETRYABLE, to: InitiationStatus.FAILED_FINAL, event: 'MAX_RETRIES_EXCEEDED' },
  { from: InitiationStatus.FAILED_FINAL, to: InitiationStatus.CANCELLED, event: 'CANCEL' },
  { from: InitiationStatus.NEEDS_INPUT, to: InitiationStatus.DISCOVERING, event: 'PROVIDE_INPUT' },
];
```

#### 3.2.2 Execution Attempt State Machine

**File:** `src/modules/execution/domain/attempt.sm.ts`

```typescript
export enum ExecutionAttemptStatus {
  CREATED = 'CREATED',           // Attempt record exists, not yet queued
  QUEUED = 'QUEUED',             // Submitted to execution queue
  RUNNING = 'RUNNING',           // Actively executing
  WAITING_FOR_TOOL = 'WAITING_FOR_TOOL', // Tool call in progress
  PRODUCING_EVIDENCE = 'PRODUCING_EVIDENCE', // Collecting output
  SUBMITTED_FOR_REVIEW = 'SUBMITTED_FOR_REVIEW', // Awaiting human review
  PAUSED = 'PAUSED',             // Suspended (budget/timeout/user)
  NEEDS_INPUT = 'NEEDS_INPUT',   // Requires external input
  TIMED_OUT = 'TIMED_OUT',       // Exceeded time limit
  FAILED_RETRYABLE = 'FAILED_RETRYABLE', // Recoverable failure
  FAILED_FINAL = 'FAILED_FINAL', // Non-recoverable
  CANCELLED = 'CANCELLED',       // User cancelled
}

export const ATTEMPT_TRANSITIONS: ExecutionAttemptTransition[] = [
  { from: ExecutionAttemptStatus.CREATED, to: ExecutionAttemptStatus.QUEUED, event: 'ENQUEUE' },
  { from: ExecutionAttemptStatus.QUEUED, to: ExecutionAttemptStatus.RUNNING, event: 'START' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.WAITING_FOR_TOOL, event: 'TOOL_CALL_START' },
  { from: ExecutionAttemptStatus.WAITING_FOR_TOOL, to: ExecutionAttemptStatus.RUNNING, event: 'TOOL_CALL_END' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.PRODUCING_EVIDENCE, event: 'START_OUTPUT' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.PAUSED, event: 'PAUSE' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.NEEDS_INPUT, event: 'REQUEST_INPUT' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.TIMED_OUT, event: 'TIMEOUT' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.FAILED_RETRYABLE, event: 'FAIL_RETRYABLE' },
  { from: ExecutionAttemptStatus.RUNNING, to: ExecutionAttemptStatus.FAILED_FINAL, event: 'FAIL_FINAL' },
  { from: ExecutionAttemptStatus.PRODUCING_EVIDENCE, to: ExecutionAttemptStatus.SUBMITTED_FOR_REVIEW, event: 'SUBMIT_FOR_REVIEW' },
  { from: ExecutionAttemptStatus.SUBMITTED_FOR_REVIEW, to: ExecutionAttemptStatus.FAILED_RETRYABLE, event: 'REJECT_ATTEMPT' },
  { from: ExecutionAttemptStatus.PAUSED, to: ExecutionAttemptStatus.RUNNING, event: 'RESUME' },
  { from: ExecutionAttemptStatus.PAUSED, to: ExecutionAttemptStatus.CANCELLED, event: 'CANCEL' },
  { from: ExecutionAttemptStatus.NEEDS_INPUT, to: ExecutionAttemptStatus.RUNNING, event: 'PROVIDE_INPUT' },
  { from: ExecutionAttemptStatus.TIMED_OUT, to: ExecutionAttemptStatus.FAILED_RETRYABLE, event: 'RETRY_AFTER_TIMEOUT' },
  { from: ExecutionAttemptStatus.FAILED_RETRYABLE, to: ExecutionAttemptStatus.QUEUED, event: 'RETRY' },
  { from: ExecutionAttemptStatus.FAILED_RETRYABLE, to: ExecutionAttemptStatus.FAILED_FINAL, event: 'MAX_RETRIES_EXCEEDED' },
];

// NOTE: SUBMITTED_FOR_REVIEW does NOT transition directly to APPROVED
// Approval is a human decision via Review service, not automatic
```

### 3.3 Command Contract Specifications

#### 3.3.1 Command Metadata

**File:** `src/common/commands/command-metadata.ts`

```typescript
// Metadata accompanies every command; explicitly passed, not ambient
export interface CommandMetadata {
  readonly tenantId: string;        // Required, from JWT
  readonly actorId: string;         // Required, from JWT
  readonly actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  readonly correlationId: string;   // UUIDv7, propagated from trigger
  readonly causationId: string | null; // ID of triggering event
  readonly idempotencyKey: string;   // Stable domain key (see §3.4)
  readonly occurredAt: Date;         // UTC timestamp
  readonly schemaVersion: string;    // For event schema evolution
}

export function createCommandMetadata(
  tenantId: string,
  actorId: string,
  options?: Partial<Omit<CommandMetadata, 'tenantId' | 'actorId'>>
): CommandMetadata {
  return {
    tenantId,
    actorId,
    actorType: options?.actorType ?? 'HUMAN',
    correlationId: options?.correlationId ?? crypto.randomUUID(),
    causationId: options?.causationId ?? null,
    idempotencyKey: options?.idempotencyKey ?? `${tenantId}:${crypto.randomUUID()}`,
    occurredAt: new Date(),
    schemaVersion: '1.0',
  };
}
```

#### 3.3.2 Idempotency Keys (Stable Domain Keys)

**File:** `src/common/idempotency/idempotency-keys.ts`

Every mutation uses a stable domain key, NOT application-generated IDs:

| Aggregate | Uniqueness Constraint | Why |
|-----------|----------------------|-----|
| Project | `initiationId` (approved initiation) | One project per approved initiation |
| ProjectAutomation | `projectId + automationVersion` | Idempotent automation requests |
| Goal | `projectId + templateGoalKey` | Deterministic from project template |
| Task | `projectId + templateTaskKey` | Deterministic from project template |
| TaskAssignment | `taskId + assignmentGeneration` | One assignment per generation |
| ExecutionAttempt | `taskId + revisionId` | Explicit revision ID, not sequence number |
| Evidence | `attemptId + artifactKey` | Deterministic artifact key |
| ReviewDecision | `attemptId + reviewRequestId` | Explicit review request |
| OutboxEvent | `aggregateType + aggregateId + eventType + idempotencyKey` | Prevents duplicate processing |

**Database enforcement requires unique constraints, not application checks.**

#### 3.3.3 Example Command: CreateProjectFromInitiation

**File:** `src/modules/projects/application/commands/create-project-from-initiation.command.ts`

```typescript
// Command definition (interface only, no implementation)
export const CREATE_PROJECT_FROM_INITIATION_COMMAND = 'CreateProjectFromInitiation';

export interface CreateProjectFromInitiationInput {
  readonly initiationId: string;           // Stable key for idempotency
  readonly projectName: string;
  readonly projectDescription?: string;
  readonly customerId?: string;
  readonly targetDate?: Date;
  readonly automationConfig: {
    readonly generateGoals: boolean;
    readonly generateTasks: boolean;
    readonly autoAssign: boolean;
  };
}

// Result type
export interface CreateProjectFromInitiationResult {
  readonly projectId: string;
  readonly initiationId: string;
  readonly automationRequestId: string;
  readonly correlationId: string;
  readonly isReplay: boolean;  // True if idempotency key already existed
}
```

### 3.4 Architecture Enforcement

#### 3.4.1 Layer Dependency Rules

**File:** `.eslintrc.architecture.js`

```javascript
// ESLint architecture rules — AST-based, not regex
module.exports = {
  rules: {
    // Enforce layer boundaries
    '@nx/enforce-module-boundaries': [
      'error',
      {
        allow: [
          // Inbound adapters may import Application
          ['controllers', 'tools', 'scheduled-jobs', 'queue-processors'],
          ['application'],
          // Application may import Domain and Domain ports
          ['application'],
          ['domain', 'common/ports'],
          // Infrastructure implements Domain ports
          ['infrastructure'],
          ['common/ports', 'domain'],
          // Common utilities have no domain dependencies
          ['common'],
        ],
        // Deny specific problematic imports
        disallow: [
          // Controllers/tools cannot import infrastructure directly
          ['controllers', 'infrastructure'],
          ['tools', 'infrastructure'],
          // Application cannot import Infrastructure
          ['application', 'infrastructure'],
          // Domain cannot import anything external
          ['domain', '!domain'],
        ],
      },
    ],
    
    // Restrict Prisma imports to infrastructure layer only
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@prisma/client'],
            message: 'Prisma may only be imported in infrastructure/repositories directory',
            allowTypeImports: false,
          },
        ],
      },
    ],
  },
};
```

#### 3.4.2 Dependency Cruiser Config

**File:** `dependency-cruiser.config.js`

```javascript
module.exports = {
  extraction: {
    runWebpackNeura: false,
  },
  include: ['src/**/*.ts'],
  exclude: ['src/**/__tests__/**', 'src/**/*.spec.ts'],
  overrides: [
    {
      name: 'enforce-layers',
      file: {
        path: 'src/(controllers|modules/hermes/tools)/**/*.ts',
      },
      depConstraints: {
        // These may only import application and common
        hasManyDependencies: false,
        onlyDependOnSrcDirs: ['application', 'common'],
      },
    },
    {
      name: 'application-layer',
      file: {
        path: 'src/modules/**/application/**/*.ts',
      },
      depConstraints: {
        // Application may import domain and ports, not infrastructure
        onlyDependOnSrcDirs: ['domain', 'common/ports', 'application'],
      },
    },
    {
      name: 'domain-layer',
      file: {
        path: 'src/modules/**/domain/**/*.ts',
      },
      depConstraints: {
        // Domain has NO external dependencies except types
        onlyDependOnSrcDirs: ['common/types'],
      },
    },
    {
      name: 'infrastructure-layer',
      file: {
        path: 'src/infrastructure/**/*.ts',
      },
      depConstraints: {
        // Infrastructure implements ports, may use domain types
        onlyDependOnSrcDirs: ['common/ports', 'domain', 'infrastructure'],
      },
    },
  ],
};
```

### 3.5 Feature Flag Infrastructure

**Prerequisite:** Requires Phase 0 queue durability decision

#### 3.5.1 Feature Flag Schema

**File:** `src/infrastructure/database/prisma/migrations/xxxxx_feature_flags/schema.prisma`

```prisma
model FeatureFlag {
  key          String   @id // e.g., 'CANONICAL_INITIATION'
  description   String?
  defaultValue Boolean  @default(false)
  tenantOverrides TenantFeatureFlagOverride[]
  auditLogs    FeatureFlagAuditLog[]
  updatedAt    DateTime @updatedAt
  
  @@map("feature_flags")
}

model TenantFeatureFlagOverride {
  id        String   @id @default(cuid())
  flagKey   String
  tenantId  String
  value     Boolean
  grantedBy String   // actorId who set this
  reason    String?  // optional explanation
  flag      FeatureFlag @relation(fields: [flagKey], references: [key])
  
  createdAt DateTime @default(now())
  
  // Unique per tenant + flag combination
  @@unique([tenantId, flagKey])
  @@map("tenant_feature_flag_overrides")
}

model FeatureFlagAuditLog {
  id        String   @id @default(cuid())
  flagKey   String
  tenantId  String?
  actorId   String
  action    String   // 'ENABLE', 'DISABLE', 'OVERRIDE_ADDED', 'OVERRIDE_REMOVED'
  oldValue  Boolean?
  newValue  Boolean?
  reason    String?
  flag      FeatureFlag @relation(fields: [flagKey], references: [key])
  
  createdAt DateTime @default(now())
  
  @@index([flagKey, tenantId])
  @@map("feature_flag_audit_logs")
}
```

#### 3.5.2 Feature Flag Service

**File:** `src/application/feature-flags/feature-flag.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { IFeatureFlagPort } from '../../common/ports/feature-flag.port';

export enum FeatureFlag {
  CANONICAL_INITIATION = 'CANONICAL_INITIATION',
  DURABLE_AUTOMATION = 'DURABLE_AUTOMATION',
  AUTO_ASSIGNMENT = 'AUTO_ASSIGNMENT',
  AUTONOMOUS_EXECUTION = 'AUTONOMOUS_EXECUTION',
  HUMAN_REVIEW_WORKFLOW = 'HUMAN_REVIEW_WORKFLOW',
  NEW_LIFECYCLE_GUARDS = 'NEW_LIFECYCLE_GUARDS',
  NEW_TIMELINE = 'NEW_TIMELINE',
}

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly flagPort: IFeatureFlagPort,
  ) {}

  async isEnabled(flag: FeatureFlag, tenantId: string): Promise<boolean> {
    // 1. Check kill switch (global emergency disable)
    if (await this.flagPort.isGloballyDisabled(flag)) {
      return false;
    }

    // 2. Check tenant override
    const override = await this.flagPort.getTenantOverride(flag, tenantId);
    if (override !== null) {
      return override.value;
    }

    // 3. Return global default
    return this.flagPort.getDefault(flag);
  }

  async setTenantOverride(
    flag: FeatureFlag,
    tenantId: string,
    value: boolean,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    await this.flagPort.upsertOverride({
      flagKey: flag,
      tenantId,
      value,
      grantedBy: actorId,
      reason,
    });
  }

  async getFlagMetadata(flag: FeatureFlag): Promise<FlagMetadata> {
    return this.flagPort.getMetadata(flag);
  }
}
```

### 3.6 Tenant Context Implementation

#### 3.6.1 AsyncLocalStorage for HTTP Requests

**File:** `src/infrastructure/context/async-local-storage.ts`

```typescript
import { AsyncLocalStorage } from 'async_hooks';

// Module-level storage — survives across async operations within a request
export const TenantContextStorage = new AsyncLocalStorage<TenantContext>();

export interface TenantContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly requestId: string;  // Unique per HTTP request
}

// HTTP interceptor establishes context at request entry
export function withTenantContext<T>(
  context: TenantContext,
  fn: () => T,
): T {
  return TenantContextStorage.run(context, fn);
}
```

#### 3.6.2 HTTP Interceptor

**File:** `src/infrastructure/http/tenant-context.interceptor.ts`

```typescript
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: NextFn): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Extract from JWT — NOT from request headers (trust only authenticated sources)
    const user = request.user as JwtPayload;
    
    if (!user?.tenantId || !user?.sub) {
      throw new UnauthorizedException('Missing tenant or actor identity');
    }

    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const causationId = request.headers['x-causation-id'] || null;

    const tenantContext: TenantContext = {
      tenantId: user.tenantId,
      actorId: user.sub,
      actorType: user.role === 'AI_AGENT' ? 'AI_AGENT' : 'HUMAN',
      correlationId,
      causationId,
      requestId: crypto.randomUUID(),
    };

    return withTenantContext(tenantContext, () => next.handle());
  }
}
```

#### 3.6.3 Worker Context Propagation

Workers do NOT go through HTTP interceptors. Context must be reconstructed from persisted metadata:

**File:** `src/application/workers/worker-context.ts`

```typescript
// Workers receive context via message payload, not ambient context
export interface WorkerContext {
  readonly tenantId: string;
  readonly actorId: string;       // Usually SYSTEM for automated work
  readonly actorType: 'SYSTEM' | 'AI_AGENT';
  readonly correlationId: string;
  readonly causationId: string | null;  // ID of triggering outbox event
  readonly idempotencyKey: string;
  readonly occurredAt: Date;
}

// Worker creates context from event payload
export function createWorkerContext(event: OutboxEvent): WorkerContext {
  return {
    tenantId: event.tenantId,
    actorId: 'SYSTEM',  // Workers act as system
    actorType: 'SYSTEM',
    correlationId: event.correlationId,
    causationId: event.id,
    idempotencyKey: event.idempotencyKey,
    occurredAt: new Date(),
  };
}
```

### 3.7 Phase 1 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| State machine specifications (all 5 entities) | Architecture | Peer review |
| Command contracts (typed, versioned) | Backend Lead | Contract tests |
| Idempotency key specifications | Backend Lead | Uniqueness constraints |
| Layer dependency rules (ESLint + Cruiser) | Platform/Operations | CI rejects violations |
| Feature flag Prisma schema | Backend Lead | Migration applied |
| Feature flag service with cache | Backend Lead | Multi-instance consistency test |
| AsyncLocalStorage context implementation | Backend Lead | Concurrency test |
| Worker context reconstruction | Backend Lead | Trace test |
| ADR set (12 ADRs) | Architecture | Documented |

### 3.8 Gate G1 Criteria

- [ ] All state machines have guard functions, not just transition arrays
- [ ] Every command has typed input, output, and idempotency key specification
- [ ] Database uniqueness constraints defined for all idempotency keys
- [ ] CI fails on layer violation (verified by attempting violation and confirming failure)
- [ ] Feature flag schema exists and migrations apply cleanly
- [ ] Feature flag cache is consistent across multiple instances (if Redis selected)
- [ ] AsyncLocalStorage context works with concurrent requests (load test)
- [ ] Worker context is reconstructed from event payload, not ambient context

---

## 4. Phase 2: Secure Initiation and Project Creation (Foundation)

**Duration:** 2 weeks (Weeks 5–6)
**Type:** IMPLEMENTATION
**Prerequisite:** G1 passed, Phase 0 queue decision integrated

### 4.1 Phase 2 Principle

Phase 2 implements the **minimum viable transactional foundation** for the golden path. Specifically:

- Minimal outbox schema and atomic persistence (foundation for Phase 3 worker)
- Project creation with full transaction atomicity
- Legacy isolation via aggregate ownership markers

Phase 2 does NOT implement:
- Outbox polling/worker (deferred to Phase 3)
- Retry/backoff logic (Phase 3)
- Dead-letter handling (Phase 3)

### 4.2 Minimal Outbox Foundation

#### 4.2.1 Outbox Schema

**File:** `src/infrastructure/database/prisma/migrations/xxxxx_outbox/schema.prisma`

```prisma
model OutboxEvent {
  id              String    @id @default(cuid())
  tenantId        String
  eventType       String
  aggregateType   String
  aggregateId     String
  payload         Json      // Schema-versioned event data
  schemaVersion   String    @default("1.0")
  
  // Correlation for distributed tracing
  correlationId   String
  causationId     String?   // ID of triggering event
  
  // Idempotency — prevents duplicate processing
  idempotencyKey  String
  uniquenessScope String    @default("global") // or "per-aggregate"
  
  // Lifecycle
  status          OutboxEventStatus @default(PENDING)
  attemptCount    Int       @default(0)
  maxAttempts     Int       @default(3)
  
  // Timing
  availableAt     DateTime  @default(now())
  lockedAt        DateTime?
  lockedBy        String?   // Worker instance ID
  processedAt     DateTime?
  lastErrorAt     DateTime?
  lastErrorCode   String?
  lastErrorSummary String?
  
  // Dead letter
  deadLetteredAt  DateTime?
  deadLetterReason String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([tenantId, status, availableAt])
  @@index([aggregateType, aggregateId])
  @@index([idempotencyKey, uniquenessScope], unique: true)
  @@index([status, lockedAt]) // For stale lease detection
  @@map("outbox_events")
}

enum OutboxEventStatus {
  PENDING
  PROCESSING
  COMPLETED
  DEAD_LETTERED
}
```

#### 4.2.2 Atomic Persistence API

**File:** `src/common/ports/outbox.port.ts`

```typescript
export interface IOutboxPort {
  // Execute domain work AND persist outbox event in SINGLE transaction
  // This is the core atomic operation
  executeWithOutbox<T>(
    work: (tx: TransactionClient) => Promise<T>,
    event: Omit<OutboxEventInput, 'idempotencyKey' | 'correlationId' | 'causationId' | 'tenantId'>,
    metadata: CommandMetadata,
  ): Promise<{ result: T; eventId: string; isReplay: boolean }>;
  
  // Mark event as processed (called after successful processing)
  acknowledge(eventId: string, tx?: TransactionClient): Promise<void>;
  
  // Mark as dead-lettered
  deadLetter(eventId: string, reason: string, tx?: TransactionClient): Promise<void>;
}

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  schemaVersion: string;
  availableAt: Date;
  maxAttempts?: number;
}
```

#### 4.2.3 Outbox Repository Implementation

**File:** `src/infrastructure/repositories/outbox.repository.ts`

```typescript
@Injectable()
export class OutboxRepository implements IOutboxPort {
  constructor(private readonly prisma: PrismaService) {}

  async executeWithOutbox<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    eventInput: OutboxEventInput,
    metadata: CommandMetadata,
  ): Promise<{ result: T; eventId: string; isReplay: boolean }> {
    const idempotencyKey = `${metadata.tenantId}:${eventInput.aggregateType}:${eventInput.aggregateId}:${eventInput.eventType}:${metadata.idempotencyKey}`;

    // Check for existing event with this idempotency key
    const existing = await this.prisma.outboxEvent.findUnique({
      where: { idempotencyKey_uniquenessScope: { idempotencyKey, uniquenessScope: 'global' } },
    });

    if (existing) {
      // Idempotent replay — return existing result
      if (existing.status === 'COMPLETED') {
        return { result: null as T, eventId: existing.id, isReplay: true };
      }
      if (existing.status === 'PROCESSING') {
        // Another worker is processing — wait or skip
        throw new Error('Event is currently being processed by another worker');
      }
    }

    // Execute domain work AND create outbox event atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create outbox event FIRST with PROCESSING status to claim it
      const event = await tx.outboxEvent.create({
        data: {
          tenantId: metadata.tenantId,
          eventType: eventInput.eventType,
          aggregateType: eventInput.aggregateType,
          aggregateId: eventInput.aggregateId,
          payload: eventInput.payload,
          schemaVersion: eventInput.schemaVersion,
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey,
          uniquenessScope: 'global',
          status: 'PENDING', // Start PENDING, worker claims with lock
          availableAt: eventInput.availableAt,
          maxAttempts: eventInput.maxAttempts ?? 3,
        },
      });

      // Execute domain work
      const workResult = await work(tx);

      return { workResult, eventId: event.id };
    });

    return { result: result.workResult, eventId: result.eventId, isReplay: false };
  }

  async acknowledge(eventId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });
  }

  async deadLetter(eventId: string, reason: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'DEAD_LETTERED',
        deadLetteredAt: new Date(),
        deadLetterReason: reason,
      },
    });
  }
}
```

### 4.3 Transactional Project Creation

**File:** `src/modules/projects/application/project-creation.service.ts`

```typescript
@Injectable()
export class ProjectCreationService {
  constructor(
    private readonly initiationRepo: IInitiationRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly outbox: IOutboxPort,
    private readonly stateMachine: InitiationStateMachine,
  ) {}

  async createFromApprovedInitiation(
    input: CreateProjectFromInitiationInput,
    metadata: CommandMetadata,
  ): Promise<CreateProjectFromInitiationResult> {
    // Execute entire operation atomically: initiation validation + 
    // project creation + linkage + state transition + outbox event
    const { result, eventId, isReplay } = await this.outbox.executeWithOutbox(
      async (tx) => {
        // 1. Load and lock initiation (with tenant scoping)
        const initiation = await this.initiationRepo.findByIdForUpdate(
          input.initiationId,
          metadata.tenantId,
          tx,
        );
        
        if (!initiation) {
          throw new NotFoundException('Initiation not found');
        }

        // 2. Validate initiation is in correct state
        if (initiation.status !== InitiationStatus.APPROVED) {
          throw new Error(`Initiation must be APPROVED, current: ${initiation.status}`);
        }

        // 3. Check if project already exists for this initiation (idempotency)
        const existingProject = await this.projectRepo.findByInitiationId(
          input.initiationId,
          tx,
        );
        
        if (existingProject) {
          // Return existing — this is an idempotent replay
          return {
            project: existingProject,
            initiation,
            isReplay: true,
          };
        }

        // 4. Create project
        const project = await this.projectRepo.create({
          tenantId: metadata.tenantId,
          name: input.projectName,
          description: input.projectDescription,
          customerId: input.customerId,
          targetDate: input.targetDate,
          initiationId: input.initiationId,
          // Project execution engine marker
          executionEngine: 'canonical',
          createdByActorId: metadata.actorId,
        }, tx);

        // 5. Transition initiation to MATERIALIZING
        await this.initiationRepo.transition(
          initiation.id,
          InitiationStatus.MATERIALIZING,
          tx,
        );

        // 6. Return result (no separate outbox event creation here — done by executeWithOutbox)
        return { project, initiation, isReplay: false };
      },
      // Outbox event
      {
        eventType: 'ProjectAutomationRequested',
        aggregateType: 'Project',
        aggregateId: 'RESOLVED_FROM_WORK_RESULT', // Resolved by callback
        payload: {}, // Built from work result
        schemaVersion: '1.0',
        availableAt: new Date(),
      },
      metadata,
    );

    // Extract project from nested result
    const { project, isReplay } = result as any;

    return {
      projectId: project.id,
      initiationId: input.initiationId,
      automationRequestId: eventId,
      correlationId: metadata.correlationId,
      isReplay,
    };
  }
}
```

### 4.4 Legacy Isolation via Ownership Markers

**File:** `src/modules/projects/domain/project.entity.ts`

```typescript
// Each project has an execution engine ownership marker
export enum ExecutionEngine {
  LEGACY = 'legacy',       // Created before canonical path existed
  CANONICAL = 'canonical', // Created through approved command path
}

export interface Project {
  // ... existing fields
  
  // Ownership marker for strangler pattern
  executionEngine: ExecutionEngine;
  
  // For legacy projects: which engine owns which aggregates
  legacyMetadata?: {
    createdAt: Date;
    hermesSessionId?: string;
    automationState?: string;
  };
}
```

**Routing logic:**

```typescript
@Injectable()
export class ProjectRoutingService {
  async routeMutation(
    projectId: string,
    mutationType: 'initiation' | 'automation' | 'execution',
    metadata: CommandMetadata,
  ): Promise<'legacy' | 'canonical'> {
    const project = await this.projectRepo.findById(projectId, metadata.tenantId);
    
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Explicit ownership takes precedence
    if (project.executionEngine === ExecutionEngine.CANONICAL) {
      return 'canonical';
    }
    
    if (project.executionEngine === ExecutionEngine.LEGACY) {
      // Legacy projects stay on legacy path
      // But must have explicit migration marker to move to canonical
      if (await this.hasMigrationMarker(projectId)) {
        return 'canonical';
      }
      return 'legacy';
    }

    // Default: use tenant-level flag
    const flagEnabled = await this.featureFlagService.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );
    
    return flagEnabled ? 'canonical' : 'legacy';
  }
}
```

### 4.5 Phase 2 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Outbox schema + migration | Backend Lead | Applied, queryable |
| Outbox repository with atomic persistence | Backend Lead | Transaction test |
| Project creation with full ACID transaction | Backend Lead | Rollback test |
| Initiation state machine implementation | Backend Lead | Transition tests |
| Ownership marker on Project | Backend Lead | Migration + query |
| Legacy routing with ownership markers | Backend Lead | Isolation test |
| Idempotency verified (duplicate approval) | Backend Lead | 20x approval test |

### 4.6 Gate G2 Criteria

- [ ] One approval creates exactly one project (20x test)
- [ ] Zero duplicate projects from concurrent approvals (concurrency test)
- [ ] No direct Prisma mutation from tools/controllers (CI enforcement)
- [ ] Project + outbox event committed atomically (failure injection)
- [ ] Refresh/relogin resolves to correct result (state recovery test)
- [ ] Legacy and canonical projects isolated (ownership marker test)
- [ ] Outbox event queryable and visible (manual verification)

---

## 5. Phase 3: Transactional Outbox and Durable Automation (Workers)

**Duration:** 2 weeks (Weeks 7–8)
**Type:** IMPLEMENTATION
**Prerequisite:** G2 passed

### 5.1 Phase 3 Principle

Phase 3 implements the **worker infrastructure** that processes outbox events durably. Building on Phase 2's outbox foundation.

### 5.2 Outbox Worker Lifecycle

**File:** `src/application/workers/outbox.worker.ts`

```typescript
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly POLL_INTERVAL_MS = 1000;
  private readonly LEASE_TIMEOUT_MS = 30000;  // 30 seconds
  private readonly STALE_LEASE_THRESHOLD_MS = 60000; // 1 minute
  private readonly MAX_ATTEMPTS = 3;
  private readonly BACKOFF_BASE_MS = 1000;
  
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly workerId: string;  // Unique per process instance

  constructor(
    private readonly outboxRepo: IOutboxRepository,
    private readonly eventRouter: IEventRouter,
    private readonly logger: Logger,
  ) {
    this.workerId = `${hostname()}:${process.pid}:${crypto.randomUUID()}`;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Outbox worker starting: ${this.workerId}`);
    await this.recoverStaleLeases();  // Recover from previous crashes
    this.startPolling();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Outbox worker stopping: ${this.workerId}`);
    this.stopPolling();
    await this.releaseMyLeases();  // Release so other workers can pick up
  }

  private startPolling(): void {
    this.isRunning = true;
    this.poll();
  }

  private stopPolling(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Claim available events using lease mechanism
      const events = await this.claimAvailableEvents();
      
      // Process each event
      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error('Poll cycle failed', error);
    } finally {
      // Schedule next poll
      if (this.isRunning) {
        this.pollTimer = setTimeout(() => this.poll(), this.POLL_INTERVAL_MS);
      }
    }
  }

  private async claimAvailableEvents(): Promise<OutboxEvent[]> {
    const now = new Date();
    
    // Find PENDING events that are available and not locked, then atomically claim them
    // Uses row-level locking with FOR UPDATE SKIP LOCKED
    return this.outboxRepo.findAndClaimAvailable({
      maxCount: 10,
      availableBefore: now,
      leaseTimeoutMs: this.LEASE_TIMEOUT_MS,
      workerId: this.workerId,
      staleThresholdMs: this.STALE_LEASE_THRESHOLD_MS,
    });
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    const logContext = { eventId: event.id, eventType: event.eventType, workerId: this.workerId };
    
    try {
      this.logger.log(`Processing event`, logContext);

      // Route to handler
      const handler = this.eventRouter.getHandler(event.eventType);
      if (!handler) {
        throw new Error(`No handler registered for event type: ${event.eventType}`);
      }

      // Build worker context from event
      const workerContext = createWorkerContext(event);

      // Execute handler with timeout
      await this.executeWithTimeout(
        () => handler(workerContext, event.payload),
        30000, // 30 second timeout per event
      );

      // Mark as completed
      await this.outboxRepo.markCompleted(event.id);
      
      this.logger.log(`Event processed successfully`, logContext);

    } catch (error) {
      await this.handleProcessingError(event, error);
    }
  }

  private async handleProcessingError(event: OutboxEvent, error: unknown): Promise<void> {
    const newAttemptCount = event.attemptCount + 1;
    const logContext = { eventId: event.id, attemptCount: newAttemptCount };

    if (newAttemptCount >= event.maxAttempts) {
      // Max retries exceeded — move to dead letter
      await this.outboxRepo.markDeadLetter(
        event.id,
        `Max attempts (${event.maxAttempts}) exceeded: ${error.message}`,
      );
      this.logger.warn(`Event moved to dead letter`, logContext);
    } else {
      // Calculate backoff with jitter
      const backoffMs = this.BACKOFF_BASE_MS * Math.pow(2, newAttemptCount - 1);
      const jitter = Math.random() * 1000;
      const nextAvailableAt = new Date(Date.now() + backoffMs + jitter);

      await this.outboxRepo.scheduleRetry(event.id, newAttemptCount, nextAvailableAt);
      this.logger.warn(`Event scheduled for retry`, { ...logContext, nextAvailableAt });
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Event processing timeout')), timeoutMs)
      ),
    ]);
  }

  private async recoverStaleLeases(): Promise<void> {
    // Find leases that have expired (worker died)
    const staleCount = await this.outboxRepo.releaseStaleLeases(
      this.workerId,
      this.STALE_LEASE_THRESHOLD_MS,
    );
    if (staleCount > 0) {
      this.logger.log(`Recovered ${staleCount} stale leases`);
    }
  }

  private async releaseMyLeases(): Promise<void> {
    await this.outboxRepo.releaseLeasesByWorker(this.workerId);
  }
}
```

### 5.3 Project Automation Worker

**File:** `src/modules/project-automation/automation.worker.ts`

```typescript
@Injectable()
export class ProjectAutomationWorker {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly goalFactory: IGoalFactory,
    private readonly taskFactory: ITaskFactory,
    private readonly assignmentService: IAssignmentService,
    private readonly outbox: IOutboxPort,
    private readonly logger: Logger,
  ) {}

  async handleProjectAutomationRequested(
    ctx: WorkerContext,
    payload: ProjectAutomationPayload,
  ): Promise<void> {
    const { projectId } = payload;
    this.logger.log(`Processing automation for project ${projectId}`, { projectId, correlationId: ctx.correlationId });

    // Each generated entity uses deterministic template keys
    // This enables per-item upsert idempotency

    // 1. Generate and persist goals
    const goalTemplates = await this.goalFactory.getTemplatesForProject(projectId);
    const goalResults = await Promise.all(
      goalTemplates.map(template => this.createGoalIdempotently(projectId, template, ctx))
    );

    // 2. Generate and persist tasks
    const taskTemplates = await this.taskFactory.getTemplatesForProject(projectId);
    const taskResults = await Promise.all(
      taskTemplates.map(template => this.createTaskIdempotently(projectId, template, ctx))
    );

    // 3. Create assignment requests (not auto-assigned in Phase 4)
    for (const task of taskResults) {
      await this.requestAssignment(task.id, ctx);
    }

    // 4. Update project automation status
    await this.projectRepo.updateAutomationStatus(
      projectId,
      ProjectAutomationStatus.COMPLETED,
      {
        goalsCreated: goalResults.length,
        tasksCreated: taskResults.length,
      },
    );
  }

  private async createGoalIdempotently(
    projectId: string,
    template: GoalTemplate,
    ctx: WorkerContext,
  ): Promise<Goal> {
    // Deterministic key based on project + template
    const templateKey = `${projectId}:goal:${template.goalKey}`;
    
    return this.goalRepo.upsert({
      where: { projectId_templateKey: { projectId, templateKey } },
      create: {
        projectId,
        templateKey,
        name: template.name,
        description: template.description,
        createdByActorId: ctx.actorId,
        correlationId: ctx.correlationId,
      },
      update: {
        // If exists, update only mutable fields; immutable fields unchanged
        description: template.description,
      },
    });
  }

  private async requestAssignment(
    taskId: string,
    ctx: WorkerContext,
  ): Promise<void> {
    // Emit assignment requested event — actual assignment happens in Phase 4
    // This is a fire-and-forget to outbox; assignment worker handles it
    await this.outbox.persist(
      {
        eventType: 'TaskAssignmentRequested',
        aggregateType: 'Task',
        aggregateId: taskId,
        payload: { taskId, requestedBy: ctx.actorId },
        schemaVersion: '1.0',
        availableAt: new Date(),
      },
      ctx,
    );
  }
}
```

### 5.4 Event Router

**File:** `src/application/workers/event-router.ts`

```typescript
export interface IEventRouter {
  getHandler(eventType: string): EventHandler | null;
  register(eventType: string, handler: EventHandler): void;
}

type EventHandler = (ctx: WorkerContext, payload: unknown) => Promise<void>;

@Injectable()
export class EventRouter implements IEventRouter {
  private handlers = new Map<string, EventHandler>();

  getHandler(eventType: string): EventHandler | null {
    return this.handlers.get(eventType) ?? null;
  }

  register(eventType: string, handler: EventHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`Handler already registered for event type: ${eventType}`);
    }
    this.handlers.set(eventType, handler);
  }
}

// Registration in module
@Module({
  providers: [
    EventRouter,
    ProjectAutomationWorker,
    {
      provider: 'EVENT_ROUTER_CONFIG',
      useFactory: (router: EventRouter, automationWorker: ProjectAutomationWorker) => {
        router.register('ProjectAutomationRequested', (ctx, payload) => 
          automationWorker.handleProjectAutomationRequested(ctx, payload as ProjectAutomationPayload)
        );
      },
      inject: [EventRouter, ProjectAutomationWorker],
    },
  ],
})
export class AutomationModule {}
```

### 5.5 Phase 3 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Outbox worker with polling | Backend Lead | Startup test |
| Lease mechanism with row locking | Backend Lead | Concurrent test |
| Stale lease recovery | Backend Lead | Crash simulation |
| Exponential backoff with jitter | Backend Lead | Retry test |
| Dead letter handling | Backend Lead | Max retry test |
| Project automation worker | Backend Lead | E2E test |
| Per-item upsert idempotency | Backend Lead | Duplicate delivery test |
| Event router with handler registration | Backend Lead | Handler lookup test |
| Worker lifecycle (init/destroy) | Backend Lead | Graceful shutdown test |

### 5.6 Gate G3 Criteria

- [ ] Worker survives restart (checkpointer resumes)
- [ ] Duplicate outbox delivery produces no duplicate goals/tasks (idempotency test)
- [ ] Every failure is visible with retry scheduled or dead-lettered (visibility test)
- [ ] Project never half-initialized after worker crash (recovery test)
- [ ] Dead-letter events are queryable and replayable (manual verification)
- [ ] Concurrent workers do not process same event (race condition test)

---

## 6. Phase 4: Task-to-AI Assignment

**Duration:** 1.5 weeks (Weeks 9–10)
**Type:** IMPLEMENTATION
**Prerequisite:** G3 passed

### 6.1 Assignment Service with Concurrency Control

**File:** `src/modules/assignments/application/assignment.service.ts`

```typescript
@Injectable()
export class AssignmentService {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly outbox: IOutboxPort,
  ) {}

  async assignTask(
    input: AssignTaskInput,
    metadata: CommandMetadata,
  ): Promise<AssignmentResult> {
    // Use optimistic concurrency to prevent race conditions
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.executeAssignment(input, metadata);
      } catch (error) {
        if (error.code === 'P2034' && attempt < MAX_RETRIES - 1) {
          // Optimistic lock failure — retry
          await this.randomBackoff(attempt);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Assignment failed after max retries due to concurrent modification');
  }

  private async executeAssignment(
    input: AssignTaskInput,
    metadata: CommandMetadata,
  ): Promise<AssignmentResult> {
    // 1. Load eligible agents with row lock
    const eligibleAgents = await this.agentRepo.findEligibleForTask(
      input.taskId,
      metadata.tenantId,
      {
        role: input.requiredRole,
        capabilities: input.requiredCapabilities,
        concurrencyLimit: 1, // Reserve one slot
      },
    );

    if (eligibleAgents.length === 0) {
      throw new NoEligibleAgentError(input.taskId);
    }

    // 2. Score and rank (deterministic)
    const scored = this.scoreAgents(eligibleAgents, input);
    
    // 3. Select best agent
    const selected = scored[0];

    // 4. Create assignment with version check
    const assignment = await this.taskRepo.assignAgent(
      input.taskId,
      selected.agentId,
      {
        version: input.expectedVersion, // Optimistic lock
        rationale: this.buildRationale(selected),
        scoredBy: scored.map(s => ({ agentId: s.agentId, score: s.score })),
      },
      metadata,
    );

    // 5. Emit TaskAssigned event
    await this.outbox.persist(
      {
        eventType: 'TaskAssigned',
        aggregateType: 'Task',
        aggregateId: input.taskId,
        payload: {
          taskId: input.taskId,
          agentId: selected.agentId,
          rationale: selected.rationale,
        },
        schemaVersion: '1.0',
        availableAt: new Date(),
      },
      metadata,
    );

    return assignment;
  }

  private scoreAgents(agents: Agent[], input: AssignTaskInput): ScoredAgent[] {
    return agents.map(agent => ({
      agentId: agent.id,
      score: this.calculateScore(agent, input),
      rationale: this.explainScore(agent, input),
    })).sort((a, b) => b.score - a.score);
  }
}
```

### 6.2 Phase 4 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Assignment service with optimistic locking | Backend Lead | Concurrency test |
| Agent eligibility filtering | Backend Lead | Filter tests |
| Scoring and ranking | Backend Lead | Score consistency test |
| No-eligible-agent error handling | Backend Lead | Edge case test |
| Assignment persistence with version | Backend Lead | Race condition test |
| Agent picker UI | Frontend Lead | UX test |

### 6.3 Gate G4 Criteria

- [ ] Golden task assigned to exactly one eligible agent (20x test)
- [ ] Concurrent assignment requests do not double-assign (race test)
- [ ] Users do not enter UUIDs manually (UX verification)
- [ ] Assignment rationale persisted and visible (UI test)
- [ ] Cross-tenant assignment rejected (security test)

---

## 7. Phase 5: Governed Execution Runtime

**Duration:** 3–4 weeks (Weeks 11–14)
**Type:** IMPLEMENTATION
**Prerequisite:** G4 passed

### 7.1 Phase 5 Principle

> **Phase 5 requires a separate detailed technical design before implementation.** This plan provides the architectural direction only.

### 7.2 Execution Design Direction

#### Atomic Attempt + Event Creation

The execution attempt creation and `TaskExecutionRequested` outbox event MUST be committed in the same transaction:

```typescript
async requestExecution(
  input: RequestExecutionInput,
  metadata: CommandMetadata,
): Promise<ExecutionAttempt> {
  return this.outbox.executeWithOutbox(
    async (tx) => {
      // Create attempt
      const attempt = await this.attemptRepo.create({
        taskId: input.taskId,
        agentId: input.agentId,
        status: ExecutionAttemptStatus.CREATED,
        // ... immutable snapshot fields
      }, tx);

      // Transition task to ASSIGNED
      await this.taskRepo.transition(input.taskId, TaskStatus.ASSIGNED, tx);

      return attempt;
    },
    {
      eventType: 'TaskExecutionRequested',
      aggregateType: 'ExecutionAttempt',
      aggregateId: attemptId, // resolved from work result
      payload: { attemptId, taskId: input.taskId, agentId: input.agentId },
      schemaVersion: '1.0',
      availableAt: new Date(),
    },
    metadata,
  );
}
```

#### Stable Attempt Identification

Attempts are NOT identified by sequence number. Instead:

- Each execution request carries a `revisionId`
- Attempt = taskId + revisionId
- RevisionId is explicitly provided by the review/approval flow on revision requests

#### Immutable Snapshots

When an attempt is created, it snapshots:
- Task instructions (immutable copy)
- Project context (point-in-time)
- Policy at creation time
- Approved inputs

Changes to these after attempt creation do not affect the running attempt.

### 7.3 Phase 5 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Execution attempt + event atomic creation | Backend Lead | Failure injection test |
| Stable attempt ID (revision-based) | Backend Lead | Revision test |
| Immutable policy/input snapshots | Backend Lead | Mutation test |
| Concurrency controls (tenant/agent) | Backend Lead | Load test |
| Timeout and stale detection | Backend Lead | Timeout test |
| Evidence artifact persistence | Backend Lead | Review test |
| Circuit breaker for tools/providers | Backend Lead | Failure injection |

### 7.4 Gate G5 Criteria

- [ ] One assignment creates exactly one attempt (no orphaned attempts)
- [ ] Worker restart does not lose or duplicate attempt (restart test)
- [ ] Missing inputs produce NEEDS_INPUT state (not silent fabrication)
- [ ] Evidence artifact persisted and linked to attempt
- [ ] Task reaches NEEDS_REVIEW
- [ ] No AI can approve its own work

---

## 8. Phase 6: Human Review, Revision, and Lifecycle

**Duration:** 1.5 weeks (Weeks 15–16)
**Type:** IMPLEMENTATION
**Prerequisite:** G5 passed

### 8.1 Atomic Review Transaction

**File:** `src/modules/reviews/application/review.service.ts`

```typescript
@Injectable()
export class ReviewService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly lifecycleService: ILifecycleService,
    private readonly outbox: IOutboxPort,
  ) {}

  async submitReview(
    input: ReviewInput,
    metadata: CommandMetadata,
  ): Promise<ReviewResult> {
    // All operations in single transaction
    return this.outbox.executeWithOutboxAtomic(
      async (tx) => {
        // 1. Validate reviewer authorization
        const reviewerAuth = await this.validateReviewer(metadata.actorId, input.taskId);
        if (!reviewerAuth.authorized) {
          throw new UnauthorizedReviewError(reviewerAuth.reason);
        }

        // 2. Create review decision record
        const review = await this.reviewRepo.create({
          taskId: input.taskId,
          executionAttemptId: input.executionAttemptId,
          reviewerId: metadata.actorId,
          decision: input.decision,
          comment: input.comment,
          correlationId: metadata.correlationId,
        }, tx);

        // 3. Apply decision to task
        switch (input.decision) {
          case ReviewDecision.APPROVED:
            await this.taskRepo.transition(
              input.taskId,
              TaskStatus.APPROVED,
              tx,
            );
            await this.taskRepo.transition(
              input.taskId,
              TaskStatus.COMPLETED,
              tx,
            );
            
            // 4. Check if project should advance
            await this.evaluateProjectLifecycle(input.taskId, tx);
            break;

          case ReviewDecision.REVISION_REQUESTED:
            // Emit new execution request with revision context
            await this.outbox.persistInternal(
              {
                eventType: 'TaskRevisionRequested',
                aggregateType: 'Task',
                aggregateId: input.taskId,
                payload: {
                  taskId: input.taskId,
                  priorAttemptId: input.executionAttemptId,
                  instructions: input.revisionInstructions,
                  revisionReason: input.comment,
                },
                schemaVersion: '1.0',
                availableAt: new Date(),
              },
              tx,
            );
            break;

          case ReviewDecision.REJECTED:
            await this.taskRepo.transition(
              input.taskId,
              TaskStatus.FAILED_FINAL,
              tx,
            );
            break;
        }

        return review;
      },
      // No external outbox event needed — all contained in transaction
      metadata,
    );
  }

  private async evaluateProjectLifecycle(
    taskId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const task = await this.taskRepo.findById(taskId, tx);
    const project = await this.projectRepo.findById(task.projectId, tx);

    // Check if all mandatory tasks are complete
    const pendingMandatory = await this.taskRepo.countPendingMandatory(
      project.id,
      tx,
    );

    if (pendingMandatory === 0) {
      // Advance to REVIEW stage
      await this.projectRepo.transition(
        project.id,
        ProjectStage.REVIEW,
        tx,
      );
    }
  }
}
```

### 8.2 Phase 6 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Review decision persisted atomically | Backend Lead | Transaction test |
| Task state transitions via state machine | Backend Lead | Transition test |
| Project lifecycle evaluation | Backend Lead | Completion guard test |
| Revision creates linked attempt | Backend Lead | Linkage test |
| Waiver requires structured permission | Backend Lead | Waiver test |

### 8.3 Gate G6 Criteria

- [ ] Reviewer identity and decision persisted
- [ ] Revision produces distinguishable new attempt
- [ ] Prior evidence immutable
- [ ] Approval advances task AND project stage
- [ ] Project completion guard enforced
- [ ] State persists after refresh/relogin

---

## 9. Phase 7: Execution UX and Unified Timeline

**Duration:** 1.5 weeks (Weeks 17–18)
**Type:** IMPLEMENTATION
**Prerequisite:** G6 passed

### 9.1 Required UI Surfaces

| Surface | Priority | Backend Contract |
|---------|----------|-----------------|
| Enterprise initiation status | P0 | `GET /initiations/:id` with state |
| Project automation status | P0 | `GET /projects/:id/automation` |
| Project task board | P0 | `GET /projects/:id/tasks` |
| AI assignment picker | P0 | `GET /agents/eligible?taskId=` |
| Execution attempt detail | P0 | `GET /attempts/:id` with evidence |
| Evidence viewer | P0 | `GET /evidence/:id/download` |
| Review inbox | P0 | `GET /reviews/pending` |
| Unified activity timeline | P1 | `GET /timeline?entityType=&entityId=` |
| Retry/cancel controls | P1 | `POST /tasks/:id/retry` |
| Failure recovery guidance | P1 | Inline from state |

### 9.2 Backend-Provided Capability Contract

**File:** `src/modules/projects/application/project-capability.service.ts`

```typescript
@Injectable()
export class ProjectCapabilityService {
  async getProjectCapabilities(
    projectId: string,
    tenantId: string,
  ): Promise<ProjectCapabilities> {
    const project = await this.projectRepo.findById(projectId, tenantId);
    
    return {
      automationState: this.classifyAutomationState(project),
      executionEngine: project.executionEngine,
      canRequestAutomation: project.executionEngine === 'canonical' && 
                           project.automationState === 'not_requested',
      canAutoAssign: await this.featureFlagService.isEnabled(
        FeatureFlag.AUTO_ASSIGNMENT,
        tenantId,
      ),
      canAutoExecute: await this.featureFlagService.isEnabled(
        FeatureFlag.AUTONOMOUS_EXECUTION,
        tenantId,
      ),
      requiresHumanReview: true, // L1 autonomy always requires review
      legacyMigrationAvailable: project.executionEngine === 'legacy',
    };
  }

  private classifyAutomationState(project: Project): AutomationStateLabel {
    if (project.executionEngine === ExecutionEngine.LEGACY) {
      return 'legacy_project';
    }
    
    if (!project.automationRequestedAt) {
      return 'automation_ready';
    }
    
    if (project.automationStatus === ProjectAutomationStatus.PROCESSING) {
      return 'setup_in_progress';
    }
    
    if (project.automationStatus === ProjectAutomationStatus.COMPLETED) {
      return 'automation_ready'; // Can request new automation
    }
    
    if (project.automationStatus === ProjectAutomationStatus.PARTIAL) {
      return 'setup_incomplete';
    }
    
    if (project.automationStatus === ProjectAutomationStatus.FAILED_FINAL) {
      return 'automation_failed';
    }
    
    return 'unknown';
  }
}
```

### 9.3 Phase 7 Deliverables

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| All P0 UI surfaces implemented | Frontend Lead | E2E test |
| Backend capability contract | Backend Lead | Contract test |
| Unified timeline events | Backend Lead | Event completeness test |
| Retry/cancel controls functional | Frontend Lead | Action test |
| Socket.IO with polling fallback | Frontend Lead | Disconnect test |

### 9.4 Gate G7 Criteria

- [ ] All P0 surfaces implemented and functional
- [ ] No dead UI controls
- [ ] Timeline shows all golden path events
- [ ] UI correct with socket disabled
- [ ] Error messages explain recovery

---

## 10. Phase 8: Security, Observability, and Operations

**Duration:** 2–3 weeks (Weeks 19–21, concurrent with Phase 3-7)

### 10.1 Parallel Workstream

Security and observability are NOT sequential phases. They are parallel workstreams:

| Workstream | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 |
|------------|---------|---------|---------|---------|---------|---------|---------|---------|
| Core implementation | I | I | I | I | I | I | I | I |
| Test infrastructure | D | B | B+ | B+ | B+ | B+ | B+ | I |
| Security enforcement | — | D | B | B+ | B+ | B+ | B+ | I |
| Observability | — | D | B | B+ | B+ | B+ | B+ | I |

Legend: D = Design, B = Building, I = Implementing/Completing

### 10.2 Security Checklist

| Check | Implementation |
|-------|---------------|
| Tenant isolation at every hop | Repository queries always include tenantId |
| Role/permission matrix | Policy service evaluates before mutation |
| Tool allowlists | ToolGateway validates per task policy |
| Cross-tenant rejection | Integration test suite |
| Audit immutability | Append-only audit table with trigger |

### 10.3 Phase 8 Gate G8

- [ ] Security test suite passes (no cross-tenant leaks)
- [ ] Runbooks reviewed and tested
- [ ] Metrics dashboard operational
- [ ] Alerting configured for stuck/backlogged work

---

## 11. Phase 9: Certification

**Duration:** 1.5 weeks (Weeks 22–23)

### 11.1 Certification Infrastructure (Parallel Track from Phase 0)

| Stage | Test Infrastructure Outcome |
|-------|---------------------------|
| Phase 0 | Design, environment strategy, tenant provisioning strategy |
| Phase 1 | Deterministic tenant fixture + synthetic accounting data |
| Phase 2 | Duplicate submission and state recovery fixtures |
| Phase 3 | Worker restart, duplicate delivery, outbox failure injection |
| Phase 5 | Provider/tool/cancellation/budget failure injection |
| Phase 6 | Revision and review fixtures |
| Phase 7 | Browser automation with socket-disabled variant |
| Phase 8 | Dashboard, trace correlation, operational exercises |
| Phase 9 | Execute certification (NOT build prerequisites) |

### 11.2 Phase 9 Gate G9

See roadmap for full certification criteria.

---

## 12. Phase 10: Controlled Expansion

**Start Condition:** G9 passed and stable

Expansion order per roadmap.

---

## 13. Corrected Schedule

| Week | Primary Workstream | Test Infrastructure | Security/Ops |
|------|-------------------|---------------------|---------------|
| 1–2 | Phase 0: Investigation | Design | — |
| 3–4 | Phase 1: Contracts | Build fixtures | Design |
| 5–6 | Phase 2: Project creation foundation | Build fixtures | Build |
| 7–8 | Phase 3: Worker infrastructure | Build | Build |
| 9–10 | Phase 4: Assignment | Integrate | Integrate |
| 11–14 | Phase 5: Execution runtime | Inject failures | Integrate |
| 15–16 | Phase 6: Review + lifecycle | Complete | Complete |
| 17–18 | Phase 7: UX + timeline | Complete | Complete |
| 19–21 | Phase 8: Security + ops | Dashboard | Complete |
| 22–23 | Phase 9: Certification | Execute | — |
| 24+ | Phase 10: Expansion | Ongoing | Ongoing |

**Total: 17–21 weeks with parallel workstreams**

---

## 14. Outstanding Technical Designs (Required Before Implementation)

The following require separate detailed technical designs before Phase 5 implementation:

| Design | Required Before | Owner |
|--------|----------------|-------|
| Execution runtime detailed spec | Phase 5 | Backend/AI Lead |
| LangGraph integration design | Phase 5 | AI/Architecture |
| Evidence artifact storage | Phase 5 | Backend Lead |
| Circuit breaker configuration | Phase 5 | Backend Lead |
| Cancellation token design | Phase 5 | Backend Lead |

---

## 15. Document Quality Checklist

- [x] No "APPROVED — Ready for Execution" claim
- [x] No "100% SOLID" claim
- [x] No "Zero Duplication" claim
- [x] No "Zero Errors" claim
- [x] Phase 0 is investigation-only
- [x] Clean architecture dependency rules
- [x] Stable domain-based idempotency keys
- [x] Atomic transaction specifications
- [x] AsyncLocalStorage + worker context propagation
- [x] Phase 2 includes minimum outbox foundation
- [x] Per-item upsert for automation idempotency
- [x] Transactional assignment with optimistic locking
- [x] Certification infrastructure parallel track
- [x] Week ranges instead of day ranges
- [x] No duplicate sections

---

**Document End — NC-AWL-IMP-1 v1.1 — DRAFT**
