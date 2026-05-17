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
    this.url = baseUrl ?? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000');
  }

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.url, {
      auth: { token: this.tokenManager.getAccessToken() },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => hqEventBus.emit('socket:connected', undefined as void));
    this.socket.on('disconnect', () => hqEventBus.emit('socket:disconnected', undefined as void));

    // Bridge known server events → EventBus
    this.socket.on('agent:status', (p) => hqEventBus.emit('agent:status', p));
    this.socket.on('task:update', (p) => hqEventBus.emit('task:update', p));
    this.socket.on('workflow:event', (p) => hqEventBus.emit('workflow:event', p));
    this.socket.on('activity:new', (p) => hqEventBus.emit('activity:new', p));
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
