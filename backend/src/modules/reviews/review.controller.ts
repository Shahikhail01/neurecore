// src/modules/reviews/review.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
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
