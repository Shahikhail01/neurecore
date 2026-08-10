import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import {
  AI_EMPLOYEE_CORE,
  EMPLOYEE_IDENTITY_READER,
  EMPLOYEE_RESOLVER,
} from './ai-employee-core.tokens';
import { AIEmployeeCoreService } from './application/ai-employee-core.service';
import { AIEmployeeCoreController } from './controllers/ai-employee-core.controller';
import { EmployeeResolverService } from './identity/employee-resolver.service';
import { EmployeeIdentityReaderService } from './identity/employee-identity-reader.service';
import { EmployeeRunViewMapper } from './projections/employee-run-view.mapper';
import { SkillRuntimeToolsProvider } from './adapters/skill-runtime-tools.provider';
import { SummarizeSkillTool } from './adapters/skill-summarize.adapter';
import { ExtractSkillTool } from './adapters/skill-extract.adapter';
import { CompareSkillTool } from './adapters/skill-compare.adapter';
import { DraftReportSkillTool } from './adapters/skill-draft-report.adapter';
import { ReportSaveDraftTool } from './adapters/report-save-draft.adapter';
import { StepArtifactStorageService } from './adapters/step-artifact-storage.service';
import { EmployeeTaskToolsProvider } from './adapters/employee-task-tools.provider';
import { LegacyAgentDispatchAdapter } from './adapters/legacy-agent-dispatch.adapter';
import { AgentRunCompatAdapter } from './adapters/agent-run-compat.adapter';
import { EmployeeEligibilityService } from './eligibility/employee-eligibility.service';
import { ARTIFACT_STORAGE } from './contracts/artifact-storage.interface';
import { EMPLOYEE_ELIGIBILITY } from './contracts/employee-eligibility.interface';

@Module({
  imports: [
    forwardRef(() => AgentsModule),
    WorkRuntimeModule,
    OrchestrationModule,
  ],
  controllers: [AIEmployeeCoreController],
  providers: [
    EmployeeResolverService,
    EmployeeIdentityReaderService,
    EmployeeRunViewMapper,
    AIEmployeeCoreService,
    SummarizeSkillTool,
    ExtractSkillTool,
    CompareSkillTool,
    DraftReportSkillTool,
    ReportSaveDraftTool,
    StepArtifactStorageService,
    SkillRuntimeToolsProvider,
    EmployeeEligibilityService,
    EmployeeTaskToolsProvider,
    LegacyAgentDispatchAdapter,
    AgentRunCompatAdapter,
    { provide: EMPLOYEE_RESOLVER, useExisting: EmployeeResolverService },
    {
      provide: EMPLOYEE_IDENTITY_READER,
      useExisting: EmployeeIdentityReaderService,
    },
    { provide: AI_EMPLOYEE_CORE, useExisting: AIEmployeeCoreService },
    {
      provide: ARTIFACT_STORAGE,
      useExisting: StepArtifactStorageService,
    },
    { provide: EMPLOYEE_ELIGIBILITY, useExisting: EmployeeEligibilityService },
  ],
  exports: [
    AI_EMPLOYEE_CORE,
    EMPLOYEE_RESOLVER,
    EMPLOYEE_IDENTITY_READER,
    EmployeeRunViewMapper,
    LegacyAgentDispatchAdapter,
    AgentRunCompatAdapter,
  ],
})
export class AiEmployeeCoreModule {}
