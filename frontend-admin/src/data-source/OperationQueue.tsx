/**
 * Operation Queue & Batch Processing
 * Queue and batch operations with deduplication and error handling
 * Pattern adapted from NocoBase's request batching and error deduplication
 */

"use client";

import { useCallback, useRef, useState } from "react";

export interface QueuedOperation<T = any, R = any> {
  id: string;
  operation: (...args: any[]) => Promise<R>;
  args: any[];
  status: "pending" | "processing" | "success" | "error";
  result?: R;
  error?: Error;
  retries: number;
  createdAt: number;
  processedAt?: number;
}

export interface OperationQueueConfig {
  maxQueueSize?: number;
  batchSize?: number;
  batchDelayMs?: number;
  maxRetries?: number;
  deduplicateMs?: number; // Time window for deduplication
  autoProcessing?: boolean; // Auto-process when batch full or delay expires
}

export interface OperationQueueStats {
  pending: number;
  processing: number;
  successful: number;
  failed: number;
  totalProcessed: number;
  successRate: number;
}

/**
 * Operation queue with batching, deduplication, and retry logic
 */
export class OperationQueue {
  private queue: Map<string, QueuedOperation> = new Map();
  private deduplicationMap: Map<string, { at: number; id: string }> = new Map();
  private processing: Set<string> = new Set();
  private config: Required<OperationQueueConfig>;
  private batchTimer?: NodeJS.Timeout;
  private stats = {
    successful: 0,
    failed: 0,
    totalProcessed: 0,
  };

  constructor(config: OperationQueueConfig = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      batchSize: config.batchSize || 10,
      batchDelayMs: config.batchDelayMs || 300,
      maxRetries: config.maxRetries || 3,
      deduplicateMs: config.deduplicateMs || 500,
      autoProcessing: config.autoProcessing !== false,
    };
  }

  /**
   * Add operation to queue
   */
  enqueue<R = any>(
    operation: (...args: any[]) => Promise<R>,
    args: any[] = [],
    options?: { deduplicationKey?: string },
  ): string {
    // Check deduplication
    if (options?.deduplicationKey) {
      const dedup = this.deduplicationMap.get(options.deduplicationKey);
      if (dedup && Date.now() - dedup.at < this.config.deduplicateMs) {
        // Return existing operation ID
        return dedup.id;
      }
      this.deduplicationMap.set(options.deduplicationKey, {
        at: Date.now(),
        id: this.generateId(),
      });
    }

    const id = this.generateId();

    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error("Operation queue is full");
    }

    const queued: QueuedOperation<any, R> = {
      id,
      operation,
      args,
      status: "pending",
      retries: 0,
      createdAt: Date.now(),
    };

    this.queue.set(id, queued);

    // Schedule processing if auto-processing enabled
    if (this.config.autoProcessing) {
      this.scheduleProcessing();
    }

    return id;
  }

  /**
   * Process queued operations
   */
  async process(count?: number): Promise<Map<string, QueuedOperation>> {
    const toProcess = count || this.config.batchSize;
    const processed: Map<string, QueuedOperation> = new Map();

    let processed_count = 0;

    for (const [id, op] of this.queue.entries()) {
      if (this.processing.has(id) || op.status !== "pending") {
        continue;
      }

      if (processed_count >= toProcess) {
        break;
      }

      this.processing.add(id);

      try {
        op.status = "processing";
        const result = await op.operation(...op.args);
        op.status = "success";
        op.result = result;
        op.processedAt = Date.now();
        this.stats.successful++;
        processed.set(id, op);
      } catch (error) {
        op.error = error instanceof Error ? error : new Error(String(error));

        if (op.retries < this.config.maxRetries) {
          // Retry
          op.retries++;
          op.status = "pending";
        } else {
          // Failed after max retries
          op.status = "error";
          this.stats.failed++;
          processed.set(id, op);
        }
      } finally {
        this.processing.delete(id);
      }

      processed_count++;
      this.stats.totalProcessed++;
    }

    return processed;
  }

  /**
   * Process all pending operations
   */
  async processAll(): Promise<Map<string, QueuedOperation>> {
    const results: Map<string, QueuedOperation> = new Map();

    while (this.hasPending()) {
      const batch = await this.process();
      batch.forEach((op, id) => results.set(id, op));
    }

    return results;
  }

  /**
   * Get operation by ID
   */
  get<T = any>(id: string): QueuedOperation<any, T> | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all operations
   */
  getAll(): QueuedOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get pending operations
   */
  getPending(): QueuedOperation[] {
    return Array.from(this.queue.values()).filter(
      (op) => op.status === "pending",
    );
  }

  /**
   * Check if queue has pending operations
   */
  hasPending(): boolean {
    return this.queue.size > 0;
  }

  /**
   * Cancel operation
   */
  cancel(id: string): boolean {
    const op = this.queue.get(id);
    if (!op || op.status === "processing") {
      return false;
    }

    this.queue.delete(id);
    return true;
  }

  /**
   * Cancel all pending operations
   */
  cancelAll(): number {
    const pending = this.getPending();
    pending.forEach((op) => this.queue.delete(op.id));
    return pending.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): OperationQueueStats {
    const pending = this.getPending().length;
    const processing = this.processing.size;
    const total = this.stats.totalProcessed;

    return {
      pending,
      processing,
      successful: this.stats.successful,
      failed: this.stats.failed,
      totalProcessed: total,
      successRate: total > 0 ? this.stats.successful / total : 0,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.clear();
    this.processing.clear();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
  }

  /**
   * Destroy queue
   */
  destroy(): void {
    this.clear();
  }

  /**
   * Schedule processing based on batch delay
   */
  private scheduleProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.process();
    }, this.config.batchDelayMs);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global operation queue instance
let globalQueue: OperationQueue;

/**
 * Get or create global operation queue
 */
export function getOperationQueue(
  config?: OperationQueueConfig,
): OperationQueue {
  if (!globalQueue) {
    globalQueue = new OperationQueue(config);
  }
  return globalQueue;
}

/**
 * React hook for operation queueing
 */
export function useOperationQueue(config?: OperationQueueConfig) {
  const queue = getOperationQueue(config);

  const enqueue = useCallback(
    <R = any>(
      operation: (...args: any[]) => Promise<R>,
      args?: any[],
      options?: { deduplicationKey?: string },
    ): string => {
      return queue.enqueue(operation, args || [], options);
    },
    [queue],
  );

  const process = useCallback(
    async (count?: number) => {
      return queue.process(count);
    },
    [queue],
  );

  const processAll = useCallback(async () => {
    return queue.processAll();
  }, [queue]);

  const get = useCallback(
    <T = any>(id: string) => {
      return queue.get<T>(id);
    },
    [queue],
  );

  const cancel = useCallback(
    (id: string) => {
      return queue.cancel(id);
    },
    [queue],
  );

  const cancelAll = useCallback(() => {
    return queue.cancelAll();
  }, [queue]);

  const getStats = useCallback(() => {
    return queue.getStats();
  }, [queue]);

  return {
    enqueue,
    process,
    processAll,
    get,
    cancel,
    cancelAll,
    getStats,
    queue,
  };
}

export default OperationQueue;
