# NeuroCore Enterprise Integration Architecture Amendment

**Date:** 2026-07-13 16:15 PKT
**Basis:** Architecture Review Amendment Directive (5 amendments)
**Status:** COMPLETE — Implementation NOT Authorized

---

## 1. Executive Amendment Summary

The original Integration Architecture Audit is accepted as a strong architectural diagnosis. The dominant finding — **Capability Islands with Context Fragmentation and Event Fragmentation (Patterns C, E, F)** — remains valid. However, five specific areas require correction before the remediation plan can be approved:

1. **Event Fabric dependency order**: The event fabric MUST precede Context Plane and Work Runtime. Code evidence proves all downstream capabilities depend on events for triggers and no event delivery exists today (Amendment 1).

2. **Event architecture precision**: The "Unified Enterprise Event Bus" concept was ambiguous and risked a central God Service. The revised architecture defines five distinct layers: Domain Events, Enterprise Events, Durable Transport, Producers, Consumers, and UI Real-Time Events (Amendment 2).

3. **EIE root cause proven**: The EIE 404 is NOT a route collision. The EngineReadController IS correctly registered and the routes ARE in the OpenAPI spec. The actual cause is likely a missing `defaultVersion` in NestJS URI versioning configuration, combined with 4 unversioned controllers creating route tree instability (Amendment 3).

4. **Module boundaries require selective correction**: 6 specific ownership boundaries need review. Three memory implementations are valid distinct domain concepts. Three approval implementations are accidental duplication. Comms/A2A embedded in Hermes is architecturally problematic (Amendment 4).

5. **Phase 11 NESP criteria must be neutral**: Removed success bias. Phase 11 verifies truth, not passing (Amendment 5).

---

## 2. Event Fabric Dependency Review

### Code Evidence: Current State

The Enterprise Event Fabric is **not a prerequisite today — it is entirely absent** except for Hermes self-emitted lifecycle events. Code evidence:

| Capability | Currently Event-Driven? | Uses EnterpriseEventBus? | Proven by |
|---|---|---|---|
| AI Employee awareness | NO — agents execute only when directly called via HTTP dispatch endpoint, sync A2A message, or LangGraph node | NO — only Hermes emits (its own lifecycle events) | `hermes-runtime.service.ts:37` — execute() called from `agent-messaging.service.ts:133` and `hermes-node.ts:29` only |
| Work Runtime triggers | NO — `AgentExecutorService.executeTask()` called from HTTP controller | NO — no subscriber calls `.subscribe()` anywhere | `grep subscribe(` across entire `src/` — zero results |
| Work request delivery | NO — synchronous `runtime.execute()` inside `send()` | NO — no event-based delivery | `agent-messaging.service.ts:132` — direct call |
| Work response delivery | NO — inline response after await | NO | `agent-messaging.service.ts:143` — synchronous await |
| Approval decision delivery | NO — DB writes + `NotificationsService.create()` (in-app) only | NO — no `emit()` in any approval file | `approval-workflow.engine.ts`, `approvals.service.ts:90` — zero emit calls |
| Finance exception awareness | NO — `BillingEventsService.emit()` writes DB only | NO — `billing-events.service.ts:19` — Prisma create, no fan-out | `billing-events.service.ts:19` |
| Timeline awareness | NO — no timeline events published anywhere | NO | Confirmed by absence |
| Memory ingestion | NO — `summarize()` called inline within execute() | NO — only `memory:updated` WebSocket event | `hermes-memory.service.ts:66` — synchronous call |
| Continuous Discovery reactions | NO — CD publishes to ProjectEventBus (separate, in-memory, different module) | NO — no bridge from ProjectEventBus to EnterpriseEventBus | `project-event-bus.service.ts` — completely separate |

### Dependency Conclusion

The Enterprise Event Fabric is an **absolute architectural prerequisite** for all nine downstream capabilities. Without it:
- AI Employees cannot be triggered by organizational events because no event delivery path exists
- Work requests cannot be delivered asynchronously because no reliable transport exists
- Approval decisions cannot reach AI Employees because no consumer subscribes
- Finance exceptions cannot trigger workforce awareness
- Memory cannot ingest from organizational activity because events don't flow
- Continuous Discovery cannot react to project state changes because ProjectEventBus is in-memory only

The current HermesRuntimeService and AgentExecutorService are **invoked directly by requesters**. There is no event-driven trigger, no subscription mechanism, no durable notification, and no work queue. Every downstream capability requires event delivery to become aware of organizational state changes.

**Revised order is architecturally necessary**: Phase 2 (Event Fabric) must precede Phase 3 (Context Plane) and Phase 4 (Work Runtime).

---

## 3. Revised Phase Dependency Graph

```
Phase 0 — Architectural Decisions and Integration Contracts
     │
     ▼
Phase 1 — EIE Runtime Integration
     │
     ▼
Phase 2 — Enterprise Event Fabric
     │
     ├────────────────────────────────────┐
     ▼                                    ▼
Phase 3 — Organizational Context Plane   │
     │                                    │
     ▼                                    │
Phase 4 — AI Employee Work Runtime ──────┤
     │                                    │
     ▼                                    │
Phase 5 — Enterprise Work Transport       │
     and AI-to-AI Handoffs                │
     │                                    │
     ▼                                    │
Phase 6 — Governance and Approval         │
          Integration                     │
     │                                    │
     ▼                                    ▼
Phase 7 — Project and Tenant Finance ────┤
          Integration                     │
     │                                    │
     ▼                                    ▼
Phase 8 — Organizational Memory ──────────┤
          Integration                     │
     │                                    │
     ▼                                    ▼
Phase 9 — Google Workspace Enterprise ────┤
          Integration                     │
     │                                    │
     ▼                                    ▼
Phase 10 — Browser Workflow Completion ───┘
     │
     ▼
Phase 11 — Full NESP Re-Execution
```

### Dependency Justification (Revised)

| Dependency | Rationale | Code Evidence |
|---|---|---|
| Phase 0 → Phase 1 | ADRs define event contracts, approval port, work handoff contracts before any implementation | Without contracts, cross-capability work violates DIP and creates hidden coupling |
| Phase 1 → Phase 2 | EIE fixes the immediate 404 and restores Discovery; event fabric needs working EIE endpoints to publish InformationResponseRecorded events | EngineReadController correct but needs `defaultVersion` fix; events need working producers |
| Phase 2 → Phase 3 | Context Plane queries capabilities for context; Event Fabric is the notification mechanism that tells Context Plane when context has changed | `hermes-context.service.ts:16` — static assembly today; no event-driven context refresh |
| Phase 2 → Phase 4 | Work Runtime is triggered by events (work request, assignment, approval decision); without Event Fabric there are no event triggers | `hermes-runtime.service.ts:37` — only called directly; no subscribers |
| Phase 2 → Phase 5 | A2A work handoff requires reliable event delivery for request/response signalling | `agent-messaging.service.ts:132` — synchronous only; no async delivery |
| Phase 2 → Phase 6 | Approval decisions must be delivered as events to notify actors; without Event Fabric decisions go to DB only | `approval-workflow.engine.ts:110`, `approvals.service.ts:90` — no emit calls |
| Phase 2 → Phase 7 | Finance exceptions must be published as events to trigger workforce awareness | `billing-events.service.ts:19` — DB write only, no fan-out |
| Phase 2 → Phase 8 | Memory ingests from enterprise events; without Event Fabric there are no events to ingest | `project-events/project-event-bus.service.ts` — in-memory, separate system |
| Phase 2 → Phase 9 | Google Workspace tools publish events when documents/emails/calendar events occur | No event publishing today |
| Phase 2 → Phase 10 | Browser UI needs real-time event projections (Socket.IO) derived from enterprise events | `events.gateway.ts:254` — typed emit helpers exist but events never flow |
| Phase 3 → Phase 4 | Work Runtime assembles organizational context before execution; needs Context Plane | `hermes-context.service.ts:16` — static assembly only |
| Phase 4 → Phase 5 | A2A work handoff routes through Work Runtime for execution, not direct messaging | `agent-messaging.service.ts:132` — currently bypasses Work Runtime |
| Phase 4 → Phase 6 | Approval integration requires AI Employee Work Runtime to handle approve/reject decisions | No decision callback exists today |
| All → Phase 10 | Browser UI actions depend on backend workflows working | N/A |
| All → Phase 11 | Full verification requires all phases complete | N/A |

---

## 4. Enterprise Event Taxonomy

### 4A. Domain Events (internal to bounded context)

Owned by the capability. Never consumed by other boundaries directly. Published to assist in internal state management.

| Event | Owner | Ownership Rationale |
|---|---|---|
| `InformationResponseSuperseded` | EIE — Responses | Internal to EIE supersession logic; other capabilities react to `CompletenessChanged` (enterprise event), not the raw supersession |
| `ProjectStageChanged` | Projects — Stages | Internal to project stage state machine; external capabilities react to `CompletenessChanged` or `WorkResolved` |
| `ApprovalStepCompleted` | Approvals — Chains | Internal to approval workflow progression; external reacts to `ApprovalGranted`/`ApprovalRejected` |
| `TaskProgressUpdated` | Orchestration — Tasks | Internal progress tracking; external reacts to `TaskCompleted` |

**Domain events remain capability-owned. No central module understands capability business logic.**

### 4B. Enterprise Events (cross-capability contracts)

Stable, versioned contracts representing organizational facts. These are the only events that cross bounded context boundaries.

| Event | Producer | Initial Consumers | Contract Version |
|---|---|---|---|
| `ProjectCreated` | Projects | Memory, WorkRuntime, ContextPlane, Finance | v1 |
| `ProjectStatusChanged` | Projects | WorkRuntime, ContextPlane, Memory | v1 |
| `ProjectBudgetChanged` | Projects | Finance, WorkRuntime, Memory | v1 |
| `WorkRequested` | WorkRuntime, Comms | WorkRuntime (receiving agent), Memory | v1 |
| `WorkResponseDelivered` | WorkRuntime | WorkRuntime (requesting agent), Memory | v1 |
| `ApprovalRequested` | WorkRuntime, Approvals | WorkRuntime (approver notification), Memory | v1 |
| `ApprovalGranted` | Approvals | WorkRuntime (original actor), Memory, ContextPlane | v1 |
| `ApprovalRejected` | Approvals | WorkRuntime (original actor), Memory, ContextPlane | v1 |
| `ExpenseThresholdExceeded` | Finance | WorkRuntime (Finance AI), Memory | v1 |
| `TimelineChanged` | Projects | WorkRuntime, ContextPlane, Memory | v1 |
| `DeadlineApproaching` | Projects (scheduler) | WorkRuntime, Comms, Memory | v1 |
| `InformationResponseRecorded` | EIE | ContinuousDiscovery, Memory, ContextPlane | v1 |
| `CompletenessChanged` | EIE | ContinuousDiscovery, WorkRuntime, Memory | v1 |
| `TaskCompleted` | Orchestration | Memory, WorkRuntime, ContinuousDiscovery | v1 |
| `CustomerCommunicationReceived` | Google WS / Comms | WorkRuntime (Sales AI), ContextPlane, Memory | v1 |
| `WorkspaceDocumentCreated` | Google WS / Comms | ContextPlane, Memory, WorkRuntime | v1 |
| `CalendarEventScheduled` | Google WS | WorkRuntime, Timeline | v1 |

**Each event contract includes:**
- `eventType: string` — qualified name (e.g., `enterprise.project.created`)
- `version: number` — integer, increments on breaking changes
- `tenantId: string` — tenant isolation
- `actorId: string` — who/what caused this event
- `actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM'`
- `correlationId: string` — traces a chain of events
- `causationId: string` — directly caused by which event
- `timestamp: string` — ISO 8601
- `payload: Record<string, unknown>` — typed per event contract
- `idempotencyKey: string` — deterministic, enables deduplication

### 4C. Durable Event Transport

The transport infrastructure is responsible for delivery, retry, idempotency, dead-letter, and consumer checkpointing. It MUST NOT contain enterprise business logic.

**Decision: In-Process (not Kafka) — Database-backed outbox pattern with in-memory fan-out, extended from existing `EnterpriseEventBusService`.**

Rationale:
- No operational requirement for Kafka (no cross-service, cross-process, or cross-DC event delivery)
- Existing codebase already has `ActivityEvent` persistence, `sourceEventId` uniqueness (idempotency), and `EventsGateway` WebSocket emission
- Adding Kafka would add operational complexity (ZooKeeper/Kraft, topic management, consumer group management) without immediate need
- Future Kafka adoption remains open if cross-process event delivery is required

**Transport contract (not a service — an infrastructure adapter):**

```typescript
interface IEnterpriseEventTransport {
  publish(event: EnterpriseEvent): Promise<void>;
  // persistence, retry (3 attempts, exponential backoff), dead-letter after max retries
}
```

The transport adapter:
- Writes to `EnterpriseEventOutbox` table (new table, not `ActivityEvent` — separates transport from projection)
- Background worker polls outbox, delivers to in-memory EventEmitter, marks as delivered
- Retries with exponential backoff (3 attempts, 1s/4s/16s)
- Dead-letter to `EnterpriseEventDeadLetter` table after 3 failed deliveries
- Supports replay of previously delivered events (for consumer recovery)

### 4D. Event Producers

Capabilities publish events through the transport adapter. The event fabric does not know how capabilities perform their business logic.

```typescript
// Each capability module injects IEnterpriseEventTransport
// and publishes domain-orchestrated enterprise events

// ProjectsService example:
class ProjectsService {
  constructor(@Inject(EVENT_TRANSPORT) private transport: IEnterpriseEventTransport) {}

  async create(input, tenantId) {
    const project = await this.repository.create(input, tenantId);
    await this.transport.publish({
      eventType: 'enterprise.project.created',
      version: 1,
      tenantId,
      actorId: input.createdById,
      actorType: 'HUMAN',
      correlationId: nanoid(),
      causationId: null,
      timestamp: new Date().toISOString(),
      payload: { projectId: project.id, name: project.name, budget: project.budgetAmount },
      idempotencyKey: `project.created.${project.id}`
    });
    return project;
  }
}
```

### 4E. Event Consumers

Consumers belong to the capability reacting to an enterprise fact. Each consumer independently decides what the event means inside its own bounded context.

```typescript
// Example: MemoryConsumer — in memory module, not in event module
class MemoryConsumer implements OnModuleInit {
  constructor(
    @Inject(EVENT_TRANSPORT) private transport: IEnterpriseEventTransport,
    private projectMemory: ProjectMemoryService
  ) {}

  onModuleInit() {
    this.transport.subscribe('enterprise.project.created', this.onProjectCreated.bind(this));
    this.transport.subscribe('enterprise.approval.granted', this.onApprovalGranted.bind(this));
  }

  private async onProjectCreated(event: EnterpriseEvent) {
    // Memory module decides what this event means in its context
    await this.projectMemory.create({
      projectId: event.payload.projectId,
      category: 'NOTE',
      content: `Project created: ${event.payload.name}`,
      authorType: 'SYSTEM',
      isAiGenerated: false,
      sourceEntityType: 'Project',
      sourceEntityId: event.payload.projectId
    });
  }
}
```

### 4F. UI Real-Time Events

Socket.IO/WebSocket notifications are presentation projections. They must be explicitly separated from durable enterprise event delivery.

**Architecture:**
```
Enterprise Event (durable, persisted, retried)
  ↓
EnterpriseEventTransport delivers to subscribers
  ↓
EventsGateway (optional projection layer)
  ↓
Socket.IO → Browser client (non-durable, real-time only)
```

**Rule: A WebSocket notification is NEVER proof of enterprise event delivery.**

The `EventsGateway` remains in the `events/` module. It should subscribe to Enterprise Events and project them to WebSocket rooms. It should NOT be the primary event delivery mechanism.

**Changes:**
- Rename `EnterpriseEventBusService` → `EnterpriseEventFabric`
- Move from `hermes/` to new `enterprise-events/` module
- Separate transport (durable, persisted, retried) from UI projection (Socket.IO, ephemeral)
- `EventsGateway` remains presentation layer, subscribes to transport for WebSocket fan-out

---

## 5. Durable Event Transport Architecture

### Transport Pattern: Outbox + In-Memory Fan-Out

```
Producer
  └─→ transport.publish(event)
       │
       ├─→ 1. Write to `EnterpriseEventOutbox` (DB)
       │        { id, eventType, version, tenantId, actorId, correlationId,
       │          causationId, payload (JSON), idempotencyKey, status: 'PENDING',
       │          retryCount: 0, createdAt }
       │
       └─→ 2. Background worker (poll, 1s interval)
              │
              ├─→ 3. Fetch PENDING events ordered by createdAt
              │
              ├─→ 4. For each event:
              │      │
              │      ├─→ Write to consumer inboxes:
              │      │     { eventId, consumerId, status: 'PENDING', createdAt }
              │      │
              │      ├─→ Emit to in-memory EventEmitter:
              │      │     emitter.emit(event.eventType, event)
              │      │     each consumer handler receives event
              │      │
              │      └─→ Mark delivered: SET status = 'DELIVERED', deliveredAt
              │
              └─→ 5. Retry (3 attempts, exponential backoff: 1s/4s/16s)
                     │
                     ├─→ Update retryCount, lastError
                     │
                     └─→ After max retries:
                           SET status = 'DEAD_LETTER'
                           Write to `EnterpriseEventDeadLetter` table
```

### Consumer Idempotency (Inbox Pattern)

```typescript
// Each consumer maintains an inbox per event:
interface ConsumerInbox {
  id: string;
  eventId: string;
  consumerId: string;       // 'memory', 'work-runtime', 'context-plane', etc.
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  errorMessage?: string;
  createdAt: Date;
  processedAt?: Date;
}

// UNIQUE constraint: (eventId, consumerId)
// This guarantees exactly-once processing per consumer
```

### Dead-Letter Table

```typescript
interface EnterpriseEventDeadLetter {
  id: string;
  originalEventId: string;
  eventType: string;
  payload: Json;
  retryCount: number;
  lastError: string;
  lastAttemptAt: Date;
  status: 'RETRYABLE' | 'PERMANENT';
  createdAt: Date;
}
```

### How This Avoids Becoming a God Service

| Risk | Mitigation |
|---|---|
| God Service | Transport has NO business logic. It only persists, delivers, retries. Business decisions are inside consumers. |
| Central Orchestrator | Transport does NOT decide which consumers handle which events. Event type → consumer registration is done by consumers themselves via `subscribe()`. |
| Shared Business Logic | Transport has zero domain knowledge. It delivers `Record<string, unknown>` payloads. Consumers interpret types. |
| Hidden DIP Violation | Transport depends on `EnterpriseEvent` interface only. Capabilities depend on `IEnterpriseEventTransport` interface. Both depend on abstractions. |
| Coupling | Producers don't know consumers. Consumers don't know producers. Both know only the event contract. |

---

## 6. Producer and Consumer Ownership Model

| Enterprise Event | Producer Module | Producer Method | Consumer Modules |
|---|---|---|---|
| `enterprise.project.created` | Projects | `create()` | Memory, WorkRuntime, ContextPlane, Finance |
| `enterprise.project.status.changed` | Projects | `transitionStatus()` | WorkRuntime, ContextPlane, Memory, Comms |
| `enterprise.project.budget.changed` | Projects | `update()` | Finance, WorkRuntime, Memory |
| `enterprise.work.requested` | WorkRuntime | `route()` | WorkRuntime (target agent), Memory, Comms |
| `enterprise.work.response.delivered` | WorkRuntime | `handleResponse()` | WorkRuntime (source agent), Memory |
| `enterprise.approval.requested` | WorkRuntime / Approvals | `request()` | WorkRuntime (approver), Comms, Memory |
| `enterprise.approval.granted` | Approvals | `advance()`, `review()` | WorkRuntime (original actor), Memory, ContextPlane |
| `enterprise.approval.rejected` | Approvals | `advance()`, `review()` | WorkRuntime (original actor), Memory, ContextPlane |
| `enterprise.finance.threshold.exceeded` | Finance | `recordExpense()` | WorkRuntime (Finance AI), Comms, Memory |
| `enterprise.project.timeline.changed` | Projects | `update()` | WorkRuntime, ContextPlane, Memory, Comms |
| `enterprise.project.deadline.approaching` | Projects (cron) | scheduler tick | WorkRuntime, Comms, Memory |
| `enterprise.eie.response.recorded` | EIE | `record()` | ContinuousDiscovery, Memory, ContextPlane |
| `enterprise.eie.completeness.changed` | EIE | `recompute()` | ContinuousDiscovery, WorkRuntime, Memory |
| `enterprise.task.completed` | Orchestration | `updateStatus()` | Memory, WorkRuntime, ContinuousDiscovery |
| `enterprise.customer.communication.received` | Google WS / Comms | tool handler | WorkRuntime (Sales AI), ContextPlane, Memory |
| `enterprise.workspace.document.created` | Google WS | tool handler | ContextPlane, Memory, WorkRuntime |

**Key rule: Enterprise events are defined by their type string, versioned, and registered in an event registry. The transport does not enforce which consumers exist — consumers self-register.**

---

## 7. UI Real-Time Event Separation

### Current (Broken) State

```
EnterpriseEventBusService.emit()
  └─→ ActivityService.record() — persisted
  └─→ EventsGateway.emitToTenant() — Socket.IO
  └─→ EventsGateway.emitToRoom() — Socket.IO
```
Socket.IO is mixed with persistence. Socket.IO 400 errors break both real-time and notifications.

### Target State

```
transport.publish(event)
  └─→ EnterpriseEventOutbox (durable, persisted)
  └─→ Background worker delivers to consumers
       └─→ Memory consumer
       └─→ WorkRuntime consumer
       └─→ ContextPlane consumer
       └─→ EventsGateway projection (separate concern)
            └─→ Socket.IO → Browser (non-durable)
```

**Changes:**
- `EnterpriseEventBusService` is renamed and moved out of Hermes
- Socket.IO is NOT the event transport — it's a projection layer
- Socket.IO failures do not affect enterprise event delivery
- `EventsGateway` subscribes to the transport for WebSocket projections
- The `activity:new` Socket.IO event becomes a projection of `enterprise.*` events

**Socket.IO can still break (as it does now) without losing events.** Events persist in the outbox and consumer inboxes. When Socket.IO recovers, it replays recent projections.

---

## 8. EIE Diagnostic Gate

### Diagnostic Evidence Table

| # | Diagnostic | Expected | Actual | Evidence | Conclusion |
|---|---|---|---|---|---|
| D1 | NestJS enableVersioning called in bootstrap | YES | YES — `app.enableVersioning({ type: VersioningType.URI })` | `main.ts:62` | ✅ Configured |
| D2 | defaultVersion set | YES or NO — either works if controller patterns are consistent | **NO** — missing from config | `main.ts:62` — no `defaultVersion` property | ❌ Gap — see D8 |
| D3 | InformationEngineModule in NestJS import chain | Controllers registered at boot | YES — `AppModule→ProjectsModule→InformationEngineModule→EngineReadModule→EngineReadController` | `app.module.ts:197`, `projects.module.ts:25`, `information-engine.module.ts:31`, `engine-read.module.ts:24` | ✅ Complete |
| D4 | EngineReadController decorator syntax | Correct path + version | YES — `@Controller({ path: 'projects/:projectId', version: '1' })` | `engine.controller.ts:29` | ✅ Correct |
| D5 | Controller method route decorators | Correct sub-paths | YES — `@Get('information-requirements')`, `@Get('next-question')` | `engine.controller.ts:43,49` | ✅ Correct |
| D6 | OpenAPI spec includes EIE routes | Routes appear in generated spec | YES — both routes present in `openapi.json:16494-16549` | `openapi/openapi.json` | ✅ Registered |
| D7 | Module exports controller | Controller array set | YES — `controllers: [EngineReadController]` | `engine-read.module.ts:24` | ✅ Exported |
| D8 | Unversioned controllers with `v1/` string path sharing same prefix | None | **4 controllers**: DigitalTwin (`v1/projects/:projectId`), ProjectAutomation (`v1/projects/:projectId/automation`), ChiefOfStaff (`v1/projects/:projectId/cos`) | `digital-twin.controller.ts:8`, `project-automation.controller.ts:6`, `chief-of-staff.controller.ts:15` | ❌ Pattern conflict — see analysis |
| D9 | DigitalTwinController method-level routes conflict with EIE | No overlap | CONFIRMED — DigitalTwin uses `digital-twin` and `timeline` sub-paths; EngineRead uses `information-requirements` and `next-question` — no direct overlap | `digital-twin.controller.ts` methods | ✅ No collision |
| D10 | Frontend API base URL | `/api/v1` | YES — `baseURL: '/api/v1'` | `services/api.ts:14` | ✅ Correct |
| D11 | Frontend EIE URL | Correct full path | YES — `api.get('/projects/${id}/information-requirements')` resolves to `/api/v1/projects/{id}/information-requirements` | `projectTypes.service.ts:136` | ✅ Correct |
| D12 | Auth guard returns 404 vs 401 | JwtAuthGuard returns 401 | YES — `UnauthorizedException`, not 404 | `jwt-auth.guard.ts:13` | ✅ Not blocking |
| D13 | CSRF middleware blocks GET | GET is exempt | YES — GET exempted; CSRF only checks POST/PUT/PATCH/DELETE | `csrf.middleware.ts:60` | ✅ Not blocking |
| D14 | DI dependencies resolvable | All providers available | YES — RequirementsModule, CompletenessModule, ResponsesModule, ProjectTypePacksModule, ProjectTypesModule all imported in EngineReadModule | `engine-read.module.ts:18-22` | ✅ Resolvable |
| D15 | Module not rebuilt after edit | Runtime code matches source | EngineReadController modified Jul 12 10:41; most files Jul 11 00:28. If server not rebuilt, routes from before versioning fix are running. | `ls -la engine.controller.ts` vs other files | ⚠️ Possible mismatch |
| D16 | ProjectTypesService injection works | Controller has 6 di deps | YES — all imported modules provide required services | Controller constructor lines 33-39 | ✅ Provided |

### Root Cause Analysis

**The EIE routes ARE correctly designed, registered in NestJS, and present in the OpenAPI spec.** The 404 is NOT caused by:
- Missing module imports ❌
- Wrong controller path ❌
- Frontend URL mismatch ❌
- Guard/CSRF rejection ❌
- DI failure ❌
- Route collision with DigitalTwin ❌

**Most likely root cause (primary): Missing `defaultVersion` in NestJS URI versioning configuration.**

With `enableVersioning({ type: VersioningType.URI })` and **no** `defaultVersion`:
- Versioned controllers (`{ path: '...', version: '1' }`) → accessible at `/api/v1/...` ✅
- Unversioned controllers (`'v1/...'` string path) → NOT mapped to versioned route tree at all → 404 ❌

The 4 unversioned controllers (DigitalTwin, ProjectAutomation, ChiefOfStaff, Retail) mount Express routes at `v1/projects/...` that live OUTSIDE the versioned route tree. When NestJS resolves `/api/v1/projects/{id}/information-requirements`, the URI versioning middleware strips `v1`, matches to version `'1'` route tree, and finds EngineReadController. This SHOULD work.

**BUT:** The combination of unversioned controllers at the same base path can confuse NestJS v11's internal route resolution, particularly if:
- The unversioned controller routes are matched first (Express middleware order depends on module registration order)
- DigitalTwinModule is imported in `AppModule` (top-level) while InformationEngineModule enters through `ProjectsModule` (nested). NestJS may register DigitalTwin's Express routes before EngineRead's routes
- If a 404 Express route from an unversioned controller is registered first, Express may short-circuit the search

**Fix recommended in order of confidence:**
1. Add `defaultVersion: '1'` to `enableVersioning()` — likely fixes the issue for all versioned controllers
2. Convert the 4 unversioned controllers to `@Controller({ path: '...', version: '1' })` — eliminates the pattern inconsistency

### EIE Root Cause Classification

**FINAL CLASSIFICATION: MULTIPLE CAUSES**

| Cause | Fix | Priority |
|---|---|---|
| Missing `defaultVersion: '1'` in `enableVersioning()` | Add to `main.ts` line 62 | HIGH — fixes all versioned controller routes |
| 4 controllers using incompatible string `v1/` path pattern | Convert to `@Controller({ path, version: '1' })` | HIGH — eliminates route tree instability |
| Runtime code may not match source after Jul 12 edit | Verify build + restart | MEDIUM — deployment hygiene |

---

## 9. EIE Root Cause Classification Rules

After the EIE Diagnostic Gate, root causes must be classified using these rules:

| Classification | Condition | Action |
|---|---|---|
| ROUTE COLLISION | Two controllers with same path + same method-level route | Rename one controller path |
| CONTROLLER REGISTRATION FAILURE | Controller not in any module's `controllers` array | Add to appropriate module |
| MODULE VISIBILITY FAILURE | Controller registered but its module not imported by AppModule | Add import chain |
| FRONTEND API CONTRACT MISMATCH | Frontend calls different path than backend exposes | Align either frontend or backend path |
| AUTHORIZATION / TENANT RESOLUTION FAILURE | Guard returns 404 instead of 401/403 | Fix guard to return correct status code |
| RESOLVER FAILURE | Question packs or information requirements resolution fails | Fix RequirementsService or seed data |
| SEED / LINKAGE FAILURE | Project Types not linked to Question Packs | Create missing ProjectTypePack records |
| VERSION MISMATCH | Backend versioned controller expects `v1` but frontend sends `v2` | Align versions |
| MULTIPLE CAUSES | Two or more of the above | Fix each independently |

For EIE specifically, the classification is **MULTIPLE CAUSES**: missing `defaultVersion` + unversioned controller pattern inconsistency.

---

## 10. Selected Module Ownership Review

### Overview

The original audit statement "All 57+ module boundaries are valid" is **too categorical**. Six specific areas require ownership reassessment:

| Area | Current Owner | Assessment |
|---|---|---|
| Communications / A2A | Hermes | **RELOCATE** — Extract from Hermes |
| Approvals | 3 modules (governance, hermes, approval-chains) | **CONSOLIDATE** — Two distinct domains with accidental duplication |
| Memory | 3 modules (memory, project-memory, hermes) | **PRESERVE** — Three valid distinct domain concepts |
| Enterprise Events | Hermes + events + project-events | **RELOCATE** — Extract to dedicated module |
| AI Employee Work Runtime | agents (executor) + orchestration (metadata) | **REDESIGN** — Formalize as bounded context |
| AgentMessaging | Hermes only | **RELOCATE** — Extract with Comms |

---

## 11. Communications and AI-to-AI Ownership Decision

### Current Owner: Hermes

`AgentMessagingService` is implemented in `hermes/services/`, provided and exported by `HermesModule`, and consumed by **zero modules outside Hermes**. All its dependencies (IThreadService, IAgentMessagingGuard, IParticipantResolver, IActivityService, IHermesRuntime, HermesSessionService) are Hermes-internal.

The `threads/` module is a thin REST facade that directly imports `ThreadService` from `../hermes/services/thread.service`. It has no independent business logic.

### Correct Domain Owner

Organizational work transport should be owned by a **dedicated Comms and Work Coordination capability**, NOT by Hermes.

**Rationale:**
- Hermes is the organizational interface (constitutional article). It routes queries to the right agent. It should not be the transport layer for AI Employee-to-AI Employee work.
- The Constitution says: "Hermes as Organizational Interface" — Hermes must NOT become a hidden AI workforce orchestrator.
- Work handoffs are an organizational coordination concern, not a Hermes concern.
- AgentMessagingService is already designed with clean interfaces (IAgentMessaging, IAgentMessagingGuard). It can be extracted cleanly.

### Decision

| Property | Value |
|---|---|
| Current owner | Hermes |
| Correct owner | New: `work-coordination/` module (or `comms/` renamed to `work-coordination/`) |
| Infrastructure owner | Same (transport and routing are domain concerns here) |
| Public contract | `IAgentMessaging` (exists, move with service) |
| Existing duplication | None — AgentMessagingService is the only A2A implementation |
| Relocation required | **RELOCATE** — Extract AgentMessagingService, AgentMessagingGuard, ParticipantResolver, ActivityService, ThreadService into a new `work-coordination/` module |

**Migration:**
1. Create `work-coordination/` module in `src/modules/`
2. Move: AgentMessagingService, AgentMessagingGuard, ParticipantResolver, ActivityService, ThreadService, ThreadSummarizationService
3. Interfaces move with their implementations
4. HermesModule imports `WorkCoordinationModule` instead of owning these services
5. ThreadService continues to work — it was always a generic thread/message service, not Hermes-specific

**Actors affected:** HermesRuntimeService (injects IHermesEventBus, HermesSessionService — both stay in Hermes). The extracted services are infrastructure/comms, not Hermes core.

---

## 12. Approval Domain Analysis

### Three Implementation Assessment

| System | Module | Domain Concept | Valid? |
|---|---|---|---|
| `governance/services/approvals.service.ts` | `governance/` | Resource-level approval request (simple CRUD: create → approve/reject/cancel for any resourceType) | **Duplicated** — overlaps with ApprovalWorkflowEngine |
| `governance/services/governance-rules.service.ts` | `governance/` | Pre-execution governance gating (expression engine evaluating rules against context) | **Distinct** — rule evaluation before execution |
| `hermes/services/approval-workflow.engine.ts` | `hermes/` | Multi-step sequential approval workflow (state machine, step-by-step advancement) | **Valid** — full workflow engine |
| `approval-chains/approval-chains.service.ts` | `approval-chains/` | Risk-tier-based chain resolution from ProjectTypeVersion.approvalTemplate | **Valid** — template resolution for deliverables |

### Analysis

**Two valid distinct domains:**
1. **Governance Rules** — Pre-execution evaluation: "Should this action be allowed?" Returns `{allowed, requiresApproval}`. Owned by Governance.
2. **Approval Workflow** — Post-submission processing: "Who needs to approve this, in what order?" Multi-step state machine. Owned by a unified Approval capability.

**One accidental duplication:**
- `governance/services/approvals.service.ts` (simple CRUD on `approvalRequest` table) and `hermes/services/approval-workflow.engine.ts` (state machine on `ApprovalWorkflow/ApprovalWorkflowStep`) represent the **same domain concept** — recording and processing approval requests — but at different levels of maturity. The Hermes one is the more complete implementation.

**Recommendation:**
- `GovernanceRulesService` remains in Governance (distinct domain)
- `ApprovalWorkflowEngine` + `ApprovalsService` → **CONSOLIDATE** into Approvals module
- `ApprovalChainsService` → keep in Approvals (template resolution is adjacent to approval)
- The Capability Approval Port (Phase 0 ADR) surfaces a single `IApprovalPort.request()` and `IApprovalPort.decide()` interface that delegates to the appropriate implementation

### Decision

| System | Decision | Rationale |
|---|---|---|
| GovernanceRulesService | **PRESERVE** in governance/ | Distinct domain: pre-execution gating, expression-based, not a workflow |
| ApprovalsService (governance) | **CONSOLIDATE** into Approvals | Same concept as ApprovalWorkflowEngine, simpler CRUD variant |
| ApprovalWorkflowEngine (hermes) | **RELOCATE** into Approvals | Full state machine, should not live in Hermes |
| ApprovalChainsService | **CONSOLIDATE** into Approvals | Adjacent to approval domain, template resolution |

---

## 13. Memory Domain Analysis

### Three Implementation Assessment

| System | Table | Key | Domain Concept | Valid? |
|---|---|---|---|---|
| `memory/memory.service.ts` | `memoryEntry` | `agentId` | Agent long-term memory (semantic/vector, OpenAI embeddings, per-agent) | ✅ **Valid distinct concept** |
| `project-memory/project-memory.service.ts` | `projectMemory` | `projectId` | Organizational/project institutional knowledge (NOTE, INSIGHT, RISK, etc.) | ✅ **Valid distinct concept** |
| `hermes/services/hermes-memory.service.ts` | `hermesMemoryEntry` | `hermesAgentId` | Hermes runtime conversation/execution context (PERSONAL/EPISODIC/PROCEDURAL) | ✅ **Valid distinct concept** |

**These are not duplicates.** They represent three different concerns:
1. **Agent Memory** (`memoryEntry`): What an AI agent has learned and can recall. Shared with `chat.tool` and `context.tool`. Vector-searchable.
2. **Organizational Memory** (`projectMemory`): What the organization knows about projects. Structured categories, provenance-tracked, event-driven ingestion. Not vector-searchable (search is ILIKE-based).
3. **Hermes Runtime Memory** (`hermesMemoryEntry`): What Hermes needs to maintain conversation continuity. Used for LangGraph context assembly. Types: PERSONAL/EPISODIC/PROCEDURAL.

### Decision

| System | Decision | Rationale |
|---|---|---|
| `memory/memory.service.ts` | **PRESERVE** | Agent knowledge store |
| `project-memory/project-memory.service.ts` | **PRESERVE** | Organizational institutional knowledge |
| `hermes-memory.service.ts` | **PRESERVE** | Hermes runtime context; keep in Hermes |

**Ingestion bridge (new):** When HermesRuntime completes organizational work and stores EPISODIC memory, a bridge should copy relevant organizational knowledge to `projectMemory` if the work was project-scoped.

---

## 14. Event Ownership Decision

### Current State

| Event System | Module | Owner |
|---|---|---|
| EventsGateway (Socket.IO) | `events/` | Events module |
| EnterpriseEventBusService (persisted write-through) | `hermes/services/` | **Hermes** (wrong) |
| ProjectEventBus (in-memory) | `project-events/` | Project Events module |

### Decision: Extract EnterpriseEventBusService from Hermes

| Property | Value |
|---|---|
| Current owner | Hermes (`hermes/services/enterprise-event-bus.service.ts`) |
| Correct owner | New: `enterprise-events/` module |
| Infrastructure owner | Same module owns transport adapter |
| Public contract | `IEnterpriseEventTransport` (new, replaces `IHermesEventBus`) |
| Existing duplication | `ProjectEventBus` is separate in-memory system — will be absorbed into unified transport |
| Relocation required | **RELOCATE** and **REDESIGN** |

**Changes:**
1. Create `enterprise-events/` module
2. Move `EnterpriseEventBusService` from Hermes
3. Rename: `EnterpriseEventBusService` → `EnterpriseEventFabric`
4. New interface: `IEnterpriseEventTransport` (replaces `IHermesEventBus`)
5. `ProjectEventBus` is deprecated — its event producers (Tasks, Goals, Stages, Health, CD) are migrated to the new transport
6. `HermesModule` removes `EnterpriseEventBusService` from its providers and exports
7. Remaining Hermes-specific events use in-process EventEmitter or direct calls

### Which Module Owns Event Contracts?

| Contract Artifact | Owner |
|---|---|
| Event type strings (registry) | `enterprise-events/` — maintains the registry |
| Per-event payload types | **Capability modules** — each capability defines its own event payload |
| Transport interface | `enterprise-events/` — defines `IEnterpriseEventTransport` |
| Transport implementation | `enterprise-events/` — outbox pattern, retry, dead-letter |
| Consumer registration | Each consumer module — calls `transport.subscribe(eventType, handler)` in `onModuleInit()` |

**No capability surrenders business event ownership to the transport layer.**

---

## 15. AI Employee Work Runtime Ownership Decision

### Current State

| Function | Module | Location |
|---|---|---|
| Task execution | `agent-executor.service.ts` | `agents/` module |
| Governance pre-check | `GovernanceRulesService` | `governance/` (injected by agents) |
| Task metadata | `tasks.service.ts` | `orchestration/` module |
| Workflow metadata | `workflows.service.ts` | `orchestration/` module |

### Decision

| Property | Value |
|---|---|
| Current owner | Distributed: agents/ (execution), orchestration/ (metadata) |
| Correct domain owner | New: `work-runtime/` module |
| Infrastructure owner | Same |
| Public contract | `IWorkRuntime` (new interface) |
| Existing duplication | None (agents/ is the single execution engine) |
| Ownership needed | **REDESIGN** — Formalize as bounded context |

**Correct bounded context:** `work-runtime/` — The AI Employee Work Runtime is an organizational execution capability. It should own:
- Work reception (event-triggered + explicit dispatch)
- Work evaluation (responsibility, authority, autonomy)
- Work execution (delegates to HermesRuntime or AgentExecutor)
- Work output handling
- Work lifecycle state management
- Work queue

**Why not keep it in `agents/`?** The `agents/` module is about Agent entity management (create, update, configure). The Work Runtime is about organizational execution — receiving work, evaluating it, delegating to agents, handling results. These are different concerns per SRP.

**Why not keep it in `orchestration/`?** The `orchestration/` module currently owns task/workflow metadata CRUD. It does NOT own execution. Making it own both metadata and execution would violate SRP.

**Where does `agent-executor.service.ts` go?** The execution engine stays in `agents/` as a lower-level concern. The Work Runtime calls `AgentExecutorService` or `HermesRuntimeService` for actual LLM execution, but adds the organizational layer (responsibility checks, authority evaluation, work output routing).

**HermesRuntimeService remains in Hermes.** The Work Runtime may delegate LLM execution to Hermes, but Hermes is not the Work Runtime.

---

## 16. Revised Module Boundary Conclusion

**The major bounded contexts appear preservable; however, selected ownership boundaries require relocation, consolidation, domain/infrastructure separation, or redesign.**

### Affected Boundaries

| Area | Decision | Detail |
|---|---|---|
| Communications / A2A | **RELOCATE** | Extract AgentMessaging + Thread + ParticipantResolver from Hermes to new `work-coordination/` module |
| Approvals (3 systems) | **CONSOLIDATE** | GovernanceRules preserved; ApprovalsService + ApprovalWorkflowEngine + ApprovalChains merged into Approvals as unified ApprovalPort |
| Memory (3 systems) | **PRESERVE** | All three are valid distinct concepts. Add ingestion bridge from HermesMemory → ProjectMemory for organizational-relevant agent completions |
| Enterprise Events | **RELOCATE** | Extract EnterpriseEventBusService from Hermes to new `enterprise-events/` module. Deprecate ProjectEventBus. Define transport interface. |
| AI Employee Work Runtime | **REDESIGN** | Create new `work-runtime/` module as formal bounded context for organizational work lifecycle |
| AgentMessaging | **RELOCATE** | Moves with Comms to `work-coordination/` |

### Unaffected Boundaries (Preserved as-is)

All other 51 modules remain in their current ownership boundaries with their current module-level separation. No change to:
- Projects module
- Customers module
- Finance module
- EIE module (all sub-modules)
- Hermes (core: HermesRuntime, HermesSession, HermesRegistry, HermesContext, HermesMemory remain)
- Events/Socket.IO gateway
- Auth/Users/Tenants/Plans modules
- All infrastructure modules

---

## 17. Revised Remediation Phase Order

| Phase | Title | Modules Affected | Dependencies |
|---|---|---|---|
| **Phase 0** | Architectural Decisions and Contracts | All proposed ADR modules | None (design only) |
| **Phase 1** | EIE Runtime Integration | EIE, Projects, main.ts | Phase 0 ADRs (transport interface defined) |
| **Phase 2** | Enterprise Event Fabric | New `enterprise-events/`, Events, Hermes (remove EEB), project-events (deprecate) | Phase 1 (EIE working so events can flow) |
| **Phase 3** | Organizational Context Plane | New `context-plane/`, Hermes (refactor context), all capability modules (add context providers) | Phase 2 (events trigger context refresh) |
| **Phase 4** | AI Employee Work Runtime | New `work-runtime/`, agents/ (executor refactor), orchestration/ (task metadata) | Phase 2 (event triggers), Phase 3 (context availability) |
| **Phase 5** | Enterprise Work Transport and AI-to-AI Handoffs | New `work-coordination/`, Hermes (remove AgentMessaging), threads/ | Phase 4 (Work Runtime exists for execution) |
| **Phase 6** | Governance and Approval Integration | Approvals (consolidate + ApprovalPort), governance/ | Phase 4 (Work Runtime handles decisions) |
| **Phase 7** | Project and Tenant Finance Integration | Projects (publish events), Finance (subscribe + budget tracking) | Phase 2 (events flowing) |
| **Phase 8** | Organizational Memory Integration | Memory, ProjectMemory, HermesMemory (bridge) | Phase 2 (events for ingestion) |
| **Phase 9** | Google Workspace Enterprise Integration | Google tools, WorkRuntime, Memory | Phase 2 (events for Gmail/Docs/Calendar) |
| **Phase 10** | Browser Workflow Completion | Frontend tenant + admin | Phases 1-9 (backend integration operational) |
| **Phase 11** | Full NESP Re-Execution | Clean mock tenant | Phases 0-10 |

---

## 18. Revised Phase 11 Verification Criteria

### Original (Rejected)

> "All 15 core verdict questions answered YES."

### Revised (Accepted)

> All 15 core verdict questions are answered using executed behavioural evidence, and no release-critical workflow remains NOT TESTED or UNPROVEN.

### Verification Rules

1. **YES**: Must have behavioral browser evidence (screenshots, console traces, pipeline confirmations). Infrastructure evidence (database queries, API responses) supplements but does not replace behavioral evidence.

2. **NO**: A valid protocol answer. Must be supported by behavioral evidence of failure. Examples: "EIE Discovery returned 0/0," "Approval lifecycle could not be triggered from browser."

3. **BLOCKED**: A valid protocol answer when the blocker is external (e.g., Google blocks automated OAuth) or architectural (e.g., missing prerequisite phase). Must be classified as EXTERNAL or ARCHITECTURAL.

4. **NOT TESTED**: Not a valid final answer for any core question. At minimum, every question must be assigned YES, NO, or BLOCKED with supporting evidence.

5. **UNPROVEN**: Not a valid final answer for any core question. Redesign the test or accept NO with evidence of the gap.

### Phase 11 Exit Criteria

| Condition | Status |
|---|---|
| All 15 core questions answered | MANDATORY |
| Every answer has behavioral browser evidence | MANDATORY |
| No release-critical question answered NOT TESTED | MANDATORY |
| No release-critical question answered UNPROVEN | MANDATORY |
| Final verdict follows Verification Protocol | MANDATORY |
| Answers are truth, not optimization | MANDATORY — "Do not optimize for a positive conclusion" |

---

## 19. Changes Required to Existing Audit Findings

| Original Finding | Original Conclusion | New Evidence | Revised Conclusion | Impact |
|---|---|---|---|---|
| RC-001: EIE Route Collision | EngineReadController collides with DigitalTwinController at same base path `v1/projects/:projectId` | Diagnostic Gate proves: no route collision. Both controllers have different method-level paths. EIE routes ARE in OpenAPI spec. Root cause is missing `defaultVersion` + 4 unversioned controllers. | **REVISED RC-001: Multiple Causes** — Missing `defaultVersion: '1'` in `enableVersioning()` + 4 controllers using incompatible `v1/` string path pattern. Not a route collision. | Phase 1 fix changes from "change controller path" to "add defaultVersion + fix 4 controllers" |
| Diagnostic assertion "All 57+ module boundaries are valid" | Categorical acceptance | 6 specific areas require ownership changes (Relocate: Comms/A2A, Events, AgentMessaging. Consolidate: Approvals. Redesign: Work Runtime. Preserve: Memory) | **REVISED**: "Major bounded contexts appear preservable; selected ownership boundaries require relocation, consolidation, domain/infrastructure separation, or redesign." | Added precise boundary change list (Section 16) |
| Pattern B — Miswired Implementation (for EIE) | DigitalTwinController collision | Route collision disproven. Root cause is missing defaultVersion (config) + pattern inconsistency (4 controllers). | **REVISED**: Pattern B still valid (miswired config), but mechanism changed from route collision to versioning config gap | Fix changed from controller path to versioning config |
| Phase order: Event Fabric after Context Plane + Work Runtime | Event Fabric placed after Context Plane (Phase 3 vs Phase 6) | Code evidence proves all downstream capabilities depend on events. No event-driven triggers exist today. | **REVISED**: Event Fabric must precede Context Plane, Work Runtime, A2A, Approvals, Finance, Memory, Google WS | Phase order changed from original (3→2) |

---

## 20. Changes Required to Existing Remediation Plan

| Section | Original | Revised | Reason |
|---|---|---|---|
| Phase 1 — EIE | Fix route collision by renaming EngineReadController path | Fix missing `defaultVersion` in `main.ts` + convert 4 controllers to versioned pattern | Diagnostic Gate disproved route collision |
| Phase 2 | Organizational Context Plane | Enterprise Event Fabric | Event Fabric is prerequisite for Context Plane |
| Phase 3 | AI Employee Work Runtime | Organizational Context Plane | Event Fabric must precede Context Plane |
| Phase 4 | A2A Work Transport | AI Employee Work Runtime | Work Runtime depends on Context Plane |
| Phase 5 | Governance/Approvals | Enterprise Work Transport and AI-to-AI Handoffs | A2A routing through Work Runtime |
| Phase 6 | Durable Enterprise Event Reactions (original Phase 6) — absorbed into new Phase 2 Event Fabric | Governance and Approval Integration | Approval depends on Work Runtime |
| Phase 7 | Memory | Finance Integration | No change needed in substance |
| Phase 8 | Google WS | Memory Integration | Memory depends on events |
| Phase 9 | Browser UI | Google WS Integration | Google depends on events |
| Phase 10 | NESP Re-execution | Browser Workflow Completion | No change |
| Phase 11 | — | Full NESP Re-Execution | No change |
| Phase 11 success | "All 15 answered YES" | "All 15 answered with behavioral evidence; no NOT TESTED/UNPROVEN" | Remove success bias |
| Module-boundary claim | "All 57+ boundaries are valid" | 6 specific areas require ownership changes | Amendment 4 evidence |

---

## 21. ADRs Required Before Implementation

| ADR | Title | Status | Required By |
|---|---|---|---|
| ADR-001 | Enterprise Event Fabric — Transport architecture, outbox pattern, event taxonomy | NEW — replaces original ADR-005 (Event Taxonomy) | Phase 0 |
| ADR-002 | Organizational Context Plane — Architecture, providers, aggregation, auth | ORIGINAL ADR-001 | Phase 0 |
| ADR-003 | AI Employee Work Runtime — Architecture, lifecycle, bounded context | ORIGINAL ADR-002 | Phase 0 |
| ADR-004 | Enterprise Work Request Contract — Structure, typing, correlation | ORIGINAL ADR-003 | Phase 0 |
| ADR-005 | AI-to-AI Work Handoff — Contract, transport, work-coordination ownership | ORIGINAL ADR-004 | Phase 0 |
| ADR-006 | Capability Approval Port — Unified approval interface, consolidation plan | ORIGINAL ADR-006 | Phase 0 |
| ADR-007 | Project-Finance Integration Contract — Event-based budget/financial semantics | ORIGINAL ADR-007 | Phase 0 |
| ADR-008 | Organizational Memory Ingestion Contract — Unified ingestion from events | ORIGINAL ADR-008 | Phase 0 |
| ADR-009 | Module Ownership Migration — Relocation plan for Comms, Events, Approvals, Work Runtime | **NEW** — required by Amendment 4 | Phase 0 |
| ADR-010 | EIE Root Cause Fix — Add defaultVersion, fix 4 controllers | **NEW** — required by Diagnostic Gate | Phase 1 |

---

## 22. Final Architecture Readiness Recommendation

### 1. Does the dominant Capability Islands diagnosis remain valid?

**YES.** The diagnosis of Pattern C (Capability Islands) with contributing Pattern E (Context Fragmentation) and Pattern F (Event Fragmentation) remains valid. The evidence from this amendment strengthens rather than weakens the diagnosis:
- Three separate approval systems with no integration ✅
- Two disconnected event buses with no bridge ✅
- Hermes context statically assembled without Projects/Customers/Finance ✅
- Zero event subscribers outside Hermes ✅

### 2. What is the final remediation phase order?

Phase 0 (ADRs) → Phase 1 (EIE) → Phase 2 (Event Fabric) → Phase 3 (Context Plane) → Phase 4 (Work Runtime) → Phase 5 (Work Transport/A2A) → Phase 6 (Approvals) → Phase 7 (Finance) → Phase 8 (Memory) → Phase 9 (Google WS) → Phase 10 (Browser UI) → Phase 11 (NESP)

### 3. What is the final Enterprise Event architecture decision?

The Enterprise Event Fabric uses an in-process, database-backed outbox pattern (not Kafka). It defines five explicit layers: Domain Events (internal), Enterprise Events (cross-capability contracts), Durable Transport (outbox + retry + dead-letter), Producers (capability-owned), Consumers (capability-owned), and UI Real-Time Events (Socket.IO projection derived from enterprise events, not the transport itself).

### 4. What is the EIE diagnostic status?

**MULTIPLE CAUSES** — Missing `defaultVersion: '1'` in `enableVersioning()` + 4 controllers using incompatible `v1/` string path pattern. Not a route collision. Phase 1 fix is concise and low-risk.

### 5. Which module ownership boundaries must change?

Six areas require ownership changes:
- **RELOCATE**: Communications/A2A from Hermes → new `work-coordination/` 
- **RELOCATE**: Enterprise Event Bus from Hermes → new `enterprise-events/`
- **CONSOLIDATE**: Three approval systems → unified Approvals with ApprovalPort
- **PRESERVE**: Three memory systems (valid distinct concepts)
- **REDESIGN**: AI Employee Work Runtime → new `work-runtime/` bounded context
- **RELOCATE**: AgentMessaging from Hermes → `work-coordination/`

### 6. Which ADRs require approval?

10 ADRs (ADR-001 through ADR-010). See Section 21.

### 7. Is the architecture ready to enter Phase 0?

**READY FOR PHASE 0 ARCHITECTURAL DECISIONS**

The architectural diagnosis is complete, validated by code evidence, refined by this amendment, and stable. The EIE root cause is proven. The module ownership decisions are made. The revised phase order is architecturally justified. The event architecture is precisely defined.

Phase 0 (Architectural Decisions and Integration Contracts) may proceed. Implementation of Phase 1 (EIE fix) and subsequent phases requires explicit approval after Phase 0 ADRs are reviewed and ratified.
