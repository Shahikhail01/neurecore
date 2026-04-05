import { Module } from '@nestjs/common';
import {
  TasksController,
  WorkflowsController,
} from './orchestration.controller';
import { TasksService } from './services/tasks.service';
import { WorkflowsService } from './services/workflows.service';
import { MultiAgentOrchestratorService } from './services/multi-agent-orchestrator.service';
import { CsvExportService } from '../../shared/services/csv-export.service';

@Module({
  controllers: [TasksController, WorkflowsController],
  providers: [
    TasksService,
    WorkflowsService,
    MultiAgentOrchestratorService,
    CsvExportService,
  ],
  exports: [
    TasksService,
    WorkflowsService,
    MultiAgentOrchestratorService,
    CsvExportService,
  ],
})
export class OrchestrationModule {}
