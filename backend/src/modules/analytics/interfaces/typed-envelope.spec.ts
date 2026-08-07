/**
 * Phase 17 — Typed envelope + buildExplanation unit tests.
 */

import {
  buildExplanation,
  ForecastInterval,
  PipelineHealthView,
  RankedActionView,
} from './typed-envelope';

describe('Phase 17 — typed envelope helpers', () => {
  it('builds an explanation from a populated ProviderPrediction', () => {
    const out = buildExplanation({
      kind: 'lead',
      score: 0.83,
      confidence: 0.9,
      label: 'high',
      factors: [
        { name: 'requested_demo', value: 1, contribution: 0.4 },
        { name: 'lead_source_referral', value: 1, contribution: 0.3 },
        { name: 'industry_fit', value: 0.7, contribution: 0.14 },
      ],
      limitations: ['logistic regression on per-tenant weights'],
    });
    expect(out.headline).toBe('lead: high');
    expect(out.confidence).toBe(0.9);
    expect(out.abstained).toBe(false);
    expect(out.reasoning).toHaveLength(3);
    expect(out.reasoning[0]).toContain('requested_demo');
  });

  it('flags abstained when score is NaN', () => {
    const out = buildExplanation({
      kind: 'lead',
      score: Number.NaN,
      confidence: 0,
      factors: [],
      limitations: ['insufficient feature coverage (abstained)'],
    });
    expect(out.abstained).toBe(true);
    expect(out.headline).toBe('provider abstained');
  });

  it('flags abstained when limitations mention "abstained"', () => {
    const out = buildExplanation({
      kind: 'lead',
      score: 0.4,
      confidence: 0.2,
      factors: [],
      limitations: ['coverage threshold not met — provider abstained'],
    });
    expect(out.abstained).toBe(true);
  });

  it('ForecastInterval shape narrows the carry', () => {
    const i: ForecastInterval = {
      point: 1000,
      lower: 800,
      upper: 1200,
      halfWidth: 200,
      sampleSize: 12,
      confidenceLevel: 0.95,
    };
    expect(i.halfWidth).toBe(200);
    expect(i.confidenceLevel).toBe(0.95);
  });

  it('RankedActionView shape includes expectedBenefit + risk', () => {
    const a: RankedActionView = {
      action: 'Send follow-up email',
      expectedBenefit: 0.34,
      risk: 0.05,
      confidence: 0.8,
      supportingFacts: [{ sourceType: 'record', sourceId: 'c-1' }],
    };
    expect(a.supportingFacts).toHaveLength(1);
  });

  it('PipelineHealthView exposes 4 risk axes', () => {
    const v: PipelineHealthView = {
      headline: 'pipeline healthy',
      risk: 0.12,
      riskAxes: {
        pipelineStall: 0.05,
        inactivity: 0.08,
        churn: 0.02,
        forecastSlippage: 0.31,
      },
      reasons: ['3 deals inactive > 14 days'],
    };
    expect(v.riskAxes.forecastSlippage).toBe(0.31);
  });
});
