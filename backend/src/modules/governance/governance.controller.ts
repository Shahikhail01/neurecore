import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GovernanceRulesService } from './services/governance-rules.service';
import { ApprovalsService } from './services/approvals.service';
import {
  CreateGovernanceRuleDto,
  UpdateGovernanceRuleDto,
} from './dto/governance.dto';
import { CreateApprovalDto, ReviewApprovalDto } from './dto/approval.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { ApprovalStatus } from '@prisma/client';
import { isPlatformAdminRole } from '../../common/types/user-role.utils';

// ─── Governance Rules ─────────────────────────────────────────────────────────

@Controller({ path: 'governance/rules', version: '1' })
export class GovernanceRulesController {
  constructor(private readonly rulesService: GovernanceRulesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rulesService.findAll(user.tenantId!);
  }

  @Post()
  create(
    @Body() dto: CreateGovernanceRuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.create(user.tenantId!, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGovernanceRuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.update(id, user.tenantId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.remove(id, user.tenantId!);
  }

  @Post('evaluate')
  evaluate(
    @Body() context: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.evaluate(user.tenantId!, context);
  }

  /**
   * POST /governance/rules/validate — validate a proposed action context against active rules.
   * Spec-defined alias for evaluate.
   */
  @Post('validate')
  validate(
    @Body() context: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.evaluate(user.tenantId!, context);
  }

  /**
   * GET /governance/rules/audit/:agentId — governance decision history for a specific agent.
   */
  @Get('audit/:agentId')
  getAgentAudit(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.rulesService.getAgentAudit(agentId, user.tenantId!, {
      page: Number(page),
      limit: Number(limit),
    });
  }
}

// ─── Governance Policies ─────────────────────────────────────────────────────────

@Controller({ path: 'governance/policies', version: '1' })
export class GovernancePoliciesController {
  /**
   * GET /governance/policies — List all governance policies
   */
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('limit') limit = '50') {
    // TODO: Implement actual policies retrieval from database
    // Return empty array as placeholder - frontend expects { data: { data: [...] } }
    return {
      data: {
        data: [],
        meta: {
          page: 1,
          limit: Number(limit),
          total: 0,
        },
      },
    };
  }
}

// ─── Governance Anomalies ───────────────────────────────────────────────────────

@Controller({ path: 'governance/anomalies', version: '1' })
export class GovernanceAnomaliesController {
  /**
   * GET /governance/anomalies — List all detected anomalies
   */
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('limit') limit = '50') {
    // TODO: Implement actual anomalies retrieval from database
    // Return empty array as placeholder - frontend expects { data: { data: [...] } }
    return {
      data: {
        data: [],
        meta: {
          page: 1,
          limit: Number(limit),
          total: 0,
        },
      },
    };
  }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

@Controller({ path: 'approvals', version: '1' })
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  private isPlatformRole(user: JwtPayload): boolean {
    return isPlatformAdminRole(user.role);
  }

  private resolveApprovalTenantId(
    user: JwtPayload,
    tenantId?: string,
    scope?: string,
  ): string | null {
    if (this.isPlatformRole(user)) {
      if (scope === 'platform') {
        return null;
      }

      if (tenantId) {
        return tenantId;
      }

      throw new BadRequestException(
        'tenantId is required unless scope=platform',
      );
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    return user.tenantId;
  }

  private async resolveExistingApprovalTenantId(
    user: JwtPayload,
    approvalId: string,
    tenantId?: string,
    scope?: string,
  ): Promise<string> {
    if (!this.isPlatformRole(user)) {
      if (!user.tenantId) {
        throw new ForbiddenException('Tenant context required');
      }

      return user.tenantId;
    }

    if (tenantId) {
      return tenantId;
    }

    if (scope === 'platform') {
      const approval = await this.approvalsService.findOne(approvalId, null);
      return approval.tenantId;
    }

    throw new BadRequestException('tenantId is required unless scope=platform');
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ApprovalStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.approvalsService.findAll(
      this.resolveApprovalTenantId(user, tenantId, scope),
      {
        status,
        page: Number(page),
        limit: Number(limit),
      },
    );
  }

  @Get('pending-count')
  pendingCount(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    const resolvedTenantId = this.resolveApprovalTenantId(
      user,
      tenantId,
      scope,
    );

    if (resolvedTenantId === null) {
      return this.approvalsService.getPendingCountPlatform();
    }

    return this.approvalsService.getPendingCount(resolvedTenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.approvalsService.findOne(
      id,
      this.resolveApprovalTenantId(user, tenantId, scope),
    );
  }

  /** GET /approvals/:id/history — full lifecycle timeline of an approval request */
  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.approvalsService.getHistory(
      id,
      this.resolveApprovalTenantId(user, tenantId, scope),
    );
  }

  @Post()
  create(@Body() dto: CreateApprovalDto, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.create({
      ...dto,
      tenantId: user.tenantId!,
      requestedById: user.sub,
    });
  }

  @Patch(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApprovalDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.resolveExistingApprovalTenantId(user, id, tenantId, scope).then(
      (resolvedTenantId) =>
        this.approvalsService.review(id, resolvedTenantId, user.sub, dto),
    );
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    return this.resolveExistingApprovalTenantId(user, id, tenantId, scope).then(
      (resolvedTenantId) =>
        this.approvalsService.cancel(id, resolvedTenantId, user.sub),
    );
  }
}
