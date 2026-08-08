/**
 * Phase 30 — REQUESTS_PER_MINUTE ceiling (CR-AI-1305).
 *
 * The resilience half of CR-AI-1305: a per-tenant rate control that
 * protects shared provider capacity from one tenant's burst, even
 * when that tenant is well inside its spend ceiling.
 *
 * SOLID
 *   SRP — owns ONLY the request-rate dimension.
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
export class RequestRateCeilingRule implements ICeilingRule {
  readonly dimension: CostDimension = 'REQUESTS_PER_MINUTE';

  evaluate(
    usage: CostUsageSnapshot,
    config: CeilingConfig,
    projection: CostProjection,
  ): CeilingEvaluation {
    return evaluateCeiling(
      this.dimension,
      usage.requestsLastMinute,
      projection.requests,
      config,
    );
  }
}
