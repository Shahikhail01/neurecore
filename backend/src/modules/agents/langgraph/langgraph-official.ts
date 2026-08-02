/**
 * Official LangGraph StateGraph Implementation
 *
 * Migrated from custom state machine to @langchain/langgraph
 * Uses official StateGraph API for production-ready agent execution
 *
 * Key API notes:
 * - Annotation is a function: Annotation<string>(), Annotation<string>({ reducer, default })
 * - Annotation.Root({ ... }) creates the state schema
 * - StateGraph accepts the annotation directly: new StateGraph(AgentStateAnnotation)
 * - Node names must be typed as constants to avoid TypeScript errors with addEdge/addConditionalEdges
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentState, StepResult, ToolCall } from './agent.state';
import { AgentStreamingService } from '../streaming/agent-streaming.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { StreamingEventType } from '../streaming/agent-streaming.service';
import { AgentCheckpointService } from './checkpoint.service';
import { SecurityInterceptorService } from '../security/security-interceptor.service';
import type { ISecurityContext } from '../security/interfaces/security.interfaces';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { LLMFactory } from '../../models/services/llm-factory.service';
import { ResponseEnvelopeBuilder } from '../../chat/responses/builders/response-envelope.builder';
import type { IResponseEnvelope } from '../../chat/responses/interfaces/response-envelope.interface';

// Node name constants to satisfy TypeScript
const PLANNER_NODE = 'planner';
const EXECUTOR_NODE = 'executor';
const TOOL_NODE = 'tool_node';
const EVALUATOR_NODE = 'evaluator';

/**
 * LangGraph State Schema - defines the state structure for the graph
 *
 * Using Annotation.Root to define composite state with multiple channels
 */
const AgentStateAnnotation = Annotation.Root({
  // Core fields
  goal: Annotation<string>(),
  agentId: Annotation<string>(),
  tenantId: Annotation<string>(),
  userId: Annotation<string>(),

  // Plan fields
  plan: Annotation<{
    steps: Array<{
      id: string;
      description: string;
      toolId: string | null;
      input: Record<string, unknown>;
      dependsOn: string[];
    }>;
    currentStepIndex: number;
  } | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Execution fields
  steps: Annotation<StepResult[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  currentStep: Annotation<{
    id: string;
    description: string;
    toolId: string | null;
    input: Record<string, unknown>;
  } | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Tool execution — toolCalls is the CURRENT batch the planner emitted;
  // overwrite (not append) so toolNode doesn't re-run the same calls on every loop.
  toolCalls: Annotation<ToolCall[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),

  toolResults: Annotation<
    Array<{
      toolName: string;
      input: unknown;
      output: unknown;
      error?: string;
      durationMs: number;
    }>
  >({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  // Allowed-tools whitelist (DIP: enforced by the graph, not just by callers).
  // `null` / `undefined` ⇒ no restriction (legacy chat path).
  // `[]` (empty array) ⇒ no tools allowed (Hermes deny-all).
  // Non-empty ⇒ only these tool names may be exposed to the LLM and executed.
  allowedTools: Annotation<string[] | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),

  // Phase 2 — service-gateway-v2 deterministic routing.
  // `forcedCapability` is the canonical capability the chat orchestrator
  // pre-classified; the service-gateway tool uses it to override whatever
  // the LLM named. `route` carries the full decision for SSE metadata.
  forcedCapability: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  route: Annotation<Record<string, unknown> | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),

  // Evaluation
  evaluation: Annotation<{
    score: number;
    success: boolean;
    reflection: string;
    suggestions: string[];
    shouldRetry: boolean;
  } | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Memory / Messages
  messages: Annotation<
    Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: number;
    }>
  >({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  // Control fields
  currentNode: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => PLANNER_NODE,
  }),

  iteration: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),

  maxIterations: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 10,
  }),

  error: Annotation<string | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  shouldContinue: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => true,
  }),

  model: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  // Response envelope (Phase 9 — Service Gateway + Response Envelope).
  // toolNode populates this on a single-tool success so chat-sse.service
  // can ship `{ text, envelope }` to the frontend. Multi-tool runs fall
  // back to the legacy "executed N tool(s)" rendering (see plan §3.5).
  envelope: Annotation<IResponseEnvelope | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
});

type AgentGraphState = typeof AgentStateAnnotation.State;

/**
 * Node function types for LangGraph
 */
type AgentNodeFunction = (
  state: AgentGraphState,
) => Partial<AgentGraphState> | Promise<Partial<AgentGraphState>>;

/**
 * Official LangGraph-based Agent Executor with Checkpoint Support
 */
@Injectable()
export class OfficialAgentGraph {
  private readonly logger = new Logger(OfficialAgentGraph.name);
  private compiledGraph: Awaited<
    ReturnType<ReturnType<typeof this.buildGraph>['compile']>
  > | null = null;

  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly config: ConfigService,
    private readonly streamingService: AgentStreamingService,
    private readonly toolRegistry: StructuredToolRegistry,
    private readonly checkpointService: AgentCheckpointService,
    private readonly securityInterceptor: SecurityInterceptorService,
    private readonly featureFlags: FeatureFlagService,
    @Optional() private readonly legacyFactory?: LLMFactory,
    @Optional()
    private readonly envelopeBuilder?: ResponseEnvelopeBuilder,
  ) {
    this.initializeGraph();
  }

  /**
   * Initialize the LangGraph graph
   */

  private buildGraph() {
    // Define the workflow graph with proper typing
    const workflow = new StateGraph(AgentStateAnnotation);

    // Add nodes
    workflow.addNode(PLANNER_NODE, this.plannerNode.bind(this));
    workflow.addNode(EXECUTOR_NODE, this.executorNode.bind(this));
    workflow.addNode(TOOL_NODE, this.toolNode.bind(this));
    workflow.addNode(EVALUATOR_NODE, this.evaluatorNode.bind(this));

    // Set entry point
    // Note: TypeScript has issues with the complex generics here, using type assertions
    workflow.addEdge(START, PLANNER_NODE as any);
    workflow.addEdge(EXECUTOR_NODE as any, TOOL_NODE as any);
    workflow.addEdge(TOOL_NODE as any, EVALUATOR_NODE as any);

    // Conditional routing after planner.
    // shouldExecuteTool returns: 'executor' (if planner set tool calls) or 'end'.
    // pathMap values must match the Node constants.
    workflow.addConditionalEdges(
      PLANNER_NODE as any,
      this.shouldExecuteTool.bind(this),
      {
        executor: EXECUTOR_NODE,
        end: END,
      } as any,
    );

    // Conditional routing after evaluator.
    // shouldContinue returns: 'executor' (when toolCalls remained) or 'end'.
    workflow.addConditionalEdges(
      EVALUATOR_NODE as any,
      this.shouldContinue.bind(this),
      {
        executor: EXECUTOR_NODE,
        end: END,
      } as any,
    );

    return workflow;
  }

  private initializeGraph() {
    try {
      const workflow = this.buildGraph();
      this.compiledGraph = workflow.compile({
        name: 'AgentWorkflow',
      }) as typeof this.compiledGraph;
      this.logger.log('Official LangGraph initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LangGraph', error);
    }
  }

  /**
   * Planner node - creates execution plan using LLM with tool calling
   */
  private plannerNode: AgentNodeFunction = async (state) => {
    this.logger.debug(`[planner] Creating plan for goal: ${state.goal}`);

    try {
      // Emit event for streaming
      this.emitNodeEvent(PLANNER_NODE, state.agentId, { status: 'started' });

      // Get available tools for LLM, filtered by state.allowedTools.
      // - `null` (default) ⇒ unrestricted (chat path)
      // - `[]`              ⇒ deny-all (Hermes type with no permitted tools)
      // - Non-empty         ⇒ whitelist
      // The graph enforces this — callers cannot bypass Hermes policy by
      // omitting post-tool validation.
      const toolDefs = this.toolRegistry.getFunctionDefinitions(
        state.allowedTools ?? undefined,
      );

      if (toolDefs.length === 0) {
        // No tools available, respond with text
        return {
          messages: [
            ...state.messages,
            {
              role: 'assistant' as const,
              content: `I understand you want: ${state.goal}. However, no tools are available to execute this action.`,
              timestamp: Date.now(),
            },
          ],
          currentNode: PLANNER_NODE,
          shouldContinue: false,
        };
      }

      const systemPrompt = `You are an AI operations assistant for NeureCore.
You have access to tools to perform actions on behalf of the user.

Available tools:
${toolDefs.map((t) => `- ${t.function.name}: ${t.function.description}`).join('\n')}

CRITICAL TOOL USAGE RULES:
- You MUST call a tool whenever the user asks for an action (create, list,
  show, get, pause, resume, mark, update, delete, assign, archive, approve,
  reject, etc.). NEVER reply in prose for an action request — the user will
  see "tool broken" if you do. If a tool is offered for this task, use it.
- If the user mentions an entity by name (e.g. "the audit project"), call
  globalSearch or getProjectByName first to resolve the ID, then proceed.
- If you cannot determine the right tool from the available list, say so
  plainly in ONE short sentence — do NOT fabricate tool names. Use exactly
  one of the names above.
- Never apologise about email / HTTP / Google integrations if the user
  asks — these are real callable tools. If a tool fails, surface the error
  message verbatim from the tool result.

When the user asks a pure QUESTION (not an action):
→ Respond directly with your knowledge using the available tools as read
  helpers (e.g. listCustomers, getDashboardSummary).

DATA INTEGRITY (critical — read carefully):
- Every value the user gives you for a tool input MUST be passed through VERBATIM.
- NEVER silently strip, reformat, "clean up", or "normalise" identifiers, names,
  prefixes, brackets, suffixes, codes, or any other user-supplied data.
- A user who says "Add a customer called [My Prefix] Acme LLC" expects the
  customer to be stored with the EXACT name "[My Prefix] Acme LLC" — every
  character, including brackets and whitespace.
- If you are uncertain about a value (e.g. ambiguous reference), ASK the user
  via a clarifying question rather than guessing.
- Removing or silently modifying user-supplied data is a correctness bug and
  violates the user's intent.

Keep responses concise. Use tools whenever the user asks for an action.`;

      const messages = [
        ...state.messages,
        { role: 'user' as const, content: state.goal, timestamp: Date.now() },
      ];

      // Feature-flagged routing (S18 per ai-gateway-imp-plan.md):
      //   AI_GATEWAY_V2=true  → AiGatewayService.invokeWithTools (capability='tools',
      //                          modelId override preserved from `state.model`)
      //   AI_GATEWAY_V2=false → legacy LLMFactory.invokeWithTools (preserved)
      const result = this.featureFlags.isEnabled('AI_GATEWAY_V2')
        ? await this.invokePlannerWithGateway(
            systemPrompt,
            state.goal,
            toolDefs,
            state.model ?? null,
            state.tenantId,
          )
        : await this.invokePlannerLegacy(
            systemPrompt,
            state.goal,
            toolDefs,
            state.model ?? undefined,
          );

      // Check if LLM returned tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        this.logger.log(
          `[planner] LLM returned ${result.toolCalls.length} tool call(s): ${result.toolCalls.map((t) => t.name).join(', ')}`,
        );

        const toolCalls: ToolCall[] = result.toolCalls.map((tc, i) => ({
          name: tc.name,
          input: tc.arguments,
        }));

        return {
          toolCalls,
          messages: [
            ...state.messages,
            {
              role: 'user' as const,
              content: state.goal,
              timestamp: Date.now(),
            },
          ],
          currentNode: TOOL_NODE,
          iteration: 1,
          shouldContinue: true,
        };
      }

      // No tool calls - LLM responded directly with text
      return {
        messages: [
          ...state.messages,
          {
            role: 'assistant' as const,
            content: result.content ?? 'I understand. How can I help?',
            timestamp: Date.now(),
          },
        ],
        currentNode: PLANNER_NODE,
        shouldContinue: false,
      };
    } catch (error) {
      this.logger.error('[planner] Error creating plan', error);
      return {
        error: error instanceof Error ? error.message : 'Planning failed',
        currentNode: PLANNER_NODE,
        shouldContinue: false,
      };
    }
  };

  /**
   * Executor node - executes the current step
   */
  private executorNode: AgentNodeFunction = async (state) => {
    this.logger.debug(`[executor] Executing step`);

    try {
      this.emitNodeEvent(EXECUTOR_NODE, state.agentId, { status: 'started' });

      const currentPlan = state.plan;
      if (
        !currentPlan ||
        currentPlan.currentStepIndex >= currentPlan.steps.length
      ) {
        return {
          shouldContinue: false,
          currentNode: EXECUTOR_NODE,
        };
      }

      const currentStep = currentPlan.steps[currentPlan.currentStepIndex];

      // Async for future LLM integration
      await Promise.resolve();

      return {
        currentStep,
        currentNode: EXECUTOR_NODE,
      };
    } catch (error) {
      this.logger.error('[executor] Error executing step', error);
      return {
        error: error instanceof Error ? error.message : 'Execution failed',
        currentNode: EXECUTOR_NODE,
      };
    }
  };

  /**
   * Tool node - executes tools based on tool calls
   */
  private toolNode: AgentNodeFunction = async (state) => {
    this.logger.debug(
      `[tool_node] Executing tools, toolCalls: ${state.toolCalls.length}`,
    );

    try {
      const toolResults: Array<{
        toolName: string;
        input: unknown;
        output: unknown;
        error?: string;
        durationMs: number;
      }> = [];

      // Process tool calls (ToolCall uses 'input', not 'arguments')
      for (const toolCall of state.toolCalls) {
        const startTime = Date.now();

        try {
          // ENFORCE allowedTools whitelist at execution time too.
          // Even if the planner was bypassed or the LLM emits a disallowed
          // tool call, the toolNode refuses to execute it.
          if (
            Array.isArray(state.allowedTools) &&
            !state.allowedTools.includes(toolCall.name)
          ) {
            toolResults.push({
              toolName: toolCall.name,
              input: toolCall.input,
              output: null,
              error: `Tool '${toolCall.name}' is not permitted by the current execution policy`,
              durationMs: Date.now() - startTime,
            });
            continue;
          }

          // Use toolRegistry.get() not getTool()
          const tool = this.toolRegistry.get(toolCall.name);
          if (!tool) {
            toolResults.push({
              toolName: toolCall.name,
              input: toolCall.input,
              output: null,
              error: `Tool not found: ${toolCall.name}`,
              durationMs: Date.now() - startTime,
            });
            continue;
          }

          // SECURITY: Validate tool call before execution
          const securityContext: ISecurityContext = {
            tenantId: state.tenantId,
            agentType: state.agentId || 'default',
            userId: state.userId,
          };

          const securityResult = await this.securityInterceptor.validate(
            tool,
            toolCall.input,
            securityContext,
          );

          if (!securityResult.allowed) {
            this.logger.warn(
              `[tool_node] Security blocked tool=${toolCall.name}: ${securityResult.reason}`,
            );
            toolResults.push({
              toolName: toolCall.name,
              input: toolCall.input,
              output: null,
              error: `Security blocked: ${securityResult.reason}`,
              durationMs: Date.now() - startTime,
            });
            continue;
          }

          // Use sanitized input if provided
          const validatedInput =
            securityResult.sanitizedInput || toolCall.input;

          const toolContext = {
            tenantId: state.tenantId,
            agentId: state.agentId,
            userId: state.userId,
            // Pass the user's goal into the tool context so tools like
            // CreateProjectTool can use it as synthesis input when the user
            // didn't supply a projectTypeId.
            // Phase 2: also pass the deterministic routing override and a
            // route summary so service-gateway can apply it at execution.
            metadata: {
              goal: state.goal,
              forcedCapability: state.forcedCapability,
              route: state.route,
            },
          };

          const result = await tool.execute(validatedInput, toolContext);
          // Phase 4.5: a tool that returns `{ success: false, error }`
          // is a FAILED tool call, not a successful one whose result
          // just happens to look like an error. Surface it as
          // `error` so the retry / shouldContinue logic treats it
          // correctly and the user sees an honest failure message.
          const toolResult = (result ?? null) as {
            success?: boolean;
            error?: string;
            data?: unknown;
          } | null;
          const failed =
            !!toolResult && toolResult.success === false
              ? (toolResult.error ?? 'Tool returned success=false')
              : undefined;
          toolResults.push({
            toolName: toolCall.name,
            input: toolCall.input,
            output: failed ? null : result,
            ...(failed ? { error: failed } : {}),
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          toolResults.push({
            toolName: toolCall.name,
            input: toolCall.input,
            output: null,
            error:
              error instanceof Error ? error.message : 'Tool execution failed',
            durationMs: Date.now() - startTime,
          });
        }
      }

      // Format result message
      const successCount = toolResults.filter((r) => !r.error).length;
      const failCount = toolResults.filter((r) => r.error).length;

      let responseMessage = '';
      // Phase 9: build a response envelope ONLY for single-tool success.
      // Multi-tool runs keep the legacy "executed N tool(s)" rendering
      // because each tool returns its own payload shape and the FE
      // EnvelopeRenderer can only show one component set at a time.
      let envelope: IResponseEnvelope | null = null;
      if (failCount === 0) {
        responseMessage = `Successfully executed ${successCount} tool(s): `;
        responseMessage += toolResults.map((r) => `${r.toolName}`).join(', ');
        if (
          successCount === 1 &&
          this.envelopeBuilder &&
          toolResults[0].output !== undefined &&
          toolResults[0].output !== null
        ) {
          envelope = this.envelopeBuilder.buildToolResponse(
            toolResults[0].toolName,
            toolResults[0].output,
          );
        }
        // Structured results belong in the envelope. Only fall back to a
        // compact text rendering when no component could be built.
        if (!envelope?.components?.length) {
          const rendered = toolResults
            .map((r) => this.renderToolOutput(r.output))
            .filter(Boolean)
            .join(' ');
          if (rendered) responseMessage += `. ${rendered}`;
        }
      } else {
        const errors = toolResults
          .filter((result) => result.error)
          .map((result) => result.error)
          .filter(Boolean)
          .join('; ');
        responseMessage =
          successCount > 0
            ? `Completed ${successCount} action(s), but ${failCount} failed: ${errors}`
            : `I couldn't complete that request: ${errors || 'the tool call failed'}`;
      }

      return {
        toolResults,
        messages: [
          ...state.messages,
          {
            role: 'assistant' as const,
            content: responseMessage,
            timestamp: Date.now(),
          },
        ],
        currentNode: EVALUATOR_NODE,
        shouldContinue: false, // Done after execution
        envelope,
      };
    } catch (error) {
      this.logger.error('[tool_node] Error executing tools', error);
      return {
        error: error instanceof Error ? error.message : 'Tool execution failed',
        currentNode: TOOL_NODE,
        shouldContinue: false,
      };
    }
  };

  /**
   * Evaluator node - generates final response after tool execution
   */
  private evaluatorNode: AgentNodeFunction = async (state) => {
    this.logger.debug(`[evaluator] Evaluating results`);

    try {
      const iteration = state.iteration;
      const maxIterations = state.maxIterations;

      // Check if we've exceeded max iterations
      if (iteration >= maxIterations) {
        this.logger.warn(
          `[evaluator] Max iterations (${maxIterations}) reached`,
        );
        return {
          shouldContinue: false,
          evaluation: {
            score: 0.5,
            success: false,
            reflection: 'Max iterations reached',
            suggestions: [],
            shouldRetry: false,
          },
          currentNode: EVALUATOR_NODE,
        };
      }

      // Simple evaluation logic
      const allStepsComplete = state.plan
        ? state.plan.currentStepIndex >= state.plan.steps.length
        : true;

      const hasErrors = state.error !== null;
      const hasToolErrors = state.toolResults.some((r) => r.error);
      // Security/policy blocks are permanent — retrying won't help and just
      // burns LangGraph recursion budget. Break the loop in that case so the
      // user gets the failure message instead of a recursion limit error.
      const hasSecurityBlock = state.toolResults.some(
        (r) =>
          typeof r.error === 'string' && r.error.startsWith('Security blocked'),
      );

      const success = allStepsComplete && !hasErrors && !hasToolErrors;

      // Async for future LLM integration
      await Promise.resolve();

      return {
        shouldContinue: !success && !hasSecurityBlock,
        // Phase 4.4: clear `toolCalls` so the next planner iteration
        // doesn't re-run the exact same tool with the exact same
        // input. The previous behaviour kept `toolCalls` in state,
        // so the conditional `shouldExecuteTool` edge would route
        // back to the executor with the SAME calls — a guaranteed
        // infinite loop on any non-recoverable tool failure.
        toolCalls: success || hasSecurityBlock ? [] : state.toolCalls,
        evaluation: {
          score: success ? 1.0 : 0.5,
          success,
          reflection: success
            ? 'All steps completed successfully'
            : hasSecurityBlock
              ? 'Tool blocked by security policy'
              : 'Some steps failed or incomplete',
          suggestions: success ? [] : ['Retry failed steps'],
          shouldRetry:
            !success && !hasSecurityBlock && iteration < maxIterations,
        },
        currentNode: EVALUATOR_NODE,
        // Phase 4.4 fix: properly increment iteration so maxIterations
        // can terminate the loop. Previously was hardcoded to 1.
        iteration: iteration + 1,
      };
    } catch (error) {
      this.logger.error('[evaluator] Error evaluating results', error);
      return {
        error: error instanceof Error ? error.message : 'Evaluation failed',
        currentNode: EVALUATOR_NODE,
        shouldContinue: false,
      };
    }
  };

  /**
   * Conditional edge: determine if we should hand off to the executor or end.
   * After planner, check if LLM returned tool calls.
   * Returns values that map via pathMap keys: 'executor' → EXECUTOR_NODE, 'end' → END.
   */
  private shouldExecuteTool(state: AgentGraphState): string {
    if (state.error) {
      return 'end';
    }

    // If LLM returned tool calls, route to executor which will run them via tool_node
    if (state.toolCalls && state.toolCalls.length > 0) {
      return 'executor';
    }

    // No tool calls - LLM responded with text, we're done
    return 'end';
  }

  /**
   * Conditional edge: determine if we should continue or end
   * After tool execution + evaluation
   */
  private shouldContinue(state: AgentGraphState): string {
    // Check if we should continue
    if (!state.shouldContinue) {
      return 'end';
    }

    // Check max iterations
    if (state.iteration >= state.maxIterations) {
      return 'end';
    }

    // If LLM returned more tool calls, route back through executor
    if (state.toolCalls && state.toolCalls.length > 0) {
      return 'executor';
    }

    // No pending tool calls and no errors — single-turn tool execution is done.
    return 'end';
  }

  /**
   * Emit node event for streaming
   */

  private emitNodeEvent(
    node: string,
    agentId: string,
    data: Record<string, unknown>,
  ): void {
    try {
      this.streamingService.emit(agentId, {
        type: StreamingEventType.STEP_START,
        node,
        data,
        timestamp: Date.now(),
      } as any);
    } catch (error) {
      this.logger.warn(`Failed to emit node event: ${error}`);
    }
  }

  /**
   * Planner via the AI Gateway (S18). Preserves the free-form
   * `Agent.model` override as `modelId` so existing agents with a
   * legacy model id continue to behave as before.
   */
  private async invokePlannerWithGateway(
    systemPrompt: string,
    userGoal: string,
    toolDefs: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: unknown };
    }>,
    modelId: string | null,
    tenantId: string,
  ): Promise<{
    content?: string;
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  }> {
    const r = await this.aiGateway.invokeWithTools({
      tenantId,
      capability: 'tools',
      ...(modelId ? { modelId } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userGoal },
      ],
      tools: toolDefs.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters as Record<string, unknown>,
      })),
      temperature: 0.3,
      maxTokens: 2048,
      sourceModule: 'agent-graph.planner',
    });
    return {
      ...(r.content ? { content: r.content } : {}),
      ...(r.toolCalls && r.toolCalls.length > 0
        ? {
            toolCalls: r.toolCalls.map((tc) => ({
              name: tc.name,
              arguments: (tc.arguments as Record<string, unknown>) ?? {},
            })),
          }
        : {}),
    };
  }

  /**
   * Legacy planner path. Kept intact for the `AI_GATEWAY_V2=false`
   * rollout window. Will be deleted in PR 8.3.
   */
  private async invokePlannerLegacy(
    systemPrompt: string,
    userGoal: string,
    toolDefs: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: unknown };
    }>,
    overrideModel?: string,
  ): Promise<{
    content?: string;
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  }> {
    if (!this.legacyFactory) {
      return {
        content:
          'Legacy LLMFactory not available; set AI_GATEWAY_V2=true or ensure ModelsModule is imported.',
      };
    }
    return this.legacyFactory.invokeWithTools(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userGoal },
      ],
      toolDefs as unknown as Parameters<LLMFactory['invokeWithTools']>[1],
      0.3,
      2048,
      overrideModel,
    );
  }

  /**
   * Render a tool result into a short, human-readable summary that surfaces
   * the actual data (arrays, nested `data` payloads, entity fields) instead of
   * a generic "executed N tool(s)" acknowledgement. Returns '' when there is
   * nothing meaningful to show.
   */
  private renderToolOutput(output: unknown): string {
    if (output === null || output === undefined || output === '') return '';
    if (typeof output !== 'object') return `Result: ${String(output)}`;

    // Unwrap the common `{ success, data }` envelope.
    const payload: unknown = (output as Record<string, unknown>).data ?? output;

    // If the payload is an object, surface a named array payload first
    // (e.g. { projects: [...], total }, { data: [...], total }).
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const p = payload as Record<string, unknown>;
      const arrayKeys = Object.keys(p).filter((k) => Array.isArray(p[k]));
      const arrayKey = arrayKeys.find((k) => k !== 'data') ?? arrayKeys[0];
      if (arrayKey) {
        const items = p[arrayKey] as unknown[];
        const total = p.total ?? items.length;
        const summary = items
          .map((it) => this.summarizeToolItem(it))
          .filter(Boolean)
          .join('; ');
        return `${arrayKey}: (${total}) ${summary}`;
      }
      // Scalar summary object — compact JSON, dropping envelope noise.
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p)) {
        if (k === 'success' || k === 'metadata') continue;
        clean[k] = v;
      }
      const json = JSON.stringify(clean);
      if (json && json !== '{}') return `Result: ${json}`;
      return '';
    }

    // Direct array payload.
    if (Array.isArray(payload)) {
      const summary = payload
        .map((it) => this.summarizeToolItem(it))
        .filter(Boolean)
        .join('; ');
      return summary ? `Result: ${summary}` : '';
    }

    return '';
  }

  /** Format a single list/array item into a short label. */
  private summarizeToolItem(item: unknown): string {
    if (item === null || item === undefined) return '';
    if (typeof item !== 'object') return String(item);
    const o = item as Record<string, unknown>;
    const name = o.name ?? o.title ?? o.id;
    if (name === undefined) {
      const json = JSON.stringify(o);
      return json && json !== '{}' ? json : '';
    }
    const status = o.status;
    return status !== undefined && status !== null
      ? `${name} (${status})`
      : String(name);
  }

  /**
   * Run the agent graph with the given input
   *
   * Supports checkpoint resumption - if a threadId is provided and a checkpoint
   * exists, the agent will resume from the saved state instead of starting fresh.
   */
  async run(params: {
    goal: string;
    agentId: string;
    tenantId: string;
    userId: string;
    sessionId?: string;
    threadId?: string;
    resumeFromCheckpoint?: boolean;
    /**
     * Optional tool allowlist. Same semantics as `stream()` — see
     * `stream()` JSDoc and Phase 4.1 of the remediation plan.
     */
    allowedTools?: string[] | null;
  }): Promise<AgentGraphState> {
    if (!this.compiledGraph) {
      throw new Error('Graph not initialized');
    }

    const threadId = params.threadId ?? params.sessionId ?? params.agentId;

    // Normalise `undefined` to `null` so the annotation default doesn't override.
    const allowedTools =
      params.allowedTools === undefined ? null : params.allowedTools;

    // Try to load checkpoint for resumption
    let initialState: AgentGraphState | null = null;
    if (
      params.resumeFromCheckpoint !== false &&
      this.checkpointService.isAvailable()
    ) {
      try {
        const checkpointState = await this.checkpointService.loadCheckpoint(
          threadId,
          params.agentId,
        );
        if (checkpointState) {
          this.logger.log(
            `[run] Resuming from checkpoint for thread: ${threadId}`,
          );
          initialState = this.convertToGraphState(checkpointState);
          // Always re-apply the allowlist from the caller — a resumed
          // checkpoint must NOT silently bypass tool policy.
          initialState.allowedTools = allowedTools;
        }
      } catch (error) {
        this.logger.warn(
          `[run] Failed to load checkpoint, starting fresh: ${error}`,
        );
      }
    }

    // If no checkpoint, create fresh state
    if (!initialState) {
      const forced =
        ((params as Record<string, unknown>)['forcedCapability'] as
          | string
          | undefined) ?? null;
      initialState = {
        goal: params.goal,
        agentId: params.agentId,
        tenantId: params.tenantId,
        userId: params.userId,
        plan: null,
        steps: [],
        currentStep: null,
        toolCalls: [],
        toolResults: [],
        evaluation: null,
        messages: [],
        currentNode: PLANNER_NODE,
        iteration: 0,
        maxIterations: 10,
        error: null,
        shouldContinue: true,
        model: null,
        allowedTools,
        envelope: null,
        forcedCapability: forced,
        route:
          ((params as Record<string, unknown>)['route'] as
            | Record<string, unknown>
            | null
            | undefined) ?? null,
      } as AgentGraphState;
    }

    this.logger.log(`[run] Starting agent execution for goal: ${params.goal}`);

    try {
      const result = await this.compiledGraph.invoke(initialState, {
        configurable: {
          thread_id: threadId,
        },
      });

      // Save checkpoint on successful completion
      if (this.checkpointService.isAvailable()) {
        await this.saveCheckpoint(threadId, params.agentId, result);
      }

      this.logger.log(`[run] Agent execution completed`);
      return result;
    } catch (error) {
      this.logger.error('[run] Agent execution failed', error);
      throw error;
    }
  }

  /**
   * Convert AgentState to AgentGraphState
   */
  private convertToGraphState(state: AgentState): AgentGraphState {
    return {
      goal: state.goal,
      agentId: state.agentId,
      tenantId: state.tenantId,
      userId: state.userId ?? '',
      plan: state.plan ?? null,
      steps: state.steps ?? [],
      currentStep: state.currentStep ?? null,
      toolCalls: state.toolCalls ?? [],
      toolResults: state.toolResults ?? [],
      evaluation: state.evaluation ?? null,
      messages: state.messages ?? [],
      allowedTools: state.allowedTools ?? null,
      currentNode: state.currentNode ?? PLANNER_NODE,
      iteration: state.iterations ?? 0,
      maxIterations: state.maxIterations ?? 10,
      error: state.error ?? null,
      shouldContinue: state.shouldContinue ?? true,
      model: null,
      envelope: null,
      forcedCapability:
        (state as unknown as { forcedCapability?: string | null })
          .forcedCapability ?? null,
      route:
        (state as unknown as { route?: Record<string, unknown> | null })
          .route ?? null,
    };
  }

  /**
   * Saontinue ?? true,
      model: null,
      envelope: null,
    };
  }

  /**
   * Save checkpoint for future resumption
   */
  private async saveCheckpoint(
    threadId: string,
    agentId: string | undefined,
    state: AgentGraphState,
  ): Promise<void> {
    try {
      await this.checkpointService.saveCheckpoint(state as any, {
        threadId,
        agentId,
        ttlSeconds: 86400, // 24 hours
      });
      this.logger.debug(`[run] Checkpoint saved for thread: ${threadId}`);
    } catch (error) {
      this.logger.warn(`[run] Failed to save checkpoint: ${error}`);
      // Don't throw - checkpoint failure shouldn't break execution
    }
  }

  /**
   * Stream the agent execution
   */
  async *stream(params: {
    goal: string;
    agentId: string;
    tenantId: string;
    userId: string;
    sessionId?: string;
    model?: string;
    /**
     * Optional whitelist of tool names this execution may invoke.
     *   - `undefined` / `null` ⇒ no restriction (legacy chat path).
     *   - `[]` (empty)        ⇒ no tools allowed (deny-all).
     *   - Non-empty           ⇒ only these tool names are exposed to the LLM
     *                            and may be executed by the tool node.
     *
     * Used by Hermes runtime to enforce per-Hermes-type tool policy. The
     * graph itself enforces this, so callers cannot bypass by omitting
     * post-tool validation.
     */
    allowedTools?: string[] | null;
  }): AsyncGenerator<Partial<AgentGraphState>> {
    if (!this.compiledGraph) {
      throw new Error('Graph not initialized');
    }

    // Normalise `undefined` to `null` so the annotation default doesn't override.
    const allowedTools =
      params.allowedTools === undefined ? null : params.allowedTools;

    const initialState: AgentGraphState = {
      goal: params.goal,
      agentId: params.agentId,
      tenantId: params.tenantId,
      userId: params.userId,
      plan: null,
      steps: [],
      currentStep: null,
      toolCalls: [],
      toolResults: [],
      evaluation: null,
      messages: [],
      currentNode: PLANNER_NODE,
      iteration: 0,
      maxIterations: 10,
      error: null,
      shouldContinue: true,
      model: params.model ?? null,
      allowedTools,
      envelope: null,
      forcedCapability:
        ((params as Record<string, unknown>)['forcedCapability'] as
          | string
          | undefined) ?? null,
      route:
        ((params as Record<string, unknown>)['route'] as
          | Record<string, unknown>
          | null
          | undefined) ?? null,
    };

    this.logger.log(
      `[stream] Starting streaming agent execution with model: ${params.model ?? 'default'}`,
    );

    try {
      for await (const chunk of await this.compiledGraph.stream(initialState, {
        configurable: {
          thread_id: params.sessionId ?? params.agentId,
        },
      })) {
        yield chunk as Partial<AgentGraphState>;
      }
    } catch (error) {
      this.logger.error('[stream] Streaming failed', error);
      throw error;
    }
  }
}
