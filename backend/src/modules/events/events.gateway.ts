import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { SecretProviderService } from '../security/providers/secret.provider';

// Single Responsibility: manage real-time Socket.IO connections with JWT auth + tenant namespacing.
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly jwtSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly secrets: SecretProviderService,
    private readonly redis: RedisService,
  ) {
    // Get JWT_SECRET from SecretProviderService (throws if missing)
    this.jwtSecret = this.secrets.getJwtSecret();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwt.verify<{
        sub: string;
        tenantId?: string | null;
        jti: string;
      }>(token, { secret: this.jwtSecret });

      // Check blacklist
      if (await this.redis.isTokenBlacklisted(payload.jti)) {
        client.disconnect(true);
        return;
      }

      // Attach user data to socket
      (client as any).userId = payload.sub;
      (client as any).tenantId = payload.tenantId;

      // Join user and tenant rooms
      await client.join(`user:${payload.sub}`);
      if (payload.tenantId) {
        await client.join(`tenant:${payload.tenantId}`);
      }

      // Track socket IDs per user
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.debug(`Client connected: ${client.id} user=${payload.sub}`);
    } catch {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId: string | undefined = (client as any).userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  // Emit to all sockets of a specific user
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit to all sockets in a tenant room
  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  // ── Phase 2 typed helpers ──────────────────────────────────

  emitAgentStatusUpdated(
    tenantId: string,
    agentId: string,
    status: string,
  ): void {
    this.emitToTenant(tenantId, 'agent:status_updated', {
      agentId,
      status,
      timestamp: Date.now(),
    });
  }

  emitTaskStarted(tenantId: string, taskId: string, agentId: string): void {
    this.emitToTenant(tenantId, 'task:started', {
      taskId,
      agentId,
      timestamp: Date.now(),
    });
  }

  emitTaskCompleted(
    tenantId: string,
    taskId: string,
    agentId: string,
    success: boolean,
    error?: string,
  ): void {
    this.emitToTenant(tenantId, success ? 'task:completed' : 'task:failed', {
      taskId,
      agentId,
      success,
      error,
      timestamp: Date.now(),
    });
  }

  emitMemoryUpdated(tenantId: string, agentId: string, entryId: string): void {
    this.emitToTenant(tenantId, 'memory:updated', {
      agentId,
      entryId,
      timestamp: Date.now(),
    });
  }

  emitSystemAlert(
    tenantId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ): void {
    this.emitToTenant(tenantId, 'system:alert', {
      level,
      message,
      timestamp: Date.now(),
    });
  }

  /** Emitted when an agent execution encounters an unrecoverable error */
  emitAgentError(
    tenantId: string,
    agentId: string,
    taskId: string | undefined,
    error: string,
  ): void {
    this.emitToTenant(tenantId, 'agent:error', {
      agentId,
      taskId,
      error,
      timestamp: Date.now(),
    });
  }

  /** Emitted when a workflow transitions to a new status */
  emitWorkflowStatusChanged(
    tenantId: string,
    workflowId: string,
    status: string,
  ): void {
    this.emitToTenant(tenantId, 'workflow:status_changed', {
      workflowId,
      status,
      timestamp: Date.now(),
    });
  }

  /** Emitted when a governance rule blocks or requires approval for a task */
  emitGovernanceTriggered(
    tenantId: string,
    agentId: string,
    decision: {
      allowed: boolean;
      triggeredRules: string[];
      requiresApproval: boolean;
    },
  ): void {
    this.emitToTenant(tenantId, 'governance:triggered', {
      agentId,
      ...decision,
      timestamp: Date.now(),
    });
  }
}
