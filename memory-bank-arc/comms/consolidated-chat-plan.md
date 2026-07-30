# Consolidated Chat Widget — Refactor & Implementation Plan

**Date:** 2026-07-06
**Status:** Phases 0–3 IMPLEMENTED ✅ — Phases 4–6 PENDING
**Implementation doc:** `unified-chat-implementation.md`
**Scope:** Both frontends (`frontend-tenant`, `frontend-admin`) + backend (minimal)
**Principle:** 100% SOLID — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion

> **⚠️ Audit Notes (2026-07-06):** Plan audited against live codebase; 15 issues found and corrected. See [Section 8: Audit Corrections](#8-audit-corrections-2026-07-06).
> **✅ Implementation (2026-07-06 17:15 PKT):** Phases 0–3 complete — 16 new files, 1 modified (TenantShell.tsx), 0 deletions. TypeScript: 0 errors. Old chat panels remain functional alongside new unified panel.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [SOLID Compliance Map](#3-solid-compliance-map)
4. [Implementation Phases](#4-implementation-phases)
   - [Phase 0: Shared Type System](#phase-0-shared-type-system)
   - [Phase 1: Service Layer (DIP + ISP)](#phase-1-service-layer-dip--isp)
   - [Phase 2: Consolidated UI Component](#phase-2-consolidated-ui-component)
   - [Phase 3: Agent Execution Integration](#phase-3-agent-execution-integration)
   - [Phase 4: Frontend-Admin Adoption](#phase-4-frontend-admin-adoption)
   - [Phase 5: Backend Optimizations](#phase-5-backend-optimizations)
   - [Phase 6: Testing & Verification](#phase-6-testing--verification)
5. [Backward Compatibility & Migration](#5-backward-compatibility--migration)
6. [Risk Matrix](#6-risk-matrix)

---

## 1. Current State Analysis

### 1.1 Three Independent Chat Systems

| System | Frontend | Files | Endpoint | Pattern |
|---|---|---|---|---|
| ConversationPanel ("Ask NeureCore") | Tenant | `components/chat/` + `services/chat.service.ts` + `stores/chatStore.ts` + `hooks/useChat.ts` | `POST /api/v1/chat/messages` | Legacy flat |
| AIChatPanel ("HeadQuarter AI") | Tenant | `features/ai-chat/` + `core/services/ConversationalAIService.ts` + `shared/hooks/useAIChat.ts` | `POST /api/v1/ai/chat` | Clean Architecture (DIP) |
| ConversationPanel ("Ask NeureCore") | Admin | `components/chat/` + `services/chat.service.ts` + `stores/chatStore.ts` + `hooks/useChat.ts` | `POST /api/v1/chat/messages` | Legacy flat |

### 1.2 Features Breakdown — Merge Target

| Feature | Source | Target |
|---|---|---|
| Slash commands (5 commands + suggestions) | Tenant ConversationPanel | ✅ Unified |
| Markdown rendering (bold, italic, code) | Tenant ConversationPanel | ✅ Unified |
| Inline metrics badges | Tenant ConversationPanel | ✅ Unified |
| Inline HTML tables | Tenant ConversationPanel | ✅ Unified |
| Token counter | Tenant ConversationPanel | ✅ Unified |
| Ctrl+Enter send, Escape clear | Tenant ConversationPanel | ✅ Unified |
| Auto-resize textarea | Tenant ConversationPanel | ✅ Unified |
| Global mount in shell | Both ConversationPanels | ✅ Unified |
| localStorage persistence | Tenant ConversationPanel | ✅ Unified |
| Starter prompts (5) | Tenant AIChatPanel | ✅ Unified |
| HomeHero chips (4) | Tenant AIChatPanel | ✅ Unified |
| MiniChart (bar chart rendering) | Tenant AIChatPanel | ✅ Unified |
| Typing indicator (bouncing dots) | Tenant AIChatPanel | ✅ Unified |
| Follow-up suggestion chips | Tenant AIChatPanel | ✅ Unified |
| Error banner | Tenant AIChatPanel | ✅ Unified |
| Timestamps (HH:MM) | Tenant AIChatPanel | ✅ Unified |
| Avatar labels ("✦ HeadQuarter AI") | Tenant AIChatPanel | ✅ Unified |
| Mobile backdrop overlay | Tenant AIChatPanel | ✅ Unified |
| Double-submit guard | Tenant AIChatPanel | ✅ Unified |
| System prompt injection | Tenant AIChatPanel | ✅ Unified |
| Agent state enrichment | Tenant AIChatPanel | ✅ Unified |
| History to backend (last 10) | Tenant AIChatPanel | ✅ Unified |
| sessionStorage persistence | Tenant AIChatPanel | ✅ Unified |
| Brace-balanced JSON extraction | Tenant AIChatPanel | ✅ Unified |
| Rule-based fallback intents (5) | Tenant AIChatPanel | ✅ Unified |
| Action suggestion card | Tenant ConversationPanel | ⚠️ Replace with chips |
| Admin-specific slash commands | Admin ConversationPanel | ✅ Tenant/Admin variants |
| Live suggestions API | Both ConversationPanels | ✅ Unified |

### 1.3 Backend Capabilities Available

The backend already supports everything needed:

- `POST /api/v1/chat/messages` — main chat endpoint (intent detection → MiniMax query OR OfficialAgentGraph action)
- `POST /api/v1/ai/chat` — alias for same handler (can be deprecated)
- `OfficialAgentGraph` with 75+ tools (CRUD agents, tasks, workflows, approvals, projects, departments, billing, etc.)
- `AgentExecutorService` with Hermes orchestration
- Streaming endpoints (`/agents/streaming/`)
- `SendChatMessageDto` accepts: `message`, `conversationId`, `systemPrompt`, `temperature`, `maxTokens`, `history`, `context`

### 1.4 Key Gaps Found

| # | Gap | Impact | Plan |
|---|---|---|---|
| G1 | ConversationPanel chart types defined but no rendering code | Dead type code | Remove chart types; AIChatPanel MiniChart is the target |
| G2 | Action suggestion event has no listener | Dead event dispatch | Remove `chat:execute-suggestion` event; use follow-up chips instead |
| G3 | ConversationPanel service doesn't parse `data`/`suggestion` from backend | Dead paths in response handling | Unified service will parse all fields |
| G4 | AIChatPanel chart types `line`/`pie` defined but only `bar` renders | Misleading type definitions | Restrict to `bar` only until rendering is implemented |
| G5 | AIChatPanel `isStreaming`/`sourceSummary` metadata unused | Dead code in types | Remove or wire to streaming implementation |
| G6 | AIChatPanel `pageContext` prop never passed | Dead code path | Wire in shell mount points |
| G7 | HomeHero chips and AIChatPanel starter prompts are independent lists | Duplicate prompt surface | Merge into unified prompt registry |

---

## 2. Target Architecture

### 2.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                       UnifiedChatPanel                               │
│  (mounted in TenantShell + AdminShell — every authenticated page)    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌──────────────────────────────────────────────┐  │
│  │ useChat()   │  │  InlineComponents                            │  │
│  │ (hook)      │  │  ├── MarkdownRenderer                        │  │
│  │             │  │  ├── MiniChart (bar)                         │  │
│  │ State:      │  │  ├── MetricsBadges                          │  │
│  │  messages   │  │  ├── InlineTable                            │  │
│  │  sending    │  │  ├── SuggestionChips                        │  │
│  │  error      │  │  ├── TypingIndicator                         │  │
│  │  open       │  │  └── TokenCounter                           │  │
│  │  suggestions│  │                                              │  │
│  └──────┬──────┘  └──────────────────────────────────────────────┘  │
│         │                                                           │
│         │ depends on                                                │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ IChatService (interface)                                     │  │
│  │ ├── sendMessage(message, options?): Promise<ChatResponse>   │  │
│  │ ├── getHistory(limit?): Promise<ChatMessage[]>               │  │
│  │ ├── clearHistory(): Promise<void>                            │  │
│  │ ├── getSuggestions(query: string): Promise<string[]>         │  │
│  │ └── isAvailable(): boolean                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         ▲                                                           │
│         │ implements                                                │
│  ┌──────┴──────────────────────────────────────────────────────┐  │
│  │ ChatService (concrete)                                       │  │
│  │ ├── Uses restClient (IApiClient)                             │  │
│  │ ├── Parses all response fields: reply, tokens, data,        │  │
│  │ │   suggestions, conversationId, chartData, chartType       │  │
│  │ ├── Fallback: keyword-based rule matching (from AIChatPanel) │  │
│  │ ├── JSON extraction: brace-balanced parser (from AIChatPanel)│  │
│  │ └── System prompt injection (from AIChatPanel)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│         ▲                                                           │
│         │ extends (context-specific)                                │
│  ┌──────┴──────────────────────┐  ┌──────────────────────────────┐ │
│  │ TenantChatService           │  │ AdminChatService              │ │
│  │ ├── Slash: /agents, /tasks, │  │ ├── Slash: /agents, /tenants,│ │
│  │ │   /costs, /workflows,     │  │ │   /billing, /system        │ │
│  │ │   /approvals              │  │ └── Prompt registry: admin   │ │
│  │ └── Prompt registry: tenant │  │                              │ │
│  └─────────────────────────────┘  └──────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ AgentExecutionBridge                                         │  │
│  │ (chat → agent task execution)                                │  │
│  │                                                              │  │
│  │ When user message matches action intent:                      │  │
│  │ 1. ChatService.send() → backend detects "action" intent      │  │
│  │ 2. Backend routes to OfficialAgentGraph with 75+ tools       │  │
│  │ 3. Response includes execution result + suggestion chips      │  │
│  │                                                              │  │
│  │ Client-side:                                                  │  │
│  │ - Suggestion chips rendered as actionable pill buttons        │  │
│  │ - Confirmation dialogs for destructive actions                │  │
│  │ - Progress indicator for long-running executions              │  │
│  │ - Streaming event listener (future: SSE)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure — Target

```
frontend-tenant/src/
├── core/
│   └── services/
│       ├── interfaces/
│       │   └── IChatService.ts              ← UNIFIED interface (ISP): IChatService, ISlashCommandProvider, IFallbackReply, IJsonExtractor, ISystemPromptBuilder
│       ├── chat/
│       │   ├── ChatService.ts               ← UNIFIED: implements IChatService
│       │   ├── ChatStore.ts                 ← NEW: createChatStore() factory (React Zustand)
│       │   ├── chat.factory.ts              ← DI wiring: service + store + slash singleton
│       │   ├── slash-commands/
│       │   │   ├── TenantSlashCommands.ts
│       │   │   └── AdminSlashCommands.ts
│       │   └── fallback/
│       │       ├── KeywordFallbackReply.ts  ← extracted from ConversationalAIService._fallbackReply
│       │       └── BraceBalancedJsonExtractor.ts ← extracted from ConversationalAIService._extractFirstJsonObject
│
├── shared/
│   └── components/
│       └── chat/
│           ├── UnifiedChatPanel.tsx          ← THE ONE COMPONENT
│           ├── UnifiedChatMessage.tsx        ← Message bubble + all inline renderers
│           ├── UnifiedChatHeader.tsx         ← Header + clear/close
│           ├── UnifiedChatInput.tsx          ← Input + slash commands + suggestions
│           ├── UnifiedChatEmptyState.tsx     ← Starter prompts + HomeHero chips
│           └── TriggerButton.tsx            ← Floating 💬 or "✦ Ask AI"
│
├── shared/
│   └── hooks/
│       └── useChat.ts                       ← UNIFIED hook (replaces useChat + useAIChat)
│
├── shared/
│   └── types/
│       └── chat.types.ts                    ← UNIFIED types (single source of truth)
│
├── features/ai-chat/                        ← DELETED after migration
└── components/chat/                         ← DELETED after migration
```

For frontend-admin, same structure mirrored under (**note: admin has NO existing `core/` or `shared/` directories — these must be created from scratch**):
```
frontend-admin/src/
├── core/
│   └── services/
│       ├── interfaces/
│       │   └── IChatService.ts              ← same interface as tenant
│       ├── chat/
│       │   ├── ChatService.ts               ← same class, different endpoint config
│       │   ├── ChatStore.ts                 ← same factory
│       │   ├── chat.factory.ts              ← admin-specific wiring (AdminSlashCommands)
│       │   └── slash-commands/
│       │       └── AdminSlashCommands.ts
│       └── fallback/                        ← same classes as tenant
│           ├── KeywordFallbackReply.ts
│           └── BraceBalancedJsonExtractor.ts
│
└── shared/                                  ← NEW directory
    ├── components/
    │   └── chat/
    │       ├── UnifiedChatPanel.tsx         ← copy from tenant
    │       ├── UnifiedChatMessage.tsx
    │       ├── UnifiedChatHeader.tsx
    │       ├── UnifiedChatInput.tsx
    │       ├── UnifiedChatEmptyState.tsx
    │       └── TriggerButton.tsx
    ├── hooks/
    │   └── useChat.ts                       ← same hook
    └── types/
        └── chat.types.ts                    ← same types

**Decision: No monorepo shared package.** Since neither frontend is in a monorepo workspace, the component code will be mirrored. The *interfaces and service logic* will be structured identically so extraction to a shared package is trivial when the monorepo is introduced.

---

## 3. SOLID Compliance Map

### 3.1 Single Responsibility Principle (SRP)

Each class/component has exactly one reason to change:

| Component | Responsibility |
|---|---|
| `IChatService` | Contract for chat operations only |
| `ChatService` | Backend communication + response parsing only |
| `ChatStore` | State management only |
| `UnifiedChatPanel` | UI composition + layout only |
| `UnifiedChatMessage` | Rendering a single message (delegates to renderers) |
| `UnifiedChatInput` | Text input + command suggestion UI only |
| `MarkdownRenderer` | Converting markdown string to React elements only |
| `MiniChart` | Rendering bar chart SVG only |
| `MetricsRenderer` | Rendering label:value badge chips only |
| `TableRenderer` | Rendering HTML table only |
| `SuggestionRenderer` | Rendering clickable suggestion pills only |
| `TokenCounter` | Displaying input/output token counts only |
| `TypingIndicator` | Animated "thinking" dots only |
| `TenantSlashCommands` | Providing tenant-scoped slash command definitions only |
| `AdminSlashCommands` | Providing admin-scoped slash command definitions only |
| `useChat` | Orchestrating service + store + UI state only |

### 3.2 Open/Closed Principle (OCP)

**Open for extension, closed for modification:**

- `IChatService` — new transport methods (e.g., streaming) add new interface methods without modifying existing
- `UnifiedChatMessage` — new inline renderers added via strategy pattern, not by modifying the component
- `ChatStore` — new state fields added via store composition, not by modifying existing selectors
- Slash commands — new commands added by extending the registry, not by modifying the input handler

**Strategy pattern for slash commands:**
```typescript
interface ISlashCommandProvider {
  readonly commands: SlashCommand[];
  getSuggestions(input: string): SlashCommand[];
}
```
New command providers implement the interface without modifying any existing code.

**Strategy pattern for inline renderers:**
```typescript
interface IInlineRenderer {
  type: 'markdown' | 'chart' | 'metrics' | 'table' | 'suggestions' | 'tokens';
  canRender(data: unknown): boolean;
  render(data: unknown, props: RendererProps): React.ReactNode;
}
```
New renderers added by implementing the interface and registering.

### 3.3 Liskov Substitution Principle (LSP)

**Derived types must be substitutable for their base types:**

- `TenantSlashCommands` and `AdminSlashCommands` both implement `ISlashCommandProvider` — any code using the interface works with either
- If `ChatServiceV2` (with SSE streaming) extends the base `ChatService`, it must not break `useChat` which depends on `IChatService`
- All renderers return `React.ReactNode` — no renderer throws or has special null behavior

### 3.4 Interface Segregation Principle (ISP)

**Many client-specific interfaces > one general-purpose interface:**

```typescript
// Chat operations — for the hook/UI
interface IChatService {
  sendMessage(message: string, options?: ChatOptions): Promise<ChatResponse>;
  getHistory(limit?: number): Promise<ChatMessage[]>;
  clearHistory(): Promise<void>;
  isAvailable(): boolean;
}

// Suggestions — for the input component only
interface ISuggestionProvider {
  getSuggestions(query: string, context?: string): Promise<string[]>;
  readonly slashCommands: SlashCommand[];
}

// History — for persistence layer only
interface IChatHistoryStore {
  messages: ChatMessage[];
  conversationId: string | null;
  addMessage(msg: ChatMessage): void;
  clearHistory(): void;
  hydrate(): void;
}

// Panel state — for UI only
interface IChatPanelState {
  open: boolean;
  setOpen(open: boolean): void;
  toggleOpen(): void;
}

// Renderer — for message rendering
interface IChatMessageRenderer {
  type: string;
  render(message: ChatMessage): React.ReactNode | null;
}

// Config — for tenant vs admin differences
interface ChatConfig {
  panelTitle: string;
  badgeLabel: string;
  badgeColor: string;
  triggerIcon: string;       // emoji
  placeholder: string;
  maxMessages: number;
  storageKey: string;
  apiEndpoint: string;
  starterPrompts: string[];
  homeHeroChips?: string[];
}
```

### 3.5 Dependency Inversion Principle (DIP)

**Depend on abstractions, not concretions:**

```
Before (ConversationPanel):
  ConversationPanel.tsx
    → import { chatService } from '@/services/chat.service'  (CONCRETE)
    → import { useChatStore } from '@/stores/chatStore'        (CONCRETE)
    → import { api } from '@/services/api'                     (CONCRETE)

After (UnifiedChatPanel):
  UnifiedChatPanel.tsx
    → import { IChatService } from '@/core/services/interfaces'  (ABSTRACTION)
    → Injected via props or context

  useChat(chatService: IChatService, store: IChatHistoryStore)
    → Works with any implementation of IChatService
    → Works with any implementation of IChatHistoryStore
```

**Dependency injection in practice (manual, no DI framework):**

```typescript
// core/services/ChatService.ts
export class ChatService implements IChatService {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly config: ChatConfig,
    private readonly slashCommands: ISlashCommandProvider,
    private readonly jsonExtractor: IJsonExtractor,
    private readonly fallbackReply: IFallbackReply,
  ) {}
  // ...
}

// Singleton factory at module level:
export const chatService = new ChatService(
  restClient,
  tenantChatConfig,
  tenantSlashCommands,
  new BraceBalancedJsonExtractor(),
  new KeywordFallbackReply(),
);
```

---

## 4. Implementation Phases

### Phase 0: Unified Type System (No code changes — design only)

**Goal:** Single source of truth for chat types, shared across all files.

#### New file: `frontend-tenant/src/shared/types/chat.types.ts`

This replaces both `src/types/chat.types.ts` and `src/core/services/interfaces/IConversationalAIService.ts`.

```typescript
// ── Roles ──
export type MessageRole = 'user' | 'assistant' | 'system';

// ── Inline Data (rendered inside message bubbles) ──
export interface ChartData {
  chartType: 'bar';                              // Only bar for now
  chartData: Array<{ label: string; value: number }>;
}

export interface MetricsData {
  items: Array<{ label: string; value: string | number; color?: string }>;
}

export interface TableData {
  headers: string[];
  rows: Array<Record<string, string | number | boolean>>;
}

export interface SuggestionData {
  label: string;
  action?: string;                                // Optional — for agent task execution
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// ── Messages ──
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tokens?: { input: number; output: number };
  metadata?: {
    chart?: ChartData;
    metrics?: MetricsData;
    table?: TableData;
    suggestions?: SuggestionData[];
    isStreaming?: boolean;
    sourceSummary?: string;
  };
}

// ── Request / Response ──
// Backend SendChatMessageDto: { message, conversationId?, systemPrompt?, temperature?, maxTokens?, history?, context? }
// Backend response (from ChatService.send): { reply, conversationId, tokens?, model?, provider?, liveData? }
// NOTE: chartType and chartData are NOT top-level response fields — they are embedded
// as JSON inside the `reply` string by the LLM (frontend extracts via IJsonExtractor).
// NOTE: suggestions are NOT returned by the backend. The frontend infers them via IFallbackReply.

export interface ChatRequest {
  message: string;                              // Maps to backend SendChatMessageDto.message
  conversationId?: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  history?: Array<{ role: MessageRole; content: string }>;
}

export interface ChatResponse {
  reply: string;                                // May contain embedded JSON for chart data
  conversationId: string;
  tokens: { input: number; output: number; total?: number };
  model?: string;
  provider?: string;
  liveData?: Record<string, unknown>;           // Tenant snapshot from backend
  // ── Frontend-extracted fields (populated by ChatService after parsing) ──
  chartType?: 'bar';
  chartData?: Array<{ label: string; value: number }>;
  suggestions?: string[];
}

// ── Slash Commands ──
export interface SlashCommand {
  trigger: string;
  label: string;
  context?: string;
  suggestions: string[];
}

// ── Config ──
export interface ChatConfig {
  panelTitle: string;
  badgeLabel: string;
  badgeColor: string;
  triggerIcon: string;                            // emoji string
  placeholder: string;
  maxMessages: number;
  storageKey: string;
  apiEndpoint: string;
  starterPrompts: string[];
  homeHeroChips?: string[];
}
```

#### Impact:
- Delete: `src/core/services/interfaces/IConversationalAIService.ts`
- Delete: `src/types/chat.types.ts` (tenant), `src/types/chat.types.ts` (admin)
- All files import from `@/shared/types/chat.types` going forward
- **Field rename:** `ChatRequest.message` replaces `ChatRequest.query` (matching backend `SendChatMessageDto.message`). Existing senders map `query → message` inside `ChatService.sendMessage()`.
- **New types:** `ChatResponse` now includes `model`, `provider`, `liveData` (previously ignored by frontend).
- **`getSuggestions` endpoint:** `POST /api/v1/chat/suggestions` is a **stub** — always returns `{ suggestions: [] }`. Slash commands are client-side only. The `getSuggestions` service method should be kept as a stub for future implementation.

---

### Phase 1: Service Layer (DIP + ISP)

**Goal:** Clean, testable, SOLID-compliant services behind interfaces.

#### 1a. Create Interfaces

`frontend-tenant/src/core/services/interfaces/IChatService.ts`:
```typescript
import type { ChatMessage, ChatRequest, ChatResponse, SlashCommand } from '@/shared/types/chat.types';

export interface IChatService {
  sendMessage(request: ChatRequest): Promise<ChatResponse>;
  getHistory(limit?: number): Promise<ChatMessage[]>;
  clearHistory(): Promise<void>;
  getSuggestions(query: string, context?: string): Promise<string[]>;
  isAvailable(): boolean;
}

export interface ISlashCommandProvider {
  readonly commands: SlashCommand[];
  getSuggestions(input: string): SlashCommand[];
  getContextForTrigger(input: string): string | undefined;
}

export interface IFallbackReply {
  generate(message: string): { reply: string; suggestions?: string[] };
  generateSuggestions(replyText: string): string[];
}

export interface IJsonExtractor {
  extract(text: string): { cleaned: string; chartType?: string; chartData?: unknown[] } | null;
}

export interface ISystemPromptBuilder {
  build(context?: Record<string, unknown>): string;
}
```

**Note:** `IChatStore` is NOT a separate interface. The store uses React Zustand's `create()` with `persist` middleware — the same pattern as all 19 existing stores. The store lives at `core/services/ChatStore.ts` and is consumed via `useChatStore(s => s.field)` selectors.

#### 1b. Implement Concrete Service

`frontend-tenant/src/core/services/ChatService.ts`:
```typescript
export class ChatService implements IChatService {
  constructor(
    private readonly apiClient: IApiClient,           // DIP: depends on abstraction
    private readonly config: ChatConfig,               // DIP: depends on value object
    private readonly fallback: IFallbackReply,          // DIP
    private readonly jsonExtractor: IJsonExtractor,     // DIP
    private readonly systemPromptBuilder: ISystemPromptBuilder, // DIP
  ) {}

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      // IApiClient.post() returns ApiResponse<T> = { status, data?, error?, meta }
      // We must unwrap: response.data contains the actual payload
      const apiResponse = await this.apiClient.post<{
        reply: string;
        conversationId: string;
        tokens?: { input: number; output: number; total: number };
        model?: string;
        provider?: string;
        liveData?: Record<string, unknown>;
      }>(
        this.config.apiEndpoint,
        {
          ...request,
          systemPrompt: request.systemPrompt ?? this.systemPromptBuilder.build(request.context),
          history: request.history ?? [],
        },
      );

      const response = apiResponse.data!;  // Unwrap ApiResponse wrapper

      // Backend does NOT return chartType or chartData as top-level fields.
      // The LLM embeds chart JSON inside the reply string (per system prompt).
      // Parse it out client-side using the brace-balanced JSON extractor.
      const parsed = this.jsonExtractor.extract(response.reply);
      const reply = parsed?.cleaned ?? response.reply;

      // Build metadata from client-side parsing (NOT from backend response fields)
      const chartData = parsed?.chartData as Array<{ label: string; value: number }> | undefined;
      const chartType = parsed?.chartType as 'bar' | undefined;

      // Backend does NOT return suggestions. Infer client-side via fallback.
      const suggestions = this.fallback.generateSuggestions(reply);

      // Build metadata for inline rendering
      const metadata: ChatMessage['metadata'] = {};
      if (chartType && chartData) {
        metadata.chart = { chartType: 'bar', chartData };
      }
      if (suggestions.length) {
        metadata.suggestions = suggestions.map(s => ({ label: s }));
      }
      if (response.tokens) {
        metadata.tokens = { input: response.tokens.input, output: response.tokens.output };
      }

      return {
        reply,
        conversationId: response.conversationId,
        tokens: response.tokens ?? { input: 0, output: 0 },
        chartData,
        chartType,
        suggestions,
      };
    } catch {
      // Fallback: return rule-based offline reply (from AIChatPanel pattern)
      const fb = this.fallback.generate(request.message);
      return {
        reply: fb.reply,
        conversationId: '',
        tokens: { input: 0, output: 0 },
        suggestions: fb.suggestions,
      };
    }
  }

  // getHistory, clearHistory, getSuggestions delegate to apiClient
}
```

#### 1c. Implement ChatStore (Consistent with existing Zustand React pattern)

The codebase exclusively uses `create()` from `zustand` (React bindings) — NOT `createStore` from `zustand/vanilla`. Keep the same pattern.

`frontend-tenant/src/core/services/ChatStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ChatConfig } from '@/shared/types/chat.types';

interface ChatStoreState {
  open: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  sending: boolean;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearHistory: () => void;
  setConversationId: (id: string) => void;
  setSending: (sending: boolean) => void;
}

export function createChatStore(config: ChatConfig) {
  return create<ChatStoreState>()(
    persist(
      (set) => ({
        open: false,
        messages: [],
        conversationId: null,
        sending: false,

        setOpen: (open) => set({ open }),
        toggleOpen: () => set((s) => ({ open: !s.open })),

        addMessage: (msg) =>
          set((s) => ({
            messages: [...s.messages.slice(-(config.maxMessages - 1)), msg],
          })),

        updateMessage: (id, updates) =>
          set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          })),

        removeMessage: (id) =>
          set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

        clearHistory: () => set({ messages: [], conversationId: null }),
        setConversationId: (conversationId) => set({ conversationId }),
        setSending: (sending) => set({ sending }),
      }),
      {
        name: config.storageKey,
        partialize: (state) => ({
          messages: state.messages.slice(-config.maxMessages),
          conversationId: state.conversationId,
        }),
      },
    ),
  );
}
```

**Usage in factory:**
```typescript
export const useChatStore = createChatStore(tenantChatConfig);
```

**Consumed by hooks (standard React Zustand pattern):**
```typescript
const messages = useChatStore((s) => s.messages);
const sending = useChatStore((s) => s.sending);
// Reactive — Zustand's create() handles React subscriptions automatically.
```

**No class wrapper needed.** All testability is preserved — tests can call `useChatStore.getState()` and `useChatStore.setState()` directly, consistent with the existing 13 tenant stores and 5 admin stores.

#### 1d. Create Fallback + JSON Extractor + SystemPromptBuilder

Extract from existing code:
- `KeywordFallbackReply` → from `ConversationalAIService._fallbackReply()`
- `BraceBalancedJsonExtractor` → from `ConversationalAIService._extractFirstJsonObject()`
- `TenantSystemPromptBuilder` → from `ConversationalAIService.SYSTEM_PROMPT`

#### 1e. Slash Command Providers

`frontend-tenant/src/core/services/slash-commands/TenantSlashCommands.ts`:
```typescript
export class TenantSlashCommands implements ISlashCommandProvider {
  readonly commands: SlashCommand[] = [
    { trigger: '/agents', label: 'Agent queries', context: 'agent', suggestions: [...] },
    { trigger: '/tasks', label: 'Task queries', context: 'task', suggestions: [...] },
    { trigger: '/costs', label: 'Cost & budget', context: 'system', suggestions: [...] },
    { trigger: '/workflows', label: 'Workflow queries', context: 'workflow', suggestions: [...] },
    { trigger: '/approvals', label: 'Pending approvals', context: 'system', suggestions: [...] },
  ];

  getSuggestions(input: string): SlashCommand[] {
    return this.commands.filter(c => c.trigger.startsWith(input.toLowerCase()));
  }

  getContextForTrigger(input: string): string | undefined {
    return this.commands.find(c => c.trigger === input.toLowerCase())?.context;
  }
}
```

`frontend-admin/src/core/services/slash-commands/AdminSlashCommands.ts`:
```typescript
export class AdminSlashCommands implements ISlashCommandProvider {
  readonly commands: SlashCommand[] = [
    { trigger: '/agents', label: 'Agent queries', context: 'agent', suggestions: [...] },
    { trigger: '/tenants', label: 'Tenant queries', context: 'tenant', suggestions: [...] },
    { trigger: '/billing', label: 'Billing queries', context: 'billing', suggestions: [...] },
    { trigger: '/system', label: 'System status', context: 'system', suggestions: [...] },
  ];
  // ...
}
```

#### 1f. Wire Singletons

`frontend-tenant/src/core/services/chat.factory.ts`:
```typescript
import { restClient } from '@/core/services/api/clients/RestClient';

const tenantChatConfig: ChatConfig = {
  panelTitle: 'HeadQuarter AI',
  badgeLabel: 'AI',
  badgeColor: 'indigo',
  triggerIcon: '✦',
  placeholder: 'Ask anything… or type / for commands',
  maxMessages: 100,
  storageKey: 'hq_chat_store',
  apiEndpoint: '/api/v1/chat/messages',
  starterPrompts: [
    'How is my team performing today?',
    'Which agents have the highest workload?',
    'What tasks are overdue?',
    'Show me top workflow bottlenecks.',
    'Summarise yesterday\'s activity.',
  ],
  homeHeroChips: [
    "How's our pipeline this week?",
    'Show pending approvals',
    "Summarize today's activity",
    'Run a performance forecast',
  ],
};

export const chatService = new ChatService(
  restClient,
  tenantChatConfig,
  new KeywordFallbackReply(),
  new BraceBalancedJsonExtractor(),
  new TenantSystemPromptBuilder(),
);

export const useChatStore = createChatStore(tenantChatConfig);
export const slashCommands = new TenantSlashCommands();
```

### Phase 2: Consolidated UI Component

#### 2a. `UnifiedChatPanel.tsx`

The single chat panel used in both shells. Accepts props for configuration (no hardcoded tenant vs admin logic).

```typescript
// Props — all dependencies injected (DIP)
interface UnifiedChatPanelProps {
  useChat: () => UseChatReturn;             // DI: hook factory, not concrete hook
  slashCommands: ISlashCommandProvider;
  config: ChatConfig;
  pageContext?: string;
  pendingMessage?: string;
  onPendingConsumed?: () => void;
}
```

**Internal structure:**
```
┌──────────────────────────────────────────────┐
│ UnifiedChatHeader                            │
│  "HeadQuarter AI" [AI badge] [↺ clear] [✕]  │
├──────────────────────────────────────────────┤
│ UnifiedChatEmptyState (when no messages)     │
│  ✦ icon + "How can I help?"                  │
│  [Starter prompt 1] [Starter prompt 2] ...   │
│  [HomeHero chip 1] [HomeHero chip 2] ...     │
├──────────────────────────────────────────────┤
│ <Scrollable message area>                    │
│  UnifiedChatMessage (user)                   │
│    "You" label + indigo bubble               │
│  UnifiedChatMessage (assistant)              │
│    "✦ HeadQuarter AI" label                  │
│    MarkdownRenderer                          │
│    [chart] MiniChart (bar)                   │
│    [metrics] MetricsRenderer                 │
│    [table] TableRenderer                     │
│    [suggestions] SuggestionRenderer          │
│    TokenCounter                              │
│  TypingIndicator (when sending)              │
├──────────────────────────────────────────────┤
│ ErrorBanner (when error)                     │
├──────────────────────────────────────────────┤
│ UnifiedChatInput                             │
│  "Ask anything… or type / for commands"      │
│  Slash command dropdown                      │
│  [Send button]                               │
└──────────────────────────────────────────────┘
```

#### 2b. `UnifiedChatMessage.tsx`

```typescript
function UnifiedChatMessage({ message, onSuggestionSelect }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={isUser ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200'}>
        {/* Avatar label */}
        <span>{isUser ? 'You' : '✦ HeadQuarter AI'}</span>

        {/* Markdown content */}
        {message.content && <MarkdownRenderer content={message.content} />}

        {/* Inline chart */}
        {message.metadata?.chart && <MiniChart data={message.metadata.chart.chartData} />}

        {/* Inline metrics */}
        {message.metadata?.metrics && <MetricsRenderer items={message.metadata.metrics.items} />}

        {/* Inline table */}
        {message.metadata?.table && <TableRenderer headers={message.metadata.table.headers} rows={message.metadata.table.rows} />}

        {/* Suggestion chips */}
        {message.metadata?.suggestions && (
          <SuggestionRenderer
            suggestions={message.metadata.suggestions}
            onSelect={onSuggestionSelect}
            disabled={sending}
          />
        )}

        {/* Token counter */}
        {message.tokens && <TokenCounter input={message.tokens.input} output={message.tokens.output} />}

        {/* Timestamp */}
        <span>{formatTimestamp(message.timestamp)}</span>
      </div>
    </div>
  );
}
```

#### 2c. `UnifiedChatInput.tsx`

- Merges AIChatPanel's text input + ConversationPanel's textarea with auto-resize
- Merges ConversationPanel's slash command autocomplete
- Merges AIChatPanel's double-submit guard
- Ctrl+Enter to send, Escape to clear

#### 2d. `UnifiedChatEmptyState.tsx`

- STARTER_PROMPTS from AIChatPanel
- HomeHero chips (when on home page)
- Clicking a prompt sends it

#### 2e. `TriggerButton.tsx`

- Floating 💬 button (bottom-right) — default
- "✦ Ask AI" button in TopBar — alternative (configurable via `ChatConfig`)

#### 2f. `useChat.ts` — Unified Hook (React Zustand selectors)

```typescript
import { useCallback, useState } from 'react';
import { useChatStore } from '@/core/services/ChatStore';
import type { ChatMessage } from '@/shared/types/chat.types';

export function useChat(
  chatService: IChatService,
  slashCommands: ISlashCommandProvider,
  config: ChatConfig,
  pageContext?: string,
) {
  // React Zustand selectors — auto-subscribing, triggers re-render
  const messages = useChatStore((s) => s.messages);
  const open = useChatStore((s) => s.open);
  const sending = useChatStore((s) => s.sending);
  const conversationId = useChatStore((s) => s.conversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const clearHistory = useChatStore((s) => s.clearHistory);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setOpen = useChatStore((s) => s.setOpen);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const setSending = useChatStore((s) => s.setSending);

  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;

    setError(null);
    setSending(true);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Streaming placeholder
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      metadata: { isStreaming: true },
    };
    addMessage(assistantMsg);

    try {
      const context = slashCommands.getContextForTrigger(content.toLowerCase());
      const response = await chatService.sendMessage({
        message: content.trim(),
        conversationId,
        context: { pageContext, slashContext: context },
      });

      updateMessage(assistantMsg.id, {
        content: response.reply,
        timestamp: new Date().toISOString(),
        tokens: response.tokens,
        metadata: {
          isStreaming: false,
          chart: response.chartData ? { chartType: 'bar', chartData: response.chartData } : undefined,
          suggestions: response.suggestions?.map(s => ({ label: s })),
        },
      });
      setConversationId(response.conversationId);
    } catch {
      removeMessage(assistantMsg.id);
      setError('Sorry, something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [chatService, slashCommands, pageContext, sending, conversationId,
      addMessage, updateMessage, removeMessage, setConversationId, setSending]);

  return {
    messages,
    open,
    sending,
    error,
    sendMessage,
    clearHistory,
    setOpen,
    toggleOpen,
  };
}
```

### Phase 3: Agent Execution Integration

**Goal:** When the backend routes a chat message to `OfficialAgentGraph` (action intent), the chat UI renders execution progress and follow-up actions.

#### 3a. Backend Already Supports This

The backend `ChatService.send()` already:
1. Detects action intent from keywords
2. Calls `OfficialAgentGraph.run()` with the user's message as the goal
3. Returns the execution result in `reply` + optional `suggestions`

**No backend changes needed** — just better frontend rendering of action results.

#### 3b. Response Types for Agent Execution

When the backend executes an agent task, the response includes:

```json
{
  "reply": "I've created 3 new agents in the Sales department:\n- Alex (active)\n- Sarah (active)\n- Mike (pending)",
  "conversationId": "conv_12345",
  "tokens": { "input": 150, "output": 80 },
  "chartData": [{ "label": "Active", "value": 2 }, { "label": "Pending", "value": 1 }],
  "suggestions": [
    "Deploy pending agents",
    "Show me the Sales team performance",
    "Assign tasks to the new agents"
  ],
  "executionResult": {
    "status": "completed",
    "stepsExecuted": 3,
    "toolsCalled": ["createAgent", "assignToDepartment"],
    "durationMs": 2340
  }
}
```

#### 3c. Frontend Rendering for Execution Results

- **Confirmation dialog** for destructive actions (requires `requiresConfirmation` on suggestions)
- **Execution summary** in the assistant reply text (already there from backend)
- **Follow-up suggestions** rendered as pill buttons (already handled by `SuggestionRenderer`)
- **Progress indicator** for long-running actions (future: SSE streaming)

#### 3d. Suggestion Click Handler

When a user clicks a suggestion chip, it sends that text as a new message:

```typescript
const handleSuggestionClick = (suggestion: SuggestionData) => {
  if (suggestion.requiresConfirmation && suggestion.confirmationMessage) {
    // Show confirmation dialog before executing
    setConfirmDialog({ message: suggestion.confirmationMessage, onConfirm: () => {
      sendMessage(suggestion.label);
    }});
  } else {
    sendMessage(suggestion.label);
  }
};
```

### Phase 4: Frontend-Admin Adoption

#### 4a. Create `core/` Directory in Admin

Admin currently has no `core/` directory. Create the same structure:

```
frontend-admin/src/core/
└── services/
    ├── interfaces/
    │   └── IChatService.ts               ← copy from tenant (same interface)
    ├── ChatService.ts                     ← same class, different endpoint config
    ├── ChatStore.ts                       ← same class
    ├── chat.factory.ts                    ← admin-specific wiring
    └── slash-commands/
        └── AdminSlashCommands.ts          ← admin-specific commands
```

#### 4b. Mirror Shared Components

Copy to `frontend-admin/src/shared/components/chat/`:
- `UnifiedChatPanel.tsx`
- `UnifiedChatMessage.tsx`
- `UnifiedChatHeader.tsx`
- `UnifiedChatInput.tsx`
- `UnifiedChatEmptyState.tsx`
- `TriggerButton.tsx`
- `hooks/useChat.ts`
- `types/chat.types.ts`

#### 4c. Update AdminShell and TenantShell

**AdminShell.tsx** — single mount point (line 112):
```typescript
// Before
import { ConversationPanel } from '@/components/chat/ConversationPanel';
<ConversationPanel />

// After
import { UnifiedChatPanel } from '@/shared/components/chat/UnifiedChatPanel';
import { chatService, useChatStore, slashCommands } from '@/core/services/chat.factory';
import { useChat } from '@/shared/hooks/useChat';

// In component:
const chatHook = useChat(chatService, slashCommands, adminChatConfig);
<UnifiedChatPanel
  useChat={() => chatHook}
  slashCommands={slashCommands}
  config={adminChatConfig}
/>
```

**TenantShell.tsx** — single shell since FIX-021 (LegacyShell was deleted):
```typescript
// Before
import { ConversationPanel } from '@/components/chat/ConversationPanel';
// Rendered once in the (single) TenantShell.

// After — same UnifiedChatPanel rendered in the shell:
import { UnifiedChatPanel } from '@/shared/components/chat/UnifiedChatPanel';
import { chatService, useChatStore, slashCommands } from '@/core/services/chat.factory';
import { useChat } from '@/shared/hooks/useChat';

// In component (replace the single ConversationPanel):
const chatHook = useChat(chatService, slashCommands, tenantChatConfig);
const chatPanel = (
  <UnifiedChatPanel
    useChat={() => chatHook}
    slashCommands={slashCommands}
    config={tenantChatConfig}
  />
);
// Render {chatPanel} once inside the shell.
```

**Note on page-mounted AIChatPanel:** The current AIChatPanel is page-mounted on `/home`. After migration, the UnifiedChatPanel will be shell-mounted (like ConversationPanel). The HomeHero integration must continue working — use the `pendingMessage` prop pattern to pre-fill the chat input when HomeHero submits.

**HomeHero integration fix:** `SUGGESTION_CHIPS` are defined in `components/home/HomeHero.tsx` (not `home/page.tsx`). The chips fill the HomeHero input; on send, `home/page.tsx` sets `pendingMessage` and opens the chat panel via `setOpen(true)` on the Zustand store.

**Command-center integration:** The command-center currently has its own `AIChatButton` (`fixed bottom-6 right-6`). Since UnifiedChatPanel will provide its own trigger (floating 💬), the command-center's local `AIChatButton` can be removed.

#### 4d. Delete Admin Legacy Chat Files

After verifying everything works:
- Delete `frontend-admin/src/components/chat/ConversationPanel.tsx`
- Delete `frontend-admin/src/services/chat.service.ts`
- Delete `frontend-admin/src/stores/chatStore.ts`
- Delete `frontend-admin/src/hooks/useChat.ts`
- Delete `frontend-admin/src/types/chat.types.ts`

### Phase 5: Backend Optimizations (Minimal)

The backend already supports the unified chat. Only minor changes:

#### 5a. Deprecate `/ai/chat` Route

The `/ai/chat` route is an alias for `/chat/messages`. Keep it for backward compatibility but mark as deprecated. After the unified chat ships, remove it.

#### 5b. Response Shape — Add Metadata Fields

Ensure the backend response includes all fields the frontend expects:

```typescript
// Current response shape (already good):
{
  reply: string;
  conversationId: string;
  tokens?: { input: number; output: number };
  model?: string;
  provider?: string;
  liveData?: Record<string, unknown>;
}

// Ensure these are also returned when applicable:
{
  chartType?: 'bar';                  // ← already supported
  chartData?: Array<{ label: string; value: number }>;  // ← already supported
  suggestions?: string[];             // ← already supported
}
```

#### 5c. Intent Detection Enhancement (Optional)

The current intent detection is keyword-based. Consider adding AI-powered intent detection for better action routing — but not required for Phase 1.

### Phase 6: Testing & Verification

#### 6a. Unit Tests — Service Layer

| Test | File |
|---|---|
| `ChatService.sendMessage()` — success path | `ChatService.test.ts` |
| `ChatService.sendMessage()` — fallback on error | `ChatService.test.ts` |
| `ChatService.sendMessage()` — JSON chart extraction | `ChatService.test.ts` |
| `ChatService.getHistory()` | `ChatService.test.ts` |
| `ChatStore` — add/update/clear/persist | `ChatStore.test.ts` |
| `ChatStore` — localStorage hydrate | `ChatStore.test.ts` |
| `BraceBalancedJsonExtractor` — valid/invalid JSON | `BraceBalancedJsonExtractor.test.ts` |
| `KeywordFallbackReply` — all 5 intent paths | `KeywordFallbackReply.test.ts` |
| `TenantSlashCommands` — all 5 commands | `TenantSlashCommands.test.ts` |
| `AdminSlashCommands` — all 4 commands | `AdminSlashCommands.test.ts` |

#### 6b. Unit Tests — UI Components

| Test | File |
|---|---|
| `UnifiedChatPanel` — render, open/close | `UnifiedChatPanel.test.tsx` |
| `UnifiedChatInput` — slash command autocomplete | `UnifiedChatInput.test.tsx` |
| `UnifiedChatMessage` — renders all inline types | `UnifiedChatMessage.test.tsx` |
| `MiniChart` — renders bars correctly | `MiniChart.test.tsx` |
| `MarkdownRenderer` — bold, italic, code | `MarkdownRenderer.test.tsx` |

#### 6c. TypeScript Verification

```bash
cd frontend-tenant && pnpm run type-check  # Must be 0 errors
cd frontend-admin && pnpm run type-check   # Must be 0 errors
cd backend && pnpm run type-check          # Must be 0 errors
```

#### 6d. E2E Tests (Playwright)

| Test | Scenario |
|---|---|
| Chat panel opens/closes | Click 💬 → panel visible → click ✕ → panel hidden |
| Send message | Type message → click send → response appears |
| Slash commands | Type `/` → dropdown shows → select → context sent |
| Starter prompts | Click starter prompt → message sent → response received |
| HomeHero integration | Click HomeHero chip → panel opens with message |
| Chart rendering | AI response with JSON → MiniChart renders |
| Suggestion chips | Click suggestion → new message sent |
| Error state | Disconnect network → send → error banner shows |
| Persistence | Send messages → refresh page → messages restored |
| Admin-specific | Admin slash commands work in admin shell |

#### 6e. Lint

```bash
cd frontend-tenant && pnpm run lint  # 0 warnings/errors
cd frontend-admin && pnpm run lint   # 0 warnings/errors
```

---

## 5. Backward Compatibility & Migration

### 5.1 Deprecation Timeline

| Phase | Action |
|---|---|
| Phase 0–1 | No changes to existing files; new types + services added alongside |
| Phase 2 | `UnifiedChatPanel` added; both old and new panels exist simultaneously |
| Phase 3 | Old panels remain; new panel mounted in TenantShell + AdminShell alongside old ones |
| Phase 4 | Old panels hidden behind feature flag; new panel is default |
| Phase 5 | Old panel files deleted; all tests pass on new panel |

### 5.2 Feature Flag

```typescript
// feature-flags.ts
export const FEATURES = {
  UNIFIED_CHAT: false,   // Set to true to enable new panel
};

// During migration:
// - false: old ConversationPanel renders
// - true: new UnifiedChatPanel renders
```

### 5.3 No Breaking Changes

- Tenant frontend: All existing `chatStore`, `useChat`, `chatService` imports remain valid until Phase 5 cleanup
- Admin frontend: Same — old files remain until full migration verified
- Backend: No API contract changes; both old and new endpoints work identically

---

## 6. Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| TypeScript errors during migration | High | Medium | Run `type-check` after every change; fix before proceeding |
| Missed edge case in unified hook | Medium | Medium | Keep old hook as reference; compare return shapes |
| Admin has no `core/` directory — architecture gap | Medium | Low | Reuse tenant's patterns; admin's core/ is simpler |
| localStorage key conflict (old `chat-store` vs new `hq_chat_store`) | Low | Low | Clear legacy key on first migration; user loses old messages once |
| Backend `/ai/chat` deprecation breaks something | Low | Low | Keep route alive for 2 release cycles; log deprecation warnings |
| Feature flag complexity | Low | Low | Simple boolean; remove after migration complete |
| UX confusion (three names → one name) | Medium | Low | Use "HeadQuarter AI" as the single name; update all UI text |

---

## 7. Summary: What Gets Deleted

### Tenant Frontend — Files to Delete After Migration

| File | Purpose | Replaced By |
|---|---|---|
| `src/services/chat.service.ts` | Legacy chat API | `core/services/ChatService.ts` |
| `src/stores/chatStore.ts` | Zustand chat store | `core/services/ChatStore.ts` |
| `src/hooks/useChat.ts` | Legacy chat hook | `shared/hooks/useChat.ts` |
| `src/types/chat.types.ts` | Legacy types | `shared/types/chat.types.ts` |
| `src/components/chat/ConversationPanel.tsx` | Old UI | `shared/components/chat/UnifiedChatPanel.tsx` |
| `src/features/ai-chat/components/AIChatPanel.tsx` | Old UI | `shared/components/chat/UnifiedChatPanel.tsx` |
| `src/features/ai-chat/components/AIChatMessage.tsx` | Old UI | `shared/components/chat/UnifiedChatMessage.tsx` |
| `src/shared/hooks/useAIChat.ts` | Old hook | `shared/hooks/useChat.ts` |
| `src/core/services/ConversationalAIService.ts` | Old service | `core/services/ChatService.ts` |
| `src/core/services/interfaces/IConversationalAIService.ts` | Old interface | `core/services/interfaces/IChatService.ts` |
| `src/features/ai-chat/` (entire directory) | Entire feature module | — |

### Admin Frontend — Files to Delete After Migration

| File | Purpose | Replaced By |
|---|---|---|
| `src/services/chat.service.ts` | Legacy chat API | `core/services/ChatService.ts` |
| `src/stores/chatStore.ts` | Zustand chat store | `core/services/ChatStore.ts` |
| `src/hooks/useChat.ts` | Legacy hook | `shared/hooks/useChat.ts` |
| `src/types/chat.types.ts` | Legacy types | `shared/types/chat.types.ts` |
| `src/components/chat/ConversationPanel.tsx` | Old UI | `shared/components/chat/UnifiedChatPanel.tsx` |

---

## Appendix A: Estimated Effort

| Phase | Files Changed | Files Created | Files Deleted | Effort (hours) |
|---|---|---|---|---|
| Phase 1a: Interfaces | 0 | 2 | 1 | 1 |
| Phase 1b–1c: Service + Store | 0 | 4 | 0 | 3 |
| Phase 1d–1e: Fallback + JSON + Slash | 0 | 5 | 0 | 2 |
| Phase 1f: Factory wiring | 2 | 2 | 0 | 1 |
| Phase 2a–2f: UI components | 0 | 6 | 0 | 6 |
| Phase 2g: Unified hook | 0 | 1 | 0 | 2 |
| Phase 3: Agent execution | 1 | 1 | 0 | 3 |
| Phase 4a–4d: Admin adoption (creating core/ + shared/ from scratch) | 0 | 11 | 5 | 6 |
| Phase 5: Backend tweaks | 2 | 0 | 0 | 1 |
| Phase 6a–6e: Tests | 0 | 15 | 0 | 6 |
| **Total** | **5** | **47** | **18** | **~33** |

## Appendix B: Key Design Decisions

| Decision | Rationale |
|---|---|
| **Class-based services** (not functional) | Needed for DI via constructor; testable via interface mocking |
| **Manual DI factories** (no DI framework) | Consistent with existing tenant architecture; avoids build-time dependency |
| **React Zustand store** (not vanilla createStore) | All 19 existing stores use `create()` from `zustand` — consistency over novelty |
| **Store consumed via selectors** (not class getters) | Zustand selectors are reactive by default; class getters require `useSyncExternalStore` |
| **JSON extractor as separate class** | SRP + testable in isolation; extracted from ConversationalAIService private method |
| **Tenant/Admin variants via config object** | Avoids inheritance complexity; ChatConfig is a plain value object |
| **No streaming in Phase 1** | Backend SSE exists but frontend streaming adds complexity; defer to Phase 2 |
| **Auto-generated conversationId** | Backend generates if not provided; simplifies client logic |
| **Max 100 messages always** | Consistent with existing behavior; prevents localStorage bloat |
| **`summary` field format** | Map frontend `ChatRequest.message` ↔ backend `SendChatMessageDto.message` inside ChatService |

---

## 8. Audit Corrections (2026-07-06)

This section documents all issues discovered during cross-referencing the plan against the live codebase.

### Audit Methodology

Cross-referenced:
- Backend: `chat.controller.ts`, `chat.service.ts`, `chat.dto.ts` (exact response shapes, intent detection logic)
- Tenant frontend: `types/chat.types.ts`, `IConversationalAIService.ts`, `ConversationalAIService.ts`, `chatStore.ts`, `RestClient.ts`, `IApiClient.ts`, `useAIChat.ts`, `AIChatPanel.tsx`, `AIChatMessage.tsx`, `TenantShell.tsx`, `HomeHero.tsx`, `home/page.tsx` *(`/command-center/page.tsx` was also listed but deleted in FIX-021 — the chat mount moved entirely into `/home/page.tsx`)*
- Admin frontend: `types/chat.types.ts`, `chat.service.ts`, `chatStore.ts`, `ConversationPanel.tsx`, `AdminShell.tsx`

### Correction Index

| # | Severity | Issue | Original Plan | Corrected Plan | Impact |
|---|---|---|---|---|---|
| **A1** | 🔴 Critical | `ChatResponse` type included `chartType`, `chartData`, `suggestions` as top-level backend response fields | Fields appeared to come directly from backend | Clarified: these are **client-side extracted** fields populated by `ChatService` after parsing the `reply` string (JSON extractor) and inferring suggestions | Prevents missing data bugs |
| **A2** | 🔴 Critical | `ChatService.sendMessage()` called `this.apiClient.post<T>()` and destructured `response.reply` directly | `IApiClient.post()` appeared to return `T` | Added `.data!` unwrap: `IApiClient.post()` returns `ApiResponse<T>` = `{ status, data?, error?, meta }`. The actual payload is at `response.data` | Prevents `undefined` destructuring |
| **A3** | 🔴 Critical | `ChatStore` used `createStore` from `zustand/vanilla` (vanilla API) | Class-based store with manual subscription | Replaced with React `create()` from `zustand` + `persist` middleware — consistent with all 19 existing stores | Prevents non-reactive getter patterns; avoids introducing `useSyncExternalStore` |
| **A4** | 🔴 Critical | `useChat` hook read state from `chatStore.messages` (plain JS getter) | Non-reactive — React wouldn't re-render | Rewrote to use Zustand selectors: `useChatStore(s => s.messages)` | Prevents UI never updating on message change |
| **A5** | 🟡 High | `IFallbackReply` interface lacked `generateSuggestions` | Single `generate()` method only | Added `generateSuggestions(replyText: string): string[]` method | Suggestions are client-inferred, not backend-returned |
| **A6** | 🟡 High | `getSuggestions` service method implied endpoint works | `POST /api/v1/chat/suggestions` appeared functional | Noted: endpoint is a **stub** — always returns `{ suggestions: [] }`. Slash commands work client-side only | Prevents assumption of server-backed suggestions |
| **A7** | 🟡 Medium | `ChatRequest.message` vs existing `ChatRequest.query` naming mismatch | Field named `message` (matching backend) | Documented: `ChatService.sendMessage()` maps `query → message` for backward compat. New types use `message` | Prevents field naming confusion |
| **A8** | 🟡 Medium | TenantShell migration described single mount point | NewShell only mentioned | **Superseded by FIX-021:** LegacyShell was deleted; only one shell + one IconRail now exist. `ConversationPanel` is rendered exactly once. | No-op after FIX-021 |
| **A9** | 🟡 Medium | AIChatPanel page-mount migration not addressed | Plan implied shell-mount replaces everything | Documented: AIChatPanel is currently page-mounted on `/home` only (the `/command-center` page was deleted in FIX-021). HomeHero integration preserved via `pendingMessage` prop. | Prevents broken HomeHero flows |
| **A10** | 🟢 Low | HomeHero chips referenced wrong file | Implied `home/page.tsx` contains `SUGGESTION_CHIPS` | Corrected: defined in `components/home/HomeHero.tsx`. Chips fill HomeHero input; `page.tsx` `handleSend` triggers chat open | Prevents incorrect code location |
| **A11** | 🟢 Low | `_extractFirstJsonObject` and `_fallbackReply` are private methods with service coupling | Extracted without noting coupling concerns | Documented: methods reference `apiData` fields internally. Extraction requires careful interface design (`IJsonExtractor.extract(text)` is self-contained; `IFallbackReply.generate(message)` is self-contained) | Prevents incorrect extraction |
| **A12** | 🟢 Low | Admin has NO existing `core/` or `shared/` directories | Assumed existing but empty | Confirmed: both directories must be created from scratch. Effort estimate increased from 4h → 6h for Phase 4 | Prevents timeline underestimation |
| **A13** | 🟡 Medium | `summary` field mapping between frontend and backend | Not documented | Clarified: Frontend uses `ChatRequest.message` (matches `SendChatMessageDto.message`). Existing `chat.service.ts` already maps `query → message`. `ChatService.sendMessage()` handles this mapping internally | Prevents field mismatch |
| **A14** | 🟡 Medium | `tokens.total` field not in original plan's `ChatResponse` | Plan had `{ input, output }` (no `total`) | Added `total?: number` — backend returns it | Prevents lost data |
| **A15** | 🟡 Medium | `model` and `provider` response fields missing from plan | Plan's `ChatResponse` omitted them | Added `model?: string` and `provider?: string` — backend returns both | Prevents lost data (useful for "Powered by MiniMax" display) |

### Verified Correct

These plan claims were verified against the codebase and confirmed accurate:

| Claim | Verification |
|---|---|
| `RestClient` is a class implementing `IApiClient` | ✅ `export class RestClient implements IApiClient` (line 49) |
| `RestClient` uses DIP with constructor-injected `ITokenManager` + `IErrorHandler` | ✅ Constructor at lines 53-57 |
| `ChatService` backend class exists at `src/modules/chat/chat.service.ts` (296 lines) | ✅ |
| `SendChatMessageDto` accepts: `message`, `conversationId`, `systemPrompt`, `temperature`, `maxTokens`, `history`, `context` | ✅ All fields verified in DTO |
| `detectIntent()` uses keyword matching (create, add, pause, list, delete, etc.) | ✅ Exactly as described |
| Intent `'action'` routes to `OfficialAgentGraph.run()` — returns tool execution results | ✅ Lines 231-242 of chat.service.ts |
| 75+ tools registered in `StructuredToolRegistry` | ✅ Confirmed: CRUD for agents, tasks, workflows, approvals, departments, projects, billing |
| Streaming endpoints exist at `/agents/streaming/` | ✅ SSE-based session streaming |
| Both backends (tenant + admin) mount `ConversationPanel` in their shells | ✅ TenantShell (single mount since FIX-021); AdminShell line 112 |
| Both backends have independent copies of `chat.types.ts`, `chat.service.ts`, `chatStore.ts` | ✅ Confirmed: admin types have `tenantId` on ChatSuggestion, `tenant|billing` context |
| `AIChatPanel` is page-mounted on `/home` (only — `/command-center` was deleted in FIX-021) | ✅ Confirmed |
| `STARTER_PROMPTS` (5 items) in `AIChatPanel.tsx` | ✅ Verified |
| `SUGGESTION_CHIPS` (4 items) in `HomeHero.tsx` | ✅ Verified |
| `shared/hooks/`, `shared/types/`, `shared/components/` directories already exist in tenant | ✅ All exist with production code |
| `core/services/interfaces/` directory already exists in tenant | ✅ Contains 9 interface files |
| Cookie-only auth strategy (no Bearer tokens) | ✅ F1: Cookies travel via withCredentials |
| Zustand persist middleware on `chatStore.ts` (localStorage key `chat-store`) | ✅ Verified |
| `_extractFirstJsonObject` uses brace-balanced parser tracking depth and string state | ✅ Verified |
| `_fallbackReply` uses keyword-based rules (revenue, agent, task, workflow) | ✅ Verified |
