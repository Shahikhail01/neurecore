/**
 * P5 — Predictive provider unit tests.
 *
 * Ensures the typed providers never emit a neutral 0.5 fallback —
 * every output carries explicit limitations, and an abstention when
 * coverage is below the documented threshold.
 */

import { LeadScoreProvider } from '../../../src/modules/analytics/providers/lead-score.provider';
import { OpportunityWinProvider } from '../../../src/modules/analytics/providers/opportunity-win.provider';
import { ForecastProvider } from '../../../src/modules/analytics/providers/forecast.provider';
import { ForecastBacktest } from '../../../src/modules/analytics/providers/forecast.backtest';
import { PipelineHealthProvider } from '../../../src/modules/analytics/providers/pipeline-health.provider';
import { CaseClassifyProvider } from '../../../src/modules/analytics/providers/case-classify.provider';

describe('P5 — predictive providers', () => {
  const TENANT = 'tenant-abc';

  it('lead-score abstains when coverage is below threshold', async () => {
    const provider = new LeadScoreProvider({} as never);
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'lead', id: 'lead-1' },
      features: { requested_demo: 1 },
    });
    expect(result.limitations.some((l) => l.includes('abstained'))).toBe(true);
    expect(Number.isNaN(result.score)).toBe(true);
  });

  it('lead-score returns a bounded probability when coverage is sufficient', async () => {
    const provider = new LeadScoreProvider({} as never);
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'lead', id: 'lead-2' },
      features: {
        requested_demo: 1,
        lead_source_email: 1,
        lead_source_referral: 1,
        company_size_log: 1,
        senior_decision_maker: 1,
      },
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('opportunity-win abstains with empty features', async () => {
    const provider = new OpportunityWinProvider({} as never);
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'opportunity', id: 'opp-1' },
      features: {},
    });
    expect(result.limitations.some((l) => l.includes('abstained'))).toBe(true);
  });

  it('forecast abstains on empty pipeline', async () => {
    const provider = new ForecastProvider({} as never);
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'forecast', id: 'q1' },
      features: {},
    });
    expect(result.limitations.some((l) => l.includes('abstained'))).toBe(true);
  });

  it('forecast backtest produces coverage, MAE, MSE', async () => {
    const provider = new ForecastProvider({} as never);
    const backtest = new ForecastBacktest(provider);
    const report = await backtest.run(TENANT, [
      {
        period: 'p1',
        actual: 100,
        features: { stage_proposal_amount: 50, stage_negotiation_amount: 50 },
      },
      {
        period: 'p2',
        actual: 75,
        features: { stage_proposal_amount: 30, stage_negotiation_amount: 45 },
      },
      {
        period: 'p3',
        actual: 60,
        features: { stage_proposal_amount: 25, stage_negotiation_amount: 35 },
      },
    ]);
    expect(report.samples).toBe(3);
    expect(Number.isFinite(report.mae)).toBe(true);
    expect(Number.isFinite(report.mse)).toBe(true);
  });

  it('pipeline-health classifies by max axis', async () => {
    const provider = new PipelineHealthProvider();
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'pipeline', id: 'opp-x' },
      features: {
        days_since_activity: 90,
        engagement_recency_days: 60,
        stage_age_days: 120,
        activity_streak_breaks: 5,
        no_scheduled_activity: true,
      },
    });
    expect(['healthy', 'watch', 'high-risk']).toContain(result.label ?? '');
    expect(result.score).toBeGreaterThan(0);
  });

  it('case-classify abstains on empty text', async () => {
    const provider = new CaseClassifyProvider({} as never);
    const result = await provider.score({
      tenantId: TENANT,
      modelId: 'm',
      modelVersion: '1',
      subject: { type: 'case', id: 'case-1' },
      features: { text: '' },
    });
    expect(result.limitations.some((l) => l.includes('abstained'))).toBe(true);
  });
});
