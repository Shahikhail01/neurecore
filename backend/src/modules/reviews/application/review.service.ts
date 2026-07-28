// src/modules/reviews/application/review.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CommandRegistry } from '../../../common/commands/command.registry';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandResult } from '../../../common/commands/command.interface';
import { ReviewDecision } from '../domain/review-states';
import {
  DecideTaskReviewInput,
  DecideTaskReviewResult,
  DECIDE_TASK_REVIEW_COMMAND,
  DECIDE_TASK_REVIEW_VERSION,
} from '../commands/decide-task-review.command';
import {
  AdvanceProjectStageInput,
  AdvanceProjectStageResult,
  ADVANCE_PROJECT_STAGE_COMMAND,
  ADVANCE_PROJECT_STAGE_VERSION,
} from '../commands/advance-project-stage.command';
import {
  UNIT_OF_WORK,
  type IUnitOfWork,
} from '../../../common/ports/transaction.interface';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
} from '../domain/ports/review-repository.port';

/**
 * Application service — exposes the Phase 6 command surface to controllers
 * and other callers. All decision / stage mutations go through the
 * CommandRegistry so the canonical command path enforces idempotency,
 * atomicity, optimistic concurrency, and audit/outbox emission.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly commandRegistry: CommandRegistry,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(REVIEW_REPOSITORY) private readonly reviewRepo: IReviewRepository,
  ) {}

  /**
   * Submits a review decision through the canonical command bus.
   *
   * Properties:
   *  - Atomic transaction (UoW) covers review update, task update, revision
   *    attempt creation, outbox publish, and audit record.
   *  - Optimistic concurrency on review.version prevents double-decisions.
   *  - AI cannot approve its own work (enforced in the handler).
   *  - REVISION_REQUESTED creates a NEW execution attempt with parentAttemptId
   *    linking to the prior attempt; prior attempt and evidence are never
   *    mutated.
   */
  async submitReview(
    reviewId: string,
    decision: ReviewDecision,
    reviewerId: string,
    comment: string | undefined,
    revisionInstructions: string | undefined,
    metadata: CommandMetadata,
  ): Promise<CommandResult<DecideTaskReviewResult>> {
    const input: DecideTaskReviewInput = {
      reviewId,
      decision,
      reviewerId,
      comment,
      revisionInstructions,
    };
    return this.commandRegistry.execute<
      DecideTaskReviewInput,
      DecideTaskReviewResult,
      undefined
    >(DECIDE_TASK_REVIEW_COMMAND, DECIDE_TASK_REVIEW_VERSION, input, metadata);
  }

  /**
   * Advances a project lifecycle stage through the canonical command bus.
   * Waivers are recorded before the transition when guards fail.
   */
  async advanceProjectStage(
    input: AdvanceProjectStageInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<AdvanceProjectStageResult>> {
    return this.commandRegistry.execute<
      AdvanceProjectStageInput,
      AdvanceProjectStageResult,
      undefined
    >(
      ADVANCE_PROJECT_STAGE_COMMAND,
      ADVANCE_PROJECT_STAGE_VERSION,
      input,
      metadata,
    );
  }

  /**
   * Returns the pending review queue for a tenant, augmented with task
   * and attempt summaries so the review inbox can render execution context.
   */
  async getPendingReviews(tenantId: string) {
    return this.reviewRepo.findPendingWithContext(tenantId);
  }

  /**
   * SIM-04 G-04 — list reviews for the FE Approved/Revisions/Rejected
   * history tabs. Returns the same enriched shape as the Pending inbox.
   * Filter is tenant-scoped by construction; the repository clamps
   * `limit` to [1, 200] defensively.
   */
  async listReviews(
    tenantId: string,
    filter: {
      status?: import('@prisma/client').AwlReviewStatus;
      decision?: import('@prisma/client').ReviewDecision;
      taskId?: string;
      projectId?: string;
      limit?: number;
    } = {},
  ) {
    return this.reviewRepo.listWithContext(tenantId, filter);
  }

  /**
   * Returns full review context for the inbox detail view, including the
   * task, attempt, and evidence artifacts linked to the attempt.
   */
  async getReviewDetail(tenantId: string, reviewId: string) {
    return this.reviewRepo.findDetail(tenantId, reviewId);
  }
}
