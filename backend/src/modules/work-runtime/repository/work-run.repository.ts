/**
 * WorkRunRepository — durable persistence for runs + steps (ADR-003).
 * Tenant-scoped, optimistic concurrency on run.version. This is the ONLY place
 * in the runtime that touches Prisma (for its OWN tables) — the runtime
 * orchestration/planner layers never import Prisma (architecture test).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateRunInput,
  ToolEffect,
  WorkPlan,
  WorkRunStatus,
  WorkRunStepStatus,
} from '../contracts/work-runtime.interface';

interface ReplayComparableRun {
  employeeId: string | null;
  requestedByActorId: string | null;
  request: string;
  taskId: string | null;
  triggerType: string;
  triggerSourceId: string | null;
}

@Injectable()
export class WorkRunRepository {
  private readonly logger = new Logger(WorkRunRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: CreateRunInput) {
    if (input.employeeId) {
      throw new Error(
        'Employee-aware WorkRuns must use createOrGetByIdempotencyKey',
      );
    }
    return this.prisma.workRun.create({
      data: this.createData(input),
    });
  }

  /**
   * Atomic Employee-run creation under the database unique boundary
   * (tenantId, idempotencyKey). A racing caller receives the committed row.
   */
  async createOrGetByIdempotencyKey(
    input: CreateRunInput & {
      idempotencyKey: string;
      employeeId: string;
      requestedByActorId: string;
    },
  ): Promise<{
    run: Awaited<ReturnType<WorkRunRepository['createRun']>>;
    created: boolean;
  }> {
    const prisma = this.prisma as PrismaClient;
    try {
      return await prisma.$transaction(async (tx) => {
        const employee = await tx.agent.findFirst({
          where: { id: input.employeeId, tenantId: input.tenantId },
          select: { id: true },
        });
        if (!employee) {
          throw new Error('executing employee was not found for tenant');
        }
        const existing = await tx.workRun.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          } as never,
        });
        if (existing) {
          this.assertReplayMatches(
            existing as unknown as ReplayComparableRun,
            input,
          );
          return { run: existing, created: false };
        }

        const run = await tx.workRun.create({
          data: this.createData(input),
        });
        return { run, created: true };
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const run = await prisma.workRun.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey,
          },
        } as never,
      });
      if (!run) throw error;
      this.assertReplayMatches(run as unknown as ReplayComparableRun, input);
      return { run, created: false };
    }
  }

  private createData(
    input: CreateRunInput,
  ): Prisma.WorkRunUncheckedCreateInput {
    return {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType,
      hermesAgentId: input.hermesAgentId ?? null,
      employeeId: input.employeeId ?? null,
      requestedByActorId: input.requestedByActorId ?? null,
      taskId: input.taskId ?? null,
      triggerType: input.triggerType ?? 'USER',
      triggerSourceId: input.triggerSourceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      parentRunId: input.parentRunId ?? null,
      workspaceId: input.workspaceId ?? null,
      threadId: input.threadId ?? null,
      request: input.request,
      contextProvenance: input.contextProvenance as Prisma.InputJsonValue,
      status: 'CREATED',
    } as unknown as Prisma.WorkRunUncheckedCreateInput;
  }

  private assertReplayMatches(
    run: ReplayComparableRun,
    input: CreateRunInput & {
      idempotencyKey: string;
      employeeId: string;
      requestedByActorId: string;
    },
  ): void {
    const matches =
      run.employeeId === (input.employeeId ?? null) &&
      run.requestedByActorId === (input.requestedByActorId ?? null) &&
      run.request === input.request &&
      run.taskId === (input.taskId ?? null) &&
      run.triggerType === (input.triggerType ?? 'USER') &&
      run.triggerSourceId === (input.triggerSourceId ?? null);
    if (!matches) {
      throw new Error(
        'idempotency key is already bound to different Employee run metadata',
      );
    }
  }

  async findRun(runId: string, tenantId: string) {
    // Tenant-scoped: never returns another tenant's run.
    return this.prisma.workRun.findFirst({ where: { id: runId, tenantId } });
  }

  async listRuns(
    tenantId: string,
    filter: {
      employeeId?: string;
      status?: WorkRunStatus;
      taskId?: string;
    } = {},
  ) {
    return this.prisma.workRun.findMany({
      where: {
        tenantId,
        employeeId: filter.employeeId,
        status: filter.status,
        taskId: filter.taskId,
      } as unknown as Prisma.WorkRunWhereInput,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listSteps(runId: string, tenantId: string) {
    return this.prisma.workRunStep.findMany({
      where: { runId, tenantId },
      orderBy: { sequence: 'asc' },
    });
  }

  /** Optimistic-concurrency run update: only succeeds if version matches. */
  async updateRun(
    runId: string,
    tenantId: string,
    expectedVersion: number,
    data: Partial<{
      status: WorkRunStatus;
      currentStepIndex: number;
      planVersion: number;
      plan: WorkPlan;
      summary: string;
      failureCode: string;
      failureReason: string;
      startedAt: Date;
      pausedAt: Date;
      completedAt: Date;
      cancelledAt: Date;
      failedAt: Date;
    }>,
  ): Promise<boolean> {
    const res = await this.prisma.workRun.updateMany({
      where: { id: runId, tenantId, version: expectedVersion },
      data: {
        ...data,
        plan: data.plan
          ? (data.plan as unknown as Prisma.InputJsonValue)
          : undefined,
        version: { increment: 1 },
      } as Prisma.WorkRunUpdateManyMutationInput,
    });
    return res.count === 1;
  }

  async createStep(input: {
    runId: string;
    tenantId: string;
    sequence: number;
    toolName: string;
    capability: string;
    operationType: ToolEffect;
    input: Record<string, unknown>;
    idempotencyKey: string;
  }) {
    return this.prisma.workRunStep.create({
      data: {
        runId: input.runId,
        tenantId: input.tenantId,
        sequence: input.sequence,
        toolName: input.toolName,
        capability: input.capability,
        operationType: input.operationType,
        input: input.input as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        status: 'PENDING',
      },
    });
  }

  async updateStep(
    stepId: string,
    tenantId: string,
    data: Partial<{
      status: WorkRunStepStatus;
      governanceDecision: string;
      governanceReason: string;
      policySource: string;
      approvalId: string;
      attemptCount: number;
      result: Record<string, unknown>;
      errorCode: string;
      errorMessage: string;
      startedAt: Date;
      completedAt: Date;
    }>,
  ): Promise<void> {
    await this.prisma.workRunStep.updateMany({
      where: { id: stepId, tenantId },
      data: {
        ...data,
        result: data.result
          ? (data.result as Prisma.InputJsonValue)
          : undefined,
      } as Prisma.WorkRunStepUpdateManyMutationInput,
    });
  }

  /** Atomic step claim: PENDING/APPROVED → RUNNING only once (two-worker safe). */
  async claimStep(
    stepId: string,
    tenantId: string,
    from: WorkRunStepStatus[],
  ): Promise<boolean> {
    const res = await this.prisma.workRunStep.updateMany({
      where: { id: stepId, tenantId, status: { in: from } },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    return res.count === 1;
  }

  async findStepByApproval(approvalId: string, tenantId: string) {
    return this.prisma.workRunStep.findFirst({
      where: { approvalId, tenantId },
    });
  }

  /** Business-effect idempotency: has this key already produced a step effect? */
  async findSucceededByIdempotencyKey(
    idempotencyKey: string,
    tenantId: string,
  ) {
    return this.prisma.workRunStep.findFirst({
      where: { tenantId, idempotencyKey, status: 'SUCCEEDED' },
    });
  }
}
