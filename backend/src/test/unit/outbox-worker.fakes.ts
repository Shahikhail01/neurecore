// src/test/unit/outbox-worker.fakes.ts
// Lightweight in-memory fakes for the OutboxWorker test suite. They implement
// only the IOutboxRepository surface exercised by the worker, so tests run
// without a database.
import {
  type IOutboxRepository,
  type OutboxBacklogSummary,
  type OutboxDeadLetterSummary,
  type OutboxEventInput,
  type OutboxEventRecord,
} from '../../common/outbox/outbox-repository.port';

export interface FakeRepoOptions {
  /** Pre-existing PROCESSING rows whose lease has expired. */
  staleRows?: number;
}

export function makeFakeRepo(options: FakeRepoOptions = {}) {
  const queue: OutboxEventRecord[] = [];
  const persisted = new Map<string, OutboxEventRecord>();
  const deadLetters = new Map<string, OutboxDeadLetterSummary>();
  let recoveredCount = 0;
  let lastRecoveredAt: Date | null = null;

  function record(event: OutboxEventRecord) {
    persisted.set(event.id, { ...event });
  }

  function pushStaleRows(count: number) {
    const staleNow = new Date(Date.now() - 60000);
    for (let i = 0; i < count; i++) {
      const id = `stale-${Math.random().toString(36).slice(2, 8)}`;
      const ev = {
        id,
        tenantId: 'tnt-acme',
        eventType: 'ProjectAutomationRequested',
        version: 1,
        actorId: null,
        actorType: 'SYSTEM',
        correlationId: 'corr-stale',
        causationId: null,
        idempotencyKey: `idem-stale-${id}`,
        sourceModule: 'project-automation',
        payload: { projectId: 'p-stale' },
        status: 'PROCESSING' as const,
        retryCount: 0,
        lastError: null,
        lastErrorClassification: null,
        createdAt: staleNow,
        dispatchedAt: null,
        processingStartedAt: staleNow,
        processedAt: null,
        processingWorkerId: 'other-worker',
        leaseExpiresAt: staleNow,
        nextAttemptAt: staleNow,
        processingCount: 1,
      };
      queue.push(ev);
      persisted.set(id, ev);
    }
  }

  if ((options.staleRows ?? 0) > 0) {
    pushStaleRows(options.staleRows ?? 0);
    queue.length = 0;
  }

  const repo: IOutboxRepository = {
    async publish(_input: OutboxEventInput) {
      return `event-${Math.random().toString(36).slice(2, 10)}`;
    },
    async claimAvailable(
      _workerId: string,
      leaseMs: number,
      maxCount: number,
    ): Promise<OutboxEventRecord[]> {
      const now = new Date();
      const claimed: OutboxEventRecord[] = [];
      for (let i = 0; i < queue.length && claimed.length < maxCount; i++) {
        const event = queue[i];
        if (event.status !== 'PENDING') continue;
        if (event.nextAttemptAt && event.nextAttemptAt > now) continue;
        const leaseExpiresAt = new Date(now.getTime() + leaseMs);
        const claimedRow: OutboxEventRecord = {
          ...event,
          status: 'PROCESSING',
          processingStartedAt: now,
          leaseExpiresAt,
          processingWorkerId: _workerId,
          processingCount: (event.processingCount ?? 0) + 1,
          nextAttemptAt: event.nextAttemptAt ?? now,
        };
        queue.splice(i, 1);
        i--;
        record(claimedRow);
        claimed.push(claimedRow);
      }
      return claimed;
    },
    async markProcessed(id: string, leaseToken: string) {
      const row = persisted.get(id);
      if (!row || row.processingWorkerId !== leaseToken) {
        throw new Error(`OUTBOX_PROCESS_STATE_MISMATCH:${id}`);
      }
      const processed: OutboxEventRecord = {
        ...row,
        status: 'PROCESSED',
        processedAt: new Date(),
        leaseExpiresAt: null,
      };
      record(processed);
    },
    async releaseForRetry(id, leaseToken, reason) {
      const row = persisted.get(id);
      if (!row || row.processingWorkerId !== leaseToken) return;
      record({
        ...row,
        status: 'PENDING',
        leaseExpiresAt: null,
        processingWorkerId: null,
        nextAttemptAt: new Date(),
        lastError: reason,
      });
    },
    async settleFailure(id, leaseToken, error, nextAttemptAt, retryCount, classification) {
      const row = persisted.get(id);
      if (!row || row.processingWorkerId !== leaseToken) {
        return false;
      }
      const newRetry = retryCount ?? (row.retryCount ?? 0) + 1;
      const isDead = newRetry >= 3;
      const updated: OutboxEventRecord = {
        ...row,
        status: isDead ? 'DEAD_LETTER' : 'PENDING',
        retryCount: newRetry,
        leaseExpiresAt: null,
        processingWorkerId: null,
        lastError: error,
        lastErrorClassification: classification,
        nextAttemptAt: isDead ? null : nextAttemptAt,
      };
      record(updated);
      if (isDead) {
        deadLetters.set(id, {
          id: `dl-${id}`,
          originalEventId: id,
          eventType: row.eventType,
          tenantId: row.tenantId,
          retryCount: newRetry,
          lastError: error,
          createdAt: row.createdAt,
          lastAttemptAt: new Date(),
          replayedAt: null,
          replayStatus: 'NONE',
        });
      } else {
        queue.push(updated);
      }
      return isDead;
    },
    async replayDeadLetter(originalEventId) {
      const row = persisted.get(originalEventId);
      if (!row) return false;
      const updated: OutboxEventRecord = {
        ...row,
        status: 'PENDING',
        retryCount: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      };
      record(updated);
      queue.push(updated);
      return true;
    },
    async recoverStale(now: Date): Promise<number> {
      const staleIds: string[] = [];
      for (const [id, row] of persisted.entries()) {
        if (
          row.status === 'PROCESSING' &&
          row.leaseExpiresAt &&
          row.leaseExpiresAt.getTime() < now.getTime()
        ) {
          staleIds.push(id);
        }
      }
      for (const id of staleIds) {
        const row = persisted.get(id)!;
        const next: OutboxEventRecord = {
          ...row,
          status: 'PENDING',
          processingWorkerId: null,
          leaseExpiresAt: null,
          lastError: 'lease expired',
        };
        record(next);
        queue.push(next);
        recoveredCount++;
        lastRecoveredAt = now;
      }
      queue.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return staleIds.length;
    },
    async releaseWorker(workerId) {
      let n = 0;
      for (const [id, row] of persisted.entries()) {
        if (row.status === 'PROCESSING' && row.processingWorkerId === workerId) {
          record({
            ...row,
            status: 'PENDING',
            processingWorkerId: null,
            leaseExpiresAt: null,
            lastError: 'worker shutdown',
          });
          n++;
        }
      }
      return n;
    },
    async getBacklogSummary(tenantId): Promise<OutboxBacklogSummary> {
      let pending = 0;
      let processing = 0;
      let processed = 0;
      let deadLetter = 0;
      for (const row of persisted.values()) {
        if (tenantId && row.tenantId !== tenantId) continue;
        if (row.status === 'PENDING') pending++;
        else if (row.status === 'PROCESSING') processing++;
        else if (row.status === 'PROCESSED') processed++;
        else if (row.status === 'DEAD_LETTER') deadLetter++;
      }
      return {
        pending,
        processing,
        processed,
        deadLetter,
        oldestPendingAt: null,
        oldestStuckAt: null,
      };
    },
    async listDeadLetters() {
      return Array.from(deadLetters.values());
    },
  };

  return {
    repo,
    queue,
    persisted,
    deadLetters,
    get recoveredCount() {
      return recoveredCount;
    },
    get lastRecoveredAt() {
      return lastRecoveredAt;
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
