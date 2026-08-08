/**
 * Phase 26 — DealPipelineSource.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * Weighted forecast source backed by the `Deal` model. Computes
 *   weightedTotal = Σ (amount × probability)
 * per stage, ignoring LOST deals. Tenant-scoped.
 *
 * SOLID — SRP: owns ONLY the Deal→ForecastAggregate translation.
 * DIP: depends on injected `PrismaService` only.
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { DealStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  type ForecastAggregate,
  type ForecastSourceWindow,
  type IForecastSource,
} from '../interfaces/IForecastSource';

interface DealRowForForecast {
  readonly stage: DealStage;
  readonly amount: Prisma.Decimal;
  readonly probability: Prisma.Decimal;
  readonly expectedCloseDate: Date | null;
}

@Injectable()
export class DealPipelineSource implements IForecastSource {
  readonly sourceId = 'deal-pipeline';
  readonly priority = 10;
  private readonly logger = new Logger(DealPipelineSource.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(tenantId: string, window: ForecastSourceWindow): Promise<ForecastAggregate> {
    this.assertTenant(tenantId);
    const rows = await this.prisma.deal.findMany({
      where: {
        tenantId,
        deletedAt: null,
        stage: { not: 'LOST' },
        expectedCloseDate: {
          gte: window.from,
          lt: window.to,
        },
      },
      select: { stage: true, amount: true, probability: true, expectedCloseDate: true },
    });
    return this.aggregate(tenantId, window, rows);
  }

  private aggregate(
    tenantId: string,
    window: ForecastSourceWindow,
    rows: ReadonlyArray<DealRowForForecast>,
  ): ForecastAggregate {
    const buckets = new Map<
      string,
      { count: number; sumAmount: number; sumWeightedAmount: number }
    >();
    let weightedTotal = 0;
    let openCount = 0;
    for (const r of rows) {
      // LOST is excluded entirely. WON contributes 0 to the
      // weighted forecast but is still counted in the by-stage
      // breakdown as committed.
      if (r.stage === 'LOST') continue;
      const amt = Number(r.amount);
      const pr = Number(r.probability);
      const stageKey = String(r.stage);
      const bucket = buckets.get(stageKey) ?? { count: 0, sumAmount: 0, sumWeightedAmount: 0 };
      bucket.count += 1;
      bucket.sumAmount += amt;
      bucket.sumWeightedAmount += amt * pr;
      buckets.set(stageKey, bucket);
      // WON deals are committed revenue, not forecast — they
      // contribute 0 to the weighted total.
      if (r.stage === 'WON') {
        continue;
      }
      weightedTotal += amt * pr;
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
        rows.length === 0 ? 'no open deals in window' : `deals=${rows.length}`,
      ],
    };
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(`tenantId "${tenantId}" forbidden`);
    }
  }
}
