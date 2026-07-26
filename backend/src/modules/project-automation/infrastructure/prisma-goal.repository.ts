// src/modules/project-automation/infrastructure/prisma-goal.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IGoalRepository,
  GoalUpsertInput,
  GoalEntity,
} from '../domain/ports/goal-template-repository.port';

@Injectable()
export class PrismaGoalRepository implements IGoalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByTemplateKey(input: GoalUpsertInput, tx?: any): Promise<GoalEntity> {
    const client = tx ?? this.prisma;
    const row = await client.goal.upsert({
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
        automationVersion: input.automationVersion,
        templateKey: input.templateKey,
        title: input.title,
        description: input.description,
      },
      update: {
        title: input.title,
      },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      templateKey: row.templateKey,
      title: row.title,
    };
  }

  async findByProject(
    tenantId: string,
    projectId: string,
    tx?: any,
  ): Promise<GoalEntity[]> {
    const client = tx ?? this.prisma;
    const rows = await client.goal.findMany({
      where: { tenantId, projectId },
    });
    return rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      templateKey: row.templateKey,
      title: row.title,
    }));
  }
}
