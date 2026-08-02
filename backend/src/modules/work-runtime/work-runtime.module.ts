/**
 * WorkRuntimeModule — Governed Work Runtime (ADR-003/004, Phase 4).
 *
 * Imports capability modules whose PUBLIC commands back the runtime tools, plus
 * GovernanceModule (IGovernanceEvaluator port). Context Plane + Event Fabric are
 * @Global. Consumers (approval-resume) + tool provider self-register on bootstrap.
 */

import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { ProjectsModule } from '../projects/projects.module';
import { CustomersModule } from '../customers/customers.module';
import { ProjectStagesModule } from '../project-stages/project-stages.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { ProjectMemoryModule } from '../project-memory/project-memory.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

import {
  TOOL_REGISTRY,
  WORK_PLANNER,
  RUNTIME_GOVERNANCE,
  WORK_RUNTIME,
} from './contracts/work-runtime.interface';
import { WorkRunRepository } from './repository/work-run.repository';
import { WorkRunContextRepository } from './persistence/work-run-context.repository';
import { ToolRegistry } from './registry/tool-registry.service';
import { RuntimeToolsProvider } from './tools/runtime-tools.provider';
import { WorkPlanner } from './planner/work-planner.service';
import { RuntimeGovernanceEvaluator } from './governance/runtime-governance.evaluator';
import { ToolExecutor } from './executor/tool-executor.service';
import { WorkRuntimeService } from './runtime/work-runtime.service';
import { WorkRunApprovalConsumer } from './consumers/work-run-approval.consumer';
import { WorkRuntimeController } from './work-runtime.controller';

@Module({
  imports: [
    GovernanceModule,
    ProjectsModule,
    CustomersModule,
    ProjectStagesModule,
    OrchestrationModule,
    ProjectMemoryModule,
    AIGatewayModule,
  ],
  controllers: [WorkRuntimeController],
  providers: [
    WorkRunRepository,
    WorkRunContextRepository,
    ToolExecutor,
    ToolRegistry,
    { provide: TOOL_REGISTRY, useExisting: ToolRegistry },
    RuntimeToolsProvider,
    WorkPlanner,
    { provide: WORK_PLANNER, useExisting: WorkPlanner },
    RuntimeGovernanceEvaluator,
    { provide: RUNTIME_GOVERNANCE, useExisting: RuntimeGovernanceEvaluator },
    WorkRuntimeService,
    { provide: WORK_RUNTIME, useExisting: WorkRuntimeService },
    WorkRunApprovalConsumer,
  ],
  exports: [WORK_RUNTIME, WorkRunContextRepository],
})
export class WorkRuntimeModule {}
