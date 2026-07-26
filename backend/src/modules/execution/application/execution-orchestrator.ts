// src/modules/execution/application/execution-orchestrator.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import type { IExecutionAttemptRepository } from '../domain/ports/execution-attempt-repository.port';
import { EXECUTION_ATTEMPT_REPOSITORY } from '../domain/ports/execution-attempt-repository.port';
import type { ITaskRepository } from '../../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../../common/ports/task-repository.port';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import { FailureClassification, FAILURE_HANDLING } from '../domain/execution-failures';
import type { ExecutionPolicy } from '../domain/execution-policy';
import type { ExecutionAttemptStatus } from '@prisma/client';

export interface ExecutionContext {
  attemptId: string;
  taskId: string;
  agentId: string;
  tenantId: string;
  policy: ExecutionPolicy;
  taskInstructions: string;
  projectContext: any;
  approvedInputs: any[];
  toolPolicy: any;
  resourceLimits: any;
}

/**
 * Application service — depends on PORTS only via DI tokens.
 * No PrismaService import. No direct database access.
 */
@Injectable()
export class ExecutionOrchestrator {
  private readonly logger = new Logger(ExecutionOrchestrator.name);
  private readonly activeExecutions: Map<string, { cancelled: boolean; heartbeatAt: Date }> = new Map();
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private readonly STALE_THRESHOLD_MS = 120000;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(EXECUTION_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IExecutionAttemptRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
  ) {}

  async requestExecution(
    taskId: string,
    agentId: string,
    executionRequestId: string,
    metadata: CommandMetadata,
  ): Promise<{ attemptId: string; attemptNumber: number }> {
    return this.uow.execute(async (tx) => {
      const task = await this.taskRepo.findById(metadata.tenantId, taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.tenantId !== metadata.tenantId) throw new Error('CROSS_TENANT_ACCESS_DENIED');

      const existing = await this.attemptRepo.findByRequestId(
        metadata.tenantId,
        taskId,
        executionRequestId,
      );
      if (existing) {
        return { attemptId: existing.id, attemptNumber: existing.attemptNumber };
      }

      const lastNumber = await this.attemptRepo.findLastAttemptNumber(taskId);
      const attemptNumber = lastNumber + 1;
      const policy = this.defaultPolicy(task);

      const initialStatus: ExecutionAttemptStatus = policy.requiresHumanApproval
        ? ('NEEDS_INPUT' as ExecutionAttemptStatus)
        : ('QUEUED' as ExecutionAttemptStatus);

      const attempt = await this.attemptRepo.create(
        {
          tenantId: metadata.tenantId,
          taskId,
          agentId,
          executionRequestId,
          attemptNumber,
          status: initialStatus,
          policy,
        },
        tx,
      );

      await this.taskRepo.updateStatus(
        {
          id: taskId,
          expectedVersion: 0,
          status: policy.requiresHumanApproval ? 'ASSIGNED' : 'QUEUED',
          agentId,
        },
        tx,
      );

      await this.outboxRepo.publish(
        {
          tenantId: metadata.tenantId,
          eventType: 'TaskExecutionRequested',
          sourceModule: 'execution',
          payload: {
            attemptId: attempt.id,
            taskId,
            agentId,
            attemptNumber,
          },
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey: `execution-requested:${attempt.id}`,
        },
        tx,
      );

      return { attemptId: attempt.id, attemptNumber };
    });
  }

  async executeTask(context: ExecutionContext): Promise<{ output: any; evidence: any[] }> {
    this.activeExecutions.set(context.attemptId, {
      cancelled: false,
      heartbeatAt: new Date(),
    });

    const heartbeatTimer = setInterval(() => {
      const exec = this.activeExecutions.get(context.attemptId);
      if (exec) {
        exec.heartbeatAt = new Date();
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    try {
      if (context.policy.timeoutMs) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('EXECUTION_TIMEOUT')), context.policy.timeoutMs);
        });

        const result = await Promise.race([
          this.runExecution(context),
          timeoutPromise,
        ]);

        return result;
      }

      return await this.runExecution(context);
    } finally {
      clearInterval(heartbeatTimer);
      this.activeExecutions.delete(context.attemptId);
    }
  }

  classifyFailure(error: Error): FailureClassification {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('timed_out'))
      return FailureClassification.TRANSIENT_INFRASTRUCTURE;
    if (message.includes('rate limit')) return FailureClassification.TRANSIENT_INFRASTRUCTURE;
    if (message.includes('invalid input')) return FailureClassification.INVALID_INPUT;
    if (message.includes('policy')) return FailureClassification.POLICY_DENIAL;
    if (message.includes('tool')) return FailureClassification.TOOL_FUNCTIONAL_FAILURE;
    if (message.includes('budget')) return FailureClassification.BUDGET_EXHAUSTION;
    if (message.includes('cancelled')) return FailureClassification.CANCELLATION;
    return FailureClassification.MODEL_QUALITY_FAILURE;
  }

  shouldRetry(classification: FailureClassification, attemptCount: number): boolean {
    const handling = FAILURE_HANDLING[classification];
    if (!handling.retryable) return false;
    if (handling.withinLimit && attemptCount >= 3) return false;
    return attemptCount < 3;
  }

  async cancel(attemptId: string, metadata: CommandMetadata): Promise<void> {
    const exec = this.activeExecutions.get(attemptId);
    if (exec) {
      exec.cancelled = true;
    }

    await this.uow.execute(async (tx) => {
      const attempt = await this.attemptRepo.findById(metadata.tenantId, attemptId);
      if (!attempt) return;
      await this.attemptRepo.update(
        { id: attemptId, status: 'CANCELLED' as ExecutionAttemptStatus },
        tx,
      );
    });
  }

  private async runExecution(
    context: ExecutionContext,
  ): Promise<{ output: any; evidence: any[] }> {
    return {
      output: { summary: 'Execution completed', instructions: context.taskInstructions },
      evidence: [],
    };
  }

  private defaultPolicy(task: any): ExecutionPolicy {
    return {
      taskId: task.id,
      autonomyLevel: 1,
      allowedTools: [],
      deniedTools: [],
      maxToolCalls: 50,
      maxTokens: 100000,
      maxCost: 1000,
      timeoutMs: 300000,
      requiresHumanApproval: true,
      externalSideEffectApproval: false,
      inputSources: [],
    };
  }
}
