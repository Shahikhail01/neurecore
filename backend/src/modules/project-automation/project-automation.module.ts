// src/modules/project-automation/project-automation.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { TimelineModule } from '../timeline/timeline.module';
import { ProjectAutomationHandler } from './application/project-automation.handler';
import { ProjectAutomationController } from './project-automation.controller';
import { ProjectAutomationService } from './project-automation.service';
import { PrismaAutomationLogRepository } from './infrastructure/prisma-automation-log.repository';
import { PrismaGoalRepository } from './infrastructure/prisma-goal.repository';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import {
  AUTOMATION_LOG_REPOSITORY,
} from './domain/ports/automation-repository.port';
import { GOAL_REPOSITORY } from './domain/ports/goal-template-repository.port';
import { TASK_REPOSITORY } from './domain/ports/task-template-repository.port';

@Module({
  imports: [PersistenceModule, TimelineModule],
  controllers: [ProjectAutomationController],
  providers: [
    ProjectAutomationService,
    ProjectAutomationHandler,
    PrismaAutomationLogRepository,
    PrismaGoalRepository,
    PrismaTaskRepository,
    {
      provide: AUTOMATION_LOG_REPOSITORY,
      useExisting: PrismaAutomationLogRepository,
    },
    {
      provide: GOAL_REPOSITORY,
      useExisting: PrismaGoalRepository,
    },
    {
      provide: TASK_REPOSITORY,
      useExisting: PrismaTaskRepository,
    },
  ],
  exports: [ProjectAutomationService],
})
export class ProjectAutomationModule implements OnApplicationBootstrap {
  constructor(
    private readonly outboxWorker: OutboxWorker,
    private readonly handler: ProjectAutomationHandler,
  ) {}

  onApplicationBootstrap() {
    this.outboxWorker.registerHandler(
      'ProjectAutomationRequested',
      async (event) => this.handler.handleProjectAutomationRequested(event),
    );
  }
}
