// src/modules/execution/infrastructure/prisma-execution-attempt.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IExecutionAttemptRepository,
  ExecutionAttemptEntity,
  CreateExecutionAttemptInput,
  UpdateExecutionAttemptInput,
} from '../domain/ports/execution-attempt-repository.port';
import type { ExecutionAttemptStatus } from '@prisma/client';

@Injectable()
export class PrismaExecutionAttemptRepository implements IExecutionAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): ExecutionAttemptEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      agentId: row.agentId,
      executionRequestId: row.executionRequestId,
      attemptNumber: row.attemptNumber,
      status: row.status,
      policy: row.policy,
      version: 1,
    };
  }

  async findById(tenantId: string, id: string): Promise<ExecutionAttemptEntity | null> {
    const row = await this.prisma.executionAttempt.findFirst({ where: { id, tenantId } });
    return row ? this.toEntity(row) : null;
  }

  async findByRequestId(
    tenantId: string,
    taskId: string,
    executionRequestId: string,
  ): Promise<ExecutionAttemptEntity | null> {
    const row = await this.prisma.executionAttempt.findUnique({
      where: {
        tenantId_taskId_executionRequestId: { tenantId, taskId, executionRequestId },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findLastAttemptNumber(taskId: string): Promise<number> {
    const last = await this.prisma.executionAttempt.findFirst({
      where: { taskId },
      orderBy: { attemptNumber: 'desc' },
    });
    return last?.attemptNumber ?? 0;
  }

  async create(
    input: CreateExecutionAttemptInput,
    tx?: any,
  ): Promise<ExecutionAttemptEntity> {
    const client = tx ?? this.prisma;
    const row = await client.executionAttempt.create({
      data: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        executionRequestId: input.executionRequestId,
        attemptNumber: input.attemptNumber,
        status: input.status,
        policy: input.policy as any,
      },
    });
    return this.toEntity(row);
  }

  async update(
    input: UpdateExecutionAttemptInput,
    tx?: any,
  ): Promise<ExecutionAttemptEntity> {
    const client = tx ?? this.prisma;
    const data: any = { status: input.status };
    if (input.outputSummary !== undefined) data.outputSummary = input.outputSummary;
    if (input.submittedAt !== undefined) data.submittedAt = input.submittedAt;
    if (input.lastError !== undefined) data.lastError = input.lastError;
    if (input.lastErrorClassification !== undefined)
      data.lastErrorClassification = input.lastErrorClassification;
    const row = await client.executionAttempt.update({ where: { id: input.id }, data });
    return this.toEntity(row);
  }
}
