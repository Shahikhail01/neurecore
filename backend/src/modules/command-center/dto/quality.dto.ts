/**
 * command-center/dto/quality.dto.ts
 *
 * P8 Command Center — Quality view (CR-AI-1202).
 * Surfaces feedback, corrections, abstentions, and per-attempt
 * evaluator scores so operators can monitor output quality.
 *
 * Sources: ExecutionLog.evaluationScore/reflection, Review records.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class QualityAttemptDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  taskId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Expose()
  agentId!: string | null;

  @ApiProperty({ description: '0-1 quality score; null when not evaluated' })
  @Expose()
  score!: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  reflection!: string | null;

  @ApiProperty()
  @Expose()
  evaluatedAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'ExecutionLog';
}

export class QualityReviewDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  taskId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  attemptId!: string;

  @ApiProperty()
  @Expose()
  decision!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  comment!: string | null;

  @ApiProperty()
  @Expose()
  decidedAt!: string | null;

  @ApiProperty()
  @Expose()
  source!: 'Review';
}

export class QualitySummaryDto {
  @ApiProperty({ description: 'Average evaluator score over the window' })
  @Expose()
  averageScore!: number | null;

  @ApiProperty()
  @Expose()
  evaluatedCount!: number;

  @ApiProperty()
  @Expose()
  abstentionCount!: number;

  @ApiProperty()
  @Expose()
  correctionCount!: number;

  @ApiProperty({ description: 'Reviews flagged REVISION' })
  @Expose()
  revisionCount!: number;

  @ApiProperty()
  @Expose()
  feedbackCount!: number;
}

export class QualityResponseDto {
  @ApiProperty({ type: QualitySummaryDto })
  @Expose()
  @Type(() => QualitySummaryDto)
  summary!: QualitySummaryDto;

  @ApiProperty({ type: [QualityAttemptDto] })
  @Expose()
  @Type(() => QualityAttemptDto)
  attempts!: QualityAttemptDto[];

  @ApiProperty({ type: [QualityReviewDto] })
  @Expose()
  @Type(() => QualityReviewDto)
  reviews!: QualityReviewDto[];

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  windowStart!: string;

  @ApiProperty()
  @Expose()
  windowEnd!: string;

  @ApiProperty()
  @Expose()
  fetchedAt!: string;
}
