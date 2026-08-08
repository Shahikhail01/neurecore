/**
 * Phase 30 — Prisma usage reporter (CR-AI-1305).
 *
 * Aggregates persisted `CostRecord` rows into the integer usage
 * snapshot the ceiling rules consume. Cost is stored as
 * `Decimal(10,4)` cents, so it is rounded to whole cents exactly
 * once — here — and every downstream comparison is integer-safe.
 *
 * SOLID
 *   SRP — owns ONLY usage aggregation.
 *   LSP — implements `IUsageReporter`; an in-memory reporter
 *         substitutes it in the G30 gate.
 *   DIP — the request-rate signal comes from the injected
 *         `RequestRateWindow`, not from a second database query.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CostUsageSnapshot } from '../interfaces/ICeilingRule';
import type { IUsageReporter } from '../interfaces/IUsageReporter';
import { CostCeilingScopeError } from '../cost-ceiling.errors';
import { RequestRateWindow } from './request-rate.window';

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class PrismaUsageReporter implements IUsageReporter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateWindow: RequestRateWindow,
  ) {}

  async snapshot(tenantId: string): Promise<CostUsageSnapshot> {
    if (!tenantId || tenantId === '*') {
      throw new CostCeilingScopeError('usage snapshot');
    }
    const now = new Date();
    const [month, day] = await Promise.all([
      this.prisma.costRecord.aggregate({
        where: { tenantId, createdAt: { gte: startOfUtcMonth(now) } },
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.costRecord.aggregate({
        where: { tenantId, createdAt: { gte: startOfUtcDay(now) } },
        _sum: { costCents: true },
      }),
    ]);

    return {
      tenantId,
      monthToDateCents: Math.round(Number(month._sum.costCents ?? 0)),
      dayToDateCents: Math.round(Number(day._sum.costCents ?? 0)),
      monthToDateTokens:
        Number(month._sum.inputTokens ?? 0) +
        Number(month._sum.outputTokens ?? 0),
      requestsLastMinute: this.rateWindow.count(tenantId),
      observedAt: now.toISOString(),
    };
  }
}
