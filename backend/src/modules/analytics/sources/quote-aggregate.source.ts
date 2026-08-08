/**
 * Phase 26 — QuoteAggregateSource.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * Back-compat forecast source backed by the existing `Quote`
 * model. Counts ACCEPTED + SENT quotes within the window as a
 * separate aggregate; the orchestrator surfaces both side-by-side
 * so operators can see why the deal-weighted forecast differs
 * from the quote-driven total.
 *
 * SOLID — SRP: owns ONLY the Quote→ForecastAggregate translation.
 * DIP: depends on injected `PrismaService` only.
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  type ForecastAggregate,
  type ForecastSourceWindow,
  type IForecastSource,
} from '../interfaces/IForecastSource';

interface QuoteRowForForecast {
  readonly status: string;
  readonly total: Prisma.Decimal;
  readonly createdAt: Date;
}

@Injectable()
export class QuoteAggregateSource implements IForecastSource {
  readonly sourceId = 'quote-aggregate';
  readonly priority = 20;
  private readonly logger = new Logger(QuoteAggregateSource.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(tenantId: string, window: ForecastSourceWindow): Promise<ForecastAggregate> {
    this.assertTenant(tenantId);
    const rows = await this.prisma.quote.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: window.from,
          lt: window.to,
        },
      },
      select: { status: true, total: true, createdAt: true },
      take: 5000,
    });
    return this.aggregate(tenantId, window, rows);
  }

  private aggregate(
    tenantId: string,
    window: ForecastSourceWindow,
    rows: ReadonlyArray<QuoteRowForForecast>,
  ): ForecastAggregate {
    const buckets = new Map<string, { count: number; sumAmount: number; sumWeightedAmount: number }>();
    let weightedTotal = 0;
    let openCount = 0;
    for (const r of rows) {
      const amt = Number(r.total);
      // Per-status weight: ACCEPTED = 1.0, SENT = 0.5, others = 0.0
      // (DRAFT / REJECTED / EXPIRED do not contribute to forecast).
      const weight =
        r.status === 'ACCEPTED' ? 1.0 : r.status === 'SENT' ? 0.5 : 0.0;
      if (weight === 0) continue;
      const stageKey = `QUOTE_${r.status}`;
      const bucket = buckets.get(stageKey) ?? { count: 0, sumAmount: 0, sumWeightedAmount: 0 };
      bucket.count += 1;
      bucket.sumAmount += amt;
      bucket.sumWeightedAmount += amt * weight;
      buckets.set(stageKey, bucket);
      weightedTotal += amt * weight;
      openCount += 1;
    }
    return {
      sourceId: this.sourceId,
      tenantId,
      window,
      weightedTotal,
      openCount,
      byStage: [...buckets.entries()].map(([stage, b]) => ({
        stage,
        count: b.count,
        sumAmount: b.sumAmount,
        sumWeightedAmount: b.sumWeightedAmount,
      })),
      limitations: [
        rows.length === 0 ? 'no quotes in window' : `quotes=${rows.length}`,
      ],
    };
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(`tenantId "${tenantId}" forbidden`);
    }
  }
}
