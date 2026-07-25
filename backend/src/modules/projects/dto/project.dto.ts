/**
 * Projects Module — DTOs
 */

import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsNotEmpty,
  Min,
} from 'class-validator';

export const PROJECT_STATUSES = [
  'LEAD',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
  'ACTIVE',
  'ON_HOLD',
  'REVIEW',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const BUDGET_TYPES = ['FIXED_FEE', 'HOURLY', 'RETAINER'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  projectTypeId?: string;

  @IsOptional()
  @IsNumber()
  projectTypeVersion?: number;

  @IsOptional()
  @IsIn(BUDGET_TYPES as unknown as string[])
  budgetType?: (typeof BUDGET_TYPES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  budgetCurrency?: string;

  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsIn(PROJECT_STATUSES as unknown as string[])
  // FIX-PROJ-D1: accept status on create so the FE wizard's Status dropdown
  // is honoured. Defaults to LEAD if absent.
  status?: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, unknown>;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUSES as unknown as string[])
  status?: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  projectTypeId?: string;

  @IsOptional()
  @IsNumber()
  projectTypeVersion?: number;

  @IsOptional()
  @IsIn(BUDGET_TYPES as unknown as string[])
  budgetType?: (typeof BUDGET_TYPES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  budgetCurrency?: string;

  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  lostReason?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class TransitionProjectStatusDto {
  @IsIn(PROJECT_STATUSES as unknown as string[])
  status!: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListProjectsDto {
  @IsOptional()
  @IsIn(PROJECT_STATUSES as unknown as string[])
  status?: (typeof PROJECT_STATUSES)[number];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class CloneProjectDto {
  @IsString()
  @IsNotEmpty()
  sourceProjectId!: string;

  @IsString()
  @IsNotEmpty()
  newName!: string;
}
