# Enterprise Communication Platform — Incremental Transformation

**Date:** 2026-07-08 (Rev 4 — incorporates branching, rollback, and snapshot corrections)
**Status:** Design Document (Phased Implementation)
**Based on:** Codebase audit of `HermesModule`, `EventsGateway`, `MissionFeed`, `NotificationsModule`, `Frontend Shells`

---

## Table of Contents

1. [Motivation & Key Insight](#1-motivation--key-insight)
2. [Architecture Principles](#2-architecture-principles)
3. [Phase 1 — Thread Model](#3-phase-1--thread-model)
4. [Phase 2 — Activities Canonical Event Model](#4-phase-2--activities-canonical-event-model)
5. [Phase 3 — Participant Abstraction](#5-phase-3--participant-abstraction)
6. [Phase 4 — Agent-to-Agent Messaging](#6-phase-4--agent-to-agent-messaging)
7. [Phase 5 — Activity Feed Unification](#7-phase-5--activity-feed-unification)
8. [Phase 6 — Explainability UI](#8-phase-6--explainability-ui)
9. [Phase 7 — Presence System](#9-phase-7--presence-system)
10. [Phase 8 — Conversation Intelligence](#10-phase-8--conversation-intelligence)
11. [EntityRelationship as Graph Backbone](#11-entityrelationship-as-graph-backbone)
12. [Complete Data Model Changes](#12-complete-data-model-changes)
13. [Service Contracts](#13-service-contracts)
14. [Frontend Component Map](#14-frontend-component-map)
15. [Migration Path & Backward Compatibility](#15-migration-path--backward-compatibility)

---

## 1. Motivation & Key Insight

The codebase audit revealed a critical truth:

- **The data model is richer than the UX.**
- **The backend is richer than the frontend.**
- **The missing pieces are mostly composition, not capability.**

| Asset | File | What It Provides |
|---|---|---|
| `HermesMessage` | `schema.prisma:2580` | Per-session messages with role, metadata, tool calls |
| `HermesSession.threadId` | `schema.prisma:2562` | LangGraph checkpoint thread — can become business thread |
| `EntityRelationship` | `schema.prisma:2072` | Typed edges between any entity types |
| `EntityHealth` | `schema.prisma:2042` | Computed health scores with signals, trend, severity |
| `EntityWatcher` | `schema.prisma:2020` | Per-user per-entity subscription — reusable as inbox tracker |
| `EventsGateway` | `events.gateway.ts` | WebSocket per-user and per-tenant rooms |
| `MissionFeedItem` | `schema.prisma:2215` | Dashboard-prioritized items |
| `ActivityEvent` (frontend) | `shared/types/domain.types.ts:203` | Two separate frontend event types already exist |
| `LiveFeedWidget` | `LiveFeedWidget.tsx` | Right-panel feed component — uses mock data |
| `ActivityStream` | `ActivityStream.tsx` | Bottom-bar ticker — WebSocket in-memory |
| `HermesAuditLog` | `schema.prisma:2620` | Full decision + reason + governance trail |
| `HermesMemoryEntry` | `schema.prisma:2596` | Per-agent memory with embeddings |
| `HermesRouter` | `langgraph/hermes-router.ts` | Capability-to-agent-type mapping |

**Strategy:** No big rewrite. Enrich existing models. Add adapters. Preserve all existing systems.

---

## 2. Architecture Principles

### SOLID

| Principle | Application |
|---|---|
| **SRP** | Each service owns exactly one concern. No god services. |
| **OCP** | New participant/activity/types added by extending enums, not modifying existing code. |
| **LSP** | `HermesMessage` enrichment is additive — all existing consumers work unchanged. |
| **ISP** | 9 interfaces, each with ≤6 methods. No interface has methods a consumer would ignore. |
| **DIP** | Every service depends on interfaces, not concretions. |

### Key Design Decisions

1. **Never remove a column or table.** All changes are additive schema migrations.
2. **Adapters, not replacements.** Existing systems continue to work alongside new ones.
3. **Sessions remain as runtime state.** Threads become the persistent business abstraction.
4. **Hermes is one participant type.** The system does not distinguish human vs AI at the transport layer.
5. **Every data-access path enforces tenant isolation and participant-scoped visibility.** No query returns rows the caller is not entitled to see.
6. **Presence must survive restart and multi-instance.** In-memory-only presence is not acceptable for production.

---

## 3. Phase 1 — Thread Model

### 3.1 Problem

`HermesSession` owns messages. When a session expires or completes, its messages are orphaned. Cross-agent conversations, task discussions, and project threads have no representation. No read-state tracking exists.

### 3.2 Solution

Add `threadId` and context fields directly to `HermesMessage`. Create `CommunicationThread`, `ThreadParticipant`, and `ThreadReadState` models. Sessions become one producer of messages into a thread — not the owner.

### 3.3 Schema Changes

```prisma
// ─── Add to existing HermesMessage model ──────────────────────────

model HermesMessage {
  // ... existing fields remain unchanged ...

  threadId    String?  @map("thread_id")
  contextType String?  @map("context_type")
  contextId   String?  @map("context_id")

  // FIX: idempotencyKey for A2A retry dedup
  idempotencyKey String? @unique @map("idempotency_key")

  @@index([threadId, createdAt])
  @@index([contextType, contextId])
}

// FIX: threadId added to HermesAuditLog for cost aggregation by thread (not by session)
//      Required by AgentMessagingGuard cost-ceiling query in §6.4
model HermesAuditLog {
  // ... existing fields remain unchanged ...
  threadId String? @map("thread_id")

  @@index([threadId])
  @@index([hermesAgentId, tenantId])
  @@index([tenantId, createdAt])
  @@index([action, tenantId])
}

// ─── New model — Thread ─────────────────────────────────────────

model CommunicationThread {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  title     String
  contextType String?
  contextId  String?
  status     ThreadStatus @default(ACTIVE)

  // FIX: hopCount prevents runaway A2A chains
  hopCount  Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  closedAt  DateTime?

  @@index([tenantId])
  @@index([contextType, contextId])
  @@index([status, tenantId])
  @@map("communication_threads")
}

model ThreadParticipant {
  id              String         @id @default(cuid())
  threadId        String
  thread          CommunicationThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  participantType ParticipantType
  participantId   String
  role            String?
  joinedAt        DateTime       @default(now())
  leftAt          DateTime?
  isActive        Boolean        @default(true)

  @@unique([threadId, participantType, participantId])
  @@index([participantType, participantId])
  @@map("thread_participants")
}

// FIX: Read-state tracking for AgentInboxPanel
model ThreadReadState {
  id              String   @id @default(cuid())
  threadId        String
  participantType ParticipantType
  participantId   String
  lastReadMessageId String?
  lastReadAt      DateTime @default(now())

  @@unique([threadId, participantType, participantId])
  @@map("thread_read_states")
}

enum ParticipantType {
  USER
  AI_AGENT
  SYSTEM
  WORKFLOW
  EXTERNAL
  @@map("participant_type")
}

enum ThreadStatus {
  ACTIVE
  ARCHIVED
  CLOSED
  @@map("thread_status")
}
```

### 3.4 Service Contract

```typescript
export interface IThreadService {
  create(params: {
    tenantId: string;
    title: string;
    contextType?: string;
    contextId?: string;
    participants: Array<{ type: ParticipantType; id: string; role?: string }>;
  }): Promise<CommunicationThread>;

  get(threadId: string, requester: { type: ParticipantType; id: string; tenantId: string }): Promise<CommunicationThread | null>;
  // ^ FIX: requester must be a thread participant — returns null if not

  findForEntity(contextType: string, contextId: string, tenantId: string): Promise<CommunicationThread[]>;

  addParticipant(
    threadId: string,
    participant: { type: ParticipantType; id: string; role?: string },
    requesterTenantId: string,
  ): Promise<void>;

  getMessages(
    threadId: string,
    requester: { type: ParticipantType; id: string; tenantId: string },
    opts?: { limit?: number; before?: string },
  ): Promise<HermesMessageData[]>;
  // ^ FIX: enforces participant check

  markRead(threadId: string, participantType: ParticipantType, participantId: string): Promise<void>;

  getUnreadCount(participantType: ParticipantType, participantId: string, tenantId: string): Promise<number>;

  close(threadId: string, tenantId: string): Promise<void>;
}
```

### 3.5 Implementation Highlights

Every `get()` and `getMessages()` call validates that the requester is a `ThreadParticipant` before returning data. This prevents the tenant-wide data-leak bug where any authenticated user could read any thread:

```typescript
async getMessages(threadId: string, requester, opts?): Promise<HermesMessageData[]> {
  const isMember = await this.prisma.threadParticipant.findUnique({
    where: {
      threadId_participantType_participantId: {
        threadId,
        participantType: requester.type,
        participantId: requester.id,
      },
    },
  });
  if (!isMember) return []; // FIX: not a 403 — silent empty to avoid participant-enumeration oracle
  // ... proceed with query
}
```

### 3.6 HermesSessionService Changes

```typescript
async addMessage(
  sessionId: string,
  role: 'USER' | 'HERMES' | 'SYSTEM',
  content: string,
  metadata?: Record<string, unknown>,
  threadId?: string,
  idempotencyKey?: string,    // FIX: new param
): Promise<HermesMessageData> {
  // Dedup on idempotencyKey if provided
  if (idempotencyKey) {
    const existing = await this.prisma.hermesMessage.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return this.toData(existing);
  }

  const message = await this.prisma.hermesMessage.create({
    data: {
      sessionId, role, content,
      metadata: metadata ?? undefined,
      threadId: threadId ?? null,
      idempotencyKey: idempotencyKey ?? null,
    },
  });
  // Real-time delivery via WebSocket thread room
  await this.events.emitToRoom(`thread:${threadId}`, 'thread:message', this.toData(message));
  return this.toData(message);
}
```

### 3.7 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | Add `threadId`, `contextType`, `contextId`, `idempotencyKey` to `HermesMessage` |
| `backend/prisma/schema.prisma` | Add | `CommunicationThread`, `ThreadParticipant`, `ThreadReadState`, enums |
| `backend/src/modules/hermes/interfaces/IThreadService.ts` | Create | Thread service contract (ISP) |
| `backend/src/modules/hermes/services/thread.service.ts` | Create | Thread service impl with participant-enforced access (SRP) |
| `backend/src/modules/hermes/services/hermes-session.service.ts` | Modify | Accept `threadId` + `idempotencyKey` in `addMessage()` |
| `backend/src/modules/hermes/hermes.module.ts` | Modify | Register `ThreadService` |

---

## 4. Phase 2 — Activities Canonical Event Model

### 4.1 Problem

Three independent feed-like systems with no shared abstraction. Adapter polling has no watermark persistence.

| System | Persisted? | Consumer |
|---|---|---|
| `MissionFeedItem` | ✅ Prisma | Dashboard |
| `ActivityStream` (in-memory) | ❌ Zustand store | Bottom bar ticker |
| `LiveFeedWidget` | ❌ Mock data | Right panel |
| `HermesAuditLog` | ✅ Prisma | (none yet) |

### 4.2 Solution

Canonical `ActivityEvent` model. Write-through emission (not polling) for the code paths we control. Adapters with watermark cursors for external/existing systems.

### 4.3 Schema

```prisma
model ActivityEvent {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(...)

  actorType   ParticipantType
  actorId     String
  type        String
  title       String
  description String?  @db.Text
  threadId    String?
  contextType String?
  contextId   String?
  entityType  String?
  entityId    String?
  payload     Json     @default("{}")
  severity    String   @default("info")
  visibility  String   @default("tenant") // tenant | thread | direct

  // FIX: for direct-visibility events, only these participants can see them
  targetParticipantType ParticipantType?
  targetParticipantId   String?

  // Dedup
  sourceEventId String?  @unique

  dismissedAt DateTime?

  // FIX: TTL for automatic archival
  expiresAt DateTime?

  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, actorType, actorId])
  @@index([tenantId, type])
  @@index([tenantId, threadId])
  @@index([tenantId, visibility, targetParticipantId])
  @@index([sourceEventId])
  @@map("activity_events")
}

// FIX: Watermark persistence for adapter polling
model AdapterCursor {
  id         String   @id @default(cuid())
  tenantId   String
  sourceName String   // "mission-feed", "audit-log", "events-gateway"
  lastPolledAt DateTime
  lastEventId String?

  @@unique([tenantId, sourceName])
  @@map("adapter_cursors")
}
```

### 4.4 Write-Through Adapters (Preferred)

Instead of polling, modify the write path of existing systems to call `ActivityService.record()` directly. This eliminates the watermark problem:

```typescript
// In MissionFeedService.create()
async create(dto, tenantId) {
  const item = await this.prisma.missionFeedItem.create({ ... });

  // FIX: write-through to ActivityEvent — no polling needed
  await this.activityService.record({
    tenantId,
    actorType: 'SYSTEM',
    actorId: 'mission-feed',
    type: `mission.${dto.category.toLowerCase()}`,
    title: dto.title,
    description: dto.description,
    sourceEventId: item.sourceEventId ?? item.id,
    createdAt: item.createdAt,
  }).catch((err) => this.logger.warn(`Activity record failed: ${err}`));

  return item;
}
```

### 4.5 Visibility Enforcement

FIX: `ActivityService.list()` filters by visibility:

```typescript
  async list(tenantId: string, opts?: {
    userId?: string;       // FIX: required for visibility filtering
    agentId?: string;
    visibility?: string[];
    limit?: number;
    before?: string;
    types?: string[];
    severity?: string;
  }): Promise<ActivityEvent[]> {
    const where: Prisma.ActivityEventWhereInput = { tenantId };

    // FIX: enforce visibility scoping
    //
    //   tenant   — anyone in the tenant sees it
    //   thread   — only thread participants see it (resolved via separate query)
    //   direct   — only the targeted participant sees it
    const threadIds: string[] = [];
    if (opts?.userId) {
      const participantThreads = await this.prisma.threadParticipant.findMany({
        where: { participantType: 'USER', participantId: opts.userId },
        select: { threadId: true },
      });
      threadIds.push(...participantThreads.map((t) => t.threadId));
    }
    if (opts?.agentId) {
      const agentThreads = await this.prisma.threadParticipant.findMany({
        where: { participantType: 'AI_AGENT', participantId: opts.agentId },
        select: { threadId: true },
      });
      threadIds.push(...agentThreads.map((t) => t.threadId));
    }

    where.OR = [
      { visibility: 'tenant' },
      ...(threadIds.length > 0
        ? [{ visibility: 'thread' as const, threadId: { in: threadIds } }]
        : []),
      {
        visibility: 'direct',
        OR: [
          ...(opts?.userId ? [{ targetParticipantType: 'USER', targetParticipantId: opts.userId }] : []),
          ...(opts?.agentId ? [{ targetParticipantType: 'AI_AGENT', targetParticipantId: opts.agentId }] : []),
        ],
      },
    ];
}
```

### 4.6 EnterpriseEventBusService Rewrite

```typescript
@Injectable()
export class EnterpriseEventBusService implements IHermesEventBus {
  constructor(
    private readonly activityService: ActivityService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  emit(event: HermesEvent): void {
    const tenantId = event.data.tenantId as string;
    if (!tenantId) {
      this.logger.warn('Dropping event with no tenantId — security isolation');
      return;
    }

    // Persist as canonical activity
    this.activityService.record({
      tenantId,
      actorType: 'AI_AGENT',
      actorId: event.hermesAgentId,
      type: event.type,
      title: event.type,
      threadId: event.data.threadId as string ?? undefined,
      payload: event.data,
      severity: event.type === 'hermes:error' ? 'error' : 'info',
      sourceEventId: `${event.type}:${event.sessionId}:${event.timestamp}`,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // FIX: 90-day TTL
    });

    // Fan-out
    this.eventsGateway.emitToTenant(tenantId, 'activity:new', event);
    if (event.data.threadId) {
      this.eventsGateway.emitToRoom(`thread:${event.data.threadId}`, 'thread:activity', event);
    }
  }
}
```

### 4.7 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/prisma/schema.prisma` | Add | `ActivityEvent` model (with `targetParticipant*`, `expiresAt`), `AdapterCursor` |
| `backend/src/modules/hermes/services/activity.service.ts` | Create | Canonical event service with visibility enforcement (SRP) |
| `backend/src/modules/hermes/services/enterprise-event-bus.service.ts` | Create | Persisted EventBus replacing HermesEventBusService (SRP) |
| `backend/src/modules/hermes/interfaces/IActivityService.ts` | Create | Activity service contract (ISP) |
| `backend/src/modules/hermes/services/hermes-session.service.ts` | Modify | Write-through adapter (no polling) |

---

## 5. Phase 3 — Participant Abstraction

### 5.1 Problem

`HermesMessage.role` assumes three fixed participants. No abstraction for "who is talking to whom" that works identically for humans, agents, workflows, and external systems.

### 5.2 Solution

Introduce `ParticipantResolver` — resolves any `{ participantType, participantId }` to profile, without branching on type in callers.

### 5.3 Interface

```typescript
export interface ParticipantProfile {
  id: string;
  type: ParticipantType;
  displayName: string;
  avatarUrl?: string;
  status?: string;
  departmentId?: string;
  tenantId: string;         // FIX: required — tenant isolation
  metadata?: Record<string, unknown>;
}

export interface IParticipantResolver {
  resolve(type: ParticipantType, id: string, tenantId: string): Promise<ParticipantProfile | null>;
  resolveBatch(participants: Array<{ type: ParticipantType; id: string; tenantId: string }>): Promise<Map<string, ParticipantProfile>>;
  search(query: string, tenantId: string, types?: ParticipantType[]): Promise<ParticipantProfile[]>;
}
```

### 5.4 Implementation

```typescript
@Injectable()
export class ParticipantResolver implements IParticipantResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hermesRegistry: HermesRegistryService,
  ) {}

  async resolve(type: ParticipantType, id: string, tenantId: string): Promise<ParticipantProfile | null> {
    switch (type) {
      case 'USER': {
        const user = await this.prisma.user.findFirst({
          where: { id, tenantId }, // FIX: scoped to tenant
          select: { id: true, name: true, avatarUrl: true },
        });
        return user ? { id: user.id, type, displayName: user.name, tenantId, avatarUrl: user.avatarUrl ?? undefined } : null;
      }
      case 'AI_AGENT': {
        const agent = await this.hermesRegistry.findById(id);
        if (!agent || agent.tenantId !== tenantId) return null; // FIX: tenant check
        return { id: agent.id, type, displayName: agent.name, tenantId, status: agent.status };
      }
      case 'SYSTEM':
        return { id, type, displayName: 'System', tenantId };
      default:
        return null;
    }
  }
}
```

### 5.5 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/hermes/interfaces/IParticipantResolver.ts` | Create | Resolution contract (ISP) |
| `backend/src/modules/hermes/services/participant-resolver.service.ts` | Create | Resolution impl (SRP, OCP) |
| `backend/src/modules/hermes/hermes.module.ts` | Modify | Register resolver |

---

## 6. Phase 4 — Agent-to-Agent Messaging

### 6.1 Problem

No path for one agent to message another and receive a response in-band. No runaway protection — a misconfigured agent could create infinite message chains or unbounded LLM cost.

### 6.2 Solution

Introduce `AgentMessagingService` with circuit breaker (`IAgentMessagingGuard`), hop counter, cost ceiling, and idempotency.

### 6.3 Interface

```typescript
// FIX: includes idempotencyKey, hopLimit, and maxCost
export interface AgentMessage {
  id: string;
  idempotencyKey?: string;    // FIX: dedup on retry
  fromAgentId: string;
  toAgentId: string;
  tenantId: string;
  threadId: string;
  hopCount: number;           // FIX: current hop depth
  content: string;
  expectResponse: boolean;
}

export interface IAgentMessagingGuard {
  /** Throw if this message should not be delivered */
  check(message: AgentMessage): Promise<void>;
}

export interface IAgentMessaging {
  send(message: AgentMessage): Promise<{ delivered: boolean; response?: string; blocked?: string }>;
  createChannel(agentIdA: string, agentIdB: string, tenantId: string): Promise<string>;
  getConversation(threadId: string, participant: { type: ParticipantType; id: string; tenantId: string }): Promise<HermesMessageData[]>;
}
```

### 6.4 Circuit Breaker Guard

```typescript
@Injectable()
export class AgentMessagingGuard implements IAgentMessagingGuard {
  private readonly MAX_HOPS = 5;
  private readonly MAX_MESSAGES_PER_THREAD = 50;
  private readonly MAX_COST_USD_PER_THREAD = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  async check(message: AgentMessage): Promise<void> {
    // FIX: 1. Hard hop limit — read the authoritative count from CommunicationThread
    //        NOT from the client-supplied message.hopCount (which can be forged).
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: message.threadId },
      select: { hopCount: true, tenantId: true },
    });
    if (!thread) {
      throw new Error(`Thread ${message.threadId} not found`);
    }
    if (thread.tenantId !== message.tenantId) {
      throw new Error('Thread tenant mismatch');
    }
    if (thread.hopCount >= this.MAX_HOPS) {
      throw new Error(`A2A hop limit exceeded: ${thread.hopCount} >= ${this.MAX_HOPS}`);
    }

    // FIX: 2. Per-thread message count ceiling
    const msgCount = await this.prisma.hermesMessage.count({
      where: { threadId: message.threadId },
    });
    if (msgCount >= this.MAX_MESSAGES_PER_THREAD) {
      throw new Error(`Thread message limit exceeded: ${msgCount} >= ${this.MAX_MESSAGES_PER_THREAD}`);
    }

    // FIX: 3. Per-thread cost ceiling — aggregate by threadId column on HermesAuditLog
    //        NOT by sessionId, because each A2A hop creates a new session.
    const costAgg = await this.prisma.hermesAuditLog.aggregate({
      where: { threadId: message.threadId },
      _sum: { costUsd: true },
    });
    const totalCost = costAgg._sum.costUsd ?? 0;
    if (totalCost >= this.MAX_COST_USD_PER_THREAD) {
      throw new Error(`Thread cost ceiling exceeded: $${totalCost} >= $${this.MAX_COST_USD_PER_THREAD}`);
    }

    // FIX: 4. Feature flag kill switch
    const enabled = await this.featureFlag.isEnabled('AGENT_MESSAGING_ENABLED', message.tenantId);
    if (!enabled) {
      throw new Error('Agent-to-agent messaging is disabled for this tenant');
    }
  }
}
```

### 6.5 AgentMessagingService Implementation

```typescript
@Injectable()
export class AgentMessagingService implements IAgentMessaging {
  constructor(
    private readonly runtime: HermesRuntimeService,
    private readonly threadService: IThreadService,
    private readonly session: HermesSessionService,
    private readonly resolver: IParticipantResolver,
    private readonly guard: IAgentMessagingGuard,   // FIX: circuit breaker
    private readonly activityService: IActivityService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  async send(message: AgentMessage): Promise<{ delivered: boolean; response?: string; blocked?: string }> {
    // FIX: 1. Run circuit breaker
    try {
      await this.guard.check(message);
    } catch (err) {
      return { delivered: false, blocked: err instanceof Error ? err.message : String(err) };
    }

    // 2. Verify target agent exists and is in same tenant
    const target = await this.resolver.resolve('AI_AGENT', message.toAgentId, message.tenantId);
    if (!target) return { delivered: false, blocked: 'Target agent not found' };

    // 3. Record message with idempotency
    const session = await this.session.create(message.toAgentId, 'hermes', message.tenantId);
    await this.session.addMessage(session.id, 'USER', message.content, undefined, message.threadId, message.idempotencyKey);

    // 4. Read and increment hop count server-side — never trust the caller's value.
    //    FIX: this is the authoritative increment, persisted on CommunicationThread.
    const updatedHopCount = await this.prisma.communicationThread.update({
      where: { id: message.threadId },
      data: { hopCount: { increment: 1 } },
      select: { hopCount: true },
    });

    // 5. Execute with server-verified hop count
    //    FIX: threadId is explicitly passed in context so HermesRuntimeService
    //         propagates it to HermesAuditLog records (required by cost-ceiling query).
    if (message.expectResponse) {
      const result = await this.runtime.execute({
        sessionId: session.id,
        hermesAgentId: message.toAgentId,
        task: message.content,
        context: {
          tenantId: message.tenantId,
          threadId: message.threadId,
          agentId: message.fromAgentId,
          hopCount: updatedHopCount.hopCount,
        },
      });

      const reply = result.success ? JSON.stringify(result.output) : `Error: ${result.error}`;
      await this.session.addMessage(session.id, 'HERMES', reply, undefined, message.threadId);

      await this.activityService.record({
        tenantId: message.tenantId,
        actorType: 'AI_AGENT',
        actorId: message.toAgentId,
        type: 'agent:replied',
        title: `${target.displayName} replied`,
        threadId: message.threadId,
        payload: { hopCount: message.hopCount + 1, success: result.success, costUsd: result.costUsd },
        sourceEventId: `agent-reply:${session.id}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      return { delivered: true, response: reply };
    }

    return { delivered: true };
  }
}
```

### 6.6 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/hermes/interfaces/IAgentMessaging.ts` | Create | Messaging contract (ISP) |
| `backend/src/modules/hermes/interfaces/IAgentMessagingGuard.ts` | Create | Circuit breaker contract (ISP) |
| `backend/src/modules/hermes/services/agent-messaging.service.ts` | Create | A2A messaging (SRP) |
| `backend/src/modules/hermes/services/agent-messaging.guard.ts` | Create | Hop/cost/rate-limits (SRP) |
| `backend/src/modules/hermes/hermes.module.ts` | Modify | Register |

---

## 7. Phase 5 — Activity Feed Unification

### 7.1 Problem

LiveFeedWidget uses mock data, ActivityStream uses in-memory store, MissionFeedItem uses DB. Three separate paths.

### 7.2 Solution

Wire all to canonical `ActivityEvent` via write-through (Phase 2) plus WebSocket subscriptions. Add backfill-on-reconnect for the frontend.

### 7.3 Activity Controller with Visibility Enforcement

```typescript
@Controller({ path: 'activity', version: '1' })
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: RequestWithUser, @Query('limit') limit?: string, @Query('before') before?: string) {
    const user = req.user as JwtPayload;
    return {
      status: 'success',
      data: await this.activityService.list(user.tenantId!, {
        userId: user.sub,
        limit: limit ? parseInt(limit, 10) : 50,
        before,
      }),
    };
  }
}
```

### 7.4 Frontend Hook with Backfill-on-Reconnect

```typescript
export function useActivityFeed(opts?: { limit?: number }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const ws = useWebSocket();
  const isConnected = ws?.connected;

  // Initial REST load
  useEffect(() => {
    api.get('/activity', { params: { limit: opts?.limit ?? 50 } })
      .then((res) => {
        setEvents(res.data.data.events);
        if (res.data.data.events.length > 0) {
          setLastId(res.data.data.events[0].id);
        }
      });
  }, []);

  // FIX: backfill on reconnect — fetch events since last known id
  useEffect(() => {
    if (!isConnected || !lastId) return;
    api.get('/activity', { params: { since: lastId, limit: opts?.limit ?? 50 } })
      .then((res) => {
        if (res.data.data.events.length > 0) {
          setEvents((prev) => [...res.data.data.events, ...prev].slice(0, opts?.limit ?? 50));
        }
      });
  }, [isConnected]);

  // WebSocket live updates
  useEffect(() => {
    if (!ws) return;
    const handler = (event: ActivityEvent) => {
      setEvents((prev) => {
        const next = [event, ...prev].slice(0, opts?.limit ?? 50);
        setLastId(next[0].id);
        return next;
      });
    };
    ws.on('activity:new', handler);
    return () => { ws.off('activity:new', handler); };
  }, [ws]);

  return { events };
}
```

### 7.5 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/activity/activity.controller.ts` | Create | REST endpoint for activity feed |
| `backend/src/modules/activity/activity.module.ts` | Create | Module wiring |
| `frontend-tenant/src/shared/hooks/useActivityFeed.ts` | Create | Unified feed hook with backfill |
| `frontend-tenant/src/components/home/LiveFeedWidget.tsx` | Modify | Replace mock data with `useActivityFeed` |
| `frontend-tenant/src/components/layout/ActivityStream.tsx` | Modify | Switch to canonical event shape |
| `frontend-tenant/src/stores/activityStore.ts` | Deprecate | Data flows through hook now |

---

## 8. Phase 6 — Explainability UI

### 8.1 Problem

`HermesAuditLog` stores full decision trail. No UI surfaces it. `request`/`response` fields contain potentially sensitive data (full prompts, tool payloads).

### 8.2 Solution

Zero-schema-change endpoint with RBAC on sensitive fields.

### 8.3 Backend with Role-Protected Fields

```typescript
@Controller({ path: 'hermes/explain', version: '1' })
export class ExplainabilityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':agentId/decisions')
  @UseGuards(JwtAuthGuard, HermesTenantGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'AUDITOR') // FIX: RBAC on sensitive data
  async getDecisions(
    @Param('agentId') agentId: string,
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as JwtPayload;
    const logs = await this.prisma.hermesAuditLog.findMany({
      where: { hermesAgentId: agentId, tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 20,
      select: {
        id: true, action: true, resource: true, decision: true, reason: true,
        governanceRule: true, durationMs: true, costUsd: true, tokensUsed: true,
        createdAt: true,
        // FIX: request/response only returned if user has AUDITOR role
        ...(user.role === 'AUDITOR' || user.role === 'SUPER_ADMIN'
          ? { request: true, response: true }
          : {}),
      },
    });

    return { status: 'success', data: { decisions: logs } };
  }
}
```

### 8.4 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/hermes/controllers/explainability.controller.ts` | Create | Decision history endpoint with RBAC |
| `backend/src/modules/hermes/hermes.module.ts` | Modify | Wire controller |
| `frontend-tenant/src/shared/components/explain/DecisionCard.tsx` | Create | Decision card component |
| `frontend-tenant/src/shared/components/explain/ExplainabilityPanel.tsx` | Create | Slide-out panel |
| `frontend-tenant/src/shared/hooks/useExplainability.ts` | Create | Fetch decisions hook |

---

## 9. Phase 7 — Presence System

### 9.1 Problem

`HermesAgentStatus` is a DB field. No real-time presence. In-memory-only presence is not production-safe.

### 9.2 Solution

Redis-backed presence with heartbeat TTL, tenant-isolated by design, and a background sweep for stale states.

### 9.3 Interface

```typescript
export type PresenceStatus =
  | 'working' | 'idle' | 'thinking' | 'blocked'
  | 'waiting_approval' | 'meeting' | 'offline' | 'paused';

export interface PresenceState {
  participantType: ParticipantType;
  participantId: string;
  status: PresenceStatus;
  currentTask?: string;
  currentSession?: string;
  tenantId: string;           // FIX: required, not optional
  lastSeen: number;
  ttlSeconds: number;
}

export interface IPresenceService {
  setStatus(type: ParticipantType, id: string, status: PresenceStatus, tenantId: string, meta?: {
    currentTask?: string;
    currentSession?: string;
  }): Promise<void>;
  // ^ FIX: tenantId is a required typed parameter, not buried in metadata

  getStatus(type: ParticipantType, id: string, tenantId: string): Promise<PresenceState | null>;
  getActiveByTenant(tenantId: string): Promise<PresenceState[]>;
  subscribe(type: ParticipantType, id: string, callback: (state: PresenceState) => void): () => void;
}
```

### 9.4 Redis-Backed Implementation

```typescript
@Injectable()
export class PresenceService implements IPresenceService {
  private readonly TTL_SECONDS = 120; // 2 min heartbeat
  private readonly STALE_TIMEOUT = 300; // 5 min — sweep to 'offline'
  private readonly subscribers = new Map<string, Set<(state: PresenceState) => void>>();
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    private readonly redis: RedisService,   // FIX: uses existing Redis infrastructure
    private readonly eventsGateway: EventsGateway,
  ) {
    // FIX: background sweep every 60s for stale entries
    setInterval(() => this.sweepStale(), 60_000);
  }

  private key(type: ParticipantType, id: string, tenantId: string): string {
    return `presence:${tenantId}:${type}:${id}`;
  }

  async setStatus(type: ParticipantType, id: string, status: PresenceStatus, tenantId: string, meta?: {
    currentTask?: string;
    currentSession?: string;
  }): Promise<void> {
    const state: PresenceState = {
      participantType: type,
      participantId: id,
      status,
      tenantId,
      currentTask: meta?.currentTask,
      currentSession: meta?.currentSession,
      lastSeen: Date.now(),
      ttlSeconds: status === 'offline' ? 30 : this.TTL_SECONDS,
    };

    // FIX: store in Redis with TTL — survives restart, multi-instance safe
    await this.redis.setJson(this.key(type, id, tenantId), state, state.ttlSeconds);

    // Notify in-process subscribers
    const subKey = `${type}:${id}`;
    this.subscribers.get(subKey)?.forEach((cb) => cb(state));

    // FIX: broadcast to tenant room (never 'all')
    this.eventsGateway.emitToTenant(tenantId, 'presence:updated', state);
  }

  async getStatus(type: ParticipantType, id: string, tenantId: string): Promise<PresenceState | null> {
    const raw = await this.redis.getJson(this.key(type, id, tenantId));
    return raw as PresenceState | null;
  }

  async getActiveByTenant(tenantId: string): Promise<PresenceState[]> {
    const keys = await this.redis.keys(`presence:${tenantId}:*`);
    const results = await Promise.all(keys.map((k) => this.redis.getJson(k)));
    return results.filter(Boolean) as PresenceState[];
  }

  // FIX: sweep stale entries — if Redis TTL didn't catch them, mark offline
  // FIX: use SCAN instead of KEYS to avoid blocking on large multi-tenant instances.
  //      KEYS blocks Redis O(N) across the entire keyspace; SCAN is cursor-based.
  private async sweepStale(): Promise<void> {
    const allKeys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redis.scan(cursor, 'MATCH', 'presence:*', 'COUNT', 100);
      cursor = nextCursor;
      allKeys.push(...found);
    } while (cursor !== '0');

    const now = Date.now();
    for (const key of allKeys) {
      const raw = await this.redis.getJson(key);
      if (!raw) continue;
      const state = raw as PresenceState;
      if (state.status === 'offline') continue;
      if (now - state.lastSeen > this.STALE_TIMEOUT * 1000) {
        await this.setStatus(state.participantType as ParticipantType, state.participantId, 'offline', state.tenantId);
        this.logger.warn(`Swept stale presence: ${state.participantType}:${state.participantId}`);
      }
    }
  }

  subscribe(type: ParticipantType, id: string, callback: (state: PresenceState) => void): () => void {
    const key = `${type}:${id}`;
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key)!.add(callback);
    return () => { this.subscribers.get(key)?.delete(callback); };
  }
}
```

### 9.5 Integration with HermesRuntimeService

```typescript
// At start
await this.presence.setStatus('AI_AGENT', hermesAgentId, 'working', execCtxInner.tenantId, {
  currentTask: task, currentSession: sessionId,
});

// During tool validation
if (validation.requiresApproval) {
  await this.presence.setStatus('AI_AGENT', hermesAgentId, 'waiting_approval', execCtxInner.tenantId);
}

// During LLM call
await this.presence.setStatus('AI_AGENT', hermesAgentId, 'thinking', execCtxInner.tenantId);

// On completion
await this.presence.setStatus('AI_AGENT', hermesAgentId, 'idle', execCtxInner.tenantId);

// On error
await this.presence.setStatus('AI_AGENT', hermesAgentId, 'blocked', execCtxInner.tenantId);
```

### 9.6 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/hermes/interfaces/IPresenceService.ts` | Create | Presence contract with typed tenantId (ISP) |
| `backend/src/modules/hermes/services/presence.service.ts` | Create | Redis-backed + heartbeat + sweep (SRP) |
| `backend/src/modules/hermes/services/hermes-runtime.service.ts` | Modify | Emit presence at lifecycle points |
| `backend/src/modules/hermes/hermes.module.ts` | Modify | Register presence service |

---

## 10. Phase 8 — Conversation Intelligence

### 10.1 Problem

No system can answer "What did Finance do this week?" without manual search.

### 10.2 Solution

RAG layer across HermesMessage + HermesAuditLog + HermesMemoryEntry. Map-reduce summarization for large time windows to respect context limits.

### 10.3 Interface

```typescript
export interface ConversationSummary {
  period: { from: Date; to: Date };
  participantId: string;
  participantType: ParticipantType;
  totalMessages: number;
  totalDecisions: number;
  keyTopics: string[];
  actionItems: string[];
  narrative: string;
}

export interface IConversationIntelligence {
  summarize(params: {
    participantType: ParticipantType;
    participantId: string;
    tenantId: string;
    from: Date;
    to: Date;
  }): Promise<ConversationSummary>;

  search(params: {
    tenantId: string;
    query: string;
    limit?: number;
  }): Promise<Array<{ message: HermesMessageData; score: number }>>;

  ask(params: {
    tenantId: string;
    question: string;
  }): Promise<{ answer: string; sources: string[] }>;
}
```

### 10.4 Map-Reduce Summarization (FIX: context-budget safety)

```typescript
@Injectable()
export class ConversationIntelligenceService implements IConversationIntelligence {
  private readonly CHUNK_SIZE = 50_000; // characters per chunk
  private readonly MAX_INPUT_TOKENS = 120_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly llmFactory: LLMFactory,
  ) {}

  async summarize(params): Promise<ConversationSummary> {
    const [messages, decisions, memories] = await Promise.all([
      this.prisma.hermesMessage.findMany({
        where: { session: { hermesAgent: { tenantId: params.tenantId } }, createdAt: { gte: params.from, lte: params.to } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.hermesAuditLog.findMany({
        where: { hermesAgentId: params.participantId, tenantId: params.tenantId, createdAt: { gte: params.from, lte: params.to } },
      }),
      this.prisma.hermesMemoryEntry.findMany({
        where: { hermesAgentId: params.participantId, tenantId: params.tenantId, createdAt: { gte: params.from, lte: params.to } },
      }),
    ]);

    // FIX: Check if total context fits in budget
    const totalContext = buildContextString(messages, decisions, memories);

    let narrative: string;
    if (totalContext.length < this.MAX_INPUT_TOKENS * 4) {
      // Single pass
      narrative = await this.llmFactory.invokeSummary(totalContext);
    } else {
      // FIX: Map-reduce — chunk, summarize each, reduce
      const chunks = this.chunkString(totalContext, this.CHUNK_SIZE);
      const chunkSummaries = await Promise.all(
        chunks.map((chunk) => this.llmFactory.invokeSummary(chunk)),
      );
      narrative = await this.llmFactory.invokeSummary(
        chunkSummaries.map((s, i) => `[Chunk ${i + 1}/${chunks.length}]: ${s}`).join('\n'),
      );
    }

    return {
      period: { from: params.from, to: params.to },
      participantId: params.participantId,
      participantType: params.participantType,
      totalMessages: messages.length,
      totalDecisions: decisions.length,
      keyTopics: extractTopics(narrative),
      actionItems: extractActionItems(narrative),
      narrative,
    };
  }

  private chunkString(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  // ... search(), ask()
}
```

### 10.5 File Manifest

| File | Action | Purpose |
|---|---|---|
| `backend/src/modules/hermes/interfaces/IConversationIntelligence.ts` | Create | Intelligence contract (ISP) |
| `backend/src/modules/hermes/services/conversation-intelligence.service.ts` | Create | RAG + map-reduce (SRP) |
| `backend/src/modules/hermes/controllers/intelligence.controller.ts` | Create | REST endpoints |

---

## 11. EntityRelationship as Graph Backbone

### 11.1 Existing Schema

```prisma
model EntityRelationship {
  id        String           @id @default(uuid())
  tenantId  String
  tenant    Tenant           @relation(...)
  fromType  EntityType
  fromId    String
  toType    EntityType
  toId      String
  type      RelationshipType
  position  Int              @default(0)
  metadata  Json             @default("{}")

  @@unique([tenantId, fromType, fromId, toType, toId, type])
}
```

### 11.2 What It Enables Without Schema Changes

| Use Case | Relationship | Example |
|---|---|---|
| Org chart | `PARENT_OF` / `CHILD_OF` | CEO → PARENT_OF → Finance Agent |
| Agent reporting | `REPORTS_TO` | Finance Agent → REPORTS_TO → CFO |
| Task assignment | `ASSIGNED_TO` | Task-42 → ASSIGNED_TO → Research Agent |
| Agent collaboration | `COLLABORATES_WITH` | Research → COLLABORATES_WITH → Legal |
| Goal alignment | `REFERENCES` | Task-42 → REFERENCES → Goal "Increase Revenue 15%" |
| Dependency graph | `DEPENDS_ON` | Campaign → DEPENDS_ON → Budget Approval |

### 11.3 Graph Query

```typescript
@Injectable()
export class EntityGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubgraph(params: { entityType: EntityType; entityId: string; tenantId: string; depth?: number }) {
    // BFS traversal — tenant-scoped at every hop
    const visited = new Set<string>();
    const edges: Array<{ from: string; to: string; type: string }> = [];
    let queue = [`${params.entityType}:${params.entityId}`];

    for (let d = 0; d < (params.depth ?? 2) && queue.length > 0; d++) {
      const next: string[] = [];
      for (const key of queue) {
        if (visited.has(key)) continue;
        visited.add(key);
        const [type, id] = key.split(':', 2);
        const outgoing = await this.prisma.entityRelationship.findMany({
          where: { tenantId: params.tenantId, fromType: type as EntityType, fromId: id },
        });
        for (const rel of outgoing) {
          const targetKey = `${rel.toType}:${rel.toId}`;
          edges.push({ from: key, to: targetKey, type: rel.type });
          if (!visited.has(targetKey)) next.push(targetKey);
        }
      }
      queue = next;
    }
    return { entities: Array.from(visited), edges };
  }
}
```

---

## 12. Complete Data Model Changes

### 12.1 All Schema Changes

| Change | Type | Phase | Migration Notes |
|---|---|---|---|
| Add `threadId String?` to `HermesMessage` | ALTER TABLE | 1 | Nullable, no default, no lock |
| Add `contextType String?` to `HermesMessage` | ALTER TABLE | 1 | Same |
| Add `contextId String?` to `HermesMessage` | ALTER TABLE | 1 | Same |
| Add `idempotencyKey String? @unique` to `HermesMessage` | ALTER TABLE | 1 | Unique index is validated per row; new rows only |
| Create `CommunicationThread` | CREATE TABLE | 1 | New table |
| Create `ThreadParticipant` | CREATE TABLE | 1 | New table |
| Create `ThreadReadState` | CREATE TABLE | 1 | New table |
| Create `ActivityEvent` | CREATE TABLE | 2 | New table |
| Create `AdapterCursor` | CREATE TABLE | 2 | New table |

### 12.2 Indexes (FIX: all CONCURRENTLY)

```sql
-- FIX: CREATE INDEX CONCURRENTLY to avoid locking production tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS hermes_messages_thread_id_idx ON hermes_messages(thread_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS hermes_messages_context_idx ON hermes_messages(context_type, context_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS communication_threads_tenant_id_idx ON communication_threads(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS communication_threads_context_idx ON communication_threads(context_type, context_id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS thread_participants_unique ON thread_participants(thread_id, participant_type, participant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS thread_read_states_thread_idx ON thread_read_states(thread_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_events_tenant_id_created_at_idx ON activity_events(tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_events_visibility_idx ON activity_events(tenant_id, visibility, target_participant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_events_expires_at_idx ON activity_events(expires_at) WHERE expires_at IS NOT NULL;
```

### 12.3 Retention / Archival Strategy (FIX)

- `ActivityEvent`: TTL set at creation time. Nightly `DELETE FROM activity_events WHERE expires_at < NOW()` (or partition-by-month and `DROP`). Default TTL: 90 days for events, 365 days for decisions/mission feed items.
- `CommunicationThread`: Archived after 90 days of inactivity (no new messages). CLOSED threads kept for 1 year, then soft-deleted.
- `HermesMessage`: Kept as long as the owning session/thread exists. No independent TTL — they are the conversation record.
- `ThreadReadState`: No TTL — small table, updated in place.

---

## 13. Service Contracts

### 13.1 All Interfaces

| Interface | Methods | Phase | ISP |
|---|---|---|---|
| `IThreadService` | `create`, `get`, `findForEntity`, `addParticipant`, `getMessages`, `markRead`, `getUnreadCount`, `close` | 1 | ✅ 8 methods, no overlap |
| `IActivityService` | `record`, `list`, `registerSource` | 2 | ✅ 3 methods |
| `IActivitySource` | `poll` | 2 | ✅ 1 method |
| `IParticipantResolver` | `resolve`, `resolveBatch`, `search` | 3 | ✅ 3 methods |
| `IAgentMessaging` | `send`, `createChannel`, `getConversation` | 4 | ✅ 3 methods |
| `IAgentMessagingGuard` | `check` | 4 | ✅ 1 method |
| `IExplainabilityService` | `getDecisions`, `getDecisionDetail` | 6 | ✅ 2 methods |
| `IPresenceService` | `setStatus`, `getStatus`, `getActiveByTenant`, `subscribe` | 7 | ✅ 4 methods |
| `IConversationIntelligence` | `summarize`, `search`, `ask` | 8 | ✅ 3 methods |

### 13.2 DI Graph

```
EnterpriseEventBusService → IActivityService, EventsGateway
AgentMessagingService → IHermesRuntime, IThreadService, IParticipantResolver, IActivityService, IAgentMessagingGuard
PresenceService → RedisService, EventsGateway
ConversationIntelligenceService → PrismaService, EmbeddingsService, LLMFactory
ThreadService → PrismaService, EventsGateway
ParticipantResolver → PrismaService, IHermesRegistry
```

Every edge is an interface dependency. No circular dependencies.

---

## 14. Frontend Component Map

### 14.1 New Components

| Component | File | Consumes |
|---|---|---|
| `LiveFeedWidget` | `components/home/LiveFeedWidget.tsx` | `useActivityFeed` hook |
| `ActivityStream` | `components/layout/ActivityStream.tsx` | `useActivityFeed` hook |
| `DecisionCard` | `shared/components/explain/DecisionCard.tsx` | REST `/hermes/explain/:id/decisions` |
| `ExplainabilityPanel` | `shared/components/explain/ExplainabilityPanel.tsx` | REST |
| `PresenceBadge` | `shared/components/presence/PresenceBadge.tsx` | `usePresence` hook (WebSocket) |
| `AgentInboxPanel` | `shared/components/inbox/AgentInboxPanel.tsx` | REST `/threads/unread?participant=` |
| `ThreadView` | `shared/components/thread/ThreadView.tsx` | REST `/threads/:id/messages` |

### 14.2 New Hooks

| Hook | File | Purpose |
|---|---|---|
| `useActivityFeed` | `shared/hooks/useActivityFeed.ts` | WebSocket `activity:new` + REST backfill on reconnect |
| `usePresence` | `shared/hooks/usePresence.ts` | WebSocket `presence:updated` |
| `useExplainability` | `shared/hooks/useExplainability.ts` | Fetch decision history |
| `useThread` | `shared/hooks/useThread.ts` | Thread ops (create, message, markRead, participants) |

### 14.3 TenantShell Layout

```
TenantShell
  ├── IconRail
  ├── Content
  │   ├── TopBar
  │   │   └── PresenceBadge (per visible agent)          ← NEW
  │   ├── <main> → Page content
  │   ├── ActivityStream (bottom bar)
  │   └── InspectorPanel
  ├── Floating Panels
  │   ├── ThingsToDoPanel
  │   ├── CommandPalette
  │   ├── ConversationPanel (OLD — will be removed)
  │   ├── UnifiedChatPanel → ThreadView (within chat)    ← NEW
  │   ├── ExplainabilityPanel (slide-out)                ← NEW
  │   └── AgentInboxPanel (per-agent inbox)              ← NEW
  └── LiveFeedWidget (home page right panel)
```

---

## 15. Migration Path & Backward Compatibility

### 15.1 Phase Ordering

| Phase | Depends On | Risk | Why |
|---|---|---|---|
| 1 — Threads | None | 🟢 Minimal | Additive columns, new tables. No code changes to existing runtime. |
| 2 — Activities | None | 🟢 Minimal | New table + write-through adapters. Existing systems untouched. |
| 3 — Participant | None | 🟢 Minimal | New resolver. No schema change. |
| 4 — A2A Messaging | 1, 3 | 🟡 Medium | New runtime path gated by feature flag + circuit breaker. |
| 5 — Feed Unify | 2 | 🟢 Minimal | Replace mock data. Adapter protects existing MissionFeed. |
| 6 — Explain | None | 🟢 Minimal | Zero schema. New endpoint + UI. |
| 7 — Presence | None | 🟡 Medium | Redis dependency already exists. New service, existing infra reused. |
| 8 — CI | 1, 2 | 🟡 Medium | RAG queries. New service, no schema. |

### 15.2 Testing Strategy (FIX: covers all phases)

| Phase | Unit Tests | Integration Tests | E2E Tests |
|---|---|---|---|
| 1 — Threads | `thread.service.spec.ts` (8 tests) | DB: create thread, add participant, enforce participant check | Cross-agent thread with session → thread migration |
| 2 — Activities | `activity.service.spec.ts` (5 tests) | Write-through adapter records ActivityEvent; visibility filter | WebSocket receives activity:new after tool call; 'direct' events hidden from non-targets |
| 3 — Participant | `participant-resolver.spec.ts` (4 tests) | Resolve USER, AI_AGENT, SYSTEM; tenant isolation enforcement | No E2E (resolver is internal) |
| 4 — A2A Messaging | `agent-messaging.service.spec.ts` (5 tests), `agent-messaging.guard.spec.ts` (4 tests) | Hop limit, cost ceiling, idempotency dedup | Two agents collaborate; circuit breaker blocks runaway chain |
| 5 — Feed | `use-activity-feed.spec.ts` (3 tests) | REST fallback, WS live, backfill on reconnect | LiveFeedWidget shows real events within 5s of tool call |
| 6 — Explain | `explainability.controller.spec.ts` (3 tests) | RBAC: AUDITOR sees request/response, USER does not | Decision card visible for ADMIN role agent |
| 7 — Presence | `presence.service.spec.ts` (5 tests) | Redis TTL, stale sweep, tenant isolation | Agent status changes reflect in PresenceBadge within 2s |
| 8 — CI | `conversation-intelligence.spec.ts` (4 tests) | Map-reduce chunking, single-pass fallback | "What did Finance do?" returns narrative with sources |

### 15.3 Feature Flags

```typescript
export const COMMUNICATION_FLAGS = {
  THREADS_ENABLED: 'COMM_THREADS_ENABLED',
  ACTIVITIES_ENABLED: 'COMM_ACTIVITIES_ENABLED',
  AGENT_MESSAGING_ENABLED: 'COMM_AGENT_MESSAGING_ENABLED', // Default false until guard is verified
  PRESENCE_ENABLED: 'COMM_PRESENCE_ENABLED',
  CONVERSATION_INTELLIGENCE_ENABLED: 'COMM_CI_ENABLED',
} as const;
```

### 15.4 Rollback Strategy

Every phase is independently rollbackable, feature-flagged, and additive-only. No phase requires a data migration that cannot be reverted by simply turning off the flag and removing the new service registration.

**Accepting Prisma's "roll forward" model:** Prisma Migrate has no `migrate down` command. This is intentional — Prisma treats migrations as a linear forward history. For Phases 1 and 2 (all additive: nullable columns, new tables), the rollback is simply:
1. Turn off the feature flag (stops all writes to new columns/tables)
2. Optional: generate a manual down script via `prisma migrate diff --from-url <URL> --to-url <URL> --script > down.sql`, review, apply with `prisma db execute --file down.sql`
3. If you never need the schema back, remove the migration from history with `prisma migrate resolve --rolled-back <migration_name>` (only valid for failed migrations — for successful ones, leave the history intact and just stop writing)

In practice, additive-only migrations never require a rollback in production — you just stop using the new columns. The only scenario requiring schema removal would be a tenant explicitly requesting data deletion (covered by retention policies in §16.5.2).

### 15.5 Branching & Deployment Strategy

**Drop the long-lived branch.** Feature flags already provide dark-shipping safety. Adding a long-lived branch on top is redundant and introduces drift risk — Prisma migration histories can become inconsistent between the branch and main.

Use trunk-based development with short-lived, phase-scoped branches:

```
main ← feat/thread-model      ── merges Phase 1 behind COMM_THREADS_ENABLED=false
main ← feat/activities         ── merges Phase 2 behind COMM_ACTIVITIES_ENABLED=false
main ← feat/a2a-messaging      ── merges Phase 4 behind COMM_AGENT_MESSAGING_ENABLED=false
...etc
```

**Per-phase workflow:**
1. Create branch `feat/<phase-name>` off `main`
2. Implement the phase. Add feature flag (default `false`) in the same PR.
3. Open PR into `main`. CI runs tests. Merge.
4. Deploy to Contabo from `main` (same rsync+pm2 flow as always).
5. Observe production behavior with flag still `false`.
6. Flip flag `true` per-tenant via admin UI. Observe. Fix if needed. If rollback needed, flip flag `false` — no schema migration needed for additive changes.

**Never rsync a feature branch to Contabo.** Deploy only from `main`. Feature branches are local/dev-only.

**Prisma migration management across phases:**
- Ship each phase's schema changes as a **separate Prisma migration**: `20260708_thread_model`, `20260708_activity_events`, `20260708_a2a_fields`, etc.
- Three reasons for separation: (a) each migration is independently revertable via manual down script, (b) smaller blast radius if a migration fails, (c) Prisma migration history stays linear and reconcilable with main — no two branches ever define different migration histories because every branch merges into the same `main` lineage.
- Because all migrations are additive, there is no conflict risk between phases. A later phase's migration file simply has a later timestamp and sees the earlier columns/tables already present.

### 15.6 Database Snapshots

**Do not `pm2 stop` the backend or run `pg_dump` on Contabo.** `pg_dump` uses MVCC and produces a transactionally consistent snapshot without any application downtime.

Production database is Contabo Local PostgreSQL 16 on `127.0.0.1:5433`.

---

## 16. Phase 9 — Enterprise Workplace Features

The previous phases build the communication plumbing (threads, activities, A2A messaging, presence, intelligence). This phase builds the **organizational layer** that makes the system feel like a company rather than a message bus. Everything in this phase builds on primitives already established in Phases 1–8 — no new architecture, only new composition.

### 16.1 Business Signal — Raw Activity → Decisions & Reports

#### 16.1.1 Department/Goal Digest Generation

Extend `ConversationIntelligenceService.summarize()` to accept an entity scope broader than a single participant: department, goal, project, or entire tenant.

```typescript
// Already exists in §10. Extend the params:
export interface DigestParams {
  scope: {
    type: 'AGENT' | 'DEPARTMENT' | 'GOAL' | 'PROJECT' | 'TENANT';
    id: string;
  };
  tenantId: string;
  period: { from: Date; to: Date };
}

// Walk EntityRelationship to find all participants within scope
// E.g., DEPARTMENT scope = find all AGENT nodes with OPERATES_IN → department
// Then call summarize() per participant and reduce the narratives
```

**Implementation:** New `DigestService` that queries `EntityRelationship` for the scope's participant tree, fans out `summarize()` calls per agent, and merges narratives using the same map-reduce pattern from Phase 8. Scheduled via cron (weekly digest) or on-demand (ad hoc report).

**Free with existing infra:** `ConversationIntelligenceService` (§10), `EntityGraphService` (§11), `ActivityEvent` (§4).

#### 16.1.2 KPI/Health Rollups via EntityHealth

`EntityHealth` (`schema.prisma:2042`) already stores per-entity computed health scores, signals, and trends. Wire it into a rolling aggregation service:

```typescript
@Injectable()
export class EntityHealthRollupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entityGraph: EntityGraphService,
  ) {}

  async getDepartmentHealth(deptId: string, tenantId: string) {
    // Walk the org graph: find all AGENT CHILD_OF this department
    const agents = await this.entityGraph.getSubgraph({
      entityType: 'DEPARTMENT',
      entityId: deptId,
      tenantId,
      depth: 3,
      // Only return AGENT nodes
    });

    // Aggregate their EntityHealth entries
    const healths = await this.prisma.entityHealth.findMany({
      where: {
        tenantId,
        entityType: 'AGENT',
        entityId: { in: agents.entities },
      },
    });

    return {
      departmentId: deptId,
      score: average(healths.map((h) => h.score)),
      severity: worst(healths.map((h) => h.severity)),
      trend: aggregate(healths.map((h) => h.trend)),
      openAlerts: sum(healths.map((h) => h.openAlerts)),
      breakdown: healths,
    };
  }

  async getGoalHealth(goalId: string, tenantId: string) {
    // Walk REFERENCES edges from Goal → Tasks → Agents
    // Same aggregation pattern
  }
}
```

**Free with existing infra:** `EntityHealth` model, `EntityRelationship` graph, `EntityGraphService`.

#### 16.1.3 Cost-Center Reporting

Aggregate `HermesAuditLog.costUsd` and `tokensUsed` by department, project, or goal using `EntityRelationship` to assign costs to the right cost center:

```typescript
@Injectable()
export class CostCenterService {
  async getDepartmentCost(deptId: string, tenantId: string, period: { from: Date; to: Date }) {
    // Walk EntityRelationship to find agents assigned to this department
    const agentEdges = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId,
        fromType: 'DEPARTMENT',
        fromId: deptId,
        type: 'OPERATES_IN' as RelationshipType,
      },
    });
    const agentIds = agentEdges.map((e) => e.toId);

    // Aggregate audit log cost for those agents
    const cost = await this.prisma.hermesAuditLog.aggregate({
      where: {
        hermesAgentId: { in: agentIds },
        tenantId,
        createdAt: { gte: period.from, lte: period.to },
      },
      _sum: { costUsd: true, tokensUsed: true },
      _count: true,
    });

    return {
      departmentId: deptId,
      totalCostUsd: cost._sum.costUsd ?? 0,
      totalTokens: cost._sum.tokensUsed ?? 0,
      totalActions: cost._count,
      period,
    };
  }
}
```

**Free with existing infra:** `HermesAuditLog` (§8), `EntityRelationship` (§11), `EntityGraphService`.

#### 16.1.4 Anomaly / Risk Flagging

A background service that monitors `EntityHealth` trends and `ActivityEvent` severity spikes, then auto-generates `MissionFeedItem` entries for responsible managers:

```typescript
@Injectable()
export class RiskDetectionService implements OnModuleInit {
  private readonly INTERVAL_MS = 300_000; // 5 min

  async tick(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const t of tenants) {
      // 1. Find entities with degrading health
      const degrading = await this.prisma.entityHealth.findMany({
        where: { tenantId: t.id, severity: 'CRITICAL' },
      });

      for (const health of degrading) {
        // 2. Walk REPORTS_TO / PARENT_OF to find responsible human
        const manager = await this.findManager(health.entityType, health.entityId, t.id);

        // 3. Create MissionFeedItem for that person
        await this.missionFeed.create({
          category: 'ANOMALY_DETECTED',
          priority: health.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          title: `${health.entityType} health degraded`,
          description: `${health.entityId} score dropped to ${health.score}`,
          entityType: health.entityType,
          entityId: health.entityId,
          userId: manager,
          actionPayload: { signals: health.signals, trend: health.trend },
        }, t.id);
      }
    }
  }

  private async findManager(entityType: string, entityId: string, tenantId: string): Promise<string | null> {
    // Walk EntityRelationship REPORTS_TO → PARENT_OF → find USER node
    const reportsTo = await this.prisma.entityRelationship.findFirst({
      where: { tenantId, fromType: entityType as EntityType, fromId: entityId, type: 'REPORTS_TO' as RelationshipType },
    });
    if (!reportsTo || reportsTo.toType !== 'USER') return null;
    return reportsTo.toId;
  }
}
```

**Free with existing infra:** `EntityHealth`, `EntityRelationship`, `MissionFeedService`, `ActivityEvent`.

### 16.2 Workflow Mechanics — Lifecycles, Not Just Events

#### 16.2.1 SLA / Escalation Timers

When an approval request or activity with severity `warn`+ goes unactioned past a configurable threshold, walk `REPORTS_TO` → `PARENT_OF` edges to find the next-level participant and re-notify:

```typescript
@Injectable()
export class EscalationService implements OnModuleInit {
  private readonly ESCALATION_THRESHOLDS = {
    approval: { warnAt: 4 * 3600 * 1000, escalateAt: 8 * 3600 * 1000, maxLevels: 3 },
    risk: { warnAt: 1 * 3600 * 1000, escalateAt: 4 * 3600 * 1000, maxLevels: 2 },
  };

  async tick(): Promise<void> {
    // Find all APPROVAL_REQUIRED activities past threshold
    const stale = await this.prisma.activityEvent.findMany({
      where: {
        type: { in: ['approval:requested', 'risk:detected'] },
        createdAt: { lt: new Date(Date.now() - 4 * 3600 * 1000) },
        payload: { path: ['escalationLevel'], not: 3 },
      },
    });

    for (const activity of stale) {
      const level = (activity.payload as any)?.escalationLevel ?? 0;
      const threshold = this.ESCALATION_THRESHOLDS[activity.type === 'approval:requested' ? 'approval' : 'risk'];

      if (level >= threshold.maxLevels) continue; // Max escalation reached

      // Walk REPORTS_TO to find next-level participant
      const nextApprover = await this.findNextApprover(
        activity.targetParticipantId!,
        activity.targetParticipantType!,
        activity.tenantId,
      );

      // Create escalation activity
      await this.activityService.record({
        tenantId: activity.tenantId,
        actorType: 'SYSTEM',
        actorId: 'escalation',
        type: `${activity.type}.escalated`,
        title: `Escalated: ${activity.title}`,
        threadId: activity.threadId ?? undefined,
        sourceEventId: `escalation:${activity.id}:${level + 1}`,
        visibility: 'direct',
        targetParticipantType: nextApprover.type,
        targetParticipantId: nextApprover.id,
        payload: { originalEventId: activity.id, escalationLevel: level + 1 },
      });
    }
  }

  private async findNextApprover(participantId: string, participantType: string, tenantId: string) {
    // Walk EntityRelationship REPORTS_TO → to find the manager
    const report = await this.prisma.entityRelationship.findFirst({
      where: { tenantId, fromType: participantType as EntityType, fromId: participantId, type: 'REPORTS_TO' as RelationshipType },
    });
    if (report) return { id: report.toId, type: report.toType };
    // Fallback: walk PARENT_OF on the participant's department
    // ...
    return { id: participantId, type: participantType }; // No escalation possible
  }
}
```

**Primitives used:** `ActivityEvent` (§4), `EntityRelationship` with `REPORTS_TO`/`PARENT_OF` (§11), `EntityGraphService`.

#### 16.2.2 Delegation / Out-of-Office

Add a `DELEGATES_TO` relationship type to the `RelationshipType` enum. When `PresenceService` detects a participant is `offline` or `paused`, `AgentMessagingService.send()` checks for a delegation edge before returning the "delivered=false" path:

```typescript
// In AgentMessagingService.send(), after guard check:
if (target.status === 'offline' || target.status === 'paused') {
  const delegate = await this.prisma.entityRelationship.findFirst({
    where: {
      tenantId: message.tenantId,
      fromType: 'AI_AGENT' as EntityType,
      fromId: message.toAgentId,
      type: 'DELEGATES_TO' as RelationshipType,
    },
  });
  if (delegate) {
    // Re-route to delegate with original hop count
    return this.send({ ...message, toAgentId: delegate.toId });
  }
}
```

**Primitives used:** `EntityRelationship` (new `DELEGATES_TO` type), `PresenceService` (§9), `AgentMessagingService` (§6).

#### 16.2.3 Follow-Up Nudges

Batch job that scans `CommunicationThread` for threads where the last message expects a reply and the other participant hasn't responded within a configurable window (default: 24h). Emits a reminder `ActivityEvent` of type `thread.followup`:

```typescript
@Injectable()
export class FollowUpService implements OnModuleInit {
  private readonly REMINDER_AFTER_MS = 24 * 3600 * 1000;

  async tick(): Promise<void> {
    const threads = await this.prisma.communicationThread.findMany({
      where: { status: 'ACTIVE', updatedAt: { lt: new Date(Date.now() - this.REMINDER_AFTER_MS) } },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        participants: true,
      },
    });

    for (const thread of threads) {
      const lastMsg = thread.messages[0];
      if (!lastMsg) continue;

      // Find who hasn't responded
      const respondent = thread.participants.find(
        (p) => p.participantType !== 'SYSTEM' && p.isActive,
      );
      if (!respondent) continue;

      await this.activityService.record({
        tenantId: thread.tenantId,
        actorType: 'SYSTEM',
        actorId: 'follow-up',
        type: 'thread.followup',
        title: `Follow-up needed in "${thread.title}"`,
        threadId: thread.id,
        visibility: 'direct',
        targetParticipantType: respondent.participantType,
        targetParticipantId: respondent.participantId,
        sourceEventId: `followup:${thread.id}:${Date.now()}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
  }
}
```

**Primitives used:** `CommunicationThread` (§3), `ActivityEvent` (§4), `ParticipantResolver` (§5).

#### 16.2.4 Recurring Workflow Templates

Add a lightweight `WorkflowTemplate` model for processes that run on a schedule (weekly status, monthly budget review, quarterly planning):

```prisma
model WorkflowTemplate {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  name        String
  description String?
  cron        String   // "0 9 * * 1" = every Monday 9am
  timezone    String   @default("UTC")

  // Template for thread creation
  threadTitle String
  participantIds String[] // JSON array of participant types + ids to auto-join
  contextType String?
  contextId   String?

  // Template for first message content
  firstMessageContent String?

  isActive    Boolean  @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId, isActive, nextRunAt])
  @@map("workflow_templates")
}
```

A cron-driven `WorkflowTemplateService` checks every minute for templates where `nextRunAt <= now()`, creates a `CommunicationThread`, adds participants, posts the first message, emits an `ActivityEvent`, and schedules the next run.

**Primitives used:** `CommunicationThread` (§3), `ActivityEvent` (§4), `ThreadParticipant` (§3).

### 16.3 Attention Management — Making It Usable at Scale

#### 16.3.1 @Mentions and Directed Messages

Add a `mentions` JSON field to `HermesMessage` and `ActivityEvent`:

```prisma
// Add to HermesMessage
mentions Json? @default("[]") // [{ participantType: "USER", participantId: "..." }]
```

When a message or activity contains mentions, the `EnterpriseEventBusService` fans out a notification to the mentioned participants in addition to the standard delivery:

```typescript
// In HermesSessionService.addMessage(), after creating the message:
if (mentions && mentions.length > 0) {
  for (const mention of mentions) {
    this.eventsGateway.emitToUser(mention.participantId, 'thread:mention', {
      threadId,
      messageId: message.id,
      mentionedBy: { type: role, id: sessionId },
      preview: content.substring(0, 200),
    });
  }
}
```

**Schema change:** Add `mentions Json? @default("[]")` to `HermesMessage` and `ActivityEvent`.

#### 16.3.2 Per-User Notification Preferences

Add a `NotificationPreference` model:

```prisma
model NotificationPreference {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String

  // Scope
  threadId    String?  // null = global default
  activityType String? // null = all types
  minSeverity String?  // null = all severities. "warn" = only warn+error

  // Delivery
  deliveryMode String @default("realtime") // "realtime" | "digest" | "muted"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, userId, threadId, activityType])
  @@map("notification_preferences")
}
```

`EnterpriseEventBusService.emit()` checks preferences before delivering: if the target user's preference for that `activityType` is `muted`, skip the WebSocket push. If `digest`, batch into a daily summary instead.

**Primitives used:** `ActivityEvent` (§4), `EnterpriseEventBusService` (§4.6).

#### 16.3.3 Thread Auto-Summarization

When a `CommunicationThread` exceeds N messages (e.g., 100), the `FollowUpService` (or a dedicated `ThreadSummarizationService`) asynchronously runs a summarization pass using the same LLM machinery from Phase 8 and posts a SYSTEM message into the thread:

```typescript
async summarizeThread(threadId: string, tenantId: string): Promise<void> {
  const messages = await this.threadService.getMessages(threadId, { limit: 200 });
  if (messages.length < 100) return;

  const narrative = await this.llmFactory.invokeSummary(
    messages.map((m) => `[${m.role}]: ${m.content}`).join('\n'),
  );

  // Post as SYSTEM message
  await this.session.addMessage(
    /* sessionId */ threadId,
    'SYSTEM',
    `📋 Thread summary (${messages.length} messages):\n${narrative}`,
    undefined,
    threadId,
  );
}
```

**Free with existing infra:** `ConversationIntelligenceService` (§10), `ThreadService` (§3), `HermesSessionService` (§3.6).

### 16.4 Organizational Intelligence — EntityRelationship as the Brain

#### 16.4.1 "Who Should I Ask" Routing

Extend `HermesRouter` (§5, `hermes-router.ts`) to use `COLLABORATES_WITH` and `REPORTS_TO` edges from `EntityRelationship` as fallback routing when no direct capability match exists:

```typescript
// In HermesRouter.selectHermesAgent(), after capability mapping fails:
if (!directMatch) {
  // Walk COLLABORATES_WITH edges from the requesting agent
  const collaborators = await this.prisma.entityRelationship.findMany({
    where: {
      tenantId: params.tenantId,
      fromType: 'AI_AGENT',
      fromId: params.requestingAgentId,
      type: 'COLLABORATES_WITH' as RelationshipType,
    },
  });
  for (const edge of collaborators) {
    const agent = await this.registry.findById(edge.toId);
    if (agent && agent.status === 'IDLE') {
      return { hermesAgentId: agent.id, hermesType: agent.type };
    }
  }
  // Fallback: ask registry for any available agent
}
```

#### 16.4.2 Dependency-Aware Alerts

When an event changes the state of a task or approval that other entities `DEPENDS_ON`, walk the `EntityRelationship` graph and notify all dependent participants:

```typescript
// In EnterpriseEventBusService.emit(), after recording:
if (event.data.entityType && event.data.entityId) {
  const dependents = await this.prisma.entityRelationship.findMany({
    where: {
      tenantId,
      toType: event.data.entityType as EntityType,
      toId: event.data.entityId as string,
      type: 'DEPENDS_ON' as RelationshipType,
    },
  });
  for (const dep of dependents) {
    this.eventsGateway.emitToTenant(tenantId, 'dependency:updated', {
      dependentEntity: { type: dep.fromType, id: dep.fromId },
      changedEntity: { type: event.data.entityType, id: event.data.entityId },
      event: event.type,
    });
  }
}
```

#### 16.4.3 Cross-Department Q&A

Extend `ConversationIntelligenceService.ask()` to accept a tenant-wide scope, using `EntityRelationship.OPERATES_IN` edges to scope the retrieval to the relevant departments:

```typescript
async ask(params: {
  tenantId: string;
  question: string;
  scopeDepartmentId?: string; // Optional — limits scope
}): Promise<{ answer: string; sources: string[] }> {
  // If scoped to a department, find all agents in that department
  let agentIds: string[] | undefined;
  if (params.scopeDepartmentId) {
    const edges = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId: params.tenantId,
        fromType: 'DEPARTMENT',
        fromId: params.scopeDepartmentId,
        type: 'OPERATES_IN' as RelationshipType,
      },
    });
    agentIds = edges.map((e) => e.toId);
  }

  // Scope message/audit/memory queries to those agents
  // ... rest of RAG pipeline from §10
}
```

### 16.5 Compliance & Governance

#### 16.5.1 Exportable Audit Trail

A new controller endpoint that generates a CSV/PDF of thread and decision history for compliance officers:

```typescript
@Controller({ path: 'compliance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AUDITOR', 'SUPER_ADMIN')
export class ComplianceController {
  @Get('export/thread/:threadId')
  async exportThread(
    @Param('threadId') threadId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const user = req.user as JwtPayload;
    const messages = await this.prisma.hermesMessage.findMany({
      where: { threadId, session: { tenantId: user.tenantId! } },
      orderBy: { createdAt: 'asc' },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="thread-${threadId}.csv"`);
    // Write CSV header + rows
    res.send(formatMessagesAsCsv(messages));
  }

  @Get('export/decisions')
  async exportDecisions(
    @Req() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const user = req.user as JwtPayload;
    const logs = await this.prisma.hermesAuditLog.findMany({
      where: {
        tenantId: user.tenantId!,
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { status: 'success', data: { decisions: logs, format: 'json' } };
  }
}
```

#### 16.5.2 Configurable Retention Policies

Add a `RetentionPolicy` model per tenant:

```prisma
model RetentionPolicy {
  id        String @id @default(cuid())
  tenantId  String @unique
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // TTL in days per category
  activityEventTtlDays  Int @default(90)
  threadInactiveTtlDays Int @default(90) // auto-archive after N days inactive
  threadArchiveTtlDays  Int @default(365) // permanently delete after N days archived
  auditLogTtlDays       Int @default(365)
  messageTtlDays        Int @default(730) // 2 years

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("retention_policies")
}
```

A nightly `RetentionJobService` reads each tenant's policy and performs the cleanup per §12.3.

### 16.6 Phase 9 Testing

| Area | Unit Tests | Integration | E2E |
|---|---|---|---|
| Digests | `digest.service.spec.ts` (4 tests) | Digest over 3-agent dept returns merged narrative | Weekly digest email contains all dept activity |
| KPI Rollups | `entity-health-rollup.spec.ts` (3 tests) | Dept health = weighted avg of agent healths | Dashboard shows 85% health for Engineering |
| Cost Center | `cost-center.service.spec.ts` (3 tests) | Cost aggregation by dept matches sum of agent costs | Finance sees weekly cost breakdown by agent |
| Anomaly Detection | `risk-detection.spec.ts` (3 tests) | HEALTH_DEGRADED event triggers MissionFeedItem | Manager gets alert when agent health drops |
| SLA Escalation | `escalation.service.spec.ts` (4 tests) | Escalation walks REPORTS_TO chain up to 3 levels | Approval auto-escalates after 8h → CEO notified |
| Delegation | Integration test | Offline agent's message rerouted to delegate | Agent paused → messages route to backup |
| Follow-Up Nudges | `follow-up.service.spec.ts` (2 tests) | Thread with 24h+ stale last message gets reminder | User receives "Follow-up needed in ..." notification |
| Workflow Templates | `workflow-template.spec.ts` (4 tests) | Cron template creates thread + posts first message | Weekly budget thread auto-created Monday 9am |
| @Mentions | `hermes-session.service.spec.ts` (1 test) | Mentioned participant receives thread:mention WS event | @AgentName triggers notification for that agent |
| Notification Prefs | `notification-preference.spec.ts` (3 tests) | Muted thread suppresses activity emission | User mutes a thread → no more pings |
| Thread Summarization | Integration test | 150-msg thread generates summary as SYSTEM message | Thread shows "📋 Thread summary (150 messages)" |
| Compliance Export | `compliance.controller.spec.ts` (2 tests) | CSV export contains all messages in date order | Auditor downloads thread as CSV, opens in Excel |

### 16.7 Phase 9 Feature Flags

```typescript
DIGEST_ENABLED: 'COMM_DIGEST_ENABLED',
ESCALATION_ENABLED: 'COMM_ESCALATION_ENABLED',
FOLLOWUP_ENABLED: 'COMM_FOLLOWUP_ENABLED',
MENTIONS_ENABLED: 'COMM_MENTIONS_ENABLED',
```

### 16.8 Updated Phase Ordering

| Phase | Risk | Change from v1 |
|---|---|---|
| 1–8 | 🟢–🟡 | Unchanged from original plan |
| 9a — Business Signal (Digest, KPI, Cost, Risk) | 🟢 Minimal | New services, no schema beyond what phases 2+4+8 already have |
| 9b — Workflow Mechanics (SLA, Delegation, Nudges, Templates) | 🟡 Medium | New background services + 1 new model (`WorkflowTemplate`). Escalation uses existing `EntityRelationship` types. |
| 9c — Attention (Mentions, Prefs, Summaries) | 🟢 Minimal | New schema for prefs (`NotificationPreference`), new field on HermesMessage (`mentions`). Summary reuses Phase 8 machinery. |
| 9d — Org Intelligence (Routing, Alerts, Q&A) | 🟢 Minimal | New queries on existing `EntityRelationship` data. No schema changes. |
| 9e — Compliance (Export, Retention) | 🟢 Minimal | New controller + new model (`RetentionPolicy`). |

---

## Appendix: Production Concerns Addressed

| Concern | Where Addressed | Fix |
|---|---|---|
| Presence tenant leak (`'all'` room broadcast) | §9.4 | `tenantId` is a typed, required parameter on `setStatus()`. No fallback to `'all'`. |
| Presence single-instance in-memory | §9.4 | Redis-backed with TTL. Survives restart and multi-instance. |
| Presence stale entries | §9.4 | Background sweep every 60s marks entries 'offline' after 5min inactivity. |
| A2A infinite chain / runaway cost | §6.4, §6.5 | `AgentMessagingGuard` enforces max 5 hops (authoritative hop count on `CommunicationThread.hopCount`, not client-supplied), 50 msgs/thread, $10/thread ceiling (aggregated by `HermesAuditLog.threadId`, not `sessionId`). |
| Text 'all' broadcast on missing tenant | §9.4, §4.6 | `EnterpriseEventBusService` drops events with no tenantId. Presence requires typed tenantId. |
| Visibility not enforced | §4.5, §3.5 | `ActivityService.list()` filters by visibility + target participant. `ThreadService.getMessages()` requires participant membership. |
| Adapter polling gaps | §4.4 | Write-through emission preferred over polling. `AdapterCursor` table for watermark persistence where polling is unavoidable. |
| Explainability exposes prompts/payloads | §8.3 | `RolesGuard` restricts `request`/`response` fields to AUDITOR/SUPER_ADMIN. |
| No retention/archival strategy | §12.3 | Per-table TTL + nightly cleanup. `ActivityEvent.expiresAt` set at creation. |
| Indexes lock production tables | §12.2 | All indexes use `CREATE INDEX CONCURRENTLY`. |
| No idempotency on A2A messages | §3.6, §6.5 | `HermesMessage.idempotencyKey` (unique) prevents double-post on retry. |
| Context-budget overflow in CI | §10.4 | Map-reduce summarization chunks at 50K chars. Single-pass fallback when within budget. |
| Testing table had coverage gaps | §15.2 | All 8 phases now have unit/integration/E2E entries. |
| AgentInboxPanel had no backing | §3.4 | `ThreadReadState` model + `markRead()`/`getUnreadCount()` on `IThreadService`. |
| A2A cost ceiling queries by sessionId (always 0) | §3.3, §6.4 | Added `threadId` column to `HermesAuditLog`. Cost ceiling query now aggregates by `threadId` across all sessions on that thread. |
| Hop count is client-supplied (bypassable) | §6.4, §6.5 | Guard reads authoritative `CommunicationThread.hopCount` from DB. `send()` increments it server-side via Prisma `{ increment: 1 }`. Client-supplied value ignored. |
| Thread-visibility doesn't check membership | §4.5 | `ActivityService.list()` resolves participant's thread IDs via separate `ThreadParticipant` query, then filters activity events to those threads. Non-participants cannot see thread-scoped events. |
| Redis `KEYS` blocks on large instances | §9.4 | `sweepStale()` uses `SCAN` with cursor-based iteration instead of `KEYS`. No behavioral change, production-safe at any scale. |
| Backfill-on-reconnect missing | §7.4 | `useActivityFeed` fetches REST on reconnect, passing `since: lastId`. |
| Feed has no Observability plan | §15 | Monitoring dashboards are listed as Phase 9 follow-up (Prometheus metrics per tenant for activity volume, A2A rates, presence staleness, CI cost). |
