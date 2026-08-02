/**
 * command-center/services/kill-switch.service.ts
 *
 * P8 — CR-AI-1207 Kill Switch.
 *
 * Wraps ServiceGatewayFlagsService so the command-center dashboard
 * can list + toggle the same flag matrix that powers the gateway.
 * Every toggle writes an AuditLog entry under the tenant so the
 * dashboard has a tamper-evident audit trail. Per-tenant overrides
 * go through the canonical `setTenantOverride` path so they survive
 * process restarts.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  ServiceGatewayFlagsService,
  SERVICE_GATEWAY_V2_CHANNELS,
  SERVICE_GATEWAY_V2_PHASES,
  TENANT_FLAG_PREFIX,
} from '@/modules/service-gateway-v2/rollout/service-gateway-flags';
import {
  KillSwitchEntryDto,
  KillSwitchListResponseDto,
  KillSwitchScope,
  SetKillSwitchDto,
  SetKillSwitchResponseDto,
} from '../dto/kill-switch.dto';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@Injectable()
export class KillSwitchService {
  private readonly logger = new Logger(KillSwitchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: ServiceGatewayFlagsService,
  ) {}

  async list(tenantId: string): Promise<KillSwitchListResponseDto> {
    const snapshot = await this.flags.snapshotForTenant(tenantId);
    const entries: KillSwitchEntryDto[] = [];
    const now = new Date().toISOString();
    for (const phase of SERVICE_GATEWAY_V2_PHASES) {
      entries.push({
        scope: 'phase',
        target: phase,
        enabled: snapshot.phase[phase],
        processEnabled: snapshot.processEnabled,
        updatedAt: now,
      });
    }
    for (const channel of SERVICE_GATEWAY_V2_CHANNELS) {
      entries.push({
        scope: 'channel',
        target: channel,
        enabled: snapshot.channel[channel],
        processEnabled: snapshot.processEnabled,
        updatedAt: now,
      });
    }
    for (const [subKey, value] of Object.entries(snapshot.overrides)) {
      entries.push({
        scope: 'tenant-feature',
        target: subKey,
        enabled: value,
        processEnabled: snapshot.processEnabled,
        updatedAt: now,
      });
    }
    return {
      tenantId,
      processEnabled: snapshot.processEnabled,
      overrides: snapshot.overrides,
      entries,
      fetchedAt: now,
    };
  }

  async set(
    tenantId: string,
    actor: JwtPayload,
    dto: SetKillSwitchDto,
  ): Promise<SetKillSwitchResponseDto> {
    if (!dto || typeof dto.enabled !== 'boolean' || !dto.scope) {
      throw new BadRequestException(
        'Body must include scope, enabled, and reason',
      );
    }
    if (
      !dto.reason ||
      typeof dto.reason !== 'string' ||
      dto.reason.length < 3
    ) {
      throw new BadRequestException(
        'reason is required and must be at least 3 characters',
      );
    }
    const scope: KillSwitchScope = dto.scope;
    const target = (dto.target ?? '').trim();
    if (scope !== 'process' && !target) {
      throw new BadRequestException(`target is required for scope "${scope}"`);
    }

    switch (scope) {
      case 'process':
        this.flags.setProcessEnabled(dto.enabled);
        break;
      case 'phase':
        this.assertPhase(target);
        this.flags.setPhaseEnabled(
          target as (typeof SERVICE_GATEWAY_V2_PHASES)[number],
          dto.enabled,
        );
        break;
      case 'channel':
        this.assertChannel(target);
        this.flags.setChannelEnabled(
          target as (typeof SERVICE_GATEWAY_V2_CHANNELS)[number],
          dto.enabled,
        );
        break;
      case 'tenant-feature':
        if (!target.startsWith(`${TENANT_FLAG_PREFIX}.`)) {
          throw new BadRequestException(
            `tenant-feature target must start with "${TENANT_FLAG_PREFIX}."`,
          );
        }
        await this.flags.setTenantOverride(tenantId, target, dto.enabled);
        break;
      default:
        throw new BadRequestException(`Unknown scope: ${String(scope)}`);
    }

    const audit = await this.prisma.auditLog.create({
      data: {
        actor: actor?.sub ?? 'system',
        action: `command-center.kill_switch.${dto.enabled ? 'enabled' : 'disabled'}`,
        resource: scope,
        resourceId: target || null,
        tenantId,
        result: 'success',
        details: {
          scope,
          target: target || null,
          enabled: dto.enabled,
          reason: dto.reason,
        },
      },
      select: { id: true, createdAt: true },
    });

    this.logger.log(
      `kill_switch tenant=${tenantId} scope=${scope} target=${target || '<process>'} enabled=${dto.enabled} reason="${dto.reason}"`,
    );

    return {
      scope,
      target: target || null,
      enabled: dto.enabled,
      appliedAt: audit.createdAt.toISOString(),
      auditLogId: audit.id,
    };
  }

  private assertPhase(phase: string): void {
    if (!SERVICE_GATEWAY_V2_PHASES.includes(phase as never)) {
      throw new BadRequestException(
        `Unknown phase "${phase}". Valid: ${SERVICE_GATEWAY_V2_PHASES.join(', ')}`,
      );
    }
  }

  private assertChannel(channel: string): void {
    if (!SERVICE_GATEWAY_V2_CHANNELS.includes(channel as never)) {
      throw new BadRequestException(
        `Unknown channel "${channel}". Valid: ${SERVICE_GATEWAY_V2_CHANNELS.join(', ')}`,
      );
    }
  }
}
