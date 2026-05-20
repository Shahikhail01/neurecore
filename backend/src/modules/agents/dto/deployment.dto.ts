import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// Spawn a single agent from a template — SuperAdmin or Tenant OWNER/ADMIN
// POST /api/v1/agents/from-template/:templateId
// ─────────────────────────────────────────────────────────────────────────────

export class SpawnAgentFromTemplateDto {
  /** Human-readable name override — required so each deployed agent has a context-specific name */
  @IsString()
  name!: string;

  /** Target tenant to receive the new agent */
  @IsUUID()
  tenantId!: string;

  /** Optional department assignment */
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Override daily spend cap */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  budgetPerDay?: number;

  /** Override authority level stored in agent config */
  @IsOptional()
  @IsEnum(['AUTO', 'RECOMMEND', 'APPROVAL'])
  authorityLevel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-deploy multiple agent templates to a tenant
// POST /api/v1/tenants/:tenantId/deploy-agents
// ─────────────────────────────────────────────────────────────────────────────

export class BulkAgentDeployItem {
  @IsUUID()
  templateId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  budgetPerDay?: number;

  @IsOptional()
  @IsEnum(['AUTO', 'RECOMMEND', 'APPROVAL'])
  authorityLevel?: string;
}

export class BulkDeployAgentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAgentDeployItem)
  agents!: BulkAgentDeployItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy a full department template (org structure + optional agents) to a tenant
// POST /api/v1/tenants/:tenantId/deploy-dept-template
// ─────────────────────────────────────────────────────────────────────────────

export class DeployDeptTemplateDto {
  @IsUUID()
  templateId!: string;

  /** When true, also creates agents for each dept item using matching platform agent templates */
  @IsOptional()
  @IsBoolean()
  withAgents?: boolean;
}

export class TierBootstrapDto {
  @IsOptional()
  @IsUUID()
  tierId?: string;
}
