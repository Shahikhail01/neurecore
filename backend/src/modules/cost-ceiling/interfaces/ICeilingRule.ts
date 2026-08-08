/**
 * Phase 30 — Cost ceiling contracts (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30).
 *
 * A *ceiling* is a hard stop, distinct from the existing
 * `BudgetPolicy`, which alerts and throttles. When a ceiling is
 * exceeded the LLM call is denied with a typed error — no silent
 * degradation, no partial spend.
 *
 * SOLID
 *   SRP — this file owns ONLY the vocabulary and the rule contract.
 *   OCP — a new dimension is one `CostCeilingDimension` member, one
 *         rule class and one registry key. `CostCeilingService`,
 *         the guard and the dashboard never change.
 *   LSP — every rule substitutes `ICeilingRule`; the enforcement
 *         point never branches on the concrete rule.
 *   ISP — `ICeilingRule` exposes one decision method. Usage
 *         reporting (`IUsageReporter`) and alerting (`IAlertSink`)
 *         are separate one-method contracts.
 *   DIP — rules receive a plain `CostUsageSnapshot` value object;
 *         they never read Prisma, Redis or a clock.
 */

/** Dimensions a ceiling can be declared on. Mirrors the Prisma enum. */
export type CostDimension =
  | 'MONTHLY_SPEND_CENTS'
  | 'DAILY_SPEND_CENTS'
  | 'MONTHLY_TOKENS'
  | 'REQUESTS_PER_MINUTE';

/** Every dimension, in evaluation order (cheapest signal last). */
export const COST_DIMENSIONS: ReadonlyArray<CostDimension> = [
  'MONTHLY_SPEND_CENTS',
  'DAILY_SPEND_CENTS',
  'MONTHLY_TOKENS',
  'REQUESTS_PER_MINUTE',
];

/** Unit a dimension's `limitValue` and `used` are expressed in. */
export type CostDimensionUnit = 'cents' | 'tokens' | 'requests';

export const DIMENSION_UNIT: Readonly<
  Record<CostDimension, CostDimensionUnit>
> = {
  MONTHLY_SPEND_CENTS: 'cents',
  DAILY_SPEND_CENTS: 'cents',
  MONTHLY_TOKENS: 'tokens',
  REQUESTS_PER_MINUTE: 'requests',
};

/** Measured usage for one tenant, in every dimension, as integers. */
export interface CostUsageSnapshot {
  readonly tenantId: string;
  /** Integer cents spent since the start of the UTC month. */
  readonly monthToDateCents: number;
  /** Integer cents spent since the start of the UTC day. */
  readonly dayToDateCents: number;
  /** Tokens consumed since the start of the UTC month. */
  readonly monthToDateTokens: number;
  /** Requests in the trailing 60-second window. */
  readonly requestsLastMinute: number;
  readonly observedAt: string;
}

/** A configured ceiling for one dimension. */
export interface CeilingConfig {
  readonly dimension: CostDimension;
  /** Integer limit in the dimension's unit. */
  readonly limitValue: number;
  readonly enabled: boolean;
}

/** The projected cost of the call being authorised. */
export interface CostProjection {
  readonly estimatedCents: number;
  readonly estimatedTokens: number;
  readonly requests: number;
}

export const ZERO_PROJECTION: CostProjection = {
  estimatedCents: 0,
  estimatedTokens: 0,
  requests: 1,
};

/** One rule's decision for one dimension. */
export interface CeilingEvaluation {
  readonly dimension: CostDimension;
  readonly unit: CostDimensionUnit;
  readonly used: number;
  readonly projected: number;
  readonly limitValue: number;
  readonly exceeded: boolean;
  /** Fraction of the ceiling consumed after the projection, clamped to >= 0. */
  readonly utilization: number;
}

/**
 * A single ceiling rule. One method — a consumer that only needs the
 * decision never depends on persistence or alerting.
 */
export interface ICeilingRule {
  readonly dimension: CostDimension;
  evaluate(
    usage: CostUsageSnapshot,
    config: CeilingConfig,
    projection: CostProjection,
  ): CeilingEvaluation;
}

/** DI token — multi-bound array of every registered rule. */
export const CEILING_RULE = Symbol('CeilingRule');
/** DI token — the dimension-keyed rule registry. */
export const CEILING_RULE_REGISTRY = Symbol('CeilingRuleRegistry');
/** DI token — the usage reporter. */
export const USAGE_REPORTER = Symbol('UsageReporter');
/** DI token — the alert sink. */
export const COST_ALERT_SINK = Symbol('CostAlertSink');
/** DI token — the enforcement facade consumed by the LLM runner. */
export const COST_CEILING_ENFORCER = Symbol('CostCeilingEnforcer');
