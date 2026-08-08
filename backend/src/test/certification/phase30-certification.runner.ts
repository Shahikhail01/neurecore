/**
 * Phase 30 — G30 Resilience + per-tenant cost ceiling runner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G30-C-001 — Phase 29 G29 still APPROVED (no regression)
 *   G30-C-002 — Phase 14 G14 Command Center gates still APPROVED
 *   G30-C-003 — CeilingRuleRegistry wires all 4 dimensions
 *   G30-C-004 — Ceiling hit → typed CostCeilingExceededError (LLM denied)
 *   G30-C-005 — Below ceiling → the call proceeds
 *   G30-C-006 — Ceiling arithmetic is integer-cents safe
 *   G30-C-007 — A disabled ceiling never denies
 *   G30-C-008 — Every denial writes an append-only alert
 *   G30-C-009 — Request-rate ceiling trips on burst, recovers after window
 *   G30-C-010 — LlmModelRunner authorises before the upstream call
 *   G30-C-011 — LlmModelRunner reports realised spend after success
 *   G30-C-012 — Wildcard tenant refused on every ceiling entry point
 *   G30-C-013 — Dashboard composes cost + ceilings + resilience
 *   G30-C-014 — Prisma model + migration + admin FE surface are present
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Phase29CertificationRunner } from './phase29-certification.runner';
import { Phase14CertificationRunner } from './phase14-certification.runner';
import { CeilingRuleRegistry } from '../../modules/cost-ceiling/ceiling-rule.registry';
import { CEILING_RULE_CLASSES } from '../../modules/cost-ceiling/cost-ceiling.module';
import { CostCeilingService } from '../../modules/cost-ceiling/cost-ceiling.service';
import { CostDashboardService } from '../../modules/cost-ceiling/cost-dashboard.service';
import { CostCeilingExceededError } from '../../modules/cost-ceiling/cost-ceiling.errors';
import { RequestRateWindow } from '../../modules/cost-ceiling/usage/request-rate.window';
import { evaluateCeiling } from '../../modules/cost-ceiling/rules/ceiling-evaluation';
import type {
  CeilingConfig,
  CostUsageSnapshot,
} from '../../modules/cost-ceiling/interfaces/ICeilingRule';
import type { IUsageReporter } from '../../modules/cost-ceiling/interfaces/IUsageReporter';
import type {
  CostAlertEvent,
  IAlertSink,
} from '../../modules/cost-ceiling/interfaces/IAlertSink';
import type { ISpendRecorder } from '../../modules/cost-ceiling/interfaces/ISpendRecorder';
import type { SpendReport } from '../../modules/cost-ceiling/interfaces/ICostCeilingEnforcer';
import { LlmModelRunner } from '../../modules/analytics/services/model-runner/llm-model-runner';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

const NEURECORE_ROOT = path.join(__dirname, '..', '..', '..', '..');
const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');

/** Deterministic in-memory usage source for the gate. */
class StubUsageReporter implements IUsageReporter {
  constructor(private readonly usage: CostUsageSnapshot) {}
  async snapshot(): Promise<CostUsageSnapshot> {
    return this.usage;
  }
}

/** Captures every alert the service emits. */
class CapturingAlertSink implements IAlertSink {
  readonly events: CostAlertEvent[] = [];
  async alert(event: CostAlertEvent): Promise<void> {
    this.events.push(event);
  }
}

/** Captures every reported spend. */
class CapturingSpendRecorder implements ISpendRecorder {
  readonly reports: SpendReport[] = [];
  async record(report: SpendReport): Promise<void> {
    this.reports.push(report);
  }
}

/** In-memory ceiling configuration. */
class StubCeilingRepository {
  constructor(private readonly configs: ReadonlyArray<CeilingConfig>) {}
  async list(tenantId: string): Promise<ReadonlyArray<CeilingConfig>> {
    if (!tenantId || tenantId === '*') throw new Error('wildcard forbidden');
    return this.configs;
  }
}

function usageOf(
  overrides: Partial<CostUsageSnapshot> = {},
): CostUsageSnapshot {
  return {
    tenantId: 't1',
    monthToDateCents: 0,
    dayToDateCents: 0,
    monthToDateTokens: 0,
    requestsLastMinute: 0,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildRegistry(): CeilingRuleRegistry {
  const registry = new CeilingRuleRegistry(
    CEILING_RULE_CLASSES.map((Rule) => new Rule()),
  );
  registry.onModuleInit();
  return registry;
}

interface HarnessOptions {
  readonly usage?: Partial<CostUsageSnapshot>;
  readonly configs: ReadonlyArray<CeilingConfig>;
  readonly rateWindow?: RequestRateWindow;
}

interface Harness {
  readonly service: CostCeilingService;
  readonly alerts: CapturingAlertSink;
  readonly spend: CapturingSpendRecorder;
  readonly rateWindow: RequestRateWindow;
}

function buildHarness(options: HarnessOptions): Harness {
  const alerts = new CapturingAlertSink();
  const spend = new CapturingSpendRecorder();
  const rateWindow = options.rateWindow ?? new RequestRateWindow();
  const service = new CostCeilingService(
    new StubCeilingRepository(options.configs) as never,
    buildRegistry(),
    new StubUsageReporter(usageOf(options.usage)),
    alerts,
    spend,
    rateWindow,
  );
  return { service, alerts, spend, rateWindow };
}

@Injectable()
export class Phase30CertificationRunner {
  private readonly logger = new Logger(Phase30CertificationRunner.name);

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
      gates.push({ id, name, passed, detail });
      if (!passed) allPassed = false;
    };

    // G30-C-001 — Phase 29 still APPROVED
    try {
      const p29 = await new Phase29CertificationRunner().run();
      record(
        'G30-C-001',
        'Phase 29 G29 still APPROVED',
        p29.verdict === 'APPROVED',
      );
    } catch (err) {
      record(
        'G30-C-001',
        'Phase 29 G29 still APPROVED',
        false,
        (err as Error).message,
      );
    }

    // G30-C-002 — Phase 14 Command Center gates still APPROVED
    try {
      const p14 = await new Phase14CertificationRunner().run();
      record(
        'G30-C-002',
        'Phase 14 G14 Command Center still APPROVED',
        p14.verdict === 'APPROVED',
      );
    } catch (err) {
      record(
        'G30-C-002',
        'Phase 14 G14 Command Center still APPROVED',
        false,
        (err as Error).message,
      );
    }

    // G30-C-003 — registry wires every dimension
    {
      const registry = buildRegistry();
      const dimensions = registry.ordered().map((r) => r.dimension);
      const ok =
        dimensions.length === 4 &&
        registry.has('MONTHLY_SPEND_CENTS') &&
        registry.has('DAILY_SPEND_CENTS') &&
        registry.has('MONTHLY_TOKENS') &&
        registry.has('REQUESTS_PER_MINUTE');
      record(
        'G30-C-003',
        'CeilingRuleRegistry wires all 4 cost dimensions',
        ok,
        dimensions.join(','),
      );
    }

    // G30-C-004 — ceiling hit → typed error
    {
      const harness = buildHarness({
        usage: { monthToDateCents: 9_900 },
        configs: [
          {
            dimension: 'MONTHLY_SPEND_CENTS',
            limitValue: 10_000,
            enabled: true,
          },
        ],
      });
      let caught: unknown = null;
      try {
        await harness.service.authorize({
          tenantId: 't1',
          capability: 'lead-score',
          projection: { estimatedCents: 500, estimatedTokens: 0, requests: 1 },
        });
      } catch (err) {
        caught = err;
      }
      const typed = caught instanceof CostCeilingExceededError;
      record(
        'G30-C-004',
        'Ceiling hit → typed CostCeilingExceededError (LLM denied)',
        typed &&
          (caught as CostCeilingExceededError).evaluation.dimension ===
            'MONTHLY_SPEND_CENTS',
        typed ? 'CostCeilingExceededError' : String(caught),
      );
    }

    // G30-C-005 — below ceiling proceeds
    {
      const harness = buildHarness({
        usage: { monthToDateCents: 100 },
        configs: [
          {
            dimension: 'MONTHLY_SPEND_CENTS',
            limitValue: 10_000,
            enabled: true,
          },
        ],
      });
      let allowed = true;
      try {
        await harness.service.authorize({
          tenantId: 't1',
          capability: 'lead-score',
          projection: { estimatedCents: 500, estimatedTokens: 0, requests: 1 },
        });
      } catch {
        allowed = false;
      }
      record(
        'G30-C-005',
        'Below ceiling → the call proceeds',
        allowed && harness.alerts.events.length === 0,
        `allowed=${allowed} alerts=${harness.alerts.events.length}`,
      );
    }

    // G30-C-006 — integer-cents safety
    {
      const config: CeilingConfig = {
        dimension: 'MONTHLY_SPEND_CENTS',
        limitValue: 1_000,
        enabled: true,
      };
      const fractional = evaluateCeiling(
        'MONTHLY_SPEND_CENTS',
        999.4,
        0.6,
        config,
      );
      const exact = evaluateCeiling('MONTHLY_SPEND_CENTS', 999, 1, config);
      const over = evaluateCeiling('MONTHLY_SPEND_CENTS', 1_000, 1, config);
      const negative = evaluateCeiling(
        'MONTHLY_SPEND_CENTS',
        -5,
        Number.NaN,
        config,
      );
      const ok =
        Number.isInteger(fractional.used) &&
        Number.isInteger(fractional.projected) &&
        fractional.used === 999 &&
        fractional.projected === 1 &&
        exact.exceeded === false &&
        over.exceeded === true &&
        negative.used === 0 &&
        negative.projected === 0;
      record(
        'G30-C-006',
        'Ceiling arithmetic is integer-cents safe',
        ok,
        `used=${fractional.used} projected=${fractional.projected} exact=${exact.exceeded} over=${over.exceeded}`,
      );
    }

    // G30-C-007 — a disabled ceiling never denies
    {
      const harness = buildHarness({
        usage: { monthToDateCents: 999_999 },
        configs: [
          { dimension: 'MONTHLY_SPEND_CENTS', limitValue: 10, enabled: false },
        ],
      });
      let allowed = true;
      try {
        await harness.service.authorize({
          tenantId: 't1',
          capability: 'lead-score',
        });
      } catch {
        allowed = false;
      }
      const status = await harness.service.status('t1');
      record(
        'G30-C-007',
        'A disabled ceiling never denies but is still reported',
        allowed && status.evaluations.length === 1 && !status.anyExceeded,
        `allowed=${allowed} evaluations=${status.evaluations.length}`,
      );
    }

    // G30-C-008 — every denial writes an append-only alert
    {
      const harness = buildHarness({
        usage: { monthToDateTokens: 1_000_000 },
        configs: [
          { dimension: 'MONTHLY_TOKENS', limitValue: 1_000_000, enabled: true },
        ],
      });
      try {
        await harness.service.authorize({
          tenantId: 't1',
          capability: 'summarize',
          projection: { estimatedCents: 0, estimatedTokens: 1, requests: 1 },
          actorUserId: 'u1',
        });
      } catch {
        // expected
      }
      const event = harness.alerts.events[0];
      const ok =
        harness.alerts.events.length === 1 &&
        event?.tenantId === 't1' &&
        event?.capability === 'summarize' &&
        event?.actorUserId === 'u1' &&
        event?.evaluation.dimension === 'MONTHLY_TOKENS';
      record(
        'G30-C-008',
        'Every denial writes an append-only alert',
        ok,
        `alerts=${harness.alerts.events.length}`,
      );
    }

    // G30-C-009 — request-rate ceiling trips, then recovers
    {
      let now = 1_000_000;
      const rateWindow = new RequestRateWindow(() => now);
      const harness = buildHarness({
        configs: [
          { dimension: 'REQUESTS_PER_MINUTE', limitValue: 2, enabled: true },
        ],
        rateWindow,
      });
      // The stub reporter is static, so drive the rule directly through
      // the window the service records into.
      const service = new CostCeilingService(
        new StubCeilingRepository([
          { dimension: 'REQUESTS_PER_MINUTE', limitValue: 2, enabled: true },
        ]) as never,
        buildRegistry(),
        {
          snapshot: async () =>
            usageOf({ requestsLastMinute: rateWindow.count('t1') }),
        },
        harness.alerts,
        harness.spend,
        rateWindow,
      );

      const attempt = async (): Promise<boolean> => {
        try {
          await service.authorize({ tenantId: 't1', capability: 'chat' });
          return true;
        } catch {
          return false;
        }
      };

      const first = await attempt();
      const second = await attempt();
      const third = await attempt();
      now += 61_000;
      const afterWindow = await attempt();
      const ok = first && second && !third && afterWindow;
      record(
        'G30-C-009',
        'Request-rate ceiling trips on burst and recovers after the window',
        ok,
        `first=${first} second=${second} third=${third} afterWindow=${afterWindow}`,
      );
    }

    // G30-C-010 / G30-C-011 — LLM runner authorises then reports spend
    {
      const authorized: string[] = [];
      const spendReports: SpendReport[] = [];
      const enforcer = {
        authorize: async (req: { tenantId: string; capability: string }) => {
          authorized.push(`${req.tenantId}:${req.capability}`);
        },
        reportSpend: async (report: SpendReport) => {
          spendReports.push(report);
        },
      };
      const flag = {
        isEnabled: async () => true,
        endpointFor: () => 'https://llm.invalid/v1',
        modelFor: () => 'test-model',
        apiKeyFor: () => 'k',
      };
      let upstreamCalled = false;
      const fetchImpl = (async () => {
        upstreamCalled = true;
        return {
          ok: true,
          json: async () => ({
            content: 'hello',
            tokensIn: 400,
            tokensOut: 600,
            model: 'test-model',
          }),
        };
      }) as unknown as typeof fetch;

      const runner = new LlmModelRunner(flag as never, fetchImpl, enforcer);
      const result = await runner.run({
        tenantId: 't1',
        capability: 'lead-score',
        prompt: 'p',
        features: {},
      });
      record(
        'G30-C-010',
        'LlmModelRunner authorises before the upstream call',
        authorized.length === 1 &&
          authorized[0] === 't1:lead-score' &&
          upstreamCalled,
        `authorized=${authorized.join(',')}`,
      );
      record(
        'G30-C-011',
        'LlmModelRunner reports realised spend after success',
        spendReports.length === 1 &&
          spendReports[0]?.tokens === 1000 &&
          Number.isInteger(result.costCents) &&
          result.costCents > 0,
        `reports=${spendReports.length} costCents=${result.costCents}`,
      );
    }

    // G30-C-010b — a denied authorisation prevents the upstream call
    {
      let upstreamCalled = false;
      const enforcer = {
        authorize: async () => {
          throw new CostCeilingExceededError('t1', 'lead-score', {
            dimension: 'MONTHLY_SPEND_CENTS',
            unit: 'cents',
            used: 10,
            projected: 1,
            limitValue: 10,
            exceeded: true,
            utilization: 1.1,
          });
        },
        reportSpend: async () => undefined,
      };
      const flag = {
        isEnabled: async () => true,
        endpointFor: () => 'https://llm.invalid/v1',
        modelFor: () => 'test-model',
        apiKeyFor: () => 'k',
      };
      const fetchImpl = (async () => {
        upstreamCalled = true;
        return { ok: true, json: async () => ({ content: '', model: 'm' }) };
      }) as unknown as typeof fetch;
      const runner = new LlmModelRunner(flag as never, fetchImpl, enforcer);
      let denied = false;
      try {
        await runner.run({
          tenantId: 't1',
          capability: 'lead-score',
          prompt: 'p',
          features: {},
        });
      } catch (err) {
        denied = err instanceof CostCeilingExceededError;
      }
      record(
        'G30-C-012',
        'Denied authorisation gates the LLM call before any upstream spend',
        denied && !upstreamCalled,
        `denied=${denied} upstreamCalled=${upstreamCalled}`,
      );
    }

    // G30-C-013 — wildcard refusal on every entry point
    {
      const harness = buildHarness({
        configs: [
          { dimension: 'MONTHLY_SPEND_CENTS', limitValue: 10, enabled: true },
        ],
      });
      const refusals = await Promise.all([
        this.refuses(() =>
          harness.service.authorize({ tenantId: '*', capability: 'x' }),
        ),
        this.refuses(() => harness.service.status('*')),
        this.refuses(() =>
          harness.service.reportSpend({
            tenantId: '',
            capability: 'x',
            costCents: 1,
            tokens: 1,
          }),
        ),
      ]);
      record(
        'G30-C-013',
        'Wildcard / empty tenant refused on every ceiling entry point',
        refusals.every(Boolean),
        `refusals=${refusals.join(',')}`,
      );
    }

    // G30-C-014 — dashboard composes cost + ceilings + resilience
    {
      const harness = buildHarness({
        usage: { monthToDateCents: 250 },
        configs: [
          {
            dimension: 'MONTHLY_SPEND_CENTS',
            limitValue: 1_000,
            enabled: true,
          },
        ],
      });
      const costs = {
        summaryForTenant: async () => ({
          tenantId: 't1',
          totalSpent: 250,
          totalBudget: 5_000,
          utilization: 0.05,
          periodStart: '2026-08-01T00:00:00.000Z',
          periodEnd: '2026-08-08T00:00:00.000Z',
          byModel: [],
        }),
      };
      const slo = {
        aggregatedSnapshot: async () => ({
          routingTotal: 10,
          denials: 1,
          denialRate: 0.1,
          latencyP95Ms: 42,
          duplicateEffects: 0,
          recoveries: 2,
        }),
      };
      const dashboard = new CostDashboardService(
        costs as never,
        harness.service,
        slo as never,
      );
      const view = await dashboard.dashboard('t1');
      const wildcardRefused = await this.refuses(() =>
        dashboard.dashboard('*'),
      );
      const ok =
        view.tenantId === 't1' &&
        view.cost.totalSpent === 250 &&
        view.ceilings.evaluations.length === 1 &&
        view.resilience.latencyP95Ms === 42 &&
        view.containmentActive === false &&
        wildcardRefused;
      record(
        'G30-C-014',
        'Dashboard composes cost + ceilings + resilience, wildcard refused',
        ok,
        `evaluations=${view.ceilings.evaluations.length} containment=${view.containmentActive}`,
      );
    }

    // G30-C-015 — schema, migration and admin FE surface exist
    {
      const checks: ReadonlyArray<[string, RegExp]> = [
        [
          path.join(BACKEND_ROOT, 'prisma', 'schema.prisma'),
          /model TenantCostCeiling[\s\S]*@@map\("tenant_cost_ceilings"\)/,
        ],
        [
          path.join(BACKEND_ROOT, 'prisma', 'schema.prisma'),
          /enum CostCeilingDimension/,
        ],
        [
          path.join(
            BACKEND_ROOT,
            'prisma',
            'migrations',
            '20260808_phase30_cost_ceiling',
            'migration.sql',
          ),
          /CREATE TABLE IF NOT EXISTS "tenant_cost_ceilings"/,
        ],
        [
          path.join(
            NEURECORE_ROOT,
            'frontend-admin/src/components/command-center/CostCeilingCard.tsx',
          ),
          /export function CostCeilingCard/,
        ],
        [
          path.join(
            NEURECORE_ROOT,
            'frontend-admin/src/app/command-center/page.tsx',
          ),
          /<CostCeilingCard/,
        ],
      ];
      const failures: string[] = [];
      for (const [file, pattern] of checks) {
        const source = fs.existsSync(file)
          ? fs.readFileSync(file, 'utf-8')
          : '';
        if (!pattern.test(source)) {
          failures.push(`${path.basename(file)} !~ ${pattern}`);
        }
      }
      record(
        'G30-C-015',
        'Prisma model + migration + admin FE surface are present',
        failures.length === 0,
        failures.join(' | ') || 'all present',
      );
    }

    this.logger.log(
      `Phase 30 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return { verdict: allPassed ? 'APPROVED' : 'BLOCKED', gates };
  }

  private async refuses(operation: () => Promise<unknown>): Promise<boolean> {
    try {
      await operation();
      return false;
    } catch {
      return true;
    }
  }
}
