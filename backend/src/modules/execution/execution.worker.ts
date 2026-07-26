// src/modules/execution/execution.worker.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import type { IExecutionAttemptRepository } from './domain/ports/execution-attempt-repository.port';
import { EXECUTION_ATTEMPT_REPOSITORY } from './domain/ports/execution-attempt-repository.port';
import type { ITaskRepository } from '../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';
import type { IOutboxRepository } from '../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../common/outbox/outbox-repository.port';
import { ExecutionOrchestrator } from './application/execution-orchestrator';

@Injectable()
export class ExecutionWorker {
  private readonly logger = new Logger(ExecutionWorker.name);

  constructor(
    @Inject(EXECUTION_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IExecutionAttemptRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly orchestrator: ExecutionOrchestrator,
  ) {}

  async handleTaskExecutionRequested(event: {
    id: string;
    tenantId: string;
    payload: { attemptId: string; taskId: string; agentId: string };
    correlationId: string;
  }): Promise<void> {
    const { attemptId, taskId, agentId } = event.payload;

    const attempt = await this.attemptRepo.findById(event.tenantId, attemptId);

    if (!attempt) {
      this.logger.warn(`Attempt ${attemptId} not found`);
      return;
    }

    if (attempt.tenantId !== event.tenantId) {
      this.logger.warn(`Tenant mismatch on attempt ${attemptId}`);
      return;
    }

    if (attempt.status !== 'QUEUED') {
      this.logger.log(`Attempt ${attemptId} not in QUEUED state: ${attempt.status}`);
      return;
    }

    const context = await this.buildContext(attempt);

    try {
      const result = await this.orchestrator.executeTask(context);

      const checksum = createHash('sha256')
        .update(JSON.stringify(result.output))
        .digest('hex');

      await this.attemptRepo.update({
        id: attemptId,
        status: 'SUBMITTED_FOR_REVIEW',
        outputSummary: result.output.summary,
        submittedAt: new Date(),
      });

      await this.taskRepo.updateStatus({
        id: taskId,
        expectedVersion: 0,
        status: 'NEEDS_REVIEW' as any,
      });

      await this.outboxRepo.publish({
        tenantId: event.tenantId,
        eventType: 'ReviewRequested',
        sourceModule: 'execution',
        payload: { attemptId, taskId, summary: result.output.summary, checksum },
        correlationId: event.correlationId,
        causationId: event.id,
        idempotencyKey: `review-requested:${attemptId}`,
      });
    } catch (e) {
      const classification = this.orchestrator.classifyFailure(
        e instanceof Error ? e : new Error(String(e)),
      );
      const shouldRetry = this.orchestrator.shouldRetry(
        classification,
        attempt.attemptNumber,
      );

      await this.attemptRepo.update({
        id: attemptId,
        status: shouldRetry ? 'FAILED_RETRYABLE' : 'FAILED_FINAL',
        lastError: e instanceof Error ? e.message : String(e),
        lastErrorClassification: classification,
      });

      throw e;
    }
  }

  private async buildContext(attempt: any): Promise<any> {
    const task = await this.taskRepo.findById(attempt.tenantId, attempt.taskId);
    return {
      attemptId: attempt.id,
      taskId: attempt.taskId,
      agentId: attempt.agentId,
      tenantId: attempt.tenantId,
      policy: attempt.policy,
      taskInstructions: task?.title ?? '',
      projectContext: {},
      approvedInputs: [],
      toolPolicy: {},
      resourceLimits: {},
    };
  }
}
