/**
 * pool-provisioning.dto.ts — SOLID: Interface Segregation
 *
 * Each DTO is a focused contract for one operation.
 * No fat DTOs — separate DTOs for each use case.
 */

import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Slot Type Enum ───────────────────────────────────────────────────────────

export enum SlotType {
  FIXED = 'FIXED',
  CHOICE = 'CHOICE',
}

// ─── Create Pool Slot (SuperAdmin only) ───────────────────────────────────────

export class CreatePoolSlotDto {
  @IsUUID()
  templateId!: string;

  @IsNumber()
  @Min(1)
  slot!: number;

  @IsEnum(SlotType)
  slotType!: SlotType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultBudgetPerDay?: number;

  @IsOptional()
  @IsString()
  defaultModel?: string;
}

// ─── Update Pool Slot (SuperAdmin only) ───────────────────────────────────────

export class UpdatePoolSlotDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  slot?: number;

  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultBudgetPerDay?: number;

  @IsOptional()
  @IsString()
  defaultModel?: string;
}

// ─── Reorder Pool Slots ────────────────────────────────────────────────────────

export class ReorderSlotDto {
  @IsUUID()
  slotId!: string;

  @IsNumber()
  @Min(1)
  newPosition!: number;
}

export class ReorderPoolSlotsDto {
  @IsUUID('4', { each: true })
  orderedSlotIds!: string[];
}

// ─── Provision to Tenant (SuperAdmin only) ────────────────────────────────────

export class ProvisionToTenantDto {
  @IsUUID()
  tenantId!: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  slotIds?: string[];  // If omitted, provisions all default-selected slots
}

// ─── Agent Slot Management (Tenant ADMIN) ─────────────────────────────────────

export class ProvisionAgentFromSlotDto {
  @IsUUID()
  slotId!: string;
}

export class ReplaceSlotAgentDto {
  @IsUUID()
  newTemplateId!: string;
}