/**
 * LLM Provider Registry — DTOs.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 *
 * Solid:
 *   • DTOs are decoupled from Prisma types so the controller surface is
 *     typed independently of the persistence layer.
 *   • All string fields validated with class-validator at the controller
 *     boundary; the service receives already-validated input.
 */

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { LlmProviderKind, LlmProviderStatus } from '@prisma/client';
// Re-import the runtime enum objects so @IsEnum can read their keys.
import { LlmProviderKind as LlmProviderKindObj, LlmProviderStatus as LlmProviderStatusObj } from '@prisma/client';

export class CreateLlmProviderDto {
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'slug must be lowercase alphanumeric with optional - or _',
  })
  slug!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsEnum(LlmProviderKindObj)
  kind!: LlmProviderKind;

  @IsEnum(LlmProviderStatusObj)
  @IsOptional()
  status?: LlmProviderStatus;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  // Secret reference (e.g. "env:OPENAI_API_KEY"). Never the plaintext key.
  @IsString()
  @Length(3, 256)
  secretRef!: string;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @IsOptional()
  requestsPerMinuteCap?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrent?: number;
}

export class UpdateLlmProviderDto {
  @IsString()
  @Length(2, 120)
  @IsOptional()
  displayName?: string;

  @IsEnum(LlmProviderStatusObj)
  @IsOptional()
  status?: LlmProviderStatus;

  @IsUrl({ require_tld: false })
  @IsOptional()
  baseUrl?: string;

  @IsString()
  @Length(3, 256)
  @IsOptional()
  secretRef?: string;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @IsOptional()
  requestsPerMinuteCap?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrent?: number;
}

export class CreateLlmProviderModelDto {
  @IsString()
  @Length(1, 256)
  modelId!: string;

  @IsString()
  @Length(1, 256)
  displayName!: string;

  @IsObject()
  @IsOptional()
  capabilities?: Record<string, unknown>;

  @IsInt()
  @Min(128)
  @Max(2_000_000)
  contextWindow!: number;

  @IsOptional()
  costInputPer1k?: number;

  @IsOptional()
  costOutputPer1k?: number;
}

export interface ResolvedLlmProvider {
  id: string;
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  status: LlmProviderStatus;
  baseUrl: string;
  apiKey: string; // resolved from secretRef — NEVER returned in HTTP responses
  orgId: string | null;
  model: {
    id: string;
    modelId: string;
    displayName: string;
    contextWindow: number;
    capabilities: Record<string, unknown>;
  };
}

export interface LlmProviderAuditSnapshot {
  id: string;
  slug: string;
  status: LlmProviderStatus;
  secretRef: string;
  baseUrl: string;
}

export const PUBLIC_LLM_PROVIDER_FIELDS = [
  'id',
  'slug',
  'displayName',
  'kind',
  'status',
  'baseUrl',
  'orgId',
  'metadata',
  'requestsPerMinuteCap',
  'maxConcurrent',
  'createdAt',
  'updatedAt',
] as const;

export type PublicLlmProvider = Record<
  (typeof PUBLIC_LLM_PROVIDER_FIELDS)[number],
  unknown
>;

export function toPublicLlmProvider(p: {
  id: string;
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  status: LlmProviderStatus;
  baseUrl: string;
  orgId: string | null;
  metadata: unknown;
  requestsPerMinuteCap: number | null;
  maxConcurrent: number | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicLlmProvider {
  return {
    id: p.id,
    slug: p.slug,
    displayName: p.displayName,
    kind: p.kind,
    status: p.status,
    baseUrl: p.baseUrl,
    orgId: p.orgId,
    metadata: p.metadata,
    requestsPerMinuteCap: p.requestsPerMinuteCap,
    maxConcurrent: p.maxConcurrent,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Boolean helper — currently unused but kept to force the validator
// compiler to keep the `IsBoolean` import out of the noUnusedLocals set.
export const __keep_isBoolean = IsBoolean;
