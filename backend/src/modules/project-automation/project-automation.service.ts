// src/modules/project-automation/project-automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AutomationStatus } from '@prisma/client';
import type {
  IOutboxRepository,
  OutboxEventRecord,
} from '../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../common/outbox/outbox-repository.port';
import { ProjectAutomationHandler } from './application/project-automation.handler';
import {
  AUTOMATION_TRANSITIONS,
  ProjectAutomationStatus,
} from './domain/automation-states';

@Injectable()
export class ProjectAutomationService {
  private readonly logger = new Logger(ProjectAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly handler: ProjectAutomationHandler,
  ) {}

  async onProjectCreated(
    projectId: string,
    projectTypeId: string,
    projectName: string,
    tenantId: string,
    actorId: string = 'SYSTEM',
  ): Promise<{
    agentsSpawned: number;
    goalsCreated: number;
    tasksCreated: number;
    chiefOfStaffAssigned: boolean;
    memorySeeded: boolean;
    logId: string;
    errors: string[];
  }> {
    const log = await this.prisma.projectAutomationLog.create({
      data: {
        projectId,
        event: 'PROJECT_CREATED',
        status: AutomationStatus.PENDING,
        triggeredBy: actorId,
      },
    });

    const errors: string[] = [];
    let agentsSpawned = 0;
    let goalsCreated = 0;
    let tasksCreated = 0;

    try {
      const fakeEvent: OutboxEventRecord = {
        id: log.id,
        tenantId,
        eventType: 'ProjectAutomationRequested',
        version: 1,
        actorId,
        actorType: 'SYSTEM',
        correlationId: log.id,
        causationId: null,
        idempotencyKey: `automation-requested:${projectId}`,
        sourceModule: 'project-automation',
        payload: { projectId, requestedBy: actorId },
        status: 'PENDING',
        retryCount: 0,
        lastError: null,
        lastErrorClassification: null,
        createdAt: log.createdAt,
        dispatchedAt: null,
        processingStartedAt: null,
        processedAt: null,
        processingWorkerId: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        processingCount: 0,
      };
      await this.handler.handleProjectAutomationRequested(fakeEvent);

      const goals = await this.prisma.goal.count({ where: { projectId } });
      const tasks = await this.prisma.task.count({ where: { projectId } });
      goalsCreated = goals;
      tasksCreated = tasks;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    return {
      agentsSpawned,
      goalsCreated,
      tasksCreated,
      chiefOfStaffAssigned: false,
      memorySeeded: false,
      logId: log.id,
      errors,
    };
  }

  async getAutomationStatus(
    tenantId: string,
    projectId: string,
  ): Promise<AutomationStatusView> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      include: {
        goals: { select: { id: true, templateKey: true, title: true } },
        tasks: {
          select: {
            id: true,
            templateKey: true,
            title: true,
            status: true,
            agentId: true,
            priority: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const logs = await this.prisma.projectAutomationLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const latestLog = logs[logs.length - 1] ?? null;
    const latestCompleted = [...logs]
      .reverse()
      .find((row) => row.status === AutomationStatus.COMPLETED);

    // Map internal AutomationStatus (DB enum) to canonical state machine.
    const canonical = mapCanonicalStatus(latestCompleted, latestLog);

    return {
      projectId,
      tenantId,
      canonical,
      lastLog: latestLog
        ? {
            id: latestLog.id,
            event: latestLog.event,
            status: latestLog.status,
            error: latestLog.error,
            triggeredBy: latestLog.triggeredBy,
            createdAt: latestLog.createdAt,
          }
        : null,
      progress: {
        goalsCreated: project.goals.length,
        tasksCreated: project.tasks.length,
        assignmentsCreated: 0,
      },
      tasks: project.tasks.map((t) => ({
        id: t.id,
        templateKey: t.templateKey,
        title: t.title,
        status: t.status,
        agentId: t.agentId,
        priority: t.priority,
        updatedAt: t.updatedAt,
      })),
      history: logs.map((row) => ({
        id: row.id,
        event: row.event,
        status: row.status,
        triggeredBy: row.triggeredBy,
        error: row.error,
        createdAt: row.createdAt,
      })),
    };
  }
}

export interface AutomationStatusView {
  projectId: string;
  tenantId: string;
  canonical: ProjectAutomationStatus;
  lastLog: {
    id: string;
    event: string;
    status: AutomationStatus;
    error: string | null;
    triggeredBy: string | null;
    createdAt: Date;
  } | null;
  progress: {
    goalsCreated: number;
    tasksCreated: number;
    assignmentsCreated: number;
  };
  tasks: Array<{
    id: string;
    templateKey: string | null;
    title: string;
    status: string;
    agentId: string | null;
    priority: string | null;
    updatedAt: Date;
  }>;
  history: Array<{
    id: string;
    event: string;
    status: AutomationStatus;
    triggeredBy: string | null;
    error: string | null;
    createdAt: Date;
  }>;
}

function mapCanonicalStatus(
  completed: { event: string; status: AutomationStatus } | null | undefined,
  latest: { event: string; status: AutomationStatus } | null,
): ProjectAutomationStatus {
  if (!latest) return ProjectAutomationStatus.NOT_REQUESTED;
  if (latest.status === AutomationStatus.PENDING)
    return ProjectAutomationStatus.REQUESTED;
  if (latest.status === AutomationStatus.COMPLETED || completed)
    return ProjectAutomationStatus.COMPLETED;
  if (latest.status === AutomationStatus.FAILED)
    return ProjectAutomationStatus.FAILED_FINAL;
  // Reference state machine transitions for documentation purposes.
  void AUTOMATION_TRANSITIONS;
  return ProjectAutomationStatus.NOT_REQUESTED;
}
