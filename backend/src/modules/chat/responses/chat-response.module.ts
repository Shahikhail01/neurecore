import {
  Module,
  OnApplicationBootstrap,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ProjectsModule } from '../../projects/projects.module';
import { CustomersModule } from '../../customers/customers.module';
import { ToolsModule } from '../../tools/tools.module';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { ResponseEnvelopeBuilder } from './builders/response-envelope.builder';
import { ServiceGatewayTool } from './services/service-gateway.tool';
import { GoalsModule } from '../../goals/goals.module';
import { OrchestrationModule } from '../../orchestration/orchestration.module';
import { DepartmentsModule } from '../../departments/departments.module';
import { AgentsModule } from '../../agents/agents.module';
import { ApprovalsModule } from '../../approvals/approvals.module';
import { WorkflowsModule } from '../../workflows/workflows.module';
import { DeliverablesModule } from '../../deliverables/deliverables.module';
import { AssignmentsModule } from '../../assignments/assignments.module';
import { InboxModule } from '../../inbox/inbox.module';
import { CostsModule } from '../../costs/costs.module';
import { ComplianceModule } from '../../compliance/compliance.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { ConnectorsModule } from '../../connectors/connectors.module';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { WorkRuntimeModule } from '../../work-runtime/work-runtime.module';
import { CommandCenterModule } from '../../command-center/command-center.module';

/**
 * ChatResponseModule — Wires the service-gateway tool + envelope builder.
 *
 * SRP: only owns chat-response building. Business logic stays in the
 *      services the gateway routes to.
 * DIP: ServiceGatewayTool receives `ResponseEnvelopeBuilder` by injection
 *      (abstraction), never by import-and-instantiate.
 * OCP: new capabilities added to CAPABILITY_MAP without module changes.
 *
 * The module also registers `service.gateway` with the global
 * StructuredToolRegistry so the agent graph exposes it to the LLM
 * alongside the legacy 106-tool set. Registration is additive; the
 * legacy tools remain untouched for backward compatibility. We use
 * `OnApplicationBootstrap` so registration runs after all `onModuleInit`
 * hooks (including ToolsModule's `setTools()` batch) — guaranteeing we
 * don't race with the legacy tools' bootstrap.
 */
@Module({
  imports: [
    forwardRef(() => ProjectsModule),
    forwardRef(() => CustomersModule),
    forwardRef(() => ToolsModule),
    forwardRef(() => GoalsModule),
    forwardRef(() => OrchestrationModule),
    forwardRef(() => DepartmentsModule),
    forwardRef(() => AgentsModule),
    forwardRef(() => ApprovalsModule),
    forwardRef(() => WorkflowsModule),
    forwardRef(() => DeliverablesModule),
    forwardRef(() => AssignmentsModule),
    forwardRef(() => InboxModule),
    forwardRef(() => CostsModule),
    forwardRef(() => ComplianceModule),
    forwardRef(() => KnowledgeModule),
    forwardRef(() => ConnectorsModule),
    forwardRef(() => IntegrationsModule),
    forwardRef(() => WorkRuntimeModule),
    forwardRef(() => CommandCenterModule),
  ],
  providers: [ResponseEnvelopeBuilder, ServiceGatewayTool],
  exports: [ResponseEnvelopeBuilder, ServiceGatewayTool],
})
export class ChatResponseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChatResponseModule.name);

  constructor(
    private readonly registry: StructuredToolRegistry,
    private readonly serviceGateway: ServiceGatewayTool,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.register(this.serviceGateway);
    this.logger.log(
      `Registered '${this.serviceGateway.name}' with StructuredToolRegistry`,
    );
  }
}
