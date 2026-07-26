// src/modules/projects/infrastructure/prisma-project.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IProjectRepository,
  ProjectAggregate,
  CreateProjectInput,
} from '../domain/ports/project-repository.port';
import { AwlExecutionEngine as ExecutionEngine } from '@prisma/client';

/**
 * Prisma adapter for IProjectRepository.
 * ONLY place in projects module that imports Prisma directly.
 */
@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toAggregate(row: any): ProjectAggregate | null {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      customerId: row.customerId,
      targetDate: row.targetDate,
      status: row.status,
      executionEngineVersion: row.executionEngineVersion,
      initiationId: row.initiationId,
      version: row.version ?? 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(tenantId: string, id: string): Promise<ProjectAggregate | null> {
    const row = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    return this.toAggregate(row);
  }

  async findByInitiationId(tenantId: string, initiationId: string): Promise<ProjectAggregate | null> {
    const row = await this.prisma.project.findFirst({
      where: { tenantId, initiation: { id: initiationId } },
    });
    return this.toAggregate(row);
  }

  async create(input: CreateProjectInput): Promise<ProjectAggregate> {
    const row = await this.prisma.project.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        customerId: input.customerId,
        targetDate: input.targetDate,
        initiation: input.initiationId
          ? { connect: { id: input.initiationId } }
          : undefined,
        executionEngineVersion: input.executionEngineVersion,
        status: (input.status as any) ?? 'ACTIVE',
      },
    });
    return this.toAggregate(row)!;
  }
}
