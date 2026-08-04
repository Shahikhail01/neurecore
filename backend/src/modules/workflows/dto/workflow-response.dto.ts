/**
 * WorkflowResponseDto — wire shape for Workflow entities.
 *
 * Matches frontend RawWorkflow interface:
 *   { id, name, description?, status, isActive, tenantId,
 *     definition?, lastExecutedAt?, createdAt, updatedAt,
 *     _count?: { executions?: number }, metrics?: { successRate?: number } }
 *
 * SOLID — Single Responsibility: only represents the serialized entity shape.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkflowStatus } from '@prisma/client';

export class WorkflowResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Daily Standup Report' })
  @Expose()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: WorkflowStatus })
  @Expose()
  status!: WorkflowStatus;

  @ApiProperty({ example: false })
  @Expose()
  isActive!: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isTemplate!: boolean;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  tenantId!: string;

  /** DAG definition — nodes + edges stored in Prisma `definition` JSON */
  @ApiPropertyOptional({ type: Object })
  @Expose()
  definition?: Record<string, unknown>;

  /** Individual nodes array (extracted from definition for frontend convenience) */
  @ApiPropertyOptional({ type: Array })
  @Expose()
  nodes?: unknown[];

  /** Individual edges array (extracted from definition for frontend convenience) */
  @ApiPropertyOptional({ type: Array })
  @Expose()
  edges?: unknown[];

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  lastExecutedAt?: Date | null;

  @ApiProperty({ example: 0 })
  @Expose()
  executionCount!: number;

  @ApiProperty({ example: 0, minimum: 0, maximum: 100 })
  @Expose()
  successRate!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  /** Virtual — not stored in DB, computed at service layer */
  @ApiPropertyOptional({ type: Object })
  @Expose()
  @Transform(({ obj }: { obj: WorkflowResponseDto }) => ({
    executions: (obj as unknown as Record<string, unknown>)._count,
  }))
  _count?: { executions?: number };

  /** Virtual — maps Prisma `successRate` to frontend `metrics.successRate` */
  @ApiPropertyOptional({ type: Object })
  @Expose()
  @Transform(({ obj }: { obj: WorkflowResponseDto }) => ({
    successRate: (obj as unknown as Record<string, unknown>).successRate,
  }))
  metrics?: { successRate?: number };
}

/** Summary shape returned by /workflows/:id/status */
export class WorkflowExecutionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  workflowId!: string;

  @ApiProperty({ example: 0 })
  @Expose()
  totalRuns!: number;

  @ApiProperty({ example: 0, minimum: 0, maximum: 100 })
  @Expose()
  successRate!: number;

  @ApiPropertyOptional({ example: 0 })
  @Expose()
  avgDurationMs?: number | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  lastRunAt?: Date | null;

  @ApiProperty({ example: 'DRAFT' })
  @Expose()
  status!: string;
}

export class WorkflowExecutionHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  startedAt?: Date | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @Expose()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  @Expose()
  durationMs?: number | null;

  @ApiPropertyOptional()
  @Expose()
  errorMessage?: string | null;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  createdAt!: Date;
}

export class UpdateWorkflowExecutionDto {
  @ApiProperty({ enum: ['COMPLETED', 'FAILED'] })
  @IsString()
  @IsIn(['COMPLETED', 'FAILED'])
  status!: 'COMPLETED' | 'FAILED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string;
}
