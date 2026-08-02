/**
 * ServiceGatewayFlagsController — admin endpoints for the Service
 * Gateway V2 rollout.
 *
 * Phase 8 (NC-AWL-IMP-1 §11.3). All endpoints are platform-admin only.
 *
 * Routes:
 *   GET    /api/v1/admin/service-gateway-v2/flags
 *     → full snapshot: process kill switch, per-phase, per-channel,
 *       per-tenant override map.
 *   GET    /api/v1/admin/service-gateway-v2/flags/me
 *     → caller's tenant snapshot (if the caller is OWNER/ADMIN they
 *       can see their own override; otherwise the snapshot is empty).
 *   PATCH  /api/v1/admin/service-gateway-v2/flags/process
 *     → toggle the process kill switch.
 *   PATCH  /api/v1/admin/service-gateway-v2/flags/phase/:phase
 *     → toggle a single phase flag.
 *   PATCH  /api/v1/admin/service-gateway-v2/flags/channel/:channel
 *     → toggle a single channel flag.
 *   PATCH  /api/v1/admin/service-gateway-v2/flags/tenants/:tenantId
 *     → set a per-tenant override (body: { subKey, value }).
 *   POST   /api/v1/admin/service-gateway-v2/flags/rollback
 *     → one-shot rollback: process OFF, every phase OFF, every channel OFF.
 *   GET    /api/v1/admin/service-gateway-v2/slo
 *     → read SLO counters (local + Redis-mirrored aggregation).
 *   POST   /api/v1/admin/service-gateway-v2/slo/reset
 *     → reset SLO counters.
 *
 * The body DTOs are validated with class-validator; unknown sub-keys
 * are rejected.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Logger,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { ValidatedUser } from '../../auth/interfaces/auth.interface';
import {
  ServiceGatewayFlagsService,
  SERVICE_GATEWAY_V2_CHANNELS,
  SERVICE_GATEWAY_V2_PHASES,
  TENANT_FLAG_PREFIX,
} from './service-gateway-flags';
import { SloCounters, SloChannel, SloPhase } from './slo-counters';

class ProcessFlagDto {
  enabled!: boolean;
}
class PhaseFlagDto {
  enabled!: boolean;
}
class ChannelFlagDto {
  enabled!: boolean;
}
class TenantOverrideDto {
  subKey!: string;
  value!: boolean;
}

@ApiCommon('admin/service-gateway-v2')
@Controller({ path: 'admin/service-gateway-v2', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
export class ServiceGatewayFlagsController {
  private readonly logger = new Logger(ServiceGatewayFlagsController.name);

  constructor(
    private readonly flags: ServiceGatewayFlagsService,
    private readonly slo: SloCounters,
  ) {}

  @Get('flags')
  flagsSnapshot() {
    return this.flags.snapshot();
  }

  @Get('flags/me')
  async mySnapshot(@CurrentUser() user: ValidatedUser) {
    if (!user.tenantId) {
      return { tenantId: null, overrides: {} };
    }
    return {
      tenantId: user.tenantId,
      ...(await this.flags.snapshotForTenant(user.tenantId)),
    };
  }

  @Patch('flags/process')
  @HttpCode(HttpStatus.OK)
  setProcess(@Body() dto: ProcessFlagDto) {
    this.assertBool(dto?.enabled, 'enabled');
    this.flags.setProcessEnabled(dto.enabled);
    return { processEnabled: dto.enabled };
  }

  @Patch('flags/phase/:phase')
  @HttpCode(HttpStatus.OK)
  setPhase(@Param('phase') phase: string, @Body() dto: PhaseFlagDto) {
    this.assertPhase(phase);
    this.assertBool(dto?.enabled, 'enabled');
    this.flags.setPhaseEnabled(phase as SloPhase, dto.enabled);
    return { phase, enabled: dto.enabled };
  }

  @Patch('flags/channel/:channel')
  @HttpCode(HttpStatus.OK)
  setChannel(@Param('channel') channel: string, @Body() dto: ChannelFlagDto) {
    this.assertChannel(channel);
    this.assertBool(dto?.enabled, 'enabled');
    this.flags.setChannelEnabled(channel as SloChannel, dto.enabled);
    return { channel, enabled: dto.enabled };
  }

  @Patch('flags/tenants/:tenantId')
  @HttpCode(HttpStatus.OK)
  async setTenantOverride(
    @Param('tenantId') tenantId: string,
    @Body() dto: TenantOverrideDto,
  ) {
    if (
      !dto ||
      typeof dto.subKey !== 'string' ||
      typeof dto.value !== 'boolean'
    ) {
      throw new BadRequestException(
        'Body must be { subKey: string, value: boolean }',
      );
    }
    if (!dto.subKey.startsWith(`${TENANT_FLAG_PREFIX}.`)) {
      throw new BadRequestException(
        `subKey must start with "${TENANT_FLAG_PREFIX}." (got "${dto.subKey}")`,
      );
    }
    await this.flags.setTenantOverride(tenantId, dto.subKey, dto.value);
    return { tenantId, subKey: dto.subKey, value: dto.value };
  }

  @Post('flags/rollback')
  @HttpCode(HttpStatus.OK)
  rollback() {
    const summary = this.flags.rollbackAll();
    this.logger.warn(
      `Service Gateway V2 rollback via admin endpoint: ${JSON.stringify(summary)}`,
    );
    return { ok: true, ...summary };
  }

  @Get('slo')
  async sloSnapshot() {
    return this.slo.aggregatedSnapshot();
  }

  @Post('slo/reset')
  @HttpCode(HttpStatus.OK)
  sloReset() {
    this.slo.reset();
    return { ok: true };
  }

  // --- helpers -----------------------------------------------------------

  private assertBool(v: unknown, field: string): void {
    if (typeof v !== 'boolean') {
      throw new BadRequestException(`${field} must be a boolean`);
    }
  }

  private assertPhase(phase: string): void {
    if (!SERVICE_GATEWAY_V2_PHASES.includes(phase as SloPhase)) {
      throw new BadRequestException(
        `Unknown phase "${phase}". Valid: ${SERVICE_GATEWAY_V2_PHASES.join(', ')}`,
      );
    }
  }

  private assertChannel(channel: string): void {
    if (!SERVICE_GATEWAY_V2_CHANNELS.includes(channel as SloChannel)) {
      throw new BadRequestException(
        `Unknown channel "${channel}". Valid: ${SERVICE_GATEWAY_V2_CHANNELS.join(', ')}`,
      );
    }
  }
}
