// src/modules/assignments/infrastructure/prisma-task-assignment.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CreateAssignmentOverrideAuditInput,
  CreateTaskAssignmentInput,
  ITaskAssignmentRepository,
  TaskAssignmentEntity,
  TaskAssignmentOverrideAuditEntity,
  UpdateTaskAssignmentStatusInput,
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
      version: row.version ?? 1,
      releasedAt: row.releasedAt ?? null,
      releasedByActorId: row.releasedByActorId ?? null,
      releaseReason: row.releaseReason ?? null,
      expiresAt: row.expiresAt ?? null,
    };
  }

  async findByGeneration(
    tenantId: string,
    taskId: string,
    generation: number,
    tx?: any,
  ): Promise<TaskAssignmentEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.taskAssignment.findUnique({
      where: {
        tenantId_taskId_generation: { tenantId, taskId, generation },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findLatestActive(
    tenantId: string,
    taskId: string,
    tx?: any,
  ): Promise<TaskAssignmentEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.taskAssignment.findFirst({
      where: { tenantId, taskId, status: 'ACTIVE' },
      orderBy: { generation: 'desc' },
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
        status: input.status ?? 'ACTIVE',
        expiresAt: input.expiresAt ?? null,
      },
    });
    return this.toEntity(row);
  }

  async updateStatus(
    input: UpdateTaskAssignmentStatusInput,
    tx?: any,
  ): Promise<TaskAssignmentEntity> {
    const client = tx ?? this.prisma;
    const data: Prisma.TaskAssignmentUpdateInput = {
      status: input.status,
      version: { increment: 1 },
    };
    if (input.releasedAt !== undefined) data.releasedAt = input.releasedAt;
    if (input.releasedByActorId !== undefined) {
      data.releasedByActorId = input.releasedByActorId;
    }
    if (input.releaseReason !== undefined) data.releaseReason = input.releaseReason;

    const updated = await client.taskAssignment
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

  async releaseExpired(now: Date, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const expired = await client.taskAssignment.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { not: null, lte: now },
      },
      select: { id: true, version: true },
      take: 200,
    });
    let promoted = 0;
    for (const row of expired) {
      const res = await client.taskAssignment.updateMany({
        where: { id: row.id, version: row.version, status: 'ACTIVE' },
        data: {
          status: 'EXPIRED',
          releasedAt: now,
          releaseReason: 'assignment-expired',
          version: { increment: 1 },
        },
      });
      if (res.count === 1) promoted++;
    }
    return promoted;
  }

  async recordOverrideAudit(
    input: CreateAssignmentOverrideAuditInput,
    tx?: any,
  ): Promise<TaskAssignmentOverrideAuditEntity> {
    const client = tx ?? this.prisma;
    const row = await client.taskAssignmentOverrideAudit.create({
      data: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        assignmentGeneration: input.assignmentGeneration,
        previousAgentId: input.previousAgentId ?? null,
        rationale: input.rationale,
        overrideByActorId: input.overrideByActorId,
        overrideByActorType: input.overrideByActorType,
        dataClassificationAtOverride: input.dataClassificationAtOverride ?? null,
      },
    });
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      agentId: row.agentId,
      assignmentGeneration: row.assignmentGeneration,
      previousAgentId: row.previousAgentId,
      rationale: row.rationale,
      overrideByActorId: row.overrideByActorId,
      overrideByActorType: row.overrideByActorType,
      dataClassificationAtOverride: row.dataClassificationAtOverride,
      occurredAt: row.occurredAt,
    };
  }

  async listOverrideAudits(
    tenantId: string,
    taskId: string,
    limit = 20,
  ): Promise<TaskAssignmentOverrideAuditEntity[]> {
    const rows = await this.prisma.taskAssignmentOverrideAudit.findMany({
      where: { tenantId, taskId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      agentId: row.agentId,
      assignmentGeneration: row.assignmentGeneration,
      previousAgentId: row.previousAgentId,
      rationale: row.rationale,
      overrideByActorId: row.overrideByActorId,
      overrideByActorType: row.overrideByActorType,
      dataClassificationAtOverride: row.dataClassificationAtOverride,
      occurredAt: row.occurredAt,
    }));
  }
}
