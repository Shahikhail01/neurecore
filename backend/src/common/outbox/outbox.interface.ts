// src/common/outbox/outbox.interface.ts
import { Prisma } from '@prisma/client';

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
  availableAt?: Date;
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
  payload: Prisma.JsonValue;
  status: OutboxStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
}

export interface IOutboxService {
  publish(input: OutboxEventInput, tx?: Prisma.TransactionClient): Promise<string>;
  executeInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  claimAvailable(workerId: string, leaseMs: number, maxCount: number): Promise<OutboxEventRecord[]>;
  markDispatched(id: string): Promise<void>;
  markCompleted(id: string, leaseToken: string): Promise<void>;
  settleFailure(id: string, leaseToken: string, error: string): Promise<boolean>;
  recoverStale(now: Date): Promise<number>;
  getBacklogSize(): Promise<number>;
}
