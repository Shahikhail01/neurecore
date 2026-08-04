import { io, Socket } from 'socket.io-client';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import { hqEventBus } from '@/core/infrastructure/socket/EventBus';

const SOCKET_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (window.location.protocol === 'https:') return `wss://${window.location.host}`;
  return `ws://${window.location.host}`;
})();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: tokenManager.getAccessToken() },
      withCredentials: true,
      // Polling-only transport: the OpenLiteSpeed → Next.js → NestJS path
      // can't reliably proxy the WebSocket upgrade (HTTP/2 downgrade + missing
      // Connection: Upgrade on the response), which causes noisy
      // 'Connection header value must contain Upgrade' errors in the browser
      // console. Socket.IO's long-polling transport still gives us real-time
      // push at sub-second latency without needing a true WS tunnel. See
      // memory-bank/runbook.md §3.2 and FIX-022.
      transports: ['polling'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: false,
    });

    // ── Bridge all backend events → EventBus ────────────────────────────────
    socket.on('connect', () => hqEventBus.emit('socket:connected', undefined as void));
    socket.on('disconnect', () => hqEventBus.emit('socket:disconnected', undefined as void));

    // Agent events
    socket.on('agent:status_updated', ({ agentId, status }: { agentId: string; status: string }) =>
      hqEventBus.emit('agent:status', { agentId, status }));

    socket.on('agent:error', ({ agentId, error }: { agentId: string; error: string }) =>
      hqEventBus.emit('notification:new', {
        id: `ae-${Date.now()}`,
        title: 'Agent Error',
        message: `${agentId}: ${error}`,
        type: 'error',
      }));

    // Task events — normalised to a unified task:update
    socket.on('task:started', ({ taskId }: { taskId: string }) =>
      hqEventBus.emit('task:update', { taskId, status: 'RUNNING' }));

    socket.on('task:completed', ({ taskId, success }: { taskId: string; success: boolean }) =>
      hqEventBus.emit('task:update', { taskId, status: success ? 'COMPLETED' : 'FAILED' }));

    socket.on('task:failed', ({ taskId }: { taskId: string }) =>
      hqEventBus.emit('task:update', { taskId, status: 'FAILED' }));

    // Workflow events — backend status → EventBus event string
    socket.on('workflow:status_changed', ({
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

    socket.on('workflow:event', (payload: {
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

    socket.on('workflow:progress', (payload: {
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

    // System alerts → notification store
    socket.on('system:alert', ({ level, message }: { level: string; message: string }) =>
      hqEventBus.emit('notification:new', {
        id: `sa-${Date.now()}`,
        title: 'System Alert',
        message,
        type: level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
      }));

    // Governance — requires-approval case → approval store
    socket.on('governance:triggered', ({
      agentId,
      requiresApproval,
      triggeredRules,
    }: { agentId: string; requiresApproval: boolean; triggeredRules: string[] }) => {
      if (requiresApproval) {
        hqEventBus.emit('approval:requested', {
          approvalId: agentId,
          title: `Approval required — rules: ${triggeredRules.join(', ')}`,
        });
      }
    });

    // Pass-through events (if backend emits them directly)
    socket.on('notification:new', (p) => hqEventBus.emit('notification:new', p));
    socket.on('approval:requested', (p) => hqEventBus.emit('approval:requested', p));

    // ── Enterprise Communication Platform thread events (2026-07-11) ─────────
    socket.on('thread:message', (p: { threadId: string; message: unknown }) =>
      hqEventBus.emit('thread:message', p));

    socket.on('thread:created', (p: { thread: unknown }) =>
      hqEventBus.emit('thread:created', p));

    socket.on('thread:participant_added', (p: { threadId: string; participant: unknown }) =>
      hqEventBus.emit('thread:participant_added', p));

    socket.on('thread:mention', (p: { threadId: string; messageId: string; mentionedBy: unknown; preview: string }) =>
      hqEventBus.emit('thread:mention', p));

    socket.on('thread:closed', (p: { threadId: string }) =>
      hqEventBus.emit('thread:closed', p));

    socket.on('thread:activity', (p: { threadId: string; activity: unknown }) =>
      hqEventBus.emit('thread:activity', p));

    socket.on('presence:updated', (p: { type: string; id: string; status: string; tenantId: string }) =>
      hqEventBus.emit('presence:updated', p));

    socket.on('activity:new', (p: unknown) =>
      hqEventBus.emit('activity:new', { type: 'activity:new', payload: p }));

    socket.on('activity:direct', (p: unknown) =>
      hqEventBus.emit('activity:direct', p));

    socket.on('dependency:updated', (p: { changedEntity: unknown; dependents: unknown[]; event: string; timestamp: string }) =>
      hqEventBus.emit('dependency:updated', p));
  }
  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Subscribe to a thread room to receive per-thread WS broadcasts. */
export function joinThread(threadId: string): void {
  getSocket().emit('thread:join', { threadId });
}

/** Unsubscribe from a thread room. */
export function leaveThread(threadId: string): void {
  getSocket().emit('thread:leave', { threadId });
}
