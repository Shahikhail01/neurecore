# Chat & Agents

> How the unified chat surface works, and how agent + tool graphs compose. Last refreshed: 2026-07-31.

The chat layer is the platform's primary surface for human–AI interaction
in the tenant portal. It is grounded in real tenant data — the LLM is
called with a tenant-scoped tool graph and the result is persisted for
audit.

---

## 1. Architecture overview

```
Browser (tenant portal)
  │
  ├─ POST /api/v1/chat/messages       (non-streaming, one reply)
  ├─ POST /api/v1/chat/stream         (SSE streaming)
  ├─ GET  /api/v1/chat/history        (paginated)
  ├─ DEL  /api/v1/chat/history        (clear)
  └─ POST /api/v1/chat/suggestions    (slash commands stub)
                │
                ▼
NestJS ChatController  → ChatService           (orchestration)
                       → ChatSseService         (SSE)
                       → ChatHistoryService     (persistence)
                       → AIGatewayService       (provider selection)
                       → ToolsModule            (structured tools)
                       → ContextPlane           (ADR-002 — auth + scope)
                       → ApprovalPort           (ADR-006 — human gates)
                       → ScopedToolGateway      (permission + invocation)
                │
                ▼
OpenAI / OpenClaw / model provider(s)  →  reply tokens / tool calls
                │
                ▼
ChatMessage persisted  →  ChatSession (for the conversation)
```

---

## 2. Backend — `backend/src/modules/chat/`

### 2.1 Files
- `chat.controller.ts` — REST surface (5 endpoints above).
- `chat.service.ts` — orchestration. Holds the per-request
  ConversationId, history slice, and tool graph.
- `chat-sse.service.ts` — SSE writer.
- `chat-history.service.ts` + `.spec.ts` — DB-backed history.
- `chat.integration-spec.ts` — integration test.
- `dto/` — request DTOs (`SendChatMessageDto` etc.).
- `index.ts` — barrel.

### 2.2 Endpoint contract
Both `/chat/messages` and `/chat/stream` return the same ChatService
shape (`backend/src/modules/chat/chat.service.ts` `async send()` return
type, wrapped by `TransformResponseInterceptor` into
`{ data: <this>, error: null, meta: ... }`):
```ts
{
  reply: string;
  conversationId: string;
  tokens?: { input: number; output: number; total: number };
  model?: string;
  provider?: string;
  liveData?: Record<string, unknown>;          // side-effects
  autonomousExecution?: SidecarExecutionState; // autonomous agent state
}
```

### 2.3 Tenant grounding
The controller reads `tenantId` from the JWT (`req.user.tenantId`) and
forwards it to `ChatService`. The LLM is given the context plane slice
for that tenant (ADR-002), not raw DB access. The tool graph is also
scoped to that tenant.

### 2.4 CSRF exemption
`POST /api/v1/chat/messages`, `/chat/stream`, `/chat/history`,
`/chat/suggestions` are listed in
`backend/src/common/auth/csrf.middleware.ts:46-50` as exempt — same-origin
SPA only.

### 2.5 Conversation persistence
- `ChatSession` — one per conversation.
- `ChatMessage` — every user + assistant turn (with tool calls).
- History is tenant-scoped and serves the FE chat panel.

---

## 3. AI Gateway — `backend/src/modules/ai-gateway/`

### 3.1 Files
- `ai-gateway.module.ts` — Nest wiring.
- `ai-gateway.service.ts` — model selection + dispatch.
- `openclaw-gateway.service.ts` — OpenClaw-specific adapter.
- `langsmith-tracing.service.ts` — optional LangSmith tracing.
- `selection/` — strategy selection (cost vs. quality vs. latency).
- `failover/` — provider failover.
- `cost/` — per-tenant cost tracking.
- `transport/` — provider transports.
- `observability/` — gateway-level metrics.
- `domain/` — domain-specific overrides.
- `config/` — gateway config keys.
- `openclaw-gateway.tokens.ts` — DI tokens.
- `index.ts` — barrel.
- `README.md` — gateway overview.

### 3.2 Multi-provider support
Currently supported providers per `AiModel` / `ModelProvider`:
- **OpenAI** via `@langchain/openai`.
- **Anthropic / Others** via OpenClaw gateway (`openclaw-gateway.service.ts`).

The `selection/` folder picks the model given a tier + cost policy. The
`failover/` folder handles primary → fallback.

### 3.3 LangChain + LangGraph
- `@langchain/core@1.1` + `@langchain/langgraph@1.2` (`backend/package.json:70-71`).
- The chat flow uses LangChain messages and (for plan-style runs)
  LangGraph state machines.

---

## 4. Tools — `backend/src/modules/tools/`

### 4.1 Files
- `tools.module.ts` — registry + DI.
- `built-in/hermes-tools.ts` — per-agent-type descriptors (allow / read-only
  / approval-required / deny). Source of truth for which tools each
  Hermes agent can call. (`comms/hermes-tools.md` mirrors this in prose.)
- `built-in/neurecore-tools.ts` — NestJS-injectable tool providers
  (the actual `StructuredTool` implementations).

### 4.2 Tool descriptor
```ts
type ToolPermission = 'ALLOW' | 'READ_ONLY' | 'APPROVAL_REQUIRED' | 'DENY';

interface ToolDescriptor {
  name: string;
  description: string;        // LLM-facing
  permission: ToolPermission;
  schema: ZodSchema;           // input validation
  conditions?: {               // approval gating
    approvalType: string;
    thresholdUsd?: number;
    minApprovers?: number;
  };
}
```

### 4.3 ScopedToolGatewayService
Source: `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts`
(`backend/src/modules/hermes-adapter/tools/scoped-tool.schemas.ts` for
Zod input schemas).
Flow per tool call:
1. Resolve the calling `(tenantId, userId, agentId)` from the JWT.
2. Look up the descriptor; check the permission.
3. For `APPROVAL_REQUIRED`, emit an `Approval` and **wait**.
4. On `ALLOW`, execute the tool and write to `AIActionInvocation` +
   `HermesAuditLog`.
5. Return the result to the chat loop.

### 4.4 AI Tool categories (per HermesAgentType)
| Agent type | Allowed | Approval-required |
|---|---|---|
| HR | email, calendar, documents, tasks, query, reports | `terminate_employee`, `update_payroll` |
| FINANCE | email, query, reports, documents, sheets, calendar, `approve_expense` | `process_invoice`, `execute_payment`, `sync_erp` |
| SALES | email, calendar, documents, query, reports, `create_deal`, `update_contact`, `generate_quote` | `apply_discount` |
| MARKETING | email, documents, query, reports, sheets, calendar, `http_request` | `publish_content` |

(See `comms/hermes-tools.md` for the full list — LEGAL, OPS,
ENGINEERING, CUSTOMER_SUCCESS, etc.)

### 4.5 SoD for accounting tools
`backend/src/modules/accounting/tools/accounting-tools.providers.ts` —
`NpvTool`, `IrrTool`, `MirrTool`, `AmortizeLoanTool`. Each calls the
accounting sidecar via `HttpAccountingSidecarClient` and respects SoD.

---

## 5. Agents runtime — `backend/src/modules/agents/`

### 5.1 Files
- `agents.module.ts` — Nest wiring.
- `agents.controller.ts` — REST surface for `/api/v1/agents`.
- `agent-invocations.controller.ts` — invocation log REST surface.
- `deployment.controller.ts` — agent deployment lifecycle.
- `controllers/` — additional agent controllers.
- `services/` — orchestration services.
- `streaming/` — streaming handler (SSE for agent responses).
- `dto/` — request/response DTOs.
- `interfaces/` — TS contracts.
- `langgraph/` — LangGraph state machines for plans.
- `schemas/` — Zod schemas.
- `security/` — per-agent security checks.
- `utils/` — shared helpers.

### 5.2 Agent lifecycle
- **Register:** `Agent` row + `HermesAgent` row (scoped sidecar record).
- **Configure tools:** descriptor + Zod schema + permission.
- **Invoke:** scoped token issued for tenant + execution; sidecar runs
  the loop.
- **Cancel:** revoke scoped token at the gateway; sidecar aborts.
- **Audit:** every invocation → `HermesAuditLog`.

### 5.3 Legacy in-process runtime
`backend/src/modules/hermes/services/agent-messaging.service.ts` is the
**legacy** runtime. Per **ADR-0001**, it is disabled:
```ts
blocked: "Legacy in-process runtime responses are disabled by ADR-0001."
```
New integrations should extend `HermesAdapterModule` (the gateway) or
add a new tool to `modules/tools/`.

---

## 6. Frontend — `frontend-tenant/src/services/`

### 6.1 Chat client
- `agent-streaming.service.ts` — SSE consumer for `/chat/stream`.
- `auth.service.ts` (in `/auth`) — login → JWT cookie → chat calls ride
  the cookie.
- `chat-history` is fetched via `services/api.ts` (axios) or
  `authHttpClient.ts`.

### 6.2 Command palette + chat-issued commands
- `frontend-tenant/src/services/command-registry.ts` — registry of
  CommandPalette commands.
- `frontend-tenant/src/services/register-commands.ts` — registration
  glue, called once on app mount.
- `unwrap.ts` — response envelope unwrapper (`ApiResponse<T>` → `T`).
- `auth-redirect.service.ts` — handles session-expiry without redirect
  (FIX-020).

### 6.3 Adding a new slash-command / palette action
Edit `register-commands.ts` — never the `CommandPalette.tsx` component.
Example (`register-commands.ts:13-20`):
```ts
{
  id: 'nav:home',
  label: 'Go to Home',
  group: 'Navigate',
  shortcut: 'G H',
  action: () => router.push('/home'),
}
```

### 6.4 Chat-into-action (command graph binding)
Today, chat-into-action flows are routed via `command-registry.ts` and
individual service modules. For LLM-issued commands (e.g. "create a
project for ACME"), see NC-SIM04-005 in `pending-tasks.md`.

---

## 7. Observability

- **`ChatSession` + `ChatMessage`** — persisted history (DB).
- **`AIActionInvocation`** — every tool call (DB).
- **`HermesAuditLog`** — scoped sidecar audit (DB).
- **pino-http access logs** — per-request structured log
  (`backend/src/main.ts:53-83`).
- **LangSmith tracing** optional via
  `ai-gateway/langsmith-tracing.service.ts`.

---

## 8. Auth + CSRF in chat

Chat endpoints are **CSRF-exempt** (no cookie-based CSRF check):
- Same-origin SPA only.
- Cookie-based session auth still applies (`JwtAuthGuard`).

Auth failure in chat surfaces through `authService.reportAuthFailure`
which the chat UI handles as a non-blocking modal.

---

## 9. Common gotchas

- **`conversationId` ESLint warning** is silenced by **logging**
  (`chat.service.ts:731`) rather than removing the parameter — the
  conversation id is needed downstream. See `fixes.md`.
- **Tokens counted twice** when streaming + history persistence: the
  `tokens` field is the assistant-turn total; streaming partials are not
  double-counted.
- **Provider failover** is per-tenant; if a tenant has only one provider
  enabled, failover no-ops. Check `tenant_model_override`.
- **Tool call latency** is the dominant cost — tool calls block the chat
  loop. Wrapping tools with caching and avoiding serial chains matters
  more than model speed here.

---

## 10. How to add a new tool

1. Decide: `ALLOW` | `READ_ONLY` | `APPROVAL_REQUIRED` | `DENY`.
2. Add descriptor to `backend/src/modules/tools/built-in/hermes-tools.ts`.
3. Implement the tool (`StructuredTool`) in
   `built-in/neurecore-tools.ts` — inject Prisma, TenantContext, etc.
4. Register it in `tools.module.ts`.
5. If it's `APPROVAL_REQUIRED`, add an entry to the approval port.
6. Add a unit test + a tenant-isolation integration test.
7. Update `comms/hermes-tools.md` so the rest of the team sees it.

---

## 11. Source pointers

- `backend/src/modules/chat/`
- `backend/src/modules/ai-gateway/`
- `backend/src/modules/tools/`
- `backend/src/modules/agents/`
- `backend/src/modules/hermes/` (legacy) + `hermes-adapter/` (gateway)
- `frontend-tenant/src/services/command-registry.ts`
- `frontend-tenant/src/services/register-commands.ts`
- `frontend-tenant/src/services/agent-streaming.service.ts`
- `comms/hermes-tools.md`
- `memory-bank/architecture-decisions.md` (ADRs relevant: ADR-001, -002,
  -006, -0001)
- `memory-bank/auth.md` (chat CSRF exemption details)
- `memory-bank/hermes-tools.md`