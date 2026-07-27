// src/modules/timeline/timeline.gateway.ts
//
// Phase 7 (§9.3) — TimelineGateway.
//
// Proxies per-entity timeline events over the existing Socket.IO transport
// (see EventsGateway). Clients subscribe to a specific entity scope
// (e.g. `project:abc-123`) and receive `timeline:event` payloads in
// near real-time. When the socket is unavailable, the client MUST use
// the polling fallback exposed at GET /timeline/:entityType/:entityId?since=...
//
// The gateway deliberately does NOT replicate tenant or auth logic: it
// reuses the existing socket handshake that already establishes the
// `tenantId` and `userId` on the AuthedSocket. Per-room inclusion is
// enforced inside the gateway by validating that the requested entity
// actually belongs to the socket's tenant before joining the room.
//
// This is therefore not a new authoritative mutation surface — it is
// a read-side fanout for the existing TimelineEvent store.

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

interface AuthedSocketData {
  userId?: string;
  tenantId?: string | null;
}

type AuthedSocket = Socket & AuthedSocketData;

const ENTITY_TYPES = [
  'Initiation',
  'Project',
  'Goal',
  'Task',
  'ExecutionAttempt',
  'Review',
] as const;
type SupportedEntityType = (typeof ENTITY_TYPES)[number];

function isSupportedEntityType(value: string): value is SupportedEntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

@WebSocketGateway()
export class TimelineGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TimelineGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Subscribe to a per-entity timeline. Verifies tenant ownership of the
   * target entity before joining the room so cross-tenant room enumeration
   * is impossible (Phase 7 §9.4 + §10.1).
   */
  @SubscribeMessage('timeline:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { entityType?: string; entityId?: string },
  ): Promise<{ joined: boolean; room?: string; reason?: string }> {
    if (!client.userId || !client.tenantId) {
      return { joined: false, reason: 'UNAUTHENTICATED' };
    }
    const entityType = body?.entityType;
    const entityId = body?.entityId;
    if (!entityType || !entityId) {
      return { joined: false, reason: 'MISSING_PARAMETERS' };
    }
    if (!isSupportedEntityType(entityType)) {
      return { joined: false, reason: 'UNSUPPORTED_ENTITY_TYPE' };
    }

    const owner = await this.ownerLookup(entityType, entityId, client.tenantId);
    if (!owner) {
      // Return a generic not-found to avoid leaking entity existence.
      return { joined: false, reason: 'NOT_FOUND' };
    }

    const room = `timeline:${entityType}:${entityId}`;
    await client.join(room);
    return { joined: true, room };
  }

  @SubscribeMessage('timeline:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { entityType?: string; entityId?: string },
  ): Promise<{ left: boolean; room?: string }> {
    if (!body?.entityType || !body?.entityId) {
      return { left: false };
    }
    const room = `timeline:${body.entityType}:${body.entityId}`;
    await client.leave(room);
    return { left: true, room };
  }

  /**
   * Fan-out helper used by services / workers after persisting a
   * TimelineEvent. Emits a `timeline:event` payload to the room scoped
   * by entityType + entityId.
   */
  emitTimelineEvent(params: {
    tenantId: string;
    entityType: SupportedEntityType;
    entityId: string;
    event: {
      id: string;
      eventType: string;
      occurredAt: Date;
      actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
      actorId: string;
      actorName: string;
      title: string;
      description: string;
      severity: string;
      correlationId?: string | null;
      metadata?: Record<string, unknown>;
    };
  }): void {
    const room = `timeline:${params.entityType}:${params.entityId}`;
    this.server.to(room).emit('timeline:event', {
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      event: {
        ...params.event,
        occurredAt:
          params.event.occurredAt instanceof Date
            ? params.event.occurredAt.toISOString()
            : new Date(params.event.occurredAt).toISOString(),
      },
    });
  }

  private async ownerLookup(
    entityType: SupportedEntityType,
    entityId: string,
    tenantId: string,
  ): Promise<boolean> {
    switch (entityType) {
      case 'Initiation':
        return Boolean(
          await this.prisma.enterpriseInitiation.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Project':
        return Boolean(
          await this.prisma.project.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Goal':
        return Boolean(
          await this.prisma.goal.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Task':
        return Boolean(
          await this.prisma.task.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'ExecutionAttempt':
        return Boolean(
          await this.prisma.executionAttempt.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Review':
        return Boolean(
          await this.prisma.review.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }
}
