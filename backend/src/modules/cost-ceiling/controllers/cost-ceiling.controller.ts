/**
 * Phase 30 — Cost ceiling HTTP surface (CR-AI-1305).
 *
 * Mounted under the Command Center namespace so the operator console
 * reads containment controls from the same place it reads cost,
 * quality and kill switches:
 *
 *   GET  /command-center/cost-ceilings           — configured ceilings
 *   GET  /command-center/cost-ceilings/status    — ceiling utilisation
 *   POST /command-center/cost-ceilings           — set a ceiling (audited)
 *   GET  /command-center/cost-ceilings/dashboard — cost + resilience
 *
 * Every handler derives the tenant from the authenticated principal —
 * never from the request body — and delegates to the tenant-scope
 * guardrail, which refuses the wildcard.
 *
 * SOLID
 *   SRP — HTTP only. No policy, no persistence, no composition.
 *   DIP — depends on the scope guardrail and the dashboard service.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { CostCeilingTenantScopeService } from '../cost-ceiling.tenant-scope.service';
import { CostDashboardService } from '../cost-dashboard.service';
import { isCostDimension, SetCostCeilingDto } from '../dto/cost-ceiling.dto';

@ApiTags('Command Center')
@ApiBearerAuth()
@Controller({ path: 'command-center/cost-ceilings', version: '1' })
export class CostCeilingController {
  constructor(
    private readonly ceilings: CostCeilingTenantScopeService,
    private readonly dashboard: CostDashboardService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P30 (CR-AI-1305): configured per-tenant ceilings' })
  async list(@CurrentUser() user: JwtPayload) {
    const ceilings = await this.ceilings.list(user.tenantId!);
    return {
      tenantId: user.tenantId!,
      ceilings,
      fetchedAt: new Date().toISOString(),
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P30 (CR-AI-1305): ceiling utilisation + usage' })
  async status(@CurrentUser() user: JwtPayload) {
    return this.ceilings.status(user.tenantId!);
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'P30 (CR-AI-1305): cost + resilience operator dashboard',
  })
  async dashboardView(@CurrentUser() user: JwtPayload) {
    return this.dashboard.dashboard(user.tenantId!);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P30 (CR-AI-1305): set a ceiling (audited)' })
  async set(@CurrentUser() user: JwtPayload, @Body() body: SetCostCeilingDto) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body required');
    }
    const requestedDimension: unknown = body.dimension;
    if (!isCostDimension(requestedDimension)) {
      throw new BadRequestException(
        `unknown dimension "${String(requestedDimension)}"`,
      );
    }
    if (!Number.isSafeInteger(body.limitValue) || body.limitValue < 0) {
      throw new BadRequestException(
        'limitValue must be a non-negative safe integer',
      );
    }
    return this.ceilings.set({
      tenantId: user.tenantId!,
      dimension: requestedDimension,
      limitValue: body.limitValue,
      enabled: body.enabled !== false,
      actorUserId: user.sub,
    });
  }
}
