// src/common/persistence/prisma-task.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ITaskRepository,
  TaskEntity,
  UpdateTaskAssignmentInput,
  UpdateTaskStatusInput,
} from '../ports/task-repository.port';
import type { TaskStatus } from '@prisma/client';

@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): TaskEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      status: row.status,
      title: row.title,
      version: typeof row.version === 'number' ? row.version : 1,
      agentId: row.agentId ?? null,
      requiredRole: row.requiredRole ?? null,
      requiredCapabilities: row.requiredCapabilities ?? [],
      dataClassification: row.dataClassification ?? null,
      departmentId:
        row.departmentId ??
        (row.executionAttempt && row.executionAttempt[0]?.agent?.departmentId) ??
        null,
    };
  }

  async findById(tenantId: string, id: string): Promise<TaskEntity | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async updateStatus(
    input: UpdateTaskStatusInput,
    tx?: any,
  ): Promise<TaskEntity> {
    const client = tx ?? this.prisma;
    const data: Prisma.TaskUncheckedUpdateInput = { status: input.status };
    if (input.agentId !== undefined) data.agentId = input.agentId;

    const where: Prisma.TaskWhereUniqueInput = { id: input.id };
    if (input.requireVersionMatch !== false) {
      where.version = input.expectedVersion;
    }
    const updated = await client.task
      .update({ where, data })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new Error('OPTIMISTIC_LOCK_FAILED');
        }
        throw err;
      });
    return this.toEntity(updated);
  }

  async countActiveByAgent(
    agentId: string,
    statuses: TaskStatus[],
  ): Promise<number> {
    return this.prisma.task.count({
      where: { agentId, status: { in: statuses } },
    });
  }

  async updateAssignment(
    input: UpdateTaskAssignmentInput,
    tx?: any,
  ): Promise<TaskEntity> {
    const client = tx ?? this.prisma;
    const data: Prisma.TaskUncheckedUpdateInput = {
      agentId: input.agentId,
      status: input.status,
      version: { increment: 1 },
    };
    const updated = await client.task
      .update({
        where: {
          id: input.id,
          version: input.expectedVersion,
        },
        data,
      })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new Error('OPTIMISTIC_LOCK_FAILED');
        }
        throw err;
      });
    return this.toEntity(updated);
  }
}
