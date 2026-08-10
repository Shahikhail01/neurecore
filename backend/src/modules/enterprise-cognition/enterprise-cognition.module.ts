/**
 * EnterpriseCognitionModule (Phase 5) — governed reasoning + coordination.
 *
 * Consumes Context Plane (@Global), Work Runtime (exported WORK_RUNTIME), Event
 * Fabric (@Global), and AI Gateway. Owns NO capability data/logic and never
 * executes — execution flows through the Work Runtime.
 */

import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AiEmployeeCoreModule } from '../ai-employee-core/ai-employee-core.module';

import {
  OBJECTIVE_ANALYZER,
  GOAL_DECOMPOSER,
  REASONING_ENGINE,
  RECOMMENDATION_ENGINE,
  AGENT_SELECTOR,
  AGENT_COORDINATOR,
  STRATEGY_EVALUATOR,
  PLANNING_MEMORY,
  COGNITIVE_EVALUATOR,
  ENTERPRISE_COGNITION,
} from './contracts/enterprise-cognition.interface';
import { AgentSelector } from './specialists/agent-selector.service';
import { ReasoningEngine, ObjectiveAnalyzer, GoalDecomposer } from './reasoning/reasoning-engines.service';
import { AgentCoordinator, RecommendationEngine, StrategyEvaluator, CognitiveEvaluator } from './reasoning/synthesis-engines.service';
import { PlanningMemoryService } from './planning-memory/planning-memory.service';
import { EnterpriseCognitionService } from './enterprise-cognition.service';
import { EnterpriseCognitionController } from './enterprise-cognition.controller';

@Module({
  imports: [AIGatewayModule, AiEmployeeCoreModule],
  controllers: [EnterpriseCognitionController],
  providers: [
    ReasoningEngine,
    { provide: REASONING_ENGINE, useExisting: ReasoningEngine },
    ObjectiveAnalyzer,
    { provide: OBJECTIVE_ANALYZER, useExisting: ObjectiveAnalyzer },
    GoalDecomposer,
    { provide: GOAL_DECOMPOSER, useExisting: GoalDecomposer },
    AgentSelector,
    { provide: AGENT_SELECTOR, useExisting: AgentSelector },
    AgentCoordinator,
    { provide: AGENT_COORDINATOR, useExisting: AgentCoordinator },
    RecommendationEngine,
    { provide: RECOMMENDATION_ENGINE, useExisting: RecommendationEngine },
    StrategyEvaluator,
    { provide: STRATEGY_EVALUATOR, useExisting: StrategyEvaluator },
    CognitiveEvaluator,
    { provide: COGNITIVE_EVALUATOR, useExisting: CognitiveEvaluator },
    PlanningMemoryService,
    { provide: PLANNING_MEMORY, useExisting: PlanningMemoryService },
    EnterpriseCognitionService,
    { provide: ENTERPRISE_COGNITION, useExisting: EnterpriseCognitionService },
  ],
  exports: [ENTERPRISE_COGNITION],
})
export class EnterpriseCognitionModule {}
