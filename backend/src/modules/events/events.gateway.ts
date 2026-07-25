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
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CookieAuthService,
  ACCESS_TOKEN_COOKIE,
} from '../../common/auth/cookie-auth.service';

const SOCKET_ALLOWED_ORIGINS = [
  process.env.TENANT_FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'https://hq.neurecore.com',
  'https://cc.neurecore.com',
].filter((v): v is string => Boolean(v));

function socketOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / no-origin (server-to-server, curl)
  return SOCKET_ALLOWED_ORIGINS.includes(origin);
}

/**
 * EventsGateway — Phase 9 update (Auth Hardening).
 *
 * Token extraction priority for Socket.IO handshakes:
 *   1. `__Host-nc_at` cookie (browser sends it automatically when
 *      `withCredentials: true` is set on the client AND the server has
 *      `credentials: true` in the CORS config).
 *   2. `handshake.auth.token` (CLI / server-to-server / legacy clients).
 *   3. `Authorization: Bearer` header in handshake.
 *
 * Per `EAOS-implementation-roadmap.md` §13 task 9.6.
 *
 * Phase 10 cleanup (task 10.11): the `userId` / `tenantId` attached to the
 * socket at handshake time are now typed via a module-local SocketData
 * interface instead of `(client as any).userId` casts.
 */

interface AuthedSocketData {
  userId?: string;
  tenantId?: string | null;
}

type AuthedSocket = Socket & AuthedSocketData;
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (socketOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`), false);
    },
    credentials: true,
  },
  namespace: '/',
  // The default pingInterval (25s) is shorter than the 30s pingTimeout in
  // OLS-fronted paths, which causes engine.io's polling POST to occasionally
  // race the socket close and respond 400. We set engine.io options to give
  // the polling transport a much longer heartbeat and tolerate the
  // transparent OLS proxy without flaky handshake resets.
  pingInterval: 60_000,
  pingTimeout: 90_000,
  maxHttpBufferSize: 1_048_576,
  // allowEIO3 keeps backward compatibility with the legacy polling
  // transport that the broker-proxy paths still emit.
  allowEIO3: true,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly cookieAuth: CookieAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractSocketToken(client);

      if (!token) {
        // Phase 22 (2026-07-25): throw an auth error so the handshake
        // returns 401 instead of 400 on subsequent POST polls. The
        // browser-side socket client treats this as a reconnection
        // trigger; we deliberately do NOT call disconnect(true) which
        // would leave the OLS frontend forwarding POSTs that the
        // engine.io layer would then reject with 400 for the same sid.
        throw new Error('Authentication required');
      }

      const payload = this.jwt.verify<{
        sub: string;
        tenantId?: string | null;
        jti: string;
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });

      // Check blacklist
      if (await this.redis.isTokenBlacklisted(payload.jti)) {
        throw new Error('Token revoked');
      }

      // Attach user data to socket
      const authed = client as AuthedSocket;
      authed.userId = payload.sub;
      authed.tenantId = payload.tenantId;

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
    } catch (err) {
      this.logger.warn(
        `Rejected unauthenticated connection: ${client.id} reason=${(err as Error).message}`,
      );
      // Reject the handshake so engine.io emits a clean 'connect_error' to
      // the client instead of leaving a half-open session that returns
      // 400 on later POST polls.
      client.emit('unauthorized', { reason: (err as Error).message });
      client.disconnect(true);
    }
  }

  /**
   * Extract JWT from the Socket.IO handshake. Cookie-first (Phase 9),
   * then explicit auth/header fallbacks.
   */
  private extractSocketToken(client: Socket): string | null {
    // 1. Cookie (Phase 9: httpOnly path — browser sends automatically when
    //    `withCredentials: true` is set on the client).
    if (this.cookieAuth.isEnabled()) {
      const cookieHeader = client.handshake.headers?.cookie;
      if (cookieHeader) {
        for (const piece of cookieHeader.split(';')) {
          const eq = piece.indexOf('=');
          if (eq < 0) continue;
          const name = piece.slice(0, eq).trim();
          if (name === ACCESS_TOKEN_COOKIE) {
            const value = piece.slice(eq + 1).trim();
            if (value) return decodeURIComponent(value);
          }
        }
      }
    }

    // 2. Explicit handshake.auth.token (server-to-server, CLI, older clients).
    const explicit = client.handshake.auth?.token;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;

    // 3. Authorization: Bearer header (some clients send it).
    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string') {
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    return null;
  }

  handleDisconnect(client: Socket): void {
    const authed = client as AuthedSocket;
    const userId = authed.userId;
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

  /**
   * Phase 1: let clients subscribe to a thread room to receive
   * `thread:message`, `thread:activity`, `thread:participant_added`,
   * `thread:mention` events for that thread.
   *
   * Auth: the socket was authenticated at handshake time.
   * Tenant isolation + participant verification enforced here.
   *
   * 2026-07-11 (security hardening): Before joining the thread room,
   * verify (a) the thread belongs to the socket's tenant, and
   * (b) the requesting user is a registered thread participant.
   * Previously any authenticated user could join any thread room.
   */
  @SubscribeMessage('thread:join')
  async handleThreadJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { threadId?: string },
  ): Promise<{ joined: boolean; room?: string }> {
    const authed = client as AuthedSocket;
    if (!authed.userId || !authed.tenantId) return { joined: false };

    const threadId = typeof body?.threadId === 'string' ? body.threadId : null;
    if (!threadId) return { joined: false };

    const thread = await this.prisma.communicationThread.findFirst({
      where: { id: threadId, tenantId: authed.tenantId },
    });
    if (!thread) return { joined: false };

    const isParticipant = await this.prisma.threadParticipant.findUnique({
      where: {
        threadId_participantType_participantId: {
          threadId,
          participantType: 'USER',
          participantId: authed.userId,
        },
      },
    });
    if (!isParticipant) return { joined: false };

    const room = `thread:${threadId}`;
    await client.join(room);
    return { joined: true, room };
  }

  /**
   * Phase 1: remove client from a thread room.
   *
   * 2026-07-11 (security hardening): Verify tenant ownership before
   * allowing leave. Participant check is less strict than join since
   * the user may have been removed as a participant but still holds
   * an active socket, and client.leave() of an unjoined room is a
   * safe no-op. We enforce tenant match to prevent cross-tenant
   * room enumeration (a malicious client cycling through threadIds
   * to confirm which rooms they were previously in on another tenant).
   */
  @SubscribeMessage('thread:leave')
  async handleThreadLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { threadId?: string },
  ): Promise<{ left: boolean; room?: string }> {
    const authed = client as AuthedSocket;
    if (!authed.userId || !authed.tenantId) return { left: false };

    const threadId = typeof body?.threadId === 'string' ? body.threadId : null;
    if (!threadId) return { left: false };

    const thread = await this.prisma.communicationThread.findFirst({
      where: { id: threadId, tenantId: authed.tenantId },
    });
    if (!thread) return { left: false };

    const room = `thread:${threadId}`;
    await client.leave(room);
    return { left: true, room };
  }

  // Emit to all sockets of a specific user
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit to all sockets in a tenant room
  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  // Emit to an arbitrary room (e.g. thread:<id>)
  emitToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
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

  /**
   * Emitted when a workflow (WorkRun) transitions to a new status.
   * @param tenantId - Tenant scope
   * @param workflowId - Human-readable workflow identifier
   * @param status - New status string (CREATED, STARTED, COMPLETED, FAILED, etc.)
   * @param metadata - Optional runId/stepId for work-run level events
   */
  emitWorkflowStatusChanged(
    tenantId: string,
    workflowId: string,
    status: string,
    metadata?: { runId?: string; stepId?: string; agentId?: string },
  ): void {
    this.emitToTenant(tenantId, 'workflow:status_changed', {
      workflowId,
      status,
      ...(metadata?.runId ? { runId: metadata.runId } : {}),
      ...(metadata?.stepId ? { stepId: metadata.stepId } : {}),
      ...(metadata?.agentId ? { agentId: metadata.agentId } : {}),
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
