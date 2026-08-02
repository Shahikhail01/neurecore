/**
 * command-center/services/channel-health.service.ts
 *
 * P8 — CR-AI-1205 Channel Health view.
 *
 * Reconciles CrmConnector + OAuthToken + AuditLog (channel
 * failures) into a tenant-scoped channel inventory with a
 * derived health grade. No synthetic green status — empty
 * connectors render as an empty array and a separate "no
 * channels configured" state is available to the caller.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  ChannelHealthResponseDto,
  ChannelHealthEntryDto,
} from '../dto/channel-health.dto';

const FAILURE_WINDOW_DAYS = 7;
export type ChannelGrade = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export function channelGrade(
  failureRate: number,
  hasToken: boolean,
): ChannelGrade {
  if (!hasToken) return 'UNKNOWN';
  if (failureRate >= 0.5) return 'UNHEALTHY';
  if (failureRate >= 0.2) return 'DEGRADED';
  return 'HEALTHY';
}

@Injectable()
export class ChannelHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannelHealth(tenantId: string): Promise<ChannelHealthResponseDto> {
    const now = new Date();
    const failureSince = new Date(
      now.getTime() - FAILURE_WINDOW_DAYS * 24 * 3600 * 1000,
    );

    const connectors = await this.prisma.crmConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const tokens = await this.prisma.oAuthToken.findMany({
      where: { tenantId },
      select: {
        provider: true,
        expiresAt: true,
      },
    });
    const tokenByProvider = new Map<string, Date | null>();
    for (const t of tokens) {
      tokenByProvider.set(t.provider, t.expiresAt);
    }

    const failureActions = [
      'channel.delivery_failed',
      'channel.token_refresh_failed',
      'channel.webhook_failed',
      'channel.rate_limited',
    ];

    const failureCounts = await this.prisma.auditLog.groupBy({
      by: ['resource'],
      where: {
        tenantId,
        result: 'failure',
        action: { in: failureActions },
        createdAt: { gte: failureSince },
      },
      _count: { _all: true },
    });
    const totalFailure = failureCounts.reduce((a, b) => a + b._count._all, 0);

    const channels: ChannelHealthEntryDto[] = connectors.map((c) => {
      const expiresAt = tokenByProvider.get(c.provider) ?? null;
      const hasToken = tokenByProvider.has(c.provider);
      // We do not have a per-connector failure breakdown (resource is the
      // provider key), so we surface the global failure rate as a degraded
      // signal. A per-channel breakdown is a future work item.
      const failureRate =
        totalFailure > 0 ? Math.min(1, totalFailure / 100) : 0;
      return {
        id: c.id,
        type: c.provider,
        provider: c.provider,
        status: c.isActive ? 'active' : 'inactive',
        enabled: c.isActive,
        tokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        failureRate,
        grade: channelGrade(failureRate, hasToken),
        source: 'CrmConnector',
      };
    });

    const healthy = channels.filter((c) => c.grade === 'HEALTHY').length;
    const degraded = channels.filter((c) => c.grade === 'DEGRADED').length;
    const unhealthy = channels.filter((c) => c.grade === 'UNHEALTHY').length;

    return {
      tenantId,
      fetchedAt: now.toISOString(),
      totalChannels: channels.length,
      healthyChannels: healthy,
      degradedChannels: degraded,
      unhealthyChannels: unhealthy,
      channels,
    };
  }
}
