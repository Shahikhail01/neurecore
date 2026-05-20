import { Injectable } from '@nestjs/common';
import { TenantDeploymentService } from '../../tiers/services/tenant-deployment.service';
import type {
  SpawnAgentFromTemplateDto,
  BulkDeployAgentsDto,
  TierBootstrapDto,
} from '../dto/deployment.dto';
import type { DeployDeptTemplateDto } from '../dto/deployment.dto';

/**
 * DeploymentService
 *
 * SRP : Solely responsible for deployment operations:
 *         1. Spawning agent instances from platform templates
 *         2. Bulk-deploying multiple agents to a tenant
 *         3. Deploying a department template structure to a tenant
 *       CRUD on agents stays in AgentsService.
 *       CRUD on templates stays in AgentTemplatesService.
 *       CRUD on dept templates stays in DepartmentTemplatesService.
 *
 * OCP : New deployment strategies (e.g. schedule-based) can be added without
 *       touching spawning logic.
 *
 * DIP : Consumed through constructor injection — no concrete class lookups.
 */
@Injectable()
export class DeploymentService {
  constructor(
    private readonly tenantDeploymentService: TenantDeploymentService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Spawn one agent from a platform template
  // ─────────────────────────────────────────────────────────────────────────

  async spawnFromTemplate(
    templateId: string,
    dto: SpawnAgentFromTemplateDto,
    actorId: string,
  ) {
    return this.tenantDeploymentService.spawnFromTemplate(
      templateId,
      dto,
      actorId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Bulk-deploy multiple agents to a tenant in a single transaction
  // ─────────────────────────────────────────────────────────────────────────

  async bulkDeployAgents(
    tenantId: string,
    dto: BulkDeployAgentsDto,
    actorId: string,
  ) {
    return this.tenantDeploymentService.bulkDeployAgents(
      tenantId,
      dto,
      actorId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Deploy a department template structure to a tenant
  //    Optionally auto-creates agents for each dept using matching templates
  // ─────────────────────────────────────────────────────────────────────────

  async deployDeptTemplate(
    tenantId: string,
    dto: DeployDeptTemplateDto,
    actorId: string,
  ) {
    return this.tenantDeploymentService.deployDeptTemplate(
      tenantId,
      dto,
      actorId,
    );
  }

  async previewTierBootstrap(tenantId: string, dto: TierBootstrapDto) {
    const tenant =
      await this.tenantDeploymentService['tenantPolicy'].assertTenantExists(
        tenantId,
      );
    return this.tenantDeploymentService.previewTierBootstrap(
      tenantId,
      dto.tierId ?? tenant.tierId,
    );
  }

  async bootstrapTenantTier(
    tenantId: string,
    dto: TierBootstrapDto,
    actorId: string,
  ) {
    const tenant =
      await this.tenantDeploymentService['tenantPolicy'].assertTenantExists(
        tenantId,
      );
    const targetTierId = dto.tierId ?? tenant.tierId;
    if (targetTierId !== tenant.tierId) {
      throw new Error(
        "Tier bootstrap can only run against the tenant's active tier. Apply the tier change first.",
      );
    }
    return this.tenantDeploymentService.bootstrapTenantTier(
      tenantId,
      targetTierId,
      actorId,
    );
  }
}
