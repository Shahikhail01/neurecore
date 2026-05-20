import { Controller, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { DeploymentService } from './services/deployment.service';
import {
  SpawnAgentFromTemplateDto,
  BulkDeployAgentsDto,
  DeployDeptTemplateDto,
  TierBootstrapDto,
} from './dto/deployment.dto';
import { AuditLog } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

/**
 * DeploymentController — /api/v1/deploy
 *
 * SRP : Handles only deployment (spawning instances from templates).
 *       No CRUD here — see AgentsController / AgentTemplatesController.
 *
 * All routes restricted to SUPER_ADMIN (full platform rights).
 */
@Controller({ path: 'deploy', version: '1' })
@Roles(UserRole.SUPER_ADMIN)
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  /**
   * POST /api/v1/deploy/agents/from-template/:templateId
   * Spawn a single agent from a platform template and assign to a tenant.
   */
  @Post('agents/from-template/:templateId')
  @AuditLog('DEPLOY_AGENT_FROM_TEMPLATE')
  spawnFromTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: SpawnAgentFromTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.spawnFromTemplate(templateId, dto, user.sub);
  }

  /**
   * POST /api/v1/deploy/tenants/:tenantId/agents
   * Bulk-deploy multiple agents (from templates) to a tenant.
   * All-or-nothing transaction.
   */
  @Post('tenants/:tenantId/agents')
  @AuditLog('DEPLOY_AGENTS_TO_TENANT')
  bulkDeployAgents(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: BulkDeployAgentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.bulkDeployAgents(tenantId, dto, user.sub);
  }

  /**
   * POST /api/v1/deploy/tenants/:tenantId/dept-template
   * Deploy a full department template structure to a tenant.
   * Optionally bootstraps head agents for each department.
   */
  @Post('tenants/:tenantId/dept-template')
  @AuditLog('DEPLOY_DEPARTMENT_TEMPLATE_TO_TENANT')
  deployDeptTemplate(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: DeployDeptTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.deployDeptTemplate(tenantId, dto, user.sub);
  }

  @Post('tenants/:tenantId/tier-bootstrap/preview')
  @AuditLog('TENANT_TIER_BOOTSTRAP_PREVIEW')
  previewTierBootstrap(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: TierBootstrapDto,
  ) {
    return this.deploymentService.previewTierBootstrap(tenantId, dto);
  }

  @Post('tenants/:tenantId/tier-bootstrap')
  @AuditLog('TENANT_TIER_BOOTSTRAP_EXECUTE')
  bootstrapTenantTier(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: TierBootstrapDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deploymentService.bootstrapTenantTier(tenantId, dto, user.sub);
  }
}
