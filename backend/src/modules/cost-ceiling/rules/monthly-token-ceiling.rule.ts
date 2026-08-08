/**
 * Phase 30 — MONTHLY_TOKENS ceiling (CR-AI-1305).
 *
 * A provider-price-independent control. Token volume is what a
 * tenant actually contracts for; cents move when a provider reprices.
 *
 * SOLID
 *   SRP — owns ONLY the monthly-token dimension.
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
export class MonthlyTokenCeilingRule implements ICeilingRule {
  readonly dimension: CostDimension = 'MONTHLY_TOKENS';

  evaluate(
    usage: CostUsageSnapshot,
    config: CeilingConfig,
    projection: CostProjection,
  ): CeilingEvaluation {
    return evaluateCeiling(
      this.dimension,
      usage.monthToDateTokens,
      projection.estimatedTokens,
      config,
    );
  }
}
