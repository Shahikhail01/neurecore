import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepartmentTemplateCategory } from '@prisma/client';

// ─── Nested DTO ────────────────────────────────────────────────────────────

export class DeptStructureItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Agent type hint — helps auto-pick a template during deployment */
  @IsOptional()
  @IsString()
  headAgentType?: string;

  /** Name of a parent dept item within the same structure array */
  @IsOptional()
  @IsString()
  parentName?: string;

  /** Optional list of platform agent template names to auto-spawn when deploying tiers */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agentTemplateNames?: string[];
}

// ─── Create ─────────────────────────────────────────────────────────────────

export class CreateDepartmentTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  /** URL-safe identifier, e.g. "startup-org" */
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Ordered department definitions — drives bulk-deploy */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeptStructureItemDto)
  structure!: DeptStructureItemDto[];

  @IsOptional()
  @IsEnum(DepartmentTemplateCategory)
  category?: DepartmentTemplateCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// ─── Update ─────────────────────────────────────────────────────────────────

export class UpdateDepartmentTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeptStructureItemDto)
  structure?: DeptStructureItemDto[];

  @IsOptional()
  @IsEnum(DepartmentTemplateCategory)
  category?: DepartmentTemplateCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
