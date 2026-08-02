/**
 * Forecast backtest harness — Phase 5 P5
 *
 * Replays a history of `(pipeline snapshot, closed outcome)` pairs
 * through `ForecastProvider.score()` and reports:
 *   - meanAbsoluteError (MAE)
 *   - meanSquaredError (MSE)
 *   - bias (mean signed error)
 *   - coverage (fraction of outcomes inside the 95% interval)
 *   - hit rate (fraction of periods the directional change is correct)
 *
 * Used by:
 *   - ModelLifecycleService at stages `calibration`, `shadow`, and
 *     `gated-production`;
 *   - `tests/forecast.backtest.spec.ts` for unit confidence;
 *   - the dashboard to plot historical backtest deltas.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ForecastProvider } from './forecast.provider';

export interface BacktestOutcome {
  readonly period: string;
  readonly expected: number;
  readonly actual: number;
  readonly lower: number;
  readonly upper: number;
}

export interface BacktestReport {
  readonly samples: number;
  readonly mae: number;
  readonly mse: number;
  readonly bias: number;
  readonly coverage: number;
  readonly hitRate: number;
  readonly perPeriod: readonly BacktestOutcome[];
  readonly limitations: readonly string[];
}

@Injectable()
export class ForecastBacktest {
  private readonly logger = new Logger(ForecastBacktest.name);

  constructor(private readonly provider: ForecastProvider) {}

  async run(
    tenantId: string,
    cases: ReadonlyArray<{
      period: string;
      features: Record<string, number>;
      actual: number;
    }>,
  ): Promise<BacktestReport> {
    if (cases.length === 0) {
      return {
        samples: 0,
        mae: Number.NaN,
        mse: Number.NaN,
        bias: Number.NaN,
        coverage: Number.NaN,
        hitRate: Number.NaN,
        perPeriod: [],
        limitations: ['no backtest cases supplied'],
      };
    }
    const outcomes: BacktestOutcome[] = [];
    let sumAbs = 0;
    let sumSq = 0;
    let bias = 0;
    let hits = 0;
    let covered = 0;
    let prevActual: number | null = null;
    let prevForecast: number | null = null;

    for (const c of cases) {
      const result = await this.provider.score({
        tenantId,
        modelId: 'backtest',
        modelVersion: 'backtest',
        subject: { type: 'forecast', id: c.period },
        features: c.features,
      });
      const expected = Number.isFinite(result.score) ? result.score : 0;
      const halfWidth =
        Number(String(result.label ?? '').replace(/^interval=±/, '')) || 0;
      const lower = expected - halfWidth;
      const upper = expected + halfWidth;
      outcomes.push({
        period: c.period,
        expected,
        actual: c.actual,
        lower,
        upper,
      });
      const err = expected - c.actual;
      sumAbs += Math.abs(err);
      sumSq += err * err;
      bias += err;
      if (c.actual >= lower && c.actual <= upper) covered++;
      if (prevActual !== null && prevForecast !== null) {
        const dirActual = c.actual - prevActual;
        const dirForecast = expected - prevForecast;
        if (Math.sign(dirActual) === Math.sign(dirForecast)) hits++;
      }
      prevActual = c.actual;
      prevForecast = expected;
    }
    const n = cases.length;
    return {
      samples: n,
      mae: round(sumAbs / n, 4),
      mse: round(sumSq / n, 4),
      bias: round(bias / n, 4),
      coverage: round(covered / n, 4),
      hitRate: round(hits / Math.max(n - 1, 1), 4),
      perPeriod: outcomes,
      limitations: [
        'simple interval coverage at 95% confidence',
        'hit rate measured as aligned directional change between consecutive periods',
      ],
    };
  }
}

function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
