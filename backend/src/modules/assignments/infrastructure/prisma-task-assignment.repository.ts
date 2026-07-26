// src/modules/assignments/infrastructure/prisma-task-assignment.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ITaskAssignmentRepository,
  TaskAssignmentEntity,
  CreateTaskAssignmentInput,
} from '../domain/ports/task-assignment-repository.port';

@Injectable()
export class PrismaTaskAssignmentRepository implements ITaskAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): TaskAssignmentEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      agentId: row.agentId,
      generation: row.generation,
      rationale: row.rationale,
      status: row.status,
    };
  }

  async findByGeneration(
    tenantId: string,
    taskId: string,
    generation: number,
  ): Promise<TaskAssignmentEntity | null> {
    const row = await this.prisma.taskAssignment.findUnique({
      where: {
        tenantId_taskId_generation: { tenantId, taskId, generation },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(
    input: CreateTaskAssignmentInput,
    tx?: any,
  ): Promise<TaskAssignmentEntity> {
    const client = tx ?? this.prisma;
    const row = await client.taskAssignment.create({
      data: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        generation: input.generation,
        rationale: input.rationale,
        status: (input.status as any) ?? 'ACTIVE',
      },
    });
    return this.toEntity(row);
  }
}
