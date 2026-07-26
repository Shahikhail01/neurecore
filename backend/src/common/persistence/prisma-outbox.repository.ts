// src/common/persistence/prisma-outbox.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IOutboxRepository,
  OutboxBacklogSummary,
  OutboxDeadLetterSummary,
  OutboxEventInput,
  OutboxEventRecord,
  TransactionalClient,
} from '../outbox/outbox-repository.port';

interface OutboxClient {
  enterpriseEventOutbox: PrismaClient['enterpriseEventOutbox'];
  enterpriseEventDeadLetter: PrismaClient['enterpriseEventDeadLetter'];
}

const TERMINAL_WORKER = 'outbox-worker';

@Injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: OutboxEventInput, tx?: TransactionalClient): Promise<string> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;

    const existing = await client.enterpriseEventOutbox.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing.id;

    try {
      const created = await client.enterpriseEventOutbox.create({
        data: {
          tenantId: input.tenantId,
          eventType: input.eventType,
          version: input.version ?? 1,
          actorId: input.actorId ?? null,
          actorType: input.actorType ?? 'SYSTEM',
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: input.idempotencyKey,
          sourceModule: input.sourceModule,
          payload: input.payload as Prisma.InputJsonValue,
          status: 'PENDING',
          nextAttemptAt: input.availableAt ?? new Date(),
          retryCount: 0,
          processingCount: 0,
        },
      });
      return created.id;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const dup = await client.enterpriseEventOutbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (dup) return dup.id;
      }
      throw e;
    }
  }

  async executeInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) => fn(tx));
  }

  async claimAvailable(
    workerId: string,
    leaseMs: number,
    maxCount: number,
  ): Promise<OutboxEventRecord[]> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const claimed: OutboxEventRecord[] = [];
    // Per-tick the worker walks the head-of-queue index and performs
    // single-row conditional updates. Worker isolation is enforced by the
    // `where: { status: 'PENDING' }` clause and the lex-or timestamp
    // comparison; only one worker can advance the same row.
    for (let i = 0; i < maxCount; i++) {
      const next = await this.prisma.enterpriseEventOutbox.findFirst({
        where: {
          status: 'PENDING',
          nextAttemptAt: { lte: now },
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!next) break;

      const res = await this.prisma.enterpriseEventOutbox.updateMany({
        where: {
          id: next.id,
          status: 'PENDING',
          OR: [{ nextAttemptAt: { lte: now } }, { nextAttemptAt: null }],
        },
        data: {
          status: 'PROCESSING',
          processingStartedAt: now,
          processingWorkerId: workerId,
          leaseExpiresAt,
          processingCount: { increment: 1 },
        },
      });
      if (res.count !== 1) continue;

      const persisted = await this.prisma.enterpriseEventOutbox.findUnique({
        where: { id: next.id },
      });
      if (persisted) claimed.push(this.toRecord(persisted));
    }

    return claimed;
  }

  async markProcessed(id: string, leaseToken: string): Promise<void> {
    const res = await this.prisma.enterpriseEventOutbox.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        processingWorkerId: leaseToken,
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        leaseExpiresAt: null,
        lastError: null,
      },
    });
    if (res.count !== 1) {
      // The row was reclaimed by another worker or already terminated.
      // Surface so the caller can decide whether to retry.
      throw new Error(`OUTBOX_PROCESS_STATE_MISMATCH:${id}`);
    }
  }

  async releaseForRetry(
    id: string,
    leaseToken: string,
    reason: string,
  ): Promise<void> {
    // Release without bumping retryCount — used when we want the next
    // attempt to happen sooner than a normal failure (e.g. transient infra).
    await this.prisma.enterpriseEventOutbox.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        processingWorkerId: leaseToken,
      },
      data: {
        status: 'PENDING',
        leaseExpiresAt: null,
        nextAttemptAt: new Date(),
        lastError: reason,
      },
    });
  }

  async settleFailure(
    id: string,
    leaseToken: string,
    error: string,
    nextAttemptAt: Date,
    retryCount: number,
    classification: string | null,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.enterpriseEventOutbox.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          processingWorkerId: leaseToken,
        },
        data: {
          retryCount: { increment: 1 },
          lastError: error,
          lastErrorClassification: classification,
          leaseExpiresAt: null,
          processingWorkerId: null,
        },
      });
      if (updatedCount.count !== 1) {
        return false;
      }

      const updated = await tx.enterpriseEventOutbox.findUnique({
        where: { id },
      });
      if (!updated) {
        return false;
      }

      const newRetry = retryCount;
      const isDeadLetter = newRetry >= 3;
      if (isDeadLetter) {
        await tx.enterpriseEventOutbox.update({
          where: { id },
          data: {
            status: 'DEAD_LETTER',
            nextAttemptAt: null,
          },
        });
        await tx.enterpriseEventDeadLetter.upsert({
          where: { originalEventId: id },
          update: {
            retryCount: newRetry,
            lastError: error,
            lastAttemptAt: new Date(),
            replayStatus: 'NONE',
          },
          create: {
            originalEventId: id,
            eventType: updated.eventType,
            tenantId: updated.tenantId,
            consumerId: TERMINAL_WORKER,
            payload: updated.payload as Prisma.InputJsonValue,
            retryCount: newRetry,
            lastError: error,
            replayStatus: 'NONE',
          },
        });
        return true;
      }

      await tx.enterpriseEventOutbox.update({
        where: { id },
        data: { status: 'PENDING', nextAttemptAt },
      });
      return false;
    });
  }

  async replayDeadLetter(
    originalEventId: string,
    leaseToken: string,
  ): Promise<boolean> {
    // Replay returns a DEAD_LETTER row back into PENDING with retryCount=0.
    // The replay completion is recorded against the dead-letter row.
    return this.prisma.$transaction(async (tx) => {
      const dl = await tx.enterpriseEventDeadLetter.findUnique({
        where: { originalEventId },
      });
      if (!dl) return false;
      const updatedCount = await tx.enterpriseEventOutbox.updateMany({
        where: {
          id: originalEventId,
          status: 'DEAD_LETTER',
        },
        data: {
          status: 'PENDING',
          retryCount: 0,
          nextAttemptAt: new Date(),
          lastError: null,
          lastErrorClassification: null,
          leaseExpiresAt: null,
          processingWorkerId: null,
          processingStartedAt: null,
          processedAt: null,
          dispatchedAt: null,
        },
      });
      if (updatedCount.count !== 1) return false;
      await tx.enterpriseEventDeadLetter.update({
        where: { originalEventId },
        data: {
          replayedAt: new Date(),
          replayStatus: 'REPLAYED',
        },
      });
      return true;
    });
  }

  async recoverStale(now: Date): Promise<number> {
    const stale = await this.prisma.enterpriseEventOutbox.findMany({
      where: {
        status: 'PROCESSING',
        leaseExpiresAt: { lt: now },
      },
      take: 100,
      select: { id: true, retryCount: true },
    });
    let recovered = 0;
    for (const row of stale) {
      const res = await this.prisma.enterpriseEventOutbox.updateMany({
        where: {
          id: row.id,
          status: 'PROCESSING',
          leaseExpiresAt: { lt: now },
        },
        data: {
          status: 'PENDING',
          processingWorkerId: null,
          leaseExpiresAt: null,
          lastError: 'lease expired',
          retryCount: row.retryCount + 1,
        },
      });
      if (res.count === 1) recovered++;
    }
    return recovered;
  }

  async releaseWorker(workerId: string): Promise<number> {
    const res = await this.prisma.enterpriseEventOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        processingWorkerId: workerId,
      },
      data: {
        status: 'PENDING',
        processingWorkerId: null,
        leaseExpiresAt: null,
        lastError: 'worker shutdown',
      },
    });
    return res.count;
  }

  async getBacklogSummary(
    tenantId?: string,
  ): Promise<OutboxBacklogSummary> {
    const where = tenantId ? { tenantId } : {};
    const grouped = await this.prisma.enterpriseEventOutbox.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of grouped) counts[row.status] = row._count._all;

    const oldestPending = await this.prisma.enterpriseEventOutbox.findFirst({
      where: { ...where, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const oldestStuck = await this.prisma.enterpriseEventOutbox.findFirst({
      where: { ...where, status: 'PROCESSING' },
      orderBy: { processingStartedAt: 'asc' },
      select: { processingStartedAt: true },
    });

    return {
      pending: counts['PENDING'] ?? 0,
      processing: counts['PROCESSING'] ?? 0,
      processed: counts['PROCESSED'] ?? 0,
      deadLetter: counts['DEAD_LETTER'] ?? 0,
      oldestPendingAt: oldestPending?.createdAt ?? null,
      oldestStuckAt: oldestStuck?.processingStartedAt ?? null,
    };
  }

  async listDeadLetters(
    tenantId?: string,
    limit = 50,
  ): Promise<OutboxDeadLetterSummary[]> {
    const rows = await this.prisma.enterpriseEventDeadLetter.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        replayStatus: { in: ['NONE', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      originalEventId: row.originalEventId,
      eventType: row.eventType,
      tenantId: row.tenantId,
      retryCount: row.retryCount,
      lastError: row.lastError,
      createdAt: row.createdAt,
      lastAttemptAt: row.lastAttemptAt,
      replayedAt: row.replayedAt,
      replayStatus: row.replayStatus,
    }));
  }

  private toRecord(row: any): OutboxEventRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      eventType: row.eventType,
      version: row.version,
      actorId: row.actorId,
      actorType: row.actorType,
      correlationId: row.correlationId,
      causationId: row.causationId,
      idempotencyKey: row.idempotencyKey,
      sourceModule: row.sourceModule,
      payload: row.payload,
      status: row.status,
      retryCount: row.retryCount,
      lastError: row.lastError,
      lastErrorClassification: row.lastErrorClassification ?? null,
      createdAt: row.createdAt,
      dispatchedAt: row.dispatchedAt,
      processingStartedAt: row.processingStartedAt ?? null,
      processedAt: row.processedAt ?? null,
      processingWorkerId: row.processingWorkerId ?? null,
      leaseExpiresAt: row.leaseExpiresAt ?? null,
      nextAttemptAt: row.nextAttemptAt ?? null,
      processingCount: row.processingCount ?? 0,
    };
  }
}
