// src/modules/project-automation/project-automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AutomationStatus } from '@prisma/client';
import { ProjectAutomationHandler } from './application/project-automation.handler';

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
      await this.handler.handleProjectAutomationRequested({
        id: log.id,
        tenantId,
        payload: { projectId, requestedBy: actorId },
        correlationId: log.id,
      });

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

  async getAutomationStatus(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        goals: true,
        tasks: true,
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const latestLog = await this.prisma.projectAutomationLog.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      projectId,
      status: latestLog?.status ?? 'NOT_REQUESTED',
      lastProcessedAt: latestLog?.createdAt ?? null,
      lastError: latestLog?.error ?? null,
      progress: {
        goalsCreated: project.goals?.length ?? 0,
        tasksCreated: project.tasks?.length ?? 0,
        assignmentsCreated: 0,
      },
    };
  }
}
