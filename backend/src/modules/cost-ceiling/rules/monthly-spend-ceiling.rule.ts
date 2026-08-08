/**
 * Phase 30 — MONTHLY_SPEND_CENTS ceiling (CR-AI-1305).
 *
 * The primary containment control: total integer cents a tenant may
 * spend on AI within the current UTC month.
 *
 * SOLID
 *   SRP — owns ONLY the monthly-spend dimension.
 *   LSP — substitutes `ICeilingRule` like every other rule.
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
export class MonthlySpendCeilingRule implements ICeilingRule {
  readonly dimension: CostDimension = 'MONTHLY_SPEND_CENTS';

  evaluate(
    usage: CostUsageSnapshot,
    config: CeilingConfig,
    projection: CostProjection,
  ): CeilingEvaluation {
    return evaluateCeiling(
      this.dimension,
      usage.monthToDateCents,
      projection.estimatedCents,
      config,
    );
  }
}
