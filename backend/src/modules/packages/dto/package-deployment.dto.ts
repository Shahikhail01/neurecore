import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';

/**
 * POST /api/v1/packages/deploy
 * Deploy a Package composition (Departments + AI Employees + feature flags)
 * to a single tenant in one transaction.
 *
 * SRP: shape only. All logic lives in PackageDeploymentService.
 */
export class DeployPackageDto {
  /** Package row id (Pool #6 composite root) */
  @IsString()
  packageId!: string;

  /** Target tenant */
  @IsString()
  tenantId!: string;

  /**
   * Whether to also create AI Employee instances from the package's
   * aiAgents composition. Default true. When false, only departments
   * are created (e.g. if tenant already has the agents from a previous deploy).
   */
  @IsOptional()
  @IsBoolean()
  withAgents?: boolean;

  /** Optional authority level override applied to every spawned agent */
  @IsOptional()
  @IsIn(['AUTO', 'RECOMMEND', 'APPROVAL'])
  authorityLevel?: 'AUTO' | 'RECOMMEND' | 'APPROVAL';

  /**
   * When true, the deploy becomes idempotent: re-running for the same
   * (packageId, tenantId) pair skips agents whose name + tenant already
   * exist. Default true.
   */
  @IsOptional()
  @IsBoolean()
  idempotent?: boolean;
}

/**
 * GET /api/v1/packages/deploy/preview
 * Dry-run validation: returns feasibility counts and blockers without
 * writing anything.
 */
export class PreviewPackageDeployDto {
  @IsString()
  packageId!: string;

  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsBoolean()
  withAgents?: boolean;

  /** Optional super-admin override label echoed in audit logs */
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Response shapes (exported so the controller can name them) ────────────

export interface DeployPackageItemRef {
  id: string;
  name: string;
  templateId: string;
  reused: boolean;
}

export interface DeployPackageOutcome {
  package: { id: string; slug: string; name: string; version: number };
  tenantId: string;
  departments: {
    reused: number;
    created: number;
    items: DeployPackageItemRef[];
  };
  agents: {
    skipped: number;
    created: number;
    items: DeployPackageItemRef[];
  };
  authorityLevel: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
  idempotent: boolean;
  deployedAt: string;
}

export interface PreviewPackageOutcome {
  packageId: string;
  tenantId: string;
  withAgents: boolean;
  feasible: boolean;
  blockers: string[];
  totals: {
    departments: number;
    agents: number;
    features: number;
  };
  capacity: {
    departmentsUsed: number;
    departmentsLimit: number;
    agentsUsed: number;
    agentsLimit: number;
    departmentsRemaining: number;
    agentsRemaining: number;
  };
}

export interface PackageDeploymentHistoryItem {
  id: string;
  packageId: string | null;
  packageName: string | null;
  tenantId: string;
  actor: string;
  authorityLevel: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
  idempotent: boolean;
  withAgents: boolean;
  departmentsCreated: number;
  departmentsReused: number;
  agentsCreated: number;
  agentsSkipped: number;
  createdAt: string;
}
