/**
 * Channels — Repository.
 */

import { Injectable } from '@nestjs/common';
import { ChannelConnectionStatus, ChannelKind, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class ChannelRepository {
  constructor(private readonly prisma: PrismaService) {}

  listConnections(tenantId: string) {
    return this.prisma.channelConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findConnection(tenantId: string, id: string) {
    return this.prisma.channelConnection.findUnique({ where: { id } });
  }

  findConnectionByKind(tenantId: string, kind: ChannelKind, displayName: string) {
    return this.prisma.channelConnection.findUnique({
      where: {
        tenantId_kind_displayName: { tenantId, kind, displayName },
      },
    });
  }

  createConnection(input: {
    tenantId: string;
    kind: ChannelKind;
    displayName: string;
    secretRef?: string;
    config?: Prisma.InputJsonValue;
  }) {
    return this.prisma.channelConnection.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        displayName: input.displayName,
        secretRef: input.secretRef,
        config: input.config ?? {},
      },
    });
  }

  updateConnectionStatus(
    id: string,
    status: ChannelConnectionStatus,
    lastError?: string,
  ) {
    return this.prisma.channelConnection.update({
      where: { id },
      data: {
        status,
        lastError,
        lastCheckedAt: new Date(),
      },
    });
  }

  appendEvent(input: {
    tenantId: string;
    kind: ChannelKind;
    connectionId: string | null;
    direction: 'inbound' | 'outbound';
    payload: Prisma.InputJsonValue;
    status?: string;
    errorMessage?: string;
  }) {
    return this.prisma.channelEvent.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        connectionId: input.connectionId,
        direction: input.direction,
        payload: input.payload,
        status: input.status ?? 'RECEIVED',
        errorMessage: input.errorMessage,
        processedAt: input.status === 'PROCESSED' ? new Date() : null,
      },
    });
  }

  listEvents(args: {
    tenantId: string;
    kind?: ChannelKind;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    return this.prisma.channelEvent.findMany({
      where: {
        tenantId: args.tenantId,
        ...(args.kind ? { kind: args.kind } : {}),
        ...(args.status ? { status: args.status } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      skip: args.skip,
      take: args.take ?? 50,
    });
  }
}
