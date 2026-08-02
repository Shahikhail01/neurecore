/**
 * PipelineHealthProvider — Phase 5 P5
 *
 * Classifies opportunities along three pipelines-health axes:
 *   - churn-risk (no activity in N days + low engagement)
 *   - close-risk (long stage-time + low activity)
 *   - inactivity (no scheduled activity + no recent commits)
 *
 * Each axis emits a 0..1 risk score; the maximum is the headline risk.
 * Abstains when all three axes return insufficient evidence.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IPredictionProvider,
  PredictionFactor,
  PredictionProviderInput,
  ProviderPrediction,
} from '../interfaces/IPredictionProvider';

@Injectable()
export class PipelineHealthProvider implements IPredictionProvider {
  readonly kind = 'pipeline' as const;
  private readonly logger = new Logger(PipelineHealthProvider.name);

  score(input: PredictionProviderInput): Promise<ProviderPrediction> {
    return Promise.resolve(this.compute(input));
  }

  private compute(input: PredictionProviderInput): ProviderPrediction {
    const factors: PredictionFactor[] = [];
    const churn = this.axisChurn(input.features);
    factors.push({ name: 'churn', value: churn, contribution: churn });
    const close = this.axisCloseRisk(input.features);
    factors.push({ name: 'close-risk', value: close, contribution: close });
    const inactivity = this.axisInactivity(input.features);
    factors.push({
      name: 'inactivity',
      value: inactivity,
      contribution: inactivity,
    });

    const maxRisk = Math.max(churn, close, inactivity);
    const matched = churn > 0 || close > 0 || inactivity > 0 ? 1 : 0;
    const confidence = matched === 0 ? 0 : clamp(0.4 + matched * 0.2, 0.2, 0.9);

    return {
      score: round(maxRisk, 4),
      confidence: round(confidence, 4),
      label:
        maxRisk > 0.66 ? 'high-risk' : maxRisk > 0.33 ? 'watch' : 'healthy',
      factors,
      limitations: ['heuristic pipeline-health axes; not a trained classifier'],
    };
  }

  private axisChurn(features: Record<string, unknown>): number {
    const daysSinceActivity = this.num(features, 'days_since_activity', 999);
    const engagementRecency = this.num(
      features,
      'engagement_recency_days',
      999,
    );
    const low =
      clamp01((daysSinceActivity - 14) / 30) * 0.6 +
      clamp01((engagementRecency - 14) / 45) * 0.4;
    return clamp01(low);
  }

  private axisCloseRisk(features: Record<string, unknown>): number {
    const stageDays = this.num(features, 'stage_age_days', 0);
    const activityStreak = this.num(features, 'activity_streak_breaks', 0);
    const low =
      clamp01((stageDays - 21) / 60) * 0.7 + clamp01(activityStreak / 4) * 0.3;
    return clamp01(low);
  }

  private axisInactivity(features: Record<string, unknown>): number {
    const noScheduled = features['no_scheduled_activity'] === true ? 0.6 : 0;
    const noRecentCommit = features['no_recent_commit'] === true ? 0.4 : 0;
    return clamp01(noScheduled + noRecentCommit);
  }

  private num(
    features: Record<string, unknown>,
    key: string,
    fallback: number,
  ): number {
    const v = features[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number, places: number): number {
  const p = 10 ** places;
  return Math.round(v * p) / p;
}
