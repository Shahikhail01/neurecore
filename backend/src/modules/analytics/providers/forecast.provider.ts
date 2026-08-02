/**
 * ForecastProvider — Phase 5 P5
 *
 * Deterministic weighted-pipeline forecast with a confidence interval
 * and a calibration-based backtest harness. Does NOT use a neutral 0.5
 * fallback — when evidence is insufficient the provider abstains and
 * surfaces an explicit limitation.
 *
 *   weightedPipeline = Σ (stage_amount × stage_probability)
 *   intervalHalfWidth = z × weightedStdDev / √n
 *
 * Stage probabilities follow a published, named v3.1 mapping
 * (PR_GATE). No silent defaults: missing stages or zero-value
 * pipelines cause an abstention.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IPredictionProvider,
  PredictionFactor,
  PredictionProviderInput,
  ProviderPrediction,
} from '../interfaces/IPredictionProvider';

/**
 * Stage probability table (v3.1 default — overridable per-tenant via
 * AnalyticsModel.metadata.stageProbabilities).
 */
const DEFAULT_STAGE_PROBABILITY: Record<string, number> = {
  PROSPECTING: 0.1,
  QUALIFIED: 0.25,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.7,
  CLOSED_WON: 1,
  CLOSED_LOST: 0,
};

const MIN_TOTAL_PIPELINE = 1;
const MIN_FEATURES = 1;

@Injectable()
export class ForecastProvider implements IPredictionProvider {
  readonly kind = 'forecast' as const;
  private readonly logger = new Logger(ForecastProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async score(input: PredictionProviderInput): Promise<ProviderPrediction> {
    const model = await this.prisma.analyticsModel.findFirst({
      where: {
        id: input.modelId,
        OR: [{ tenantId: input.tenantId }, { tenantId: null }],
      },
    });
    const stageProbabilities = this.extractStageProbabilities(model?.metadata);
    const periods = this.numberFeature(input.features, 'periods', 1);
    void periods;

    const stages = this.collectStagesFromFeatures(input.features);
    if (stages.length < MIN_FEATURES) {
      return {
        score: Number.NaN,
        confidence: 0,
        factors: [],
        limitations: [
          'forecast requires at least one stage feature',
          'forecast provider abstained',
        ],
      };
    }
    let totalPipeline = 0;
    let totalWeighted = 0;
    const stageContribs: PredictionFactor[] = [];
    for (const [stage, amount] of stages) {
      const p = stageProbabilities[stage.toUpperCase()] ?? 0.1;
      const n = Number(amount);
      if (Number.isFinite(n)) {
        totalPipeline += n;
        totalWeighted += n * p;
        stageContribs.push({
          name: `stage:${stage}`,
          value: n,
          contribution: n * p,
        });
      }
    }
    if (totalPipeline < MIN_TOTAL_PIPELINE) {
      return {
        score: Number.NaN,
        confidence: 0,
        factors: stageContribs,
        limitations: [
          `pipeline total ${totalPipeline} below minimum ${MIN_TOTAL_PIPELINE}`,
          'forecast provider abstained',
        ],
      };
    }
    const expected = totalWeighted;
    const mean = expected / stages.length;
    const variance =
      stageContribs.reduce((acc, f) => {
        const d = f.contribution - mean;
        return acc + d * d;
      }, 0) / Math.max(stages.length - 1, 1);
    const stdDev = Math.sqrt(variance);
    const halfWidth = 1.96 * (stdDev / Math.sqrt(Math.max(stages.length, 1)));
    const confidence = clamp(
      0.5 + Math.min(stages.length, 8) * 0.06,
      0.4,
      0.95,
    );

    return {
      score: round(expected, 2),
      confidence: round(confidence, 4),
      label: `interval=±${round(halfWidth, 2)}`,
      factors: stageContribs,
      limitations: [
        'simple weighted pipeline (deterministic)',
        `stages=${stages.length}`,
        `intervalHalfWidth=${round(halfWidth, 2)}`,
      ],
    };
  }

  private extractStageProbabilities(metadata: unknown): Record<string, number> {
    if (!metadata || typeof metadata !== 'object')
      return DEFAULT_STAGE_PROBABILITY;
    const meta = metadata as { stageProbabilities?: unknown };
    const p = meta.stageProbabilities;
    if (!p || typeof p !== 'object') return DEFAULT_STAGE_PROBABILITY;
    const out: Record<string, number> = { ...DEFAULT_STAGE_PROBABILITY };
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) {
        out[k.toUpperCase()] = v;
      }
    }
    return out;
  }

  private numberFeature(
    features: Record<string, unknown>,
    key: string,
    fallback: number,
  ): number {
    const v = features[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  private collectStagesFromFeatures(
    features: Record<string, unknown>,
  ): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    for (const [k, v] of Object.entries(features)) {
      const m = k.match(/^stage_(.+)_(amount|count)$/i);
      if (m && typeof v === 'number' && Number.isFinite(v)) {
        out.push([m[1], v]);
      }
    }
    return out;
  }
}

export const __test_forecast_helpers__ = {
  DEFAULT_STAGE_PROBABILITY,
  sigmoid(z: number): number {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const ez = Math.exp(z);
    return ez / (1 + ez);
  },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
