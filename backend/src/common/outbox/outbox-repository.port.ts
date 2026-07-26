// src/common/outbox/outbox-repository.port.ts
import { OUTBOX_REPOSITORY } from '../ports/di-tokens';

export { OUTBOX_REPOSITORY };

export interface OutboxEventInput {
  tenantId: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  actorId?: string;
  actorType?: string;
  version?: number;
  /**
   * Optional earliest time the worker should attempt this event.
   * Defaults to "now" via DB default when omitted.
   */
  availableAt?: Date;
}

export type OutboxStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'DEAD_LETTER';

export interface OutboxEventRecord {
  id: string;
  tenantId: string;
  eventType: string;
  version: number;
  actorId: string | null;
  actorType: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  sourceModule: string;
  payload: unknown;
  status: OutboxStatus;
  retryCount: number;
  lastError: string | null;
  lastErrorClassification: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
  processingStartedAt: Date | null;
  processedAt: Date | null;
  processingWorkerId: string | null;
  leaseExpiresAt: Date | null;
  nextAttemptAt: Date | null;
  processingCount: number;
}

/**
 * Generic transaction client. Adapters convert the underlying client
 * (Prisma, etc.) to this. The application code never sees Prisma types.
 */
export type TransactionalClient = any;

export interface OutboxRetryPolicy {
  /** Maximum number of attempts before an event is moved to dead-letter. */
  maxAttempts: number;
  /** Base backoff in milliseconds used to compute exponential delay. */
  baseBackoffMs: number;
  /** Cap backoff to this maximum to avoid pathological delays. */
  maxBackoffMs: number;
  /** Maximum jitter fraction added on top of the computed backoff. */
  jitterFraction: number;
}

export const DEFAULT_OUTBOX_RETRY_POLICY: OutboxRetryPolicy = {
  maxAttempts: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 30000,
  jitterFraction: 0.2,
};

export const OUTBOX_PUBLIC_STATUSES: OutboxStatus[] = [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'DEAD_LETTER',
];

export interface OutboxBacklogSummary {
  pending: number;
  processing: number;
  processed: number;
  deadLetter: number;
  oldestPendingAt: Date | null;
  oldestStuckAt: Date | null;
}

export interface OutboxDeadLetterSummary {
  id: string;
  originalEventId: string;
  eventType: string;
  tenantId: string;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  lastAttemptAt: Date;
  replayedAt: Date | null;
  replayStatus: string;
}

export interface IOutboxRepository {
  /**
   * Atomic create-or-get under (tenantId, idempotencyKey).
   * Returns the persisted event id. Caller must rely on the response id
   * as the durable correlation identifier, not as proof of state mutation.
   */
  publish(input: OutboxEventInput, tx?: TransactionalClient): Promise<string>;

  /**
   * Atomically claim the next batch of PENDING events whose nextAttemptAt
   * has elapsed. The implementation must guarantee no two workers claim the
   * same row even under concurrent ticks.
   */
  claimAvailable(
    workerId: string,
    leaseMs: number,
    maxCount: number,
  ): Promise<OutboxEventRecord[]>;

  /** Mark an event as successfully processed. */
  markProcessed(id: string, leaseToken: string): Promise<void>;

  /** Release a claim so the row can be retried elsewhere. Does NOT advance retryCount. */
  releaseForRetry(id: string, leaseToken: string, reason: string): Promise<void>;

  /**
   * Atomic increment of retryCount + classify next attempt. Returns true when
   * the event was promoted to dead-letter.
   */
  settleFailure(
    id: string,
    leaseToken: string,
    error: string,
    nextAttemptAt: Date,
    classification: string | null,
  ): Promise<boolean>;

  /** Promote a dead-letter row back to PENDING for controlled replay. */
  replayDeadLetter(originalEventId: string, leaseToken: string): Promise<boolean>;

  /**
   * Recover stale PROCESSING rows whose lease has expired, returning them
   * to PENDING. Returns the count of rows recovered.
   */
  recoverStale(now: Date): Promise<number>;

  /** Drop in-flight claim(s) that were claimed by a specific worker (used on shutdown). */
  releaseWorker(workerId: string): Promise<number>;

  /** Read-only backlog snapshot for operators / health endpoints. */
  getBacklogSummary(tenantId?: string): Promise<OutboxBacklogSummary>;

  /** Read-only dead-letter list for operators / health endpoints. */
  listDeadLetters(tenantId?: string, limit?: number): Promise<OutboxDeadLetterSummary[]>;
}
