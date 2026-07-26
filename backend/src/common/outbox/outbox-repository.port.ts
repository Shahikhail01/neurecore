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
}

export type OutboxStatus = 'PENDING' | 'DISPATCHED' | 'PROCESSING' | 'PROCESSED' | 'DEAD_LETTER';

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
  createdAt: Date;
  dispatchedAt: Date | null;
}

/**
 * Generic transaction client. Adapters convert the underlying client
 * (Prisma, etc.) to this. The application code never sees Prisma types.
 */
export type TransactionalClient = any;

export interface IOutboxRepository {
  publish(input: OutboxEventInput, tx?: TransactionalClient): Promise<string>;
  claimAvailable(workerId: string, leaseMs: number, maxCount: number): Promise<OutboxEventRecord[]>;
  markCompleted(id: string, leaseToken: string): Promise<void>;
  settleFailure(id: string, leaseToken: string, error: string): Promise<boolean>;
  recoverStale(now: Date): Promise<number>;
  getBacklogSize(): Promise<number>;
}
