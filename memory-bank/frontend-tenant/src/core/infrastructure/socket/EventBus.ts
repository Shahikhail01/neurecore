// ─── EventBus.ts ─────────────────────────────────────────────────────────────
// SRP: Type-safe pub/sub bus decoupling producers from consumers.
// OCP: New events are added without modifying existing subscribers.

type EventMap = Record<string, unknown>;
type Listener<T> = (payload: T) => void;

export class EventBus<Events extends EventMap = EventMap> {
  private listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, handler: Listener<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Listener<unknown>);
    // Return an unsubscribe fn
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(handler as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  once<K extends keyof Events>(event: K, handler: Listener<Events[K]>): void {
    const wrapped: Listener<Events[K]> = (p) => {
      handler(p);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }

  clear(): void {
    this.listeners.clear();
  }
}

// ─── HeadQuarter Socket Events ────────────────────────────────────────────────
export interface HQSocketEvents {
  [key: string]: unknown;
  'socket:connected': void;
  'socket:disconnected': void;
  'agent:status': { agentId: string; status: string };
  'task:update': { taskId: string; status: string };
  'workflow:event': { workflowId: string; event: string };
  'activity:new': { type: string; payload: unknown };
  'notification:new': { id: string; title: string; message: string; type: string };
  'approval:requested': { approvalId: string; title: string };
}

export const hqEventBus = new EventBus<HQSocketEvents>();
