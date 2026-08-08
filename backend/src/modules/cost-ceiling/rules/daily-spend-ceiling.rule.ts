/**
 * Phase 30 — DAILY_SPEND_CENTS ceiling (CR-AI-1305).
 *
 * Bounds the blast radius of a runaway agent loop: even with monthly
 * head-room, a tenant cannot burn the whole month in one day.
 *
 * SOLID
 *   SRP — owns ONLY the daily-spend dimension.
 */

import { Injectable } from '@nestjs/common';
import {
  type CeilingConfig,
  type CeilingEvaluation,
  type CostDimension,
  type CostProjection,
  type CostUsageSnapshot,
  type ICeilingRule,
} from '../interfaces/ICeilingRule';
import { evaluateCeiling } from './ceiling-evaluation';

@Injectable()
export class DailySpendCeilingRule implements ICeilingRule {
  readonly dimension: CostDimension = 'DAILY_SPEND_CENTS';

  evaluate(
    usage: CostUsageSnapshot,
    config: CeilingConfig,
    projection: CostProjection,
  ): CeilingEvaluation {
    return evaluateCeiling(
      this.dimension,
      usage.dayToDateCents,
      projection.estimatedCents,
      config,
    );
  }
}
