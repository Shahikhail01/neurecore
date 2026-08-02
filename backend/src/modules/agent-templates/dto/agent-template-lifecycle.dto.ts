// src/modules/agent-templates/dto/agent-template-lifecycle.dto.ts
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTOs for the persisted agent-template lifecycle surface.
 *
 * SECURITY: `maxEffect`, `requiredAuthority`, and `approvalSensitive` are
 * NOT accepted from these DTOs — they are server-derived from the composed
 * skill graph in AgentSkillBuilderService. Any field here that resembles
 * authority or capability is intentionally absent.
 */

export class SkillRefDto {
  @IsString()
  @MinLength(1)
  skillKey!: string;

  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'semanticVersion must be semver' })
  semanticVersion!: string;
}

export class CreateVersionDto {
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must be semver' })
  version!: string;

  @IsObject()
  definition!: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillRefDto)
  composedSkillRefs!: SkillRefDto[];

  @IsOptional()
  @IsUUID()
  escalationActorId?: string;

  @IsOptional()
  @IsObject()
  budgetLimit?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  rateLimits?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  channelBindings?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  approvalPolicyRefs?: string[];

  @IsOptional()
  @IsNumber()
  evaluationMinScore?: number;

  @IsOptional()
  @IsString()
  evaluationDatasetId?: string;
}

export class CertifyVersionDto {
  @IsObject()
  evaluationReport!: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class LifecycleTransitionDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class RollbackDto {
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'targetVersion must be semver' })
  targetVersion!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class CreateSkillDto {
  @IsString()
  @MinLength(1)
  skillKey!: string;

  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'semanticVersion must be semver' })
  semanticVersion!: string;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillRefDto)
  composedOf?: SkillRefDto[];

  @IsOptional()
  @IsObject()
  preconditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  postconditions?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  retryPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKeyPattern?: string;

  @IsOptional()
  @IsObject()
  responseEnvelopeMapping?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  testExamples?: unknown[];
}

export class SkillTransitionDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'certifiedVersion must be semver' })
  certifiedVersion?: string;
}

export class SkillCertificationDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'certifiedVersion must be semver' })
  certifiedVersion!: string;
}
