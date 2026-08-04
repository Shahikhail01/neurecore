/**
 * Routine DTOs (Data Transfer Objects)
 *
 * Validates and transforms data for API requests/responses
 * following NestJS validation patterns.
 *
 * NOTE: Classes are ordered by dependency - dependent classes must come first.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,

  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type {
  RoutineStatus,
  RoutineTriggerType,
} from '../interfaces/routine.interface';

// ─── Shared/Primitive DTOs (No dependencies) ─────────────────────────────────

export class RetryPolicyDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries!: number;

  @IsNumber()
  @IsOptional()
  @Min(100)
  backoffMs?: number;

  @IsBoolean()
  @IsOptional()
  exponential?: boolean;
}

export class RoutineEdgeDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  target!: string;

  @IsString()
  @IsOptional()
  label?: string;
}

export class RoutineConditionalEdgeDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  condition!: string;

  @IsObject()
  branches!: Record<string, string>;
}

// ─── Node & Config DTOs (Depend on RetryPolicyDto) ─────────────────────────────

export class NodeConfigDto {
  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  toolId?: string;

  @IsString()
  @IsOptional()
  prompt?: string;

  @IsObject()
  @IsOptional()
  inputMapping?: Record<string, string>;

  @IsObject()
  @IsOptional()
  outputMapping?: Record<string, string>;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(300000) // 5 minutes max
  timeoutMs?: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retryPolicy?: RetryPolicyDto;
}

export class RoutineNodeDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['agent', 'tool', 'condition', 'approval', 'transform'])
  type!: 'agent' | 'tool' | 'condition' | 'approval' | 'transform';

  @IsObject()
  @ValidateNested()
  @Type(() => NodeConfigDto)
  config!: NodeConfigDto;
}

export class RoutineConfigDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  maxIterations?: number;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  @Max(600000) // 10 minutes max
  timeoutMs?: number;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => RetryPolicyDto)
  retryPolicy?: RetryPolicyDto;

  @IsBoolean()
  @IsOptional()
  checkpointEnabled?: boolean;
}

// ─── Graph Definition (Depends on RoutineNodeDto, RoutineEdgeDto) ─────────────

export class GraphDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineNodeDto)
  nodes!: RoutineNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineEdgeDto)
  edges!: RoutineEdgeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => RoutineConditionalEdgeDto)
  conditionalEdges?: RoutineConditionalEdgeDto[];

  @IsString()
  @IsOptional()
  entryPoint?: string;
}

// ─── Trigger Config (No dependencies) ─────────────────────────────────────────

export class TriggerConfigDto {
  // Schedule config
  @IsString()
  @IsOptional()
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    {
      message: 'Invalid cron expression',
    },
  )
  cronExpression?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  // Webhook config
  @IsEnum(['GET', 'POST', 'ANY'])
  @IsOptional()
  method?: 'GET' | 'POST' | 'ANY';

  @IsEnum(['none', 'signature', 'bearer'])
  @IsOptional()
  authType?: 'none' | 'signature' | 'bearer';

  // Event config
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eventTypes?: string[];

  @IsObject()
  @IsOptional()
  filter?: Record<string, unknown>;
}

// ─── Routine DTOs (Depend on GraphDefinitionDto, RoutineConfigDto) ─────────────

export class CreateRoutineDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => GraphDefinitionDto)
  graphDefinition!: GraphDefinitionDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutineConfigDto)
  config?: RoutineConfigDto;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  ownerAgentId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateTriggerDto)
  triggers?: CreateTriggerDto[];
}

export class UpdateRoutineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => GraphDefinitionDto)
  graphDefinition?: GraphDefinitionDto;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => RoutineConfigDto)
  config?: RoutineConfigDto;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  ownerAgentId?: string | null;

  @IsEnum(['DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED'])
  @IsOptional()
  status?: RoutineStatus;
}

// ─── Trigger DTOs (Depend on TriggerConfigDto) ──────────────────────────────────

export class CreateTriggerDto {
  @IsEnum(['SCHEDULE', 'WEBHOOK', 'EVENT', 'MANUAL'])
  type!: RoutineTriggerType;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  config!: TriggerConfigDto;
}

export class UpdateTriggerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => TriggerConfigDto)
  config?: TriggerConfigDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ─── Routine Run DTOs (No dependencies) ──────────────────────────────────────

export class ExecuteRoutineDto {
  @IsObject()
  @IsOptional()
  input?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  agentId?: string;
}

export class RoutineRunDto {
  id!: string;
  routineId!: string;
  tenantId!: string;
  status!: string;
  input!: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  triggerType?: RoutineTriggerType;
  triggerId?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  createdAt!: Date;
  updatedAt!: Date;
}

// ─── Query DTOs (No dependencies) ─────────────────────────────────────────────

export class ListRoutinesQueryDto {
  @IsEnum(['DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED'])
  @IsOptional()
  status?: RoutineStatus;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @IsEnum(['createdAt', 'updatedAt', 'name'])
  @IsOptional()
  orderBy?: 'createdAt' | 'updatedAt' | 'name';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';

  // Phase 1 Gap 1 — filter routines by owner agent (used by workspace tab)
  @IsString()
  @IsOptional()
  ownerAgentId?: string;

  // Phase 1 Gap 1 — filter by multiple owner agents (e.g. all agents in a dept)
  // Comma-separated UUID list; repository splits and uses `IN` clause.
  @IsString()
  @IsOptional()
  ownerAgentIds?: string;
}

export class ListRunsQueryDto {
  @IsEnum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @IsEnum(['createdAt', 'startedAt'])
  @IsOptional()
  orderBy?: 'createdAt' | 'startedAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';
}

// ─── Response DTOs (Depend on GraphDefinitionDto, RoutineConfigDto, etc) ───────

export class TriggerResponseDto {
  id!: string;
  type!: RoutineTriggerType;
  name?: string;
  config!: TriggerConfigDto;
  isActive!: boolean;
  lastFiredAt?: Date | null;
  nextFireAt?: Date | null;
  webhookPath?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class RoutineResponseDto {
  id!: string;
  name!: string;
  description?: string;
  status!: RoutineStatus;
  graphDefinition!: GraphDefinitionDto;
  config!: RoutineConfigDto;
  metadata!: Record<string, unknown>;
  triggerCount!: number;
  lastRunAt?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class RoutineDetailResponseDto extends RoutineResponseDto {
  triggers!: TriggerResponseDto[];
  runs!: RoutineRunDto[];
}
