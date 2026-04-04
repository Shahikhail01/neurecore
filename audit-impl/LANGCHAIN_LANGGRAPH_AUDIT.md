# LangChain, LangGraph, LangSmith & OpenClaw - Implementation Audit

**Date:** March 23, 2026
**Status:** In Progress - MiniMax Integration Complete

---

## Executive Summary

This document audits the current state of LangChain ecosystem utilization and provides a comprehensive task list for full implementation.

### Current Package Status

| Package                | Status       | Currently Installed     |
| ---------------------- | ------------ | ----------------------- |
| `langchain`            | ✅ In Use    | ✅ `^0.3.0`             |
| `@langchain/core`      | ✅ In Use    | ✅ `^0.3.0`             |
| `@langchain/openai`    | ✅ In Use    | ✅ `^0.3.0`             |
| `@langchain/langgraph` | ✅ Installed | ✅ `1.2.5` ⚠️           |
| `langsmith`            | ✅ Installed | ✅ `0.5.12`             |
| `openclaw`             | ✅ Installed | ✅ `2026.3.13`          |
| `clawhub`              | ✅ Installed | ✅ `0.9.0` (for skills) |

> ⚠️ **Note:** `@langchain/langgraph` requires `@langchain/core@^1.1.16` but project has `0.3.80`. Consider upgrading `@langchain/core` or use custom state machine for now.
>
> **OpenClaw:** Multi-channel AI gateway with extensible messaging integrations. Enables employees (AI Agents) to communicate and access resources.

### ✅ Recently Completed

| Feature              | Status  | Files                                                                            |
| -------------------- | ------- | -------------------------------------------------------------------------------- |
| MiniMax Integration  | ✅ DONE | `llm-factory.service.ts`, `minimax-client.service.ts`, `llm-client.interface.ts` |
| ModelsModule Update  | ✅ DONE | Added LLMFactory, MiniMaxClient providers                                        |
| Agent Module Update  | ✅ DONE | Added ModelsModule import                                                        |
| Package Installation | ✅ DONE | `@langchain/langgraph` 1.2.5, `langsmith` 0.5.12, `openclaw` 2026.3.13 installed |

---

## PART 1: PACKAGE INSTALLATION (IMMEDIATE)

### 1.1 Required npm Packages

```bash
cd backend

# LangGraph (official state machine package)
pnpm add @langchain/langgraph

# LangSmith for observability
pnpm add @langchain/langsmith
```

### 1.2 Tasks

- [x] Install `@langchain/langgraph` package (installed 1.2.5)
- [x] Install `langsmith` package (installed 0.5.12)
- [x] Install `openclaw` package (installed 2026.3.13)
- [x] Install `clawhub` package (installed 0.9.0)
- [ ] ⚠️ Resolve `@langchain/core` version mismatch (need 0.3.80 → 1.1.16+ for full LangGraph support)
- [ ] Update agents to use `LLMFactory` instead of direct `ChatOpenAI`
- [ ] Add LangSmith tracing initialization
- [ ] Integrate OpenClaw for AI agent communication & resource access

---

## PART 2: CURRENT LANGCHAIN USAGE AUDIT

### 2.1 Already Implemented

| Component            | File                                                     | Features Used           | Status    |
| -------------------- | -------------------------------------------------------- | ----------------------- | --------- |
| ChatOpenAI           | `backend/src/modules/agents/services/*.ts`               | Basic LLM calls         | ✅ In Use |
| ChatPromptTemplate   | Various                                                  | Prompt chaining         | ✅ In Use |
| withStructuredOutput | `agent-planner.service.ts`, `agent-evaluator.service.ts` | Zod schema output       | ✅ In Use |
| Zod Schemas          | `agent.schemas.ts`                                       | Input/output validation | ✅ In Use |
| **MiniMax Client**   | `models/services/minimax-client.service.ts`              | OpenAI-compatible API   | ✅ DONE   |
| **LLM Factory**      | `models/services/llm-factory.service.ts`                 | Provider selection      | ✅ DONE   |
| **LLM Interface**    | `models/interfaces/llm-client.interface.ts`              | Type definitions        | ✅ DONE   |

### 2.2 Custom Implementation (LangGraph-style)

| Component            | File                                   | Note                            | Status     |
| -------------------- | -------------------------------------- | ------------------------------- | ---------- |
| Custom State Machine | `langgraph/agent-state-machine.ts`     | LangGraph-style without package | ✅ Working |
| State Definition     | `langgraph/agent.state.ts`             | AgentState interface            | ✅ Working |
| Streaming Service    | `streaming/agent-streaming.service.ts` | SSE, RxJS                       | ✅ Working |

---

## PART 3: LANGGRAPH MIGRATION TASKS

### 3.1 Phase 1: Package Integration (HIGH PRIORITY)

- [ ] **Install @langchain/langgraph**
- [ ] **Migrate custom AgentStateMachine to official LangGraph StateGraph**
- [ ] Update imports from custom implementation to `@langchain/langgraph`
- [ ] Test state machine with official LangGraph primitives

### 3.2 Phase 2: State Graph Enhancement

- [ ] Implement official LangGraph checkpoints for memory
- [ ] Add interrupt support for human-in-the-loop
- [ ] Configure conditional edges using official API
- [ ] Add node retry policies

### 3.3 Phase 3: Tool Integration

- [ ] Migrate custom `StructuredToolRegistry` to LangGraph ToolNode
- [ ] Implement `@tool` decorator pattern
- [ ] Add tool choice forcing
- [ ] Implement parallel tool execution

---

## PART 4: LANGSMITH INTEGRATION TASKS

### 4.1 Setup (HIGH PRIORITY)

- [ ] Install `@langchain/langsmith`
- [ ] Configure LangSmith API key in environment
- [ ] Set up LangSmith tracing service
- [ ] Add tracing to AgentPlannerService
- [ ] Add tracing to AgentEvaluatorService
- [ ] Add tracing to AgentExecutorService
- [ ] Add tracing to tool executions

### 4.2 Advanced LangSmith Features

- [ ] Implement custom run metadata
- [ ] Add cost tracking per run
- [ ] Set up feedback collection
- [ ] Create LangSmith dataset from historical runs
- [ ] Implement prompt versioning

---

## PART 5: OPENCLAW INVESTIGATION

### 5.1 Research Tasks

- [x] Verify OpenClaw package exists on npm - **No npm package exists**
- [ ] ~~Read OpenClaw documentation~~ - Not applicable
- [ ] ~~Identify relevant features for our architecture~~ - Not applicable
- [ ] ~~Create integration plan if applicable~~ - Not applicable

### 5.2 Conclusion

**OpenClaw does not have an npm package.** If OpenClaw is a custom/internal tool, it would need to be implemented separately. For API management features (auth, rate limiting, gateway), consider using existing solutions like:

- Kong Gateway
- AWS API Gateway
- Custom middleware in NestJS

**Remove from future tasks.**

---

## PART 6: COMPREHENSIVE TASK LIST

### Immediate (This Week)

| Task                                     | Priority | Estimated Time | Status  |
| ---------------------------------------- | -------- | -------------- | ------- |
| Install @langchain/langgraph             | HIGH     | 15 min         | Pending |
| Install @langchain/langsmith             | HIGH     | 15 min         | Pending |
| Investigate OpenClaw package             | MEDIUM   | 30 min         | Pending |
| Migrate to official LangGraph StateGraph | HIGH     | 4-6 hrs        | Pending |
| Add basic LangSmith tracing              | HIGH     | 2-3 hrs        | Pending |

### Short-term (2-3 weeks)

| Task                                | Priority | Estimated Time | Status  |
| ----------------------------------- | -------- | -------------- | ------- |
| Implement LangGraph checkpoints     | HIGH     | 4 hrs          | Pending |
| Add tool choice forcing             | HIGH     | 3 hrs          | Pending |
| Human-in-the-loop interrupts        | MEDIUM   | 6 hrs          | Pending |
| LangSmith feedback collection       | MEDIUM   | 4 hrs          | Pending |
| Cost tracking per run               | MEDIUM   | 3 hrs          | Pending |
| OpenClaw integration (if available) | LOW      | TBD            | Pending |

### Medium-term (3-4 weeks)

| Task                         | Priority | Estimated Time | Status  |
| ---------------------------- | -------- | -------------- | ------- |
| Multi-agent patterns         | HIGH     | 8 hrs          | Pending |
| Full RAG pipeline            | HIGH     | 8 hrs          | Pending |
| LangSmith dataset creation   | MEDIUM   | 4 hrs          | Pending |
| Advanced tool error handling | MEDIUM   | 6 hrs          | Pending |
| Prompt versioning            | MEDIUM   | 4 hrs          | Pending |

---

## PART 7: FILE MODIFICATIONS NEEDED

### Files to Update for LangGraph Migration

```
backend/src/modules/agents/langgraph/
├── agent-state-machine.ts     [REWRITE - use official StateGraph]
├── agent.state.ts             [KEEP - may need adjustments]
└── index.ts                   [UPDATE exports]
```

### Files to Update for LangSmith

```
backend/src/modules/agents/
├── langgraph/agent-state-machine.ts  [ADD tracing]
├── services/agent-planner.service.ts     [ADD tracing]
├── services/agent-evaluator.service.ts   [ADD tracing]
└── services/agent-executor.service.ts    [ADD tracing]
```

### Environment Variables Needed

```env
# LLM Provider Selection (set 'minimax' to use MiniMax by default)
LLM_PROVIDER=minimax

# MiniMax API (required if LLM_PROVIDER=minimax)
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_MODEL=MiniMax-Text-01

# OpenAI (fallback when MINIMAX_API_KEY not set)
OPENAI_API_KEY=sk-...

# LangSmith (for observability)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-api-key
LANGSMITH_PROJECT=neurecore-agents

# LangGraph Checkpointing (optional, for state persistence)
LANGGRAPH_REDIS_URL=redis://localhost:6379
```

---

## PART 8: TESTING TASKS

- [ ] Write unit tests for state machine nodes
- [ ] Write integration tests for LangGraph flow
- [ ] Test LangSmith trace visibility
- [ ] Test checkpoint/restore functionality
- [ ] Test tool error recovery
- [ ] Test human-in-the-loop interrupts

---

## Notes

- LangGraph official package uses `@langchain/langgraph` (not `langgraph`)
- LangSmith is now part of LangChain ecosystem via `@langchain/langsmith`
- OpenClaw may not be an npm package - may need custom implementation
- Current custom state machine works but should migrate to official for long-term support
