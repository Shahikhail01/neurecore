/**
 * ProjectResponseDto — wire-shape for Project entities.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Q3 2026 Growth' })
  @Expose()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: ProjectStatus })
  @Expose()
  status!: ProjectStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  departmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  customerId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  initiationId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  projectTypeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  projectTypeVersion?: number | null;

  @ApiPropertyOptional({
    enum: ['FIXED_FEE', 'HOURLY', 'RETAINER'],
    nullable: true,
  })
  @Expose()
  budgetType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  budgetAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  budgetCurrency?: string | null;

  @ApiPropertyOptional({
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    nullable: true,
  })
  @Expose()
  priority?: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  tags!: string[];

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  targetDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  startDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  completedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lostReason?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  parentProjectId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  clonedFromProjectId?: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  goalIds!: string[];

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  customFieldValues?: Record<string, unknown> | null;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: Object })
  @Expose()
  customer?: { id: string; name: string } | null;
}
