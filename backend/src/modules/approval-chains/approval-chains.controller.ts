/**
 * approval-chains module — REST API Controller
 *
 * Phase 4: Approval chain resolution + management.
 * SOLID: Thin controller — delegates to ApprovalChainsService.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalChainsService } from './approval-chains.service';
import {
  ResolveApprovalChainDto,
  ListApprovalWorkflowsDto,
} from './dto/approval-chain.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiCommon('approval-chains')
@Controller({ path: 'approval-chains', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApprovalChainsController {
  constructor(private readonly chainService: ApprovalChainsService) {}

  /**
   * Resolve the approval chain for a deliverable.
   *
   * Audit-remediation fix: the previous implementation forwarded
   * `user.tenantId` as the `riskTier` positional argument of the service,
   * which compared a UUID against risk-tier names and always 404'd. The
   * service now derives riskTier from the deliverable using its own
   * repository port.
   *
   * POST /approval-chains/resolve
   */
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  async resolveChain(@CurrentUser() user: JwtPayload, @Body() dto: ResolveApprovalChainDto) {
    const tenantId = requireTenantId(user);
    return this.chainService.resolveChain(tenantId, dto.deliverableId, dto.projectTypeVersionId);
  }

  /**
   * Get pending approval workflows for the tenant.
   * GET /approval-chains/pending
   */
  @Get('pending')
  async findPending(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListApprovalWorkflowsDto,
  ) {
    const tenantId = requireTenantId(user);
    return this.chainService.findPendingWorkflows(tenantId, query.riskTier);
  }

  /**
   * Get the current step of an approval workflow.
   * GET /approval-chains/:workflowId/current-step
   */
  @Get(':workflowId/current-step')
  async getCurrentStep(@CurrentUser() user: JwtPayload, @Param('workflowId') workflowId: string) {
    const tenantId = requireTenantId(user);
    return this.chainService.getCurrentStep(tenantId, workflowId);
  }

  /**
   * Check if a step is blocked by its prior step.
   * GET /approval-chains/steps/:stepId/blocked
   */
  @Get('steps/:stepId/blocked')
  async isStepBlocked(@CurrentUser() user: JwtPayload, @Param('stepId') stepId: string) {
    const tenantId = requireTenantId(user);
    const blocked = await this.chainService.isStepBlocked(tenantId, stepId);
    return { blocked };
  }

  /**
   * Advance workflow to next sequential step.
   * POST /approval-chains/:workflowId/advance
   */
  @Post(':workflowId/advance')
  @HttpCode(HttpStatus.NO_CONTENT)
  async advanceChain(@CurrentUser() user: JwtPayload, @Param('workflowId') workflowId: string) {
    const tenantId = requireTenantId(user);
    await this.chainService.advanceChain(tenantId, workflowId);
  }

  /**
   * GET /approval-chains/industry-routes?industry=<slug>
   *
   * Stage 2 Phase 2A: Resolve industry-specific approval routes.
   * FIX-COMPREHENSIVE 2026-07-23: Response shape is `TierGuardOutcome`
   * (eligible + blocked). Backwards-compatible: `count` is the number of
   * eligible routes, `total` includes blocked. `blocked` carries the
   * per-route `reason` + `minTierSlug` for the FE upgrade CTA.
   */
  @Get('industry-routes')
  async getIndustryRoutes(
    @CurrentUser() user: JwtPayload,
    @Query('industry') industrySlug: string,
  ) {
    const tenantId = requireTenantId(user);
    const outcome = await this.chainService.getIndustryRoutes(
      tenantId,
      industrySlug,
    );
    return {
      industrySlug,
      eligible: outcome.eligible,
      blocked: outcome.blocked,
      count: outcome.eligible.length,
      total: outcome.eligible.length + outcome.blocked.length,
      currentTierSlug: outcome.currentTierSlug,
      maxApprovalStages: outcome.maxApprovalStages,
    };
  }
}

/**
 * Helpers
 */
function requireTenantId(user: JwtPayload): string {
  const tenantId = (user && (user as { tenantId?: string | null }).tenantId) ?? null;
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required for approval-chain operations');
  }
  return tenantId;
}
