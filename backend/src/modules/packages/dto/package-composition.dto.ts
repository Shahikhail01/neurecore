/**
 * UpdatePackageCompositionDto — replaces the three M2M relations atomically.
 *
 * The Package.composition is its primary identity. We provide a single
 * transactional endpoint instead of three separate set/delete calls so the
 * admin UI can operate on "the composition as one logical unit" (SRP).
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePackageCompositionDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  aiAgentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  featureIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedAgentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedDepartmentCount?: number;
}

export class PackagePreviewDto {
  @IsString()
  industryId!: string;

  /**
   * TIER-SYSTEM-CONCEPT.md Phase 3 — single Tier table is canonical.
   * (Previously `tierTemplateId` referencing the TierTemplate pool table.)
   */
  @IsString()
  tierId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  aiAgentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureIds?: string[];
}

export class AcceptPackageRecommendationsDto {
  @IsString()
  industryId!: string;

  @IsString()
  tierId!: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsArray()
  @IsString({ each: true })
  suggestedFeatureKeys!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentFeatureIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentDepartmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentAiAgentIds?: string[];
}

export class DismissPackageRecommendationsDto {
  @IsString()
  industryId!: string;

  @IsString()
  tierId!: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsArray()
  @IsString({ each: true })
  suggestedFeatureKeys!: string[];

  @IsString()
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentFeatureIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentDepartmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentAiAgentIds?: string[];
}

export class SnoozePackageRecommendationsDto {
  @IsString()
  industryId!: string;

  @IsString()
  tierId!: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsArray()
  @IsString({ each: true })
  suggestedFeatureKeys!: string[];

  @IsString()
  reason!: string;

  @IsString()
  snoozeUntil!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentFeatureIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentDepartmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentAiAgentIds?: string[];
}
