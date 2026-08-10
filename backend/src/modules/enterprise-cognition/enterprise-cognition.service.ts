/**
 * EnterpriseCognitionService — top-level cognitive orchestrator (Phase 5).
 *
 * Workflow: assemble context (Context Plane) → objective analysis → goal
 * decomposition → deterministic specialist selection → coordination → strategy
 * evaluation → recommendation synthesis → cognitive scoring → (optional)
 * governed handoff to the Work Runtime. It RECOMMENDS; it NEVER executes.
 * Handoff to Work Runtime is the ONLY path to mutation, and even then the
 * runtime governs it. Publishes cognition/recommendation/goal/specialist events.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { CONTEXT_PLANE } from '../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../context-plane/contracts/context-plane.interface';
import { AI_EMPLOYEE_CORE } from '../ai-employee-core/ai-employee-core.tokens';
import type { IAIEmployeeCore } from '../ai-employee-core/contracts/ai-employee-core.interface';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import {
  OBJECTIVE_ANALYZER,
  GOAL_DECOMPOSER,
  AGENT_SELECTOR,
  AGENT_COORDINATOR,
  RECOMMENDATION_ENGINE,
  STRATEGY_EVALUATOR,
  COGNITIVE_EVALUATOR,
} from './contracts/enterprise-cognition.interface';
import type {
  CognizeParams,
  CognitiveResult,
  IAgentCoordinator,
  IAgentSelector,
  ICognitiveEvaluator,
  IEnterpriseCognition,
  IGoalDecomposer,
  IObjectiveAnalyzer,
  IRecommendationEngine,
  IStrategyEvaluator,
} from './contracts/enterprise-cognition.interface';

@Injectable()
export class EnterpriseCognitionService implements IEnterpriseCognition {
  private readonly logger = new Logger(EnterpriseCognitionService.name);

  constructor(
    @Inject(CONTEXT_PLANE)
    private readonly contextPlane: IOrganizationalContextPlane,
    @Inject(AI_EMPLOYEE_CORE) private readonly core: IAIEmployeeCore,
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
    @Inject(OBJECTIVE_ANALYZER) private readonly objectives: IObjectiveAnalyzer,
    @Inject(GOAL_DECOMPOSER) private readonly decomposer: IGoalDecomposer,
    @Inject(AGENT_SELECTOR) private readonly selector: IAgentSelector,
    @Inject(AGENT_COORDINATOR) private readonly coordinator: IAgentCoordinator,
    @Inject(RECOMMENDATION_ENGINE)
    private readonly recommender: IRecommendationEngine,
    @Inject(STRATEGY_EVALUATOR) private readonly strategy: IStrategyEvaluator,
    @Inject(COGNITIVE_EVALUATOR)
    private readonly evaluator: ICognitiveEvaluator,
  ) {}

  async cognize(params: CognizeParams): Promise<CognitiveResult> {
    const requestId = randomUUID();
    await this.publish('enterprise.cognition.started', params.tenantId, {
      requestId,
      actorId: params.actorId,
    });

    try {
      // 1. Assemble authorized context (Context Plane is the ONLY org-state source).
      const assembled = await this.contextPlane.assemble({
        tenantId: params.tenantId,
        actorId: params.actorId,
        actorType: params.actorType,
        scope: {
          projectId: params.scope?.projectId,
          customerId: params.scope?.customerId,
          departmentId: params.scope?.departmentId,
          includeCapabilities: params.scope?.includeCapabilities,
        },
      });
      const context = this.summarize(assembled);

      // 2. Objective → 3. Decomposition
      const objective = await this.objectives.analyze(
        params.tenantId,
        params.actorId,
        params.request,
        context,
      );
      const decomposition = await this.decomposer.decompose(objective, context);
      await this.publish('enterprise.goal.decomposed', params.tenantId, {
        requestId,
        objectiveId: objective.id,
        goalCount: decomposition.goals.length,
      });

      // 4. Deterministic specialist selection → 5. Coordination
      const specialists = this.selector.select(objective);
      for (const s of specialists) {
        await this.publish('enterprise.specialist.assigned', params.tenantId, {
          requestId,
          role: s.role,
          department: s.department,
        });
      }
      const opinions = await this.coordinator.coordinate({
        tenantId: params.tenantId,
        objective,
        specialists,
        context,
      });

      // 6. Strategy + 7. Recommendations
      const strategicFindings = await this.strategy.evaluate(
        params.tenantId,
        context,
      );
      const recommendations = await this.recommender.recommend({
        tenantId: params.tenantId,
        objective,
        decomposition,
        opinions,
        context,
      });
      for (const r of recommendations) {
        await this.publish(
          'enterprise.recommendation.created',
          params.tenantId,
          {
            requestId,
            recommendationId: r.id,
            priority: r.priority,
            shouldBecomeWorkRun: r.shouldBecomeWorkRun,
          },
        );
      }

      // 8. Cognitive scoring
      const partial = {
        requestId,
        tenantId: params.tenantId,
        objective,
        decomposition,
        specialistOpinions: opinions,
        recommendations,
        strategicFindings,
      };
      const score = this.evaluator.score(partial);

      // 9. OPTIONAL governed handoff — delegated to AIEmployeeCore. Only the
      // core creates AND executes the WorkRun (never left dormant in CREATED).
      // Without a concrete Employee the handoff is BLOCKED, never run dormant.
      const handedOffWorkRunIds: string[] = [];
      const blockedHandoffReasons: string[] = [];
      if (params.autoHandoff) {
        for (const r of recommendations.filter(
          (x) => x.shouldBecomeWorkRun && x.proposedWorkRequest,
        )) {
          if (!params.handoffEmployeeId) {
            blockedHandoffReasons.push(
              `recommendation ${r.id} blocked: no handoffEmployeeId supplied`,
            );
            continue;
          }
          try {
            const run = await this.core.start({
              tenantId: params.tenantId,
              employeeId: params.handoffEmployeeId,
              requestedBy: {
                actorId: params.actorId,
                actorType: params.actorType,
              },
              objective: r.proposedWorkRequest!,
              trigger: { type: 'EVENT', sourceId: requestId },
              idempotencyKey: `cognition-handoff:${requestId}:${createHash('sha256').update(r.proposedWorkRequest!).digest('hex').slice(0, 16)}`,
              context: {
                projectId: params.scope?.projectId,
                customerId: params.scope?.customerId,
              },
            });
            handedOffWorkRunIds.push(run.id);
          } catch (e) {
            blockedHandoffReasons.push(
              `recommendation ${r.id} failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      }

      if (blockedHandoffReasons.length > 0) {
        this.logger.warn(
          `EnterpriseCognition handoff: ${blockedHandoffReasons.join('; ')}`,
        );
      }

      await this.publish('enterprise.cognition.completed', params.tenantId, {
        requestId,
        recommendationCount: recommendations.length,
        handedOff: handedOffWorkRunIds.length,
      });

      return {
        ...partial,
        score,
        producedAt: new Date().toISOString(),
        handedOffWorkRunIds,
      };
    } catch (e) {
      await this.publish('enterprise.cognition.failed', params.tenantId, {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private summarize(assembled: {
    identity: {
      role: string;
      authorityLevel: number;
      departmentId: string | null;
    };
    capabilities: Record<
      string,
      {
        authorization: { access: string };
        data: Record<string, unknown>;
        unavailable?: boolean;
      }
    >;
  }): Record<string, unknown> {
    const caps: Record<string, unknown> = {};
    for (const [cap, ctx] of Object.entries(assembled.capabilities)) {
      caps[cap] = {
        access: ctx.authorization.access,
        unavailable: ctx.unavailable ?? false,
        data: ctx.authorization.access === 'DENIED' ? '[DENIED]' : ctx.data,
      };
    }
    return { identity: assembled.identity, capabilities: caps };
  }

  private async publish(
    eventType: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.transport.publish({
        eventType,
        tenantId,
        actorType: 'SYSTEM',
        idempotencyKey: `${eventType}:${payload.requestId ?? ''}:${payload.recommendationId ?? payload.role ?? payload.objectiveId ?? Date.now()}`,
        sourceModule: 'enterprise-cognition',
        payload,
      });
    } catch (e) {
      this.logger.warn(
        `Failed to publish ${eventType}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
