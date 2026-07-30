# Hermes Runtime — Full Deployment & Activation Report

**Date:** 2026-07-12
**Status:** COMPLETE — Hermes runtime deployed and operational

---

## 1. Executive Summary

Hermes is the AI agent execution runtime for NeureCore, providing:
- **Autonomous agent execution** — LangGraph-based task decomposition & tool use
- **Agent-to-Agent (A2A) messaging** — Communication threads with circuit breaker guards
- **Goal-to-task breakdown** — LLM-powered planning via AgentPlannerService
- **Enterprise event bus** — Persisted activity events with WebSocket fan-out
- **Session/memory management** — Long-term memory with vector embeddings

---

## 2. What Was Deployed

### 2.1 Environment Variables (Contabo backend .env)

Added to `/opt/neurecore/backend/backend/.env`:

```bash
HERMES_ENABLED=true        # Routes agent execution through HermesRuntimeService
HERMES_AUTO_LINK=true      # Auto-creates HermesAgent records for new agents
HERMES_SESSION_LOGGING=true # Logs all Hermes sessions to HermesAuditLog
HERMES_APPROVAL_REQUIRED=false # No approval gate (can be enabled per-tool)
```

### 2.2 Hermes Agent Linking Migration

Created and ran `scripts/hermes-migrate.cjs` which:
1. Finds all agents WITHOUT `hermesAgentId`
2. Creates a corresponding `HermesAgent` record for each
3. Links them back via `Agent.hermesAgentId = HermesAgent.id`

**Result:** 41/41 agents linked successfully

### 2.3 41 HermesAgent Records Created

Each HermesAgent has:
- `name`: `{Agent Name} [Auto]`
- `type`: `CUSTOM`
- `model`: `gpt-4o-mini` (or agent's configured model)
- `status`: `IDLE` (set to `RUNNING` when executing)

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   neurecore-backend (PM2)                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  AgentExecutorService                                │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │  Feature Flag: HERMES_ENABLED=true              │  │ │
│  │  │  → executeTaskViaHermes()                       │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                               │
│                           ▼                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  HermesRuntimeService.execute()                       │ │
│  │  1. Find/link HermesAgent (auto-link)                 │ │
│  │  2. Build context (memory + tools)                     │ │
│  │  3. Stream via OfficialAgentGraph (LangGraph)          │ │
│  │  4. Emit events (EXECUTION_STARTED/COMPLETED/ERROR)   │ │
│  │  5. Track presence (Redis)                             │ │
│  │  6. Summarize to memory                                │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                               │
│          ┌────────────────┴────────────────┐              │
│          ▼                                 ▼              │
│  ┌──────────────┐                  ┌──────────────┐       │
│  │ A2A Messaging│                  │ Event Bus    │       │
│  │ (AgentMessag-│                  │ (Enterprise  │       │
│  │ ingService)  │                  │ EventBus)    │       │
│  │ • 5 hop max  │                  │ • Activity   │       │
│  │ • $10 cost   │                  │ • WebSocket  │       │
│  │ • Idempotent │                  │ • Thread     │       │
│  └──────────────┘                  └──────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Hermes runs IN-PROCESS in backend | No separate worker/queue deployment needed. Execution is async/streaming |
| Feature flag gated (`HERMES_ENABLED`) | Can be toggled per-tenant or globally without code change |
| Auto-linking via `ensureHermesAgent()` | HermesAgent records created lazily on first execution |
| Redis for presence | Uses existing Upstash Redis infra (graceful degradation) |
| LLM model via AI Gateway | Gateway resolves capability→model mapping per tenant |

---

## 4. Files Added/Modified

| File | Type | Purpose |
|------|------|---------|
| `backend/scripts/hermes-migrate.cjs` | **NEW** | Standalone migration: links all agents to HermesAgent records |
| `backend/.env` (Contabo) | MODIFIED | Added HERMES_ENABLED=true and related vars |

### Hermes Module Core Files (pre-existing, already in repo)

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/modules/hermes/hermes.module.ts` | ~60 | `@Global()` module, 29 providers, 2 controllers |
| `backend/src/modules/hermes/services/hermes-runtime.service.ts` | ~250 | Central execution engine |
| `backend/src/modules/hermes/services/hermes-registry.service.ts` | 148 | HermesAgent CRUD + auto-link |
| `backend/src/modules/hermes/services/hermes-session.service.ts` | ~200 | Session/message management |
| `backend/src/modules/hermes/services/hermes-context.service.ts` | ~180 | Context assembly (memory + tools) |
| `backend/src/modules/hermes/services/hermes-memory.service.ts` | ~150 | Long-term memory with embeddings |
| `backend/src/modules/hermes/services/agent-messaging.service.ts` | 180 | A2A message routing |
| `backend/src/modules/hermes/services/agent-messaging.guard.ts` | ~80 | Circuit breaker (5 hops, 50 msg, $10) |
| `backend/src/modules/hermes/services/enterprise-event-bus.service.ts` | ~200 | Persisted event bus + WebSocket |
| `backend/src/modules/hermes/services/presence.service.ts` | ~120 | Redis-backed presence |
| `backend/src/modules/hermes/services/activity.service.ts` | ~100 | ActivityEvent recording |
| `backend/src/modules/hermes/langgraph/hermes-node.ts` | ~80 | LangGraph node wrapper |
| `backend/src/modules/hermes/langgraph/hermes-router.ts` | ~60 | Capability→HermesAgentType mapper |
| `backend/src/modules/hermes/langgraph/hermes-checkpointer.ts` | ~40 | Checkpoint save/load |

---

## 5. Prisma Schema — Key Models

### Agent ↔ HermesAgent Link
```prisma
model Agent {
  hermesAgentId String?      @unique
  hermesAgent   HermesAgent? @relation(fields: [hermesAgentId], references: [id])
}

model HermesAgent {
  id           String            @id @default(cuid())
  name         String
  type         HermesAgentType
  status       HermesAgentStatus @default(IDLE)
  agents       Agent[]
  // + capabilities, toolPermissions, memory, sessions, auditLogs
}
```

### A2A Messaging Models
```prisma
model CommunicationThread {  // → table: communication_threads
  // columns: id, tenantid, title, hopcount, createdat, updatedat, status
}

model ThreadParticipant {  // → table: thread_participants
  // columns: id, threadid, participanttype, participantid, isactive, joinedat
}

model HermesSession {
  // columns: id, hermesAgentId, userId (NOT NULL), tenantId, threadId, status
}

model HermesMessage {
  // columns: id, sessionId, role, content, createdAt
}
```

---

## 6. Deployment Verification

### Post-Deployment Checks (2026-07-12 19:20 PKT)

| Check | Result | Method |
|-------|--------|--------|
| HERMES_ENABLED in .env | ✅ `true` | `grep HERMES_ .env` |
| Backend restart | ✅ PM2 pid 304342 | `pm2 restart --update-env` |
| Backend health | ✅ 200 | `GET /api/v1/health` |
| HermesAgent records | ✅ 41 created | `SELECT COUNT(*) FROM "HermesAgent"` |
| Agents with hermesAgentId | ✅ 41/41 | `SELECT COUNT(*) FROM agents WHERE "hermesAgentId" IS NOT NULL` |
| Agent status | ✅ RUNNING | API: `GET /api/v1/agents` |
| Feature flags | ✅ All enabled | `tenants.settings->featureFlags` |
| A2A test thread | ✅ Created | `INSERT INTO communication_threads` + participants |

---

## 7. Tenant mali@live.com — Current State

| Metric | Value |
|--------|-------|
| Tenant ID | `726522f0-a9e4-4c13-b22f-a9a967b914dc` |
| Total Agents | 41 |
| Agents RUNNING | 41 |
| Agents with HermesAgent | 41 |
| HermesAgents | 41 (CUSTOM type, gpt-4o-mini) |
| Global HERMES_ENABLED | ✅ true |
| Tenant HERMES_ENABLED | ✅ true |
| Tenant AGENT_MESSAGING_ENABLED | ✅ true |
| Tenant COMMS flags | ✅ All enabled |
| A2A Circuit Breaker | 5 hops / 50 msg / $10 |
| Project | Financial Systems Modernization - Q3 2026 (ACTIVE) |
| Project Members | 6 AI employees |

---

## 8. Known Limitations & Next Steps

### Current Limitations

1. **No separate Hermes worker process** — Execution happens in the main backend thread. For heavy workloads, consider extracting Hermes into a dedicated PM2 service with a job queue.

2. **A2A execution requires API trigger** — Direct DB-created threads won't auto-execute agents. The `AgentMessagingService.send()` must be called via the API to trigger `HermesRuntimeService.execute()` on the target agent.

3. **OWNER role permission** — Some Hermes endpoints (agent execution, thread creation) require SUPER_ADMIN permissions. The frontend routes through the proper channels, but API-only testing is limited.

4. **Hermes memory requires OpenAI embeddings** — `HermesMemoryService` uses OpenAI embeddings for vector search. If OpenAI key is unavailable, memory falls back to text-only.

### Recommended Next Steps (Future)

1. **Deploy Hermes as separate worker** — Extract `HermesRuntimeService` into a standalone microservice with a message queue (Bull/BullMQ with Redis) for non-blocking agent execution.

2. **Enable Hermes approval workflows** — Set `HERMES_APPROVAL_REQUIRED=true` on specific tools via `HermesToolPermission` table for human-in-the-loop approval.

3. **Agent tool permission tuning** — Configure per-HermesAgentType tool permissions via `hermes-tools.ts` for finer-grained access control.

4. **Migration automation** — Add `hermes-migrate.cjs` to the deploy pipeline so new agents are auto-linked on deployment.

5. **Multi-model routing** — Leverage AI Gateway to assign different LLM models per capability (planning → gpt-4o, execution → gpt-4o-mini).

---

## 9. Migration Script

The migration script `scripts/hermes-migrate.cjs` is a standalone Node.js script (no NestJS dependency):

```javascript
// Usage: node scripts/hermes-migrate.cjs [tenantId]
// Finds agents without hermesAgentId, creates HermesAgent, links them
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateTenant(tenantId) {
  const agents = await prisma.agent.findMany({
    where: { tenantId, hermesAgentId: null, isActive: true },
  });
  for (const agent of agents) {
    const ha = await prisma.hermesAgent.create({
      data: {
        name: `${agent.name} [Auto]`,
        type: 'CUSTOM',
        tenantId: agent.tenantId,
        isActive: true,
        model: agent.model ?? 'gpt-4o-mini',
        systemPrompt: agent.systemPrompt ?? undefined,
      },
    });
    await prisma.agent.update({
      where: { id: agent.id },
      data: { hermesAgentId: ha.id },
    });
  }
  console.log(`Linked ${agents.length} agents`);
}
```

---

*Document generated 2026-07-12 19:45 PKT*
