# Agent Implementation - Structured Output, Tool Calling & Streaming

## Last Updated: April 4, 2026 (Phase 2 LangChain — HITL, new tools, OpenClaw adapter)

---

## Phase 2 LangChain Implementation (April 4, 2026)

### LangGraph Human-in-the-Loop (`langgraph-official.ts`)

- **New imports**: `interrupt`, `MemorySaver`, `Command` from `@langchain/langgraph`
- **New state fields**: `requiresApproval: Annotation<boolean>`, `approvalId: Annotation<string | null>`
  — All 3 initialState objects include `requiresApproval: false, approvalId: null`
- **`humanReviewNode`**: creates `ApprovalRequest` via `approvalsService.create()`, calls `interrupt()`, handles decision
- **Checkpointer**: `MemorySaver` passed to `compile()` in `initializeGraph()`
- **`resumeGraph(threadId, decision)`**: `compiledGraph.invoke(new Command({ resume: decision }), { configurable: { thread_id: threadId } })`
- **Conditional START routing**: `requiresApprovalCheck()` routes to `planner` or `human_review`

### `AgentExecutorService` Changes

- Injected: `OpenClawGatewayService`, `ApprovalsService`
- Stream loop: detects `'__interrupt__' in chunk` → sets task to PENDING, emits `task:approval:required` WS event, returns early
- Post-stream: if `task.input.channelSource === 'openclaw'` → calls `openClawGateway.sendMessage()`
- New method: `resumeGraph(threadId, decision, approvalId, tenantId, reviewerId)` — calls `approvals.review()` then `officialGraph.resumeGraph()`

### `AgentsController` Changes

- `GraphResumeDto`: `threadId: UUID`, `approvalId: UUID`, `decision: 'APPROVED'|'REJECTED' (@IsEnum)`, `reason?: string`
- `POST :id/graph-resume` endpoint

### Tools Registry (Critical Bug Fix)

Problem: `StructuredToolRegistry.toLangChainTools()` returned empty array — tools were NestJS providers but `registry.register()` was never called.
Fix: `ToolsInitializerService implements OnModuleInit` — calls `registry.register()` for all tools in `onModuleInit()`.

### New Built-in Tools (all in `backend/src/modules/tools/built-in/`)

| Tool                       | Security Notes                                                           |
| -------------------------- | ------------------------------------------------------------------------ |
| `web-search.tool.ts`       | SSRF guard — only `google.serper.dev`; Serper API key from ConfigService |
| `database-query.tool.ts`   | SELECT-only regex; parameterized; max 100 rows                           |
| `email-send.tool.ts`       | 10/hour/tenant rate limit; Nodemailer SMTP; plain text only              |
| `agent-messaging.tool.ts`  | `targetAgent.tenantId === context.tenantId` enforced; 1000 char cap      |
| `document-summary.tool.ts` | LLMFactory `'execution'` tier; 50,000 char cap                           |

### OpenClaw Channel Adapter

- **Architecture Law**: OpenClaw is a channel adapter ONLY — never owns reasoning
- `POST /api/v1/openclaw/message` (`@Public()`) — HMAC-SHA256 via `timingSafeEqual`
- Fail-closed: if `OPENCLAW_WEBHOOK_SECRET` not set, all requests rejected (401)
- `AIGatewayModule` is `@Global()` — `OpenClawGatewayService` available everywhere

---

## Initial Implementation Date

March 22, 2026

## Overview

Implementation of immediate steps: Structured output with Zod, tool calling decorator, and SSE streaming for AI agents.

---

## Files Created

### 1. Zod Schemas for Agent Output

**File:** `backend/src/modules/agents/schemas/agent.schemas.ts`

Centralizes all LLM output schemas for type-safe parsing:

```typescript
// Core schemas
export const AgentPlanSchema = z.object({
  goal: z.string().describe("Original goal statement"),
  steps: z.array(PlanStepSchema).describe("Ordered execution steps"),
  estimatedTokens: z.number().int().positive().optional(),
  reasoning: z.string().optional(),
});

export const EvaluationResultSchema = z.object({
  isGoalMet: z.boolean(),
  qualityScore: z.number().min(0).max(1),
  feedback: z.string(),
  recommendations: z.array(z.string()).optional(),
  reasoning: z.string(),
});

export const ToolCallSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  reasoning: z.string().optional(),
  status: z.enum(["pending", "executing", "completed", "failed"]),
});

export const ReActAgentOutputSchema = z.object({
  thought: z.string().describe("Current reasoning step"),
  action: ToolCallSchema.optional(),
  observation: z.string().optional(),
  finalAnswer: z.string().optional(),
});

export const StreamingEventSchema = z.object({
  type: z.enum(["start", "step", "tool", "complete", "error"]),
  data: z.unknown(),
  timestamp: z.number(),
});
```

---

### 2. Structured Tool Interface

**File:** `backend/src/modules/tools/interfaces/structured-tool.interface.ts`

Defines the contract for structured tools with Zod validation:

```typescript
export enum ToolCategory {
  CALCULATION = "calculation",
  WEB_SEARCH = "web_search",
  DATA_PROCESSING = "data_processing",
  API_CALL = "api_call",
  FILE_SYSTEM = "file_system",
  CUSTOM = "custom",
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: string; // JSON Schema as string
  outputSchema?: string;
}

export interface ToolExecutionContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface IStructuredTool {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly inputSchema: z.ZodSchema;
  readonly outputSchema?: z.ZodSchema;

  execute(
    input: z.infer<this["inputSchema"]>,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>>;
  validate(input: unknown): { valid: boolean; errors?: string[] };
  toFunctionCall(): OpenAIFunction;
  getDefinition(): ToolDefinition;
}
```

---

### 3. Base Structured Tool Class

**File:** `backend/src/modules/tools/structured-tool.base.ts`

Abstract base class implementing IStructuredTool with common functionality:

```typescript
export abstract class BaseStructuredTool implements IStructuredTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly inputSchema: z.ZodSchema;
  abstract readonly outputSchema?: z.ZodSchema;

  abstract executeImpl(
    input: z.infer<this["inputSchema"]>,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>>;

  // Implemented methods:
  // - execute(): Validates input, calls executeImpl(), wraps result
  // - validate(): Uses Zod schema validation
  // - toFunctionCall(): Generates OpenAI function calling format
  // - getDefinition(): Returns tool definition
  // - getFieldType(): Helper for type mapping
  // - isOptional(): Helper for field optionality check
}
```

---

### 4. Structured Tool Registry

**File:** `backend/src/modules/tools/structured-tool.registry.ts`

Registry for managing and discovering structured tools with NestJS DI support:

```typescript
@Injectable()
export class StructuredToolRegistry {
  // Registration and discovery
  register(tool: IStructuredTool): void;
  unregister(name: string): boolean;
  get(name: string): IStructuredTool | undefined;
  getAll(): IStructuredTool[];
  getByCategory(category: ToolCategory): IStructuredTool[];

  // OpenAI function calling
  getFunctionDefinitions(): OpenAIFunction[];
  getToolDefinitions(): ToolDefinition[];

  // Execution with validation
  execute<T>(toolName: string, input: unknown, context?: Context): Promise<T>;
}
```

---

### 5. Enhanced Calculator Tool

**File:** `backend/src/modules/tools/built-in/calculator-enhanced.tool.ts`

Demonstrates the @Tool decorator pattern with full Zod validation:

```typescript
export const CalculatorInputSchema = z.object({
  expression: z
    .string()
    .describe('Mathematical expression (e.g., "2 + 2", "sqrt(16)")'),
  precision: z.number().int().min(0).max(15).default(6).optional(),
});

export const CalculatorOutputSchema = z.object({
  result: z.number(),
  expression: z.string(),
  precision: z.number(),
  formatted: z.string(),
});

@Injectable()
export class CalculatorEnhancedTool extends BaseStructuredTool {
  readonly name = "calculator";
  readonly description = "Evaluate mathematical expressions...";
  readonly category = ToolCategory.CALCULATION;
  readonly inputSchema = CalculatorInputSchema;
  readonly outputSchema = CalculatorOutputSchema;

  protected async executeImpl(
    input: CalculatorInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<CalculatorOutput>> {
    // Implementation with validation and structured output
  }
}
```

---

### 6. Agent Streaming Service

**File:** `backend/src/modules/agents/streaming/agent-streaming.service.ts`

RxJS Observable-based service for real-time agent execution updates:

```typescript
export enum StreamingEventType {
  CONNECTED = "connected",
  START = "start",
  STEP_START = "step_start",
  STEP_COMPLETE = "step_complete",
  STEP_ERROR = "step_error",
  TOOL_CALL = "tool_call",
  TOOL_RESULT = "tool_result",
  THINKING = "thinking",
  COMPLETE = "complete",
  HEARTBEAT = "heartbeat",
}

@Injectable()
export class AgentStreamingService {
  createSession(options: StreamOptions): string;
  getStream(sessionId: string): Observable<AgentStreamingEvent> | null;

  // Event emission methods
  emitStart(sessionId: string, taskId: string): void;
  emitStepStart(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: Step,
  ): void;
  emitStepComplete(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: Step,
    result?: unknown,
  ): void;
  emitStepError(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: Step,
    error: string,
  ): void;
  emitToolCall(
    sessionId: string,
    taskId: string,
    toolName: string,
    toolInput: unknown,
  ): void;
  emitToolResult(
    sessionId: string,
    taskId: string,
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    durationMs?: number,
  ): void;
  emitThinking(sessionId: string, taskId: string, reasoning: string): void;
  emitComplete(sessionId: string, taskId: string, result?: unknown): void;

  // Session management
  cancelSession(sessionId: string): void;
  closeSession(sessionId: string): void;
  getActiveSessions(): StreamingConnection[];
}
```

---

### 7. Agent Streaming Controller

**File:** `backend/src/modules/agents/streaming/agent-streaming.controller.ts`

SSE endpoint for real-time streaming:

```typescript
@Controller('api/v1/agents/streaming')
export class AgentStreamingController {
  // Create streaming session
  @Post('sessions')
  createSession(@Query('taskId') taskId: string, ...): { sessionId: string; url: string };

  // SSE events endpoint
  @Get('sessions/:sessionId/events')
  getEvents(@Param('sessionId') sessionId: string, @Res() res: Response): void;

  // Execute with streaming
  @Post('sessions/:sessionId/execute')
  executeWithStreaming(@Param('sessionId') sessionId: string, @Query('goal') goal: string, ...): { taskId: string; status: string };

  // Session management
  @Delete('sessions/:sessionId')
  cancelSession(@Param('sessionId') sessionId: string): void;

  @Get('sessions/:sessionId')
  getSessionStatus(@Param('sessionId') sessionId: string): SessionStatus;

  @Get('sessions')
  listSessions(): { sessions: SessionInfo[] };

  @Get('tools')
  listTools(): { tools: ToolInfo[] };
}
```

---

## Implementation Status

### Completed ✅

1. ✅ Zod schemas for structured output
2. ✅ IStructuredTool interface with @Tool decorator pattern
3. ✅ BaseStructuredTool abstract class
4. ✅ StructuredToolRegistry service
5. ✅ CalculatorEnhancedTool (example implementation)
6. ✅ AgentStreamingService (RxJS Observable-based)
7. ✅ AgentStreamingController (SSE endpoints)

### Pending 📋

- [ ] Register tools module with NestJS DI
- [ ] Create enhanced HttpRequestTool
- [ ] Update AgentPlannerService to use structured output
- [ ] Update AgentEvaluatorService to use structured output
- [ ] Add tools to module exports
- [ ] Write unit tests

---

## Usage Examples

### SSE Client (Frontend)

```javascript
const sessionId = "session_123";
const eventSource = new EventSource(
  `/api/v1/agents/streaming/sessions/${sessionId}/events`,
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "step_start":
      console.log(`Starting step ${data.stepIndex + 1}/${data.stepCount}`);
      break;
    case "tool_call":
      console.log(`Calling tool: ${data.tool.name}`);
      break;
    case "complete":
      console.log("Execution complete:", data.data);
      eventSource.close();
      break;
  }
};
```

### Using Structured Tool Registry

```typescript
const registry = new StructuredToolRegistry();
registry.register(new CalculatorEnhancedTool());

const tools = registry.getFunctionDefinitions();
// [{ type: 'function', function: { name: 'calculator', ... } }]

const result = await registry.execute("calculator", {
  expression: "2 + 2",
  precision: 4,
});
```

### Structured Output Parsing

```typescript
import {
  AgentPlanSchema,
  ReActAgentOutputSchema,
} from "./schemas/agent.schemas";

const llm = new ChatOpenAI({ model: "gpt-4" });
const prompt = new PromptTemplate({
  template: "{goal}",
  inputVariables: ["goal"],
});

const chain = prompt.pipe(llm.withStructuredOutput(AgentPlanSchema));
const plan = await chain.invoke({ goal: "Plan my day" });
// plan is typed as { goal: string, steps: PlanStep[], ... }
```

---

## Next Steps (Implementation Order)

1. **Register Tools Module** ✅
   - Add StructuredToolRegistry to module providers ✅
   - Export tools module from agents module ✅

2. **Create HttpRequestEnhancedTool** ✅
   - Similar pattern to CalculatorEnhancedTool ✅
   - Support for REST API calls with Zod validation ✅

3. **Update AgentPlannerService** ✅
   - Use AgentPlanSchema for structured output ✅
   - Add withStructuredOutput from LangChain ✅

4. **Update AgentEvaluatorService** ✅
   - Use EvaluationResultSchema for structured output ✅
   - Add streaming for evaluation progress ✅

5. **Frontend Integration** ✅
   - Create SSE client service ✅
   - Add real-time execution UI components ✅

6. **LangGraph StateGraph** ✅ (HIGH PRIORITY - COMPLETED)
   - Replace linear execution with state machine ✅
   - Implement nodes: planner, executor, tool_node, evaluator, finish ✅
   - Conditional edge routing ✅
   - Streaming integration ✅

---

## LangGraph StateGraph Implementation (Completed)

**Date:** March 22, 2026

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentStateMachine                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌───────────┐           │
│   │ planner  │───▶│ executor │───▶│ tool_node │           │
│   └──────────┘    └──────────┘    └───────────┘           │
│        │               │                  │                  │
│        │               │                  ▼                  │
│        │               │          ┌───────────┐             │
│        │               │          │ evaluator │             │
│        │               │          └───────────┘             │
│        │               │                │                   │
│        │               ◀────────────────┘                   │
│        │                 (if more steps)                    │
│        │                                                  │
│        └──────────────────▶┌──────────┐                   │
│              (if done)      │  finish  │                   │
│                           └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Files Created

**File:** `backend/src/modules/agents/langgraph/agent.state.ts`

Core state definitions:

```typescript
export interface AgentState {
  goal: string;
  agentId: string;
  tenantId: string;
  userId?: string;
  plan?: { steps: Step[]; currentStepIndex: number };
  steps: StepResult[];
  currentStep?: Step;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  evaluation?: Evaluation;
  messages: Message[];
  iterations: number;
  maxIterations: number;
  error: string | null;
  shouldContinue: boolean;
  currentNode: AgentNode;
}

export type AgentNode =
  | "planner"
  | "executor"
  | "tool_node"
  | "evaluator"
  | "finish";
```

**File:** `backend/src/modules/agents/langgraph/agent-state-machine.ts`

State machine implementation:

```typescript
@Injectable()
export class AgentStateMachine {
  async run(params: {
    goal: string;
    agentId: string;
    tenantId: string;
    userId?: string;
    maxIterations?: number;
    sessionId?: string;
    onStateChange?: StateChangeCallback;
  }): Promise<AgentState>;
}
```

### Usage

```typescript
const stateMachine = new AgentStateMachine(
  config,
  streamingService,
  toolRegistry,
);
const finalState = await stateMachine.run({
  goal: "Calculate revenue for Q1",
  agentId: "agent-123",
  tenantId: "tenant-456",
  sessionId: "session-789",
  maxIterations: 10,
});
```

### Node Functions

1. **plannerNode**: Creates plan using LLM with structured output
2. **executorNode**: Executes current step (LLM reasoning or passes to tool_node)
3. **toolNode**: Executes tool via StructuredToolRegistry
4. **evaluatorNode**: Evaluates execution quality with LLM or heuristic fallback

### Conditional Routing

```typescript
private route(state: AgentState, currentNode: AgentNode): AgentNode {
  switch (currentNode) {
    case 'planner':
      return state.plan?.steps.length > 0 ? 'executor' : 'finish';
    case 'executor':
      return isToolCall(state) ? 'tool_node' : 'evaluator';
    case 'tool_node':
      return 'evaluator';
    case 'evaluator':
      if (evaluationPassed(state)) {
        return hasMoreSteps(state) ? 'executor' : 'finish';
      }
      return state.evaluation?.shouldRetry ? 'executor' : 'finish';
    default:
      return 'finish';
  }
}
```

---

## Notes

- All tools use Zod for input/output validation
- Streaming uses SSE (Server-Sent Events) for cross-platform support
- Tool registry follows Singleton pattern via NestJS DI
- Structured output uses LangChain's `withStructuredOutput()` method
- Error handling is consistent across all components

## Official LangGraph Implementation (March 23, 2026)

**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts`

Uses official `@langchain/langgraph` StateGraph API:

```typescript
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';

// State definition using Annotation.Root
const AgentStateAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  agentId: Annotation<string>(),
  // ... more fields with reducers and defaults
});

// Graph with nodes: planner, executor, tool_node, evaluator
const workflow = new StateGraph(AgentStateAnnotation);
workflow.addNode('planner', plannerNode);
workflow.addEdge(START, 'planner');
workflow.addConditionalEdges('planner', shouldExecuteTool, {...});
```

- `Annotation.Root({...})` creates state schema
- `Annotation<T>({ reducer, default })` for complex fields
- `Annotation<T>()` for simple LastValue channels
- Uses `as any` assertions for complex LangGraph generics
