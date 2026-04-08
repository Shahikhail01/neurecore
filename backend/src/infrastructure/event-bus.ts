/**
 * In-Memory Event Bus Implementation
 * Loosely couples services without creating them explicitly
 * Location: src/infrastructure/event-bus.ts
 */

import { Injectable } from '@nestjs/common';
import { IEventBus } from '../domain/interfaces';

@Injectable()
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<
    string,
    Set<(payload: unknown) => Promise<void>>
  >();

  async emit(event: string, payload: unknown): Promise<void> {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    for (const handler of eventHandlers) {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  unsubscribe(event: string): void {
    this.handlers.delete(event);
  }
}
