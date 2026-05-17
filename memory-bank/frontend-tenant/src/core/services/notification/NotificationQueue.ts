// ─── NotificationQueue.ts ────────────────────────────────────────────────────
// SRP: Manages notification rate-limiting, deduplication, and sequencing.
// Keeps the NotificationService free from queue-management concerns.

import type { NotificationPayload } from '@/core/services/interfaces/INotificationService';

interface QueueEntry {
  payload: NotificationPayload;
  addedAt: number;
}

export interface INotificationQueue {
  enqueue(payload: NotificationPayload): boolean;
  dequeue(): NotificationPayload | undefined;
  peek(): NotificationPayload | undefined;
  size(): number;
  clear(): void;
}

export class NotificationQueue implements INotificationQueue {
  private queue: QueueEntry[] = [];
  private recentIds = new Set<string>();

  constructor(
    private readonly maxSize = 50,
    /** Deduplication window in ms; same id within this window is dropped */
    private readonly dedupWindowMs = 5_000,
  ) {}

  /** Returns false if the payload was deduplicated or the queue is full. */
  enqueue(payload: NotificationPayload): boolean {
    // Deduplication: skip if we've seen this id recently
    if (this.recentIds.has(payload.id)) return false;
    if (this.queue.length >= this.maxSize) return false;

    this.queue.push({ payload, addedAt: Date.now() });
    this.recentIds.add(payload.id);

    // Clean up dedup set after window expires
    setTimeout(() => this.recentIds.delete(payload.id), this.dedupWindowMs);
    return true;
  }

  dequeue(): NotificationPayload | undefined {
    return this.queue.shift()?.payload;
  }

  peek(): NotificationPayload | undefined {
    return this.queue[0]?.payload;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.recentIds.clear();
  }
}
