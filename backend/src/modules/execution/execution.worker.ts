/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  Inject,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type {
  IExecutionAttemptRepository,
  ExecutionAttemptEntity,
} from './domain/ports/execution-attempt-repository.port';
import { EXECUTION_ATTEMPT_REPOSITORY } from './domain/ports/execution-attempt-repository.port';
import type { ITaskRepository } from '../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';
import type {
  IOutboxRepository,
  OutboxEventRecord,
} from '../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../common/outbox/outbox-repository.port';
import type { IUnitOfWork } from '../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../common/ports/transaction.interface';
import type { IReviewRepository } from '../reviews/domain/ports/review-repository.port';
import { REVIEW_REPOSITORY } from '../reviews/domain/ports/review-repository.port';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { PrismaEvidenceArtifactRepository } from './infrastructure/prisma-evidence-artifact.repository';
import { PiiRedactor } from './application/pii-redactor';
import { ExecutionConcurrencyService } from './infrastructure/prisma-execution-concurrency.service';
import { ExecutionSweeper } from './infrastructure/execution.sweeper';
import { AttemptStateMachine } from './domain/attempt-states';
import { FailureClassification } from './domain/execution-failures';
import { ExecutionContext } from './application/execution-orchestrator';

@Injectable()
export class ExecutionWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ExecutionWorker.name);
  private readonly leaseMs = 120000;
  private readonly heartbeatMs = 30000;

  constructor(
    @Inject(EXECUTION_ATTEMPT_REPOSITORY)
    private readonly attemptRepo: IExecutionAttemptRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(REVIEW_REPOSITORY) private readonly reviewRepo: IReviewRepository,
    private readonly orchestrator: ExecutionOrchestrator,
    private readonly evidenceRepo: PrismaEvidenceArtifactRepository,
    private readonly redactor: PiiRedactor,
    private readonly concurrency: ExecutionConcurrencyService,
    private readonly sweeper: ExecutionSweeper,
  ) {}

  onApplicationBootstrap(): void {
    this.sweeper.start();
  }

  onApplicationShutdown(): void {
    this.sweeper.stop();
  }

  async handleTaskExecutionRequested(event: OutboxEventRecord): Promise<void> {
    const payload = event.payload as { attemptId: string };
    const attemptId = (payload as { attemptId: string }).attemptId;
    const claim = await this.attemptRepo.claimForExecution(
      event.tenantId,
      attemptId,
      this.leaseMs,
    );
    if (!claim) {
      const existing = await this.attemptRepo.findById(
        event.tenantId,
        attemptId,
      );
      if (
        existing &&
        ['SUBMITTED_FOR_REVIEW', 'CANCELLED', 'FAILED_FINAL'].includes(
          existing.status,
        )
      )
        return;
      throw new Error('EXECUTION_ATTEMPT_NOT_CLAIMABLE');
    }
    const { attempt, ownerToken } = claim;
    AttemptStateMachine.assertTransition('QUEUED', 'RUNNING');

    try {
      await this.concurrency.reserve(
        attempt.tenantId,
        attempt.agentId,
        attempt.id,
        this.leaseMs,
      );
    } catch (error) {
      await this.attemptRepo.reclaimOrphan(
        attempt.tenantId,
        attempt.id,
        attempt.fencingToken,
        'FAILED_RETRYABLE',
        `RESERVATION_FAILED:${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    const heartbeat = setInterval(() => {
      void Promise.all([
        this.attemptRepo.updateHeartbeat(
          attempt.tenantId,
          attempt.id,
          ownerToken,
          this.leaseMs,
        ),
        this.concurrency.renew(attempt.id, this.leaseMs),
      ]).catch((error: unknown) =>
        this.logger.error(
          `Execution heartbeat failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }, this.heartbeatMs);

    try {
      const result = await this.orchestrator.executeTask(
        this.buildContext(attempt),
      );
      const currentTask = await this.taskRepo.findById(
        attempt.tenantId,
        attempt.taskId,
      );
      if (!currentTask) throw new Error('TASK_NOT_FOUND');
      const sanitized = this.redactor.redact(
        result.output.content,
        attempt.policy.redactionPolicy === 'STRICT',
      );
      await this.uow.execute(async (tx) => {
        const txClient = tx as never;
        AttemptStateMachine.assertTransition('RUNNING', 'PRODUCING_EVIDENCE');
        const producing = await this.attemptRepo.update(
          {
            id: attempt.id,
            tenantId: attempt.tenantId,
            expectedVersion: attempt.version,
            ownerToken,
            status: 'PRODUCING_EVIDENCE',
            tokensUsed: result.tokensUsed,
            costCents: result.costCents,
            toolCallCount: result.toolCallCount,
          },
          tx,
        );
        for (const artifact of result.evidence) {
          const redacted = this.redactor.redact(
            artifact.content,
            attempt.policy.redactionPolicy === 'STRICT',
          );
          await this.evidenceRepo.create(
            {
              tenantId: attempt.tenantId,
              taskId: attempt.taskId,
              executionAttemptId: attempt.id,
              artifactType: artifact.artifactType,
              storageRef: `inline:sha256:${this.redactor.checksum(redacted.value)}`,
              mimeType: artifact.mimeType,
              checksum: this.redactor.checksum(redacted.value),
              source: 'AI_GENERATED',
              createdByActorId: attempt.agentId,
              metadata: {
                redacted: redacted.redacted,
                redactedFields: redacted.fields,
              },
            },
            txClient,
          );
        }
        AttemptStateMachine.assertTransition(
          'PRODUCING_EVIDENCE',
          'SUBMITTED_FOR_REVIEW',
        );
        const submitted = await this.attemptRepo.update(
          {
            id: attempt.id,
            tenantId: attempt.tenantId,
            expectedVersion: producing.version,
            ownerToken,
            status: 'SUBMITTED_FOR_REVIEW',
            outputSummary: sanitized.value,
            submittedAt: new Date(),
            endedAt: new Date(),
          },
          tx,
        );
        await this.taskRepo.updateStatus(
          {
            id: attempt.taskId,
            tenantId: attempt.tenantId,
            expectedVersion: currentTask.version,
            status: 'NEEDS_REVIEW',
            requireVersionMatch: true,
          },
          tx,
        );
        await this.reviewRepo.upsertForAttempt(
          attempt.tenantId,
          attempt.taskId,
          attempt.id,
          tx,
        );
        await this.outboxRepo.publish(
          {
            tenantId: attempt.tenantId,
            eventType: 'ReviewRequested',
            sourceModule: 'execution',
            payload: {
              attemptId: submitted.id,
              taskId: attempt.taskId,
              checksum: this.redactor.checksum(sanitized.value),
            },
            correlationId: event.correlationId,
            causationId: event.id,
            idempotencyKey: `review-requested:${submitted.id}`,
            actorId: attempt.agentId,
            actorType: 'AI_AGENT',
          },
          tx,
        );
      });
    } catch (error) {
      const classification = this.orchestrator.classifyFailure(
        error instanceof Error ? error : new Error(String(error)),
      );
      const current = await this.attemptRepo.findById(
        attempt.tenantId,
        attempt.id,
      );
      if (
        current &&
        current.status === 'RUNNING' &&
        current.ownerToken === ownerToken
      ) {
        const status =
          classification === FailureClassification.INVALID_INPUT
            ? 'NEEDS_INPUT'
            : this.orchestrator.shouldRetry(
                  classification,
                  attempt.attemptNumber,
                )
              ? 'FAILED_RETRYABLE'
              : 'FAILED_FINAL';
        try {
          await this.attemptRepo.update({
            id: attempt.id,
            tenantId: attempt.tenantId,
            expectedVersion: current.version,
            ownerToken,
            status,
            endedAt: new Date(),
            lastError: error instanceof Error ? error.message : String(error),
            lastErrorClassification: classification,
          });
        } catch (fencingError) {
          this.logger.warn(
            `Failed to update attempt status after runtime error: ${fencingError instanceof Error ? fencingError.message : String(fencingError)}`,
          );
        }
      }
      throw error;
    } finally {
      clearInterval(heartbeat);
      await this.concurrency.release(attempt.id);
    }
  }

  private buildContext(attempt: ExecutionAttemptEntity): ExecutionContext {
    const inputSnapshot = attempt.inputSnapshot as Record<string, unknown>;
    const approvedInputs = Array.isArray(inputSnapshot['approvedInputs'])
      ? (inputSnapshot['approvedInputs'] as unknown[])
      : [];
    return {
      attemptId: attempt.id,
      taskId: attempt.taskId,
      agentId: attempt.agentId,
      tenantId: attempt.tenantId,
      policy: attempt.policy,
      taskInstructions: attempt.taskInstructionsSnapshot ?? '',
      projectContext: attempt.projectContextSnapshot,
      approvedInputs,
      toolPolicy: {
        allowedTools: Array.isArray(attempt.policy['allowedTools'])
          ? (attempt.policy['allowedTools'] as string[])
          : [],
        deniedTools: Array.isArray(attempt.policy['deniedTools'])
          ? (attempt.policy['deniedTools'] as string[])
          : [],
      },
      resourceLimits: {
        maxTokens: Number(attempt.policy['maxTokens'] ?? 0),
        maxCostCents: Number(attempt.policy['maxCost'] ?? 0),
        maxDurationMs: Number(attempt.policy['timeoutMs'] ?? 0),
        maxToolCalls: Number(attempt.policy['maxToolCalls'] ?? 0),
      },
    };
  }
}
