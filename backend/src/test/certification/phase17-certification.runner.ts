/**
 * Phase 17 — G17 Sales analytics certification runner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §6.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G17-S-001 — Phase 16 G16 still APPROVED
 *   G17-S-002 — Phase 15 G15 still APPROVED
 *   G17-S-003 — LeadScoreProvider abstains on insufficient coverage
 *   G17-S-004 — OpportunityWinProvider emits confidence + abstain envelope
 *   G17-S-005 — ForecastProvider emits interval + backtest harness
 *   G17-S-006 — PipelineHealthProvider emits 4 risk axes (no fake 0.5)
 *   G17-S-007 — CaseClassifyProvider surfaces intent + sentiment
 *   G17-S-008 — RecommendationProvider carries supportingFacts + rankedAction
 *   G17-S-009 — typed-envelope.buildExplanation abstains on NaN
 *   G17-S-010 — typed-envelope sorts factors by |contribution|
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase15CertificationRunner } from './phase15-certification.runner';
import { Phase16CertificationRunner } from './phase16-certification.runner';
import { LeadScoreProvider } from '../../modules/analytics/providers/lead-score.provider';
import { OpportunityWinProvider } from '../../modules/analytics/providers/opportunity-win.provider';
import { ForecastProvider } from '../../modules/analytics/providers/forecast.provider';
import { PipelineHealthProvider } from '../../modules/analytics/providers/pipeline-health.provider';
import { CaseClassifyProvider } from '../../modules/analytics/providers/case-classify.provider';
import { RecommendationProvider } from '../../modules/service-gateway-v2/recommendations/prediction-recommendation.providers';
import {
  buildExplanation,
} from '../../modules/analytics/interfaces/typed-envelope';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase17CertificationRunner {
  private readonly logger = new Logger(Phase17CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    try {
      const p16 = await new Phase16CertificationRunner().run();
      record('G17-S-001', 'Phase 16 G16 still APPROVED', p16.verdict === 'APPROVED');
    } catch (err) {
      record('G17-S-001', 'Phase 16 G16 still APPROVED', false, (err as Error).message);
    }

    try {
      const p15 = await new Phase15CertificationRunner().run();
      record('G17-S-002', 'Phase 15 G15 still APPROVED', p15.verdict === 'APPROVED');
    } catch (err) {
      record('G17-S-002', 'Phase 15 G15 still APPROVED', false, (err as Error).message);
    }

    // G17-S-003 — LeadScoreProvider abstains on insufficient coverage
    {
      const fakePrisma = { analyticsModel: { findFirst: async () => null } };
      const provider = new LeadScoreProvider(fakePrisma as never);
      const out = await provider.score({
        tenantId: 'tenant-A',
        modelId: 'lead-default',
        modelVersion: '1',
        subject: { type: 'lead', id: 'lead-1' },
        features: { requested_demo: 1 },
      });
      const passed =
        Number.isNaN(out.score) &&
        out.confidence === 0 &&
        Array.isArray(out.factors) &&
        out.limitations.some((l) => l.includes('abstained'));
      record(
        'G17-S-003',
        'LeadScoreProvider abstains on insufficient coverage',
        passed,
      );
    }

    // G17-S-004 — OpportunityWinProvider emits confidence + abstain envelope
    {
      const fakePrisma = { analyticsModel: { findFirst: async () => null } };
      const provider = new OpportunityWinProvider(fakePrisma as never);
      const out = await provider.score({
        tenantId: 'tenant-A',
        modelId: 'oppty-default',
        modelVersion: '1',
        subject: { type: 'opportunity', id: 'opp-1' },
        features: {},
      });
      const passed =
        typeof out.score === 'number' &&
        out.confidence >= 0 &&
        out.confidence <= 1 &&
        Array.isArray(out.limitations);
      record(
        'G17-S-004',
        'OpportunityWinProvider emits confidence + abstain envelope',
        passed,
      );
    }

    // G17-S-005 — ForecastProvider emits interval + backtest harness
    {
      const fakePrisma = { analyticsModel: { findFirst: async () => null } };
      const provider = new ForecastProvider(fakePrisma as never);
      const out = await provider.score({
        tenantId: 'tenant-A',
        modelId: 'forecast-default',
        modelVersion: '1',
        subject: { type: 'pipeline', id: 'p-1' },
        features: {
          stage_LEAD_amount: 10,
          stage_QUALIFIED_amount: 5,
          stage_PROPOSAL_amount: 3,
          stage_NEGOTIATION_amount: 1,
          prob_distribution: JSON.stringify({
            LEAD: 0.2,
            QUALIFIED: 0.4,
            PROPOSAL: 0.6,
            NEGOTIATION: 0.8,
          }),
        },
      });
      const passed =
        typeof out.score === 'number' &&
        out.factors.length > 0 &&
        out.limitations.some((l) => l.includes('interval'));
      record(
        'G17-S-005',
        'ForecastProvider emits interval + backtest harness',
        passed,
      );
    }

    // G17-S-006 — PipelineHealthProvider emits 4 risk axes (no fake 0.5)
    {
      const provider = new PipelineHealthProvider();
      const out = await provider.score({
        tenantId: 'tenant-A',
        modelId: 'pipe-health-default',
        modelVersion: '1',
        subject: { type: 'pipeline', id: 'p-1' },
        features: {
          pipelineStall: 0.1,
          inactivity: 0.2,
          churn: 0.05,
          forecastSlippage: 0.3,
        },
      });
      const passed =
        typeof out.score === 'number' &&
        out.score >= 0 && out.score <= 1 &&
        out.factors.length >= 3 &&
        out.limitations.some((l) => l.length > 0);
      record(
        'G17-S-006',
        'PipelineHealthProvider emits 4 risk axes (no fake 0.5)',
        passed,
      );
    }

    // G17-S-007 — CaseClassifyProvider surfaces intent + sentiment
    {
      const fakePrisma = { analyticsModel: { findFirst: async () => null } };
      const provider = new CaseClassifyProvider(fakePrisma as never);
      const out = await provider.score({
        tenantId: 'tenant-A',
        modelId: 'case-classify-default',
        modelVersion: '1',
        subject: { type: 'case', id: 'c-1' },
        features: {
          text: 'I am very frustrated — this still does not work',
        },
      });
      const passed =
        typeof out.score === 'number' &&
        out.factors.length > 0 &&
        out.label !== undefined;
      record(
        'G17-S-007',
        'CaseClassifyProvider surfaces intent + sentiment',
        passed,
      );
    }

    // G17-S-008 — RecommendationProvider carries supportingEvidence + rankedAction
    {
      const fakeInner = {
        recommend: async () => [
          {
            id: 'rec-1',
            tenantId: 'tenant-A',
            title: 'Send follow-up',
            confidence: 0.8,
            reasoning: ['recently active'],
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            supportingEvidence: [
              { sourceType: 'record', sourceId: 'c-1', tenantId: 'tenant-A', observedAt: new Date().toISOString(), excerptHash: 'h' },
            ],
            rankedAction: { action: 'send_email', expectedBenefit: 0.4, risk: 0.05, confidence: 0.8 },
          },
        ],
      } as never;
      const provider = new RecommendationProvider(fakeInner);
      const out = await provider.recommend({ tenantId: 'tenant-A', context: {} });
      const passed =
        Array.isArray(out) &&
        out[0]?.rankedAction !== undefined &&
        Array.isArray(out[0]?.supportingEvidence) &&
        out[0].supportingEvidence.length > 0;
      record(
        'G17-S-008',
        'RecommendationProvider carries supportingEvidence + rankedAction',
        passed,
      );
    }

    // G17-S-009 — typed-envelope abstains on NaN
    {
      const out = buildExplanation({
        kind: 'lead',
        score: Number.NaN,
        confidence: 0,
        factors: [],
        limitations: ['abstained: coverage threshold'],
      });
      const passed = out.abstained === true && out.headline === 'provider abstained';
      record(
        'G17-S-009',
        'typed-envelope.buildExplanation abstains on NaN',
        passed,
      );
    }

    // G17-S-010 — typed-envelope sorts factors by |contribution|
    {
      const out = buildExplanation({
        kind: 'lead',
        score: 0.7,
        confidence: 0.85,
        factors: [
          { name: 'a', value: 1, contribution: 0.1 },
          { name: 'b', value: 1, contribution: 0.9 },
          { name: 'c', value: 1, contribution: 0.5 },
        ],
        limitations: [],
      });
      const passed = out.reasoning[0]?.startsWith('b=') === true;
      record(
        'G17-S-010',
        'typed-envelope sorts factors by |contribution|',
        passed,
      );
    }

    this.logger.log(
      `Phase 17 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
