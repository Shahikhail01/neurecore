/**
 * UpdateDepartmentPoolDto — Phase 10 Departments Pool.
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DepartmentTemplateCategory } from '@prisma/client';
import { DeptPoolStructureItemDto } from './create-department-pool.dto';

export class UpdateDepartmentPoolDto {
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
  @Type(() => DeptPoolStructureItemDto)
  structure?: DeptPoolStructureItemDto[];

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
