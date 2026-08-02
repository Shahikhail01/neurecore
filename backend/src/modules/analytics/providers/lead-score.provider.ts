/**
 * LeadScoreProvider — Phase 5 P5
 *
 * Logistic-regression-style linear scoring over lead features. Weights
 * come from `AnalyticsModel.metadata.weights`; bias and the unary
 * sigmoid ensure the result is bounded in [0, 1]. Abstains (and lets
 * the upstream PredictionService handle the abstention envelope)
 * when:
 *   - the model has no registered weights,
 *   - there are zero matches between incoming features and weights, or
 *   - coverage is below MIN_FEATURE_COVERAGE.
 *
 * No silent neutral 0.5 — every output carries an explicit
 * limitations line.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IPredictionProvider,
  PredictionFactor,
  PredictionProviderInput,
  ProviderPrediction,
} from '../interfaces/IPredictionProvider';

const MIN_FEATURE_COVERAGE = 0.25;

interface LeadLinearWeights {
  lead_source_email?: number;
  lead_source_referral?: number;
  lead_source_web?: number;
  lead_source_event?: number;
  company_size_log?: number;
  senior_decision_maker?: number;
  requested_demo?: number;
  opened_recent_email?: number;
  industry_fit?: number;
  negative_signal?: number;
}

@Injectable()
export class LeadScoreProvider implements IPredictionProvider {
  readonly kind = 'lead' as const;
  private readonly logger = new Logger(LeadScoreProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async score(input: PredictionProviderInput): Promise<ProviderPrediction> {
    const model = await this.prisma.analyticsModel.findFirst({
      where: {
        id: input.modelId,
        OR: [{ tenantId: input.tenantId }, { tenantId: null }],
      },
    });
    const weights = this.extractWeights(model?.metadata);

    const factors: PredictionFactor[] = [];
    let z = 0;
    let matched = 0;
    for (const [name, w] of Object.entries(weights)) {
      const v = input.features[name];
      if (this.isNumeric(v) && Number.isFinite(w)) {
        const contribution = Number(v) * Number(w);
        z += contribution;
        if (w !== 0) matched++;
        factors.push({ name, value: Number(v), contribution });
      }
    }
    const total = Object.keys(weights).length || 1;
    const coverage = matched / total;

    if (matched === 0 || coverage < MIN_FEATURE_COVERAGE) {
      return {
        score: Number.NaN,
        confidence: 0,
        factors,
        limitations: [
          `insufficient feature coverage (matched ${matched} of ${total} weighted features, coverage=${coverage.toFixed(2)})`,
          'lead-score provider abstained',
        ],
      };
    }

    const probability = sigmoid(z);
    const confidence = clamp(coverage * 0.9, 0.1, 0.99);

    return {
      score: round(probability, 4),
      confidence: round(confidence, 4),
      label: this.label(probability),
      factors,
      limitations: [
        'logistic regression on per-tenant weights',
        `coverage: ${(coverage * 100).toFixed(0)}%`,
      ],
    };
  }

  private extractWeights(metadata: unknown): LeadLinearWeights {
    if (!metadata || typeof metadata !== 'object') return {};
    const meta = metadata as { weights?: unknown };
    const w = meta.weights;
    if (!w || typeof w !== 'object') return {};
    const out: LeadLinearWeights = {};
    for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (out as Record<string, number>)[k] = v;
      }
    }
    return out;
  }

  private isNumeric(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v);
  }

  private label(probability: number): string {
    if (probability >= 0.75) return 'high';
    if (probability >= 0.5) return 'medium';
    if (probability >= 0.25) return 'low';
    return 'very-low';
  }
}

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
