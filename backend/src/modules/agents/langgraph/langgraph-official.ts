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

import {
  StateGraph,
  END,
  START,
  Annotation,
  interrupt,
  MemorySaver,
  Command,
} from '@langchain/langgraph';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentState, StepResult, ToolCall } from './agent.state';
import { AgentStreamingService } from '../streaming/agent-streaming.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { StreamingEventType } from '../streaming/agent-streaming.service';
import { AgentCheckpointService } from './checkpoint.service';
import { SecurityInterceptorService } from '../security/security-interceptor.service';
import type { ISecurityContext } from '../security/interfaces/security.interfaces';
import { AgentPlannerService } from '../services/agent-planner.service';
import { AgentEvaluatorService } from '../services/agent-evaluator.service';
import { ApprovalsService } from '../../governance/services/approvals.service';

// Node name constants — as const satisfies TypeScript literal-type constraints
const PLANNER_NODE = 'planner' as const;
const EXECUTOR_NODE = 'executor' as const;
const TOOL_NODE = 'tool_node' as const;
const EVALUATOR_NODE = 'evaluator' as const;
const HUMAN_REVIEW_NODE = 'human_review' as const;

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

  // Tool execution
  toolCalls: Annotation<ToolCall[]>({
    reducer: (left, right) => [...left, ...right],
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

  // ─── HITL fields ──────────────────────────────────────────────────────────
  // Set to true by governance pre-check to route through humanReviewNode
  requiresApproval: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),

  // Set by humanReviewNode after creating an ApprovalRequest in the DB
  approvalId: Annotation<string | null>({
    reducer: (left, right) => right ?? left,
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
    private readonly config: ConfigService,
    private readonly streamingService: AgentStreamingService,
    private readonly toolRegistry: StructuredToolRegistry,
    private readonly checkpointService: AgentCheckpointService,
    private readonly securityInterceptor: SecurityInterceptorService,
    private readonly planner: AgentPlannerService,
    private readonly evaluator: AgentEvaluatorService,
    private readonly approvalsService: ApprovalsService,
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

    // ─── HITL: human review node ──────────────────────────────────────────
    workflow.addNode(HUMAN_REVIEW_NODE, this.humanReviewNode.bind(this));

    // Entry: route through human review when governance requires approval
    // Otherwise go directly to planner
    workflow.addConditionalEdges(
      START as any,
      this.requiresApprovalCheck.bind(this),
      {
        planner: PLANNER_NODE,
        human_review: HUMAN_REVIEW_NODE,
      } as any,
    );

    // After human review: continue to planner (approved) or end (rejected)
    workflow.addConditionalEdges(
      HUMAN_REVIEW_NODE as any,
      this.shouldContinueAfterReview.bind(this),
      {
        planner: PLANNER_NODE,
        end: END,
      } as any,
    );

    workflow.addEdge(EXECUTOR_NODE as any, TOOL_NODE as any);
    workflow.addEdge(TOOL_NODE as any, EVALUATOR_NODE as any);

    // Conditional routing after planner
    workflow.addConditionalEdges(
      PLANNER_NODE as any,
      this.shouldExecuteTool.bind(this),
      {
        executor: EXECUTOR_NODE,
        end: END,
      } as any,
    );

    // Conditional routing after evaluator
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
      // MemorySaver checkpointer is required for interrupt()-based HITL —
      // it persists graph state between the interrupt and resume calls.
      this.compiledGraph = workflow.compile({
        name: 'AgentWorkflow',
        checkpointer: new MemorySaver(),
      }) as typeof this.compiledGraph;
      this.logger.log('Official LangGraph initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LangGraph', error);
    }
  }

  // ─── HITL routing helpers ──────────────────────────────────────────────────

  private requiresApprovalCheck(state: AgentGraphState): string {
    return state.requiresApproval ? HUMAN_REVIEW_NODE : PLANNER_NODE;
  }

  private shouldContinueAfterReview(state: AgentGraphState): string {
    return state.error || !state.shouldContinue
      ? (END as string)
      : PLANNER_NODE;
  }

  /**
   * Human Review Node
   *
   * Creates an ApprovalRequest in the DB, then calls interrupt() to pause
   * the graph and return control to the caller.
   *
   * When the graph is resumed (via resumeGraph()), interrupt() returns the
   * reviewer's decision ('APPROVED' | 'REJECTED'). The node then either
   * clears requiresApproval (approved) or sets error (rejected).
   *
   * IMPORTANT: interrupt() is a LangGraph-internal mechanism — it does NOT
   * throw; it signals the runtime to pause and serialise state. The node
   * function will be called AGAIN on resume with the same state, and
   * interrupt() will return the value passed to Command({ resume: value }).
   */
  private humanReviewNode: AgentNodeFunction = async (state) => {
    const approval = await this.approvalsService.create({
      title: `Agent approval required: ${state.goal.slice(0, 100)}`,
      resourceType: 'AGENT_TASK',
      resourceId: state.agentId,
      tenantId: state.tenantId,
      payload: { goal: state.goal, agentId: state.agentId },
      priority: 'HIGH' as const,
    });

    const decision: unknown = interrupt({
      approvalId: approval.id,
      reason: 'Governance requires human approval before continuing',
    });

    if (decision !== 'APPROVED') {
      return {
        error: 'Task rejected by human reviewer',
        shouldContinue: false,
        currentNode: HUMAN_REVIEW_NODE,
      };
    }

    return {
      requiresApproval: false,
      approvalId: approval.id,
      currentNode: HUMAN_REVIEW_NODE,
    };
  };

  /**
   * Resume a paused graph after a human review decision.
   *
   * @param threadId   - The session/task ID used as LangGraph thread_id
   * @param decision   - 'APPROVED' or 'REJECTED'
   */
  async resumeGraph(params: {
    threadId: string;
    decision: 'APPROVED' | 'REJECTED';
  }): Promise<void> {
    if (!this.compiledGraph) {
      throw new Error('Graph not initialized');
    }
    await this.compiledGraph.invoke(new Command({ resume: params.decision }), {
      configurable: { thread_id: params.threadId },
    });
  }

  /**
   * Planner node - delegates to AgentPlannerService for LLM-based planning
   */
  private plannerNode: AgentNodeFunction = async (state) => {
    this.logger.debug(`[planner] Creating plan for goal: ${state.goal}`);

    try {
      this.emitNodeEvent(PLANNER_NODE, state.agentId, { status: 'started' });

      const agentPlan = await this.planner.plan({
        agentId: state.agentId,
        goal: state.goal,
        availableTools: this.toolRegistry.listToolNames(),
        constraints: [],
      });

      const plan = {
        steps: agentPlan.steps.map((s) => ({
          id: s.id,
          description: s.description,
          toolId: s.toolId ?? null,
          input: s.input ?? {},
          dependsOn: s.dependsOn ?? [],
        })),
        currentStepIndex: 0,
      };

      return {
        plan,
        currentNode: PLANNER_NODE,
        iteration: 1,
      };
    } catch (error) {
      this.logger.error('[planner] Error creating plan', error);
      return {
        error: error instanceof Error ? error.message : 'Planning failed',
        currentNode: PLANNER_NODE,
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

          const result = await tool.execute(validatedInput);
          toolResults.push({
            toolName: toolCall.name,
            input: toolCall.input,
            output: result,
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

      return {
        toolResults,
        currentNode: TOOL_NODE,
      };
    } catch (error) {
      this.logger.error('[tool_node] Error executing tools', error);
      return {
        error: error instanceof Error ? error.message : 'Tool execution failed',
        currentNode: TOOL_NODE,
      };
    }
  };

  /**
   * Evaluator node - delegates to AgentEvaluatorService for LLM-based evaluation
   */
  private evaluatorNode: AgentNodeFunction = async (state) => {
    this.logger.debug(`[evaluator] Evaluating results`);

    try {
      const evalResult = await this.evaluator.evaluate({
        taskId: state.agentId,
        agentId: state.agentId,
        goal: state.goal,
        steps: state.steps.map((s) => ({
          id: s.id,
          description: s.description,
          output: s.output,
          success: s.success,
        })),
        finalOutput: state.toolResults.at(-1)?.output,
      });

      return {
        evaluation: evalResult,
        shouldContinue:
          evalResult.shouldRetry && state.iteration < state.maxIterations,
        currentNode: EVALUATOR_NODE,
        iteration: 1,
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
   * Conditional edge: determine if we should execute a tool or end
   */
  private shouldExecuteTool(state: AgentGraphState): string {
    if (state.error) {
      return END as string;
    }

    if (!state.plan) {
      return END as string;
    }

    // If we have a current step with a tool, go to executor
    if (state.currentStep?.toolId) {
      return EXECUTOR_NODE;
    }

    return END as string;
  }

  /**
   * Conditional edge: determine if we should continue or end
   */
  private shouldContinue(state: AgentGraphState): string {
    // Check if we should continue
    if (!state.shouldContinue) {
      return END as string;
    }

    // Check max iterations
    if (state.iteration >= state.maxIterations) {
      return END as string;
    }

    // Check if plan is complete
    if (state.plan && state.plan.currentStepIndex >= state.plan.steps.length) {
      return END as string;
    }

    return EXECUTOR_NODE;
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
  }): Promise<AgentGraphState> {
    if (!this.compiledGraph) {
      throw new Error('Graph not initialized');
    }

    const threadId = params.threadId ?? params.sessionId ?? params.agentId;

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
        }
      } catch (error) {
        this.logger.warn(
          `[run] Failed to load checkpoint, starting fresh: ${error}`,
        );
      }
    }

    // If no checkpoint, create fresh state
    if (!initialState) {
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
        requiresApproval: false,
        approvalId: null,
      };
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
      currentNode: state.currentNode ?? PLANNER_NODE,
      iteration: state.iterations ?? 0,
      maxIterations: state.maxIterations ?? 10,
      error: state.error ?? null,
      shouldContinue: state.shouldContinue ?? true,
      requiresApproval: false,
      approvalId: null,
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
  }): AsyncGenerator<Partial<AgentGraphState>> {
    if (!this.compiledGraph) {
      throw new Error('Graph not initialized');
    }

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
      requiresApproval: false,
      approvalId: null,
    };

    this.logger.log(`[stream] Starting streaming agent execution`);

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
