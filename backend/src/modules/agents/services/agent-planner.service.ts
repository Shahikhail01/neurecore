import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';
import type {
  IAgentPlanner,
  AgentPlan,
  PlanningContext,
} from '../interfaces/agent-planner.interface';
import { LLMFactory } from '../../models/services/llm-factory.service';
import { LangSmithTracingService } from '../../ai-gateway/langsmith-tracing.service';

/**
 * AgentPlannerService
 *
 * Responsibility (SRP): Converts a goal + context into a structured plan
 * using an LLM.  LangChain integration is encapsulated here so no other
 * service depends on LangChain directly (DIP).
 */
@Injectable()
export class AgentPlannerService implements IAgentPlanner {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly llmFactory: LLMFactory,
    private readonly tracing: LangSmithTracingService,
  ) {}

  async plan(context: PlanningContext): Promise<AgentPlan> {
    this.logger.debug(
      `Planning for agent ${context.agentId}: "${context.goal}"`,
    );

    const llm = await this.llmFactory.createLangChainLLM('planning');

    if (!llm) {
      this.logger.warn('No LLM available — returning stub plan');
      return this.buildStubPlan(context);
    }

    return this.buildLlmPlan(context, llm);
  }

  async replan(
    plan: AgentPlan,
    failedStepId: string,
    error: string,
  ): Promise<AgentPlan> {
    this.logger.warn(`Replanning: step ${failedStepId} failed — ${error}`);
    // Remove failed step and all dependents
    const failedIds = new Set<string>([failedStepId]);
    for (const step of plan.steps) {
      if (step.dependsOn?.some((d) => failedIds.has(d))) {
        failedIds.add(step.id);
      }
    }
    return {
      ...plan,
      steps: plan.steps.filter((s) => !failedIds.has(s.id)),
    };
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  private buildStubPlan(context: PlanningContext): AgentPlan {
    return {
      goal: context.goal,
      estimatedTokens: 0,
      steps: [
        {
          id: 'step-1',
          description: `Execute goal: ${context.goal}`,
          input: {},
        },
      ],
    };
  }

  private async buildLlmPlan(
    context: PlanningContext,
    llm: import('@langchain/core/language_models/chat_models').BaseChatModel,
  ): Promise<AgentPlan> {
    const span = this.tracing.startSpan({
      name: 'agent.plan',
      metadata: { agentId: context.agentId, goal: context.goal },
    });

    try {
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { z } = await import('zod');

      // Define the planning schema for structured output
      const planStepSchema = z.object({
        id: z.string().describe('Unique step identifier'),
        description: z.string().describe('What this step accomplishes'),
        toolId: z.string().nullable().describe('Tool name or null if LLM-only'),
        input: z.record(z.unknown()).describe('Tool input parameters'),
        dependsOn: z
          .array(z.string())
          .describe('Step IDs that must complete first'),
      });

      const agentPlanSchema = z.object({
        goal: z.string().describe('Original goal statement'),
        estimatedTokens: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Estimated token count'),
        reasoning: z.string().optional().describe('Why this plan was chosen'),
        steps: z.array(planStepSchema).describe('Ordered execution steps'),
      });

      const toolList = context.availableTools.length
        ? context.availableTools.join(', ')
        : 'none';

      const constraintList = context.constraints?.length
        ? context.constraints.join('; ')
        : 'none';

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI task planner. Decompose the given goal into ordered steps.
Rules:
- Use only the available tools listed.
- Keep steps atomic — one action per step.
- dependsOn contains step IDs that must complete first.
- Produce 1-5 steps maximum.`,
        ],
        [
          'human',
          `Goal: {goal}\nAvailable tools: {tools}\nConstraints: {constraints}`,
        ],
      ]);

      // Use withStructuredOutput for type-safe JSON parsing
      const structuredLlm = llm.withStructuredOutput(agentPlanSchema) as any;

      const chain = prompt.pipe(structuredLlm);

      const plan = (await chain.invoke({
        goal: context.goal,
        tools: toolList,
        constraints: constraintList,
      })) as z.infer<typeof agentPlanSchema>;

      // Convert to AgentPlan format
      const agentPlan: AgentPlan = {
        goal: plan.goal,
        estimatedTokens: plan.estimatedTokens ?? 0,
        steps: plan.steps.map((s, i) => ({
          id: s.id || `step-${i + 1}`,
          description: s.description,
          toolId: s.toolId ?? undefined,
          input: s.input ?? {},
          dependsOn: s.dependsOn ?? [],
        })),
      };

      this.logger.debug(
        `LLM produced ${agentPlan.steps.length} steps for goal: ${context.goal}`,
      );

      this.tracing.endSpan(span?.id, { success: true });
      return agentPlan;
    } catch (err) {
      this.tracing.endSpan(span?.id, {
        success: false,
        error: String(err),
      });
      this.logger.warn(
        `LLM planning failed, falling back to stub: ${String(err)}`,
      );
      return this.buildStubPlan(context);
    }
  }
}
