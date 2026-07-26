// src/common/persistence/prisma-outbox.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IOutboxRepository,
  OutboxEventInput,
  OutboxEventRecord,
} from '../outbox/outbox-repository.port';

/**
 * Prisma adapter for IOutboxRepository.
 * ONLY place that imports Prisma for outbox operations.
 */
@Injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async publish(
    input: OutboxEventInput,
    tx?: any,
  ): Promise<string> {
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

  async claimAvailable(workerId: string, leaseMs: number, maxCount: number): Promise<OutboxEventRecord[]> {
    const claimed: OutboxEventRecord[] = [];

    for (let i = 0; i < maxCount; i++) {
      const event = await this.prisma.enterpriseEventOutbox.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });
      if (!event) break;

      const res = await this.prisma.enterpriseEventOutbox.updateMany({
        where: { id: event.id, status: 'PENDING' },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      });

      if (res.count === 1) {
        claimed.push({ ...event, status: 'DISPATCHED', dispatchedAt: new Date() } as OutboxEventRecord);
      }
    }
    return claimed;
  }

  async markCompleted(id: string, leaseToken: string): Promise<void> {
    await this.prisma.enterpriseEventOutbox.update({
      where: { id },
      data: { status: 'DISPATCHED' },
    });
  }

  async settleFailure(id: string, leaseToken: string, error: string): Promise<boolean> {
    const event = await this.prisma.enterpriseEventOutbox.findUnique({ where: { id } });
    if (!event) return false;

    const newRetry = event.retryCount + 1;
    const isDeadLetter = newRetry >= 3;

    if (isDeadLetter) {
      await this.prisma.enterpriseEventDeadLetter.create({
        data: {
          originalEventId: event.id,
          eventType: event.eventType,
          tenantId: event.tenantId,
          consumerId: 'outbox-worker',
          payload: event.payload as Prisma.InputJsonValue,
          retryCount: newRetry,
          lastError: error,
          replayStatus: 'NONE',
        },
      });
      await this.prisma.enterpriseEventOutbox.update({
        where: { id },
        data: { status: 'DEAD_LETTER', retryCount: newRetry, lastError: error },
      });
    } else {
      await this.prisma.enterpriseEventOutbox.update({
        where: { id },
        data: { status: 'PENDING', retryCount: newRetry, lastError: error },
      });
    }
    return isDeadLetter;
  }

  async recoverStale(now: Date): Promise<number> {
    const stale = await this.prisma.enterpriseEventInbox.findMany({
      where: { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
      take: 100,
    });
    let recovered = 0;
    for (const entry of stale) {
      const res = await this.prisma.enterpriseEventInbox.updateMany({
        where: { id: entry.id, status: 'PROCESSING' },
        data: {
          status: 'PENDING',
          leaseToken: null,
          leaseExpiresAt: null,
          retryCount: entry.retryCount + 1,
          lastError: 'lease expired',
        },
      });
      if (res.count === 1) recovered++;
    }
    return recovered;
  }

  async getBacklogSize(): Promise<number> {
    return this.prisma.enterpriseEventOutbox.count({ where: { status: 'PENDING' } });
  }
}
