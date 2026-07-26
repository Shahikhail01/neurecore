// src/modules/project-automation/application/project-automation.handler.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { AutomationEventType, AutomationStatus } from '@prisma/client';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import type { IAuditRepository } from '../../../common/ports/audit.port';
import { AUDIT_REPOSITORY } from '../../../common/ports/audit.port';
import { TimelineService } from '../../timeline/timeline.service';
import type {
  IAutomationLogRepository,
} from '../domain/ports/automation-repository.port';
import { AUTOMATION_LOG_REPOSITORY } from '../domain/ports/automation-repository.port';
import type {
  IGoalRepository,
  GoalTemplateItem,
} from '../domain/ports/goal-template-repository.port';
import { GOAL_REPOSITORY } from '../domain/ports/goal-template-repository.port';
import type {
  ITaskRepository,
  TaskTemplateItem,
} from '../domain/ports/task-template-repository.port';
import { TASK_REPOSITORY } from '../domain/ports/task-template-repository.port';

export const GOLDEN_PATH_GOAL_TEMPLATES: GoalTemplateItem[] = [
  { templateKey: 'goal-categorize', title: 'Categorize transactions' },
  { templateKey: 'goal-reconcile', title: 'Reconcile bank statements' },
  { templateKey: 'goal-report', title: 'Generate financial report' },
];

export const GOLDEN_PATH_TASK_TEMPLATES: TaskTemplateItem[] = [
  {
    templateKey: '-input',
    title: 'Input data for goal',
    requiredRole: 'STAFF_ACCOUNTANT',
    requiredCapabilities: ['data_entry'],
  },
  {
    templateKey: '-verify',
    title: 'Verify goal',
    requiredRole: 'SENIOR_ACCOUNTANT',
    requiredCapabilities: ['review', 'reconciliation'],
  },
];

/**
 * Application handler — depends on PORTS only via DI tokens.
 * No PrismaService import. No direct database access.
 */
@Injectable()
export class ProjectAutomationHandler {
  private readonly logger = new Logger(ProjectAutomationHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(AUTOMATION_LOG_REPOSITORY)
    private readonly automationLogRepo: IAutomationLogRepository,
    @Inject(GOAL_REPOSITORY) private readonly goalRepo: IGoalRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly timeline: TimelineService,
  ) {}

  async handleProjectAutomationRequested(event: {
    id: string;
    tenantId: string;
    payload: any;
    correlationId: string;
  }): Promise<void> {
    const { projectId, automationConfig } = event.payload;

    const completedLog = await this.automationLogRepo.findCompletedForProject(
      event.tenantId,
      projectId,
      AutomationEventType.PROJECT_CREATED,
    );

    if (completedLog) {
      this.logger.log(`Project ${projectId} automation already complete`);
      return;
    }

    try {
      await this.uow.execute(async (tx) => {
        await this.automationLogRepo.create(
          {
            projectId,
            event: AutomationEventType.PROJECT_CREATED,
            status: AutomationStatus.PENDING,
            triggeredBy: event.payload.requestedBy ?? 'SYSTEM',
          },
          tx,
        );

        if (automationConfig?.generateGoals !== false) {
          await this.materializeGoals(tx, projectId, event.tenantId);
        }

        if (automationConfig?.generateTasks !== false) {
          await this.materializeTasks(tx, projectId, event.tenantId);
        }

        await this.automationLogRepo.create(
          {
            projectId,
            event: AutomationEventType.STAGE_COMPLETED,
            status: AutomationStatus.COMPLETED,
            triggeredBy: event.payload.requestedBy ?? 'SYSTEM',
          },
          tx,
        );

        await this.outboxRepo.publish(
          {
            tenantId: event.tenantId,
            eventType: 'ProjectAutomationCompleted',
            sourceModule: 'project-automation',
            payload: { projectId },
            correlationId: event.correlationId,
            causationId: event.id,
            idempotencyKey: `automation-completed:${projectId}`,
          },
          tx,
        );

        await this.auditRepo.record({
          tenantId: event.tenantId,
          actor: event.payload.requestedBy ?? 'SYSTEM',
          action: 'PROJECT_AUTOMATION_COMPLETED',
          resource: 'Project',
          resourceId: projectId,
          correlationId: event.correlationId,
          causationId: event.id ?? undefined,
          result: 'success',
        });
      });

      await this.timeline.record({
        tenantId: event.tenantId,
        projectId,
        occurredAt: new Date(),
        category: 'AI_ACTION',
        severity: 'LOW',
        sourceType: 'SERVICE_IDENTITY',
        title: 'Project automation completed',
        description: `Automation for project ${projectId} completed successfully`,
        relatedEntityType: 'Project',
        relatedEntityId: projectId,
        correlationId: event.correlationId,
        causationId: event.id,
      });
    } catch (e) {
      await this.markFailed(
        projectId,
        event.tenantId,
        e instanceof Error ? e.message : String(e),
        event,
      );
      throw e;
    }
  }

  private async materializeGoals(
    tx: any,
    projectId: string,
    tenantId: string,
  ): Promise<void> {
    for (const goal of GOLDEN_PATH_GOAL_TEMPLATES) {
      await this.goalRepo.upsertByTemplateKey(
        {
          tenantId,
          projectId,
          automationVersion: 1,
          templateKey: goal.templateKey,
          title: goal.title,
        },
        tx,
      );
    }
  }

  private async materializeTasks(
    tx: any,
    projectId: string,
    tenantId: string,
  ): Promise<void> {
    const goals = await this.goalRepo.findByProject(tenantId, projectId, tx);

    for (const goal of goals) {
      for (const template of GOLDEN_PATH_TASK_TEMPLATES) {
        const fullTemplateKey = `task-${goal.templateKey}${template.templateKey}`;
        const title = `${template.title} ${goal.title}`;
        await this.taskRepo.upsertByTemplateKey(
          {
            tenantId,
            projectId,
            automationVersion: 1,
            templateKey: fullTemplateKey,
            title,
            goalId: goal.id,
            requiredRole: template.requiredRole,
            requiredCapabilities: template.requiredCapabilities,
          },
          tx,
        );
      }
    }
  }

  private async markFailed(
    projectId: string,
    tenantId: string,
    error: string,
    event: any,
  ): Promise<void> {
    await this.automationLogRepo.create({
      projectId,
      event: AutomationEventType.PROJECT_CREATED,
      status: AutomationStatus.FAILED,
      triggeredBy: 'SYSTEM',
      error,
    });

    await this.outboxRepo.publish({
      tenantId,
      eventType: 'ProjectAutomationFailed',
      sourceModule: 'project-automation',
      payload: { projectId, error },
      correlationId: `failed-${projectId}-${Date.now()}`,
      causationId: event.id,
      idempotencyKey: `automation-failed:${projectId}:${Date.now()}`,
    });
  }
}
