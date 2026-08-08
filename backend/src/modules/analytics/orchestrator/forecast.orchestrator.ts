/**
 * Phase 26 — ForecastOrchestrator.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * SOLID — SRP: owns ONLY the composition of `IForecastSource`
 * results into a tenant-level `ForecastComposition`. It does NOT
 * own the weighted math (each source does) or the rendering
 * (callers do).
 *
 * DIP: depends on the registry seam
 * (`FORECAST_SOURCE_REGISTRY` token) and the snapshot repository
 * — no direct Prisma access for the orchestration logic.
 */

import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  FORECAST_SOURCE_REGISTRY,
  type ForecastAggregate,
  type ForecastSourceWindow,
} from '../interfaces/IForecastSource';
import { ForecastSourceRegistry } from './forecast-source.registry';

export interface ForecastComposition {
  readonly tenantId: string;
  readonly window: ForecastSourceWindow;
  readonly weightedTotal: number;
  readonly openCount: number;
  readonly sources: ReadonlyArray<ForecastAggregate>;
  readonly byStage: ReadonlyArray<{
    readonly stage: string;
    readonly count: number;
    readonly sumAmount: number;
    readonly sumWeightedAmount: number;
  }>;
  readonly intervalHalfWidth: number;
  readonly limitations: ReadonlyArray<string>;
}

export interface ForecastOrchestratorInput {
  readonly tenantId: string;
  readonly window: ForecastSourceWindow;
}

@Injectable()
export class ForecastOrchestrator {
  private readonly logger = new Logger(ForecastOrchestrator.name);

  constructor(
    @Inject(FORECAST_SOURCE_REGISTRY)
    private readonly registry: ForecastSourceRegistry,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Compose every registered source for the tenant + window. The
   * tenant-level weighted total is the sum across sources; the
   * `byStage` breakdown is merged across sources (later sources
   * override earlier ones when stages collide).
   *
   * Persists an immutable `DealPipelineSnapshot` row keyed by
   * `(tenantId, period)` so the backtest harness has a stable
   * history. The `period` is `YYYY-MM` derived from `window.from`.
   */
  async compose(input: ForecastOrchestratorInput): Promise<ForecastComposition> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new ForbiddenException(`tenantId "${input.tenantId}" forbidden`);
    }
    const sources = this.registry.ordered();
    const aggregates: ForecastAggregate[] = [];
    for (const s of sources) {
      try {
        aggregates.push(await s.load(input.tenantId, input.window));
      } catch (err) {
        // Source failures degrade gracefully — the orchestrator
        // records the limitation and continues.
        this.logger.warn(
          `forecast source ${s.sourceId} failed: ${(err as Error).message}`,
        );
        aggregates.push({
          sourceId: s.sourceId,
          tenantId: input.tenantId,
          window: input.window,
          weightedTotal: 0,
          openCount: 0,
          byStage: [],
          limitations: [`source_failed: ${(err as Error).message}`],
        });
      }
    }
    const composition = this.merge(input.tenantId, input.window, aggregates);
    await this.persistSnapshot(composition);
    return composition;
  }

  private merge(
    tenantId: string,
    window: ForecastSourceWindow,
    aggregates: ReadonlyArray<ForecastAggregate>,
  ): ForecastComposition {
    let weightedTotal = 0;
    let openCount = 0;
    const byStageMap = new Map<
      string,
      { count: number; sumAmount: number; sumWeightedAmount: number }
    >();
    const limitations: string[] = [];
    for (const a of aggregates) {
      weightedTotal += a.weightedTotal;
      openCount += a.openCount;
      for (const bs of a.byStage) {
        const bucket = byStageMap.get(bs.stage) ?? {
          count: 0,
          sumAmount: 0,
          sumWeightedAmount: 0,
        };
        bucket.count += bs.count;
        bucket.sumAmount += bs.sumAmount;
        bucket.sumWeightedAmount += bs.sumWeightedAmount;
        byStageMap.set(bs.stage, bucket);
      }
      for (const l of a.limitations) limitations.push(`[${a.sourceId}] ${l}`);
    }
    const mean = openCount > 0 ? weightedTotal / openCount : 0;
    const variance =
      openCount > 0
        ? [...byStageMap.values()].reduce((acc, b) => {
            const d = b.sumWeightedAmount - mean;
            return acc + d * d;
          }, 0) / Math.max(openCount, 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const intervalHalfWidth =
      openCount > 0 ? 1.96 * (stdDev / Math.sqrt(openCount)) : 0;
    return {
      tenantId,
      window,
      weightedTotal,
      openCount,
      sources: aggregates,
      byStage: [...byStageMap.entries()].map(([stage, b]) => ({
        stage,
        count: b.count,
        sumAmount: b.sumAmount,
        sumWeightedAmount: b.sumWeightedAmount,
      })),
      intervalHalfWidth,
      limitations,
    };
  }

  private async persistSnapshot(composition: ForecastComposition): Promise<void> {
    const period = periodKey(composition.window.from);
    try {
      await this.prisma.dealPipelineSnapshot.upsert({
        where: {
          tenantId_period: {
            tenantId: composition.tenantId,
            period,
          },
        },
        create: {
          tenantId: composition.tenantId,
          period,
          weightedTotal: composition.weightedTotal,
          openCount: composition.openCount,
          byStageJson: composition.byStage as unknown as object,
        },
        update: {
          weightedTotal: composition.weightedTotal,
          openCount: composition.openCount,
          byStageJson: composition.byStage as unknown as object,
        },
      });
    } catch (err) {
      this.logger.warn(
        `failed to persist forecast snapshot for ${composition.tenantId} ${period}: ${(err as Error).message}`,
      );
    }
  }
}

export function periodKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}
