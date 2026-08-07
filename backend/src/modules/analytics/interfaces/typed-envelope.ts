/**
 * Phase 17 — Sales analytics typed envelopes.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §3.
 *
 * Closes CR-AI-0701..0705. Each entry is a typed explanation envelope
 * the providers emit. The envelopes carry the canonical explanation
 * fields Creatio's docs require (factors, reasoning, limitations,
 * confidence interval).
 *
 * SRP — owns ONLY the typed envelope declarations. The providers
 * (lead-score, opportunity-win, forecast, pipeline-health,
 * case-classify) extend their existing ProviderPrediction shape via
 * these helpers.
 */

import type {
  ProviderPrediction,
  PredictionFactor,
} from './IPredictionProvider';

export interface TypedExplanation {
  readonly headline: string;
  readonly factors: ReadonlyArray<PredictionFactor>;
  readonly reasoning: ReadonlyArray<string>;
  readonly limitations: ReadonlyArray<string>;
  readonly confidence: number;
  readonly abstained: boolean;
}

/**
 * Build a typed explanation envelope from a `ProviderPrediction`.
 *
 * Pure function — no side effects. The headline is derived from
 * the score bucket; the reasoning combines the top factors with
 * the limitations so the dashboard can render a "why" surface
 * without losing any of the typed pieces.
 */
export function buildExplanation(
  input: ProviderPrediction & { kind?: string; tenantId?: string },
): TypedExplanation {
  const factors = input.factors ?? [];
  const limitations = input.limitations ?? [];
  const sortedFactors = [...factors].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );
  const topFactors = sortedFactors.slice(0, 3);
  const reasoning = topFactors.length > 0
    ? topFactors.map((f) => {
        const v = Number(f.value);
        const c = Number(f.contribution);
        return `${f.name}=${Number.isFinite(v) ? round(v, 3) : '—'} contributes ${Number.isFinite(c) ? round(c, 3) : '—'}`;
      })
    : ['no contributing factors'];
  const headline = buildHeadline(input);
  const abstained =
    Number.isNaN(input.score) || limitations.some((l) => l.includes('abstained'));
  return {
    headline,
    factors,
    reasoning,
    limitations,
    confidence: input.confidence,
    abstained,
  };
}

function buildHeadline(
  input: ProviderPrediction & { kind?: string; tenantId?: string },
): string {
  if (Number.isNaN(input.score)) return 'provider abstained';
  if (input.label) return `${input.kind ?? 'prediction'}: ${input.label}`;
  if (input.score >= 0.75) return `${input.kind ?? 'prediction'}: high`;
  if (input.score >= 0.5) return `${input.kind ?? 'prediction'}: medium`;
  if (input.score >= 0.25) return `${input.kind ?? 'prediction'}: low`;
  return `${input.kind ?? 'prediction'}: very low`;
}

function round(v: number, places: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}

/**
 * Confidence interval (Phase 17 — CR-AI-0703 forecast with interval).
 */
export interface ForecastInterval {
  readonly point: number;
  readonly lower: number;
  readonly upper: number;
  readonly halfWidth: number;
  readonly sampleSize: number;
  readonly confidenceLevel: number;
}

/**
 * Ranked action (Phase 17 — CR-AI-0704 Next-Best-Action).
 */
export interface RankedActionView {
  readonly action: string;
  readonly expectedBenefit: number;
  readonly risk: number;
  readonly confidence: number;
  readonly supportingFacts: ReadonlyArray<{ sourceType: string; sourceId: string }>;
}

export interface PipelineHealthView {
  readonly headline: string;
  readonly risk: number;
  readonly riskAxes: {
    readonly pipelineStall: number;
    readonly inactivity: number;
    readonly churn: number;
    readonly forecastSlippage: number;
  };
  readonly reasons: ReadonlyArray<string>;
}
