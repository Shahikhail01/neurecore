/**
 * command-center/dto/model-health.dto.ts
 *
 * P8 Command Center — Model Health view (CR-AI-1204).
 * Latency, error rate, success rate, and per-model health grade
 * derived from ExecutionAttempt aggregates.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ModelHealthEntryDto {
  @ApiProperty()
  @Expose()
  model!: string;

  @ApiProperty()
  @Expose()
  attempts!: number;

  @ApiProperty()
  @Expose()
  successful!: number;

  @ApiProperty()
  @Expose()
  failed!: number;

  @ApiProperty({
    description: 'Average duration in ms across attempts in window',
  })
  @Expose()
  avgDurationMs!: number | null;

  @ApiProperty({ description: '95th percentile attempt duration in ms' })
  @Expose()
  p95DurationMs!: number | null;

  @ApiProperty({ description: 'Error rate (0-1) over the window' })
  @Expose()
  errorRate!: number;

  @ApiProperty({ enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'] })
  @Expose()
  grade!: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

  @ApiProperty()
  @Expose()
  source!: 'ExecutionAttempt';
}

export class ModelHealthResponseDto {
  @ApiProperty({ type: [ModelHealthEntryDto] })
  @Expose()
  @Type(() => ModelHealthEntryDto)
  models!: ModelHealthEntryDto[];

  @ApiProperty()
  @Expose()
  totalAttempts!: number;

  @ApiProperty()
  @Expose()
  overallErrorRate!: number;

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
