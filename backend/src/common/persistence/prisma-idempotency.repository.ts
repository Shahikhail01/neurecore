// src/common/persistence/prisma-idempotency.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { randomUUID } from 'crypto';
import {
  IIdempotencyRepository,
  IdempotencyCheckInput,
  IdempotencyCheckResult,
  IdempotencyCompleteInput,
} from '../idempotency/idempotency-repository.port';

/**
 * Prisma adapter for IIdempotencyRepository.
 *
 * Per NC-AWL-IMP-1 §3.3 (corrected):
 *   - Business idempotency key (COMPLETED records) MUST NOT expire.
 *   - Transient IN_FLIGHT locks may use expiresAt for stale cleanup.
 *   - Cached responseBody is tied to durable record; eviction is
 *     retention-policy controlled, not automatic.
 *
 * Schema requirement: `idempotency_records.expiresAt` must be NULL-able.
 * If the schema is not NULL-able, this implementation will fail
 * validation during migration.
 */
@Injectable()
export class PrismaIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async checkAndReserve(input: IdempotencyCheckInput): Promise<IdempotencyCheckResult> {
    const key = `${input.scope}:${input.idempotencyKey}`;

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_key: { tenantId: input.tenantId, key },
      },
    });

    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        // Hash mismatch on durable business idempotency key.
        // Per NC-AWL-IMP-1 §3.3: reject reuse with different payload.
        throw new Error('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD');
      }
      if (existing.status === 'COMPLETED') {
        return { existing, reserved: false, replayed: true };
      }
      return { existing, reserved: false, replayed: false };
    }

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          key,
          requestPath: input.scope,
          requestHash: input.requestHash,
          status: 'IN_FLIGHT',
          // No expiresAt: durable business idempotency
          // (for transient coordination, a separate lock record is used)
          expiresAt: null as any,
          attemptCount: 1,
        },
      });
      return { existing: null, reserved: true, replayed: false };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const racer = await this.prisma.idempotencyRecord.findUnique({
          where: {
            tenantId_key: { tenantId: input.tenantId, key },
          },
        });
        if (racer) {
          if (racer.status === 'COMPLETED') {
            return { existing: racer, reserved: false, replayed: true };
          }
          if (racer.requestHash !== input.requestHash) {
            throw new Error('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD');
          }
          return { existing: racer, reserved: false, replayed: false };
        }
      }
      throw e;
    }
  }

  async complete(input: IdempotencyCompleteInput): Promise<void> {
    const key = `${input.scope}:${input.idempotencyKey}`;

    await this.prisma.idempotencyRecord.update({
      where: {
        tenantId_key: { tenantId: input.tenantId, key },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        responseStatus: input.responseStatus ?? 200,
        responseBody: input.resultData as any,
        resultEntityType: input.resultEntityType,
        resultEntityId: input.resultEntityId ?? input.resultId,
        lastUsedAt: new Date(),
        // No expiresAt on durable record
        expiresAt: null as any,
      },
    });
  }

  async fail(
    tenantId: string,
    scope: string,
    idempotencyKey: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    const key = `${scope}:${idempotencyKey}`;

    await this.prisma.idempotencyRecord.update({
      where: {
        tenantId_key: { tenantId, key },
      },
      data: {
        status: 'FAILED',
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        attemptCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async purgeOldFailedRecords(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: {
        status: 'FAILED',
        completedAt: { lt: cutoff },
      },
    });
    return result.count;
  }
}
