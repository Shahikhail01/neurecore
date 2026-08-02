/**
 * OpportunityWinProvider — Phase 5 P5
 *
 * Logistic-regression-style scoring on opportunity features with
 * calibrated, weighted factors and an explicit abstention path.
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

interface OppLinearWeights {
  stage_proposal?: number;
  stage_negotiation?: number;
  stage_qualified?: number;
  amount_log?: number;
  close_window_30d?: number;
  close_window_90d?: number;
  primary_contact_engaged?: number;
  competitor_known?: number;
  past_closed_won?: number;
  multi_thread?: number;
  champion_identified?: number;
  budget_confirmed?: number;
  activity_recency_days_inv?: number;
  negative_signal?: number;
}

@Injectable()
export class OpportunityWinProvider implements IPredictionProvider {
  readonly kind = 'opportunity' as const;
  private readonly logger = new Logger(OpportunityWinProvider.name);

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
          `opportunity coverage ${(coverage * 100).toFixed(0)}% below ${MIN_FEATURE_COVERAGE * 100}%`,
          'opportunity-win provider abstained',
        ],
      };
    }
    const p = sigmoid(z);
    return {
      score: round(p, 4),
      confidence: round(clamp(coverage * 0.9, 0.1, 0.99), 4),
      label: this.label(p),
      factors,
      limitations: [
        'logistic regression on per-tenant weights',
        `coverage: ${(coverage * 100).toFixed(0)}%`,
      ],
    };
  }

  private extractWeights(metadata: unknown): OppLinearWeights {
    if (!metadata || typeof metadata !== 'object') return {};
    const meta = metadata as { weights?: unknown };
    const w = meta.weights;
    if (!w || typeof w !== 'object') return {};
    const out: OppLinearWeights = {};
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

  private label(p: number): string {
    if (p >= 0.7) return 'likely-win';
    if (p >= 0.45) return 'contested';
    return 'at-risk';
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
