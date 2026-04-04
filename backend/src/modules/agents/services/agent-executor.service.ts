import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { AgentEvaluatorService } from './agent-evaluator.service';
import { ToolsService } from '../../tools/tools.service';
import { GovernanceRulesService } from '../../governance/services/governance-rules.service';
import { ApprovalsService } from '../../governance/services/approvals.service';
import { OfficialAgentGraph } from '../langgraph/langgraph-official';
import { OpenClawGatewayService } from '../../ai-gateway/openclaw-gateway.service';
import type {
  IAgentExecutor,
  ExecutionContext,
  StepResult,
  ExecutionResult,
} from '../interfaces/agent-executor.interface';
import { TaskStatus, AgentStatus } from '@prisma/client';

/**
 * AgentExecutorService
 *
 * Responsibility (SRP): Execute a single plan step or an entire task by
 * running steps in dependency order, persisting execution logs, emitting
 * real-time WebSocket events, and delegating evaluation to AgentEvaluatorService.
 *
 * SOLID:
 *  - SRP: executes only — delegates planning to planner, scoring to evaluator
 *  - DIP: depends on IAgentExecutor, ToolsService, EventsGateway abstractions
 *  - OCP: tool dispatch is open for extension via ToolsService registry
 */
@Injectable()
export class AgentExecutorService implements IAgentExecutor {
  private readonly logger = new Logger(AgentExecutorService.name);
  private readonly runningTasks = new Map<string, boolean>(); // taskId → cancelled

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly evaluator: AgentEvaluatorService,
    private readonly tools: ToolsService,
    private readonly governance: GovernanceRulesService,
    private readonly officialGraph: OfficialAgentGraph,
    private readonly openClawGateway: OpenClawGatewayService,
    private readonly approvals: ApprovalsService,
  ) {}

  async execute(context: ExecutionContext): Promise<StepResult> {
    const start = Date.now();
    this.logger.debug(
      `Executing step ${context.step.id} for task ${context.taskId}`,
    );

    try {
      let output: unknown;

      // If step specifies a toolId, invoke it via ToolsService (DIP / OCP)
      if (context.step.toolId) {
        const toolResult = await this.tools.execute(
          context.step.toolId,
          context.step.input ?? {},
        );
        output = toolResult.success
          ? toolResult.data
          : { error: toolResult.error };
        if (!toolResult.success)
          throw new Error(toolResult.error ?? 'Tool execution failed');
      } else {
        output = { result: `Step "${context.step.description}" completed` };
      }

      const durationMs = Date.now() - start;
      await this.persistLog(context, output, durationMs, true);

      return { stepId: context.step.id, success: true, output, durationMs };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - start;
      await this.persistLog(context, null, durationMs, false, error);
      return { stepId: context.step.id, success: false, error, durationMs };
    }
  }

  async executeTask(
    taskId: string,
    agentId: string,
    tenantId: string,
  ): Promise<ExecutionResult> {
    const start = Date.now();
    this.runningTasks.set(taskId, false);

    // ─── Governance pre-check ───
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, priority: true },
      });
      const decision = await this.governance.evaluate(tenantId, {
        'task.id': taskId,
        'task.title': task?.title ?? '',
        'agent.id': agentId,
      });

      if (!decision.allowed) {
        // Update task to FAILED with reason
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.FAILED,
            error: `Blocked by governance: ${decision.triggeredRules.join(', ')}`,
          },
        });
        this.events.emitAgentError(
          tenantId,
          agentId,
          taskId,
          `Governance blocked: ${decision.triggeredRules.join(', ')}`,
        );
        this.events.emitGovernanceTriggered(tenantId, agentId, decision);
        throw new ForbiddenException(
          `Task blocked by governance rules: ${decision.triggeredRules.join(', ')}`,
        );
      }

      if (decision.requiresApproval) {
        // Surface the decision via WebSocket; don't block (approval created separately by calling code)
        this.events.emitGovernanceTriggered(tenantId, agentId, decision);
        this.logger.warn(
          `[Governance] Task ${taskId} requires approval — triggered rules: ${decision.triggeredRules.join(', ')}`,
        );
      }
    } catch (govErr) {
      if (govErr instanceof ForbiddenException) throw govErr;
      // Governance failures are non-fatal to avoid blocking execution on infrastructure issues
      this.logger.warn(
        `[Governance] Pre-check failed for task ${taskId}: ${String(govErr)}`,
      );
    }
    // ─── End governance pre-check ───

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.RUNNING, startedAt: new Date() },
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: AgentStatus.RUNNING },
    });

    this.events.emitToTenant(tenantId, 'task:started', { taskId, agentId });

    // Use Official LangGraph for execution with streaming support
    try {
      const stream = this.officialGraph.stream({
        goal: `Execute task ${taskId}`,
        agentId,
        tenantId,
        userId: 'system', // Or extract from context
        sessionId: taskId,
      });

      const steps: Array<{
        stepId: string;
        success: boolean;
        output?: unknown;
        error?: string;
        durationMs: number;
        tokensUsed?: number;
        costUsd?: number;
      }> = [];

      let stepIndex = 0;
      for await (const chunk of stream) {
        // Emit progress events based on the chunk
        if (chunk.currentNode) {
          const stepId = `step-${stepIndex}`;
          const stepStart = Date.now();

          // Emit step start
          this.events.emitToTenant(tenantId, 'task:step:start', {
            taskId,
            agentId,
            stepId,
            stepIndex,
            description: `Executing ${chunk.currentNode}`,
          });

          // Check for tool calls
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            for (const toolCall of chunk.toolCalls) {
              this.events.emitToTenant(tenantId, 'task:tool:call', {
                taskId,
                agentId,
                toolName: toolCall.name,
                input: toolCall.input,
              });
            }
          }

          // Check for tool results
          if (chunk.toolResults && chunk.toolResults.length > 0) {
            for (const toolResult of chunk.toolResults) {
              this.events.emitToTenant(tenantId, 'task:tool:result', {
                taskId,
                agentId,
                toolName: toolResult.toolName,
                output: toolResult.output,
              });
            }
          }

          // Emit step complete
          const stepDuration = Date.now() - stepStart;
          this.events.emitToTenant(tenantId, 'task:step:complete', {
            taskId,
            agentId,
            stepId,
            stepIndex,
            description: `Completed ${chunk.currentNode}`,
            durationMs: stepDuration,
          });

          steps.push({
            stepId,
            success: true,
            output: chunk,
            durationMs: stepDuration,
          });

          stepIndex++;
        }

        // Interrupt detection: LangGraph emits { __interrupt__: [...] } when interrupt() is called
        if ('__interrupt__' in chunk) {
          await this.prisma.task.update({
            where: { id: taskId },
            data: { status: TaskStatus.PENDING },
          });
          this.events.emitToTenant(tenantId, 'task:approval:required', {
            taskId,
            agentId,
            interrupt: (chunk as Record<string, unknown>).__interrupt__,
          });
          this.runningTasks.delete(taskId);
          return {
            taskId,
            agentId,
            success: false,
            steps,
            error: 'Task paused pending human approval',
            totalDurationMs: Date.now() - start,
            totalTokensUsed: 0,
            totalCostUsd: 0,
          };
        }

        // Check for errors
        if (chunk.error) {
          const stepId = `step-${stepIndex}`;
          this.events.emitToTenant(tenantId, 'task:step:error', {
            taskId,
            agentId,
            stepId,
            stepIndex,
            error: chunk.error,
          });

          steps.push({
            stepId,
            success: false,
            error: chunk.error,
            durationMs: 0,
          });
        }
      }

      const totalDurationMs = Date.now() - start;
      const success = steps.every((s) => s.success);

      // Update task status
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          completedAt: new Date(),
          output: JSON.stringify({
            steps,
            finalState: steps[steps.length - 1]?.output,
          }),
          error: success ? null : 'One or more steps failed',
        },
      });

      // ─── Outbound relay: if the task originated from OpenClaw, send the result back ───
      if (success) {
        const taskRow = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { input: true },
        });
        const taskInput = taskRow?.input as Record<string, unknown> | null;
        if (taskInput?.channelSource === 'openclaw') {
          const channelCtx = taskInput.channelContext as Record<
            string,
            unknown
          >;
          const finalOutput = steps[steps.length - 1]?.output;
          const message =
            typeof finalOutput === 'string'
              ? finalOutput
              : JSON.stringify(finalOutput);
          await this.openClawGateway.sendMessage(
            String(channelCtx.openClawAgentId),
            'response',
            { taskId, message },
            {},
            tenantId,
          );
        }
      }

      // Update agent status
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.IDLE },
      });

      // Emit completion event
      const event = success ? 'task:completed' : 'task:failed';
      this.events.emitToTenant(tenantId, event, {
        taskId,
        agentId,
        success,
        error: success ? null : 'One or more steps failed',
      });

      this.runningTasks.delete(taskId);

      return {
        taskId,
        agentId,
        success,
        steps,
        finalOutput: { steps, finalState: steps[steps.length - 1]?.output },
        error: success ? undefined : 'One or more steps failed',
        totalDurationMs,
        totalTokensUsed: 0, // Would need to track from LangGraph
        totalCostUsd: 0, // Would need to track from LangGraph
      };
    } catch (error) {
      this.logger.error(`[executeTask] LangGraph execution failed`, error);
      const totalDurationMs = Date.now() - start;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Update task status to failed
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      // Update agent status
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.IDLE },
      });

      // Emit error event
      this.events.emitAgentError(tenantId, agentId, taskId, errorMessage);
      this.events.emitToTenant(tenantId, 'task:failed', {
        taskId,
        agentId,
        success: false,
        error: errorMessage,
      });

      this.runningTasks.delete(taskId);

      return {
        taskId,
        agentId,
        success: false,
        steps: [],
        error: errorMessage,
        totalDurationMs,
        totalTokensUsed: 0,
        totalCostUsd: 0,
      };
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    if (this.runningTasks.has(taskId)) {
      this.runningTasks.set(taskId, true);
    }
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
    });
  }

  /**
   * Resume a HITL-interrupted graph.
   *
   * Flow:
   *   1. Record the human decision in the ApprovalRequest (via ApprovalsService).
   *   2. Resume the LangGraph from the interrupt point.
   *
   * The threadId is the sessionId passed to stream() — which is the taskId.
   */
  async resumeGraph(
    threadId: string,
    decision: 'APPROVED' | 'REJECTED',
    approvalId: string,
    tenantId: string,
    reviewerId: string,
  ): Promise<void> {
    // Persist the review decision in the DB
    await this.approvals.review(approvalId, tenantId, reviewerId, {
      status: decision,
    });

    // Resume the LangGraph — interrupt() will return the decision string
    await this.officialGraph.resumeGraph({ threadId, decision });
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  private async persistLog(
    ctx: ExecutionContext,
    output: unknown,
    durationMs: number,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await this.prisma.executionLog.create({
      data: {
        agentId: ctx.agentId,
        taskId: ctx.taskId,
        step: ctx.step.id,
        input: (ctx.step.input ?? {}) as never,
        output: (output as never) ?? undefined,
        durationMs,
        success,
        error: error ?? null,
      },
    });
  }
}
