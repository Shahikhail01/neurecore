# NeuroCore Architecture Decision Records — Phase 0

**Date:** 2026-07-13 16:30 PKT
**Status:** DRAFT — Submitted for Architectural Review
**Basis:** Enterprise Integration Architecture Audit + Amendment Directives
**Referenced documents:**
- `enterprise-integration-architecture-audit.md`
- `enterprise-integration-architecture-amendment.md`
- `enterprise-integration-remediation-plan.md`

---

## Table of Contents

| ADR | Title | Page |
|-----|-------|------|
| ADR-001 | Enterprise Event Fabric | 2 |
| ADR-002 | Organizational Context Plane | 8 |
| ADR-003 | AI Employee Work Runtime | 12 |
| ADR-004 | Enterprise Work Request Contract | 16 |
| ADR-005 | AI-to-AI Work Handoff | 19 |
| ADR-006 | Capability Approval Port | 22 |
| ADR-007 | Project-Finance Integration Contract | 26 |
| ADR-008 | Organizational Memory Ingestion Contract | 29 |
| ADR-009 | Module Ownership Migration | 32 |
| ADR-010 | EIE Root Cause Fix | 36 |
| ADR-011 | Enterprise Understanding Contract | — |
| ADR-012 | Provenance & Confidence Model | — |
| ADR-013 | Enterprise Recommendation & Action Contract | — |
| ADR-014 | Enterprise Decision Contract | — |
| Annex A | Consolidated Integration Contract Interfaces | 39 |
| Annex B | Enterprise Event Contract Registry | 43 |
| Annex C | Module Impact Matrix | 46 |

---

# ADR-001 — Enterprise Event Fabric

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-004 (Event Fragmentation)
**Constitutional Articles:** Event-Driven Organization, Enterprise Learning Loop
**Original ADR-005:** Replaced (was "Enterprise Event Taxonomy" — scope expanded)

---

## Context

NeuroCore currently has two disconnected event buses:
1. **EnterpriseEventBusService** in `hermes/` — persisted to `ActivityEvent` table, only `HermesRuntimeService` emits
2. **ProjectEventBus** in `project-events/` — in-memory only, 5 producers, non-durable

Neither bus communicates with the other. Zero protocol-required enterprise events have operational producers and consumers. Event-driven organizational behaviour is architecturally impossible.

## Decision

Establish an **Enterprise Event Fabric** as the single durable, tenant-isolated event delivery infrastructure with five explicit layers:

1. **Domain Events** — internal to bounded contexts, not shared
2. **Enterprise Events** — stable cross-capability contracts
3. **Durable Transport** — outbox pattern with retry, dead-letter, consumer inboxes
4. **Producers** — capability-owned, publish through `IEnterpriseEventTransport`
5. **Consumers** — capability-owned, subscribe through `IEnterpriseEventTransport`

### Transport Architecture: In-Process Outbox with In-Memory Fan-Out

Kafka is not introduced. Rationale:
- No cross-process event delivery requirement exists
- Existing codebase has `ActivityEvent` persistence and `sourceEventId` uniqueness
- In-process outbox provides durable delivery without external infrastructure
- Future Kafka adoption remains architecturally compatible (replace transport adapter)

### Delivery Guarantee: At-Least-Once with Idempotent Consumers

The Event Fabric delivers events **at-least-once**. Consumers must be idempotent on the business-effect level. The `idempotencyKey` on each event enables exactly-once business-effect semantics even when the transport may deliver the same event multiple times.

**Why not exactly-once delivery?** Exactly-once delivery is impossible in distributed systems without distributed consensus (Paxos/Raft) or exactly-once source semantics. The outbox pattern provides at-least-once with a strong guarantee: every committed event WILL be delivered to every registered consumer at least once. Duplicate delivery is prevented from producing duplicate business effects by:
1. Consumer inbox idempotency (eventId + consumerId deduplication)
2. Business-level idempotency (idempotencyKey checked by consumer before processing)

### Consumer Inbox States

Each consumer has an inbox entry per event. The inbox lifecycle:

```
PENDING     → Worker creates entry when event is published to outbox
PROCESSING  → Consumer handler claims the entry (atomic update + lease)
PROCESSED   → Consumer handler completed successfully
FAILED      → Consumer handler threw; retry pending
DEAD_LETTER → All retries exhausted
```

### Atomic Claim / Lease Behaviour

```typescript
// Consumer inbox states
enum ConsumerInboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

// Inbox entry model
interface ConsumerInboxEntry {
  id: string;
  eventId: string;
  consumerId: string;
  status: ConsumerInboxStatus;
  leaseToken: string | null;          // UUID, generated at claim time
  leaseExpiresAt: string | null;      // ISO 8601, default 30s after claim
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  claimedAt: string | null;
  processedAt: string | null;
}

// Atomic claim: UPDATE consumer_inbox
//   SET status = 'PROCESSING',
//       leaseToken = gen_random_uuid(),
//       leaseExpiresAt = now() + interval '30 seconds',
//       claimedAt = now()
//   WHERE id = :inboxId
//     AND status = 'PENDING'
//   RETURNING leaseToken

// Atomic release: UPDATE consumer_inbox
//   SET status = 'PROCESSED',
//       processedAt = now(),
//       leaseToken = NULL,
//       leaseExpiresAt = NULL
//   WHERE id = :inboxId
//     AND leaseToken = :token

// Atomic failure: UPDATE consumer_inbox
//   SET status = 'FAILED',
//       retryCount = retryCount + 1,
//       lastError = :error,
//       leaseToken = NULL,
//       leaseExpiresAt = NULL
//   WHERE id = :inboxId
//     AND leaseToken = :token
```

### Stale PROCESSING Recovery

A consumer may crash mid-processing, leaving its inbox entry in `PROCESSING` with an expired lease. A recovery sweep runs every 60 seconds:

```typescript
// Recovery sweep (every 60s):
// UPDATE consumer_inbox
//   SET status = 'FAILED',
//       retryCount = retryCount + 1,
//       lastError = 'Lease expired — consumer did not release within 30s window',
//       leaseToken = NULL,
//       leaseExpiresAt = NULL
//   WHERE status = 'PROCESSING'
//     AND leaseExpiresAt < now()
```

After recovery, the retry mechanism picks up the `FAILED` entry.

### Retry Semantics

```
Attempt 1: immediate retry after failure → backoff 1s
Attempt 2: backoff 4s
Attempt 3: backoff 16s

After attempt 3: status = DEAD_LETTER
Write `EnterpriseEventDeadLetter` entry

Dead-letter recovery: administrative replay mechanism
  → sets status back to PENDING, resets retryCount, re-enters delivery queue
```

The worker picks up `FAILED` entries with `retryCount < 3` and attempts redelivery. Entries with `retryCount >= 3` are promoted to `DEAD_LETTER`.

### Business-Effect Idempotency

The `idempotencyKey` on each `EnterpriseEvent` is deterministic — derived from event-type-specific source data. Consumers MUST check `idempotencyKey` before applying business effects:

```typescript
// Consumer implementation pattern:
async onProjectCreated(event: EnterpriseEvent) {
  // Check idempotency first
  const alreadyProcessed = await this.idempotencyService.check(
    event.idempotencyKey,         // e.g. 'project.created.PROJ-123'
    this.consumerId               // e.g. 'memory-ingestion'
  );
  if (alreadyProcessed) return;

  // Apply business effect
  await this.projectMemory.create({ ... });

  // Mark idempotency
  await this.idempotencyService.mark(
    event.idempotencyKey,
    this.consumerId
  );
}
```

**Note:** Consumer inboxes prevent duplicate delivery to the same consumer. IdempotencyKey guards against duplicate business effects if the event is delivered more than once due to transport recovery or replay.

### Transport Flow (Revised)

```
Producer → transport.publish(event)
  │
  ├── 1. Write to EnterpriseEventOutbox table (status: PENDING)
  │      { id, eventType, version, tenantId, actorId, correlationId,
  │        causationId, payload (JSON), idempotencyKey, retryCount, status, createdAt }
  │
  └── 2. Background worker polls PENDING (1s interval)
         │
         ├── 3. For each consumer registered for this eventType:
         │      INSERT into consumer_inbox (eventId, consumerId, status: 'PENDING')
         │      ON CONFLICT (eventId, consumerId) DO NOTHING  ← idempotent dedup
         │
         ├── 4. For each inbox entry with status 'PENDING':
         │      Atomic claim: UPDATE status = 'PROCESSING', leaseToken, leaseExpiresAt
         │      WHERE id = :id AND status = 'PENDING'
         │      If claim fails (another worker claimed it) → skip
         │
         ├── 5. Emit to in-memory EventEmitter
         │      emitter.emit(event.eventType, event)
         │      Consumer handler receives event
         │
         ├── 6a. On success: Atomic release → status = 'PROCESSED'
         │
         ├── 6b. On failure: Atomic failure → status = 'FAILED', retryCount++
         │      Transfer to retry queue
         │
         ├── 7. Retry loop (FAILED entries, retryCount < 3):
         │      Backoff: 1s → 4s → 16s
         │      Re-attempt delivery same as Steps 4-6
         │
         └── 8. After max retries (retryCount >= 3):
                SET status = 'DEAD_LETTER'
                Write to EnterpriseEventDeadLetter table
                Log for administrative review

   ┌── 9. Recovery sweep (60s interval):
   │      Find PROCESSING entries with expired lease (< now())
   │      SET status = 'FAILED', retryCount++
   │      These enter the retry loop at Step 7
```

### New Module: `enterprise-events/`

```
modules/enterprise-events/
├── enterprise-events.module.ts
├── transport/
│   ├── enterprise-event-transport.interface.ts    ← IEnterpriseEventTransport
│   ├── enterprise-event-transport.service.ts      ← Implementation
│   ├── enterprise-event-outbox.service.ts         ← Background worker (1s tick)
│   ├── enterprise-event-consumer-inbox.service.ts ← Consumer inbox CRUD + claim/release
│   ├── enterprise-event-retry.service.ts          ← Retry backoff + dead-letter promotion
│   └── enterprise-event-recovery.service.ts       ← Stale PROCESSING sweep (60s tick)
├── contracts/
│   ├── enterprise-event-registry.ts               ← Event type registry
│   ├── enterprise-event.interface.ts              ← EnterpriseEvent type
│   └── domain-event.interface.ts                  ← DomainEvent type (marker)
└── projections/
    └── events-gateway-projection.service.ts       ← Socket.IO projection (derived, non-durable)
```

### Interface: IEnterpriseEventTransport

```typescript
// File: modules/enterprise-events/transport/enterprise-event-transport.interface.ts

import { EnterpriseEvent, EnterpriseEventHandler } from '../contracts/enterprise-event.interface';

export const EVENT_TRANSPORT = Symbol('EVENT_TRANSPORT');

export interface IEnterpriseEventTransport {
  /**
   * Publish an enterprise event.
   * Writes to outbox, fan-out is asynchronous via background worker.
   * Returns when the outbox record is committed.
   * Throws on persistence failure.
   */
  publish(event: EnterpriseEvent): Promise<void>;

  /**
   * Subscribe to an enterprise event type.
   * Consumer_id is derived from module name for consumer inbox tracking.
   * @returns Unsubscribe function. Call on module destroy.
   */
  subscribe(
    eventType: string,
    handler: EnterpriseEventHandler,
    consumerId?: string
  ): () => void;

  /**
   * Subscribe to all enterprise events (for projections like Socket.IO).
   */
  subscribeAll(
    handler: (event: EnterpriseEvent) => Promise<void>,
    consumerId: string
  ): () => void;

  /**
   * Get consumer inbox status for observability.
   */
  getConsumerStatus(consumerId: string): Promise<ConsumerInboxStatus>;

  /**
   * Replay events for a specific consumer.
   * Requires administrative authority.
   */
  replay(
    consumerId: string,
    options: { eventType?: string; from?: Date; to?: Date }
  ): Promise<number>;
}

export interface ConsumerInboxStatus {
  consumerId: string;
  pending: number;
  processed: number;
  failed: number;
  deadLettered: number;
}
```

### Interface: EnterpriseEvent (Contract)

```typescript
// File: modules/enterprise-events/contracts/enterprise-event.interface.ts

export interface EnterpriseEvent {
  /** Qualified event type, e.g. 'enterprise.project.created' */
  eventType: string;

  /** Contract version (integer, increments on breaking changes) */
  version: number;

  /** Tenant isolation */
  tenantId: string;

  /** Who/what caused this event */
  actorId: string;

  /** Actor classification */
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

  /** Traces a chain of related events */
  correlationId: string;

  /** The event that directly caused this one (null for root events) */
  causationId: string | null;

  /** ISO 8601 UTC */
  timestamp: string;

  /** Typed per event contract (see Annex B) */
  payload: Record<string, unknown>;

  /** Deterministic — enables business-effect idempotency under at-least-once delivery */
  idempotencyKey: string;

  /** Source module for tracing */
  sourceModule: string;
}

export type EnterpriseEventHandler = (
  event: EnterpriseEvent
) => Promise<void> | void;
```

### Event Registry (Contract Definitions)

```typescript
// File: modules/enterprise-events/contracts/enterprise-event-registry.ts

/**
 * Registry of all enterprise event contracts.
 * Each entry defines the event type, current version, and payload shape.
 * Consumers validate payload against the version they understand.
 */
export const ENTERPRISE_EVENT_REGISTRY = {
  'enterprise.project.created': {
    version: 1,
    payload: {
      projectId: 'string',
      name: 'string',
      customerId: 'string | null',
      budgetAmount: 'number | null',
      budgetCurrency: 'string | null',
      createdById: 'string',
    },
  },
  'enterprise.project.status.changed': {
    version: 1,
    payload: {
      projectId: 'string',
      fromStatus: 'string',
      toStatus: 'string',
      reason: 'string | null',
      changedById: 'string',
    },
  },
  'enterprise.project.budget.changed': {
    version: 1,
    payload: {
      projectId: 'string',
      previousAmount: 'number | null',
      newAmount: 'number',
      currency: 'string',
      changedById: 'string',
    },
  },
  'enterprise.project.timeline.changed': {
    version: 1,
    payload: {
      projectId: 'string',
      previousTargetDate: 'string | null',
      newTargetDate: 'string | null',
      reason: 'string | null',
    },
  },
  'enterprise.work.requested': {
    version: 1,
    payload: {
      workId: 'string',
      workType: 'string',
      fromAgentId: 'string',
      fromAgentType: 'string',
      toAgentId: 'string',
      toDepartmentId: 'string | null',
      taskDescription: 'string',
      projectId: 'string | null',
      customerId: 'string | null',
      correlationId: 'string',
      deadline: 'string | null',
      expectedOutputType: 'string | null',
      contextBlob: 'Record<string, unknown> | null',
    },
  },
  'enterprise.work.response.delivered': {
    version: 1,
    payload: {
      workId: 'string',
      originalCorrelationId: 'string',
      respondingAgentId: 'string',
      responseType: 'ACCEPTED | COMPLETED | DECLINED | ESCALATED | ERROR',
      outputType: 'string | null',
      outputSummary: 'string | null',
      deliverableCreated: '{ entityType: string; entityId: string } | null',
    },
  },
  'enterprise.approval.requested': {
    version: 1,
    payload: {
      approvalId: 'string',
      workflowType: 'string',
      requestingActorId: 'string',
      requestingActorType: 'HUMAN | AI_AGENT | SYSTEM',
      resourceType: 'string',
      resourceId: 'string',
      projectId: 'string | null',
      riskTier: 'string | null',
      priority: 'LOW | MEDIUM | HIGH | URGENT',
      expiresAt: 'string | null',
    },
  },
  'enterprise.approval.granted': {
    version: 1,
    payload: {
      approvalId: 'string',
      resourceType: 'string',
      resourceId: 'string',
      decision: 'APPROVED',
      reviewerId: 'string',
      reviewerType: 'HUMAN | AI_AGENT | SYSTEM',
      comment: 'string | null',
      decidedAt: 'string',
    },
  },
  'enterprise.approval.rejected': {
    version: 1,
    payload: {
      approvalId: 'string',
      resourceType: 'string',
      resourceId: 'string',
      decision: 'REJECTED | RETURNED_FOR_REVISION',
      reviewerId: 'string',
      reviewerType: 'HUMAN | AI_AGENT | SYSTEM',
      reason: 'string',
      comment: 'string | null',
      revisionRequired: 'string | null',
      decidedAt: 'string',
    },
  },
  'enterprise.finance.threshold.exceeded': {
    version: 1,
    payload: {
      thresholdId: 'string',
      projectId: 'string | null',
      category: 'string',
      currentSpend: 'number',
      thresholdValue: 'number',
      currency: 'string',
      exceededBy: 'number',
      recordedBy: 'string | null',
    },
  },
  'enterprise.eie.response.recorded': {
    version: 1,
    payload: {
      projectId: 'string',
      questionId: 'string',
      sourceType: 'string',
      confidence: 'number',
      previousConfidence: 'number | null',
    },
  },
  'enterprise.eie.completeness.changed': {
    version: 1,
    payload: {
      projectId: 'string',
      entityType: 'string',
      oldScore: 'number | null',
      newScore: 'number',
      totalRequired: 'number',
      totalResolved: 'number',
    },
  },
  'enterprise.task.completed': {
    version: 1,
    payload: {
      taskId: 'string',
      projectId: 'string | null',
      goalId: 'string | null',
      status: 'COMPLETED | FAILED | CANCELLED',
      completedById: 'string',
      completedByType: 'HUMAN | AI_AGENT | SYSTEM',
      outputSummary: 'string | null',
    },
  },
  'enterprise.customer.communication.received': {
    version: 1,
    payload: {
      communicationId: 'string',
      channel: 'EMAIL | CHAT | PHONE',
      customerId: 'string | null',
      contactEmail: 'string',
      subject: 'string',
      summary: 'string',
      receivedAt: 'string',
    },
  },
  'enterprise.workspace.document.created': {
    version: 1,
    payload: {
      documentId: 'string',
      projectId: 'string | null',
      customerId: 'string | null',
      mimeType: 'string',
      title: 'string',
      createdById: 'string',
      createdByType: 'HUMAN | AI_AGENT | SYSTEM',
      driveFileId: 'string | null',
    },
  },
  'enterprise.calendar.event.scheduled': {
    version: 1,
    payload: {
      eventId: 'string',
      title: 'string',
      projectId: 'string | null',
      scheduledAt: 'string',
      startTime: 'string',
      endTime: 'string',
      participants: 'string[]',
    },
  },
} as const;

export type EnterpriseEventType = keyof typeof ENTERPRISE_EVENT_REGISTRY;
```

### Module Impact

| Module | Change |
|---|---|
| New `modules/enterprise-events/` | Create Event Fabric (transport, registry, projections) |
| `modules/hermes/` | Remove `EnterpriseEventBusService`. Hermes runtime continues emitting Hermes-internal events through in-process EventEmitter. |
| `modules/hermes/services/` | `EnterpriseEventBusService` is removed. Its ActivityEvent persistence responsibility moves to the Event Fabric. |
| `modules/events/events.gateway.ts` | Add `EventsGatewayProjectionService` subscription: subscribes to all enterprise events, emits Socket.IO projections |
| `modules/project-events/` | Deprecated. 5 event producers migrate to `IEnterpriseEventTransport.publish()`. 5 event handlers migrate to `IEnterpriseEventTransport.subscribe()`. ProjectEventBus removed. |
| `modules/projects/projects.service.ts` | Inject `IEnterpriseEventTransport`. Publish `enterprise.project.created`, `.status.changed`, `.budget.changed`, `.timeline.changed`. |
| `modules/finance/services/billing-calculator.service.ts` | Publish `enterprise.finance.threshold.exceeded` |
| All consumer modules | Subscribe to relevant events in `onModuleInit()` |

### Consequences

**Positive:**
- Single durable event delivery infrastructure with at-least-once guarantees
- Idempotent consumer pattern ensures business-effect exactly-once semantics
- Consumer inbox with atomic claim/lease prevents duplicate processing across worker restarts
- Lease-based stale PROCESSING recovery handles crashed consumers automatically
- Dead-letter mechanism preserves failed events for administrative review
- Socket.IO is a projection, not the transport — Socket.IO failures don't lose events
- Producers and consumers remain decoupled — transport has no business logic
- Future Kafka migration requires only replacing the transport adapter

**Negative:**
- New database table for outbox (minor storage cost)
- Background worker adds 1s latency in worst case (acceptable for enterprise events)
- Must migrate 5 ProjectEventBus producers and 5 ProjectEventBus handlers

**Risk:** Transport becoming a God Service.
**Mitigation enforced by:** Transport has no business logic. `publish()` takes opaque `Record<string, unknown>`. Business decisions are inside capability-owned consumers only.

---

# ADR-002 — Organizational Context Plane

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-002 (Hermes Context Isolation)
**Constitutional Articles:** AI Employees are Employees, Business Intelligence Everywhere, Hermes as Organizational Interface

---

## Context

HermesContextService.build() assembles context from Hermes-local tables only: agent profile + 20 HermesMemory entries + static allowed tool names. It never queries Projects, Customers, Finance, or other capability modules. The enterprise simulation confirmed Hermes AI reports "zero tasks, zero workflows" while 4 projects and 100+ agents exist.

## Decision

Establish an **Organizational Context Plane** that aggregates authorized, provenance-aware context from capability-owned context providers. The Context Plane does NOT own data — it aggregates and caches.

### New Module: `context-plane/`

```
modules/context-plane/
├── context-plane.module.ts
├── context-plane.interface.ts                    ← IOrganizationalContextPlane
├── context-plane.service.ts                      ← Aggregation + caching
├── context-auth.interface.ts                     ← ContextAuth, ContextScope
└── providers/                                    ← One per capability module
    ├── projects-context.provider.ts
    ├── customers-context.provider.ts
    ├── finance-context.provider.ts
    ├── tasks-context.provider.ts
    ├── approvals-context.provider.ts
    ├── memory-context.provider.ts
    └── comms-context.provider.ts
```

### Formal Context Authorization Decision Contract

Every context query must pass through an authorization decision. Authorization is NOT a simple `authorityLevel` number — it is a resolution from:

```
Organizational Identity → Resolved Role → Department Membership
  → Authority Level (from role + department + governance policy)
  → Autonomy Level (from agent profile + governance policy)
  → Governance Policy Evaluation (active governance rules on this context)
  → Authorization Decision: FULL | REDACTED | DENIED
```

**Authorization Decision (replaces numeric authorityLevel):**

```typescript
export type ContextAuthorization =
  | { access: 'FULL'; provenance: string }                    // All data visible
  | { access: 'REDACTED'; provenance: string; reason: string } // Some fields removed
  | { access: 'DENIED'; provenance: string; reason: string };  // No data returned
```

`provenance` records which governance rule, role policy, or organizational boundary produced the decision. This enables audit and explainability.

### Context Auth Resolution

```typescript
export interface ContextAuth {
  employeeId: string;
  employeeType: 'HUMAN' | 'AI_AGENT';

  /** Resolved organizational identity — sourced from HermesRegistry or User table */
  resolvedIdentity: ResolvedIdentity;

  /** Role evaluation — populated by Context Plane before calling providers */
  organizationalContext: AuthContext;
}

export interface ResolvedIdentity {
  displayName: string;
  role: string;                    // 'EXECUTIVE' | 'MANAGER' | 'ANALYST' | 'FINANCE' | etc.
  departmentId: string | null;
  departmentName: string | null;
  authorityLevel: number;          // 0=employee, 50=manager, 75=director, 90=executive, 100=admin
  autonomyLevel: number;           // 0=fully manual, 100=fully autonomous
}

export interface AuthContext {
  /** Resolved from active governance rules for this identity + scope */
  applicablePolicies: GovernancePolicy[];
  /** Effective authority after policy evaluation */
  effectiveAuthority: number;
  /** Effective autonomy after policy evaluation */
  effectiveAutonomy: number;
}
```

### Revised IOrganizationalContextProvider

Every context provider MUST evaluate authorization and return `FULL`, `REDACTED`, or `DENIED`:

```typescript
export interface IOrganizationalContextProvider {
  readonly capabilityName: string;

  getContext(
    tenantId: string,
    scope: ContextScope,
    auth: ContextAuth
  ): Promise<CapabilityContext>;

  getLastModified(
    tenantId: string,
    scope: ContextScope
  ): Promise<string | null>;
}

export interface CapabilityContext {
  capabilityName: string;

  /** Authorization decision for this provider's return data */
  authorization: ContextAuthorization;

  /** Data is empty object when authorization is DENIED.
   *  May contain partial data when authorization is REDACTED. */
  data: Record<string, unknown>;

  fetchedAt: string;
  provenance: string;
  expiresAt: string;
}
```

### Example: Projects Context Provider with Authorization

```typescript
// context-plane/providers/projects-context.provider.ts
@Injectable()
export class ProjectsContextProvider implements IOrganizationalContextProvider {
  readonly capabilityName = 'projects';

  constructor(
    @Inject(PROJECT_REPOSITORY) private projectRepo: IProjectRepository,
  ) {}

  async getContext(
    tenantId: string,
    scope: ContextScope,
    auth: ContextAuth
  ): Promise<CapabilityContext> {
    // Step 1: Determine authorization based on identity + governance
    const authorization = this.evaluateAuthorization(scope, auth);

    if (authorization.access === 'DENIED') {
      return {
        capabilityName: 'projects',
        authorization,
        data: {},
        fetchedAt: new Date().toISOString(),
        provenance: `ProjectsContextProvider: ${authorization.provenance}`,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      };
    }

    // Step 2: Fetch data (only if authorized)
    const projects = scope.projectId
      ? [await this.projectRepo.findById(scope.projectId, tenantId)]
      : (await this.projectRepo.findAll(tenantId, { limit: 10 })).data;

    // Step 3: Apply redaction if authorization is REDACTED
    const projectData = projects.map(p => ({
      id: p.id,
      name: p.name,
      status: authorization.access === 'REDACTED' ? 'CLASSIFIED' : p.status,
      budget: authorization.access === 'REDACTED' ? null : p.budgetAmount,
      customerId: authorization.access === 'REDACTED' ? null : p.customerId,
    }));

    return {
      capabilityName: 'projects',
      authorization,
      data: { projects: projectData, total: projectData.length },
      fetchedAt: new Date().toISOString(),
      provenance: `ProjectsContextProvider.getContext() — auth: ${authorization.access}`,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
  }

  private evaluateAuthorization(
    scope: ContextScope,
    auth: ContextAuth
  ): ContextAuthorization {
    // Rule 1: Employee must belong to this tenant
    // Rule 2: Employee must have a role that permits project access
    if (auth.organizationalContext.effectiveAuthority < 10) {
      return {
        access: 'DENIED',
        provenance: 'auth.effectiveAuthority < 10 — insufficient authority for project access',
        reason: 'Insufficient authority to view projects',
      };
    }

    // Rule 3: Cross-department projects are REDACTED (budget hidden)
    if (scope.projectId && auth.resolvedIdentity.departmentId) {
      // Check if project belongs to the employee's department
      // If not → REDACTED unless employee has executive authority
      if (auth.resolvedIdentity.authorityLevel < 75) {
        return {
          access: 'REDACTED',
          provenance: 'cross-department — authorityLevel < 75, redacting budget and status detail',
          reason: 'Budget information restricted to own department',
        };
      }
    }

    // Default: full access
    return {
      access: 'FULL',
      provenance: 'Standard project access granted',
    };
  }
}
```

### Revised IOrganizationalContextPlane

The Context Plane resolves identity and governance BEFORE calling providers. It provides each provider with the fully resolved `ContextAuth`, not raw identity strings.

```typescript
export interface IOrganizationalContextPlane {
  registerProvider(provider: IOrganizationalContextProvider): void;

  /**
   * Assemble organizational context with authorization.
   * 1. Resolve identity from employeeId → ResolvedIdentity
   * 2. Evaluate governance policies → AuthContext
   * 3. For each provider: call getContext(auth) with resolved ContextAuth
   * 4. Each provider returns authorized CapabilityContext (FULL/REDACTED/DENIED)
   * 5. Aggregate responses into single map
   */
  assemble(
    tenantId: string,
    scope: ContextScope,
    auth: ContextAuth
  ): Promise<Map<string, CapabilityContext>>;

  assembleFor(
    tenantId: string,
    scope: ContextScope,
    auth: ContextAuth,
    capabilityNames: string[]
  ): Promise<Map<string, CapabilityContext>>;
}

export interface ContextScope {
  agentId?: string;
  projectId?: string;
  customerId?: string;
  departmentId?: string;
  includeCapabilities?: string[];
  excludeCapabilities?: string[];
  maxContextAgeMs?: number;
}
```

### Hermes Integration (Refactored)

The hardcoded `authorityLevel: 50` is removed. Hermes resolves identity and governance via the Context Plane:

```typescript
// hermes/services/hermes-context.service.ts (refactored)
@Injectable()
export class HermesContextService implements IHermesContext {
  constructor(
    @Inject(CONTEXT_PLANE) private contextPlane: IOrganizationalContextPlane,
    private registry: HermesRegistryService,
    private memory: HermesMemoryService,
    private governance: GovernanceRulesService,  // for governance policy resolution
  ) {}

  async build(params: BuildContextParams): Promise<HermesSessionContext> {
    const profile = await this.registry.findById(params.hermesAgentId);
    const agentMemory = await this.memory.getContext(params.hermesAgentId, params.tenantId);

    // Resolve organizational identity from registry
    const resolvedIdentity: ResolvedIdentity = {
      displayName: profile.displayName || profile.type,
      role: profile.type,
      departmentId: profile.departmentId || null,
      departmentName: profile.departmentName || null,
      authorityLevel: profile.authorityLevel ?? 10,   // 0-100 from Agent model
      autonomyLevel: profile.autonomyLevel ?? 10,      // 0-100 from Agent model
    };

    // Evaluate governance policies for this identity and scope
    const govDecision = await this.governance.evaluate(params.tenantId, {
      'agent.id': params.hermesAgentId,
      'agent.type': profile.type,
      'agent.department': profile.departmentId,
      'agent.authority': resolvedIdentity.authorityLevel,
    });
    const authContext: AuthContext = {
      applicablePolicies: govDecision.triggeredRules,
      effectiveAuthority: resolvedIdentity.authorityLevel,
      effectiveAutonomy: govDecision.allowed
        ? resolvedIdentity.autonomyLevel
        : 0,
    };

    // Query Context Plane with fully resolved authorization
    const orgContext = await this.contextPlane.assemble(
      params.tenantId,
      { agentId: params.agentId, projectId: params.projectId },
      {
        employeeId: params.hermesAgentId,
        employeeType: 'AI_AGENT',
        resolvedIdentity,
        organizationalContext: authContext,
      }
    );

    return {
      ...profile,
      organization: Object.fromEntries(orgContext),
      agentMemory,
      allowedTools: this.registry.getAllowedTools(profile.type),
      authorizationDecisions: Object.fromEntries(
        Array.from(orgContext.entries()).map(([k, v]) => [k, v.authorization])
      ),
    };
  }
}
```

### Event-driven context refresh

The Context Plane subscribes to relevant enterprise events and invalidates cached context:

```
enterprise.project.created → ContextPlane cache invalidated for 'projects'
enterprise.approval.granted → ContextPlane cache invalidated for 'approvals'
enterprise.finance.threshold.exceeded → ContextPlane cache invalidated for 'finance'
```

### Module Impact

| Module | Change |
|---|---|
| New `modules/context-plane/` | Create aggregation, providers, cache, event subscription |
| `modules/hermes/services/hermes-context.service.ts` | Refactor to use `IOrganizationalContextPlane` |
| `modules/projects/` | Add `ProjectsContextProvider` implementation |
| `modules/customers/` | Add `CustomersContextProvider` implementation |
| `modules/finance/` | Add `FinanceContextProvider` implementation |
| `modules/orchestration/` | Add `TasksContextProvider` implementation |
| `modules/governance/` | Add `ApprovalsContextProvider` implementation |
| `modules/project-memory/` | Add `MemoryContextProvider` implementation |
| `modules/threads/` | Add `CommsContextProvider` implementation |

### Consequences

**Positive:**
- Hermes and AI Employees see accurate organizational state
- Context providers are capability-owned — no central data ownership violation
- Cache invalidation via Event Fabric keeps context fresh
- Provider interface is extensible — new capabilities add providers without modifying Context Plane

**Negative:**
- Context assembly latency (multi-capability query) added to Hermes session start
- Mitigated via: cache (30s TTL), selective `assembleFor()` for specific capabilities only

---

# ADR-003 — AI Employee Work Runtime

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-003 (No AI Employee Work Runtime)
**Constitutional Articles:** AI Employees are Employees, Digital Workforce, Progressive Autonomy, Human-AI Collaboration

---

## Context

AI agents can be invoked (via HTTP dispatch, direct messaging, LangGraph) but never employed. There is no organizational work lifecycle: work reception → identity → context → responsibility → authority → execution → output → governance → event → memory. The concept of an "AI Employee Work Runtime" does not exist as an architectural component.

## Decision

Create an **AI Employee Work Runtime** as a formal bounded context (`work-runtime/` module) that implements the organizational employee work lifecycle.

### New Module: `work-runtime/`

```
modules/work-runtime/
├── work-runtime.module.ts
├── work-runtime.interface.ts                   ← IWorkRuntime
├── work-runtime.service.ts                     ← Implementation
├── work-router.service.ts                      ← Routes incoming work
├── work-evaluator.service.ts                   ← Responsibility + authority check
├── work-executor.service.ts                    ← Delegates to AgentExecutor or HermesRuntime
├── work-output-handler.service.ts              ← Processes structured output
├── work-approval-coordinator.service.ts         ← Routes approval requests
├── work-lifecycle.service.ts                   ← State machine
├── work-queue.service.ts                       ← Pending work inbox
├── contracts/
│   ├── work-request.interface.ts               ← IWorkRequest
│   ├── work-response.interface.ts              ← IWorkResponse
│   └── work-lifecycle.interface.ts             ← WorkState, WorkStatus
└── adapters/
    ├── agent-executor.adapter.ts               ← Calls AgentExecutorService
    └── hermes-runtime.adapter.ts               ← Calls HermesRuntimeService
```

### Interface: IWorkRuntime

```typescript
// File: modules/work-runtime/work-runtime.interface.ts

export const WORK_RUNTIME = Symbol('WORK_RUNTIME');

export interface IWorkRuntime {
  /**
   * Route a work request to the appropriate AI Employee.
   * Triggers the full lifecycle.
   */
  route(work: IWorkRequest): Promise<WorkRouteResult>;

  /**
   * Handle a work response (from A2A handoff or approval decision).
   */
  handleResponse(response: IWorkResponse): Promise<void>;

  /**
   * Get the current status of a work item.
   */
  getStatus(workId: string): Promise<WorkStatus | null>;

  /**
   * Cancel a work item.
   */
  cancel(workId: string, reason: string): Promise<void>;

  /**
   * Get all work currently assigned to an employee.
   */
  getQueue(employeeId: string, tenantId: string): Promise<WorkItemBrief[]>;
}

export interface WorkRouteResult {
  accepted: boolean;
  workId: string;
  routedToAgentId: string;
  status: WorkStatus;
  message: string;
}

export interface WorkItemBrief {
  workId: string;
  workType: string;
  status: WorkStatus;
  fromAgentId: string;
  createdAt: string;
  deadline: string | null;
  projectId: string | null;
}
```

### Work Lifecycle State Machine

```
RECEIVED → EVALUATING → (ACCEPTED | DECLINED | ESCALATED)
   |            |
   |            └──→ ACCEPTED → ASSEMBLING_CONTEXT → EXECUTING
   |                                                    |
   └──→ DECLINED ───────────────────────────────────────┤
                                                        |
                                                        ├──→ AWAITING_APPROVAL → (APPROVED | REJECTED | RETURNED)
                                                        |                          |          |           |
                                                        |                          |          |           └──→ REVISING → AWAITING_APPROVAL
                                                        |                          |          └──→ FAILED
                                                        |                          └──→ COMPLETED
                                                        |
                                                        └──→ COMPLETED (auto-approved, no governance required)
```

### Work Lifecycle Service

```typescript
// File: modules/work-runtime/work-lifecycle.service.ts

type WorkStatus =
  | 'RECEIVED'
  | 'EVALUATING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'ESCALATED'
  | 'ASSEMBLING_CONTEXT'
  | 'EXECUTING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'REVISING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

interface WorkLifecycleState {
  workId: string;
  status: WorkStatus;
  employeeId: string;
  tenantId: string;
  workType: string;
  projectId: string | null;
  customerId: string | null;
  correlationId: string;
  causationId: string | null;
  originalRequest: IWorkRequest;
  currentResponse: IWorkResponse | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

### Integration: Entry Points

**Work Runtime receives work through 3 paths:**

1. **Enterprise Event** (`enterprise.work.requested`):
   ```
   Event Fabric → WorkRouter → Request reception → Lifecycle start
   ```

2. **Explicit dispatch** (HTTP or internal call):
   ```
   POST /work-runtime/dispatch → WorkRouter → same lifecycle
   ```

3. **Scheduled/triggered** (cron or stage-completion hook):
   ```
   StageCompleted event → WorkRuntime creates automated work item → same lifecycle
   ```

### Evaluation Steps (WorkEvaluator)

```typescript
// File: modules/work-runtime/work-evaluator.service.ts

interface EvaluationResult {
  accepted: boolean;
  reason: string;
  authorityLevel: number;
  autonomyLevel: number;
  requiresApproval: boolean;
  governanceDecision: GovernanceDecision | null;
  escalationRequired: boolean;
  escalationReason: string | null;
  assembledContext: Map<string, CapabilityContext> | null;
}

// Evaluation pipeline:
// 1. Resolve employee identity (HermesRegistryService.findById)
// 2. Check work type against employee capabilities
// 3. Resolve department membership
// 4. Query Context Plane for organizational context (project, customer)
// 5. Evaluate authority: does this employee have authority for this work type?
// 6. Evaluate autonomy: can employee proceed without approval?
// 7. Governance check: evaluate active governance rules
// 8. Accept, decline, or escalate based on evaluation
```

### Module Impact

| Module | Change |
|---|---|
| New `modules/work-runtime/` | Create Work Runtime module (6 services, adapters, contracts) |
| `modules/agents/services/agent-executor.service.ts` | Add `executeAsEmployee(workRequest)` for delegation from Work Runtime |
| `modules/hermes/services/hermes-runtime.service.ts` | Route Hermes agent execution through Work Runtime when called as organizational employee |
| `modules/hermes/services/agent-messaging.service.ts` | A2A messages with `expectResponse=true` route through Work Runtime instead of direct execute |

### Consequences

**Positive:**
- AI Employees have a proper organizational work lifecycle
- Work is observable (status tracking), auditable (lifecycle log), and governable (pre-execution checks)
- Approval and escalation are integrated into the lifecycle
- Future progressive autonomy: autonomy level controls how many steps require approval

**Negative:**
- Additional latency per work item (evaluation + context assembly before execution)
- New state to manage (work lifecycle persistence)

---

# ADR-004 — Enterprise Work Request Contract

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-003 (supporting RC-004)
**Constitutional Articles:** Digital Workforce, AI Employees are Employees, Human-AI Collaboration

---

## Context

Work requests currently have no structured contract. A2A messages are plain text. Direct agent dispatch sends unstructured tasks. Approval decisions have no callback path. There is no typing, no correlation, no deadline, no expected output — making organizational work impossible to observe, track, or govern.

## Decision

Define a single **Enterprise Work Request Contract** (`IWorkRequest`) used by all work assignment paths: human → AI, AI → AI, system → AI, and approval decision → AI.

### Interface: IWorkRequest

```typescript
// File: modules/work-runtime/contracts/work-request.interface.ts

export interface IWorkRequest {
  /** Unique identifier for this unit of work */
  workId: string;

  /** Type of work requested */
  workType: WorkType;

  /** Sender identification */
  from: WorkActor;

  /** Intended recipient */
  to: WorkActor;

  /** The actual work description */
  task: WorkTask;

  /** Organizational context scoping */
  scope: WorkScope;

  /** Governance context */
  governance: WorkGovernance;

  /** Temporal constraints */
  timing: WorkTiming;

  /** Chain of related events */
  correlation: WorkCorrelation;

  /** Sender's expected outcome */
  expectedOutput: ExpectedOutput | null;
}

export interface WorkActor {
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  displayName: string;
  departmentId?: string;
  authorityLevel: number;
}

export interface WorkTask {
  description: string;
  instructions: string | null;
  constraints: string[];
  inputData: Record<string, unknown> | null;
  allowedTools: string[] | null;  // null = use default tools for agent type
}

export interface WorkScope {
  tenantId: string;
  projectId: string | null;
  customerId: string | null;
  contextSnapshot: Record<string, unknown> | null;  // immutable context at request time
}

export interface WorkGovernance {
  requiresApproval: boolean;
  approvalChainId: string | null;
  riskTier: RiskTier | null;
  allowedAutonomyLevel: number;  // 0=manual, 100=fully autonomous
  maxAttempts: number;
}

export interface WorkTiming {
  deadline: string | null;
  priority: Priority;
  estimatedDurationMinutes: number | null;
}

export interface WorkCorrelation {
  correlationId: string;
  causationId: string | null;
  traceId: string;
}

export interface ExpectedOutput {
  outputType: OutputType;
  format: string | null;
  acceptanceCriteria: string[] | null;
}

export type WorkType =
  | 'DISCOVERY'          // EIE information gathering
  | 'ANALYSIS'           // Data analysis or research
  | 'DOCUMENT_CREATION'  // Create a document, report, or deliverable
  | 'COMMUNICATION'      // Internal or external communication
  | 'REVIEW'             // Review, audit, or compliance check
  | 'APPROVAL_REQUEST'   // Request governance approval
  | 'ESCALATION'         // Escalate to higher authority
  | 'COORDINATION'       // Cross-department coordination
  | 'MONITORING'         // Monitor for changes or events
  | 'DECISION'           // Make a decision
  | 'CUSTOM';            // Capability-specific work types

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type OutputType =
  | 'TEXT_RESPONSE'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'PRESENTATION'
  | 'DECISION'
  | 'APPROVAL'
  | 'MEMORY_ENTRY'
  | 'STATUS_UPDATE'
  | 'REPORT'
  | 'EMAIL'
  | 'CALENDAR_EVENT'
  | 'WORKFLOW_TRIGGER';
```

### Interface: IWorkResponse

```typescript
export interface IWorkResponse {
  /** Matches the original work request */
  workId: string;

  /** Responding actor */
  from: WorkActor;

  /** Original requestor */
  to: WorkActor;

  /** Decision */
  responseType: 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'FAILED' | 'ESCALATED' | 'NEEDS_CLARIFICATION';

  /** Content output */
  output: WorkOutput | null;

  /** Governance outcome */
  governance: {
    required: boolean;
    granted: boolean | null;
    reviewedBy: WorkActor | null;
    decidedAt: string | null;
  };

  /** Correlation */
  correlation: WorkCorrelation;

  /** Timestamps */
  receivedAt: string;
  respondedAt: string;
}

export interface WorkOutput {
  outputType: OutputType;
  content: string;
  contentType: string;  // 'text/plain', 'application/json', etc.
  attachments: WorkAttachment[];
  deliverablesCreated: Array<{ entityType: string; entityId: string }>;
  memoryEntriesCreated: number;
}

export interface WorkAttachment {
  name: string;
  mimeType: string;
  url: string | null;
  sizeBytes: number | null;
}
```

### Integration points

| Integration | Uses IWorkRequest | Uses IWorkResponse |
|---|---|---|
| Work Runtime route() | ✅ Input | ✅ Output |
| Work Runtime handleResponse() | — | ✅ Input |
| AgentMessagingService send() | ✅ Transform message → WorkRequest | — |
| ApprovalPort request() | ✅ Embedded in approval request | — |
| ApprovalPort decide() | — | ✅ Embedded in approval decision |
| Event Fabric work.requested | ✅ Payload conforms | — |
| Event Fabric work.response.delivered | — | ✅ Payload conforms |
| HermesRuntimeService execute() | ✅ Parsed from request context | — |
| AgentExecutorService executeTask() | ✅ Parsed from request | ✅ Returned |

---

# ADR-005 — AI-to-AI Work Handoff

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-003 (A2A handoff gap)
**Constitutional Articles:** AI Employees are Employees, Digital Workforce, Event-Driven Organization

---

## Context

AgentMessagingService provides text-based messaging between agents but is NOT organizational work transport. Messages are plain text. No structured work contract exists. Receiving agents execute synchronously with no awareness of the sender's organizational context. No enterprise event is delivered on work completion. The protocol's Section D requirement (two AI-to-AI work chains) cannot be met.

## Decision

Transform AgentMessagingService into **organizational work transport that is purely infrastructure**. Enterprise work handoffs flow **asynchronously** through the durable Enterprise Event Fabric using `enterprise.work.requested` and `enterprise.work.response.delivered` events. Work Coordination/Comms persists and projects observable messages and threads but MUST NOT invoke or orchestrate AI Employee execution.

The existing AgentMessagingService infrastructure (thread management, participant resolution, hop counting, guard checks) is preserved as the lower-level transport for **non-work chat only** (status inquiries, casual messaging between agents). Enterprise work handoffs bypass AgentMessagingService's synchronous execution path entirely.

### Extract AgentMessagingService from Hermes into `work-coordination/`

The existing `AgentMessagingService`, `AgentMessagingGuard`, `ParticipantResolver`, `ThreadService`, `ActivityService`, and `PresenceService` are extracted from Hermes into a new `work-coordination/` module. This is the infrastructure layer — it persists messages, manages threads, enforces circuit breakers, and tracks presence. It does NOT execute AI Employees.

### Architecture

```
work-coordination/ (infrastructure only — no AI execution)
├── agent-messaging.service.ts          ← Text messaging (non-work chat only)
├── agent-messaging.guard.ts            ← Circuit breaker (hop limit, cost ceiling)
├── participant-resolver.service.ts     ← Agent identity resolution
├── thread.service.ts                   ← Thread/message persistence
├── activity.service.ts                 ← Activity event recording
├── presence.service.ts                 ← Agent presence tracking
└── interfaces/                         ← IAgentMessaging, etc.

enterprise-events/ (durable transport)
  enterprise.work.requested → WorkRuntime subscriber
  enterprise.work.response.delivered → WorkRuntime subscriber

work-runtime/ (domain — work semantics, receives via Event Fabric)
  Subscribes to enterprise.work.requested
  Subscribes to enterprise.work.response.delivered
  Publishes enterprise.work.response.delivered on completion
```

### A2A Work Handoff Flow (ASYNCHRONOUS)

```
AI Agent A (Sales) needs pricing analysis from AI Agent B (Finance):

1. Sales Agent completes its current work item
2. WorkRuntime output handler identifies need for Finance AI input
3. WorkRuntime creates a new work request and PUBLISHES IT AS AN EVENT:
   Publish to Event Fabric: enterprise.work.requested
   {
     workId, workType='ANALYSIS',
     from: Sales AI identity,
     to: Finance AI identity (resolved via ParticipantResolver),
     task: { description: 'Calculate pricing for Q3' },
     scope: { projectId, customerId, contextSnapshot },
     governance: { riskTier: 'MEDIUM' },
     correlationId: (inherits from Sales work)
   }
4. Sales Agent's work item enters AWAITING_RESPONSE state
   (does NOT block — it persists the state and continues)
5. Event Fabric durably persists the work.requested event
6. Event Fabric delivers to subscribed consumers:
   a. WorkRuntime subscriber (in the Finance agent's process space)
      receives enterprise.work.requested
   b. WorkRuntime creates new work item for Finance agent:
      RECEIVED → EVALUATING → ACCEPTED → ASSEMBLING_CONTEXT → EXECUTING
   c. WorkRuntime dispatches to HermesRuntime or AgentExecutor for LLM execution
7. Finance AI evaluates, executes, produces output
8. WorkRuntime publishes enterprise.work.response.delivered:
   {
     workId, originalCorrelationId,
     responseType: 'COMPLETED',
     outputSummary: 'Q3 pricing at $X based on...',
     deliverablesCreated: [...]
   }
9. WorkRuntime subscriber in Sales agent's process space receives the event
10. Sales work item transitions from AWAITING_RESPONSE to COMPLETED
    (output from Finance response is attached to Sales work output)

Key architectural property: AgentMessagingService is NEVER called during this flow.
It may be used AFTER the work is completed to project a message/thread
for auditing purposes, but it does NOT deliver the work request.
```

### Event Flow Diagram

```
┌──────────┐         ┌──────────────────┐         ┌──────────┐
│ Sales AI │         │  Event Fabric    │         │Finance AI│
│ (Work    │         │  (durable)       │         │ (Work    │
│ Runtime) │         │                  │         │ Runtime) │
└────┬─────┘         └──────────────────┘         └────┬─────┘
     │                                                    │
     │ 1. work.requested (publish)                        │
     │──────────────────────────────────────────────────────→
     │                                                    │
     │                          2. Durable persist        │
     │                          3. Deliver to subscriber  │
     │                                                    │
     │                    4. work.requested (deliver)     │
     │──────────────────────────────────────────────────────→
     │                                                    │
     │                          5. Work Runtime           │
     │                             evaluates + executes   │
     │                                                    │
     │                    6. work.response.delivered      │
     │←────────────────────────────────────────────────────
     │                           (publish)                │
     │                                                    │
     │ 7. Receive response                                │
     │ 8. Transition to COMPLETED                         │
     │                                                    │
     │ Optional projection:                               │
     │   Work Coordination/Comms is called AFTERWARD      │
     │   to persist a human-readable message & thread     │
     │   for audit trail. It does NOT carry the work.     │
```

### Work Coordination Adapter (Optional, for Audit Trail)

If an audit thread is desired for human supervisors:

```typescript
// work-runtime/work-coordination.adapter.ts
// Called BY WorkRuntime AFTER work completion, NOT during A2A delivery.
@Injectable()
export class WorkCoordinationAdapter {
  constructor(
    @Inject(AGENT_MESSAGING) private messaging: IAgentMessaging,
  ) {}

  /**
   * AFTER an async A2A work handoff completes, optionally project
   * a human-readable message + thread into Work Coordination/Comms.
   * This is for AUDIT and OBSERVABILITY only.
   * It does NOT carry, route, or execute the work.
   */
  async projectAuditTrail(
    request: IWorkRequest,
    response: IWorkResponse,
  ): Promise<void> {
    // This is safe because it's called AFTER async delivery is complete.
    await this.messaging.send({
      fromAgentId: request.from.actorId,
      toAgentId: request.to.actorId,
      tenantId: request.scope.tenantId,
      threadId: `work-${request.correlationId}`,
      content: `[Work Complete] ${request.task.description} → ${response.responseType}`,
      expectResponse: false,  // ← NEVER true for audit projections
    });
  }
}
```

### Hop Limit and Cost Control

The existing `AgentMessagingGuard` circuit breaker (hop limit 5, message limit 50, cost ceiling $10) is preserved and extended to account for Work Runtime hops:

```typescript
// Extended guard for work handoffs
interface WorkHandoffGuard extends IAgentMessagingGuard {
  checkWorkRequest(request: IWorkRequest): Promise<WorkHandoffCheckResult>;
}

interface WorkHandoffCheckResult {
  allowed: boolean;
  reason: string | null;
  currentHops: number;
  maxHops: number;
  currentCost: number;
  maxCost: number;
  authorityValid: boolean;
  projectMembershipValid: boolean;
}
```

### Module Impact

| Module | Change |
|---|---|
| New `modules/work-coordination/` | Extract AgentMessagingService, ThreadService, etc. from Hermes. AgentMessagingService is restricted to non-work chat only — `expectResponse=true` disabled for work handoffs. |
| `modules/hermes/` | Remove AgentMessagingService, ThreadService, ParticipantResolver, ActivityService, PresenceService |
| `modules/hermes/services/` | Remove 5 service files, keep core Hermes services |
| `modules/work-runtime/` | Subscribe to `enterprise.work.requested` and `enterprise.work.response.delivered` from Event Fabric. Remove `WorkCoordinationAdapter` — work routing is purely event-driven, no AgentMessaging involved in delivery. |
| `modules/hermes/hermes.module.ts` | Import `WorkCoordinationModule` instead of providing these services |

### Module Ownership Decision

The amendment directive asked specifically: should `AgentMessagingService` remain inside Hermes?

**Decision: NO.** AgentMessagingService moves to `work-coordination/` as PURE INFRASTRUCTURE. Rationale:
- Hermes is the organizational interface, not the A2A transport
- The Constitution says "Hermes as Organizational Interface" — making Hermes own A2A work transport would make it a hidden AI workforce orchestrator
- `work-coordination/` is generic organizational infrastructure — it serves Hermes, Work Runtime, and any future capability that needs message delivery and thread persistence
- Critically: AgentMessagingService MUST NOT invoke `runtime.execute()` — A2A work handoffs are delivered asynchronously through the Enterprise Event Fabric
- All of AgentMessagingService's dependencies (IThreadService, IParticipantResolver, etc.) move with it

---

# ADR-006 — Capability Approval Port

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** RC-005 (Three disconnected approval systems)
**Constitutional Articles:** Governance Before Automation, Progressive Autonomy

---

## Context

Three separate approval implementations exist with no consolidation:
1. `governance/services/approvals.service.ts` — simple CRUD on `ApprovalRequest`
2. `hermes/services/approval-workflow.engine.ts` — multi-step state machine on `ApprovalWorkflow`
3. `approval-chains/` — risk-tier chain resolution from `ProjectTypeVersion.approvalTemplate`

None communicate with each other. None emit events on decisions. None have a callback path to notify the requesting actor.

## Decision

Consolidate into a unified **Capability Approval Port** that provides a single interface for all approval requests, decision routing, and actor notification.

### Domain Analysis

| Implementation | Domain Concept | Decision |
|---|---|---|
| `GovernanceRulesService` | Pre-execution gating: "Should this action be allowed?" | **PRESERVE** — distinct domain |
| `ApprovalsService` | Simple approval CRUD | **CONSOLIDATE** — absorbed into ApprovalPort |
| `ApprovalWorkflowEngine` | Multi-step approval state machine | **CONSOLIDATE** — becomes ApprovalPort engine |
| `ApprovalChainsService` | Risk-tier chain resolution from template | **PRESERVE** — template resolution layer |

### Architecture

```
Capability Approval Port (approval-port/)
├── approval-port.interface.ts           ← IApprovalPort
├── approval-port.service.ts             ← Dispatches to appropriate engine
├── approval-gate.service.ts             ← Consumes IGovernanceEvaluator from governance module
├── approval-workflow.state-machine.ts   ← Multi-step workflow (from ApprovalWorkflowEngine)
├── approval-chain.resolver.ts           ← Risk-tier chain resolution (from ApprovalChainsService)
├── approval-notification.service.ts     ← Emits events, notifies actors
└── contracts/
    ├── approval-request.interface.ts
    └── approval-decision.interface.ts

governance/ (separate module, not relocated)
├── governance-rules.service.ts          ← Governance-general rule engine (PRESERVED)
└── exports: IGovernanceEvaluator port

ApprovalPort injects IGovernanceEvaluator (from governance/) for rule evaluation.
Governance module retains its rule CRUD, evaluate, audit, and anomaly routes.
```

### Interface: IApprovalPort

```typescript
// File: modules/approval-port/approval-port.interface.ts

export const APPROVAL_PORT = Symbol('APPROVAL_PORT');

export interface IApprovalPort {
  /**
   * Request approval for an action or decision.
   * Returns immediately with the approvalId.
   * The requesting actor receives the decision via event subscription.
   */
  request(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData
  ): Promise<ApprovalRequestResult>;

  /**
   * Record an approval or rejection decision.
   * Emits enterprise.approval.granted or enterprise.approval.rejected.
   */
  decide(
    decision: ApprovalDecision,
    reviewer: WorkActor,
    comment?: string
  ): Promise<ApprovalDecisionResult>;

  /**
   * Check if an action requires approval without initiating a request.
   */
  evaluateRequirement(
    context: ApprovalContext,
    actor: WorkActor
  ): Promise<ApprovalRequirement>;

  /**
   * Get the current status of an approval request.
   */
  getStatus(approvalId: string, tenantId: string): Promise<ApprovalStatus | null>;

  /**
   * Cancel a pending approval request.
   */
  cancel(approvalId: string, actorId: string, tenantId: string): Promise<void>;
}

export interface ApprovalContext {
  tenantId: string;
  projectId: string | null;
  resourceType: string;     // 'deliverable', 'expense', 'stage_completion', 'agent_action'
  resourceId: string;
  riskTier: RiskTier | null;
  priority: Priority;
  amount: number | null;    // if financial
  currency: string | null;
}

export interface ApprovalRequestData {
  title: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  expiresAt: string | null;
  workRequestId: string | null;  // links back to the work that triggered this
  correlationId: string;
}

export interface ApprovalRequestResult {
  approvalId: string;
  status: 'PENDING' | 'AUTO_APPROVED' | 'REJECTED';
  requiresHumanReview: boolean;
  expectedReviewerRole: string | null;
  estimatedResponseTime: string | null;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_REVISION';
  reason: string | null;
  revisionInstructions: string | null;
  correlationId: string;
}

export interface ApprovalRequirement {
  requiresApproval: boolean;
  riskTier: RiskTier;
  maxAutonomyLevel: number;
  reason: string | null;
}

export interface ApprovalStatus {
  approvalId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'RETURNED_FOR_REVISION';
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: WorkActor | null;
}
```

### Approval Flow

```
Actor (human or AI) → ApprovalPort.request()
  │
  ├── 1. ApprovalGate.evaluateRequirement()
  │      Checks governance rules, risk tier, project type approval template
  │      Returns: auto-approve, require human review, or block
  │
  ├── 2a. AUTO-APPROVE: return { status: 'AUTO_APPROVED' }
  │      Emit enterprise.approval.granted
  │
  ├── 2b. REQUIRE APPROVAL: create workflow
  │      Resolve chain from template (if deliverable) or from default escalation (if agent action)
  │      Create ApprovalWorkflow + ApprovalWorkflowStep rows
  │      Notify first approver
  │      Emit enterprise.approval.requested
  │
  └── 3. Approver decides → ApprovalPort.decide()
         │
         ├── APPROVED: advance workflow
         │   If final step: workflow COMPLETED
         │   Emit enterprise.approval.granted
         │   Work Runtime receives decision → work continues
         │
         ├── REJECTED: workflow FAILED
         │   Emit enterprise.approval.rejected
         │   Work Runtime receives decision → work marked as rejected
         │
         └── RETURNED_FOR_REVISION: step blocked
             Emit enterprise.approval.rejected with revisionRequired set
             Work Runtime receives → work item REVISING → resubmit
```

### Module Consolidation

**REVISED per GovernanceRulesService ownership analysis:** `GovernanceRulesService` is governance-general (not approval-specific). It stays in governance. ApprovalPort consumes it via `IGovernanceEvaluator` port.

| Current File | New Location | Change |
|---|---|---|
| `governance/services/governance-rules.service.ts` | `governance/services/governance-rules.service.ts` | **PRESERVE** — stays in governance. ApprovalPort injects via `IGovernanceEvaluator` port. |
| `governance/services/approvals.service.ts` | `approval-port/` | **CONSOLIDATE** (absorbed into ApprovalPortService, simpler CRUD is retired) |
| `hermes/services/approval-workflow.engine.ts` | `approval-port/approval-workflow.state-machine.ts` | **RELOCATE** (moves from Hermes, becomes the ApprovalPort's workflow engine) |
| `approval-chains/` | `approval-port/approval-chain.resolver.ts` | **RELOCATE** (becomes template resolution adapter within ApprovalPort) |
| `governance/governance.module.ts` | Remove `ApprovalsService` only | `GovernanceRulesService` remains. Governance module keeps Rules, Audit, Policies, Anomalies controllers. |

### Event Publishing (in ApprovalPort)

| Action | Event | Consumers |
|---|---|---|
| Approval requested | enterprise.approval.requested | Work Runtime (notifies requesting actor), Memory, Comms (notifies approver) |
| Approval granted | enterprise.approval.granted | Work Runtime (continues work), Memory, Context Plane (invalidates cache) |
| Approval rejected | enterprise.approval.rejected | Work Runtime (revises or fails work), Memory, Context Plane |
| Approval returned | enterprise.approval.rejected (with revisionRequired) | Work Runtime (enters REVISING state) |

---

# ADR-007 — Project-Finance Integration Contract

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** Project-Finance integration gap
**Constitutional Articles:** Enterprise Before Features, Event-Driven Organization

---

## Context

A project stores `budgetType`, `budgetAmount`, and `budgetCurrency` but Finance has zero awareness of projects. Recording an expense doesn't update a project's budget. Creating a project doesn't create a financial envelope. The enterprise simulation confirmed a $75,000 project budget coexists with $0.00 MTD cost and 0 finance records. The correct domain semantics must be maintained (planned budget ≠ accounting transaction).

## Decision

Define an event-based integration contract between Projects and Finance. No direct service imports. No automatic accounting synchronization. Events define the boundary.

### Domain Semantics (preserved from audit)

| Concept | Owner | Trigger | Description |
|---|---|---|---|
| Planned Budget | Project | Project creation / budget update | An estimate. Not an accounting transaction. |
| Financial Commitment | Finance | Deliverable approval, PO | A committed spend against a project. |
| Actual Expense | Finance | Money spent | Recorded as Expense with projectId. |
| Invoice | Finance | Bill received/sent | Separate concern from budget. |
| Revenue | Finance | Payment received | Independent of project budget. |

### Integration Events

```
Projects → Finance:
  enterprise.project.created
    Finance creates a budget envelope (not a transaction)
    
  enterprise.project.budget.changed
    Finance updates budget envelope

  enterprise.project.status.changed → 'COMPLETED' | 'ARCHIVED'
    Finance finalizes project financials, closes envelope

Finance → Projects:
  enterprise.finance.threshold.exceeded
    WorkRuntime notified, ApprovalPort triggered if needed
```

### Finance Context Provider (for Context Plane)

```typescript
// modules/context-plane/providers/finance-context.provider.ts
@Injectable()
export class FinanceContextProvider implements IOrganizationalContextProvider {
  readonly capabilityName = 'finance';

  constructor(
    private billingCalculator: BillingCalculatorService,
    @Inject(EVENT_TRANSPORT) private transport: IEnterpriseEventTransport,
  ) {}

  async getContext(tenantId: string, scope: ContextScope): Promise<CapabilityContext> {
    // Budget tracking per project
    const budgetTracking = scope.projectId
      ? [await this.getBudgetTracking(scope.projectId, tenantId)]
      : [];

    // MTD cost
    const now = new Date();
    const monthly = await this.billingCalculator.calculateMonthly(
      tenantId, now.getFullYear(), now.getMonth() + 1
    );

    return {
      capabilityName: 'finance',
      data: {
        mtdCost: monthly.grandTotal,
        currency: 'USD',
        budgetTracking,
        expenseCount: monthly.expenseCount,
      },
      fetchedAt: new Date().toISOString(),
      provenance: 'FinanceContextProvider.getContext()',
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
  }

  private async getBudgetTracking(projectId: string, tenantId: string) {
    // Query project budget from Project repository (via Context Plane, not direct)
    // Query expenses against that project from Expense table
    // Return { projectId, plannedBudget, spent, remaining, utilization }
  }
}
```

### Threshold Detection

```typescript
// BillingCalculatorService enhancement (in Finance module)
async recordExpense(input, tenantId): Promise<Expense> {
  const expense = await this.prisma.expense.create({ data: input });

  // Check threshold if this expense is linked to a project
  if (input.projectId) {
    const projectBudget = await this.getProjectBudget(input.projectId, tenantId);
    if (projectBudget) {
      const totalSpent = await this.getTotalSpentOnProject(input.projectId, tenantId);
      const utilization = totalSpent / projectBudget.budgetAmount;

      if (utilization >= 0.8) {
        await this.transport.publish({
          eventType: 'enterprise.finance.threshold.exceeded',
          version: 1,
          tenantId,
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          correlationId: nanoid(),
          causationId: null,
          timestamp: new Date().toISOString(),
          payload: {
            thresholdId: `budget-80pct-${input.projectId}`,
            projectId: input.projectId,
            category: 'PROJECT_BUDGET',
            currentSpend: totalSpent,
            thresholdValue: projectBudget.budgetAmount * 0.8,
            currency: projectBudget.budgetCurrency || 'USD',
            exceededBy: totalSpent - projectBudget.budgetAmount * 0.8,
            recordedBy: input.agentId || null,
          },
          idempotencyKey: `threshold.${projectBudget.budgetAmount * 0.8}.${input.projectId}`,
          sourceModule: 'finance',
        });
      }
    }
  }

  return expense;
}
```

### Module Impact

| Module | Change |
|---|---|
| `modules/projects/projects.service.ts` | Publish `enterprise.project.created` (with budget info) and `enterprise.project.budget.changed` |
| `modules/finance/services/billing-calculator.service.ts` | Publish `enterprise.finance.threshold.exceeded` when spending >= 80% of project budget |
| `modules/finance/` | New `ProjectBudgetTrackingService` — subscribes to project budget events, maintains budget envelope |
| `modules/context-plane/providers/` | New `FinanceContextProvider` — returns MTD cost, budget utilization per project |

---

# ADR-008 — Organizational Memory Ingestion Contract

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** Memory fragmentation (ingestion bridge)
**Constitutional Articles:** Organizational Memory, Enterprise Learning Loop, Business Intelligence Everywhere

---

## Context

Three memory systems exist and are correctly separated by domain concept:
1. **Agent Memory** (`memoryEntry`) — per-agent semantic/vector store
2. **Organizational Memory** (`projectMemory`) — project-scoped institutional knowledge (NOTE, INSIGHT, CONSTRAINT, RISK, OPPORTUNITY, LESSON)
3. **Hermes Runtime Memory** (`hermesMemoryEntry`) — Hermes execution context (PERSONAL/EPISODIC/PROCEDURAL)

The gap: organizational memory is NOT automatically derived from enterprise activity. Only 4 of 12 defined ProjectEventBus event types currently create memory entries (via handlers). Hermes runtime memory is siloed — agent learning from completed work does not flow into organizational memory.

## Decision

Define a **Memory Ingestion Contract** that subscribes to enterprise events and creates organizational memory entries with provenance. No merge of the three stores — they remain distinct domain concepts. The bridge is in the ingestion: events → memory.

### Memory → Event Mapping

| Enterprise Event | Memory Category | Provider | Provenance |
|---|---|---|---|
| enterprise.project.created | NOTE | ProjectMemoryService | sourceEntityType='Project', sourceEntityId=projectId |
| enterprise.project.status.changed | NOTE | ProjectMemoryService | sourceEntityType='ProjectStatus' |
| enterprise.approval.granted | NOTE (decision record) | ProjectMemoryService | sourceEntityType='Approval', sourceEntityId=approvalId |
| enterprise.approval.rejected | CONSTRAINT, RISK | ProjectMemoryService | sourceEntityType='Approval' |
| enterprise.task.completed | NOTE, INSIGHT | ProjectMemoryService | sourceEntityType='Task' |
| enterprise.eie.completeness.changed | CONSTRAINT (if score low) | ProjectMemoryService | sourceEntityType='Completeness' |
| enterprise.finance.threshold.exceeded | RISK | ProjectMemoryService | sourceEntityType='Budget', isPinned=true |
| enterprise.customer.communication.received | NOTE | ProjectMemoryService | sourceEntityType='Communication' |
| enterprise.workspace.document.created | NOTE | ProjectMemoryService | sourceEntityType='Document' |

### Memory Ingestion Adapter

```typescript
// modules/memory-ingestion/memory-ingestion-adapter.service.ts

@Injectable()
export class MemoryIngestionAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribers: (() => void)[] = [];

  constructor(
    @Inject(EVENT_TRANSPORT) private transport: IEnterpriseEventTransport,
    private projectMemory: ProjectMemoryService,
    @Optional() private agentMemory?: MemoryService,
  ) {}

  onModuleInit() {
    this.unsubscribers.push(
      this.transport.subscribe('enterprise.project.created', this.onProjectCreated.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.project.status.changed', this.onProjectStatusChanged.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.approval.granted', this.onApprovalGranted.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.approval.rejected', this.onApprovalRejected.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.task.completed', this.onTaskCompleted.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.eie.completeness.changed', this.onCompletenessChanged.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.finance.threshold.exceeded', this.onBudgetThresholdExceeded.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.customer.communication.received', this.onCommunicationReceived.bind(this), 'memory-ingestion'),
      this.transport.subscribe('enterprise.workspace.document.created', this.onDocumentCreated.bind(this), 'memory-ingestion'),
    );
  }

  onModuleDestroy() {
    this.unsubscribers.forEach(fn => fn());
  }

  private async onProjectCreated(event: EnterpriseEvent) {
    await this.projectMemory.create({
      projectId: event.payload.projectId,
      category: 'NOTE',
      content: `Project created: ${event.payload.name}`,
      authorType: 'SYSTEM',
      isAiGenerated: false,
      sourceEntityType: 'Project',
      sourceEntityId: event.payload.projectId,
    });
  }

  // ... similar handlers for other event types
}
```

### Hermes-to-Organizational Memory Bridge

When HermesRuntime completes organizational work (not personal conversation), runtime stores EPISODIC memory in HermesMemoryEntry AND publishes an event that the Memory Ingestion adapter picks up:

```typescript
// hermes-runtime.service.ts (enhancement)
// After successful execution with project-scoped work:
if (execCtx.context.projectId) {
  await this.eventBus.publish({
    eventType: 'enterprise.task.completed',
    version: 1,
    tenantId: execCtx.context.tenantId,
    actorId: execCtx.hermesAgentId,
    actorType: 'AI_AGENT',
    correlationId: execCtx.context.correlationId || nanoid(),
    causationId: null,
    timestamp: new Date().toISOString(),
    payload: {
      taskId: execCtx.sessionId,
      projectId: execCtx.context.projectId,
      status: 'COMPLETED',
      completedById: execCtx.hermesAgentId,
      completedByType: 'AI_AGENT',
      outputSummary: result.output?.substring(0, 500) || null,
    },
    idempotencyKey: `hermes.task.completed.${execCtx.sessionId}`,
    sourceModule: 'hermes',
  });
}
```

### Module Impact

| Module | Change |
|---|---|
| New `modules/memory-ingestion/` | Create `MemoryIngestionAdapter` — subscribes to 9 enterprise event types, creates ProjectMemory entries |
| `modules/hermes/services/hermes-runtime.service.ts` | Publish `enterprise.task.completed` for project-scoped work completions |
| `modules/hermes/services/hermes-memory.service.ts` | No change (remains Hermes runtime memory, separate from organizational) |
| `modules/memory/` | No change (remains agent memory, separate from organizational) |
| `modules/project-memory/` | `ProjectMemoryService` remains the ingestion target for organizational memory |

---

# ADR-009 — Module Ownership Migration

**Status:** DRAFT
**Date:** 2026-07-13
**Resolves:** Amendment 4 (Six module ownership boundary changes)
**Constitutional Articles:** All 14 — ownership clarity is foundational to the architecture

---

## Context

The Architecture Amendment §16 identified six module ownership boundaries requiring change. Each change has a unique relocation, consolidation, or redesign requirement. A coordinated migration plan is needed to prevent service disruption, circular dependencies, or lost functionality during the transition.

## Decision

Execute six coordinated ownership changes in the following order, with each change gated by the completion of the preceding change and validated by integration tests.

### Migration Sequence

| Step | Change | Predecessor | Risk |
|---|---|---|---|
| 1 | **RELOCATE**: EnterpriseEventBusService from Hermes → new `enterprise-events/` | None (no Hermes dependency) | Low — HermesRuntimeService continues emitting in-process; external consumers don't exist yet |
| 2 | **RELOCATE**: AgentMessaging, Thread, ParticipantResolver, Activity, Presence from Hermes → new `work-coordination/` | Step 1 complete (events provide alternative notification path) | Medium — HermesRuntimeService currently depends on ThreadService and ActivityService |
| 3 | **REDESIGN**: Work Runtime → new `work-runtime/` | Step 1 (event triggers), Step 2 (A2A transport available as infrastructure) | High — new bounded context, must coordinate with HermesRuntime and AgentExecutor |
| 4 | **CONSOLIDATE**: Approvals → unified `approval-port/` with shared ApprovalPort | Step 3 (Work Runtime handles decisions) | Medium — GovernanceRulesService stays in governance |
| 5 | **DEPRECATE**: `project-events/` module | Step 1 (all events migrated to new transport) | Low — in-memory bus, no external consumers |

### GovernanceRulesService Ownership Decision (REVISED)

**Code evidence (from architecture audit):** `GovernanceRulesService` is governance-general, NOT approval-specific. It owns:
- Expression-based rule engine (`evaluateTrigger`) — evaluates arbitrary context against governance rules
- Pre-execution gating — used by `AgentExecutorService` to check `{allowed, requiresApproval}` before task execution
- Governance audit trail — `getAgentAudit()` reads from `ExecutionLog`, not from approval tables
- CRUD for governance rules — manages `governanceRule` records with `BLOCK | REQUIRE_APPROVAL | LOG_ONLY` action types
- No approval-specific imports or business logic — the only `ApprovalStatus` reference is a type annotation on the audit method, not business logic
- Two external callers: `GovernanceRulesController` (CRUD + evaluate + audit) and `AgentExecutorService` (pre-execution gating)

**Decision: GovernanceRulesService REMAINS in the `governance/` module.**
- It is a general governance evaluation service, not an approval implementation
- Relocating it to ApprovalPort would create a dependency from Approvals → Governance (correct) but would also require the separate governance/ module to import approval-port/ for audit and policies — creating circular dependency risk
- The correct pattern: ApprovalPort **consumes** a governance evaluation port/interface. GovernanceRulesService stays, ApprovalPort injects it.
- Pre-execution governance gating (used by AgentExecutorService) remains in governance/ — it is unrelated to post-submission approval workflows

**New interface for governance evaluation (consumed by ApprovalPort):**

```typescript
// Defined in governance module, consumed by approval-port
export const GOVERNANCE_EVALUATOR = Symbol('GOVERNANCE_EVALUATOR');

export interface IGovernanceEvaluator {
  /**
   * Evaluate context against active governance rules.
   * Used by ApprovalPort to determine if an action requires approval,
   * and by AgentExecutorService for pre-execution gating.
   */
  evaluate(
    tenantId: string,
    context: Record<string, unknown>
  ): Promise<GovernanceEvaluation>;

  /**
   * Get governance audit for an agent.
   */
  getAgentAudit(
    agentId: string,
    tenantId: string,
    options?: { page?: number; limit?: number }
  ): Promise<GovernanceAuditEntry[]>;
}

export interface GovernanceEvaluation {
  allowed: boolean;
  requiresApproval: boolean;
  triggeredRules: string[];
  effectiveAuthority: number;
  effectiveAutonomy: number;
}
```

### Updated ADR-006 Module Consolidation Table

The original ADR-006 table listed `GovernanceRulesService` as "RELOCATE". The corrected table:

| Current File | New Location | Change |
|---|---|---|
| `governance/services/governance-rules.service.ts` | `governance/services/governance-rules.service.ts` | **PRESERVE** — stays in governance. ApprovalPort consumes via `IGovernanceEvaluator` port. |
| `governance/services/approvals.service.ts` | `approval-port/` | **CONSOLIDATE** (absorbed into ApprovalPortService, simpler CRUD is retired) |
| `hermes/services/approval-workflow.engine.ts` | `approval-port/approval-workflow.state-machine.ts` | **RELOCATE** (moves from Hermes, becomes the ApprovalPort's workflow engine) |
| `approval-chains/` | `approval-port/approval-chain.resolver.ts` | **RELOCATE** (becomes template resolution adapter within ApprovalPort) |
| `governance/governance.module.ts` | Remove `ApprovalsService` only | `GovernanceRulesService` remains in governance. Governance module keeps Rules, Audit, Policies, Anomalies. |

### Step 1: Extract EnterpriseEventBusService

```
Current: hermes/services/enterprise-event-bus.service.ts
New: enterprise-events/transport/enterprise-event-transport.service.ts

Actions:
1. Create enterprise-events/ module
2. Copy EnterpriseEventBusService to new location
3. Rename to EnterpriseEventTransportService
4. Implement IEnterpriseEventTransport interface
5. Add outbox table + background worker
6. Update hermes.module.ts to import EnterpriseEventsModule
7. HermesRuntimeService uses new interface
8. Old EnterpriseEventBusService removed from hermes/
```

### Step 2: Extract Messaging Infrastructure

```
Current: hermes/services/{agent-messaging,agent-messaging-guard,
         participant-resolver,thread,activity,presence}*
New: work-coordination/services/{same}*

Actions:
1. Create work-coordination/ module
2. Move 6 service files + all their interfaces
3. Update import paths in moved files
4. Create WorkCoordinationModule with the same providers and exports
5. Update hermes.module.ts to import WorkCoordinationModule
6. All external consumers (HermesRuntimeService) now import from work-coordination/
7. Verify no circular dependencies
```

### Step 3: Create Work Runtime Module

```
New: work-runtime/ (6 services, adapters, contracts)

Actions:
1. Create work-runtime/ module
2. Implement IWorkRuntime interface
3. Implement WorkRouter, WorkEvaluator, WorkExecutor, WorkOutputHandler, WorkApprovalCoordinator
4. Implement AgentExecutorAdapter (delegates to agents/ module)
5. Implement HermesRuntimeAdapter (delegates to hermes/ module)
6. WorkRuntime subscribes to enterprise events
7. AgentMessagingService routes through WorkRuntime when sending work requests
```

### Step 4: Consolidate Approvals → ApprovalPort

```
Move into approval-port/:
- governance/services/approvals.service.ts → approval-port/ (absorbed)
- hermes/services/approval-workflow.engine.ts → approval-port/approval-workflow.state-machine.ts
- approval-chains/ → approval-port/approval-chain.resolver.ts

PRESERVE in governance/:
- governance/services/governance-rules.service.ts — stays as governance-general rule engine
- ApprovalPort consumes GovernanceRulesService via IGovernanceEvaluator port

Actions:
1. Create approval-port/ module
2. Move files to new location, update imports
3. Implement IApprovalPort interface (approval-port.service.ts)
4. ApprovalPortService injects IGovernanceEvaluator (from governance/) for rule evaluation
5. Wire event publishing (enterprise.approval.*)
6. Update governance.module.ts (remove ApprovalsService only)
7. Update hermes.module.ts (remove ApprovalWorkflowEngine)
8. Deprecate standalone approval-chains module
```

### Step 5: Verification Gates

Each migration step must pass before the next begins:

| Step | Gate |
|---|---|
| 1 | All existing Hermes execution paths work after extracting EventBus |
| 2 | All existing A2A message paths work after extracting AgentMessaging |
| 3 | Work Runtime can receive, evaluate, execute, and complete a work item |
| 4 | ApprovalPort can process request → evaluate → notify → decide → callback cycle |
| 5 | No remaining imports from old module locations |
| 6 | project-events module removed; all consumers migrated |

### Module Impact (Consolidated)

| Current Module | Services Lost | Services Gained |
|---|---|---|
| `modules/hermes/` | EnterpriseEventBusService, AgentMessagingService, AgentMessagingGuard, ParticipantResolver, ThreadService, ActivityService, PresenceService, ApprovalWorkflowEngine | Imports from enterprise-events, work-coordination, approval-port |
| `modules/governance/` | GovernanceRulesService, ApprovalsService | Remaining: Audit, Policies, Anomalies controllers |
| `modules/approval-chains/` | Entire module | Deprecated |
| New `modules/enterprise-events/` | — | EnterpriseEventFabric, outbox, consumer inbox, projection |
| New `modules/work-coordination/` | — | AgentMessagingService, ThreadService, ParticipantResolver, ActivityService, PresenceService, AgentMessagingGuard |
| New `modules/work-runtime/` | — | WorkRouter, WorkEvaluator, WorkExecutor, WorkOutputHandler, WorkApprovalCoordinator |
| New `modules/approval-port/` | — | ApprovalPortService, ApprovalGate, WorkflowStateMachine, ChainResolver |

### Cross-Module Dependency Graph After Migration

```
HermesModule ─┐
              ├──→ work-coordination/ ←── work-runtime/ ←── enterprise-events/
              │         │                      │                   │
              │         └──→ threads/ (REST)    │                   │
              │                                  │                   │
              └──→ approval-port/ ←─────────────┘                   │
                        │                                           │
                        └──→ enterprise-events/ ────────────────────┘
```

---

# ADR-010 — EIE Root Cause Fix

**Status:** RATIFIED (corrected diagnosis — 2026-07-13)
**Date:** 2026-07-13
**Resolves:** RC-001 (EIE registration failure — CORRECTED to VERSION-NEUTRAL CONTROLLER ROUTE COLLISION)
**Constitutional Articles:** Enterprise Information Engine, Continuous Discovery

---

## Context (CORRECTED per Phase 1 runtime reconfirmation — 2026-07-13)

The Phase 1 mandatory diagnostic reconfirmation against the LIVE production runtime CORRECTED the earlier ADR-010 diagnosis. Runtime evidence (PM2 boot logs + authenticated HTTP probes) proved:

- `EngineReadController` IS correctly registered (`AppModule → ProjectsModule → InformationEngineModule → EngineReadModule`) — confirmed in deployed build
- EIE routes ARE mapped at boot: `Mapped {/api/projects/:projectId/information-requirements, GET} (version: 1)`
- The deployed build DOES contain `engine.controller.js` (NOT a stale deployment)
- Frontend calls ARE correct
- Yet authenticated requests return 404 via `GlobalExceptionFilter`

**CORRECTED ROOT CAUSE — VERSION-NEUTRAL CONTROLLER ROUTE COLLISION:**

`DigitalTwinController` is declared `@Controller('v1/projects/:projectId')` — a literal `v1/` path string with NO `version` property, making it **VERSION-NEUTRAL**. It mounts at physical base `/api/v1/projects/:projectId/*`. `EngineReadController` is declared `@Controller({ path: 'projects/:projectId', version: '1' })` and, under `setGlobalPrefix('api')` + URI versioning, ALSO resolves to physical base `/api/v1/projects/:projectId/*`.

Because `enableVersioning()` has NO `defaultVersion`, NestJS route composition places the version-neutral controller's route group in a position where it intercepts the shared base path. Requests to EngineRead's versioned sub-paths (`information-requirements`, `next-question`) fall into the DigitalTwin route space (which lacks those handlers) → 404.

**Boot-log proof:**
```
RoutesResolver  EngineReadController  {/api/projects/:projectId} (version: 1)
RoutesResolver  DigitalTwinController {/api/v1/projects/:projectId}          ← NO version (version-neutral)
RouterExplorer  Mapped {/api/projects/:projectId/information-requirements, GET} (version: 1)
```

**Cluster proof:** ALL information-engine project-scoped routes (information-requirements, next-question, interview, documents) return 404; non-EIE project routes (stages, members) return 200; version-neutral digital-twin returns 200; sibling versioned project-types/:id/packs returns 200.

**Correction vs original ADR-010:** The original ADR-010 said "NOT a route collision (method-level paths differ)" and classified it as "MULTIPLE CAUSES (missing defaultVersion + instability)." The runtime evidence proves it IS a route collision — specifically a version-neutral vs versioned collision on a shared physical base path. Missing `defaultVersion` is the contributing ENABLER, not an independent cause.

## Decision

Fix the route collision by eliminating all version-neutral controllers that share physical base paths with versioned controllers, and add `defaultVersion` as a defensive enabler. This is the only Phase 1 code change. No architecture decisions are required — this is a routing/configuration fix.

### Fix 1: Add defaultVersion

```typescript
// main.ts:62 (single line change)
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',  // ← ADD THIS
});
```

### Fix 2: Convert 4 unversioned controllers

```typescript
// DigitalTwinController (digital-twin.controller.ts:8)
// FROM:
@Controller('v1/projects/:projectId')
// TO:
@Controller({ path: 'projects/:projectId', version: '1' })

// ProjectAutomationController (project-automation.controller.ts:6)
// FROM:
@Controller('v1/projects/:projectId/automation')
// TO:
@Controller({ path: 'projects/:projectId/automation', version: '1' })

// ChiefOfStaffController (chief-of-staff.controller.ts:15)
// FROM:
@Controller('v1/projects/:projectId/cos')
// TO:
@Controller({ path: 'projects/:projectId/cos', version: '1' })

// RetailController (if exists with v1/ string path)
// Convert to same pattern
```

### Verification

After fix and rebuild:

| Diagnostic | Expected |
|---|---|
| `GET /api/v1/projects/{id}/information-requirements` | 200 OK (returns resolved questions) |
| `GET /api/v1/projects/{id}/next-question` | 200 OK (returns next question) |
| `GET /api/v1/projects/{id}/digital-twin` | 200 OK (still works) |
| `GET /api/v1/projects/{id}/automation` | 200 OK (still works) |
| Project creation → Discovery tab | Shows resolved questions instead of "No questions required" |
| OpenAPI spec | All routes present |

### Module Impact

| File | Change | Risk |
|---|---|---|
| `backend/src/main.ts:62` | Add `defaultVersion: '1'` | Low — all versioned controllers continue working as before |
| `digital-twin.controller.ts:8` | Change controller decorator | Low — method-level routes unchanged |
| `project-automation.controller.ts:6` | Change controller decorator | Low |
| `chief-of-staff.controller.ts:15` | Change controller decorator | Low |
| Retail controller (if exists) | Change controller decorator | Low |

No architecture decision required. Fix is purely operational (versioning configuration + decorator consistency).

---

# ADR-011 — Enterprise Understanding Contract

**Status:** RATIFIED (2026-07-14)
**Date:** 2026-07-14
**Enables:** Enterprise Understanding (design v2.1), Phase 10.5 (EUL)
**Constitutional Articles:** II, IV, V, VIII, XVI, XVIII, XXV, new XXVIII
**Depends on:** ADR-001 (Event Fabric), Phase 1.1 EIE reactive completeness

## Context

The Enterprise Understanding architecture (`enterprise-understanding-architecture-design.md` v2.1) makes user experience input-first and entity-agnostic: inputs from any channel become **Enterprise Understanding** (what is happening) and then **Enterprise Recommendations** (what to do). Project Types, Capability Packs, and the EIE become internal mechanisms. This ADR reserves the contracts so the Phase 2 Event Fabric taxonomy and later phases do not require a breaking retrofit. **This ADR is contract-only; no capability is implemented before Phase 10.4–10.6.**

## Decision

Define three bounded contexts as **capabilities** (Art. XVI), owning no other capability's business logic:
- `enterprise-intake` — channel-agnostic normalization (`NormalizedInput` + `InformationSource`).
- `enterprise-understanding` (the **EUL**) — entity-agnostic cognition producing `EnterpriseUnderstanding` (descriptive only).
- `enterprise-recommendation` — see ADR-013.

### Interface: IEnterpriseIntake

```typescript
export const ENTERPRISE_INTAKE = Symbol('ENTERPRISE_INTAKE');

export interface IEnterpriseIntake {
  /** Normalize any channel input into a NormalizedInput with a durable InformationSource. */
  normalize(input: RawChannelInput): Promise<NormalizedInput>;
}

export interface RawChannelInput {
  channel: 'HERMES' | 'EMAIL' | 'WHATSAPP' | 'TEAMS' | 'SLACK' | 'ZOOM' | 'VOICE'
         | 'DOCUMENT' | 'API' | 'SCHEDULED' | 'IOT' | 'ERP' | 'CRM';
  tenantId: string;
  actorId: string | null;          // null for system/inbound
  content: string | null;          // text/transcript/body
  attachments: Array<{ name: string; mimeType: string; ref: string }>;
  metadata: Record<string, unknown>;
  receivedAt: string;              // ISO 8601
}

export interface NormalizedInput {
  inputId: string;
  tenantId: string;
  channel: RawChannelInput['channel'];
  text: string;                    // normalized textual content
  attachments: RawChannelInput['attachments'];
  informationSourceId: string;     // durable EIE InformationSource (Art. V)
  provenance: Provenance;          // see ADR-012
  createdAt: string;
}
```

### Interface: IEnterpriseUnderstanding (the EUL)

```typescript
export const ENTERPRISE_UNDERSTANDING = Symbol('ENTERPRISE_UNDERSTANDING');

export interface IEnterpriseUnderstanding {
  /**
   * Produce an entity-agnostic, DESCRIPTIVE understanding of one or more inputs.
   * MUST NOT produce actions and MUST NOT commit anything. It CONSUMES the EIE
   * (resolveApplicable) and the Entity-Type registry; it owns neither.
   */
  understand(inputs: NormalizedInput[], scope: UnderstandingScope): Promise<EnterpriseUnderstanding>;
}

export interface UnderstandingScope {
  tenantId: string;
  requestedBy: WorkActor;          // reuse ADR-004 WorkActor
  hintEntityKinds?: EntityKind[];  // optional caller hint; never authoritative
}

export type EntityKind =
  | 'PROJECT' | 'CUSTOMER' | 'VENDOR' | 'CONTRACT' | 'HR_CASE' | 'INCIDENT'
  | 'PROCUREMENT' | 'ASSET' | 'INVOICE' | 'RISK' | 'OPPORTUNITY'
  | 'BOARD_DECISION' | 'POLICY' | 'AUDIT' | 'LEGAL_MATTER' | 'KNOWLEDGE_ONLY';

export interface EnterpriseUnderstanding {
  understandingId: string;
  tenantId: string;
  sourceInputIds: string[];
  subjects: SubjectHypothesis[];          // may be several
  relationships: InferredRelationship[];  // links to existing graph entities (Art. XI)
  provenance: Provenance;                 // ADR-012
  createdAt: string;
  /** INVARIANT: contains no actions; recommendations are produced by ADR-013. */
}

export interface SubjectHypothesis {
  entityKind: EntityKind;
  confidence: number;                     // 0-100 (ADR-012)
  rationale: string;                      // human-readable "why"
  /** Pre-filled Information Responses for this candidate entity kind. These are
   *  STAGING ONLY; they commit through the EIE Response API only when an action
   *  in ADR-013 is enacted. */
  proposedResponses: ProposedResponse[];
  /** Preview completeness if this entity were created with the proposedResponses. */
  previewCompleteness?: { totalRequired: number; totalResolved: number; score: number };
}

export interface ProposedResponse {
  questionId: string;                     // local id (Phase 1.1 matching invariant)
  value: unknown;                         // any JSON type (Phase 1.1 @Allow contract)
  provenance: Provenance;                 // ADR-012 (source + method + confidence)
}

export interface InferredRelationship {
  toEntityType: string;
  toEntityId: string | null;              // null = "likely new"
  relation: string;                       // e.g. 'customer', 'vendor', 'about-asset'
  confidence: number;
}
```

## Hard Invariants (contract-enforced)

1. **EUL owns no entity business logic.** It calls the EIE's `resolveApplicable` and the Entity-Type registry read-only. It never writes entities or Information Responses.
2. **Understanding is descriptive only.** `EnterpriseUnderstanding` contains subjects/relationships/pre-fills — never actions.
3. **No parallel information store.** `ProposedResponse`s persist as truth only when an ADR-013 action is enacted, and only through the EIE Response API (Phase 1.1 `ProjectCompletenessService`/response path or the equivalent for other entity kinds).
4. **Entity-agnostic by construction.** Nothing in the contract privileges `PROJECT`.
5. **Hermes is not the EUL.** Hermes calls `IEnterpriseUnderstanding` as a tool; it does not implement it (Art. VIII, new Art. XXVIII).

## Consequences

- Phase 2 Event Fabric reserves `enterprise.input.received` and `enterprise.understanding.formed` (entity-agnostic).
- Any channel (email, API, cron, Hermes) produces identical understanding.
- No implementation now; the contract prevents a breaking retrofit later.

---

# ADR-012 — Provenance & Confidence Model

**Status:** RATIFIED (2026-07-14)
**Date:** 2026-07-14
**Enables:** Explainability (Art. XII), governed auto-commit (Art. XIII)
**Constitutional Articles:** V (Information Sources), XII (Explainability), XIII (Governance), XIV (Progressive Autonomy)

## Context

Every inferred fact (`ProposedResponse`) and every recommended action (ADR-013) must be explainable and governed. A single, uniform provenance + confidence shape is required across intake, understanding, and recommendation so the UI can render provenance chips and governance can gate auto-commit.

## Decision

### Interface: Provenance (uniform, mandatory)

```typescript
export interface Provenance {
  sourceType: 'USER_INPUT' | 'DOCUMENT_EXTRACTION' | 'INTERVIEW' | 'EMAIL'
            | 'API' | 'ERP' | 'CRM' | 'AI_INFERRED' | 'SYSTEM';
  sourceRef: string | null;          // InformationSource id / document id / message id
  extractionMethod: 'DIRECT' | 'NLP_EXTRACTION' | 'LLM_INFERENCE' | 'RULE' | 'HUMAN';
  confidence: number;                // 0-100
  reviewedBy: string | null;         // actorId once a human/authorized AI confirms
  reviewedAt: string | null;
}
```

### Auto-commit governance policy (consumed by the Approval Port, ADR-006)

An inferred fact or recommended action may **auto-commit without human review** only when **both**:
1. `confidence >= AUTO_COMMIT_CONFIDENCE_THRESHOLD` (tenant-configurable; default 90), **and**
2. the action's `riskTier` (ADR-004) is `LOW`.

Otherwise it remains a proposal awaiting an `ActionDecision` (ADR-013). Segregation of duties (Art. XIII) and progressive autonomy (Art. XIV) apply: an AI Employee may *propose*; a human or higher-autonomy AI *enacts*, unless policy grants autonomy. The threshold and per-`EntityKind`/`riskTier` overrides are **governance rules** evaluated via `IGovernanceEvaluator` (ADR-009), not logic inside the EUL or Recommendation.

## Hard Invariants

1. **No inferred fact or action without provenance.** Missing provenance is a contract violation.
2. **Confidence never substitutes for governance.** Above-threshold + low-risk is *necessary but still governed* — the Approval Port is the single gate (Art. XIII).
3. **Human corrections update `reviewedBy`** and become learning signal (Phase 8 memory, Art. XIX).

## Consequences

- The UI renders a provenance chip on every inferred value and recommended action (Art. XII).
- The Approval Port (Phase 6) is the sole auto-commit authority; the EUL/Recommendation never self-authorize.

---

# ADR-013 — Enterprise Recommendation & Action Contract

**Status:** RATIFIED (2026-07-14)
**Date:** 2026-07-14
**Enables:** Enterprise Recommendation stage (design v2.1), Phase 10.6
**Constitutional Articles:** II, XIII, XIV, XVI, XVII, new XXVIII
**Depends on:** ADR-011 (Understanding), ADR-012 (Provenance/Confidence), ADR-006 (Approval Port)

## Context

Understanding ("what is happening?") must be separated from Recommendation ("what should we do?"). Recommendation turns an `EnterpriseUnderstanding` into ranked, explainable organizational actions the operator (or authorized AI) may enact. Enterprise Initiation (project creation) is **one** action kind among many.

## Decision

### Interface: IEnterpriseRecommendation

```typescript
export const ENTERPRISE_RECOMMENDATION = Symbol('ENTERPRISE_RECOMMENDATION');

export interface IEnterpriseRecommendation {
  /** Produce ranked organizational actions from an understanding. Proposes only. */
  recommend(understanding: EnterpriseUnderstanding): Promise<RecommendedAction[]>;

  /** Record a human/authorized-AI decision and, if enacting, dispatch the action
   *  to the OWNING capability's existing API under governance. */
  decide(decision: ActionDecision): Promise<ActionOutcome>;
}

export type ActionKind =
  | 'CREATE_ENTITY'      // create a Project/Customer/Vendor/HR Case/Incident/…
  | 'UPDATE_ENTITY'      // update an existing entity
  | 'ASSIGN_WORK'        // route to Work Runtime (ADR-003/004)
  | 'REQUEST_APPROVAL'   // open an approval (ADR-006)
  | 'RECORD_KNOWLEDGE'   // memory only (Art. X, XV)
  | 'ESCALATE'
  | 'SCHEDULE'           // timer/SLA/calendar
  | 'NONE';              // explicitly recommend no action

export interface RecommendedAction {
  actionId: string;
  kind: ActionKind;
  entityKind?: EntityKind;             // for CREATE/UPDATE_ENTITY
  targetEntityId?: string | null;      // for UPDATE
  title: string;                       // "Create IT incident"
  rationale: string;                   // why (Art. XII)
  confidence: number;                  // ADR-012
  governance: {                        // resolved via IGovernanceEvaluator (ADR-009)
    requiresApproval: boolean;
    riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    autoCommitEligible: boolean;       // ADR-012 policy result
  };
  /** For CREATE_ENTITY: the pre-filled responses to commit via the EIE on enact. */
  proposedResponses?: ProposedResponse[];
  provenance: Provenance;
}

export interface ActionDecision {
  actionId: string;
  understandingId: string;
  decision: 'ENACT' | 'MODIFY' | 'REJECT';
  modifiedAction?: Partial<RecommendedAction>;
  decidedBy: WorkActor;                // ADR-004
}

export interface ActionOutcome {
  actionId: string;
  status: 'ENACTED' | 'AWAITING_APPROVAL' | 'REJECTED' | 'FAILED';
  committedEntity?: { entityKind: EntityKind; entityId: string };
  approvalId?: string;                 // if routed to Approval Port
}
```

## Hard Invariants

1. **Recommendation owns no entity logic.** `decide(ENACT)` dispatches to the **owning capability's existing API** (Projects, Customers, Finance, HR, Incidents, EIE Response API, Work Runtime, Approval Port). It never creates entities or records information itself.
2. **Understanding → Recommendation → Action are distinct.** Recommendation reads an `EnterpriseUnderstanding`; it never re-interprets inputs.
3. **Every enact is governed.** `decide` routes through the Approval Port unless ADR-012 auto-commit policy is satisfied (`autoCommitEligible === true`).
4. **On enact, the owning capability's existing enterprise event fires** (e.g., `enterprise.project.created`, `enterprise.invoice.recorded`, `enterprise.hrcase.opened`) — downstream is unchanged.
5. **`RECORD_KNOWLEDGE` and `NONE` are first-class outcomes** (Art. XV, XXV) — understanding need not produce an entity.

## Consequences

- Phase 2 Event Fabric reserves `enterprise.recommendation.proposed` and `enterprise.action.decided` (entity-agnostic).
- The Approval Port (Phase 6) is the commit gate for all non-auto-commit actions.
- Enterprise Initiation (project creation) is implemented as one `CREATE_ENTITY(PROJECT)` action — not a privileged path.

# ADR-014 — Enterprise Decision Contract

**Status:** RATIFIED (2026-07-14)
**Date:** 2026-07-14
**Enables:** the bridge between cognition (Recommendation) and execution (Governed Action)
**Constitutional Articles:** VII (Human-AI Collaboration), XII (Explainability), XIII (Governance Before Automation), XIV (Progressive Autonomy), XVI (Capability-Based), XVII (Event-Driven), new XXVIII
**Depends on:** ADR-011 (Understanding), ADR-012 (Provenance/Confidence), ADR-013 (Recommendation & Action), ADR-006 (Approval Port), ADR-009 (IGovernanceEvaluator)

## Context

ADR-013 produces a *set* of `RecommendedAction`s. For an input like a tender document, NeuroCore may generate: `Create Project`, `Create Opportunity`, `Create Customer`, `Assign Sales AI`, `Wait`. **Nothing yet defines who ranks them, who resolves conflicts, whether several may execute together, and where human vs AI authority sits.** That is an architectural responsibility, not an implementation detail. Without it, the "Recommendation → Action" edge silently smuggles decision logic into the UI or into Hermes — both wrong.

The **Enterprise Decision** stage sits between cognition and execution:

```
Enterprise Understanding  (what is happening — descriptive)          [ADR-011]
      ↓
Enterprise Recommendation (candidate actions — proposals, ranked)    [ADR-013]
      ↓
ENTERPRISE DECISION       (which action(s), by whom, in what order)  [ADR-014]  ← NEW
      ↓
Governed Action(s)        (commit via owning capability + Approval)  [ADR-006/013]
```

## Decision

Introduce an **Enterprise Decision** capability (bounded context `enterprise-decision`) that turns a *set of recommendations* into a *governed, ordered execution plan* — without owning any entity or governance business logic (it **consumes** the Approval Port and `IGovernanceEvaluator`).

### Interface: IEnterpriseDecision

```typescript
export const ENTERPRISE_DECISION = Symbol('ENTERPRISE_DECISION');

export interface IEnterpriseDecision {
  /**
   * Given the recommendations for one understanding, produce a DecisionPlan:
   * prioritized, de-conflicted, composed into an ordered set of steps, with the
   * required decision authority (human/AI) resolved per step. Produces a PLAN —
   * it does not execute. Execution is dispatched via ADR-013 decide() under
   * governance (ADR-006).
   */
  plan(
    understanding: EnterpriseUnderstanding,
    recommendations: RecommendedAction[],
    context: DecisionContext,
  ): Promise<DecisionPlan>;

  /**
   * Record the authority's decision on a plan (approve plan / modify / reject),
   * then dispatch enacted steps in dependency order via ADR-013.
   */
  decidePlan(decision: PlanDecision): Promise<PlanOutcome>;
}

export interface DecisionContext {
  tenantId: string;
  decider: WorkActor;                 // ADR-004 — human or AI employee
  autonomyLevel: number;              // Art. XIV; from the decider's profile
}

export interface DecisionPlan {
  planId: string;
  understandingId: string;
  steps: DecisionStep[];              // ordered; may include parallel groups
  conflicts: ResolvedConflict[];      // what was mutually exclusive and how resolved
  requiredAuthority: DecisionAuthority; // who must approve THIS plan
  rationale: string;                  // why this ranking/composition (Art. XII)
  provenance: Provenance;             // ADR-012
}

export interface DecisionStep {
  order: number;                      // execution order
  parallelGroup?: string;             // steps sharing a group may run together
  action: RecommendedAction;          // ADR-013
  dependsOn: string[];                // actionIds that must complete first
  authority: DecisionAuthority;       // human/AI authority for THIS step
  status: 'PLANNED' | 'AWAITING_DECISION' | 'ENACTED' | 'SKIPPED' | 'FAILED';
}

export interface ResolvedConflict {
  kind: 'MUTUALLY_EXCLUSIVE' | 'DUPLICATE' | 'SUPERSEDES' | 'ORDER_DEPENDENCY';
  actionIds: string[];
  resolution: string;                 // e.g. "chose Create Customer over Update; entity was new"
  resolvedBy: 'RULE' | 'AI_RANKING' | 'HUMAN';
}

export type DecisionAuthority =
  | { mode: 'AUTO'; basis: 'AUTONOMY_AND_LOW_RISK' }        // ADR-012 auto-commit
  | { mode: 'AI_DECIDES'; agentRole: string; autonomyLevel: number }
  | { mode: 'HUMAN_DECIDES'; requiredRole: string }
  | { mode: 'ESCALATE'; toRole: string; reason: string };

export interface PlanDecision {
  planId: string;
  decision: 'APPROVE_PLAN' | 'MODIFY' | 'REJECT';
  stepOverrides?: Array<{ actionId: string; enact: boolean }>;
  decidedBy: WorkActor;
}

export interface PlanOutcome {
  planId: string;
  status: 'ENACTED' | 'PARTIALLY_ENACTED' | 'AWAITING_APPROVAL' | 'REJECTED' | 'FAILED';
  stepOutcomes: Array<{ actionId: string; outcome: ActionOutcome }>; // ADR-013
}
```

### Decision responsibilities (the five the reviewer named)

1. **Prioritization** — rank recommendations by confidence (ADR-012), business value, urgency (e.g., SLA/deadline subjects), and governance rules (`IGovernanceEvaluator`, ADR-009). Ranking is explainable (Art. XII).
2. **Composition** — determine which actions form a coherent set (e.g., `Create Customer` → then `Create Opportunity` → then `Assign Sales AI`) and encode `dependsOn` / `parallelGroup`.
3. **Conflict resolution** — resolve mutually-exclusive/duplicate/supersession conflicts (e.g., "Create Customer" vs "Update Customer" when the entity already exists) via rule → AI ranking → human, recorded as `ResolvedConflict`.
4. **Governance interaction** — the plan declares `requiredAuthority`; enacted steps still pass through the Approval Port (ADR-006). Decision never bypasses governance (Art. XIII).
5. **Human vs AI authority** — `DecisionAuthority` per step, resolved from the decider's autonomy level (Art. XIV) and the action's risk tier (ADR-012). An AI may decide low-risk within its autonomy; humans (or higher-autonomy AI) decide the rest; anything beyond authority escalates.

## Hard Invariants

1. **Decision owns no entity or governance logic.** It orchestrates; it commits nothing directly. Execution dispatches through ADR-013 `decide()` and the Approval Port (ADR-006).
2. **A plan is not execution.** `plan()` produces a reviewable `DecisionPlan`; `decidePlan()` enacts steps in dependency order, each still governed.
3. **Every plan and conflict resolution is explainable** (Art. XII) and carries provenance (ADR-012).
4. **Authority is governed, not assumed** — `DecisionAuthority` derives from autonomy (Art. XIV) + risk (ADR-012) + governance rules (ADR-009); `AUTO` mode is permitted only under ADR-012's auto-commit policy.
5. **Multi-action execution is first-class** — the contract supports ordered and parallel enactment with dependencies; "do several together" is a planned, governed operation, not an ad-hoc UI loop.
6. **Not owned by Hermes or the UI.** Both consume `IEnterpriseDecision`; neither implements ranking/conflict/authority logic (Art. VIII, XVI, new XXVIII).

## Consequences

- Phase 2 Event Fabric reserves `enterprise.decision.planned` and `enterprise.plan.decided` (entity-agnostic), in addition to the ADR-011/013 events.
- The cognition→execution bridge is now a formal capability, closing the "who chooses?" gap.
- Enterprise Initiation, HR, Procurement, Incident, etc. all flow through the same Decision stage — no per-consumer decision logic.

---

# Annex A — Consolidated Integration Contract Interfaces


This annex lists every interface that crosses module boundaries, organized by owning module. These are the definitive contracts. No capability should import another capability's implementation — only these interfaces.

## `enterprise-events/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IEnterpriseEventTransport` | `EVENT_TRANSPORT` | `EnterpriseEventsModule` |
| `EnterpriseEvent` | (type) | `enterprise-events/contracts/` |
| `EnterpriseEventHandler` | (type) | `enterprise-events/contracts/` |
| `ConsumerInboxStatus` | (type) | `enterprise-events/contracts/` |
| `ConsumerInboxEntry` | (type) | `enterprise-events/contracts/` |

## `governance/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IGovernanceEvaluator` | `GOVERNANCE_EVALUATOR` | `GovernanceModule` |
| `GovernanceEvaluation` | (type) | `governance/` |
| `GovernanceAuditEntry` | (type) | `governance/` |

## `context-plane/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IOrganizationalContextPlane` | `CONTEXT_PLANE` | `ContextPlaneModule` |
| `IOrganizationalContextProvider` | `CONTEXT_PROVIDER` | `ContextPlaneModule` |
| `CapabilityContext` | (type) | `context-plane/` |
| `ContextScope` | (type) | `context-plane/` |
| `ContextAuth` | (type) | `context-plane/` |
| `ContextAuthorization` | (type) | `context-plane/` |
| `ResolvedIdentity` | (type) | `context-plane/` |
| `AuthContext` | (type) | `context-plane/` |

## `work-runtime/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IWorkRuntime` | `WORK_RUNTIME` | `WorkRuntimeModule` |
| `IWorkRequest` | (type) | `work-runtime/contracts/` |
| `IWorkResponse` | (type) | `work-runtime/contracts/` |
| `WorkActor` | (type) | `work-runtime/contracts/` |
| `WorkTask` | (type) | `work-runtime/contracts/` |
| `WorkScope` | (type) | `work-runtime/contracts/` |
| `WorkGovernance` | (type) | `work-runtime/contracts/` |
| `WorkTiming` | (type) | `work-runtime/contracts/` |
| `WorkCorrelation` | (type) | `work-runtime/contracts/` |
| `ExpectedOutput` | (type) | `work-runtime/contracts/` |
| `WorkStatus` | (type) | `work-runtime/contracts/` |
| `WorkRouteResult` | (type) | `work-runtime/contracts/` |

## `approval-port/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IApprovalPort` | `APPROVAL_PORT` | `ApprovalPortModule` |
| `ApprovalContext` | (type) | `approval-port/contracts/` |
| `ApprovalRequestData` | (type) | `approval-port/contracts/` |
| `ApprovalDecision` | (type) | `approval-port/contracts/` |
| `ApprovalRequirement` | (type) | `approval-port/contracts/` |
| `ApprovalStatus` | (type) | `approval-port/contracts/` |

## `work-coordination/` Module Interfaces

| Interface | Token | Exported By |
|---|---|---|
| `IAgentMessaging` | `AGENT_MESSAGING` | `WorkCoordinationModule` |
| `IAgentMessagingGuard` | `AGENT_MESSAGING_GUARD` | `WorkCoordinationModule` |
| `IParticipantResolver` | `PARTICIPANT_RESOLVER` | `WorkCoordinationModule` |
| `IThreadService` | `THREAD_SERVICE` | `WorkCoordinationModule` |
| `IActivityService` | `ACTIVITY_SERVICE` | `WorkCoordinationModule` |
| `IPresenceService` | `PRESENCE_SERVICE` | `WorkCoordinationModule` |
| `IDependencyGraph` | `DEPENDENCY_GRAPH` | `WorkCoordinationModule` |

## Retained Existing Interfaces (Not Changed by Phase 0)

| Interface | Token | Module |
|---|---|---|
| `IHermesRuntime` | `HERMES_RUNTIME` | Hermes |
| `IHermesContext` | `HERMES_CONTEXT` | Hermes (will be refactored in Phase 3) |
| `IHermesRegistry` | `HERMES_REGISTRY` | Hermes |
| `IHermesSession` | `HERMES_SESSION` | Hermes |
| `IIntegrationRepository` | Repository tokens | Per module |
| `IProjectRepository` | `PROJECT_REPOSITORY` | Projects |

---

# Annex B — Enterprise Event Contract Registry

Complete registry of all 16 enterprise events with producers, consumers, and payload shapes.

| Event Type | Version | Producer | Consumers | Payload Shape |
|---|---|---|---|---|
| `enterprise.project.created` | 1 | ProjectsService.create() | Memory, ContextPlane (invalidate), Finance (create envelope) | `{projectId, name, customerId, budgetAmount, budgetCurrency, createdById}` |
| `enterprise.project.status.changed` | 1 | ProjectsService.transitionStatus() | ContextPlane (invalidate), Memory, Comms (notify) | `{projectId, fromStatus, toStatus, reason, changedById}` |
| `enterprise.project.budget.changed` | 1 | ProjectsService.update() | Finance (update envelope), Memory | `{projectId, previousAmount, newAmount, currency, changedById}` |
| `enterprise.project.timeline.changed` | 1 | ProjectsService.update() | WorkRuntime (timeline awareness), ContextPlane, Memory | `{projectId, previousTargetDate, newTargetDate, reason}` |
| `enterprise.work.requested` | 1 | WorkRuntime.route() | WorkRuntime (recipient), Memory | `{workId, workType, fromAgentId, toAgentId, taskDescription, projectId, correlationId, deadline, expectedOutputType, contextBlob}` |
| `enterprise.work.response.delivered` | 1 | WorkRuntime.handleResponse() | WorkRuntime (requester), Memory | `{workId, originalCorrelationId, respondingAgentId, responseType, outputSummary, deliverableCreated}` |
| `enterprise.approval.requested` | 1 | ApprovalPort.request() | Comms (notify approver), Memory | `{approvalId, workflowType, requestingActorId, resourceType, resourceId, projectId, riskTier, priority, expiresAt}` |
| `enterprise.approval.granted` | 1 | ApprovalPort.decide() | WorkRuntime (continue), ContextPlane (invalidate), Memory | `{approvalId, resourceType, resourceId, decision, reviewerId, reviewerType, comment, decidedAt}` |
| `enterprise.approval.rejected` | 1 | ApprovalPort.decide() | WorkRuntime (revise/fail), ContextPlane (invalidate), Memory | `{approvalId, resourceType, resourceId, decision, reviewerId, reviewerType, reason, revisionRequired, decidedAt}` |
| `enterprise.finance.threshold.exceeded` | 1 | Finance BillingCalculator | WorkRuntime (Finance AI), Comms (notify), Memory | `{thresholdId, projectId, category, currentSpend, thresholdValue, currency, exceededBy}` |
| `enterprise.eie.response.recorded` | 1 | EIE ResponseService.record() | ContinuousDiscovery, ContextPlane | `{projectId, questionId, sourceType, confidence, previousConfidence}` |
| `enterprise.eie.completeness.changed` | 1 | EIE CompletenessService.recompute() | ContinuousDiscovery (re-evaluate), WorkRuntime (trigger discovery), Memory | `{projectId, entityType, oldScore, newScore, totalRequired, totalResolved}` |
| `enterprise.task.completed` | 1 | Orchestration TasksService, HermesRuntime | Memory (record), ContinuousDiscovery, WorkRuntime | `{taskId, projectId, goalId, status, completedById, completedByType, outputSummary}` |
| `enterprise.customer.communication.received` | 1 | Google WS EmailTool, Comms | WorkRuntime (route to relevant agent), ContextPlane, Memory | `{communicationId, channel, customerId, contactEmail, subject, summary, receivedAt}` |
| `enterprise.workspace.document.created` | 1 | Google WS DocumentsTool | ContextPlane (invalidate), Memory, WorkRuntime | `{documentId, projectId, customerId, mimeType, title, createdById, createdByType, driveFileId}` |
| `enterprise.calendar.event.scheduled` | 1 | Google WS CalendarTool | WorkRuntime (timeline awareness), Comms (notify participants) | `{eventId, title, projectId, scheduledAt, startTime, endTime, participants}` |

---

# Annex C — Module Impact Matrix

Complete list of all modules affected by Phase 0 implementation.

| Module | Current Services | After Phase 0 | ADR |
|---|---|---|---|
| New `enterprise-events/` | — | EnterpriseEventFabric, outbox, consumer inbox, projections | ADR-001 |
| New `context-plane/` | — | ContextPlane aggregation, caching, 7+ providers | ADR-002 |
| New `work-runtime/` | — | WorkRouter, WorkEvaluator, WorkExecutor, WorkOutputHandler, WorkApprovalCoordinator | ADR-003, ADR-004, ADR-005 |
| New `work-coordination/` | — | AgentMessaging + Guard, Thread, ParticipantResolver, Activity, Presence | ADR-005, ADR-009 |
| New `approval-port/` | — | ApprovalPortService, Gate, WorkflowStateMachine, ChainResolver | ADR-006 |
| New `memory-ingestion/` | — | MemoryIngestionAdapter (9 enterprise event subscribers) | ADR-008 |
| `hermes/` | EnterpriseEventBusService, AgentMessagingService, ThreadService, ParticipantResolver, ActivityService, PresenceService, ApprovalWorkflowEngine | ⟵ (loses 7 services, gains imports of enterprise-events, work-coordination, approval-port) | ADR-009 |
| `governance/` | GovernanceRulesService, ApprovalsService | ⟵ (loses ApprovalsService only; GovernanceRulesService preserved. Keeps Rules, Audit, Policies, Anomalies controllers. New export: IGovernanceEvaluator port.) | ADR-006, ADR-009 |
| `approval-chains/` | ApprovalChainsService | ⟵ (entire module deprecated) | ADR-009 |
| `project-events/` | ProjectEventBus, 5 producers, 5 handlers | ⟵ (entire module deprecated — absorbed into Event Fabric) | ADR-001 |
| `events/` | EventsGateway (Socket.IO) | ⟵ (adds EventsGatewayProjectionService subscription) | ADR-001 |
| `projects/` | ProjectsService | ⟵ (publish events, ProjectsContextProvider) | ADR-002, ADR-007 |
| `customers/` | CustomersService | ⟵ (CustomersContextProvider) | ADR-002 |
| `finance/` | BillingCalculatorService, InvoiceService, etc. | ⟵ (FinanceContextProvider, threshold detection, event publishing) | ADR-002, ADR-007 |
| `orchestration/` | TasksService, WorkflowsService | ⟵ (TasksContextProvider, publish task.completed) | ADR-002 |
| `agents/` | AgentExecutorService | ⟵ (add executeAsEmployee() adapter for Work Runtime) | ADR-003 |
| `project-memory/` | ProjectMemoryService | ⟵ (MemoryContextProvider — already event-driven, add ADR-008 events) | ADR-002, ADR-008 |
| `backend/main.ts` | enableVersioning() | ⟵ add defaultVersion: '1' | ADR-010 |
| DigitalTwinController | @Controller('v1/...') | ⟵ convert to @Controller({ path, version }) | ADR-010 |
| ProjectAutomationController | @Controller('v1/...') | ⟵ convert to @Controller({ path, version }) | ADR-010 |
| ChiefOfStaffController | @Controller('v1/...') | ⟵ convert to @Controller({ path, version }) | ADR-010 |
| **Total: 20 modules affected** | | | |
| Modules with NO changes (preserved) | Auth, Users, Tenants, Plans, Packages, Departments, FeatureFlag, Prisma, Redis, Cron, Health, Logging, AI Gateway, Models, Tools, Knowledge, Workflows, Routines, Goals, Deliverables | — | — |

---

## End of Phase 0 ADRs

**Total: 14 Architecture Decision Records (ADR-001 through ADR-014)**
- ADR-001–010: original integration contracts (Phase 1 already implemented ADR-010)
- **ADR-011 — Enterprise Understanding Contract** (RATIFIED 2026-07-14; enables EUL / new Phase 5)
- **ADR-012 — Provenance & Confidence Model** (RATIFIED 2026-07-14; explainability + governed auto-commit)
- **ADR-013 — Enterprise Recommendation & Action Contract** (RATIFIED 2026-07-14)
- **ADR-014 — Enterprise Decision Contract** (RATIFIED 2026-07-14; the cognition→execution bridge: prioritization, composition, conflict resolution, authority, multi-action planning)

**Total integration contract interfaces defined: 44** (adds IEnterpriseDecision, DecisionPlan, DecisionStep, DecisionAuthority, and plan/outcome types)
**Total enterprise event contracts defined: 16 core + 7 reserved entity-agnostic** (`enterprise.input.received`, `.understanding.formed`, `.recommendation.proposed`, `.decision.planned`, `.plan.decided`, `.action.decided`, plus owning-capability create/update events)
**Total modules affected by Phase 0: 20** (understanding/intake/recommendation/decision capabilities are the new Phase 5 + 10.x surfaces, contract-reserved now)
**Delivery guarantee: AT-LEAST-ONCE with idempotent consumers (per ADR-001 amendment)**
**A2A execution flow: ASYNCHRONOUS via Event Fabric (per ADR-005 amendment)**
**Context Plane authorization: FULL/REDACTED/DENIED (per ADR-002 amendment)**
**GovernanceRulesService ownership: PRESERVED in governance/ (per ADR-009 amendment)**
**Enterprise cognition pipeline: Input → Intake → Understanding → Recommendation → Decision → Governed Action; entity-agnostic; Enterprise Initiation is one consumer (per ADR-011/012/013/014 + design v2.1)**

**Status:** ADR-001–014 RATIFIED. **ARCHITECTURE FROZEN (2026-07-14).** Ready for Phase 2 (Enterprise Event Fabric). Enterprise Understanding is repositioned as a **foundation capability at the new Phase 5** (after Work Runtime), so downstream capabilities build on it rather than retrofit to it.
**Next step:** Proceed with Phase 2 — Enterprise Event Fabric.
**Freeze rule:** No further architectural redesign unless a constitutional contradiction or critical implementation issue is discovered.
