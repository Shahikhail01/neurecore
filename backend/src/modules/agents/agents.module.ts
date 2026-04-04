import { Module, forwardRef } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { DeploymentController } from './deployment.controller';
import { AgentsService } from './services/agents.service';
import { AgentPlannerService } from './services/agent-planner.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { AgentEvaluatorService } from './services/agent-evaluator.service';
import { DeploymentService } from './services/deployment.service';
import { EventsModule } from '../events/events.module';
import { ToolsModule } from '../tools/tools.module';
import { GovernanceModule } from '../governance/governance.module';
import { ModelsModule } from '../models/models.module';
import { AgentStreamingService } from './streaming/agent-streaming.service';
import { AgentStreamingController } from './streaming/agent-streaming.controller';
import { OfficialAgentGraph } from './langgraph/langgraph-official';
import { AgentCheckpointService } from './langgraph/checkpoint.service';
import { SecurityModule } from './security/security.module';

/**
 * AgentsModule
 *
 * SOLID — OCP: new agent types/services added without modifying this module.
 * DIP: all providers injected via module system, not constructed directly.
 */
@Module({
  imports: [
    forwardRef(() => EventsModule),
    ToolsModule,
    GovernanceModule,
    ModelsModule,
    SecurityModule, // Security interceptors for tool validation
  ],
  controllers: [
    AgentsController,
    DeploymentController,
    AgentStreamingController,
  ],
  providers: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    DeploymentService,
    AgentStreamingService,
    OfficialAgentGraph,
    AgentCheckpointService,
  ],
  exports: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    DeploymentService,
    AgentStreamingService,
    OfficialAgentGraph,
    AgentCheckpointService,
  ],
})
export class AgentsModule {}
