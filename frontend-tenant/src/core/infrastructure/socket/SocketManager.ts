// ─── SocketManager.ts ────────────────────────────────────────────────────────
// SRP: Owns the entire Socket.IO connection lifecycle.
// DIP: Features receive ISocketManager — they never import socket.io directly.
// OCP: Bridge to EventBus means new event types need zero changes here.

import { io, Socket } from 'socket.io-client';
import type { ISocketManager, SocketEventHandler } from '@/core/services/api/interfaces/ISocketManager';
import { hqEventBus } from './EventBus';
import type { ITokenManager } from '@/core/services/api/interfaces/ITokenManager';

export class SocketManager implements ISocketManager {
  private socket: Socket | null = null;
  private readonly url: string;

  constructor(
    private readonly tokenManager: ITokenManager,
    baseUrl?: string,
  ) {
    this.url = baseUrl ?? this.deriveSocketUrl();
  }

  /**
   * Derive the Socket.IO server URL.
   * Priority:
   *   1. Explicit NEXT_PUBLIC_SOCKET_URL env var (for split deployments)
   *   2. Same-origin (window.location) — uses OLS proxy rule
   *      which forwards /socket.io/* to the NestJS backend
   */
  private deriveSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (explicit && explicit.length > 0) return explicit;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.url, {
      auth: { token: this.tokenManager.getAccessToken() },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      // Polling-only: OLS → NestJS proxy can't reliably relay the WebSocket
      // upgrade (HTTP/2 downgrade + missing Connection: Upgrade header),
      // which causes 400s on /socket.io/. Long-polling gives real-time push
      // at sub-second latency without needing a true WS tunnel. See
      // memory-bank/runbook.md §3.2 and FIX-022.
      transports: ['polling'],
      upgrade: false,
    });

    this.socket.on('connect', () => hqEventBus.emit('socket:connected', undefined as void));
    this.socket.on('disconnect', () => hqEventBus.emit('socket:disconnected', undefined as void));

    // Bridge backend event names → EventBus (matches events.gateway.ts emit names)
    this.socket.on('agent:status_updated', ({ agentId, status }: { agentId: string; status: string }) =>
      hqEventBus.emit('agent:status', { agentId, status }));

    this.socket.on('agent:error', ({ agentId, error }: { agentId: string; error: string }) =>
      hqEventBus.emit('notification:new', { id: `ae-${Date.now()}`, title: 'Agent Error', message: `${agentId}: ${error}`, type: 'error' }));

    this.socket.on('task:started', ({ taskId }: { taskId: string }) =>
      hqEventBus.emit('task:update', { taskId, status: 'RUNNING' }));
    this.socket.on('task:completed', ({ taskId, success }: { taskId: string; success: boolean }) =>
      hqEventBus.emit('task:update', { taskId, status: success ? 'COMPLETED' : 'FAILED' }));
    this.socket.on('task:failed', ({ taskId }: { taskId: string }) =>
      hqEventBus.emit('task:update', { taskId, status: 'FAILED' }));

    this.socket.on('workflow:status_changed', ({
      workflowId,
      status,
      workflowName,
      stageLabel,
      executionId,
      timestamp,
    }: {
      workflowId: string;
      status: string;
      workflowName?: string;
      stageLabel?: string;
      executionId?: string;
      timestamp?: number;
    }) => {
      const statusToEvent: Record<string, string> = {
        ACTIVE: 'started', ARCHIVED: 'completed', ERROR: 'failed', PAUSED: 'paused',
      };
      hqEventBus.emit('workflow:event', {
        workflowId,
        event: statusToEvent[status] ?? status.toLowerCase(),
        status,
        workflowName,
        stageLabel,
        executionId,
        timestamp,
      });
    });

    this.socket.on('workflow:event', (payload: {
      workflowId: string;
      event: string;
      status?: string;
      workflowName?: string;
      stageLabel?: string;
      executionId?: string;
      progressPercent?: number;
      detail?: string;
      timestamp?: number;
    }) => {
      hqEventBus.emit('workflow:event', payload);
    });

    this.socket.on('workflow:progress', (payload: {
      workflowId: string;
      workflowName?: string;
      status?: string;
      stageLabel?: string;
      executionId?: string;
      progressPercent?: number;
      detail?: string;
      timestamp?: number;
    }) => {
      hqEventBus.emit('workflow:event', {
        workflowId: payload.workflowId,
        workflowName: payload.workflowName,
        status: payload.status,
        stageLabel: payload.stageLabel,
        executionId: payload.executionId,
        progressPercent: payload.progressPercent,
        detail: payload.detail,
        timestamp: payload.timestamp,
        event: 'progress',
      });
    });

    this.socket.on('system:alert', ({ level, message }: { level: string; message: string }) =>
      hqEventBus.emit('notification:new', { id: `sa-${Date.now()}`, title: 'System Alert', message, type: level === 'error' ? 'error' : 'warning' }));

    this.socket.on('governance:triggered', ({ agentId, requiresApproval, triggeredRules }: { agentId: string; requiresApproval: boolean; triggeredRules: string[] }) => {
      if (requiresApproval) {
        hqEventBus.emit('approval:requested', { approvalId: agentId, title: `Approval required — rules: ${triggeredRules.join(', ')}` });
      }
    });

    this.socket.on('notification:new', (p) => hqEventBus.emit('notification:new', p));
    this.socket.on('approval:requested', (p) => hqEventBus.emit('approval:requested', p));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  on<T>(event: string, handler: SocketEventHandler<T>): void {
    this.socket?.on(event, handler as (...args: unknown[]) => void);
  }

  off<T>(event: string, handler: SocketEventHandler<T>): void {
    this.socket?.off(event, handler as (...args: unknown[]) => void);
  }

  emit(event: string, payload?: unknown): void {
    this.socket?.emit(event, payload);
  }
}
