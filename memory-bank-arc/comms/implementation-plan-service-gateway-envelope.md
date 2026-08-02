# NeureCore AI — Implementation Plan
## Strategy 1: Service Gateway + Response-Envelope System

**Version:** 1.0
**Date:** 2026-08-01
**Author:** Kilo
**Status:** DESIGN — Ready for implementation review

**Related docs:**
- `comms/queryTenantData-tool-design.md` — companion design / risk assessment
- `NeuroCore Architectural Constitution` — governing principles (Articles I–XXVII)
- `unified-chat-implementation.md` — current chat implementation status
- `plans/chat-unification-refactor-plan.md` — chat refactor (Phases A–F)
- `backend.md`, `frontend-tenant.md`, `fixes.md`

**Related code:**
- `frontend-tenant/src/shared/components/chat/UnifiedChatMessage.tsx` — inline renderers (MiniChart, MetricsRenderer, TableRenderer, MarkdownRenderer)
- `frontend-tenant/src/shared/components/chat/UnifiedChatPanel.tsx` — chat panel
- `frontend-tenant/src/core/services/chat/ChatService.ts` — frontend SSE client
- `frontend-tenant/src/core/services/chat/ChatStore.ts` — Zustand store
- `backend/src/modules/chat/chat.service.ts` — chat orchestrator
- `backend/src/modules/chat/chat-sse.service.ts` — SSE driver
- `backend/src/modules/agents/langgraph/langgraph-official.ts` — agent graph
- `backend/src/modules/tools/built-in/neurecore-tools.ts` — 106 tool implementations
- `backend/src/modules/tools/structured-tool.base.ts` — tool base class
- `backend/src/modules/tools/structured-tool.registry.ts` — tool registry
- `backend/src/modules/agents/security/providers/security-policy.provider.ts` — ai-assistant security policy
- `backend/src/modules/agents/security/security-interceptor.service.ts` — security interceptor

---

## 1. Executive Summary

NeureCore's HeadQuarter AI chat currently routes through a 106-tool hand-coded bridge
between the AI and the backend service layer. This creates two problems:

1. **Data-access gap** — the AI cannot reach every piece of tenant data. Most tools
   read raw Prisma delegates, bypassing the business-logic-tested service methods
   (ProjectsService, TasksService, etc.). The `Hermes-tools.md` (2026-07-28) tool
   audit reported 31 of 71 tested tools working, with the rest failing on routing
   confusion (LLM calling `getDepartment` → listing via `listDepartments`), fake-ID
   invocations, and refusal of tools the LLM didn't recognise.
2. **Response gap** — even when tools run, the reply is a generic "Successfully
   executed N tool(s)" line (`FIX-052` addressed the rendering; the **next** gap
   is that the AI never returns the structured payloads that trigger the existing
   inline renderers in `UnifiedChatMessage.tsx`).

### Target state

- **Strategy 1 (Service Gateway):** A single thin tool — `service.gateway` — that
  maps capability names to **existing, already-tested** backend service methods,
  injecting `tenantId` from the JWT context. Zero new Prisma access, zero new
  business logic. This is Creatio's "AI calls the platform's own service layer"
  pattern in one tool.

- **Response-Envelope System:** Tool results and final LLM replies are wrapped in a
  structured envelope (`{ type, text, components }`) that the frontend's existing
  `UnifiedChatMessage` renderers consume natively — chart data → `MiniChart`,
  tabular data → `TableRenderer`, etc. — without any new rendering code.

### Constitutional alignment (per NeuroCore Architectural Constitution)

| Article | Alignment |
|---------|-----------|
| II (Enterprise Before Features) | Service gateway exposes capabilities the enterprise already owns, not features-per-entity |
| VIII (Hermes as Organizational Interface) | Chat becomes one channel; service gateway is the data brain |
| XVI (Capability-Based Architecture) | One service gateway replaces 106 duplicated tool wrappers |
| XVIII (AI-Native UX) | Response envelope enables the interface to adapt rendering to the data |
| XXV (Simplicity Over Complexity) | 1 tool name instead of 106; 1 envelope format instead of ad-hoc text parsing |

---

## 2. SOLID Compliance Strategy

Every file in this plan follows the 5 SOLID principles. Concrete evidence per file:

### S — Single Responsibility

| File | One Job |
|------|---------|
| `backend/src/modules/chat/responses/services/service-gateway.tool.ts` | Map capability → service adapter, call it, return structured result |
| `backend/src/modules/chat/responses/builders/response-envelope.builder.ts` | Build typed response envelopes from tool results and LLM text |
| `frontend-tenant/src/core/services/chat/envelope/MessageEnvelopeParser.ts` | Parse a message content string into `{text, components}` |
| `frontend-tenant/src/core/services/chat/envelope/EnvelopeRenderer.tsx` | Map `EnvelopeComponent.type` to existing JSX renderers (no new rendering) |
| `frontend-tenant/src/core/services/chat/envelope/renderers/{chart,table,metrics}.tsx` | Extracted from `UnifiedChatMessage.tsx`; identical behaviour, importable |

### O — Open/Closed

- New envelope component types added by: new entry in the component-type map — **no edits to existing files**.
- New service capability added by: one entry in the `CAPABILITY_MAP` — **no edits to the gateway code**.
- New renderers (e.g. timeline, Gantt) added by: new conditional block in `EnvelopeRenderer` (identical OCP pattern to `UnifiedChatMessage`).

### L — Liskov Substitution

- Service gateway typed against `IServiceMethod` interface. Any NestJS service method matching `(tenantId, params) → Promise<Result>` is substitutable.
- Frontend envelope renderers typed against `IEnvelopeComponent`. Any component type (`chart | table | metrics | ...`) is substitutable.

### I — Interface Segregation

Five narrow interfaces:

- `IServiceMethod<TParams, TResult>` — `execute(tenantId, params)` → `TResult` (used by gateway)
- `IEnvelopeComponent` — `type`, `props` (used by renderer)
- `IResponseEnvelope` — `text?`, `components[]` (used by builder + parser)
- `IChatEnvelopeParser` — `parse(content)` → `IResponseEnvelope` (frontend)
- `IEnvelopeComponentRenderer` — `render(component)` → `JSX.Element` (frontend)

### D — Dependency Inversion

- `ServiceGatewayTool` depends on `IServiceMethod<T>[]` (abstraction), never on concrete `ProjectsService`.
- `OfficialAgentGraph.toolNode` depends on `IResponseEnvelopeBuilder` (abstraction), never on concrete builder.
- `UnifiedChatMessage` depends on `IChatEnvelopeParser` (abstraction), never on concrete parser.

---

## 3. Backend Architecture

### 3.1 New Module: `ChatResponseModule`

```
backend/src/modules/chat/
├── responses/                        # NEW directory
│   ├── interfaces/
│   │   ├── response-envelope.interface.ts      # IResponseEnvelope, IEnvelopeComponent
│   │   └── service-gateway.interface.ts        # IServiceMethod, IServiceGateway
│   ├── services/
│   │   └── service-gateway.tool.ts             # ServiceGatewayTool (BaseStructuredTool)
│   ├── builders/
│   │   └── response-envelope.builder.ts        # ResponseEnvelopeBuilder
│   └── maps/
│       └── capability-map.ts                   # CAPABILITY_MAP: capability → { service, method }
├── chat.service.ts                              # MODIFIED: wire service gateway
├── chat.module.ts                               # MODIFIED: import ChatResponseModule
├── chat.controller.ts                           # UNCHANGED
├── chat-sse.service.ts                          # UNCHANGED (yields structured deltas)
└── chat-history.service.ts                      # UNCHANGED
```

### 3.2 Service Gateway Tool (`service-gateway.tool.ts`)

**Design:** A single `BaseStructuredTool` that maps namespaced capabilities to
existing NestJS service methods. Replaces the 106-tool hand-coded bridge with
one DI-injected map.

**Why one tool, not many:** Per the Constitutional Principle of Capability-Based
Architecture (Article XVI), capabilities are reusable. The existing 106 tools
duplicate business logic that the services already encode. One gateway
de-duplicates by routing directly to the services.

```typescript
// capability-map.ts — The single source of truth. OCP: adding a new capability
// is a one-line entry; no code changes to the tool, graph, or chat.
//
// Each capability carries its own strict paramsSchema (the LLM sees only the
// fields it must provide) and an adapter that calls the service with the right
// positional/typed args. This is necessary because NestJS service methods have
// varied signatures — `findAll(tenantId, options)`, `create(tenantId, dto, user)`,
// `getSummary()` — so a single `(tenantId, paramsObject)` gateway signature
// would silently mis-route.
import { z } from 'zod';
import type { ModuleRef } from '@nestjs/core';

export interface ServiceCapability<P = unknown, R = unknown> {
  capability: string;
  serviceToken: string;
  paramsSchema: z.ZodType<P>;              // strict — no extra keys
  adapter: (service: unknown, tenantId: string, params: P) => Promise<R>;
  readOnly: boolean;
  description: string;                     // used in tool description for LLM
}

export const CAPABILITY_MAP: Record<string, ServiceCapability> = {
  listProjects: {
    capability: 'listProjects',
    serviceToken: 'ProjectsService',
    paramsSchema: z.object({
      includeRelations: z.boolean().optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'PLANNED']).optional(),
    }).strict(),
    adapter: (svc, tid, p) => (svc as ProjectsService).findAll(tid, p),
    readOnly: true,
    description: 'List projects in the tenant with optional filters',
  },
  getProject: {
    capability: 'getProject',
    serviceToken: 'ProjectsService',
    paramsSchema: z.object({ id: z.string().describe('Project ID') }).strict(),
    adapter: (svc, tid, p) => (svc as ProjectsService).findOne(tid, p.id),
    readOnly: true,
    description: 'Read a single project by ID',
  },
  listCustomers: {
    capability: 'listCustomers',
    serviceToken: 'CustomersService',
    paramsSchema: z.object({
      status: z.enum(['ACTIVE', 'DORMANT', 'PROSPECT']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).strict(),
    adapter: (svc, tid, p) => (svc as CustomersService).findAll(tid, p),
    readOnly: true,
    description: 'List customers in the tenant',
  },
  getDashboardSummary: {
    capability: 'getDashboardSummary',
    serviceToken: 'DashboardService',
    paramsSchema: z.object({}).strict(),
    adapter: (svc) => (svc as DashboardService).getSummary(),
    readOnly: true,
    description: 'Aggregate dashboard summary (counts by entity, costs, approvals)',
  },
  // ... progressively add all CRUD capabilities
};
```

```typescript
// service-gateway.tool.ts
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';

@Injectable()
export class ServiceGatewayTool extends BaseStructuredTool {
  readonly name = 'service.gateway';
  readonly category = ToolCategory.API;

  // inputSchema is minimal — capability name + opaque params that get
  // re-validated against cap.paramsSchema inside executeImpl. NOTE:
  // `.strict()` on the inputSchema is dead code because BaseStructuredTool
  // .coerceAndParse re-wraps with .passthrough() (structured-tool.base.ts:150).
  // We therefore add a SECONDARY key-whitelist check inside executeImpl
  // (see "strict key rejection" below).
  readonly inputSchema = z.object({
    capability: z.string().describe('Capability name from the platform service map'),
    params: z.record(z.unknown()).optional(),
  });

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly envelopeBuilder: ResponseEnvelopeBuilder,
  ) { super(); }

  // Tool description is computed at class-load time from CAPABILITY_MAP so the
  // LLM is told exactly what capabilities exist (per FIX-053 / Hermes-tools.md
  // "LLM refuses tool" root cause).
  readonly description = [
    'service.gateway: invoke any tenant-scoped backend capability.',
    'Returns JSON-data in a response envelope that the frontend renders as tables, charts, and metrics.',
    '',
    'Available capabilities:',
    ...Object.values(CAPABILITY_MAP).map(
      (c, i) => `  ${i + 1}. ${c.capability} (readOnly=${c.readOnly}) — ${c.description}`,
    ),
    '',
    'Format: { capability: "<name>", params: { ...per-capability fields... } }.',
  ].join('\n');

  protected async executeImpl(
    input: { capability: string; params?: Record<string, unknown> },
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };

    const cap = CAPABILITY_MAP[input.capability];
    if (!cap) return { success: false, error: `Unknown capability: ${input.capability}` };

    // STRICT KEY REJECTION (replaces dropped .strict()):
    // Only the keys declared in cap.paramsSchema are accepted. Anything else
    // returns a structured error, not a passthrough. This is the choke point
    // that mitigates "blast radius" identified in queryTenantData design.
    const rawParams = input.params ?? {};
    const allowedKeys = Object.keys(
      (cap.paramsSchema as z.ZodObject<z.ZodRawShape>).shape,
    );
    const unknownKeys = Object.keys(rawParams).filter((k) => !allowedKeys.includes(k));
    if (unknownKeys.length > 0) {
      return {
        success: false,
        error: `Unknown params for capability ${input.capability}: ${unknownKeys.join(', ')}. Allowed: ${allowedKeys.join(', ')}`,
      };
    }

    const parsedParams = cap.paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return { success: false, error: `Invalid params: ${parsedParams.error.message}` };
    }

    const service = this.moduleRef.get(cap.serviceToken, { strict: false });
    if (!service) {
      return { success: false, error: `Service ${cap.serviceToken} unavailable` };
    }

    try {
      const result = await cap.adapter(service, context.tenantId, parsedParams.data);
      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
```

**Why per-capability `adapter` instead of `service[cap.method]`:** NestJS
service methods have varied signatures (e.g. `findAll(tenantId, options)`,
`create(tenantId, dto, user)`, `getSummary()`). A naive
`service[cap.method](tenantId, paramsObject)` invocation passes one object
where the service expects a typed args list and either fails at runtime or,
worse, silently accepts positional-args overflow. The adapter function is
the only way to capture each service's exact call shape in TypeScript.

**Tenant-isolation enforcement:** `context.tenantId` comes from the graph's
`state.tenantId` ← `ChatService.stream({ tenantIdFromJwt })` ← JWT (verified
by `JwtAuthGuard`). The tool **never reads tenantId from the LLM input**.
The service method's `where` always includes `tenantId` because the existing
service methods are tenant-scoped (per the existing controller pattern).

**Four-layer access control still applies (and `service.gateway` must be added to each):**

| Layer | File | Change |
|-------|------|--------|
| Chat allowlist | `chat.service.ts` `resolveChatAllowedTools()` | Return `['service.gateway']` (feature-flagged) |
| Graph allowlist | `langgraph-official.ts` (already passes `allowedTools` to `toolNode`) | No change |
| Security policy | `security-policy.provider.ts` `ai-assistant.allowedTools` | Add `'service.gateway'` |
| **Hermes-type gate** | `backend/src/modules/tools/built-in/hermes-tools.ts` `HERMES_TOOL_SETS.CUSTOM` | **Required**: add `{ name: 'service.gateway', description: '...', permission: ALLOW }` (chat uses `agentId: 'ai-assistant'` → defaults to CUSTOM in `getHermesToolSet`). Without this, `ToolGatewayService.validate()` (tool-gateway.service.ts:14–55) returns `{ allowed: false }` for every call. |

### 3.3 Response-Envelope Builder (`response-envelope.builder.ts`)

**Design:** Wraps tool results and final LLM text in a typed envelope that the
frontend's existing inline renderers consume natively. The envelope is a plain
JSON object embedded in the assistant's message — no new SSE protocol, no new
wire format.

**Wire format (existing SSE `event: delta`):**
```json
{
  "text": "Here are your active projects:",
  "components": [
    {
      "type": "table",
      "headers": ["Name", "Status", "Priority"],
      "rows": [
        { "Name": "Q3 Tax Filing", "Status": "ACTIVE", "Priority": "HIGH" }
      ]
    },
    {
      "type": "metrics",
      "items": [
        { "label": "Active Projects", "value": 20 },
        { "label": "Overdue Tasks", "value": 5 }
      ]
    }
  ]
}
```

```typescript
// response-envelope.interface.ts
export interface IResponseEnvelope {
  text?: string;                          // conversational opener / summary
  components?: IEnvelopeComponent[];      // typed renderable payloads
}

export type EnvelopeComponentType = 'chart' | 'table' | 'metrics';

export interface IEnvelopeComponent {
  type: EnvelopeComponentType;
  props: Record<string, unknown>;
}

// response-envelope.builder.ts
@Injectable()
export class ResponseEnvelopeBuilder {
  /**
   * Build an envelope from a tool result. Infers the component type from
   * the result shape (array → table/list, object with chartData → chart,
   * object with metrics → metrics).
   */
  buildToolResponse(
    toolName: string,
    toolResult: StructuredToolResult,
  ): IResponseEnvelope {
    const data = toolResult.data;
    if (!data) return { text: `Executed ${toolName}` };

    const payload = (data as Record<string, unknown>)?.data ?? data;

    // Array → table
    if (Array.isArray(payload)) {
      return this.buildTable(payload);
    }

    // Named array key (e.g. { projects: [...], total })
    if (typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      const arrayKey = Object.keys(p).find((k) => Array.isArray(p[k]));
      if (arrayKey) {
        return this.buildTable(p[arrayKey] as unknown[], { total: p.total });
      }
    }

    // Scalar / summary → metrics
    if (typeof payload === 'object') {
      return this.buildMetrics(payload as Record<string, unknown>);
    }

    return { text: `Result: ${JSON.stringify(payload)}` };
  }

  /**
   * Merge LLM conversational text with the tool-response envelope.
   */
  merge(text: string, toolEnvelope?: IResponseEnvelope): IResponseEnvelope {
    return { text, components: toolEnvelope?.components };
  }

  /** Build a table component from an array of objects. */
  private buildTable(rows: unknown[], meta?: Record<string, unknown>): IResponseEnvelope {
    if (rows.length === 0) return { text: 'No results.' };
    const headers = Object.keys(rows[0] as object);
    return {
      text: meta?.total ? `(${meta.total} total)` : undefined,
      components: [{ type: 'table', props: { headers, rows } }],
    };
  }

  /** Build a metrics component from a key-value object. */
  private buildMetrics(data: Record<string, unknown>): IResponseEnvelope {
    const items = Object.entries(data)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([label, value]) => ({ label, value }));
    if (items.length === 0) return { text: JSON.stringify(data) };
    return {
      components: [{ type: 'metrics', props: { items } }],
    };
  }
}
```

### 3.4 Wire Format Decision (lock this in before coding)

The plan adopts **Option 1: envelope travels in the SSE delta's `data` field as a sibling to `text`**. This is the only path that:
- Streams the envelope to the frontend as soon as it materialises (not delayed
  until `event: done`).
- Keeps `message.content` semantically clean (just the conversational text).
- Avoids embedding JSON-as-string inside `text` (which would need a
  separate parser layer).

**`chat-sse.service.ts` change (small, explicit):**
```ts
// BEFORE
writeEvent('delta', { text: delta });

// AFTER
writeEvent('delta', {
  text: delta,
  ...(envelope ? { envelope } : {}),
});
```

The envelope is computed by `ResponseEnvelopeBuilder.buildToolResponse(...)`
in `toolNode` and passed through state. `chat-sse.service.ts` reads it from the
state arg of `streamDeltas()`.

**Streaming-vs-buffered acknowledgment:** The chat-service action-intent path
(`chat.service.ts:921–948`) does **not actually stream** — it calls
`agentGraph.run()` (non-streaming), buffers the result, then yields one
`delta` + `done` from the SSE service. So in practice the envelope materialises
**at `event: done`** for action intents. This still achieves the user-facing
goal (chart/table renders at the end of the response) but the per-delta
envelope-shipping is for correctness, not for live updates during streaming.

**Important:** the existing `chat-sse.service.ts` reads optional `envelope` from
`event: delta` without crashing if absent, so the new field is **strictly
additive** — old clients keep working.

### 3.5 Integration into OfficialAgentGraph.toolNode

**Change:** After `toolNode` executes a tool and builds the response message,
wrap it through `ResponseEnvelopeBuilder`. The envelope rides on the SSE delta.

```typescript
// langgraph-official.ts — toolNode (modified response section)
let responseMessage = '';
let envelope: IResponseEnvelope | undefined;
if (failCount === 0) {
  responseMessage = `Successfully executed ${successCount} tool(s): ${toolResults.map(r => r.toolName).join(', ')}`;
  if (successCount === 1) {
    // Single-tool execution: build a structured envelope from the result
    envelope = this.envelopeBuilder.buildToolResponse(toolResults[0]);
  }
} else {
  responseMessage = `Executed ${successCount} tool(s) successfully, ${failCount} failed.`;
}
state.envelope = envelope; // propagated to chat-sse.service
return { toolResults, messages: [...state.messages, {
  role: 'assistant',
  content: responseMessage,
  metadata: envelope ? { envelope } : undefined,
  timestamp: Date.now(),
}], finalChunk: responseMessage };
```

**Wire format on `event: delta`:**
```json
{
  "text": "Successfully executed 1 tool(s): listProjects",
  "envelope": {
    "text": "(20 total)",
    "components": [
      { "type": "table", "props": { "headers": ["name","status"], "rows": [...] } }
    ]
  }
}
```

The persistence layer (`saveReply` in `chat.service.ts`) stores
`metadata.envelope` alongside the message. On replay/regenerate the envelope
re-renders identically.

### 3.6 Chat Service Changes (`chat.service.ts`)

**Changes:** minimal. The action `detectIntent` path already routes to
`agentGraph.run()`. The service gateway tool replaces the per-entity tool
allowlists — **feature-flagged** so W1 doesn't regress write intents.

**`resolveChatAllowedTools()` — simplified, gated:**

```typescript
private resolveChatAllowedTools(message: string): string[] | null {
  // Feature flag: default false. When CHAT_USE_SERVICE_GATEWAY env is on
  // AND every read+write capability required for the intent is in the
  // map, return ['service.gateway']; otherwise keep the legacy allowlist.
  if (process.env.CHAT_USE_SERVICE_GATEWAY !== 'true') {
    return this.LegacyAllowlistFor(message);  // ~80 lines of per-intent regex
  }
  return ['service.gateway'];
}
```

**Why feature-flag:** W1 ships only **read** capabilities. If we flip
the simplification without the flag, every "create / update / delete" prompt
returns `Unknown capability` until W3. The flag isolates that risk.

**Query path (out of scope for v1):** The conversation path calls
`aiGateway.stream({capability:'conversation'})` with **zero tool access**.
Envelopes on the query path require a separate workstream (tool-calling
round-trip on the conversation LLM, or a per-prompt `agentGraph.run` for
queries). **Marked deferred:** v1 envelopes only work for action intents.

### 3.7 Hermes-Type Descriptor (REQUIRED, not optional)

The plan adds `service.gateway` to `HERMES_TOOL_SETS.CUSTOM` because chat uses
`agentId: 'ai-assistant'` (chat.service.ts:305) which defaults to CUSTOM in
`getHermesToolSet()` (hermes-tools.ts:309). Without this descriptor,
`ToolGatewayService.validate()` returns `{ allowed: false }` for every call
and the chat never executes the gateway.

```ts
// hermes-tools.ts (modify)
CUSTOM: [
  { name: 'email',     description: 'Email operations',                permission: ALLOW },
  { name: 'documents', description: 'Document operations',             permission: ALLOW },
  { name: 'query',     description: 'Query data',                       permission: READ_ONLY },
  { name: 'sheets',    description: 'Spreadsheet operations',           permission: ALLOW },
  { name: 'calendar',  description: 'Calendar operations',              permission: ALLOW },
  { name: 'service.gateway', description: 'Invoke any tenant-scoped backend capability', permission: ALLOW },
],
```

This is a **required** edit. The plan §5 "hermes-tools.ts" line is updated from
`+0..3 LOC optional` to `+1 LOC required`.

---

## 4. Frontend Architecture

### 4.1 New Files

```
frontend-tenant/src/core/services/chat/envelope/
├── interfaces/
│   └── IEnvelopeParser.ts                  # IChatEnvelopeParser
├── MessageEnvelopeParser.ts                # Parses envelope from message content
└── EnvelopeRenderer.tsx                    # Maps envelope components → JSX
```

### 4.2 MessageEnvelopeParser (`MessageEnvelopeParser.ts`)

**SRP:** Parses a message content string into `{ text, components }`. Extracts
brace-balanced JSON from the content using a NEW dedicated extractor, validates
against the envelope schema, and separates text from components.

**Critical note:** the plan does **not** reuse the existing
`BraceBalancedJsonExtractor` because that extractor is chart-only
(see `BraceBalancedJsonExtractor.ts:13` — returns null unless JSON contains
`"chartType"`). Mixing envelope payloads with the chart extractor would silently
fail every envelope that does not contain a chart key.

```typescript
// BraceBalancedEnvelopeExtractor.ts — NEW; co-located with the parser.
// Returns arbitrary brace-balanced JSON, not just chart payloads.
export interface IEnvelopeJsonExtractor {
  extract(text: string): { cleaned: string; json: unknown } | null;
}

export class BraceBalancedEnvelopeExtractor implements IEnvelopeJsonExtractor {
  extract(text: string): { cleaned: string; json: unknown } | null {
    const jsonStr = this._extractBalancedBlock(text);
    if (!jsonStr) return null;
    try {
      const json = JSON.parse(jsonStr);
      return { cleaned: text.replace(jsonStr, '').trim(), json };
    } catch {
      return null;
    }
  }
  // ... _extractBalancedBlock identical to BraceBalancedJsonExtractor
}

export type EnvelopeComponentType = 'chart' | 'table' | 'metrics';

export interface EnvelopeComponent {
  type: EnvelopeComponentType;
  props: Record<string, unknown>;
}

export interface Envelope {
  text?: string;
  components?: EnvelopeComponent[];
}

export class MessageEnvelopeParser {
  constructor(private readonly jsonExtractor: IEnvelopeJsonExtractor) {}

  parse(content: string): { text: string; envelope?: Envelope } {
    if (!content) return { text: '' };

    const extracted = this.jsonExtractor.extract(content);
    if (!extracted || typeof extracted.json !== 'object' || extracted.json === null) {
      return { text: content };
    }

    const candidate = extracted.json as Record<string, unknown>;

    // Validate "components" is an array of valid envelope components.
    const components = this.validateComponents(candidate.components);
    if (components === null) {
      // Brace-balanced JSON was found but not envelope-shaped; fall back to
      // treating the entire content as plain text. chart-bearing JSON is
      // still handled correctly by the legacy path: see fallback below.
      return { text: content };
    }

    const text =
      typeof candidate.text === 'string' ? candidate.text : extracted.cleaned || content;
    const envelope: Envelope = { components };
    if (typeof candidate.text === 'string') envelope.text = candidate.text;
    return { text, envelope };
  }

  private validateComponents(raw: unknown): EnvelopeComponent[] | null {
    if (!Array.isArray(raw)) return null;
    const validated: EnvelopeComponent[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') return null;
      const type = (item as Record<string, unknown>).type;
      const props = (item as Record<string, unknown>).props;
      if (
        type !== 'chart' &&
        type !== 'table' &&
        type !== 'metrics'
      ) return null;
      if (typeof props !== 'object' || props === null) return null;
      validated.push({ type, props: props as Record<string, unknown> });
    }
    return validated;
  }
}
```

### 4.3 EnvelopeRenderer (`EnvelopeRenderer.tsx`)

**SRP:** Maps `EnvelopeComponent.type` → JSX element. This is a thin layer that
delegates to renderers extracted from `UnifiedChatMessage.tsx`. **No new rendering code** — this is a routing layer. The type union deliberately matches
the validated types in `MessageEnvelopeParser` (no `suggestions`/`list` until implemented).

```typescript
import { MiniChart, MetricsRenderer, TableRenderer } from './renderers';
import type { EnvelopeComponent } from './MessageEnvelopeParser';

export function EnvelopeRenderer({ components }: { components: EnvelopeComponent[] }) {
  if (!components?.length) return null;
  return (
    <>
      {components.map((c, i) => {
        switch (c.type) {
          case 'chart':
            return <MiniChart key={i} data={c.props.chartData as Array<{ label: string; value: number }>} />;
          case 'table':
            return <TableRenderer key={i} headers={c.props.headers as string[]} rows={c.props.rows as Array<Record<string, unknown>>} />;
          case 'metrics':
            return <MetricsRenderer key={i} items={c.props.items as Array<{ label: string; value: string | number }>} />;
          default:
            return null; // unreachable per parser validation
        }
      })}
    </>
  );
}
```

### 4.4 Integration into `UnifiedChatMessage.tsx`

**Change:** Replace the existing inline chart/metrics/table blocks
(`UnifiedChatMessage.tsx:188–212`) with a single `EnvelopeRenderer` invocation.
The parser runs once per message via `useMemo` to avoid re-parsing on every
streaming delta.

```tsx
import { useMemo } from 'react';

interface UnifiedChatMessageProps {
  message: ChatMessage;
  onSuggestionSelect: (suggestion: SuggestionData) => void;
  sending: boolean;
  onApprovalDecision: (approval: AutonomousApprovalData, decision: 'approve' | 'reject') => Promise<AutonomousApprovalData | null>;
  envelopeParser: MessageEnvelopeParser;   // injected from useChat
}

export function UnifiedChatMessage({ message, onSuggestionSelect, sending, onApprovalDecision, envelopeParser }: UnifiedChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // useMemo: re-parse only when content changes, not on every render.
  // The parser is small (linear in JSON block size) but content can be 5KB+ during streaming.
  const parsedEnvelope = useMemo(
    () => (message.content ? envelopeParser.parse(message.content) : null),
    [message.content, envelopeParser],
  );

  // ... existing typing-indicator branch unchanged ...

  return (
    <motion.div ... className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="... bubble classes ...">
        {isAssistant && <div ...>✦ HeadQuarter AI</div>}

        {/* Markdown uses the conversational text (whether from envelope or plain text) */}
        {parsedEnvelope?.text && <MarkdownRenderer content={parsedEnvelope.text} />}

        {/* EnvelopeRenderer replaces the existing chart/metrics/table block (lines 188–203) */}
        {parsedEnvelope?.envelope?.components && (
          <EnvelopeRenderer components={parsedEnvelope.envelope.components} />
        )}

        {/* SuggestionRenderer remains (NOT envelope-driven yet) */}
        {message.metadata?.suggestions && (
          <SuggestionRenderer suggestions={...} ... />
        )}

        {/* autonomousApproval, token counter, timestamp unchanged */}
      </div>
    </motion.div>
  );
}
```

**Backward compatibility:** The existing `metadata.chart`, `metadata.metrics`,
`metadata.table` paths (`UnifiedChatMessage.tsx:188–203`) are **removed** because
they were never used in production (no incoming LLM ever produced them — only
chat history persisted without them). Verified via grep; removal is safe. The
envelope parser produces equivalent structures for any content that the old
metadata path would have rendered.

### 4.5 `useChat` Hook Changes

**Change:** Inject the **new** `IEnvelopeJsonExtractor` (not `IJsonExtractor`),
construct `MessageEnvelopeParser`. Propagate the parser to `UnifiedChatMessage`.

```typescript
// useChat.ts
const envelopeParser = useMemo(
  () => new MessageEnvelopeParser(new BraceBalancedEnvelopeExtractor()),
  [],
);
```

The new `BraceBalancedEnvelopeExtractor` is added alongside the existing
`BraceBalancedJsonExtractor`. The existing chart-only path is preserved (still
used by the legacy `useChat` flow if the envelope component is absent). No
chart-rendering code is removed in v1.

### 4.6 `UnifiedChatPanel.tsx` Changes

**Change:** Construct `MessageEnvelopeParser` (or accept one via props — same
DI pattern as `jsonExtractor`); pass to `UnifiedChatMessage`. 3–5 lines changed
(prop type + pass-through).

---

## 5. Files Touched (Summary)

### Created

| File | Purpose | SOLID | LOC |
|------|---------|-------|-----|
| `backend/src/modules/chat/responses/interfaces/response-envelope.interface.ts` | `IResponseEnvelope`, `EnvelopeComponentType`, `IEnvelopeComponent` | ISP | ~25 |
| `backend/src/modules/chat/responses/interfaces/service-gateway.interface.ts` | `IServiceGateway`, `IServiceCapability<P, R>` | ISP | ~15 |
| `backend/src/modules/chat/responses/maps/capability-map.ts` | `CAPABILITY_MAP` with per-capability `paramsSchema` + `adapter` | OCP | ~70 |
| `backend/src/modules/chat/responses/services/service-gateway.tool.ts` | `ServiceGatewayTool` (BaseStructuredTool) | SRP | ~110 |
| `backend/src/modules/chat/responses/builders/response-envelope.builder.ts` | `ResponseEnvelopeBuilder` | SRP | ~100 |
| `backend/src/modules/chat/responses/builders/response-envelope.builder.spec.ts` | Unit tests | — | ~60 |
| `backend/src/modules/chat/responses/services/service-gateway.tool.spec.ts` | Unit tests (capability lookup, strict param keys, adapter call) | — | ~80 |
| `backend/src/modules/chat/responses/maps/capability-map.spec.ts` | DI resolution + method existence | — | ~50 |
| `frontend-tenant/src/core/services/chat/envelope/interfaces/IEnvelopeParser.ts` | `IEnvelopeJsonExtractor`, `IEnvelopeParser` interfaces | ISP | ~15 |
| `frontend-tenant/src/core/services/chat/envelope/BraceBalancedEnvelopeExtractor.ts` | Brace-balanced JSON extraction (general; not chart-only) | SRP | ~70 |
| `frontend-tenant/src/core/services/chat/envelope/MessageEnvelopeParser.ts` | Envelope parser with type validation | SRP | ~80 |
| `frontend-tenant/src/core/services/chat/envelope/EnvelopeRenderer.tsx` | Component routing renderer | SRP | ~50 |
| `frontend-tenant/src/core/services/chat/envelope/renderers/{chart,table,metrics}.tsx` | Extracted from `UnifiedChatMessage.tsx` (verbatim bodies) | SRP | ~110 |
| `frontend-tenant/src/core/services/chat/envelope/MessageEnvelopeParser.test.ts` | Unit tests | — | ~50 |
| `frontend-tenant/src/core/services/chat/envelope/EnvelopeRenderer.test.tsx` | Unit tests | — | ~40 |

**Total created:** ~510 LOC (backend) + ~415 LOC (frontend) = **~925 LOC**

### Modified

| File | Change | LOC |
|------|--------|-----|
| `backend/src/modules/agents/langgraph/langgraph-official.ts` | Inject `ResponseEnvelopeBuilder`; toolNode produces envelope | +20 |
| `backend/src/modules/chat/chat.service.ts` | Feature-flagged `resolveChatAllowedTools()` | +5 / -80 |
| `backend/src/modules/chat/chat.module.ts` | Import new `ChatResponseModule` | +3 |
| `backend/src/modules/chat/chat-sse.service.ts` | Add `envelope` field to SSE delta's `data` shape | +3 |
| `backend/src/modules/agents/security/providers/security-policy.provider.ts` | Add `service.gateway` to `ai-assistant.allowedTools` | +1 |
| `backend/src/modules/tools/built-in/hermes-tools.ts` | **REQUIRED**: add `service.gateway` to `HERMES_TOOL_SETS.CUSTOM` | +1 |
| `frontend-tenant/src/shared/components/chat/UnifiedChatMessage.tsx` | Replace chart/metrics/table blocks with `EnvelopeRenderer`; useMemo | +12 / -18 |
| `frontend-tenant/src/shared/components/chat/UnifiedChatPanel.tsx` | Pass `envelopeParser` prop | +3 |
| `frontend-tenant/src/shared/hooks/useChat.ts` | Construct parser; pass to message | +3 |
| `frontend-tenant/src/core/services/chat/chat.factory.ts` | Wire `BraceBalancedEnvelopeExtractor` | +2 |
| `frontend-tenant/src/shared/types/chat.types.ts` | Add optional `envelope` to `ChatMessage.metadata` | +2 |

**Total modified:** ~55 LOC added / ~98 LOC removed (net **~−43 LOC**)

### Removed / Simpler

| What | Impact |
|------|--------|
| Per-entity tool whitelists in `resolveChatAllowedTools()` (~80 lines) | Replaced by one-line `return ['service.gateway']` (behind feature flag) |
| `renderToolOutput()` / `summarizeToolItem()` in `langgraph-official.ts` | Kept as fallback for multi-tool runs; primary path is envelope |
| `metadata.chart` / `metadata.metrics` / `metadata.table` blocks in `UnifiedChatMessage.tsx` | Removed; replaced by single `EnvelopeRenderer`. Verified unused at runtime. |
| 106 `neurecore-tools.ts` implementations | NOT removed—they remain for backward compatibility. Deprecated incrementally as capabilities move to the map. |

### Net LOC Change

| Area | Added | Removed | Net |
|------|-------|---------|-----|
| Backend | ~510 | ~98 | ~+412 |
| Frontend | ~205 | ~18 | ~+187 |
| **Total** | **~715** | **~116** | **~+599** |

---

## 6. Testing Strategy

### 6.1 Backend Unit Tests

| Test File | Scenarios |
|-----------|-----------|
| `response-envelope.builder.spec.ts` | Builds table from array payload; builds metrics from scalar object; handles null/empty/undefined data; merges text + tool envelope; multi-tool runs do not invoke envelope |
| `service-gateway.tool.spec.ts` | Resolves capability from map; rejects unknown capability with structured error; rejects params with unknown keys (inline whitelist); rejects params that fail `cap.paramsSchema.safeParse`; passes tenantId from context (never from input); returns adapter exception as structured error rather than throwing |
| `service-gateway.tool.spec.ts` (adapter) | Adapter is called with `(service, tenantId, params)` exactly once per invocation; mock service verifies positional/typed args |
| `service-gateway.tool.spec.ts` (description) | Tool `description` enumerates every entry in `CAPABILITY_MAP` (snapshot test) |
| `capability-map.spec.ts` | Every `serviceToken` resolves in NestJS DI (using `Test.createTestingModule`); reflective `typeof service[method] === 'function'` check |
| `BraceBalancedEnvelopeExtractor` (frontend, but TS-tested) | Extracts nested JSON; handles escaped quotes; returns null on unbalanced braces |

### 6.2 Backend Integration Tests

| Test | Verifies |
|------|----------|
| `service.gateway → listProjects` | Calls `ProjectsService.findAll(context.tenantId)`; returns project array; `ResponseEnvelopeBuilder.buildToolResponse()` wraps as `{ type:'table', props:{ headers, rows } }` |
| `service.gateway → getDashboardSummary` | Calls `DashboardService.getSummary()`; returns scalar object; wrapped as `{ type:'metrics', props:{ items } }` |
| Cross-tenant rejection | JWT payload contains `tenantId='tnt-1'`; test seeds rows in two tenants; tool returns only `tnt-1` rows. **JWT-level faking:** use `supertest` with a forged token; sign with `process.env.JWT_SECRET` (production value). Returns no rows from `tnt-2`. |
| `officialAgentGraph.run()` with `service.gateway` | ToolNode produces assistant message with `metadata.envelope` present and matching snapshot |
| `chat/stream` with action intent | SSE delta payload shape: `{ text, envelope? }`. Frontend `ChatService.sendMessageStream` consumes the new envelope field. |

#### Cross-tenant test fixture pattern (e2e)

```ts
// helpers/jwt-test.util.ts
export function forgeJwt(payload: { sub: string; tenantId: string; pwd?: number }) {
  return jwt.sign(
    { ...payload, jti: `test-${crypto.randomUUID()}`, pwd: payload.pwd ?? Math.floor(Date.now()/1000) },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' },
  );
}

// helpers/two-tenant-fixture.util.ts
export async function seedTwoTenants() {
  const a = await seedTenant('tnt-a');
  const b = await seedTenant('tnt-b');
  await seedProjects(a, 3); await seedProjects(b, 7);
  return { a, b };
}
```

### 6.3 Frontend Unit Tests

| Test | Verifies |
|------|----------|
| `BraceBalancedEnvelopeExtractor` | Parses brace-balanced JSON envelope; separates text from components; handles missing envelope; handles invalid JSON; returns null on unbalanced braces (no throw) |
| `MessageEnvelopeParser` | Returns `{ text, envelope? }`; rejects envelope with non-string `text` (validation guards `as string` cast); rejects components with unknown type (tightens union); falls back to plain text when JSON is balanced but not envelope-shaped |
| `EnvelopeRenderer` | Renders table component; renders metrics component; renders chart component; returns null for empty array; passes through key prop |

### 6.4 Pre-deployment Verification

```bash
# Pre-step (W0): resolve source/dist drift, produce clean dist
ssh contabo bash -lc '
  cd /opt/neurecore/backend/backend
  pnpm install --frozen-lockfile  # if any new deps
  npx tsc --noEmit               # verify source compiles
  pnpm build                     # produce dist
  diff <(git show HEAD:backend/dist/src/modules/ai-gateway/transport/http-llm.transport.js) dist/.../http-llm.transport.js | head
  # Should be empty if hotpatch from FIX-051 is now in source
'

# Backend
cd backend
npx tsc --noEmit                                        # TypeScript: 0 errors
pnpm jest --testPathPatterns="responses|service-gateway|chat-streams"  # Unit + integration

# Frontend
cd frontend-tenant
npx tsc --noEmit                                        # TypeScript: 0 errors
pnpm vitest run -- --testPathPatterns="envelope"          # Unit
pnpm build                                              # Next.js build

# Re-run certification (G8 / G9 isolation gates must remain green)
pnpm certify:phase9

# Production smoke
curl -sk -X POST https://brain.neurecore.com/api/v1/chat/stream \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"message":"list the active projects","conversationId":"conv-smoke"}' \
  --max-time 60 | head -8
# Expect:
#   event: delta
#   data: {"text":"Successfully executed 1 tool(s): service.gateway", "envelope":{"components":[{"type":"table",...}]}}
```

---

## 7. Rollout Sequence

**Week 0 — Prerequisite: resolve source/dist drift**

Prerequisite to EVERYTHING in this plan. Without a clean `nest build`, every
change in this plan ships as another dist hot-patch — the same pattern that
caused FIX-051/052 (stale dist on Contabo predates source). Steps:

1. Resolve `api/handler.ts` import error reported in prior session (refactor
   imports to canonical paths).
2. Resolve local Prisma schema drift errors (likely enum-only changes that
   don't affect Contabo DB).
3. Run `nest build` in `backend/`. Verify all three FIX-051/052 hot-patches
   are now in source.
4. Confirm: `git diff HEAD -- dist/` is empty after `nest build`.
5. Deploy cleanly via `pm2 restart --update-env`; PM2 log shows no TS errors
   at boot.

**Gate:** proceed to W1 ONLY when clean `nest build` succeeds locally and on
Contabo after deploy.

---

**Week 1 — Backend Service Gateway (read-only, behind feature flag)**

1. Create `ChatResponseModule` with interfaces, capability-map, service-gateway tool.
2. Write unit + integration tests.
3. Wire into `agents.module.ts` (OfficialAgentGraph receives builder).
4. Add `service.gateway` to `HERMES_TOOL_SETS.CUSTOM` (REQUIRED, hermes-tools.ts).
5. Add `service.gateway` to `SecurityPolicyProvider.ai-assistant.allowedTools`.
6. **Keep `resolveChatAllowedTools()` unchanged by default**; add a feature-flag
   branch (`process.env.CHAT_USE_SERVICE_GATEWAY === 'true'`) that returns
   `['service.gateway']`. Default behaviour remains the per-intent allowlist so
   write-intent users do not regress.
7. Register `MessageEnvelopeBuilder`; toolNode produces envelope on
   single-tool success (gated by feature flag).
8. Extend `chat-sse.service.ts` to include `envelope` in the `data` payload
   (additive — backward compatible).
9. **Hold enable flag off in production.** Validate W1 via curl + e2e probe
   (forge JWT, hit `/api/v1/chat/stream`, assert envelope present in delta).

**Week 2 — Frontend Envelope System (read-only path, behind feature flag)**

1. Create `BraceBalancedEnvelopeExtractor` (general; not chart-only), `MessageEnvelopeParser`,
   `EnvelopeRenderer`.
2. Extract `MiniChart`, `MetricsRenderer`, `TableRenderer` from
   `UnifiedChatMessage.tsx` to `frontend-tenant/src/core/services/chat/envelope/renderers/`.
3. Replace `UnifiedChatMessage.tsx:188–203` inline blocks with `EnvelopeRenderer`
   (useMemo for parser).
4. Wire through `UnifiedChatPanel.tsx` and `useChat.ts`.
5. Run frontend test suite + `pnpm build`.
6. **Hold frontend feature flag off** until W1 is verified in production
   backend; then enable both flags together for one tenant.

**Week 3 — Capability Expansion + First Tenant Enable**

1. Audit existing service methods for the read half of all 106 tools
   (projects, tasks, customers, agents, goals, workflows, budgets, departments,
   approvals, dashboards).
2. Add `CAPABILITY_MAP` entries for each method (one per line, per the
   `ServiceCapability` schema with `paramsSchema` + `adapter`).
3. Per-feature enable `CHAT_USE_SERVICE_GATEWAY=true` for ONE tenant in prod.
4. Monitor error rates; expect `Unknown capability` errors → map gaps; add
   missing entries; repeat.
5. Verify G8 / G9 isolation gates remain green with the flag on.
6. Roll to remaining tenants once stable.

**Week 4 — Write Capabilities + Cleanup**

1. Add write capabilities (`createProject`, `updateTask`, etc.) to `CAPABILITY_MAP`.
   These route to services that already enforce approvals + write-side guards.
2. Enable write traffic for one tenant; monitor.
3. Profile service-gateway latency per capability; document baseline.
4. Add per-tool-level LRU cache for high-frequency read capabilities
   (TTL 30s — same pattern as `tenantSnapshotCache` in chat.service.ts).
5. Remove dead tool-registry entries that have been fully migrated to the gateway.
   Maintain a `MIGRATED.md` log mapping old tool names → capabilities.
6. Final production smoke test.

**Week 5+ — Deferred (NOT in v1)**

- Query-path envelopes (requires tool-calling round-trip on the conversation
  LLM, or per-prompt `agentGraph.run` for queries).
- Frontend `suggestions` / `list` component types.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 106 tools still exist alongside service gateway → duplicates | Medium | Low | Keep tools for backward compat; gate on capability-map first. Deprecate old tools incrementally per the refactor plan pattern (Phase D of chat-unification removed dead code after verification). |
| `moduleRef.get()` fails at runtime for a service token | Low | High | Integration test per capability. Fail-closed in gateway: return structured error `{success:false, error:'Service ... unavailable'}`, never throw. |
| Adapter's service method has wrong shape or missing method | Medium | High | Per-capability `adapter: (service, tenantId, params) => ...` instead of `service[cap.method]`; runtime guard `typeof === 'function'`; tests pin each adapter's call signature. |
| LLM picks wrong capability because description lacks options | Medium | High | Tool `description` enumerates capabilities inline (`Object.values(CAPABILITY_MAP)`); snapshot test asserts inclusion. Fixes the "LLM refuses tool" root cause from `Hermes-tools.md`. |
| `service.gateway` rejected by `ToolGatewayService` (Hermes-type gate) | Certain if skipped | High | **Required:** add `{name:'service.gateway', description:'...', permission:ALLOW}` to `HERMES_TOOL_SETS.CUSTOM`. Without it, the chat silently never executes. |
| `inputSchema.strict()` is silently dropped by `BaseStructuredTool.coerceAndParse` (FIX-053 hazard) | Certain | Medium | Inline whitelist check inside `executeImpl` against `cap.paramsSchema.shape`; unit test asserts rejection of unknown keys. |
| Envelope parsing on chat text with arbitrary `{...}` braces | Medium | Low | `MessageEnvelopeParser.parse()` validates `components` shape and returns plain-text fallback for non-envelope JSON. Does not crash. |
| Frontend re-parses envelope on every streaming delta | Medium | Low | `useMemo` keyed on `[message.content, envelopeParser]` (per §4.4). |
| W1 capability-map only ships READS; write-intent users see `Unknown capability` | Certain | Medium | Feature flag (`CHAT_USE_SERVICE_GATEWAY`) controls the `resolveChatAllowedTools` simplification. Default off in W1; only enable per-tenant in W3 once write capabilities land. |
| Source/dist drift reintroduces bugs (FIX-051/052 pattern) | Certain | High | W0 prerequisite: clean `nest build` BEFORE any change. Verify `git diff HEAD -- dist/` is empty after rebuild. Cited as a Done Definition item. |
| `interface IJsonExtractor` is called by name in MessageEnvelopeParser but is chart-only | Certain | High | Use **new** `IEnvelopeJsonExtractor` (general) implemented by `BraceBalancedEnvelopeExtractor`. Existing chart-only `IJsonExtractor` left untouched. Cross-tested in unit suite. |
| Query intents cannot use envelopes (LLM has no tool access in conversation path) | Certain | High | **Marked deferred:** envelopes only work for action intents in v1. Conversation-path envelopes are an explicit future workstream. |
| Real-world typos in `params` keys leak into the service adapter | Medium | High | Inline `unknownKeys` whitelist check rejects them BEFORE calling adapter. Unit test: `{capability:'listProjects', params:{includeRelatons:true}}` → `{success:false, error:'Unknown params: includeRelatons. Allowed: includeRelations, status'}`. |
| `useState`/`useEffect` in UnifiedChatMessage re-renders parser on every keystroke | Low | Low | Spec mandates `useMemo` (per §4.4 review fix). |
| Type assertions (`as string`) in envelope parser corrupt `[object Object]` text | Low | Low | Type-guard before casting (per §4.2 review fix). |

---

## 9. Done Definition

### v1 (Action-Intent Envelope + Service Gateway)

- [ ] **W0:** `nest build` produces a clean dist with no source/diff mismatch
      on Contabo (`git diff HEAD -- dist/` empty). `pm2 restart` boots
      without TS errors.
- [ ] `service.gateway` is registered; `toolNode` executes it for the right
      capability names; `ToolGatewayService` permits it (`HERMES_TOOL_SETS.CUSTOM`
      updated as required).
- [ ] Every service method in `CAPABILITY_MAP` has an integration test
      proving tenant-scoped data and adapter correctness.
- [ ] `ResponseEnvelopeBuilder` produces correctly typed envelopes
      (`table` and `metrics`) for tool results.
- [ ] `chat-sse.service.ts` emits `data: { text, envelope? }` — backward
      compatible (envelope omitted when absent).
- [ ] Frontend `BraceBalancedEnvelopeExtractor` (NEW) and `MessageEnvelopeParser`
      extract chart / table / metrics components.
- [ ] Frontend `EnvelopeRenderer` renders the components identically to the
      prior inline behaviour.
- [ ] Inline key-whitelist check inside `ServiceGatewayTool.executeImpl`
      rejects unknown `params` keys (replaces dropped `.strict()`).
- [ ] Per-capability `adapter` function call signature verified by tests
      (no `service[method]` dynamic-call risk).
- [ ] `CHAT_USE_SERVICE_GATEWAY` feature flag controls enablement; default off.
- [ ] All backend unit + integration tests pass (new + existing).
- [ ] All frontend unit tests + `pnpm build` pass.
- [ ] **`pnpm certify:phase9`** — all 105 scenarios PASS with `service.gateway`
      enabled in the test config.
- [ ] Phase 8 tenant-isolation negative suite passes for service gateway
      (cross-tenant rejection via forged JWT).
- [ ] Production smoke test (forged JWT, `CHAT_USE_SERVICE_GATEWAY=true`):
      - `list the active projects` → SSE delta carries table component.
      - `show the dashboard summary` → SSE delta carries metrics component.
- [ ] Zero `console.log` / `debugger` in changed files.
- [ ] Zero new `any` types in changed files (use `unknown` + type guards).
- [ ] `pm2 save` on Contabo.

### Out of scope (deferred; documented for future workstream)

- Query-path envelopes (requires tool-calling round-trip on conversation LLM).
- `suggestions` / `list` component types.
- Auto-coercion of numeric strings from LLM outputs.

---

*Prepared against `memory-bank-arc` (2026-08-01). Reviewed v1 against source code; 17 issues addressed. W0 (resolve source/dist drift) is the gating prerequisite.*
