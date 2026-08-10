/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, ExecutionAttempt } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IExecutionAttemptRepository,
  ExecutionAttemptEntity,
  CreateExecutionAttemptInput,
  UpdateExecutionAttemptInput,
  ExecutionClaim,
} from '../domain/ports/execution-attempt-repository.port';

type TxClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaExecutionAttemptRepository implements IExecutionAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: ExecutionAttempt): ExecutionAttemptEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      agentId: row.agentId,
      executionRequestId: row.executionRequestId,
      attemptNumber: row.attemptNumber,
      status: row.status,
      policy: (row.policy ?? {}) as Record<string, unknown>,
      taskInstructionsSnapshot: row.taskInstructionsSnapshot,
      inputSnapshot: (row.inputSnapshot ?? {}) as Record<string, unknown>,
      projectContextSnapshot: (row.projectContextSnapshot ?? {}) as Record<
        string,
        unknown
      >,
      promptVersion: row.promptVersion,
      graphVersion: row.graphVersion,
      modelVersion: row.modelVersion,
      toolVersion: row.toolVersion,
      outputSummary: row.outputSummary,
      submittedAt: row.submittedAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      heartbeatAt: row.heartbeatAt,
      leaseExpiresAt: row.leaseExpiresAt,
      ownerToken: row.ownerToken,
      fencingToken: row.fencingToken,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      tokensUsed: row.tokensUsed,
      costCents: row.costCents,
      toolCallCount: row.toolCallCount,
      lastError: row.lastError,
      lastErrorClassification: row.lastErrorClassification,
      workRunId: row.workRunId,
      parentAttemptId: row.parentAttemptId,
      version: row.version,
    };
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ExecutionAttemptEntity | null> {
    const row = await this.prisma.executionAttempt.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByRequestId(
    tenantId: string,
    taskId: string,
    executionRequestId: string,
  ): Promise<ExecutionAttemptEntity | null> {
    const row = await this.prisma.executionAttempt.findUnique({
      where: {
        tenantId_taskId_executionRequestId: {
          tenantId,
          taskId,
          executionRequestId,
        },
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
    tx?: TxClient,
  ): Promise<ExecutionAttemptEntity> {
    const client = (tx ?? this.prisma) as PrismaService;
    const policy = input.policy as Record<string, unknown>;
    const row = await client.executionAttempt.create({
      data: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        executionRequestId: input.executionRequestId,
        attemptNumber: input.attemptNumber,
        status: input.status,
        policy: (policy ?? {}) as Prisma.InputJsonValue,
        taskInstructionsSnapshot: input.taskInstructionsSnapshot,
        inputSnapshot: (input.inputSnapshot ?? {}) as Prisma.InputJsonValue,
        projectContextSnapshot: (input.projectContextSnapshot ??
          {}) as Prisma.InputJsonValue,
        parentAttemptId: input.parentAttemptId,
        promptVersion:
          typeof policy.promptVersion === 'string'
            ? policy.promptVersion
            : null,
        graphVersion:
          typeof policy.graphVersion === 'string' ? policy.graphVersion : null,
        modelVersion:
          typeof policy.modelVersion === 'string' ? policy.modelVersion : null,
        toolVersion:
          typeof policy.toolVersion === 'string' ? policy.toolVersion : null,
        workRunId: input.workRunId ?? null,
      },
    });
    return this.toEntity(row);
  }

  async update(
    input: UpdateExecutionAttemptInput,
    tx?: TxClient,
  ): Promise<ExecutionAttemptEntity> {
    const client = (tx ?? this.prisma) as PrismaService;
    const data: Prisma.ExecutionAttemptUpdateInput = {
      status: input.status,
      version: { increment: 1 },
    };
    const optionalKeys = [
      'outputSummary',
      'submittedAt',
      'startedAt',
      'endedAt',
      'lastError',
      'lastErrorClassification',
      'cancelledAt',
      'cancellationReason',
      'tokensUsed',
      'costCents',
      'toolCallCount',
      'workRunId',
    ] as const;
    for (const key of optionalKeys) {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }
    const where: Prisma.ExecutionAttemptWhereUniqueInput = { id: input.id };
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.expectedVersion !== undefined)
      where.version = input.expectedVersion;
    if (input.ownerToken !== undefined) where.ownerToken = input.ownerToken;
    try {
      const row = await client.executionAttempt.update({ where, data });
      return this.toEntity(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new Error('EXECUTION_ATTEMPT_FENCED_OR_VERSION_CONFLICT');
      }
      throw error;
    }
  }

  async claimForExecution(
    tenantId: string,
    attemptId: string,
    leaseMs: number,
  ): Promise<ExecutionClaim | null> {
    const ownerToken = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.executionAttempt.findFirst({
        where: { id: attemptId, tenantId, status: 'QUEUED' },
      });
      if (!row) return null;
      const updated = await tx.executionAttempt.updateMany({
        where: {
          id: attemptId,
          tenantId,
          status: 'QUEUED',
          version: row.version,
        },
        data: {
          status: 'RUNNING',
          ownerToken,
          fencingToken: { increment: 1 },
          heartbeatAt: now,
          leaseExpiresAt,
          startedAt: now,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return null;
      const fresh = await tx.executionAttempt.findUnique({
        where: { id: attemptId },
      });
      return fresh;
    });
    return result ? { attempt: this.toEntity(result), ownerToken } : null;
  }

  async updateHeartbeat(
    tenantId: string,
    attemptId: string,
    ownerToken: string,
    leaseMs: number,
  ): Promise<void> {
    const now = new Date();
    const result = await this.prisma.executionAttempt.updateMany({
      where: { id: attemptId, tenantId, ownerToken, status: 'RUNNING' },
      data: {
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      },
    });
    if (result.count !== 1) throw new Error('EXECUTION_ATTEMPT_FENCED');
  }

  async findStaleAttempts(now: Date): Promise<ExecutionAttemptEntity[]> {
    const rows = await this.prisma.executionAttempt.findMany({
      where: { status: 'RUNNING', leaseExpiresAt: { lt: now } },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async cancelAtomic(
    tenantId: string,
    attemptId: string,
    reason: string,
  ): Promise<boolean> {
    const result = await this.prisma.executionAttempt.updateMany({
      where: {
        id: attemptId,
        tenantId,
        status: { in: ['QUEUED', 'RUNNING', 'PAUSED', 'NEEDS_INPUT'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        endedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async reclaimOrphan(
    tenantId: string,
    attemptId: string,
    expectedFencingToken: number,
    targetStatus: 'FAILED_FINAL' | 'FAILED_RETRYABLE',
    lastError: string,
  ): Promise<boolean> {
    const result = await this.prisma.executionAttempt.updateMany({
      where: {
        id: attemptId,
        tenantId,
        fencingToken: expectedFencingToken,
        status: 'RUNNING',
      },
      data: {
        status: targetStatus,
        lastError,
        lastErrorClassification: 'TRANSIENT_INFRASTRUCTURE',
        endedAt: new Date(),
        ownerToken: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async claimFromStale(
    tenantId: string,
    attemptId: string,
    expectedFencingToken: number,
    leaseMs: number,
  ): Promise<ExecutionClaim | null> {
    const ownerToken = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.executionAttempt.findFirst({
        where: {
          id: attemptId,
          tenantId,
          fencingToken: expectedFencingToken,
          status: 'RUNNING',
        },
      });
      if (!row) return null;
      const updated = await tx.executionAttempt.updateMany({
        where: {
          id: attemptId,
          tenantId,
          fencingToken: expectedFencingToken,
          status: 'RUNNING',
        },
        data: {
          ownerToken,
          fencingToken: { increment: 1 },
          heartbeatAt: now,
          leaseExpiresAt,
          version: { increment: 1 },
          lastError: null,
          lastErrorClassification: null,
        },
      });
      if (updated.count !== 1) return null;
      const fresh = await tx.executionAttempt.findUnique({
        where: { id: attemptId },
      });
      return fresh;
    });
    return result ? { attempt: this.toEntity(result), ownerToken } : null;
  }
}
