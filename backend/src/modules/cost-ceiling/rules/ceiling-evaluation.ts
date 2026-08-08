/**
 * Phase 30 — Ceiling evaluation primitive (CR-AI-1305).
 *
 * The one place that decides what "exceeded" means, so four rules
 * cannot drift into four different comparisons. Arithmetic is
 * integer-only: no rule ever produces a fractional cent.
 *
 * SOLID
 *   SRP — owns ONLY the comparison. Which numbers to compare is the
 *         rule's decision; how to compare them is this function's.
 *   DIP — a pure function over value objects.
 */

import {
  DIMENSION_UNIT,
  type CeilingConfig,
  type CeilingEvaluation,
  type CostDimension,
} from '../interfaces/ICeilingRule';

/** Coerce to a non-negative safe integer; never returns NaN. */
export function toWholeUnits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * A ceiling is exceeded when `used + projected` would strictly exceed
 * the limit. A call that lands exactly on the limit is allowed — the
 * limit is the maximum permitted total, not the first denied value.
 *
 * A disabled ceiling never denies, but is still reported so the
 * dashboard can show its utilisation.
 */
export function evaluateCeiling(
  dimension: CostDimension,
  used: number,
  projected: number,
  config: CeilingConfig,
): CeilingEvaluation {
  const usedWhole = toWholeUnits(used);
  const projectedWhole = toWholeUnits(projected);
  const limitValue = toWholeUnits(config.limitValue);
  const total = usedWhole + projectedWhole;

  return {
    dimension,
    unit: DIMENSION_UNIT[dimension],
    used: usedWhole,
    projected: projectedWhole,
    limitValue,
    exceeded: config.enabled && total > limitValue,
    utilization: limitValue > 0 ? total / limitValue : 0,
  };
}
