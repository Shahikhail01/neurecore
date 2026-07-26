// src/common/persistence/prisma-task.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ITaskRepository,
  TaskEntity,
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
      version: 1,
      agentId: row.agentId,
    };
  }

  async findById(tenantId: string, id: string): Promise<TaskEntity | null> {
    const row = await this.prisma.task.findFirst({ where: { id, tenantId } });
    return row ? this.toEntity(row) : null;
  }

  async updateStatus(
    input: UpdateTaskStatusInput,
    tx?: any,
  ): Promise<TaskEntity> {
    const client = tx ?? this.prisma;
    const data: any = { status: input.status };
    if (input.agentId !== undefined) data.agentId = input.agentId;
    const row = await client.task.update({
      where: { id: input.id },
      data,
    });
    return this.toEntity(row);
  }

  async countActiveByAgent(
    agentId: string,
    statuses: TaskStatus[],
  ): Promise<number> {
    return this.prisma.task.count({
      where: { agentId, status: { in: statuses } },
    });
  }
}
