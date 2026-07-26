// src/modules/reviews/application/review.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IUnitOfWork } from '../../../common/ports/transaction.interface';
import { UNIT_OF_WORK } from '../../../common/ports/transaction.interface';
import type { ITaskRepository } from '../../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../../common/ports/task-repository.port';
import type { IAuditRepository } from '../../../common/ports/audit.port';
import { AUDIT_REPOSITORY } from '../../../common/ports/audit.port';
import type { IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { OUTBOX_REPOSITORY } from '../../../common/outbox/outbox-repository.port';
import type { IReviewRepository } from '../domain/ports/review-repository.port';
import { REVIEW_REPOSITORY } from '../domain/ports/review-repository.port';
import { ReviewDecision } from '../domain/review-states';
import { ReviewStatus, type ReviewDecision as PrismaReviewDecision, type ReviewStatus as PrismaReviewStatus } from '@prisma/client';
import { TaskStateMachine } from '../../tasks/domain/task-states';

/**
 * Application service — depends on PORTS only via DI tokens.
 * No PrismaService import. No direct database access.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
    @Inject(REVIEW_REPOSITORY) private readonly reviewRepo: IReviewRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
  ) {}

  async submitReview(
    reviewId: string,
    decision: ReviewDecision,
    reviewerId: string,
    comment: string | undefined,
    revisionInstructions: string | undefined,
    metadata: { tenantId: string; correlationId: string; causationId?: string | null },
  ): Promise<{ reviewId: string; newAttemptCreated: boolean }> {
    return this.uow.execute(async (tx) => {
      const review = await this.reviewRepo.findById(metadata.tenantId, reviewId);
      if (!review) throw new Error('REVIEW_NOT_FOUND');
      if (review.tenantId !== metadata.tenantId) throw new Error('CROSS_TENANT_ACCESS_DENIED');
      if (review.status !== 'PENDING' as ReviewStatus) {
        throw new Error('REVIEW_ALREADY_DECIDED');
      }

      const task = await this.taskRepo.findById(metadata.tenantId, review.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');

      if (decision === ReviewDecision.APPROVED) {
        if (task.agentId === reviewerId) {
          throw new Error('AI_CANNOT_APPROVE_OWN_WORK');
        }

        TaskStateMachine.assertTransition(task.status as any, 'APPROVED');

        await this.reviewRepo.update(
          {
            id: reviewId,
            expectedVersion: review.version,
            status: 'APPROVED' as PrismaReviewStatus,
            decision: 'APPROVED' as PrismaReviewDecision,
            reviewerId,
            comment,
          },
          tx,
        );

        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            expectedVersion: 0,
            status: 'APPROVED' as any,
          },
          tx,
        );

        await this.outboxRepo.publish(
          {
            tenantId: metadata.tenantId,
            eventType: 'ReviewApproved',
            sourceModule: 'reviews',
            payload: { reviewId, taskId: review.taskId, reviewerId },
            correlationId: metadata.correlationId,
            causationId: metadata.causationId ?? null,
            idempotencyKey: `review-approved:${reviewId}`,
          },
          tx,
        );

        await this.auditRepo.record(
          {
            tenantId: metadata.tenantId,
            actor: reviewerId,
            action: 'TASK_REVIEW_APPROVED',
            resource: 'Review',
            resourceId: reviewId,
            correlationId: metadata.correlationId,
            causationId: metadata.causationId ?? undefined,
            result: 'success',
          },
          tx,
        );

        return { reviewId, newAttemptCreated: false };
      }

      if (decision === ReviewDecision.REVISION_REQUESTED) {
        TaskStateMachine.assertTransition(task.status as any, 'QUEUED');

        await this.reviewRepo.update(
          {
            id: reviewId,
            expectedVersion: review.version,
            status: ReviewStatus.REVISION_REQUESTED as PrismaReviewStatus,
            decision: 'NEEDS_REVISION' as PrismaReviewDecision,
            reviewerId,
            comment,
            revisionInstructions,
          },
          tx,
        );

        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            expectedVersion: 0,
            status: 'QUEUED' as any,
          },
          tx,
        );

        await this.outboxRepo.publish(
          {
            tenantId: metadata.tenantId,
            eventType: 'RevisionRequested',
            sourceModule: 'reviews',
            payload: { reviewId, taskId: review.taskId, instructions: revisionInstructions },
            correlationId: metadata.correlationId,
            causationId: metadata.causationId ?? null,
            idempotencyKey: `revision-requested:${reviewId}`,
          },
          tx,
        );

        return { reviewId, newAttemptCreated: true };
      }

      if (decision === ReviewDecision.REJECTED) {
        TaskStateMachine.assertTransition(task.status as any, 'CANCELLED');

        await this.reviewRepo.update(
          {
            id: reviewId,
            expectedVersion: review.version,
            status: 'REJECTED' as PrismaReviewStatus,
            decision: 'REJECTED' as PrismaReviewDecision,
            reviewerId,
            comment,
          },
          tx,
        );

        await this.taskRepo.updateStatus(
          {
            id: review.taskId,
            expectedVersion: 0,
            status: 'CANCELLED' as any,
          },
          tx,
        );

        return { reviewId, newAttemptCreated: false };
      }

      throw new Error('INVALID_DECISION');
    });
  }

  async getPendingReviews(tenantId: string) {
    return this.reviewRepo.findPending(tenantId);
  }
}
