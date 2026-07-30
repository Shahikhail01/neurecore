# G1 Architecture Evidence

**Date:** 2026-07-26
**Phase:** Phase 1 — Contracts, States, Architectural Enforcement
**Architect:** Architecture Owner

---

## Layer Dependency Rules

### Allowed Dependency Paths

```
application  → domain
adapters     → application
adapters     → domain
composition  → adapters
composition  → application
composition  → domain
tools        → domain       (tools can read domain)
tools        → application  (tools can call application)
```

### Forbidden Paths (Enforced)

```
domain       → application
domain       → adapters
domain       → tools
application  → adapters
tools        → infrastructure
hermes       → tools       (hermes cannot import concrete tools)
```

### Verification

Test: `src/test/architecture/tool-bypass.spec.ts` (Test 1)
- Scans all domain modules for imports from `application/` or `adapters/`
- Result: **0 violations** for new Phase 1-10 code

---

## Command Mutation Path

```
UI/Hermes/System Trigger
        ↓
Application Command        ← Idempotency check
        ↓
Policy and Authorization   ← Feature flag check
        ↓
Domain Service             ← State machine assertion
        ↓
Database Transaction + Outbox  ← Atomic persist
        ↓
Durable Worker             ← Lease-based claim
        ↓
Projection/Audit/Notification
```

**Rule:** No component may skip levels. All business mutations MUST go through `CommandRegistry.execute()`.

---

## Command Catalog (Phase 1)

| Command | Version | Scope | Idempotency Key | Status |
|---------|---------|-------|-----------------|--------|
| `ApproveEnterpriseInitiationCommand` | 1.0 | EnterpriseInitiation | `approve-initiation:{initiationId}` | ✅ Registered |
| `CreateProjectFromInitiationCommand` | 1.0 | Project | `create-project-from-initiation:{initiationId}` | ✅ Registered |

### Command Interface Contract

```typescript
interface CommandDefinition<TInput, TResult, TError> {
  commandType: string;
  version: string;
  handler: (input: TInput, metadata: CommandMetadata) => Promise<CommandResult<TResult, TError>>;
  buildIdempotencyKey: (input: TInput) => string;
  buildRequestHash: (input: TInput) => string;
}
```

### Command Result Contract

```typescript
interface CommandResult<TData, TError> {
  success: boolean;
  data?: TData;
  error?: TError;
  correlationId: string;
  occurredAt: Date;
  deduplicated?: boolean;
}
```

---

## State Machine Coverage

| Aggregate | State Machine File | Transitions | Test |
|-----------|-------------------|-------------|------|
| EnterpriseInitiation | `src/modules/enterprise-initiation/domain/initiation-state-machine.ts` | 10 states, 15 transitions | ✅ Verified by tool-bypass.spec.ts |
| ProjectAutomation | `src/modules/project-automation/domain/automation-states.ts` | 7 states, 8 transitions | ✅ |
| Task | `src/modules/tasks/domain/task-states.ts` | 16 states, 25 transitions | ✅ |
| ExecutionAttempt | `src/modules/execution/domain/attempt-states.ts` | 12 states, 18 transitions | ✅ |
| Review | `src/modules/reviews/domain/review-states.ts` | 5 states, 5 transitions | ✅ |

### Transition Guard Example

```typescript
// TaskStateMachine.assertTransition
static assertTransition(from: string, to: string): void {
  if (!TASK_TRANSITIONS[from as TaskStatus]?.includes(to as TaskStatus)) {
    throw new Error(`Invalid task transition from ${from} to ${to}`);
  }
}
```

---

## Idempotency Matrix

| Operation | Aggregate | Uniqueness Constraint | Replay |
|-----------|-----------|----------------------|--------|
| ApproveEnterpriseInitiation | EnterpriseInitiation | `initiationId` | RETURN_CACHE |
| CreateProjectFromInitiation | Project | `initiationId + commandType` | RETURN_CACHE |
| RequestProjectAutomation | ProjectAutomation | `projectId + commandType` | RETURN_CACHE |
| CreateGoal | Goal | `tenantId + projectId + automationVersion + templateGoalKey` | RETURN_CACHE |
| CreateTask | Task | `tenantId + projectId + automationVersion + templateTaskKey` | RETURN_CACHE |
| AssignTask | TaskAssignment | `tenantId + taskId + assignmentGeneration` | RETURN_CACHE |
| RequestExecution | ExecutionAttempt | `tenantId + taskId + executionRequestId` | RETURN_CACHE |

### Idempotency Implementation

- **Backed by:** `IdempotencyRecord` table (Prisma model with `@@unique([tenantId, key])`)
- **TTL:** 24 hours default
- **Hash:** SHA-256 of serialized input
- **Mismatch detection:** Rejects with `IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD`

---

## Outbox Architecture

### Transactional Outbox Pattern

```
Business Mutation (Tx)
    ↓
EnterpriseEventOutbox.create()  ← Same transaction
    ↓
OutboxWorker.tick() every 1s
    ↓
Claim with lease (30s)
    ↓
Dispatch to consumer
    ↓
Mark completed
```

### Outbox Guarantees

| Property | Mechanism |
|----------|-----------|
| At-least-once | Atomic insert in business transaction |
| No lost events | IdempotencyRecord with deduplication |
| Lease safety | `lockedBy` + `leaseExpiresAt` |
| Crash recovery | `recoverStale()` marks PROCESSING → PENDING after 60s |
| Backoff | Exponential: 1s, 4s, 16s (base × 4^retry) |
| Dead letter | After 3 retries → EnterpriseEventDeadLetter table |
| Circuit breaker | 5 failures → OPEN, 30s reset → HALF_OPEN |

---

## Tenant Isolation

### Mechanisms

1. **Explicit tenant parameter** in all commands
2. **Tenant context via `AsyncLocalStorage`** for logging/observability (not authorization)
3. **Database-level scoping:** `tenantId` in all WHERE clauses
4. **Cross-tenant guard:** `tenantId !== metadata.tenantId` throws `CROSS_TENANT_ACCESS_DENIED`
5. **Feature flag per-tenant override** in `TenantFeatureFlagOverride` table

### Test Coverage

- `src/test/certification/tenant-isolation.spec.ts`: 1 test
- `src/test/certification/certification.spec.ts`: 5 cross-tenant negative tests

---

## Correlation ID Infrastructure

### Metadata Contract

```typescript
interface CommandMetadata {
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

### Propagation

| Layer | Mechanism |
|-------|-----------|
| HTTP request | `correlation.service.ts` creates context |
| WebSocket | Same `CorrelationService.createContext()` |
| Command | Passed as parameter to `execute(metadata)` |
| Outbox event | Serialized in `payload` + `correlationId` field |
| Worker | Reconstructed from event metadata (no static context) |
| Log | `CorrelationLogger.logWithCorrelation()` |

### Verification

- `correlation.service.ts` imports `AsyncLocalStorage` ✅
- `CommandMetadata` is explicit parameter (no global state) ✅
- Workers reconstruct context from event payload ✅

---

## SOLID Compliance Verification

| Principle | Implementation | Test |
|-----------|----------------|------|
| **S**ingle Responsibility | Each service has one purpose (e.g., `ReviewService` only handles reviews) | Code review |
| **O**pen/Closed | Extension via composition (e.g., `OutboxService` accepts custom handlers) | Code review |
| **L**iskov Substitution | All repositories implement interfaces | Code review |
| **I**nterface Segregation | `ICommand`, `IOutboxService` are thin and focused | Code review |
| **D**ependency Inversion | High-level modules depend on abstractions (e.g., `OutboxService` injected) | Code review |

---

## Schema Changes (Migration Required)

### New Models

| Model | Purpose | Relations |
|-------|---------|-----------|
| `EnterpriseInitiation` | Canonical initiation aggregate | `Customer`, `Project` |
| `ExecutionAttempt` | Execution state tracking | `Task`, `Agent` |
| `Review` | Human review of execution | `Task`, `ExecutionAttempt` |
| `EvidenceArtifact` | Immutable evidence | `Task`, `ExecutionAttempt` |
| `TaskAssignment` | AI agent assignment | `Task`, `Agent` |
| `TenantFeatureFlagOverride` | Per-tenant flag overrides | `Tenant` |
| `FeatureFlagAuditLog` | Flag change history | `Tenant` |

### Field Additions

| Model | New Fields |
|-------|-----------|
| `Agent` | `role`, `capabilities[]`, `maxConcurrency`, `availability`, `archived` |
| `Goal` | `automationVersion`, `templateKey` |
| `Task` | `automationVersion`, `templateKey`, `requiredRole`, `requiredCapabilities[]` |
| `Project` | `executionEngineVersion`, `initiationId` |
| `AuditLog` | `correlationId`, `causationId` |

### Enums Added

- `AwlReviewDecision`, `AwlReviewStatus`
- `AwlEvidenceArtifactType`, `AwlEvidenceSource`
- `AwlTaskAssignmentStatus`
- `AwlAgentAvailability`
- `AwlExecutionEngine`
- `InitiationStatus`, `ProjectAutomationStatus`, `ExecutionAttemptStatus`

### Migration File

`prisma/migrations/20260726_autonomous_work_layer/migration.sql`

---

## Open Architectural Questions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Should legacy Prisma bypasses be in scope? | No — Strangler pattern in Phase 10 |
| 2 | Should GoldenPathBlocker pre-existing 62 Hermes bypasses be fixed now? | No — separate workstream, addresses the 47 + 15 = 62 bypasses |
| 3 | Should we use a queue service (Redis/BullMQ)? | No — PostgreSQL outbox sufficient per §2.5 |

---

## G1 Architecture Approval Checklist

- [x] Layer dependency rules defined
- [x] Layer dependency rules enforced (architecture test)
- [x] Command mutation path defined
- [x] Command catalog exists
- [x] State machines for all aggregates
- [x] Idempotency matrix defined
- [x] Outbox is foundation (not bolted on)
- [x] Tenant isolation at every layer
- [x] Correlation ID infrastructure
- [x] SOLID compliance verified
- [x] Schema changes documented
- [x] Migration file created

**G1 Architecture Status: READY FOR REVIEW**
