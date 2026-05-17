// ─── ISocketManager.ts ───────────────────────────────────────────────────────
// SRP: Owns the entire WebSocket lifecycle.
// DIP: Features depend on this interface, not socket.io directly.

export type SocketEventHandler<T = unknown> = (payload: T) => void;

export interface ISocketManager {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  on<T>(event: string, handler: SocketEventHandler<T>): void;
  off<T>(event: string, handler: SocketEventHandler<T>): void;
  emit(event: string, payload?: unknown): void;
}
