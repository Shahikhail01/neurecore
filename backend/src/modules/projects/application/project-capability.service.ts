// src/modules/projects/application/project-capability.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExecutionEngine } from '@prisma/client';

export type AutomationState =
  | 'AUTOMATION_READY'
  | 'SETUP_IN_PROGRESS'
  | 'SETUP_INCOMPLETE'
  | 'LEGACY_PROJECT'
  | 'MIGRATION_NEEDS_REVIEW'
  | 'AUTOMATION_FAILED';

export interface ProjectAutomationCapability {
  engine: ExecutionEngine;
  state: AutomationState;
  canRequestSetup: boolean;
  canRetry: boolean;
  blockingReasons: string[];
}

@Injectable()
export class ProjectCapabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async classifyAutomationState(projectId: string): Promise<ProjectAutomationCapability> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        goals: true,
        tasks: true,
      },
    });

    if (!project) {
      return {
        engine: 'legacy',
        state: 'LEGACY_PROJECT',
        canRequestSetup: false,
        canRetry: false,
        blockingReasons: ['Project not found'],
      };
    }

    const engine = project.executionEngineVersion;

    const latestLog = await this.prisma.projectAutomationLog.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestLog?.status === 'COMPLETED') {
      return {
        engine,
        state: 'AUTOMATION_READY',
        canRequestSetup: false,
        canRetry: false,
        blockingReasons: [],
      };
    }

    if (latestLog?.status === 'PENDING') {
      return {
        engine,
        state: 'SETUP_IN_PROGRESS',
        canRequestSetup: false,
        canRetry: false,
        blockingReasons: [],
      };
    }

    if (latestLog?.status === 'FAILED') {
      return {
        engine,
        state: 'AUTOMATION_FAILED',
        canRequestSetup: false,
        canRetry: true,
        blockingReasons: ['Previous automation attempt failed'],
      };
    }

    if (project.goals?.length > 0 || project.tasks?.length > 0) {
      return {
        engine,
        state: 'MIGRATION_NEEDS_REVIEW',
        canRequestSetup: false,
        canRetry: false,
        blockingReasons: ['Partially automated; needs review'],
      };
    }

    return {
      engine,
      state: engine === 'canonical' ? 'LEGACY_PROJECT' : 'LEGACY_PROJECT',
      canRequestSetup: engine === 'canonical',
      canRetry: false,
      blockingReasons:
        engine === 'legacy' ? ['Engine is legacy; migration required'] : [],
    };
  }
}
