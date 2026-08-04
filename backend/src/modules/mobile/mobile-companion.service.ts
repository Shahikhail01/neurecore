/**
 * Mobile Companion — Backend API.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.16.6, §5.16.7.
 *
 * Solid:
 *   • SRP — only mobile device registration, push token storage, and
 *     a thin send path. Push delivery is delegated to the
 *     ChannelsModule (Phase 5.1).
 *   • OCP — adding a new mobile channel (e.g. APNs) = new adapter
 *     registered via ChannelsRegistry.
 *
 * Per v3 P-1 rule §11: every tenant-scoped method refuses wildcard
 * tenant id with ForbiddenException.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface RegisterDeviceInput {
  tenantId: string;
  userId: string;
  // 'ios' | 'android' | 'web' — kept as a free-form string so new
  // platforms can land without a schema migration.
  platform: string;
  pushToken: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

@Injectable()
export class MobileCompanionService {
  private readonly logger = new Logger(MobileCompanionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Reuse the channel_connections table — Mobile is a ChannelKind.MCP
  // adapter today (machine-only) and ChannelKind.WEBHOOK for inbound.
  // Phase 5.4 introduces a dedicated Mobile companion table only if the
  // push-channel needs first-class status tracking; until then, this
  // service is a thin registry on top of ChannelConnection.
  async registerDevice(input: RegisterDeviceInput) {
    if (!input.tenantId || input.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (!input.userId) {
      throw new ForbiddenException('userId required');
    }
    if (!input.pushToken) {
      throw new ForbiddenException('pushToken required');
    }
    // We store the device registration as a ChannelConnection of
    // kind=MCP with a well-known displayName per user.
    const displayName = `mobile:${input.userId}:${input.platform}`;
    return this.prisma.channelConnection.create({
      data: {
        tenantId: input.tenantId,
        kind: 'MCP',
        displayName,
        status: 'ACTIVE',
        config: {
          pushToken: input.pushToken,
          platform: input.platform,
          deviceModel: input.deviceModel,
          osVersion: input.osVersion,
          appVersion: input.appVersion,
          userId: input.userId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async listDevices(tenantId: string, userId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.channelConnection.findMany({
      where: {
        tenantId,
        kind: 'MCP',
        displayName: { startsWith: `mobile:${userId}:` },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deregisterDevice(tenantId: string, id: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const conn = await this.prisma.channelConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException(`device ${id} not found`);
    if (conn.tenantId !== tenantId) {
      throw new ForbiddenException('device belongs to a different tenant');
    }
    await this.prisma.channelConnection.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }
}
