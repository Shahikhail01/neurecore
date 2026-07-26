// src/modules/project-automation/infrastructure/prisma-task.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ITaskRepository, TaskUpsertInput } from '../domain/ports/task-template-repository.port';

@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByTemplateKey(input: TaskUpsertInput, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    await client.task.upsert({
      where: {
        tenantId_projectId_automationVersion_templateKey: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          automationVersion: input.automationVersion,
          templateKey: input.templateKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        goalId: input.goalId,
        automationVersion: input.automationVersion,
        templateKey: input.templateKey,
        title: input.title,
        priority: 'MEDIUM',
        requiredRole: input.requiredRole,
        requiredCapabilities: input.requiredCapabilities,
        status: 'PENDING',
      },
      update: {
        title: input.title,
      },
    });
  }
}
