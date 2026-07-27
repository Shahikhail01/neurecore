// src/modules/reviews/application/decide-task-review.handler.ts
import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AwlReviewStatus,
  ExecutionAttemptStatus,
  ReviewDecision as PrismaReviewDecision,
  TaskStatus as PrismaTaskStatus,
} from '@prisma/client';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandResult } from '../../../common/commands/command.interface';
import {
  UNIT_OF_WORK,
  type IUnitOfWork,
} from '../../../common/ports/transaction.interface';
import {
  AUDIT_REPOSITORY,
  type IAuditRepository,
} from '../../../common/ports/audit.port';
import {
  OUTBOX_REPOSITORY,
  type IOutboxRepository,
} from '../../../common/outbox/outbox-repository.port';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
} from '../domain/ports/review-repository.port';
import {
  TASK_REPOSITORY,
  type ITaskRepository,
} from '../../../common/ports/task-repository.port';
import { ReviewDecision, ReviewStatus } from '../domain/review-states';
import { ReviewStateMachine } from '../domain/review-state-machine';
import { TaskStateMachine } from '../../tasks/domain/task-states';
import type {
  DecideTaskReviewInput,
  DecideTaskReviewResult,
} from '../commands/decide-task-review.command';

/**
 * Phase 6 — DecideTaskReviewHandler (plan §8.1)
 *
 * Single authoritative owner of "decide a task review".
 *
 * Properties:
 *  - One transaction validates tenant + reviewer authority, reads review with
 *    optimistic-lock version, transitions review state, transitions task state,
 *    creates a revision execution attempt (REVISION_REQUESTED) linked via
 *    parentAttemptId, and emits outbox + audit events.
 *  - AI cannot approve its own work (task.agentId !== reviewerId).
 *  - Approval cannot rewrite prior evidence (handled in repository: no UPDATE on
 *    evidence_artifacts past its initial creation; this command only inserts).
 *  - Revision creates a NEW execution attempt — never mutates the prior attempt
 *    or its evidence.
 *  - Pending review cannot be decided twice — optimistic concurrency on review.version.
 */
@Injectable()
export class DecideTaskReviewHandler {
  private readonly logger = new Logger(DecideTaskReviewHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(REVIEW_REPOSITORY) private readonly reviewRepo: IReviewRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
  ) {}

  async handle(
    input: DecideTaskReviewInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<DecideTaskReviewResult>> {
    // Input validation (defense in depth — controller also validates).
    if (!input.reviewId) {
      throw new Error('REVIEW_ID_REQUIRED');
    }
    const terminators: ReadonlySet<ReviewDecision> = new Set([
      ReviewDecision.APPROVED,
      ReviewDecision.REVISION_REQUESTED,
      ReviewDecision.REJECTED,
      ReviewDecision.CANCELLED,
    ]);
    if (!terminators.has(input.decision)) {
      // PENDING is the initial state, never a user decision.
      throw new Error('INVALID_DECISION');
    }
    if (
      input.decision === ReviewDecision.REVISION_REQUESTED &&
      !input.revisionInstructions?.trim()
    ) {
      throw new Error('REVISION_INSTRUCTIONS_REQUIRED');
    }

    return this.uow.execute(async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      // 1. Load review with tenant + version guard. The tenant-bound
      //    repository call already enforces tenant isolation; the
      //    re-check below is defense-in-depth so a custom repository
      //    implementation can never silently leak.
      const review = await this.reviewRepo.findById(
        metadata.tenantId,
        input.reviewId,
        tx,
      );
      if (!review) {
        throw new NotFoundException('REVIEW_NOT_FOUND');
      }
      if (review.tenantId !== metadata.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }
      if (String(review.status) !== String(ReviewStatus.PENDING)) {
        throw new Error('REVIEW_ALREADY_DECIDED');
      }

      // 2. State-machine guard (defense-in-depth on top of status check)
      const newStatus = ReviewStateMachine.statusForDecision(input.decision);
      ReviewStateMachine.assertTransition(
        review.status as ReviewStatus,
        newStatus,
      );

      // 3. Load task for cross-aggregate guard (AI-cannot-approve)
      const task = await this.taskRepo.findById(
        metadata.tenantId,
        review.taskId,
        tx,
      );
      if (!task) {
        throw new NotFoundException('TASK_NOT_FOUND');
      }

      if (input.decision === ReviewDecision.APPROVED) {
        if (task.agentId && task.agentId === input.reviewerId) {
          throw new Error('AI_CANNOT_APPROVE_OWN_WORK');
        }
        // Validate task transition NEEDS_REVIEW → APPROVED
        TaskStateMachine.assertTransition(task.status as string, 'APPROVED');
      } else if (input.decision === ReviewDecision.REVISION_REQUESTED) {
        TaskStateMachine.assertTransition(task.status as string, 'QUEUED');
      } else if (input.decision === ReviewDecision.REJECTED) {
        TaskStateMachine.assertTransition(task.status as string, 'CANCELLED');
      } else if (input.decision === ReviewDecision.CANCELLED) {
        // CANCELLED is allowed only from PENDING; no task state change required
      } else {
        throw new Error('INVALID_DECISION');
      }

      // 4. Apply review state change with optimistic concurrency
      const nowIso = new Date();
      const updatedReview = await this.reviewRepo.update(
        {
          id: input.reviewId,
          expectedVersion: review.version,
          status: newStatus as AwlReviewStatus,
          decision: input.decision as PrismaReviewDecision,
          reviewerId: input.reviewerId,
          comment: input.comment,
          revisionInstructions: input.revisionInstructions,
          decidedAt: nowIso,
        },
        tx,
      );

      // 5. Apply task state change (if applicable)
      let newTaskStatus: string | null = null;
      if (input.decision === ReviewDecision.APPROVED) {
        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            tenantId: metadata.tenantId,
            expectedVersion: task.version,
            status: 'APPROVED' as PrismaTaskStatus,
            requireVersionMatch: true,
          },
          tx,
        );
        newTaskStatus = 'APPROVED';
      } else if (input.decision === ReviewDecision.REVISION_REQUESTED) {
        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            tenantId: metadata.tenantId,
            expectedVersion: task.version,
            status: 'QUEUED' as PrismaTaskStatus,
            requireVersionMatch: true,
          },
          tx,
        );
        newTaskStatus = 'QUEUED';
      } else if (input.decision === ReviewDecision.REJECTED) {
        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            tenantId: metadata.tenantId,
            expectedVersion: task.version,
            status: 'CANCELLED' as PrismaTaskStatus,
            requireVersionMatch: true,
          },
          tx,
        );
        newTaskStatus = 'CANCELLED';
      }

      // 6. For REVISION_REQUESTED, create a NEW execution attempt linked to
      //    the prior attempt via parentAttemptId. Prior attempt and its evidence
      //    are NEVER mutated.
      let revisionAttemptId: string | null = null;
      if (input.decision === ReviewDecision.REVISION_REQUESTED) {
        revisionAttemptId = await this.createRevisionAttempt(
          metadata,
          review.taskId,
          review.attemptId,
          input.revisionInstructions,
          tx,
        );
      }

      // 7. Emit outbox event (durable, single transactional write)
      await this.outboxRepo.publish(
        {
          tenantId: metadata.tenantId,
          eventType: this.eventTypeForDecision(input.decision),
          sourceModule: 'reviews',
          payload: {
            reviewId: input.reviewId,
            taskId: review.taskId,
            attemptId: review.attemptId,
            reviewerId: input.reviewerId,
            decision: input.decision,
            newTaskStatus,
            revisionAttemptId,
          },
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey: `review-decided:${input.reviewId}:${input.decision}`,
          actorId: metadata.actorId,
          actorType: metadata.actorType,
        },
        tx,
      );

      // 8. Audit
      await this.auditRepo.record(
        {
          tenantId: metadata.tenantId,
          actor: input.reviewerId,
          action: this.auditActionForDecision(input.decision),
          resource: 'Review',
          resourceId: input.reviewId,
          correlationId: metadata.correlationId,
          causationId: metadata.causationId ?? undefined,
          result: 'success',
          details: {
            tenantId: metadata.tenantId,
            taskId: review.taskId,
            attemptId: review.attemptId,
            decision: input.decision,
            newTaskStatus,
            revisionAttemptId,
            reviewerId: input.reviewerId,
            previousReviewStatus: review.status,
            actorType: metadata.actorType,
          },
        },
        tx,
      );

      return {
        success: true,
        data: {
          reviewId: updatedReview.id,
          taskId: review.taskId,
          previousReviewStatus: review.status,
          newReviewStatus: newStatus,
          newTaskStatus,
          revisionAttemptCreated:
            input.decision === ReviewDecision.REVISION_REQUESTED,
          revisionAttemptId,
          correlationId: metadata.correlationId,
          decidedAt: nowIso.toISOString(),
        },
        correlationId: metadata.correlationId,
        occurredAt: nowIso,
      };
    });
  }

  /**
   * Creates a new execution attempt for the revision. The new attempt is
   * linked to the prior attempt via parentAttemptId, and gets a fresh
   * attemptNumber. The prior attempt and its evidence artifacts are never
   * modified by this operation.
   */
  private async createRevisionAttempt(
    metadata: CommandMetadata,
    taskId: string,
    parentAttemptId: string,
    revisionInstructions: string | undefined,
    rawTx: Prisma.TransactionClient,
  ): Promise<string> {
    const client = rawTx;

    // Read the parent attempt to copy immutable context snapshots forward
    const parent = await client.executionAttempt.findFirst({
      where: { id: parentAttemptId, tenantId: metadata.tenantId },
    });
    if (!parent) {
      throw new Error('PARENT_ATTEMPT_NOT_FOUND');
    }

    // Compute next attemptNumber inside the transaction (unique on taskId).
    const lastAttempt = await client.executionAttempt.findFirst({
      where: { taskId, tenantId: metadata.tenantId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });
    const nextAttemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

    const executionRequestId = `revision:${parentAttemptId}:${nextAttemptNumber}`;

    const newAttempt = await client.executionAttempt.create({
      data: {
        tenantId: metadata.tenantId,
        taskId,
        agentId: parent.agentId,
        executionRequestId,
        attemptNumber: nextAttemptNumber,
        status: 'QUEUED' as ExecutionAttemptStatus,
        parentAttemptId,
        taskInstructionsSnapshot:
          revisionInstructions ?? parent.taskInstructionsSnapshot,
        // Carry forward the immutable snapshots (intent, model, graph, tool versions)
        inputSnapshot: parent.inputSnapshot ?? {},
        projectContextSnapshot: parent.projectContextSnapshot ?? {},
        promptVersion: parent.promptVersion,
        graphVersion: parent.graphVersion,
        modelVersion: parent.modelVersion,
        toolVersion: parent.toolVersion,
        policy: parent.policy ?? {},
      },
      select: { id: true },
    });

    await this.outboxRepo.publish(
      {
        tenantId: metadata.tenantId,
        eventType: 'TaskExecutionRequested',
        sourceModule: 'reviews',
        payload: {
          attemptId: newAttempt.id,
          taskId,
          agentId: parent.agentId,
          attemptNumber: nextAttemptNumber,
          parentAttemptId,
          revision: true,
        },
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        idempotencyKey: `revision-execution-requested:${newAttempt.id}`,
        actorId: metadata.actorId,
        actorType: metadata.actorType,
      },
      rawTx,
    );

    return newAttempt.id;
  }

  private eventTypeForDecision(decision: ReviewDecision): string {
    switch (decision) {
      case ReviewDecision.APPROVED:
        return 'ReviewApproved';
      case ReviewDecision.REVISION_REQUESTED:
        return 'RevisionRequested';
      case ReviewDecision.REJECTED:
        return 'ReviewRejected';
      case ReviewDecision.CANCELLED:
        return 'ReviewCancelled';
      case ReviewDecision.PENDING:
        return 'ReviewCreated';
      default: {
        const _exhaustive: never = decision;
        throw new Error(`Unknown review decision: ${String(decision)}`);
      }
    }
  }

  private auditActionForDecision(decision: ReviewDecision): string {
    switch (decision) {
      case ReviewDecision.APPROVED:
        return 'TASK_REVIEW_APPROVED';
      case ReviewDecision.REVISION_REQUESTED:
        return 'TASK_REVISION_REQUESTED';
      case ReviewDecision.REJECTED:
        return 'TASK_REVIEW_REJECTED';
      case ReviewDecision.CANCELLED:
        return 'TASK_REVIEW_CANCELLED';
      case ReviewDecision.PENDING:
        return 'TASK_REVIEW_CREATED';
      default: {
        const _exhaustive: never = decision;
        throw new Error(`Unknown review decision: ${String(decision)}`);
      }
    }
  }
}
