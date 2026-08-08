/**
 * Phase 26 — G26 Deal-forecast certification runner.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G26-D-001 — Phase 17 G17 still APPROVED (no regression)
 *   G26-D-002 — Phase 16 G16 still APPROVED
 *   G26-D-003 — ForecastSourceRegistry wires Deal + Quote sources
 *   G26-D-004 — DealPipelineSource weighted = Σ(amount × probability)
 *   G26-D-005 — DealPipelineSource refuses wildcard tenant
 *   G26-D-006 — QuoteAggregateSource counts ACCEPTED+SENT quotes only
 *   G26-D-007 — ForecastOrchestrator composes sources + computes interval
 *   G26-D-008 — ForecastOrchestrator persists DealPipelineSnapshot
 *   G26-D-009 — Orchestrator degrades gracefully on source failure
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase17CertificationRunner } from './phase17-certification.runner';
import { Phase16CertificationRunner } from './phase16-certification.runner';
import { ForecastSourceRegistry } from '../../modules/analytics/orchestrator/forecast-source.registry';
import { ForecastOrchestrator } from '../../modules/analytics/orchestrator/forecast.orchestrator';
import { DealPipelineSource } from '../../modules/analytics/sources/deal-pipeline.source';
import { QuoteAggregateSource } from '../../modules/analytics/sources/quote-aggregate.source';
import {
  FORECAST_SOURCE,
  type IForecastSource,
} from '../../modules/analytics/interfaces/IForecastSource';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase26CertificationRunner {
  private readonly logger = new Logger(Phase26CertificationRunner.name);

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

    // G26-D-001 — Phase 17 G17 still APPROVED
    try {
      const p17 = await new Phase17CertificationRunner().run();
      record('G26-D-001', 'Phase 17 G17 still APPROVED', p17.verdict === 'APPROVED');
    } catch (err) {
      record('G26-D-001', 'Phase 17 G17 still APPROVED', false, (err as Error).message);
    }

    // G26-D-002 — Phase 16 G16 still APPROVED
    try {
      const p16 = await new Phase16CertificationRunner().run();
      record('G26-D-002', 'Phase 16 G16 still APPROVED', p16.verdict === 'APPROVED');
    } catch (err) {
      record('G26-D-002', 'Phase 16 G16 still APPROVED', false, (err as Error).message);
    }

    // G26-D-003 — registry wires Deal + Quote sources
    {
      const deal = new DealPipelineSource({} as never);
      const quote = new QuoteAggregateSource({} as never);
      const injected: ReadonlyArray<IForecastSource> = [deal, quote];
      const registry = new ForecastSourceRegistry(injected as never);
      registry.onModuleInit();
      const ordered = registry.ordered().map((s) => s.sourceId).join(',');
      const ok =
        registry.has('deal-pipeline') &&
        registry.has('quote-aggregate') &&
        ordered === 'deal-pipeline,quote-aggregate';
      record(
        'G26-D-003',
        'ForecastSourceRegistry wires Deal + Quote sources',
        ok,
        `ordered=${ordered}`,
      );
    }

    // G26-D-004 — DealPipelineSource weighted total = Σ(amount × probability)
    {
      const rows = [
        { stage: 'PROPOSAL', amount: 1000, probability: 0.5, expectedCloseDate: new Date('2026-09-15') },
        { stage: 'NEGOTIATION', amount: 2000, probability: 0.75, expectedCloseDate: new Date('2026-09-20') },
        { stage: 'LEAD', amount: 500, probability: 0.1, expectedCloseDate: new Date('2026-09-25') },
        { stage: 'LOST', amount: 9999, probability: 0.0, expectedCloseDate: new Date('2026-09-10') },
      ];
      const fakePrisma = {
        deal: {
          findMany: async () => rows,
        },
      };
      const source = new DealPipelineSource(fakePrisma as never);
      const out = await source.load('t', {
        from: new Date('2026-09-01'),
        to: new Date('2026-10-01'),
      });
      // Expected: 1000*0.5 + 2000*0.75 + 500*0.1 = 500 + 1500 + 50 = 2050
      // LOST excluded.
      const expected = 2050;
      const ok =
        Math.abs(out.weightedTotal - expected) < 0.001 &&
        out.openCount === 3 &&
        out.byStage.length === 3;
      record(
        'G26-D-004',
        'DealPipelineSource weighted = Σ(amount × probability) excluding LOST',
        ok,
        `weightedTotal=${out.weightedTotal} openCount=${out.openCount}`,
      );
    }

    // G26-D-005 — refuses wildcard tenant
    {
      let rejected = false;
      try {
        await new DealPipelineSource({} as never).load('*', {
          from: new Date(),
          to: new Date(),
        });
      } catch {
        rejected = true;
      }
      record(
        'G26-D-005',
        'DealPipelineSource refuses wildcard tenant',
        rejected,
      );
    }

    // G26-D-006 — QuoteAggregateSource counts ACCEPTED + SENT only
    {
      const fakePrisma = {
        quote: {
          findMany: async () => [
            { status: 'ACCEPTED', total: 1000, createdAt: new Date('2026-09-05') },
            { status: 'SENT', total: 500, createdAt: new Date('2026-09-06') },
            { status: 'REJECTED', total: 9999, createdAt: new Date('2026-09-07') },
            { status: 'DRAFT', total: 9999, createdAt: new Date('2026-09-08') },
            { status: 'EXPIRED', total: 9999, createdAt: new Date('2026-09-09') },
          ],
        },
      };
      const source = new QuoteAggregateSource(fakePrisma as never);
      const out = await source.load('t', {
        from: new Date('2026-09-01'),
        to: new Date('2026-10-01'),
      });
      // Expected: 1000*1.0 + 500*0.5 = 1250
      const ok = Math.abs(out.weightedTotal - 1250) < 0.001 && out.openCount === 2;
      record(
        'G26-D-006',
        'QuoteAggregateSource counts ACCEPTED+SENT only',
        ok,
        `weightedTotal=${out.weightedTotal} openCount=${out.openCount}`,
      );
    }

    // G26-D-007 — ForecastOrchestrator composes + computes interval
    {
      const dealAgg = {
        sourceId: 'deal-pipeline',
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
        weightedTotal: 2050,
        openCount: 3,
        byStage: [],
        limitations: [],
      };
      const quoteAgg = {
        sourceId: 'quote-aggregate',
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
        weightedTotal: 1250,
        openCount: 2,
        byStage: [],
        limitations: [],
      };
      const dealSource = new DealPipelineSource({} as never);
      const quoteSource = new QuoteAggregateSource({} as never);
      (dealSource as unknown as { load: typeof dealSource.load }).load = async () => dealAgg;
      (quoteSource as unknown as { load: typeof quoteSource.load }).load = async () => quoteAgg;
      const registry = new ForecastSourceRegistry([dealSource, quoteSource] as never);
      registry.onModuleInit();
      const fakePrisma = {
        dealPipelineSnapshot: {
          upsert: async () => ({ id: 'snap-1' }),
        },
      };
      const orch = new ForecastOrchestrator(registry as never, fakePrisma as never);
      const out = await orch.compose({
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
      });
      const expectedTotal = 2050 + 1250;
      const ok =
        Math.abs(out.weightedTotal - expectedTotal) < 0.001 &&
        out.openCount === 5 &&
        out.sources.length === 2 &&
        typeof out.intervalHalfWidth === 'number' &&
        out.intervalHalfWidth >= 0;
      record(
        'G26-D-007',
        'ForecastOrchestrator composes sources + computes interval',
        ok,
        `weightedTotal=${out.weightedTotal} halfWidth=${out.intervalHalfWidth.toFixed(4)}`,
      );
    }

    // G26-D-008 — persists DealPipelineSnapshot
    {
      let upsertCalled = false;
      let upsertTenantId: string | null = null;
      let upsertPeriod: string | null = null;
      const fakePrisma = {
        dealPipelineSnapshot: {
          upsert: async (args: { where: { tenantId_period: { tenantId: string; period: string } } }) => {
            upsertCalled = true;
            upsertTenantId = args.where.tenantId_period.tenantId;
            upsertPeriod = args.where.tenantId_period.period;
            return { id: 'snap-1' };
          },
        },
      };
      const dealSource = new DealPipelineSource({} as never);
      const quoteSource = new QuoteAggregateSource({} as never);
      (dealSource as unknown as { load: typeof dealSource.load }).load = async () => ({
        sourceId: 'deal-pipeline',
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
        weightedTotal: 1000,
        openCount: 1,
        byStage: [],
        limitations: [],
      });
      (quoteSource as unknown as { load: typeof quoteSource.load }).load = async () => ({
        sourceId: 'quote-aggregate',
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
        weightedTotal: 0,
        openCount: 0,
        byStage: [],
        limitations: [],
      });
      const registry = new ForecastSourceRegistry([dealSource, quoteSource] as never);
      registry.onModuleInit();
      const orch = new ForecastOrchestrator(registry as never, fakePrisma as never);
      await orch.compose({
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
      });
      const ok =
        upsertCalled && upsertTenantId === 't' && upsertPeriod === '2026-09';
      record(
        'G26-D-008',
        'ForecastOrchestrator persists DealPipelineSnapshot',
        ok,
        `tenantId=${upsertTenantId} period=${upsertPeriod}`,
      );
    }

    // G26-D-009 — graceful degradation when a source throws
    {
      const failingSource = new DealPipelineSource({} as never);
      const healthySource = new QuoteAggregateSource({} as never);
      (failingSource as unknown as { load: typeof failingSource.load }).load = async () => {
        throw new Error('boom');
      };
      (healthySource as unknown as { load: typeof healthySource.load }).load = async () => ({
        sourceId: 'quote-aggregate',
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
        weightedTotal: 500,
        openCount: 1,
        byStage: [],
        limitations: [],
      });
      const registry = new ForecastSourceRegistry([failingSource, healthySource] as never);
      registry.onModuleInit();
      const fakePrisma = {
        dealPipelineSnapshot: {
          upsert: async () => ({ id: 'snap-1' }),
        },
      };
      const orch = new ForecastOrchestrator(registry as never, fakePrisma as never);
      const out = await orch.compose({
        tenantId: 't',
        window: {
          from: new Date('2026-09-01'),
          to: new Date('2026-10-01'),
        },
      });
      const ok =
        out.sources.length === 2 &&
        out.weightedTotal === 500 &&
        out.limitations.some((l) => l.includes('source_failed'));
      record(
        'G26-D-009',
        'ForecastOrchestrator degrades gracefully on source failure',
        ok,
        `limitations=${out.limitations.length}`,
      );
    }

    this.logger.log(
      `Phase 26 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
