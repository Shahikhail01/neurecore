import { Module, forwardRef } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { DeploymentController } from './deployment.controller';
import { AgentInvocationsController } from './agent-invocations.controller';
import { AgentsService } from './services/agents.service';
import { AgentPlannerService } from './services/agent-planner.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { AgentEvaluatorService } from './services/agent-evaluator.service';
import { AgentInvocationsService } from './services/agent-invocations.service';
import { DeploymentService } from './services/deployment.service';
import { EventsModule } from '../events/events.module';
import { ToolsModule } from '../tools/tools.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { GovernanceModule } from '../governance/governance.module';
import { ModelsModule } from '../models/models.module';
import { AgentStreamingService } from './streaming/agent-streaming.service';
import { AgentStreamingController } from './streaming/agent-streaming.controller';
import { OfficialAgentGraph } from './langgraph/langgraph-official';
import { AgentCheckpointService } from './langgraph/checkpoint.service';
import { SecurityModule } from './security/security.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { MetricsModule } from '../metrics/metrics.module';
import { TenantTemplatesModule } from '../tenant-templates/tenant-templates.module';
import { ChatResponseModule } from '../chat/responses/chat-response.module';
import { AiEmployeeCoreModule } from '../ai-employee-core/ai-employee-core.module';
import {
  AgentTenantScopeGuard,
  AGENT_TENANT_SCOPE,
} from './agents-tenant-scope.guard';

/**
 * AgentsModule
 *
 * SOLID — OCP: new agent types/services added without modifying this module.
 * DIP: all providers injected via module system, not constructed directly.
 */
@Module({
  imports: [
    forwardRef(() => EventsModule),
    forwardRef(() => ToolsModule),
    forwardRef(() => IntegrationsModule),
    GovernanceModule,
    ModelsModule,
    SecurityModule,
    AIGatewayModule,
    MetricsModule,
    TenantTemplatesModule,
    forwardRef(() => ChatResponseModule),
    forwardRef(() => AiEmployeeCoreModule),
  ],
  controllers: [
    AgentsController,
    DeploymentController,
    AgentStreamingController,
    AgentInvocationsController,
  ],
  providers: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    AgentInvocationsService,
    DeploymentService,
    AgentStreamingService,
    OfficialAgentGraph,
    AgentCheckpointService,
    AgentTenantScopeGuard,
    { provide: AGENT_TENANT_SCOPE, useExisting: AgentTenantScopeGuard },
  ],
  exports: [
    AgentsService,
    AgentPlannerService,
    AgentExecutorService,
    AgentEvaluatorService,
    AgentInvocationsService,
    DeploymentService,
    AgentStreamingService,
    OfficialAgentGraph,
    AgentCheckpointService,
    AgentTenantScopeGuard,
    AGENT_TENANT_SCOPE,
  ],
})
export class AgentsModule {}
