/**
 * ProjectTypes Module — DTOs
 */

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  IsIn,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateProjectTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  industry?: string;
}

// ─── Field Schema Items ───────────────────────────────────────────────────────

export class FieldSchemaItemDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsIn(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT'])
  type!: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

// ─── Stage Template Items ─────────────────────────────────────────────────────

export class StageTemplateItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  order!: number;

  @IsOptional()
  @IsNumber()
  defaultDurationDays?: number;
}

// ─── Approval Template Items ─────────────────────────────────────────────────

export class ApprovalStepDto {
  @IsNumber()
  stepOrder!: number;

  @IsString()
  @IsNotEmpty()
  approverRole!: string;

  @IsIn(['INTERNAL', 'CLIENT_FACING', 'DUAL'])
  approvalType!: 'INTERNAL' | 'CLIENT_FACING' | 'DUAL';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskTier?: string[];
}

// ─── Version DTOs ─────────────────────────────────────────────────────────────

export class CreateProjectTypeVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldSchemaItemDto)
  fieldSchema!: FieldSchemaItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageTemplateItemDto)
  stageTemplate!: StageTemplateItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  approvalTemplate?: ApprovalStepDto[];

  @IsOptional()
  @IsArray()
  goalTemplate?: unknown[];

  @IsOptional()
  @IsArray()
  roleTemplate?: unknown[];
}

export class ListProjectTypesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slugs?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
