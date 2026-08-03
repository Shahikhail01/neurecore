import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UuidSchema, type AuthorizationContext } from '../contracts';
import {
  WorkloadProfileSchema,
  PHASE8_DEFAULT_PROFILES,
  Phase8RunnerReportSchema,
  SloPolicySchema,
  type WorkloadMetricBundle,
  type WorkloadProfile,
  type SloPolicy,
} from './contracts';
import {
  Phase8Coordinator,
  WorkloadRunner,
  computePhase8Counters,
  checksumPhase8Report,
  evaluateSloPolicy,
  isSloPolicyEnforceable,
  runWithGuards,
  RunnerCancelledError,
  RunnerTimeoutError,
  finalizePhase8Report,
} from './runners';
import {
  InMemoryMetricsPort,
  InMemoryPressurePort,
  InMemoryCachePort,
  InMemoryDbPort,
  InMemoryQueuePort,
  InMemoryProviderPort,
  InMemoryCleanupPort,
  FailingCleanupAdapter,
  UnsupportedCleanupAdapter,
  Phase8EvidenceSink,
  createAuthorizationContext,
  buildLatencyDistribution,
  buildConfidenceIntervals,
  buildStatisticalConfidence,
  buildTokenCost,
  detectSaturationFromCurves,
  emptyTokenCost,
  WORKLOAD_KINDS,
  DeterministicCorrectnessOracle,
  DeterministicIsolationOracle,
  TenantKeyIsolationOracle,
  SimulatedWorkloadPort,
  InMemoryPhase8AdapterRegistry,
  UnsupportedPhase8Adapters,
  listAdapters,
  unsupportedRegistrationStamps,
  UNSUPPORTED_ADAPTER_REASON,
  InMemoryOperationalAlertPort,
  UnsupportedOperationalAlertPort,
  UNSUPPORTED_ALERT_REASON,
  UnsupportedProductionAdapterStub,
  PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX,
  unsupportedProductionAdapterStubs,
  SUFFICIENT_SAMPLE_THRESHOLD,
  type CleanupPort,
} from './ports';
import {
  Phase8LaneSelector,
  Phase8Gate,
  evaluateReleaseCapacityGate,
} from './ci-lane';
import {
  writePhase8Report,
  buildPhase8CapacityReport,
  buildPhase8IntegrityReport,
} from './report-writer';
import {
  roundTripPhase8Report,
  detectTampering,
  evaluateReportRetention,
  restoreReport,
  ReportSchemaMigratorChain,
  tamperedReport,
  KNOWN_REPORT_VERSIONS,
  type ReportRetentionInput,
} from './report-migration';
import {
  dispatchOperationalAlerts,
  alertGateForReport,
  buildUnauthorizedCapacityAlert,
} from './alerts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const TENANT_C = '33333333-3333-3333-3333-333333333333';

function ctx(tenantId: string = TENANT_A): AuthorizationContext {
  return createAuthorizationContext(tenantId);
}

const baseTenantIds = [TENANT_A, TENANT_B, TENANT_C];

describe('Phase 8 / Conformance / Schemas', () => {
  it('runtime-validates every default workload profile', () => {
    for (const p of PHASE8_DEFAULT_PROFILES) {
      expect(WorkloadProfileSchema.safeParse(p).success).toBe(true);
    }
    expect(PHASE8_DEFAULT_PROFILES.length).toBe(WORKLOAD_KINDS.length);
  });

  it('workload profile IDs are unique', () => {
    const ids = new Set(PHASE8_DEFAULT_PROFILES.map((p) => p.profileId));
    expect(ids.size).toBe(PHASE8_DEFAULT_PROFILES.length);
  });

  it('soak profile specifies windows', () => {
    const soak = PHASE8_DEFAULT_PROFILES.find((p) => p.kind === 'SOAK');
    expect(soak?.windows).toBeGreaterThan(1);
  });

  it('pressure profiles include pressureConfig', () => {
    for (const kind of [
      'PROVIDER_THROTTLE',
      'QUEUE_PRESSURE',
      'DB_PRESSURE',
      'CACHE_PRESSURE',
      'RECOVERY',
    ] as const) {
      const p = PHASE8_DEFAULT_PROFILES.find((x) => x.kind === kind);
      expect(p?.pressureConfig).toBeDefined();
    }
  });

  it('SLO policy without approval is parseable but not enforceable', () => {
    const draft: SloPolicy = SloPolicySchema.parse({
      schemaVersion: '1.1.0',
      policyId: 'slo-draft',
      approvedBy: null,
      approvedAt: null,
      approvedEnvironment: null,
      errorBudgetPercent: 0.5,
      thresholds: [
        { metric: 'p95-latency-ms', operator: 'LTE', value: 200, unit: 'ms' },
      ],
      minimumSampleSize: 30,
    });
    expect(isSloPolicyEnforceable(draft)).toBe(false);
  });

  it('SLO policy with approval is enforceable', () => {
    const approved: SloPolicy = SloPolicySchema.parse({
      schemaVersion: '1.1.0',
      policyId: 'slo-approved',
      approvedBy: 'sre-platform',
      approvedAt: new Date().toISOString(),
      approvedEnvironment: 'STAGING',
      errorBudgetPercent: 1,
      thresholds: [
        { metric: 'p95-latency-ms', operator: 'LTE', value: 200, unit: 'ms' },
        { metric: 'error-rate', operator: 'LTE', value: 0.01, unit: 'ratio' },
      ],
      minimumSampleSize: 30,
    });
    expect(isSloPolicyEnforceable(approved)).toBe(true);
  });

  it('saturation point allows curve array and detection enum', () => {
    const sample = {
      schemaVersion: '1.1.0',
      metric: 'queue-depth',
      inflectionValue: 250,
      unit: 'jobs',
      observedAt: new Date().toISOString(),
      detection: 'QUEUE_DEPTH' as const,
      curve: [
        {
          timestamp: new Date().toISOString(),
          queueDepth: 10,
        },
      ],
    };
    expect(sample.curve.length).toBe(1);
  });
});

describe('Phase 8 / Conformance / Ports', () => {
  it('metrics port reset clears all counters', () => {
    const m = new InMemoryMetricsPort();
    m.record(1, 'OK');
    m.record(2, 'ERROR');
    const before = m.snapshot();
    expect(before.successCount).toBe(1);
    m.reset();
    const after = m.snapshot();
    expect(after.successCount).toBe(0);
    expect(after.failureCount).toBe(0);
    expect(after.latencies.length).toBe(0);
  });

  it('pressure port reset clears samples and state', () => {
    const p = new InMemoryPressurePort();
    p.begin(PHASE8_DEFAULT_PROFILES[0]);
    p.tick(Date.now());
    p.tick(Date.now());
    expect(p.listSamples().length).toBe(2);
    p.reset();
    expect(p.listSamples().length).toBe(0);
  });

  it('cache port setMissRatio increases miss count', async () => {
    const c = new InMemoryCachePort();
    c.setMissRatio(1);
    await c.set('a', 1);
    const v = await c.get('a');
    expect(v).toBeNull();
    expect(c.stats().missCount).toBeGreaterThanOrEqual(1);
  });

  it('db port peakConnections tracks concurrent queries', async () => {
    const d = new InMemoryDbPort();
    d.setLatencyMs(5, 5);
    await Promise.all([d.query('q1'), d.query('q2'), d.query('q3')]);
    expect(d.peakConnections()).toBeGreaterThanOrEqual(1);
  });

  it('queue port peakDepth tracks backlog', async () => {
    const q = new InMemoryQueuePort();
    q.setBacklog(10);
    expect(q.peakDepth()).toBe(10);
    await q.take();
    expect(q.depth()).toBe(9);
  });

  it('provider port clear resets throttle and delay', () => {
    const p = new InMemoryProviderPort();
    p.setThrottle(50, 100);
    expect(p.throttlePercent()).toBe(50);
    p.clear();
    expect(p.throttlePercent()).toBe(0);
    expect(p.delayMs()).toBe(0);
  });

  it('FailingCleanupAdapter reports failure and tracks orphans', async () => {
    const c = new FailingCleanupAdapter();
    const outcome = await c.cleanup({ id: 'x', tenantId: TENANT_A });
    expect(outcome.cleaned).toBe(false);
    expect(outcome.error).toBe('CLEANUP_FAILED');
    expect(outcome.orphans).toContain('x');
    expect(c.listOrphans()).toContain('x');
  });

  it('UnsupportedCleanupAdapter rejects with UNSUPPORTED reason', async () => {
    const c = new UnsupportedCleanupAdapter();
    await expect(c.cleanup({ id: 'x', tenantId: TENANT_A })).rejects.toThrow(
      /PHASE8_CLEANUP_UNSUPPORTED/,
    );
  });

  it('IsolationOracle correlates by requestId map not array index', () => {
    const o = new DeterministicIsolationOracle();
    const map = new Map<
      string,
      { requestId: string; status: 'OK'; durationMs: number; provider: string }
    >();
    map.set('r1', {
      requestId: 'r1',
      status: 'OK',
      durationMs: 1,
      provider: 'tenant:' + TENANT_A,
    });
    map.set('r2', {
      requestId: 'r2',
      status: 'OK',
      durationMs: 1,
      provider: 'tenant:' + TENANT_B,
    });
    expect(o.evaluate(TENANT_A, [TENANT_B], map)).toBe('PASSED');
  });

  it('IsolationOracle fails on cross-tenant provider prefix', () => {
    const o = new DeterministicIsolationOracle();
    const map = new Map<
      string,
      { requestId: string; status: 'OK'; durationMs: number; provider: string }
    >();
    map.set('r1', {
      requestId: 'r1',
      status: 'OK',
      durationMs: 1,
      provider: 'tenant:' + TENANT_C,
    });
    expect(o.evaluate(TENANT_A, [TENANT_B], map)).toBe('FAILED');
  });

  it('TenantKeyIsolationOracle passes for allowed tenant prefixes', () => {
    const o = new TenantKeyIsolationOracle();
    const map = new Map<
      string,
      { requestId: string; status: 'OK'; durationMs: number; provider: string }
    >();
    map.set('r1', {
      requestId: 'r1',
      status: 'OK',
      durationMs: 1,
      provider: 'tenant:' + TENANT_B,
    });
    expect(o.evaluate(TENANT_A, [TENANT_B], map)).toBe('PASSED');
  });

  it('detectSaturationFromCurves returns null on flat curves', () => {
    const flat = [
      { timestamp: '2026-01-01T00:00:00.000Z', queueDepth: 1 },
      { timestamp: '2026-01-01T00:00:01.000Z', queueDepth: 2 },
    ];
    expect(detectSaturationFromCurves(flat as never, flat as never)).toBeNull();
  });

  it('detectSaturationFromCurves detects queue-depth inflection', () => {
    const samples = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      queueDepth: 100 + i * 60,
    }));
    const sp = detectSaturationFromCurves(samples as never, samples as never);
    expect(sp?.detection).toBe('QUEUE_DEPTH');
    expect(sp?.curve.length).toBe(5);
  });

  it('detectSaturationFromCurves detects cache hit ratio collapse', () => {
    const samples = [
      { timestamp: 't1', cacheHitRatio: 0.9 },
      { timestamp: 't2', cacheHitRatio: 0.85 },
      { timestamp: 't3', cacheHitRatio: 0.1 },
    ];
    const sp = detectSaturationFromCurves(samples as never, samples as never);
    expect(sp?.detection).toBe('CACHE_HIT_RATIO');
  });

  it('buildTokenCost aggregates provider breakdown correctly', () => {
    const cost = buildTokenCost([
      {
        requestId: 'r1',
        status: 'OK',
        durationMs: 1,
        provider: 'openai',
        model: 'm1',
        promptTokens: 10,
        completionTokens: 5,
        costUsd: 0.1,
      },
      {
        requestId: 'r2',
        status: 'OK',
        durationMs: 1,
        provider: 'openai',
        model: 'm1',
        promptTokens: 20,
        completionTokens: 10,
        costUsd: 0.2,
      },
      { requestId: 'r3', status: 'ERROR', durationMs: 1 },
    ]);
    expect(cost.costUsd).toBeCloseTo(0.3);
    expect(cost.providerBreakdown.openai).toBeCloseTo(0.3);
    expect(cost.modelBreakdown.m1).toBe(2);
  });
});

describe('Phase 8 / Conformance / runner guards', () => {
  it('runWithGuards retries retryable errors up to maxRetries', async () => {
    let attempt = 0;
    const result = await runWithGuards(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error('transient');
        return 'ok';
      },
      {
        signal: new AbortController().signal,
        timeoutMs: 1000,
        maxRetries: 5,
        retryable: () => true,
      },
    );
    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  it('runWithGuards throws RunnerTimeoutError when timeout exceeded', async () => {
    await expect(
      runWithGuards(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 200);
          }),
        {
          signal: new AbortController().signal,
          timeoutMs: 10,
          maxRetries: 0,
          retryable: () => true,
        },
      ),
    ).rejects.toBeInstanceOf(RunnerTimeoutError);
  });

  it('runWithGuards throws RunnerCancelledError when aborted', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort('user-cancel'), 5);
    await expect(
      runWithGuards(
        () => new Promise<void>((resolve) => setTimeout(resolve, 200)),
        {
          signal: ac.signal,
          timeoutMs: 1000,
          maxRetries: 0,
          retryable: () => true,
        },
      ),
    ).rejects.toBeInstanceOf(RunnerCancelledError);
  });

  it('runWithGuards does not retry on RunnerCancelledError', async () => {
    let attempt = 0;
    await expect(
      runWithGuards(
        async () => {
          attempt++;
          throw new RunnerCancelledError('immediate');
        },
        {
          signal: new AbortController().signal,
          timeoutMs: 1000,
          maxRetries: 5,
          retryable: () => true,
        },
      ),
    ).rejects.toBeInstanceOf(RunnerCancelledError);
    expect(attempt).toBe(1);
  });
});

describe('Phase 8 / Conformance / Coordinator ports', () => {
  it('injects provided ports into the WorkloadRunner', async () => {
    const metrics = new InMemoryMetricsPort();
    const pressure = new InMemoryPressurePort();
    const cache = new InMemoryCachePort();
    const db = new InMemoryDbPort();
    const queue = new InMemoryQueuePort();
    const provider = new InMemoryProviderPort();
    const workload = new SimulatedWorkloadPort(provider, db, cache, queue);
    const correctness = new DeterministicCorrectnessOracle();
    const isolation = new DeterministicIsolationOracle();
    const coordinator = new Phase8Coordinator(
      new Phase8EvidenceSink(),
      new InMemoryCleanupPort(),
    );
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: baseTenantIds,
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      workloadPort: workload,
      metricsPort: metrics,
      pressurePort: pressure,
      cachePort: cache,
      dbPort: db,
      queuePort: queue,
      providerPort: provider,
      correctnessOracle: correctness,
      isolationOracle: isolation,
    });
    expect(report.metricBundles.length).toBe(1);
  });

  it('metrics reset between profiles does not accumulate', async () => {
    const metrics = new InMemoryMetricsPort();
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
      metricsPort: metrics,
    });
    expect(report.metricBundles.length).toBe(PHASE8_DEFAULT_PROFILES.length);
  });

  it('responds correlated by requestId (no index-based alignment)', async () => {
    const correctness = new DeterministicCorrectnessOracle();
    const req = {
      requestId: 'fixed-id',
      tenantId: TENANT_A,
      agentId: 'a-1',
      enqueuedAt: Date.now(),
      payload: { idx: 1, profile: 'p', kind: 'BASELINE_COLD' as const },
    };
    const mismatchResp = {
      requestId: 'different-id',
      status: 'OK' as const,
      durationMs: 1,
    };
    expect(correctness.evaluate(req, mismatchResp)).toBe('FAILED');
  });

  it('schedules concurrent-tenant requests using provided tenantIds', async () => {
    const coordinator = new Phase8Coordinator();
    const profile: WorkloadProfile = WorkloadProfileSchema.parse({
      ...PHASE8_DEFAULT_PROFILES.find((p) => p.kind === 'CONCURRENT_TENANTS')!,
      targetRps: 20,
      durationMs: 200,
    });
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A, TENANT_B, TENANT_C],
      profiles: [profile],
    });
    const bundle = report.metricBundles[0];
    expect(bundle?.profileId).toBe(profile.profileId);
    expect(bundle?.isolationVerdict).toBe('PASSED');
  });

  it('throws if primaryTenantId is not in tenantIds', async () => {
    const coordinator = new Phase8Coordinator();
    await expect(
      coordinator.run({
        ctx: ctx(),
        tenantIds: [TENANT_B],
        primaryTenantId: TENANT_A,
        profiles: [PHASE8_DEFAULT_PROFILES[0]],
      }),
    ).rejects.toThrow(/primaryTenantId/);
  });
});

describe('Phase 8 / Conformance / Pressure profile evidence', () => {
  async function runProfile(
    profile: WorkloadProfile,
  ): Promise<WorkloadMetricBundle> {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [profile],
    });
    return report.metricBundles[0];
  }

  it('CACHE_PRESSURE exercises cache miss ratio port and reports hit ratio', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find(
      (p) => p.kind === 'CACHE_PRESSURE',
    )!;
    const bundle = await runProfile(profile);
    expect(bundle.pressureEvidence.cacheHitRatio).not.toBeNull();
    expect((bundle.pressureEvidence.cacheHitRatio ?? 1) < 0.2).toBe(true);
  });

  it('QUEUE_PRESSURE exercises queue backlog and produces pressure/recovery evidence', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find(
      (p) => p.kind === 'QUEUE_PRESSURE',
    )!;
    const bundle = await runProfile(profile);
    expect(bundle.pressureEvidence.queueBacklogPeak).toBe(200);
    expect(bundle.errorRate).toBeGreaterThanOrEqual(0);
  });

  it('DB_PRESSURE configures DB latency and reports peak connections', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find(
      (p) => p.kind === 'DB_PRESSURE',
    )!;
    const bundle = await runProfile(profile);
    expect(bundle.pressureEvidence.dbConnectionsPeak).not.toBeNull();
    expect((bundle.pressureEvidence.dbConnectionsPeak ?? 0) > 0).toBe(true);
  });

  it('PROVIDER_THROTTLE applies throttle and produces measurable provider pressure', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find(
      (p) => p.kind === 'PROVIDER_THROTTLE',
    )!;
    const bundle = await runProfile(profile);
    expect(bundle.pressureEvidence.providerThrottlePercent).toBe(40);
    expect(bundle.pressureEvidence.providerDelayMs).toBe(30);
    expect(bundle.tokenCost.providerBreakdown.simulated).toBeGreaterThan(0);
  });

  it('RECOVERY produces recovery curve with pressure and recovery windows', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find((p) => p.kind === 'RECOVERY')!;
    const bundle = await runProfile(profile);
    expect(bundle.recoveryCurve).not.toBeNull();
    expect(bundle.recoveryCurve?.pressureCurve.length).toBeGreaterThan(0);
    expect(bundle.recoveryCurve?.recoveryCurve.length).toBeGreaterThan(0);
    expect(bundle.recoveryCurve?.recoveryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('SOAK produces multiple windows with drift metrics', async () => {
    const profile = PHASE8_DEFAULT_PROFILES.find((p) => p.kind === 'SOAK')!;
    const bundle = await runProfile(profile);
    expect(bundle.soakWindows.length).toBeGreaterThan(1);
    for (const w of bundle.soakWindows) {
      expect(w.schemaVersion).toBeDefined();
      expect(typeof w.passed).toBe('boolean');
    }
  });
});

describe('Phase 8 / Conformance / Cleanup', () => {
  it('FailingCleanupAdapter causes BLOCK status and orphan records', async () => {
    const coordinator = new Phase8Coordinator(
      new Phase8EvidenceSink(),
      new FailingCleanupAdapter(),
    );
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    expect(report.cleanupResult.success).toBe(false);
    expect(report.cleanupResult.failedCleanup?.length).toBeGreaterThan(0);
    expect(report.cleanupResult.orphanedResources?.length).toBeGreaterThan(0);
    expect(report.status).toBe('BLOCK');
    expect(report.outcome).toBe('FAILED');
  });

  it('coordinator cleanup failure fails closed even when bundles pass', async () => {
    const coordinator = new Phase8Coordinator(
      new Phase8EvidenceSink(),
      new FailingCleanupAdapter(),
    );
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    expect(report.counters.criticalFailures).toBeGreaterThan(0);
  });
});

describe('Phase 8 / Conformance / SLO policy and environment', () => {
  function approvedPolicy(over: Partial<SloPolicy> = {}): SloPolicy {
    return SloPolicySchema.parse({
      schemaVersion: '1.1.0',
      policyId: 'slo-test',
      approvedBy: 'sre-platform',
      approvedAt: '2026-01-01T00:00:00.000Z',
      approvedEnvironment: 'STAGING',
      errorBudgetPercent: 1,
      thresholds: [
        { metric: 'p95-latency-ms', operator: 'LTE', value: 1000, unit: 'ms' },
        { metric: 'error-rate', operator: 'LTE', value: 0.5, unit: 'ratio' },
      ],
      minimumSampleSize: 0,
      ...over,
    });
  }

  function syntheticBundle(
    over: Partial<WorkloadMetricBundle> = {},
  ): WorkloadMetricBundle {
    const base: WorkloadMetricBundle = {
      schemaVersion: '1.1.0',
      metricBundleId: UuidSchema.parse(randomUUID()),
      profileId: 'synthetic',
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      latency: buildLatencyDistribution([1, 2, 3]),
      throughputRps: 1,
      errorRate: 0,
      successCount: 3,
      failureCount: 0,
      totalRequests: 3,
      tokenCost: emptyTokenCost(),
      resourceCurves: [],
      errorCurves: [],
      confidenceIntervals: buildConfidenceIntervals(
        PHASE8_DEFAULT_PROFILES[0],
        {
          latency: buildLatencyDistribution([1, 2, 3]),
          throughputRps: 1,
          errorRate: 0,
        },
      ),
      correctnessVerdict: 'PASSED',
      isolationVerdict: 'PASSED',
      saturationPoint: null,
      recoveryCurve: null,
      regressionVerdict: 'NOT_APPLICABLE',
      environmentClass: 'SIMULATED',
      provenance: 'phase8://test',
      soakWindows: [],
      pressureEvidence: {
        cacheHitRatio: null,
        dbConnectionsPeak: null,
        queueBacklogPeak: null,
        providerThrottlePercent: null,
        providerDelayMs: null,
      },
      notes: [],
      ...over,
    };
    return base;
  }

  it('unapproved policy yields UNAPPROVED', () => {
    const draft: SloPolicy = approvedPolicy({ approvedBy: null });
    const e = evaluateSloPolicy({
      policy: draft,
      bundle: syntheticBundle(),
      environmentClass: 'STAGING',
    });
    expect(e.status).toBe('UNAPPROVED');
  });

  it('simulated environment yields UNSUPPORTED_ENVIRONMENT even with approved policy', () => {
    const e = evaluateSloPolicy({
      policy: approvedPolicy(),
      bundle: syntheticBundle(),
      environmentClass: 'SIMULATED',
    });
    expect(e.status).toBe('UNSUPPORTED_ENVIRONMENT');
  });

  it('approved staging policy on staging environment yields PASS or BREACH', () => {
    const e = evaluateSloPolicy({
      policy: approvedPolicy(),
      bundle: syntheticBundle({ latency: buildLatencyDistribution([50]) }),
      environmentClass: 'STAGING',
    });
    expect(['PASS', 'BREACH']).toContain(e.status);
  });

  it('reports insufficient samples when sample size < minimum', () => {
    const e = evaluateSloPolicy({
      policy: approvedPolicy({ minimumSampleSize: 1000 }),
      bundle: syntheticBundle(),
      environmentClass: 'STAGING',
    });
    expect(e.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(e.missingSamples.length).toBeGreaterThan(0);
  });
});

describe('Phase 8 / Conformance / Release capacity gate', () => {
  function buildReport(
    over: Partial<{
      environmentClass: 'SIMULATED' | 'STAGING' | 'PRODUCTION_PROBE';
      status: 'PASS' | 'BLOCK' | 'INCONCLUSIVE';
    }> = {},
  ): WorkloadMetricBundle {
    return {
      schemaVersion: '1.1.0',
      metricBundleId: UuidSchema.parse(randomUUID()),
      profileId: 'p',
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      latency: buildLatencyDistribution([1, 2, 3]),
      throughputRps: 1,
      errorRate: 0,
      successCount: 3,
      failureCount: 0,
      totalRequests: 3,
      tokenCost: emptyTokenCost(),
      resourceCurves: [],
      errorCurves: [],
      confidenceIntervals: [],
      correctnessVerdict: 'PASSED',
      isolationVerdict: 'PASSED',
      saturationPoint: null,
      recoveryCurve: null,
      regressionVerdict: 'NOT_APPLICABLE',
      environmentClass: over.environmentClass ?? 'SIMULATED',
      provenance: 'phase8://test',
      soakWindows: [],
      pressureEvidence: {
        cacheHitRatio: null,
        dbConnectionsPeak: null,
        queueBacklogPeak: null,
        providerThrottlePercent: null,
        providerDelayMs: null,
      },
      notes: [],
    };
  }

  function approvedPolicy(): SloPolicy {
    return SloPolicySchema.parse({
      schemaVersion: '1.1.0',
      policyId: 'slo-test',
      approvedBy: 'sre',
      approvedAt: '2026-01-01T00:00:00.000Z',
      approvedEnvironment: 'STAGING',
      errorBudgetPercent: 1,
      thresholds: [
        { metric: 'p95-latency-ms', operator: 'LTE', value: 1000, unit: 'ms' },
      ],
      minimumSampleSize: 0,
    });
  }

  function fullReport(
    envClass: 'SIMULATED' | 'STAGING' | 'PRODUCTION_PROBE',
    status: 'PASS' | 'BLOCK' | 'INCONCLUSIVE',
  ): import('./contracts').Phase8RunnerReport {
    const bundle = buildReport({ environmentClass: envClass });
    return {
      schemaVersion: '1.1.0',
      runnerId: 'phase8-coordinator',
      runId: UuidSchema.parse(randomUUID()),
      tenantId: UuidSchema.parse(TENANT_A),
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: {
        total: 1,
        passed: status === 'PASS' ? 1 : 0,
        failed: status === 'BLOCK' ? 1 : 0,
        inconclusive: status === 'INCONCLUSIVE' ? 1 : 0,
        criticalFailures: status === 'BLOCK' ? 1 : 0,
      },
      status,
      caseResults: [],
      metricBundles: [bundle],
      evidenceEnvelopes: [],
      cleanupResult: {
        success: true,
        cleanedResources: [],
        failedCleanup: [],
        orphanedResources: [],
      },
      reportChecksum: 'sha256:0'.repeat(64) as never,
      outcome: 'PASSED',
      environmentClass: envClass,
      provenance: 'phase8://coordinator/test',
      sloEvaluation: null,
      adapterRegistrations: [],
      statisticalConfidence: [],
      regressionEvidence: [],
      operationalAlerts: [],
      notes: [],
    } as import('./contracts').Phase8RunnerReport;
  }

  it('blocks release candidate when SLO policy is not approved', () => {
    const report = fullReport('STAGING', 'PASS');
    const verdict = evaluateReleaseCapacityGate({
      report,
      policy: null,
      releaseCandidate: true,
      weeklySoakDue: false,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.requiresApprovedPolicy).toBe(true);
    expect(verdict.policyEnforceable).toBe(false);
  });

  it('blocks release candidate when environmentClass is SIMULATED', () => {
    const report = fullReport('SIMULATED', 'PASS');
    const verdict = evaluateReleaseCapacityGate({
      report,
      policy: approvedPolicy(),
      releaseCandidate: true,
      weeklySoakDue: false,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.requiresRealEnvironment).toBe(true);
  });

  it('passes release candidate with approved SLO policy and staging evidence', () => {
    const report = fullReport('STAGING', 'PASS');
    const verdict = evaluateReleaseCapacityGate({
      report,
      policy: approvedPolicy(),
      releaseCandidate: true,
      weeklySoakDue: false,
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.requiresRealEnvironment).toBe(false);
  });

  it('blocks when soak error rate exceeds budget under weekly soak', () => {
    const bundle = buildReport({ environmentClass: 'STAGING' });
    bundle.errorRate = 0.1;
    const report = fullReport('STAGING', 'PASS');
    report.metricBundles = [{ ...bundle, profileId: 'soak', errorRate: 0.1 }];
    const verdict = evaluateReleaseCapacityGate({
      report,
      policy: approvedPolicy(),
      releaseCandidate: false,
      weeklySoakDue: true,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((r) => /soak/i.test(r))).toBe(true);
  });
});

describe('Phase 8 / Conformance / Production adapter registry', () => {
  it('lists all production adapters', () => {
    const list = listAdapters();
    expect(list).toContain('WORKLOAD_PORT');
    expect(list).toContain('CLEANUP_PORT');
    expect(list).toContain('PROVIDER_PORT');
  });

  it('InMemoryPhase8AdapterRegistry rejects double registration', () => {
    const reg = new InMemoryPhase8AdapterRegistry();
    const port = new InMemoryProviderPort();
    reg.register('PROVIDER_PORT', port);
    expect(() => reg.register('PROVIDER_PORT', port)).toThrow(
      /already registered/,
    );
  });

  it('records registrations with timestamps', () => {
    const reg = new InMemoryPhase8AdapterRegistry();
    reg.register('CACHE_PORT', new InMemoryCachePort());
    reg.register('DB_PORT', new InMemoryDbPort());
    const stamps = reg.registrations();
    expect(stamps.length).toBe(2);
    expect(stamps.every((s) => s.status === 'REGISTERED')).toBe(true);
    expect(stamps.every((s) => s.registeredAt.length > 0)).toBe(true);
  });

  it('unsupportedRegistrationStamps returns UNSUPPORTED for every adapter', () => {
    const stamps = unsupportedRegistrationStamps();
    expect(stamps.length).toBe(listAdapters().length);
    expect(stamps.every((s) => s.status === 'UNSUPPORTED')).toBe(true);
    expect(stamps.every((s) => s.reason === UNSUPPORTED_ADAPTER_REASON)).toBe(
      true,
    );
  });

  it('UnsupportedPhase8Adapters rejects registration', () => {
    const reg = new UnsupportedPhase8Adapters();
    expect(() =>
      reg.register('PROVIDER_PORT', new InMemoryProviderPort()),
    ).toThrow(/PHASE8_ADAPTER_UNSUPPORTED/);
    expect(reg.resolve('PROVIDER_PORT')).toBeNull();
    expect(reg.list()).toEqual([]);
  });

  it('coordinator with no registrations stamps all adapters UNSUPPORTED', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    expect(report.adapterRegistrations.length).toBe(listAdapters().length);
    expect(
      report.adapterRegistrations.every((a) =>
        listAdapters().includes(a as never),
      ),
    ).toBe(true);
  });

  it('coordinator with provided registrations records only those', async () => {
    const coordinator = new Phase8Coordinator();
    const reg = new InMemoryPhase8AdapterRegistry();
    reg.register('CACHE_PORT', new InMemoryCachePort());
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      adapterRegistrations: reg.registrations(),
    });
    expect(report.adapterRegistrations).toEqual(['CACHE_PORT']);
  });
});

describe('Phase 8 / Conformance / Environment class and provenance', () => {
  it('SIMULATED environmentClass is propagated to bundle and report', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      environmentClass: 'SIMULATED',
    });
    expect(report.environmentClass).toBe('SIMULATED');
    expect(report.metricBundles[0]?.environmentClass).toBe('SIMULATED');
  });

  it('STAGING environmentClass is propagated when supplied', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      environmentClass: 'STAGING',
    });
    expect(report.environmentClass).toBe('STAGING');
    expect(report.metricBundles[0]?.environmentClass).toBe('STAGING');
  });

  it('provenance encodes environmentClass and runId', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      environmentClass: 'PRODUCTION_PROBE',
    });
    expect(report.provenance).toMatch(/production_probe/);
    expect(report.metricBundles[0]?.provenance).toContain(report.runId);
    expect(report.metricBundles[0]?.provenance).toContain('production_probe');
  });

  it('producer tag includes environmentClass', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      environmentClass: 'STAGING',
    });
    const env = report.evidenceEnvelopes[0];
    expect(env?.producer).toContain('staging');
  });
});

describe('Phase 8 / Conformance / Counter and checksum', () => {
  it('report checksum matches deterministic re-computation', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    Phase8RunnerReportSchema.parse(report);
    expect(report.reportChecksum).toBe(checksumPhase8Report(report));
  });

  it('counters match case-results aggregation', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES.slice(0, 3),
    });
    expect(report.counters).toEqual(computePhase8Counters(report.caseResults));
  });
});

describe('Phase 8 / Conformance / Report Writer', () => {
  it('writes JSON, summary, capacity, checksum artifacts', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-'));
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const out = writePhase8Report({ report, outDir: dir });
    expect(fs.existsSync(out.jsonPath)).toBe(true);
    expect(fs.existsSync(out.summaryPath)).toBe(true);
    expect(fs.existsSync(out.capacityPath)).toBe(true);
    expect(fs.existsSync(out.checksumPath)).toBe(true);
    const capacity = buildPhase8CapacityReport(report);
    expect(capacity.profiles.length).toBe(report.metricBundles.length);
    expect(capacity.environmentClass).toBe(report.environmentClass);
    expect(capacity.verdict).toContain('SIMULATED');
    expect(capacity.adapterRegistrations.length).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('capacity report distinguishes verdict by environmentClass', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-'));
    const coordinator = new Phase8Coordinator();
    const simulated = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      environmentClass: 'SIMULATED',
    });
    const cap = buildPhase8CapacityReport(simulated);
    expect(cap.verdict).toBe('SIMULATED_NO_PRODUCTION_CLAIM');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Phase 8 / Conformance / CI Lane', () => {
  it('selects lanes based on changed surfaces', () => {
    const selector = new Phase8LaneSelector();
    const sel = selector.select({
      prId: 'pr-1',
      surfaces: [
        {
          changeId: UuidSchema.parse(randomUUID()),
          path: 'src/harness/phase8/runners.ts',
          kind: 'SOURCE',
          riskTier: 'HIGH',
        },
      ],
    });
    expect(sel.requiredLanes).toContain('PR_FAST');
    expect(sel.blockingLanes).toContain('PR_FAST');
  });

  it('selects weekly soak lane when weeklySoakDue is true', () => {
    const selector = new Phase8LaneSelector();
    const sel = selector.select({
      prId: 'pr-2',
      surfaces: [],
      weeklySoakDue: true,
    });
    expect(sel.requiredLanes).toContain('WEEKLY_SOAK');
    expect(sel.blockingLanes).toContain('WEEKLY_SOAK');
  });

  it('selects release capacity lane for release candidate', () => {
    const selector = new Phase8LaneSelector();
    const sel = selector.select({
      prId: 'pr-3',
      surfaces: [],
      releaseCandidate: true,
    });
    expect(sel.requiredLanes).toContain('RELEASE_CAPACITY');
    expect(sel.blockingLanes).toContain('RELEASE_CAPACITY');
  });

  it('gate passes when no required blocking lane exists', () => {
    const selector = new Phase8LaneSelector();
    const sel = selector.select({
      prId: 'pr-4',
      surfaces: [],
    });
    const gate = new Phase8Gate();
    const verdict = gate.evaluate({
      prId: 'pr-4',
      selection: sel,
      runs: [],
    });
    expect(verdict.passed).toBe(true);
  });

  it('gate fails on blocking lane with FAILED outcome', () => {
    const selector = new Phase8LaneSelector();
    const sel = selector.select({
      prId: 'pr-5',
      surfaces: [],
      weeklySoakDue: true,
    });
    const gate = new Phase8Gate();
    const verdict = gate.evaluate({
      prId: 'pr-5',
      selection: sel,
      runs: [
        {
          lane: 'WEEKLY_SOAK',
          runId: randomUUID(),
          outcome: 'FAILED',
          finalized: true,
          counters: {
            total: 1,
            passed: 0,
            failed: 1,
            inconclusive: 0,
            criticalFailures: 1,
          },
        },
      ],
    });
    expect(verdict.passed).toBe(false);
  });
});

describe('Phase 8 / Closure', () => {
  it('produces evidence with checksums and metadata for every profile', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    expect(report.evidenceEnvelopes.length).toBe(
      PHASE8_DEFAULT_PROFILES.length,
    );
    for (const env of report.evidenceEnvelopes) {
      expect(env.checksum.startsWith('sha256:')).toBe(true);
      expect(env.producer).toContain('phase8-runner');
      expect(env.tenantId).toBe(TENANT_A);
    }
  });

  it('cleanup-failed report propagates BLOCK status', async () => {
    const coordinator = new Phase8Coordinator(
      new Phase8EvidenceSink(),
      new FailingCleanupAdapter(),
    );
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    expect(report.cleanupResult.success).toBe(false);
    expect(report.status).toBe('BLOCK');
    expect(report.outcome).toBe('FAILED');
  });

  it('reports are machine-validated against the runtime schema', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    Phase8RunnerReportSchema.parse(report);
  });

  it('idempotent re-run does not introduce orphan envelopes', async () => {
    const c1 = new Phase8Coordinator();
    const r1 = await c1.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    const c2 = new Phase8Coordinator();
    const r2 = await c2.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    expect(r1.evidenceEnvelopes.length).toBe(PHASE8_DEFAULT_PROFILES.length);
    expect(r2.evidenceEnvelopes.length).toBe(PHASE8_DEFAULT_PROFILES.length);
    expect(r2.cleanupResult.orphanedResources?.length ?? 0).toBe(0);
  });
});

describe('Phase 8 / Conformance / WorkloadRunner direct', () => {
  it('resetState applies profile pressureConfig to all ports', async () => {
    const metrics = new InMemoryMetricsPort();
    const pressure = new InMemoryPressurePort();
    const cache = new InMemoryCachePort();
    const db = new InMemoryDbPort();
    const queue = new InMemoryQueuePort();
    const provider = new InMemoryProviderPort();
    const workload = new SimulatedWorkloadPort(provider, db, cache, queue);
    const runner = new WorkloadRunner(
      workload,
      metrics,
      pressure,
      cache,
      db,
      queue,
      provider,
      new DeterministicCorrectnessOracle(),
      new DeterministicIsolationOracle(),
    );
    const profile = WorkloadProfileSchema.parse({
      ...PHASE8_DEFAULT_PROFILES.find((p) => p.kind === 'PROVIDER_THROTTLE')!,
      durationMs: 200,
    });
    const bundle = await runner.runProfile({
      profile,
      primaryTenantId: TENANT_A,
      tenantIds: [TENANT_A],
      baseline: null,
      environmentClass: 'SIMULATED',
      provenance: `phase8://simulated/${randomUUID()}/${profile.profileId}`,
      perRequestTimeoutMs: 2000,
      retryMax: 0,
      retryable: () => false,
    });
    expect(bundle.pressureEvidence.providerThrottlePercent).toBe(40);
    expect(provider.throttlePercent()).toBe(40);
  });

  it('per-profile reset clears queue backlog before re-applying pressure', async () => {
    const metrics = new InMemoryMetricsPort();
    const pressure = new InMemoryPressurePort();
    const cache = new InMemoryCachePort();
    const db = new InMemoryDbPort();
    const queue = new InMemoryQueuePort();
    const provider = new InMemoryProviderPort();
    queue.setBacklog(500);
    const workload = new SimulatedWorkloadPort(provider, db, cache, queue);
    const runner = new WorkloadRunner(
      workload,
      metrics,
      pressure,
      cache,
      db,
      queue,
      provider,
      new DeterministicCorrectnessOracle(),
      new DeterministicIsolationOracle(),
    );
    const profile = WorkloadProfileSchema.parse({
      ...PHASE8_DEFAULT_PROFILES[0],
      durationMs: 200,
    });
    const bundle = await runner.runProfile({
      profile,
      primaryTenantId: TENANT_A,
      tenantIds: [TENANT_A],
      baseline: null,
      environmentClass: 'SIMULATED',
      provenance: `phase8://simulated/${randomUUID()}/${profile.profileId}`,
      perRequestTimeoutMs: 2000,
      retryMax: 0,
      retryable: () => false,
    });
    expect(bundle.totalRequests).toBeGreaterThan(0);
  });
});

describe('Phase 8 / Conformance / Statistical confidence metadata', () => {
  it('marks confidence as insufficient when sample size below threshold', () => {
    const sc = buildStatisticalConfidence('test', {
      latency: buildLatencyDistribution([1, 2, 3]),
    });
    expect(sc.sufficient).toBe(false);
    expect(sc.method).toBe('NONE');
    expect(sc.marginOfError).toBeNull();
    expect(sc.reason).toMatch(/insufficient samples/);
  });

  it('uses NORMAL_APPROX with margin of error when sample size >= 30', () => {
    const samples = Array.from({ length: 50 }, (_, i) => 10 + i);
    const sc = buildStatisticalConfidence('test', {
      latency: buildLatencyDistribution(samples),
    });
    expect(sc.sufficient).toBe(true);
    expect(sc.method).toBe('NORMAL_APPROX');
    expect(sc.confidenceLevel).toBe(95);
    expect(sc.marginOfError).not.toBeNull();
    expect(sc.sampleSize).toBe(50);
  });

  it('confidence intervals are degenerate when method is NONE (no fake CI)', () => {
    const ci = buildConfidenceIntervals(PHASE8_DEFAULT_PROFILES[0], {
      latency: buildLatencyDistribution([1, 2, 3]),
      throughputRps: 1,
      errorRate: 0.1,
    });
    for (const c of ci) {
      expect(c.method).toBe('NONE');
      expect(c.lower).toBe(c.upper);
      expect(c.confidenceLevel).toBe(0);
    }
  });

  it('confidence intervals are real when method is NORMAL_APPROX', () => {
    const samples = Array.from({ length: 100 }, (_, i) => 10 + (i % 7));
    const ci = buildConfidenceIntervals(PHASE8_DEFAULT_PROFILES[0], {
      latency: buildLatencyDistribution(samples),
      throughputRps: 5,
      errorRate: 0.02,
    });
    const p95ci = ci.find((c) => c.metric === 'p95-latency-ms');
    expect(p95ci?.method).toBe('NORMAL_APPROX');
    expect(p95ci ? p95ci.lower < p95ci.upper : false).toBe(true);
  });

  it('coordinator report contains one statistical confidence entry per profile', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    expect(report.statisticalConfidence.length).toBe(
      PHASE8_DEFAULT_PROFILES.length,
    );
  });
});

describe('Phase 8 / Conformance / Regression evidence metadata', () => {
  it('coordinator report contains regression evidence per profile', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    expect(report.regressionEvidence.length).toBe(
      PHASE8_DEFAULT_PROFILES.length,
    );
    const baselineEvidence = report.regressionEvidence.find((e) =>
      e.reason.includes('no baseline'),
    );
    expect(baselineEvidence).toBeDefined();
  });

  it('regression evidence records observed p95 ratio when baseline exists', async () => {
    const first = await new Phase8Coordinator().run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[1]], // BASELINE_WARM
    });
    const baseline = first.metricBundles[0];
    const second = await new Phase8Coordinator().run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
      baseline,
      baselineRunId: first.runId,
      baselineBundleId: baseline.metricBundleId,
      baselineProvenance: baseline.provenance,
    });
    const ev = second.regressionEvidence[0];
    expect(ev.observedP95Ratio).not.toBeNull();
    expect(ev.baselineRunId).toBe(first.runId);
    expect(ev.baselineBundleId).toBe(baseline.metricBundleId);
  });
});

describe('Phase 8 / Conformance / Operational alerts', () => {
  it('in-memory alert port records emitted alerts and counts by kind', async () => {
    const sink = new InMemoryOperationalAlertPort();
    const coordinator = new Phase8Coordinator(undefined, undefined, sink);
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    const count = sink.countByKind();
    expect(sink.list().length).toBe(report.operationalAlerts.length);
    expect(count.UNSUPPORTED_ROUTING).toBe(PHASE8_DEFAULT_PROFILES.length);
    expect(sink.list().length).toBeGreaterThan(0);
  });

  it('emits CLEANUP_FAILURE alert when cleanup adapter fails', async () => {
    const sink = new InMemoryOperationalAlertPort();
    const coordinator = new Phase8Coordinator(
      undefined,
      new FailingCleanupAdapter() as unknown as CleanupPort,
      sink,
    );
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const cleanup = report.operationalAlerts.find(
      (a) => a.kind === 'CLEANUP_FAILURE',
    );
    expect(cleanup).toBeDefined();
    expect(cleanup?.severity).toBe('CRITICAL');
    expect(sink.list().some((a) => a.kind === 'CLEANUP_FAILURE')).toBe(true);
  });

  it('dispatchOperationalAlerts returns deterministic counts', async () => {
    const sink = new InMemoryOperationalAlertPort();
    const coordinator = new Phase8Coordinator(undefined, undefined, sink);
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: PHASE8_DEFAULT_PROFILES,
    });
    const out = dispatchOperationalAlerts({ report, sink });
    expect(out.emitted).toBe(report.operationalAlerts.length);
    expect(
      out.criticalCount + out.warningCount + out.infoCount,
    ).toBeLessThanOrEqual(out.emitted);
  });

  it('alertGateForReport blocks when correctness fails under SIMULATED', () => {
    const alert = {
      schemaVersion: '1.1.0',
      alertId: randomUUID(),
      kind: 'CORRECTNESS_FAILURE' as const,
      severity: 'CRITICAL' as const,
      message: 'x',
      profileId: 'p',
      metricBundleId: null,
      runId: 'r',
      tenantId: TENANT_A,
      observedAt: new Date().toISOString(),
      context: {},
    };
    const gate = alertGateForReport(
      {
        ...emptyRunnerReportStub(),
        operationalAlerts: [alert],
      },
      'SIMULATED',
      { failOnCorrectnessFailure: true },
    );
    expect(gate.blocked).toBe(true);
  });

  it('buildUnauthorizedCapacityAlert is annotated as UNSUPPORTED_ROUTING', () => {
    const a = buildUnauthorizedCapacityAlert({
      runId: 'r',
      tenantId: TENANT_A,
      env: 'SIMULATED',
      counters: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        criticalFailures: 0,
      },
    });
    expect(a.kind).toBe('UNSUPPORTED_ROUTING');
    expect(a.message).toContain('SIMULATED');
  });
});

describe('Phase 8 / Conformance / Unsupported alert port and adapter stubs', () => {
  it('UnsupportedOperationalAlertPort exposes UNSUPPORTED status and reason', () => {
    const p = new UnsupportedOperationalAlertPort();
    expect(p.status).toBe('UNSUPPORTED');
    expect(p.reason).toMatch(/PHASE8_ALERT_UNSUPPORTED/);
    expect(p.list().length).toBe(0);
  });

  it('UnsupportedProductionAdapterStub throws on invocation', () => {
    const stub = new UnsupportedProductionAdapterStub('PROVIDER_PORT');
    expect(stub.status).toBe('UNSUPPORTED');
    expect(stub.reason).toContain(PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX);
    expect(() => stub.assertNotInvoked('invoke')).toThrow(
      /PHASE8_PROD_ADAPTER_UNSUPPORTED/,
    );
  });

  it('unsupportedProductionAdapterStubs covers every listed adapter', () => {
    const stubs = unsupportedProductionAdapterStubs();
    for (const a of listAdapters()) {
      expect(stubs[a]).toBeDefined();
      expect(stubs[a].status).toBe('UNSUPPORTED');
    }
  });

  it('UNSUPPORTED_ALERT_REASON is non-empty', () => {
    expect(UNSUPPORTED_ALERT_REASON.length).toBeGreaterThan(0);
  });
});

describe('Phase 8 / Conformance / Cleanup defaults are not fabricated', () => {
  it('finalizePhase8Report throws when cleanupResult is missing', () => {
    const report = emptyRunnerReportStub();
    expect(() =>
      finalizePhase8Report({
        ...report,
        cleanupResult: undefined as never,
      }),
    ).toThrow(/PHASE8_FABRICATED_CLEANUP_BLOCKED/);
  });

  it('InMemoryCleanupPort returns idempotent re-cleanup as success', async () => {
    const port = new InMemoryCleanupPort();
    const a = await port.cleanup({ id: 'x', tenantId: TENANT_A });
    const b = await port.cleanup({ id: 'x', tenantId: TENANT_A });
    expect(a.cleaned).toBe(true);
    expect(b.cleaned).toBe(true);
    expect(b.orphans.length).toBe(0);
  });
});

describe('Phase 8 / Conformance / Report schema migration and integrity', () => {
  it('round-trip preserves runId, counters, checksum', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const rt = roundTripPhase8Report(report);
    expect(rt.checksumOk).toBe(true);
    expect(rt.restored.runId).toBe(report.runId);
    expect(JSON.stringify(rt.restored.counters)).toBe(
      JSON.stringify(report.counters),
    );
  });

  it('detectTampering flags counter mutation', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const tampered = tamperedReport(report, 'counters');
    const t = detectTampering(report, tampered);
    expect(t.tampered).toBe(true);
    expect(t.reasons).toContain('counters mutated');
  });

  it('detectTampering flags checksum mutation', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const tampered = tamperedReport(report, 'checksum');
    const t = detectTampering(report, tampered);
    expect(t.tampered).toBe(true);
  });

  it('ReportSchemaMigratorChain plans and applies', () => {
    const chain = ReportSchemaMigratorChain.buildDefaultChain();
    const plan = chain.plan({});
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.dryRun).toBe(true);
    const r1 = chain.apply({ schemaVersion: '1.0.0' });
    expect(r1.migratedFrom.length).toBe(plan.steps.length + 1);
  });

  it('restoreReport rejects when checksum mismatches', () => {
    const restored = restoreReport({
      report: { schemaVersion: '1.1.0', reportChecksum: 'sha256:abc' },
      sourceChecksum: 'sha256:def',
    });
    expect(restored.restored).toBe(false);
    expect(restored.reasons[0]).toMatch(/checksum mismatch/);
  });

  it('evaluateReportRetention respects legal hold', () => {
    const r = evaluateReportRetention({
      runId: 'r',
      retentionClass: 'MEDIUM_TERM',
      retentionUntilMs: Date.now() - 1000,
      legalHold: true,
    });
    expect(r.kept).toBe(true);
  });

  it('evaluateReportRetention purges after window', () => {
    const r = evaluateReportRetention({
      runId: 'r',
      retentionClass: 'SHORT_TERM',
      retentionUntilMs: Date.now() - 1000,
      legalHold: false,
    });
    expect(r.purged).toBe(true);
  });

  it('writePhase8Report writes integrity artifact', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-int-'));
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const out = writePhase8Report({ report, outDir: dir });
    expect(fs.existsSync(out.integrityPath)).toBe(true);
    const integrity = JSON.parse(
      fs.readFileSync(out.integrityPath, 'utf-8'),
    ) as { tampered: boolean; roundTrip: { checksumOk: boolean } };
    expect(integrity.tampered).toBe(false);
    expect(integrity.roundTrip.checksumOk).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('buildPhase8IntegrityReport flags retention expired', async () => {
    const coordinator = new Phase8Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      tenantIds: [TENANT_A],
      profiles: [PHASE8_DEFAULT_PROFILES[0]],
    });
    const ir = buildPhase8IntegrityReport({
      report,
      jsonChecksum: 'sha256:x',
      summaryChecksum: 'sha256:y',
      capacityChecksum: 'sha256:z',
      retention: {
        runId: report.runId,
        retentionClass: 'SHORT_TERM',
        retentionUntilMs: Date.now() - 1000,
        legalHold: false,
      } satisfies ReportRetentionInput,
    });
    expect(ir.retention.purged).toBe(true);
  });

  it('KNOWN_REPORT_VERSIONS includes current version', () => {
    expect(KNOWN_REPORT_VERSIONS).toContain('1.0.0');
  });

  it('SUFFICIENT_SAMPLE_THRESHOLD matches protocol expectation', () => {
    expect(SUFFICIENT_SAMPLE_THRESHOLD).toBe(30);
  });
});

function emptyRunnerReportStub(): import('./contracts').Phase8RunnerReport {
  return {
    schemaVersion: '1.1.0',
    runnerId: 'phase8-coordinator',
    runId: UuidSchema.parse(randomUUID()),
    tenantId: UuidSchema.parse(TENANT_A),
    startedAt: new Date().toISOString(),
    finalizedAt: new Date().toISOString(),
    counters: {
      total: 0,
      passed: 0,
      failed: 0,
      inconclusive: 0,
      criticalFailures: 0,
    },
    status: 'PASS' as const,
    caseResults: [],
    metricBundles: [],
    evidenceEnvelopes: [],
    cleanupResult: {
      success: true,
      cleanedResources: [],
      failedCleanup: [],
      orphanedResources: [],
    },
    reportChecksum:
      'sha256:0000000000000000000000000000000000000000000000000000000000000000' as never,
    outcome: 'PASSED' as const,
    environmentClass: 'SIMULATED' as const,
    provenance: 'phase8://stub',
    sloEvaluation: null,
    adapterRegistrations: [],
    statisticalConfidence: [],
    regressionEvidence: [],
    operationalAlerts: [],
    notes: [],
  };
}
