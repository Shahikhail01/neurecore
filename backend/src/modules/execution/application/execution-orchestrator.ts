// src/modules/execution/application/execution-orchestrator.ts
import { Injectable, Inject } from '@nestjs/common';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import type { IExecutionAttemptRepository } from '../domain/ports/execution-attempt-repository.port';
import { EXECUTION_ATTEMPT_REPOSITORY } from '../domain/ports/execution-attempt-repository.port';
import type { ITaskRepository } from '../../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../../common/ports/task-repository.port';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import {
  FailureClassification,
  FAILURE_HANDLING,
} from '../domain/execution-failures';
import type { ExecutionPolicy } from '../domain/execution-policy';
import type { ExecutionAttemptStatus, TaskStatus } from '@prisma/client';
import { ExecutionPolicyEnforcer } from './execution-policy-enforcer';
import { AI_EMPLOYEE_CORE } from '../../ai-employee-core/ai-employee-core.tokens';
import type { IAIEmployeeCore } from '../../ai-employee-core/contracts/ai-employee-core.interface';

export interface ExecutionRuntimeResult {
  output: { summary: string; content: string };
  evidence: Array<{
    artifactType: 'DRAFT' | 'REPORT' | 'DOCUMENT' | 'DATA' | 'OUTPUT';
    content: string;
    mimeType: string;
  }>;
  tokensUsed: number;
  costCents: number;
  toolCallCount: number;
  /** Phase 8: the canonical Employee WorkRun that performed the business execution. */
  workRunId?: string;
}

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
  private readonly activeExecutions: Map<string, { cancelled: boolean }> =
    new Map();

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(EXECUTION_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IExecutionAttemptRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly policyEnforcer: ExecutionPolicyEnforcer,
    @Inject(AI_EMPLOYEE_CORE) private readonly core: IAIEmployeeCore,
  ) {}

  async requestExecution(
    taskId: string,
    agentId: string,
    executionRequestId: string,
    metadata: CommandMetadata,
  ): Promise<{ attemptId: string; attemptNumber: number }> {
    return this.uow.execute(async (tx) => {
      const task = await this.taskRepo.findById(metadata.tenantId, taskId, tx);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.tenantId !== metadata.tenantId)
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      if (task.agentId !== agentId)
        throw new Error('EXECUTION_AGENT_NOT_ASSIGNED');
      const eligible = new Set<TaskStatus>([
        'READY' as TaskStatus,
        'ASSIGNED' as TaskStatus,
        'QUEUED' as TaskStatus,
      ]);
      if (!eligible.has(task.status))
        throw new Error('TASK_NOT_ELIGIBLE_FOR_EXECUTION');

      const existing = await this.attemptRepo.findByRequestId(
        metadata.tenantId,
        taskId,
        executionRequestId,
      );
      if (existing) {
        return {
          attemptId: existing.id,
          attemptNumber: existing.attemptNumber,
        };
      }

      const lastNumber = await this.attemptRepo.findLastAttemptNumber(taskId);
      const attemptNumber = lastNumber + 1;
      const policy = this.defaultPolicy(task);
      this.policyEnforcer.validate(policy);

      const initialStatus: ExecutionAttemptStatus =
        'QUEUED' as ExecutionAttemptStatus;

      const attempt = await this.attemptRepo.create(
        {
          tenantId: metadata.tenantId,
          taskId,
          agentId,
          executionRequestId,
          attemptNumber,
          status: initialStatus,
          policy,
          taskInstructionsSnapshot: task.title,
          inputSnapshot: {
            requiredRole: task.requiredRole,
            requiredCapabilities: task.requiredCapabilities,
            dataClassification: task.dataClassification,
          },
        },
        tx,
      );

      await this.taskRepo.updateStatus(
        {
          id: taskId,
          tenantId: metadata.tenantId,
          expectedVersion: task.version,
          status: 'QUEUED',
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

  async executeTask(
    context: ExecutionContext,
  ): Promise<ExecutionRuntimeResult> {
    const policy: ExecutionPolicy = context.policy;
    this.policyEnforcer.validate(policy);
    this.activeExecutions.set(context.attemptId, { cancelled: false });

    let timeout: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('EXECUTION_TIMEOUT')),
          policy.timeoutMs,
        );
      });
      return await Promise.race([
        this.runExecution(context, policy),
        timeoutPromise,
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      this.activeExecutions.delete(context.attemptId);
    }
  }

  classifyFailure(error: Error): FailureClassification {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('timed_out'))
      return FailureClassification.TRANSIENT_INFRASTRUCTURE;
    if (message.includes('rate limit'))
      return FailureClassification.TRANSIENT_INFRASTRUCTURE;
    if (message.includes('invalid input'))
      return FailureClassification.INVALID_INPUT;
    if (message.includes('policy')) return FailureClassification.POLICY_DENIAL;
    if (message.includes('tool'))
      return FailureClassification.TOOL_FUNCTIONAL_FAILURE;
    if (message.includes('budget'))
      return FailureClassification.BUDGET_EXHAUSTION;
    if (message.includes('cancelled'))
      return FailureClassification.CANCELLATION;
    return FailureClassification.MODEL_QUALITY_FAILURE;
  }

  shouldRetry(
    classification: FailureClassification,
    attemptCount: number,
  ): boolean {
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

    const cancelled = await this.attemptRepo.cancelAtomic(
      metadata.tenantId,
      attemptId,
      'Cancelled by authorized actor',
    );
    if (!cancelled) {
      const attempt = await this.attemptRepo.findById(
        metadata.tenantId,
        attemptId,
      );
      if (!attempt) throw new Error('EXECUTION_ATTEMPT_NOT_FOUND');
      if (attempt.status !== 'CANCELLED')
        throw new Error('EXECUTION_ATTEMPT_NOT_CANCELLABLE');
    }
  }

  private async runExecution(
    context: ExecutionContext,
    policy: ExecutionPolicy,
  ): Promise<ExecutionRuntimeResult> {
    const active = this.activeExecutions.get(context.attemptId);
    if (active?.cancelled) throw new Error('EXECUTION_CANCELLED');
    if (!context.taskInstructions.trim())
      throw new Error('INVALID_INPUT_MISSING_TASK_INSTRUCTIONS');
    if (policy.inputSources.length > 0 && context.approvedInputs.length === 0)
      throw new Error('INVALID_INPUT_MISSING_APPROVED_INPUTS');

    // Phase 8.4: delegate the actual business execution to the canonical
    // AIEmployeeCore. The attempt envelope (claim/heartbeat/evidence/review)
    // is retained by the worker; the WorkRun is now the real executor. The
    // synthetic "Draft execution for:" completion is removed.
    const run = await this.core.start({
      tenantId: context.tenantId,
      employeeId: context.agentId,
      requestedBy: { actorId: context.agentId, actorType: 'AI_AGENT' },
      objective: context.taskInstructions,
      context: { taskId: context.taskId },
      trigger: { type: 'TASK', sourceId: context.taskId },
      idempotencyKey: `execution-attempt:${context.attemptId}`,
    });

    // Honest completion: never report attempt completion unless the canonical
    // run actually completed.
    if (run.status !== 'COMPLETED') {
      const reason =
        run.failure?.reason ?? run.status ?? 'run did not reach COMPLETED';
      throw new Error(`EXECUTION_NOT_COMPLETED:${reason}`);
    }

    const artifacts = run.artifacts ?? [];
    const evidence = artifacts.map((a) => ({
      artifactType: 'REPORT' as const,
      content: run.summary ?? a.name ?? 'Completed',
      mimeType: 'text/plain',
    }));
    const finalEvidence = evidence.length
      ? evidence
      : [
          {
            artifactType: 'OUTPUT' as const,
            content: run.summary ?? 'Completed',
            mimeType: 'text/plain',
          },
        ];

    return {
      output: {
        summary: run.summary ?? 'Completed',
        content: run.summary ?? 'Completed',
      },
      evidence: finalEvidence,
      tokensUsed: 0,
      costCents: 0,
      toolCallCount: run.steps.length,
      workRunId: run.id,
    };
  }

  private defaultPolicy(task: { id: string }): ExecutionPolicy {
    return {
      taskId: task.id,
      policyVersion: 'canonical-v1',
      autonomyLevel: 1,
      allowedTools: [],
      deniedTools: [],
      maxToolCalls: 10,
      maxTokens: 100000,
      maxCost: 1000,
      timeoutMs: 300000,
      requiresHumanApproval: false,
      externalSideEffectApproval: false,
      inputSources: [],
      promptVersion: 'draft-v1',
      graphVersion: 'canonical-v1',
      modelVersion: 'configured-runtime',
      toolVersion: 'canonical-v1',
      redactionPolicy: 'STRICT',
      sideEffectAllowList: [],
    };
  }
}
