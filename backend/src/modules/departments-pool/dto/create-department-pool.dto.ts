/**
 * CreateDepartmentPoolDto — Phase 10 Departments Pool.
 *
 * Mirrors `CreateDepartmentTemplateDto` shape so the existing rows stay
 * loadable. We expose this as the public DTO and the legacy controller
 * continues to work via its own adapter.
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DepartmentTemplateCategory } from '@prisma/client';

export class DeptPoolStructureItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  headAgentType?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agentTemplateNames?: string[];
}

export class CreateDepartmentPoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeptPoolStructureItemDto)
  structure!: DeptPoolStructureItemDto[];

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
