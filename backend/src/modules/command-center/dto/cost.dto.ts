/**
 * command-center/dto/cost.dto.ts
 *
 * P8 Command Center — Cost view (CR-AI-1203).
 * Reconciles CostRecord + BudgetPolicy + tenant limits.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CostByModelDto {
  @ApiProperty()
  @Expose()
  model!: string;

  @ApiProperty()
  @Expose()
  provider!: string;

  @ApiProperty({ description: 'Cost in cents' })
  @Expose()
  costCents!: number;

  @ApiProperty()
  @Expose()
  tokens!: number;

  @ApiProperty()
  @Expose()
  source!: 'CostRecord';
}

export class CostBudgetDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  scope!: string;

  @ApiProperty({ description: 'Configured limit in cents' })
  @Expose()
  limitCents!: number;

  @ApiProperty({ description: 'Current spend in cents' })
  @Expose()
  currentSpendCents!: number;

  @ApiProperty()
  @Expose()
  utilizationPercent!: number;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty()
  @Expose()
  resetAt!: string;

  @ApiProperty()
  @Expose()
  source!: 'BudgetPolicy';
}

export class CostResponseDto {
  @ApiProperty({ description: 'Month-to-date cost in cents' })
  @Expose()
  monthToDateCents!: number;

  @ApiProperty()
  @Expose()
  monthToDateTokens!: number;

  @ApiProperty({
    description: 'Sum of all enabled tenant budget limits in cents',
  })
  @Expose()
  totalBudgetCents!: number;

  @ApiProperty({
    description: 'Aggregate utilization (0-1) across enabled budgets',
  })
  @Expose()
  utilizationPercent!: number;

  @ApiProperty({ type: [CostByModelDto] })
  @Expose()
  @Type(() => CostByModelDto)
  byModel!: CostByModelDto[];

  @ApiProperty({ type: [CostBudgetDto] })
  @Expose()
  @Type(() => CostBudgetDto)
  budgets!: CostBudgetDto[];

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
