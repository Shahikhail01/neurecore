# Hermes Layer Unification Plan — All AI Employees Under Single Orchestration System

**Version:** 1.1
**Date:** 2026-07-04 (created) / 2026-07-19 (last updated)
**Status:** All 5 phases COMPLETE — Hermes module shipped, AgentStateMachine retired (Phase D, 2026-07-19), Hermes default-on (Phase E, 2026-07-19). Reference doc only — see [chat-unification-refactor-plan.md](./chat-unification-refactor-plan.md) for the active cross-cutting refactor.
**Based on Decisions:** Q1–Q9 answered

---

## 1. Overview

### 1.1 Goal

Migrate **all** AI agents in NeureCore to execute through the Hermes runtime system, making `HermesRuntimeService` the single execution engine. `Agent` remains the tenant-facing business entity; `HermesAgent` becomes the execution profile auto-linked to every agent.

### 1.2 Key Architectural Decisions

| Decision | Choice |
|----------|--------|
| Q1 — Model relationship | **Modified B:** `Agent` = business entity, `HermesAgent` = execution profile. All execution via `HermesRuntimeService`. Auto-create `HermesAgent` if missing. |
| Q2 — LangGraph role | LangGraph stays top-level orchestrator (CEO/COO). Hermes executes work. Responsibilities remain separate. |
| Q3 — LangGraph consolidation | Consolidate to `OfficialAgentGraph` only. Retire `AgentStateMachine` after migration. |
| Q4 — Existing agent migration | Auto-link: auto-create `HermesAgent` on first execution. Background migration as optional later phase. |
| Q5 — Approvals | Defer full approval workflow engine. Minimal implementation only if required by execution flow. |
| Q6 — Permissions | Centralize in `ToolGatewayService` using `requiredPermissions` as single source of truth. |
| Q7 — Type coexistence | Keep `Agent.type` (business role) and `HermesAgent.type` (execution specialization) separate — they solve different problems. |
| Q8 — Build order | **Service-first:** Build `HermesRuntimeService` using existing schema, extend schema only when proven necessary. |
| Q9 — Backward compat | Feature flags toggle Hermes vs legacy execution until migration is complete. |

### 1.3 Current State Summary (as of 2026-07-19)

| Component | Status |
|-----------|--------|
| `HermesAgent` + related Prisma models | ✅ Schema + service, fully wired |
| `hermes-tools.ts` | ✅ Wired + used by `ToolGatewayService` |
| Hermes module (`/modules/hermes/`) | ✅ **Fully implemented** — 24 services, 6 interfaces, 3 langgraph nodes, 10 controllers |
| `OfficialAgentGraph` | ✅ Production-ready LangGraph (sole execution engine post-Phase D) |
| `AgentStateMachine` | ✅ **Retired (Phase D, 2026-07-19)** — file deleted, providers removed |
| `ToolGatewayService` | ✅ Implemented — enforces `requiredPermissions` + `HERMES_TOOL_SETS` rules |
| `ApprovalWorkflowEngine` | ✅ Schema + stub engine (full impl deferred per Q5) |
| Feature flags (`HERMES_ENABLED`) | ✅ **Default-on (Phase E, 2026-07-19)** — per-tenant override via `Tenant.settings.featureFlags.HERMES_ENABLED` |

---

## 2. Architecture

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LangGraph (CEO/COO)                            │
│                     OfficialAgentGraph — top-level orchestrator           │
│   Governance Check ──► Approval Gate (minimal) ──► Hermes Node Call     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
    ┌───────────────────────┐       ┌─────────────────────────┐
    │  HermesNode (LangGraph │       │  General-Purpose Subgraph│
    │  node)                │       │  (existing agent flow)   │
    │                       │       │                         │
    │  Calls HermesRuntime  │       │  Falls back to current  │
    │  for typed agents     │       │  executeTask flow for   │
    └───────────────────────┘       │  legacy agents           │
                │                   └─────────────────────────┘
                ▼
    ┌───────────────────────────────────────────────────────┐
    │              HermesRuntimeService                     │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │           HermesRegistryService                   │ │
    │  │  findByType(), getAllowedTools(), getProfile()  │ │
    │  └─────────────────────────────────────────────────┘ │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │           ToolGatewayService                     │ │
    │  │  validate() → enforce requiredPermissions       │ │
    │  └─────────────────────────────────────────────────┘ │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │           HermesSessionService                   │ │
    │  │  threadId, context, messages                    │ │
    │  └─────────────────────────────────────────────────┘ │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │           HermesMemoryService                    │ │
    │  │  personal + episodic memory per agent           │ │
    │  └─────────────────────────────────────────────────┘ │
    └────────────────────────────┬──────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
    ┌───────────────────────┐       ┌─────────────────────────┐
    │  Domain Subgraphs     │       │  General Subgraph       │
    │  (HR, Finance, etc.) │       │  (existing agents)      │
    │  (future phases)      │       │                         │
    └───────────────────────┘       └─────────────────────────┘
```

### 2.2 Feature Flag Strategy

```typescript
// Feature flag: use Hermes runtime for agent execution
HERMES_ENABLED=true|false   // default: false (legacy mode)
HERMES_AUTO_LINK=true|false // auto-create HermesAgent for existing agents
```

- `HERMES_ENABLED=false` → existing `AgentExecutorService` flow unchanged
- `HERMES_ENABLED=true` → `AgentExecutorService` delegates to `HermesRuntimeService`
- Admin toggle per-tenant or global via environment variable

### 2.3 Module Structure (to be created)

```
src/modules/hermes/
├── hermes.module.ts
├── interfaces/
│   ├── hermes-runtime.interface.ts
│   ├── hermes-registry.interface.ts
│   ├── hermes-session.interface.ts
│   ├── hermes-context.interface.ts
│   ├── tool-gateway.interface.ts
│   └── hermes-event-bus.interface.ts
├── services/
│   ├── hermes-registry.service.ts      # capability discovery
│   ├── hermes-runtime.service.ts       # execution engine
│   ├── hermes-session.service.ts       # thread/session management
│   ├── hermes-context.service.ts       # context builder
│   ├── tool-gateway.service.ts         # permission enforcement
│   ├── hermes-memory.service.ts         # agent personal memory
│   └── hermes-event-bus.service.ts      # event emission
├── langgraph/
│   ├── hermes-node.ts                   # LangGraph node
│   ├── hermes-router.ts                # agent selection router
│   └── hermes-checkpointer.ts           # checkpoint integration
├── dto/
│   ├── execute-agent.dto.ts
│   └── session-context.dto.ts
└── common/
    ├── hermes.constants.ts
    └── hermes.types.ts
```

---

## 3. Phased Implementation Plan

### Phase 1 — Foundation (Hermes Module + Runtime)
**Goal:** Create the Hermes module skeleton and `HermesRuntimeService` that can execute any agent using the existing schema.

**Steps:**

1. **Create `hermes.module.ts`** — NestJS module wiring all Hermes services, imported in `app.module.ts` behind `HERMES_ENABLED` flag

2. **Create interfaces** (6 core interfaces):
   - `IHermesRuntime`: `execute(context)`, `getStatus(id)`, `cancel(sessionId)`
   - `IHermesRegistry`: `findById()`, `findByType()`, `getAllowedTools()`, `ensureHermesAgent()` — auto-creates if missing
   - `IHermesSession`: `create()`, `get()`, `addMessage()`, `getMessages()`
   - `IHermesContext`: `build()` — assembles `{ hermesAgentId, tenantId, workspaceId, userId, threadId }`
   - `IToolGateway`: `validate(toolName, hermesType, context)` — enforces `requiredPermissions`
   - `IHermesEventBus`: `emit()`, `subscribe()`, `linkToLangGraph()`

3. **Implement `HermesRegistryService`**:
   - Uses existing `HermesAgent` Prisma model
   - `ensureHermesAgent(agentId, tenantId)`: checks if `Agent.hermesAgentId` exists; if not, creates a default `HermesAgent` with type=`CUSTOM` and links it
   - `getAllowedTools(hermesType)`: reads from `hermes-tools.ts` `HERMES_TOOL_SETS` or falls back to all tools

4. **Implement `ToolGatewayService`**:
   - `validate(toolName, hermesType, context)`: checks `IStructuredTool.requiredPermissions` against the caller's role/context
   - If `HERMES_TOOL_SETS` has a rule for this tool+type (ALLOW/DENY/APPROVAL_REQUIRED), use that
   - Otherwise fall back to `requiredPermissions` array
   - Throws if denied; returns approval-required signal if needed

5. **Implement `HermesRuntimeService`**:
   - `execute(context: HermesExecutionContext)`: main entry point
   - Builds context via `HermesContextService`
   - Validates tool access via `ToolGatewayService`
   - Executes via `OfficialAgentGraph` (as the general subgraph)
   - Stores session messages via `HermesSessionService`
   - Emits events via `HermesEventBus`

6. **Wire feature flag into `AgentsModule`**:
   - Add `HERMES_ENABLED` env var check
   - `AgentExecutorService` — if `HERMES_ENABLED=true`, delegate to `HermesRuntimeService` instead of direct `OfficialAgentGraph` call

7. **Add `hermes-tenant.guard.ts`** — enforce tenant isolation on Hermes endpoints

**Prerequisites:** None (uses existing `HermesAgent` schema)
**Test:** `AgentExecutorService` can execute in Hermes mode via flag

---

### Phase 2 — Session & Memory
**Goal:** Per-agent conversation sessions and personal memory using existing `HermesSession`/`HermesMemoryEntry` models.

**Steps:**

1. **Implement `HermesSessionService`**:
   - `create(hermesAgentId, userId, tenantId, workspaceId?)`: creates `HermesSession`
   - `addMessage(sessionId, role, content, metadata?)`: appends `HermesMessage`
   - `getMessages(sessionId)`: returns conversation history
   - Uses existing `HermesSession`/`HermesMessage` models

2. **Implement `HermesMemoryService`**:
   - `store(hermesAgentId, tenantId, type, content)`: saves `HermesMemoryEntry`
   - `getContext(hermesAgentId, tenantId)`: retrieves recent memory for context injection
   - Types: `PERSONAL`, `EPISODIC`, `PROCEDURAL`
   - Uses existing `HermesMemoryEntry` model

3. **Implement `HermesContextService`**:
   - `build(hermesAgentId, agentId, tenantId, userId, workspaceId?)`: assembles full context object
   - Includes: allowed tools, session history, memory context, user role

4. **Integrate session into `HermesRuntimeService`**:
   - Each `execute()` call creates or resumes a `HermesSession`
   - Memory is injected into the LangGraph state before execution

**Prerequisites:** Phase 1 complete
**Schema changes:** None (models already exist)

---

### Phase 3 — LangGraph Integration
**Goal:** `hermesNode` and `hermesRouter` inside `OfficialAgentGraph`.

**Steps:**

1. **Create `hermes-node.ts` (LangGraph node)**:
   ```typescript
   export const hermesNode = (runtime: HermesRuntimeService) => {
     return async (state: AgentGraphState, config: RunnableConfig) => {
       const result = await runtime.execute({
         sessionId: state.sessionId,
         hermesAgentId: state.context.hermesAgentId,
         task: state.goal,
         context: state.context,
       });
       return { hermesResult: result, messages: [...] };
     };
   };
   ```

2. **Create `hermes-router.ts` (LangGraph node)**:
   - Reads `goal` and `context.hermesType`
   - Calls `HermesRegistryService.findByType()` to select Hermes agent
   - Routes to `hermesNode` if Hermes type found; falls back to general subgraph

3. **Add `HermesCheckpointer`**:
   - Integrates with existing `AgentCheckpointService`
   - Saves session + memory on checkpoint

4. **Update `OfficialAgentGraph`**:
   - Add conditional edge: if agent has `hermesType` → `hermesRouter` → `hermesNode`
   - Otherwise → existing `planner` → `executor` path

**Prerequisites:** Phase 1+2 complete
**Schema changes:** None

---

### Phase 4 — Auto-Link Migration
**Goal:** All existing agents are transparently Hermes-enabled without manual migration.

**Steps:**

1. **Enhance `HermesRegistryService.ensureHermesAgent()`**:
   - If `Agent.hermesAgentId` is null, create a default `HermesAgent` with:
     - `type`: derived from `Agent.type` mapping (`FUNCTIONAL` → `CUSTOM`, etc.)
     - `tenantId`: from `Agent.tenantId`
     - `isActive`: `Agent.isActive`
     - `model`: from `Agent.model`
     - `systemPrompt`: from `Agent.systemPrompt`
   - Update `Agent.hermesAgentId` with the new link

2. **Add background migration command (optional)**:
   - `npm run hermes:migrate` — one-time scan all `Agent` records with null `hermesAgentId` and create links
   - Run as part of deployment bootstrap or as a standalone script

3. **Ensure `HERMES_AUTO_LINK=true`** env var enables auto-link on first execution

**Prerequisites:** Phase 1 complete
**Schema changes:** None

---

### Phase 5 — Retirement of AgentStateMachine
**Goal:** Remove legacy `AgentStateMachine`, use only `OfficialAgentGraph`.

**Steps:**

1. **Audit all usages of `AgentStateMachine`**:
   - Find all files importing `AgentStateMachine`
   - Determine which are critical paths

2. **Update `AgentsModule`** providers:
   - Remove `AgentStateMachine` from providers
   - Ensure all deps are wired to `OfficialAgentGraph`

3. **Redirect any direct `AgentStateMachine` calls** to `OfficialAgentGraph`

4. **Remove `AgentStateMachine` class and related files** once no refs remain

**Prerequisites:** Phase 3 complete (Hermes node working)
**Schema changes:** None

---

## 4. Schema Changes (Minimal — Phase 1 Only If Needed)

The following models already exist in `schema.prisma` and will be used as-is:
- `HermesAgent`
- `HermesCapability`
- `HermesToolPermission`
- `HermesSession`
- `HermesMessage`
- `HermesMemoryEntry`
- `HermesAuditLog`
- `ApprovalWorkflow`
- `ApprovalWorkflowStep`

**No new Prisma models required** for Phases 1–5.

If Phase 5+ (domain subgraphs) requires new fields, those will be added then.

---

## 5. Feature Flags Summary

| Flag | Values | Default | Purpose |
|------|--------|---------|---------|
| `HERMES_ENABLED` | `true\|false` | `false` | Global kill switch — routes execution to Hermes runtime vs legacy |
| `HERMES_AUTO_LINK` | `true\|false` | `true` | Auto-create HermesAgent for agents without one |
| `HERMES_APPROVAL_REQUIRED` | `true\|false` | `false` | Enable minimal approval gate (future) |
| `HERMES_SESSION_LOGGING` | `true\|false` | `true` | Log all Hermes sessions to `HermesAuditLog` |

Flags are read from environment variables. In later phases, per-tenant overrides can be stored in `TenantConfig`.

---

## 6. Testing Strategy

### 6.1 Unit Tests
- `hermes-registry.service.spec.ts` — auto-link logic, capability lookup
- `tool-gateway.service.spec.ts` — permission enforcement
- `hermes-runtime.service.spec.ts` — execute flow, session creation
- `hermes-session.service.spec.ts` — message persistence

### 6.2 Integration Tests
- Agent with no `hermesAgentId` → auto-linked → executes successfully
- Agent with `hermesAgentId` → executes via Hermes runtime
- Tool denied by `ToolGatewayService` → throws, doesn't reach tool
- Session messages are persisted and retrievable

### 6.3 Migration Test
- With `HERMES_ENABLED=true`, existing agent execution continues working
- Toggle `HERMES_ENABLED=false` → legacy flow still works

---

## 7. Rollout Sequence

```
Week 1-2: Phase 1 — Hermes module skeleton + HermesRuntimeService + feature flag
Week 3:   Phase 2 — Session + Memory services
Week 4:   Phase 3 — LangGraph hermesNode integration
Week 5:   Phase 4 — Auto-link migration
Week 6:   Phase 5 — Retire AgentStateMachine
```

Each phase is independently deployable with `HERMES_ENABLED=false` as fallback.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ToolGatewayService` blocks too many tools, breaks agents | Medium | High | Start with permissive defaults (ALLOW all), add restrictions incrementally |
| `HERMES_ENABLED=false` path atrophies | Medium | Medium | Set `HERMES_ENABLED=true` as default after Phase 4, remove legacy path in v2 |
| `AgentStateMachine` has hidden deps | Low | High | Audit all imports before removal |
| `hermes-tools.ts` metadata is stale | Medium | Low | Refresh `HERMES_TOOL_SETS` during Phase 1 review |
| Auto-link creates orphaned `HermesAgent` records | Low | Low | Add unique constraint on `Agent.hermesAgentId` already exists |

---

## 9. Out of Scope (Future Phases)

- Domain-specific subgraphs (HR, Finance, Sales Hermes subgraphs)
- Full `ApprovalWorkflowEngine` — deferred
- Hermes-specific LLM model routing (per-Hermes-type model selection)
- Hermes admin UI in frontend-admin
- Vector embedding for `HermesMemoryEntry.embedding` field population
