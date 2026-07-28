// src/modules/reviews/review.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type {
  AwlReviewStatus,
  ReviewDecision as PrismaReviewDecision,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationService } from '../../common/correlation/correlation.service';
import { ReviewService } from './application/review.service';
import { ReviewDecision } from './domain/review-states';

const VALID_DECISIONS: ReviewDecision[] = [
  ReviewDecision.APPROVED,
  ReviewDecision.REVISION_REQUESTED,
  ReviewDecision.REJECTED,
  ReviewDecision.CANCELLED,
];

const VALID_REVIEW_STATUSES: AwlReviewStatus[] = [
  'PENDING',
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED',
  'CANCELLED',
];

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(
    private readonly service: ReviewService,
    private readonly correlation: CorrelationService,
  ) {}

  @Get('pending')
  async getPending(@CurrentUser() user: { tenantId: string }) {
    return this.service.getPendingReviews(user.tenantId);
  }

  /**
   * SIM-04 G-04 — list reviews for the FE Approved / Revisions / Rejected
   * history tabs. Tenant-scoped by construction. Status + decision are
   * optional filters; without them returns the most recent 50 reviews for
   * the tenant in reverse chronological order.
   */
  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('decision') decision: string | undefined,
    @Query('taskId') taskId: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: { tenantId: string },
  ) {
    if (status && !VALID_REVIEW_STATUSES.includes(status as AwlReviewStatus)) {
      throw new BadRequestException(
        `Invalid status; expected one of ${VALID_REVIEW_STATUSES.join(', ')}`,
      );
    }
    if (decision && !VALID_DECISIONS.includes(decision as ReviewDecision)) {
      throw new BadRequestException(
        `Invalid decision; expected one of ${VALID_DECISIONS.join(', ')}`,
      );
    }
    return this.service.listReviews(user.tenantId, {
      status: status as AwlReviewStatus | undefined,
      decision: decision as PrismaReviewDecision | undefined,
      taskId,
      projectId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':reviewId')
  async getDetail(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.getReviewDetail(user.tenantId, reviewId);
  }

  @Post(':reviewId/decide')
  async decide(
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      decision: ReviewDecision;
      comment?: string;
      revisionInstructions?: string;
    },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    if (!body?.decision || !VALID_DECISIONS.includes(body.decision)) {
      throw new BadRequestException('Invalid review decision');
    }

    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `decide-review:${reviewId}:${body.decision}`,
    );

    return this.service.submitReview(
      reviewId,
      body.decision,
      user.id,
      body.comment,
      body.revisionInstructions,
      metadata,
    );
  }
}
