# LangChain Ecosystem Audit — NeureCore

**Date:** April 4, 2026
**Branch:** `tenant-base`
**Author:** GitHub Copilot (automated audit)

---

## Installed Packages vs. Actual Usage

| Package                | Version     | Actually Used?                                                                     |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `@langchain/core`      | `^0.3.x`    | ✅ Yes — `ChatPromptTemplate`                                                      |
| `@langchain/openai`    | `^0.3.x`    | ✅ Yes — `ChatOpenAI`                                                              |
| `@langchain/langgraph` | `1.2.5`     | ⚠️ Partially — `StateGraph` wired but version mismatch causes `as any` workarounds |
| `langsmith`            | `0.5.12`    | ❌ SDK not called — custom stub wrapper only                                       |
| `openclaw`             | `2026.3.13` | ❌ No real npm package; custom HTTP stub, dead path                                |
| `clawhub`              | `0.9.0`     | ❌ Not wired anywhere in the codebase                                              |

---

## All Processes That Touch LangChain

### 1. `AgentPlannerService` → `buildLlmPlan()`

**File:** `backend/src/modules/agents/services/agent-planner.service.ts`
**Trigger:** `POST /agents/:id/tasks` → `AgentExecutorService.executeTask()` → planning phase

- Uses `ChatOpenAI` (`gpt-4o-mini`, temp `0.2`, maxTokens `1024`)
- Uses `ChatPromptTemplate.fromMessages([system, human])`
- Uses `llm.withStructuredOutput(zodSchema)` — returns typed `AgentPlan` with ordered steps
- Chain: `prompt.pipe(structuredLlm).invoke({ goal, tools, constraints })`
- Dynamic import (`await import(...)`) — LangChain loaded only when `OPENAI_API_KEY` is set
- **Falls back to stub plan** when no API key is configured

### 2. `AgentEvaluatorService` → `llmEvaluate()`

**File:** `backend/src/modules/agents/services/agent-evaluator.service.ts`
**Trigger:** Called after every task execution step by `AgentExecutorService`

- Same pattern: `ChatOpenAI` (`gpt-4o-mini`, temp `0`) + `ChatPromptTemplate` + `withStructuredOutput(evaluationSchema)`
- Returns `{ score: 0-1, success: bool, reflection: string, suggestions: string[], shouldRetry: bool }`
- **Falls back to heuristic scoring** (step success rate calculation) without an API key

### 3. `OfficialAgentGraph` — LangGraph `StateGraph`

**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts`
**Trigger:** Injected into `AgentExecutorService`; called via `officialGraph.run()`

The only place `@langchain/langgraph` is actively consumed. Builds a `StateGraph` with `Annotation.Root` schema defining full agent state:

```
START → planner → executor → tool_node → evaluator → END
              ↓ (conditional: no steps)
             END
```

State channels: `goal`, `agentId`, `tenantId`, `plan`, `steps[]`, `currentStep`, `toolCalls[]`, `toolResults[]`, `evaluation`, `messages[]`, `iteration`, `shouldContinue`, `error`

Each node is a bound method on the `OfficialAgentGraph` class. Conditional edge after `planner` routes to `END` if the plan has no steps, otherwise proceeds to `executor`.

### 4. `AgentStateMachine` — Custom Hand-Rolled Graph (Legacy)

**File:** `backend/src/modules/agents/langgraph/agent-state-machine.ts`
**Status:** Likely dead code — superseded by `OfficialAgentGraph`

Hand-rolled graph runner built before the LangGraph integration. Loops with `while (shouldContinue(state))`, dispatches to node functions manually. Shares `AgentStreamingService` and `StructuredToolRegistry`. No LangChain imports — pure custom TypeScript.

### 5. `AgentCheckpointService` — Redis State Persistence

**File:** `backend/src/modules/agents/langgraph/checkpoint.service.ts`
**Trigger:** Injected into `OfficialAgentGraph`; called before/after each graph run

Serialises full `AgentState` as JSON to Redis keyed by `agent:checkpoint:{threadId}`. TTL default 24h. Enables pause/resume and multi-turn conversation memory. Does **not** use LangChain checkpoint primitives — custom Redis wrapper.

### 6. `StructuredToolRegistry` + `BaseStructuredTool` — Tool Execution

**Files:** `backend/src/modules/tools/structured-tool.registry.ts`, `structured-tool.base.ts`
**Trigger:** Injected into `OfficialAgentGraph`; dispatched during the `tool_node` graph step

LangChain-compatible interface by contract, but **not** wired as a LangGraph `ToolNode`. Tools extend `BaseStructuredTool` with Zod `inputSchema`/`outputSchema`. Registry manages DI lookup by tool name. Tool dispatch is `registry.get(name).execute(input)` — synchronous dispatch, no parallel execution.

### 7. `LangSmithTracingService` — Observability Stub

**File:** `backend/src/modules/ai-gateway/langsmith-tracing.service.ts`
**Status:** No-op in production — `LANGSMITH_TRACING_ENABLED=false` by default

Custom in-process span buffer (`Map<string, Span>`). Does **not** call the installed `langsmith` SDK. Flushes buffered spans to a logger. Injected into `OpenClawGatewayService` only (not into planner/evaluator where LLM calls happen).

### 8. `LLMFactory` / `ModelRoutingService` — Multi-Provider Routing

**Files:** `backend/src/modules/models/services/llm-factory.service.ts`, `model-routing.service.ts`
**Status:** Built but bypassed by the core AI services

Supports MiniMax, DeepSeek, MiMo, OpenAI with cost-aware routing (`planning` → DeepSeek, `conversation` → MiniMax, etc.). **Neither `AgentPlannerService` nor `AgentEvaluatorService` use it.** Both services import `ChatOpenAI` directly, making the factory dead code for core operations.

---

## Problems Identified

| #   | Issue                                                                                                                                                | Severity      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | `@langchain/langgraph@1.2.5` requires `@langchain/core@^1.1.16` but project has `^0.3.x` — `as any` casts in `langgraph-official.ts` are the symptom | 🔴 High       |
| 2   | `AgentStateMachine` (custom) and `OfficialAgentGraph` (LangGraph) both exist and are both wired in the module — unclear which runs for a given task  | 🔴 High       |
| 3   | `LLMFactory` (multi-provider routing) is never called by planner or evaluator — always hits OpenAI regardless of `LLM_PROVIDER` env var              | 🟡 Medium     |
| 4   | `LangSmithTracingService` is a no-op — LangChain calls produce no traces, no cost/latency visibility                                                 | 🟡 Medium     |
| 5   | `StructuredToolRegistry` not wired as a LangGraph `ToolNode` — no parallel tool execution, no message history integration                            | 🟡 Medium     |
| 6   | `MemoryService` stores embeddings as JSON strings; vector similarity search is TODO — falls back to keyword match only                               | 🟡 Medium     |
| 7   | `OpenClawGatewayService` injects `OPENCLAW_CONFIG` token — will cause DI error at runtime if token is not provided                                   | 🟠 Medium-Low |
| 8   | `clawhub` package installed but not referenced anywhere in `src/`                                                                                    | 🟢 Low        |

---

## Optimisation Suggestions

### 1. Resolve `@langchain/core` version mismatch (Priority: Immediate)

Upgrade `@langchain/core` from `^0.3.x` to `^1.x`. This is a prerequisite for all LangGraph features to work reliably. The `as any` type casts in `langgraph-official.ts` exist only because of this mismatch.

```bash
cd backend && pnpm add @langchain/core@^1.1.16 @langchain/openai@^0.4 @langchain/langgraph@^1.2.5
```

### 2. Remove `AgentStateMachine` (Priority: High)

`OfficialAgentGraph` supersedes the custom state machine entirely. Delete `agent-state-machine.ts` and remove its exports from `langgraph/index.ts`. One execution path is easier to reason about, test, and trace.

### 3. Wire `LLMFactory` into `AgentPlannerService` and `AgentEvaluatorService` (Priority: High)

Both services bypass `LLMFactory` and hard-code `ChatOpenAI`. Routing them through `LLMFactory.createClient(taskType)` would make the MiniMax/DeepSeek config actually work, reducing costs significantly for non-reasoning tasks.

```
planning → DeepSeek (reasoning)
evaluation → DeepSeek (reasoning)
execution → MiniMax (balanced, cheaper)
conversation → MiniMax (fast, cheapest)
```

### 4. Replace `LangSmithTracingService` stub with the real SDK (Priority: Medium)

The `langsmith` package is already installed. Wrap the `prompt.pipe(structuredLlm).invoke(...)` calls in `AgentPlannerService` and `AgentEvaluatorService` with `traceable()`. Setting `LANGCHAIN_TRACING_V2=true` + `LANGSMITH_API_KEY` would then give full token cost, latency, and failure visibility.

### 5. Migrate `StructuredToolRegistry` to LangGraph `ToolNode` (Priority: Medium)

LangGraph's `ToolNode` handles tool dispatch, error wrapping, and appending results to the message history correctly. `BaseStructuredTool` is already interface-compatible — expose tools as `DynamicStructuredTool` instances to unlock parallel tool execution and proper react-style loops.

### 6. Implement pgvector similarity in `MemoryService` (Priority: Medium)

The `embedding` column exists in the Prisma schema. Generating embeddings via `text-embedding-3-small` (OpenAI) and storing as a proper `vector` column enables cosine-similarity retrieval (`<->` operator). This directly improves the quality of `messages[]` context fed into the LangGraph state.

### 7. Remove or stub-proof OpenClaw/clawhub (Priority: Low)

Either register the `OPENCLAW_CONFIG` token with a default value in `ai-gateway.module.ts` (so no DI error on start) or remove the module. It adds a hard DI dependency on a service that has no real backing implementation.

---

_Generated by GitHub Copilot — audit of branch `tenant-base` as of April 4, 2026_
