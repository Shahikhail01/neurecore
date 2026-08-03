import { createHash, randomUUID } from 'crypto';
import { type AuthorizationContext, type CleanupResult } from '../contracts';
import type { EvidenceEnvelope } from '../contracts';
import {
  PHASE8_VERSION,
  PHASE8_DEFAULT_PROFILES,
  WorkloadProfileSchema,
  type Phase8RunnerReport,
  type Phase8Counters,
  type WorkloadCaseResult,
  type WorkloadMetricBundle,
  type WorkloadProfile,
  type WorkloadKind,
  type SoakWindow,
  type SloPolicy,
  type SloEvaluation,
  type SloEvaluationStatus,
  type SloThresholdResult,
  type Phase8EnvironmentClass,
  type AdapterRegistration,
  type Phase8ProductionAdapter,
  type OperationalAlert,
} from './contracts';
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
  DeterministicCorrectnessOracle,
  DeterministicIsolationOracle,
  Phase8EvidenceSink,
  SimulatedWorkloadPort,
  buildLatencyDistribution,
  buildConfidenceIntervals,
  buildStatisticalConfidence,
  buildTokenCost,
  detectSaturationFromCurves,
  defaultRecovery,
  determineRegression,
  unsupportedRegistrationStamps,
  InMemoryOperationalAlertPort,
  UnsupportedOperationalAlertPort as _UnsupportedOperationalAlertPort,
  type CleanupPort,
  type CorrectnessOracle,
  type IsolationOracle,
  type MetricsPort,
  type PressurePort,
  type CachePort,
  type DbPort,
  type QueuePort,
  type ProviderPort,
  type WorkloadPort,
  type WorkloadRequest,
  type WorkloadResponse,
  type WorkloadPhase,
  type OperationalAlertPort,
} from './ports';

export interface Phase8CoordinatorInput {
  ctx: AuthorizationContext;
  tenantIds: readonly string[];
  primaryTenantId?: string;
  profiles?: WorkloadProfile[];
  baseline?: WorkloadMetricBundle | null;
  workloadPort?: WorkloadPort;
  metricsPort?: MetricsPort;
  pressurePort?: PressurePort;
  cachePort?: CachePort;
  dbPort?: DbPort;
  queuePort?: QueuePort;
  providerPort?: ProviderPort;
  correctnessOracle?: CorrectnessOracle;
  isolationOracle?: IsolationOracle;
  cleanupPort?: CleanupPort;
  alertPort?: OperationalAlertPort;
  perRequestTimeoutMs?: number;
  retryMax?: number;
  retryable?: (err: unknown) => boolean;
  environmentClass?: Phase8EnvironmentClass;
  sloPolicy?: SloPolicy | null;
  adapterRegistrations?: readonly AdapterRegistration[];
  runId?: string;
  baselineRunId?: string | null;
  baselineBundleId?: string | null;
  baselineProvenance?: string | null;
}

export interface Phase8RunOptions {
  signal?: AbortSignal;
}

export const PHASE8_RUNNER_VERSION = PHASE8_VERSION;

export class RunnerCancelledError extends Error {
  constructor(public readonly reason: string) {
    super(`runner cancelled: ${reason}`);
    this.name = 'RunnerCancelledError';
  }
}

export class RunnerTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`runner timeout: ${timeoutMs}ms`);
    this.name = 'RunnerTimeoutError';
  }
}

export interface PerRequestRunOptions {
  signal: AbortSignal;
  timeoutMs: number;
  maxRetries: number;
  retryable: (err: unknown) => boolean;
}

export async function runWithGuards<T>(
  fn: () => Promise<T>,
  opts: PerRequestRunOptions,
): Promise<T> {
  const maxRetries = Math.max(0, opts.maxRetries);
  let attempt = 0;
  while (true) {
    if (opts.signal.aborted) {
      throw new RunnerCancelledError(
        typeof opts.signal.reason === 'string' ? opts.signal.reason : 'aborted',
      );
    }
    let onAbort: (() => void) | undefined;
    const exec = (async () => {
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new RunnerTimeoutError(opts.timeoutMs)),
          opts.timeoutMs,
        );
        onAbort = (): void => {
          clearTimeout(timer);
          reject(new RunnerCancelledError('aborted'));
        };
        opts.signal.addEventListener('abort', onAbort, { once: true });
        fn()
          .then((v) => {
            clearTimeout(timer);
            if (onAbort) opts.signal.removeEventListener('abort', onAbort);
            resolve(v);
          })
          .catch((e: unknown) => {
            clearTimeout(timer);
            if (onAbort) opts.signal.removeEventListener('abort', onAbort);
            reject(e instanceof Error ? e : new Error(String(e)));
          });
      });
    })();
    try {
      return await exec;
    } catch (err) {
      if (err instanceof RunnerCancelledError) throw err;
      if (err instanceof RunnerTimeoutError) {
        if (attempt >= maxRetries) throw err;
        attempt++;
        continue;
      }
      if (attempt >= maxRetries || !opts.retryable(err)) throw err;
      attempt++;
    }
  }
}

export class WorkloadRunner {
  constructor(
    private readonly workload: WorkloadPort,
    private readonly metrics: MetricsPort,
    private readonly pressure: PressurePort,
    private readonly cache: CachePort,
    private readonly db: DbPort,
    private readonly queue: QueuePort,
    private readonly provider: ProviderPort,
    private readonly correctness: CorrectnessOracle,
    private readonly isolation: IsolationOracle,
  ) {}

  async runProfile(input: {
    profile: WorkloadProfile;
    primaryTenantId: string;
    tenantIds: readonly string[];
    baseline: WorkloadMetricBundle | null;
    environmentClass: Phase8EnvironmentClass;
    provenance: string;
    signal?: AbortSignal;
    perRequestTimeoutMs: number;
    retryMax: number;
    retryable: (err: unknown) => boolean;
  }): Promise<WorkloadMetricBundle> {
    const startedAt = new Date();
    this.resetState(input.profile);
    this.pressure.begin(input.profile);
    this.pressure.tick(startedAt.getTime());

    const requests = this.scheduleRequests(input);
    const responseMap = new Map<string, WorkloadResponse>();
    const correlationIds = new Set<string>();
    const ac = new AbortController();
    let onParentAbort: (() => void) | undefined;
    if (input.signal) {
      onParentAbort = (): void => ac.abort(input.signal!.reason);
      input.signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const concurrencyLimit = input.profile.concurrency;
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < requests.length) {
        if (ac.signal.aborted) break;
        const idx = nextIndex++;
        const req = requests[idx];
        correlationIds.add(req.requestId);
        this.pressure.setQueueDepth(this.queue.depth());
        this.pressure.setInflight(this.queue.depth());
        const enqueueAt = req.enqueuedAt;
        const t0 = Date.now();
        try {
          await this.queue.enqueue(req);
        } catch {
          responseMap.set(req.requestId, {
            requestId: req.requestId,
            status: 'ERROR',
            durationMs: 0,
            failureReason: 'enqueue-failed',
          });
          this.metrics.record(0, 'ERROR');
          continue;
        }
        const resp = await runWithGuards(
          () => this.workload.execute(req, ac.signal),
          {
            signal: ac.signal,
            timeoutMs: input.perRequestTimeoutMs,
            maxRetries: input.retryMax,
            retryable: input.retryable,
          },
        );
        const durationMs = Date.now() - t0;
        resp.queueWaitMs = Math.max(0, t0 - enqueueAt);
        resp.attempts = resp.attempts ?? 1;
        this.metrics.record(durationMs, resp.status);
        responseMap.set(req.requestId, resp);
      }
    };

    const workerCount = Math.min(concurrencyLimit, requests.length || 1);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);

    this.pressure.tick(Date.now());
    const snap = this.metrics.snapshot();
    const latencies = snap.latencies.filter((v) => v > 0);
    const latency = buildLatencyDistribution(latencies);
    const total =
      snap.successCount +
      snap.failureCount +
      snap.timeoutCount +
      snap.cancelledCount;
    const errorRate =
      total === 0 ? 0 : (snap.failureCount + snap.timeoutCount) / total;
    const elapsedMs = Math.max(1, snap.finalizedAt - snap.startedAt);
    const throughputRps = (total / elapsedMs) * 1000;

    const isolationVerdict = this.isolation.evaluate(
      input.primaryTenantId,
      input.tenantIds.filter((t) => t !== input.primaryTenantId),
      responseMap,
    );
    let correctnessVerdict: WorkloadMetricBundle['correctnessVerdict'] =
      'PASSED';
    for (const [requestId, resp] of responseMap) {
      const req = requests.find((r) => r.requestId === requestId);
      if (!req) continue;
      const v = this.correctness.evaluate(req, resp);
      if (v === 'FAILED') {
        correctnessVerdict = 'FAILED';
        break;
      }
      if (v === 'INCONCLUSIVE' && correctnessVerdict === 'PASSED') {
        correctnessVerdict = 'INCONCLUSIVE';
      }
    }

    const resourceCurves = [...this.pressure.listSamples()];
    const errorCurves = resourceCurves.map((s) => ({
      ...s,
      inflight: snap.failureCount + snap.timeoutCount,
    }));
    const saturation = detectSaturationFromCurves(resourceCurves, errorCurves);

    let recoveryCurve: WorkloadMetricBundle['recoveryCurve'] = null;
    if (input.profile.kind === 'RECOVERY') {
      const half = Math.floor(resourceCurves.length / 2);
      recoveryCurve = defaultRecovery(
        startedAt.toISOString(),
        new Date().toISOString(),
        latency.p95Ms,
        errorRate,
        resourceCurves.slice(0, half),
        resourceCurves.slice(half),
      );
    }

    const tokenCost = buildTokenCost([...responseMap.values()]);
    const finalizedAt = new Date().toISOString();
    const regression = determineRegression(input.baseline, {
      latency,
      throughputRps,
      errorRate,
    } as unknown as WorkloadMetricBundle);
    const regressionVerdict: WorkloadMetricBundle['regressionVerdict'] =
      input.baseline ? regression.verdict : 'NOT_APPLICABLE';

    const soakWindows =
      input.profile.kind === 'SOAK'
        ? buildSoakWindows(input.profile, latencies, responseMap, startedAt)
        : [];

    const pressureEvidence = collectPressureEvidence(input.profile);

    const partial: Omit<
      WorkloadMetricBundle,
      | 'confidenceIntervals'
      | 'metricBundleId'
      | 'resourceCurves'
      | 'errorCurves'
    > = {
      schemaVersion: PHASE8_VERSION,
      profileId: input.profile.profileId,
      startedAt: startedAt.toISOString(),
      finalizedAt,
      latency,
      throughputRps,
      errorRate,
      successCount: snap.successCount,
      failureCount: snap.failureCount + snap.timeoutCount,
      totalRequests: total,
      tokenCost,
      correctnessVerdict,
      isolationVerdict,
      saturationPoint: saturation,
      recoveryCurve,
      regressionVerdict,
      environmentClass: input.environmentClass,
      provenance: input.provenance,
      soakWindows,
      pressureEvidence,
      notes: regression.reasons,
    };

    const bundle: WorkloadMetricBundle = {
      ...partial,
      metricBundleId: randomUUID(),
      confidenceIntervals: buildConfidenceIntervals(input.profile, partial),
      resourceCurves,
      errorCurves,
    };
    return bundle;
  }

  private resetState(profile: WorkloadProfile): void {
    this.metrics.reset();
    this.pressure.reset();
    this.cache.reset();
    this.db.reset();
    this.queue.reset();
    this.provider.clear();
    const pressure = profile.pressureConfig;
    if (pressure) {
      if (pressure.cacheMissRatio !== undefined) {
        this.cache.setMissRatio(pressure.cacheMissRatio);
      }
      if (pressure.dbP99Ms !== undefined) {
        this.db.setLatencyMs(
          Math.max(1, pressure.dbP99Ms / 5),
          pressure.dbP99Ms,
        );
      }
      if (pressure.queueBacklog !== undefined) {
        this.queue.setBacklog(pressure.queueBacklog);
      }
      if (
        pressure.providerThrottlePercent !== undefined ||
        pressure.providerDelayMs !== undefined
      ) {
        this.provider.setThrottle(
          pressure.providerThrottlePercent ?? 0,
          pressure.providerDelayMs ?? 0,
        );
      }
    }
  }

  private scheduleRequests(input: {
    profile: WorkloadProfile;
    primaryTenantId: string;
    tenantIds: readonly string[];
  }): WorkloadRequest[] {
    const profile = input.profile;
    const tenantIds =
      input.tenantIds.length > 0 ? input.tenantIds : [input.primaryTenantId];
    const total = Math.max(
      1,
      Math.floor((profile.targetRps * profile.durationMs) / 1000),
    );
    const list: WorkloadRequest[] = [];
    const step = Math.max(1, Math.floor(1000 / Math.max(profile.targetRps, 1)));
    for (let i = 0; i < total; i++) {
      const tenantId =
        profile.kind === 'CONCURRENT_TENANTS' && tenantIds.length > 1
          ? tenantIds[i % tenantIds.length]
          : input.primaryTenantId;
      list.push({
        requestId: randomUUID(),
        tenantId,
        agentId: `agent-${i % profile.agentCount}`,
        enqueuedAt: Date.now() + i * step,
        payload: {
          idx: i,
          profile: profile.profileId,
          kind: profile.kind,
          tenantId,
          phase: 'STEADY' as WorkloadPhase,
        },
      });
    }
    return list;
  }
}

function collectPressureEvidence(
  profile: WorkloadProfile,
): WorkloadMetricBundle['pressureEvidence'] {
  const pressure = profile.pressureConfig ?? {};
  return {
    cacheHitRatio:
      pressure.cacheMissRatio !== undefined
        ? Math.max(0, 1 - pressure.cacheMissRatio)
        : null,
    dbConnectionsPeak:
      pressure.dbP99Ms !== undefined
        ? Math.max(1, Math.ceil(pressure.dbP99Ms / 50))
        : null,
    queueBacklogPeak:
      pressure.queueBacklog !== undefined ? pressure.queueBacklog : null,
    providerThrottlePercent:
      pressure.providerThrottlePercent !== undefined
        ? pressure.providerThrottlePercent
        : null,
    providerDelayMs:
      pressure.providerDelayMs !== undefined ? pressure.providerDelayMs : null,
  };
}

function buildSoakWindows(
  profile: WorkloadProfile,
  latencies: readonly number[],
  responses: ReadonlyMap<string, WorkloadResponse>,
  startedAt: Date,
): SoakWindow[] {
  const windows = profile.windows ?? 5;
  if (latencies.length === 0 || windows <= 1) return [];
  const perWindow = Math.max(1, Math.floor(latencies.length / windows));
  const buckets: Array<{ latencies: number[]; errors: number; total: number }> =
    [];
  for (let w = 0; w < windows; w++) {
    buckets.push({ latencies: [], errors: 0, total: 0 });
  }
  let i = 0;
  for (const [requestId] of responses) {
    const w = Math.min(windows - 1, Math.floor(i / perWindow));
    buckets[w].total++;
    if (latencies[i] !== undefined) buckets[w].latencies.push(latencies[i]);
    void requestId;
    i++;
  }
  const baselineLatency = buckets[0]?.latencies ?? [];
  const baselineErrorRate =
    buckets[0] && buckets[0].total > 0
      ? buckets[0].errors / buckets[0].total
      : 0;
  const baselineP95 = buildLatencyDistribution(baselineLatency).p95Ms;
  return buckets.map((b, idx) => {
    const dist = buildLatencyDistribution(b.latencies);
    const err = b.total > 0 ? b.errors / b.total : 0;
    const driftP95 = dist.p95Ms - baselineP95;
    const driftErr = err - baselineErrorRate;
    const passed =
      Math.abs(driftP95) <= baselineP95 * 0.5 + 1 && Math.abs(driftErr) <= 0.1;
    return {
      schemaVersion: PHASE8_VERSION,
      windowIndex: idx,
      startedAt: new Date(
        startedAt.getTime() + idx * (profile.durationMs / windows),
      ).toISOString(),
      finalizedAt: new Date(
        startedAt.getTime() + (idx + 1) * (profile.durationMs / windows),
      ).toISOString(),
      sampleSize: b.latencies.length,
      p95Ms: dist.p95Ms,
      errorRate: err,
      driftP95Ms: driftP95,
      driftErrorRate: driftErr,
      passed,
    };
  });
}

export function buildWorkloadRunner(): WorkloadRunner {
  return new WorkloadRunner(
    new SimulatedWorkloadPort(),
    new InMemoryMetricsPort(),
    new InMemoryPressurePort(),
    new InMemoryCachePort(),
    new InMemoryDbPort(),
    new InMemoryQueuePort(),
    new InMemoryProviderPort(),
    new DeterministicCorrectnessOracle(),
    new DeterministicIsolationOracle(),
  );
}

export function computePhase8Counters(
  results: WorkloadCaseResult[],
): Phase8Counters {
  let passed = 0;
  let failed = 0;
  let inconclusive = 0;
  let criticalFailures = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
      continue;
    }
    if (r.observed === 'INCONCLUSIVE') inconclusive++;
    else failed++;
    if (r.criticalFailure) criticalFailures++;
  }
  return {
    total: results.length,
    passed,
    failed,
    inconclusive,
    criticalFailures,
  };
}

export function checksumPhase8Report(
  report: Pick<
    Phase8RunnerReport,
    'counters' | 'caseResults' | 'status' | 'metricBundles'
  >,
): string {
  const payload = JSON.stringify({
    counters: report.counters,
    caseResults: report.caseResults,
    status: report.status,
    metricBundleIds: report.metricBundles.map((b) => b.metricBundleId),
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

export function finalizePhase8Report(
  draft: Omit<
    Phase8RunnerReport,
    'reportChecksum' | 'outcome' | 'status' | 'cleanupResult'
  > & {
    cleanupResult: CleanupResult;
  },
): Phase8RunnerReport {
  if (!draft.cleanupResult) {
    throw new Error(
      'PHASE8_FABRICATED_CLEANUP_BLOCKED: finalizePhase8Report requires an explicit cleanupResult; no default success may be inferred.',
    );
  }
  const cleanupResult = draft.cleanupResult;
  const cleanupCritical =
    cleanupResult.failedCleanup?.length ||
    cleanupResult.orphanedResources?.length
      ? 1
      : 0;
  const counters: Phase8Counters = {
    ...draft.counters,
    criticalFailures: draft.counters.criticalFailures + cleanupCritical,
  };
  const status: Phase8RunnerReport['status'] =
    counters.criticalFailures > 0
      ? 'BLOCK'
      : draft.counters.failed > 0
        ? 'INCONCLUSIVE'
        : 'PASS';
  const outcome: Phase8RunnerReport['outcome'] =
    counters.criticalFailures > 0
      ? 'FAILED'
      : draft.counters.failed > 0
        ? 'BLOCKED'
        : 'PASSED';
  const checksum = checksumPhase8Report({ ...draft, counters, status });
  return {
    ...draft,
    counters,
    cleanupResult,
    status,
    outcome,
    reportChecksum: checksum,
  };
}

export function isSloPolicyEnforceable(
  policy: SloPolicy | null | undefined,
): boolean {
  if (!policy) return false;
  return (
    policy.approvedBy !== null &&
    policy.approvedAt !== null &&
    policy.approvedEnvironment !== null &&
    policy.thresholds.length > 0
  );
}

export function evaluateSloPolicy(input: {
  policy: SloPolicy | null | undefined;
  bundle: WorkloadMetricBundle;
  environmentClass: Phase8EnvironmentClass;
}): SloEvaluation {
  const reasons: string[] = [];
  const missingSamples: string[] = [];
  if (!input.policy) {
    return {
      schemaVersion: '1.0.0',
      policyId: 'none',
      status: 'UNAPPROVED',
      errorBudgetConsumedPercent: null,
      errorBudgetRemainingPercent: null,
      thresholdResults: [],
      missingSamples,
      reasons: ['no SLO policy supplied'],
    };
  }
  const policy = input.policy;
  const isRealEnv =
    input.environmentClass === 'STAGING' ||
    input.environmentClass === 'PRODUCTION_PROBE' ||
    input.environmentClass === 'PRODUCTION';
  const isApproved = isSloPolicyEnforceable(policy);
  if (!isApproved) {
    return {
      schemaVersion: '1.0.0',
      policyId: policy.policyId,
      status: 'UNAPPROVED',
      errorBudgetConsumedPercent: null,
      errorBudgetRemainingPercent: null,
      thresholdResults: [],
      missingSamples,
      reasons: ['SLO policy is not approved'],
    };
  }
  if (!isRealEnv) {
    return {
      schemaVersion: '1.0.0',
      policyId: policy.policyId,
      status: 'UNSUPPORTED_ENVIRONMENT',
      errorBudgetConsumedPercent: null,
      errorBudgetRemainingPercent: null,
      thresholdResults: [],
      missingSamples,
      reasons: [
        `environmentClass=${input.environmentClass} does not satisfy approvedEnvironment=${policy.approvedEnvironment}`,
      ],
    };
  }
  const thresholdResults: SloThresholdResult[] = [];
  let breach = false;
  for (const threshold of policy.thresholds) {
    const observed = readSloMetric(input.bundle, threshold.metric);
    if (observed === null) {
      missingSamples.push(threshold.metric);
      continue;
    }
    if (input.bundle.latency.sampleSize < policy.minimumSampleSize) {
      missingSamples.push(threshold.metric);
      continue;
    }
    const passed = compareSlo(threshold.operator, observed, threshold.value);
    thresholdResults.push({
      metric: threshold.metric,
      observed,
      threshold,
      passed,
      sampleSize: input.bundle.latency.sampleSize,
    });
    if (!passed) breach = true;
  }
  const errorRate = input.bundle.errorRate;
  const consumed = Math.min(
    100,
    Math.max(
      0,
      (errorRate / Math.max(0.0001, policy.errorBudgetPercent / 100)) * 100,
    ),
  );
  if (missingSamples.length > 0) {
    reasons.push(`insufficient samples for: ${missingSamples.join(', ')}`);
  }
  if (thresholdResults.length === 0 && missingSamples.length > 0) {
    return {
      schemaVersion: '1.0.0',
      policyId: policy.policyId,
      status: 'INSUFFICIENT_EVIDENCE',
      errorBudgetConsumedPercent: consumed,
      errorBudgetRemainingPercent: Math.max(0, 100 - consumed),
      thresholdResults,
      missingSamples,
      reasons,
    };
  }
  const status: SloEvaluationStatus = breach ? 'BREACH' : 'PASS';
  return {
    schemaVersion: '1.0.0',
    policyId: policy.policyId,
    status,
    errorBudgetConsumedPercent: consumed,
    errorBudgetRemainingPercent: Math.max(0, 100 - consumed),
    thresholdResults,
    missingSamples,
    reasons,
  };
}

function readSloMetric(
  bundle: WorkloadMetricBundle,
  metric: string,
): number | null {
  switch (metric) {
    case 'p95-latency-ms':
      return bundle.latency.p95Ms;
    case 'p99-latency-ms':
      return bundle.latency.p99Ms;
    case 'error-rate':
      return bundle.errorRate;
    case 'throughput-rps':
      return bundle.throughputRps;
    case 'cost-usd':
      return bundle.tokenCost.costUsd;
    default:
      return null;
  }
}

function compareSlo(
  op: 'LTE' | 'GTE' | 'LT' | 'GT',
  observed: number,
  threshold: number,
): boolean {
  switch (op) {
    case 'LTE':
      return observed <= threshold;
    case 'LT':
      return observed < threshold;
    case 'GTE':
      return observed >= threshold;
    case 'GT':
      return observed > threshold;
  }
}

export interface CapacityGateInput {
  report: Phase8RunnerReport;
  policy: SloPolicy | null | undefined;
  releaseCandidate: boolean;
  weeklySoakDue: boolean;
}

export function evaluateCapacityGate(input: CapacityGateInput): {
  passed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.report.environmentClass === 'SIMULATED') {
    reasons.push(
      'SIMULATED environment cannot satisfy release capacity gate; real environment evidence required',
    );
  }
  const policyApproved = isSloPolicyEnforceable(input.policy);
  if (input.releaseCandidate && !policyApproved) {
    reasons.push(
      input.policy
        ? `SLO policy ${input.policy.policyId} is not approved`
        : 'no SLO policy registered',
    );
  }
  if (
    input.releaseCandidate &&
    policyApproved &&
    input.policy?.approvedEnvironment !== input.report.environmentClass &&
    input.report.environmentClass !== 'PRODUCTION_PROBE' &&
    input.report.environmentClass !== 'PRODUCTION'
  ) {
    reasons.push(
      `report environmentClass=${input.report.environmentClass} differs from approvedEnvironment=${input.policy?.approvedEnvironment}`,
    );
  }
  for (const bundle of input.report.metricBundles) {
    if (bundle.correctnessVerdict === 'FAILED') {
      reasons.push(`correctness failed for ${bundle.profileId}`);
    }
    if (bundle.isolationVerdict === 'FAILED') {
      reasons.push(`isolation failed under load for ${bundle.profileId}`);
    }
    if (input.releaseCandidate && bundle.regressionVerdict === 'REGRESSED') {
      reasons.push(`regression detected for ${bundle.profileId}`);
    }
    if (
      input.weeklySoakDue &&
      bundle.profileId.includes('soak') &&
      bundle.errorRate > 0.05
    ) {
      reasons.push(`soak error rate exceeds budget for ${bundle.profileId}`);
    }
  }
  if (input.releaseCandidate && input.report.status !== 'PASS') {
    reasons.push(
      `release capacity verdict is ${input.report.status}; PASS required`,
    );
  }
  return { passed: reasons.length === 0, reasons };
}

export class Phase8Coordinator {
  constructor(
    private readonly sink: Phase8EvidenceSink = new Phase8EvidenceSink(),
    private readonly cleanupPort: CleanupPort = new InMemoryCleanupPort(),
    private readonly alertPort: OperationalAlertPort = new InMemoryOperationalAlertPort(),
  ) {}

  async run(
    input: Phase8CoordinatorInput,
    options: Phase8RunOptions = {},
  ): Promise<Phase8RunnerReport> {
    const runId = input.runId ?? randomUUID();
    const tenantIds =
      input.tenantIds.length > 0 ? input.tenantIds : [input.ctx.tenantId];
    const primaryTenantId = input.primaryTenantId ?? input.ctx.tenantId;
    if (!tenantIds.includes(primaryTenantId)) {
      throw new Error('primaryTenantId must be in tenantIds');
    }
    const environmentClass = input.environmentClass ?? 'SIMULATED';
    const startedAt = new Date().toISOString();
    const profiles = (input.profiles ?? PHASE8_DEFAULT_PROFILES).map((p) =>
      WorkloadProfileSchema.parse(p),
    );
    const workloadRunner = new WorkloadRunner(
      input.workloadPort ?? new SimulatedWorkloadPort(),
      input.metricsPort ?? new InMemoryMetricsPort(),
      input.pressurePort ?? new InMemoryPressurePort(),
      input.cachePort ?? new InMemoryCachePort(),
      input.dbPort ?? new InMemoryDbPort(),
      input.queuePort ?? new InMemoryQueuePort(),
      input.providerPort ?? new InMemoryProviderPort(),
      input.correctnessOracle ?? new DeterministicCorrectnessOracle(),
      input.isolationOracle ?? new DeterministicIsolationOracle(),
    );
    const bundles: WorkloadMetricBundle[] = [];
    const caseResults: WorkloadCaseResult[] = [];
    const statisticalConfidence: Phase8RunnerReport['statisticalConfidence'] =
      [];
    const regressionEvidence: Phase8RunnerReport['regressionEvidence'] = [];
    const operationalAlerts: OperationalAlert[] = [];

    let baseline: WorkloadMetricBundle | null = input.baseline ?? null;

    for (const profile of profiles) {
      if (options.signal?.aborted) break;
      const bundle = await workloadRunner.runProfile({
        profile,
        primaryTenantId,
        tenantIds,
        baseline: profile.kind === 'BASELINE_WARM' ? null : baseline,
        environmentClass,
        provenance: `phase8://${environmentClass.toLowerCase()}/${runId}/${profile.profileId}`,
        signal: options.signal,
        perRequestTimeoutMs: input.perRequestTimeoutMs ?? 2000,
        retryMax: input.retryMax ?? 0,
        retryable: input.retryable ?? defaultRetryable,
      });
      bundles.push(bundle);

      const sc = buildStatisticalConfidence(profile.profileId, bundle);
      statisticalConfidence.push({
        schemaVersion: PHASE8_VERSION,
        sampleSize: sc.sampleSize,
        confidenceLevel: sc.confidenceLevel,
        method: sc.method,
        marginOfError: sc.marginOfError,
        sufficient: sc.sufficient,
        reason: sc.reason,
      });

      const baselineForRegression =
        profile.kind === 'BASELINE_WARM' ? null : baseline;
      const ratio =
        baselineForRegression && baselineForRegression.latency.p95Ms > 0
          ? bundle.latency.p95Ms / baselineForRegression.latency.p95Ms
          : null;
      const errorDelta =
        baselineForRegression !== null
          ? bundle.errorRate - baselineForRegression.errorRate
          : null;
      regressionEvidence.push({
        schemaVersion: PHASE8_VERSION,
        baselineRunId: input.baselineRunId ?? null,
        baselineBundleId: input.baselineBundleId ?? null,
        baselineProvenance: input.baselineProvenance ?? null,
        comparedAt: new Date().toISOString(),
        toleranceP95Ratio: 1.5,
        toleranceErrorRate: 0.05,
        observedP95Ratio: ratio,
        observedErrorDelta: errorDelta,
        reason: baselineForRegression
          ? `compared to baseline bundle ${baselineForRegression.metricBundleId}`
          : 'no baseline provided; regression verdict is INSUFFICIENT_EVIDENCE or NOT_APPLICABLE',
      });

      collectBundleAlerts(
        bundle,
        runId,
        primaryTenantId,
        environmentClass,
        operationalAlerts,
      );
      const critical =
        bundle.correctnessVerdict === 'FAILED' ||
        bundle.isolationVerdict === 'FAILED';
      const expected = describeExpected(profile.kind);
      const observed = describeObserved(bundle);
      const passed =
        bundle.correctnessVerdict !== 'FAILED' &&
        bundle.isolationVerdict !== 'FAILED' &&
        bundle.regressionVerdict !== 'REGRESSED';
      const envelope = this.sink.buildEnvelope({
        runId,
        scenarioId: `phase8-${profile.kind}`,
        capabilityId: 'performance-load',
        tenantId: primaryTenantId,
        producer: `phase8-runner[${environmentClass.toLowerCase()}]`,
        correlationIds: [profile.profileId, runId],
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'NOT_REQUIRED',
        content: { profile, bundle, environmentClass },
      });
      caseResults.push({
        caseId: profile.profileId,
        profileId: profile.profileId,
        expected,
        observed,
        passed,
        criticalFailure: critical,
        evidenceRefs: [envelope.evidenceId],
        provenance: `phase8://${environmentClass.toLowerCase()}/${runId}/${profile.profileId}`,
      });
      if (profile.kind === 'BASELINE_WARM') baseline = bundle;
    }

    const counters = computePhase8Counters(caseResults);
    const envelopes = this.sink.list();
    const cleanupResult = await this.executeCleanup(
      envelopes,
      runId,
      primaryTenantId,
      operationalAlerts,
    );
    for (const a of operationalAlerts) this.alertPort.emit(a);
    const finalizedAt = new Date().toISOString();
    const sloEvaluation = input.sloPolicy
      ? evaluateSloPolicy({
          policy: input.sloPolicy,
          bundle: bundles[0] ?? null,
          environmentClass,
        })
      : null;
    const adapterRegistrations = input.adapterRegistrations
      ? [...input.adapterRegistrations]
      : unsupportedRegistrationStamps();
    return finalizePhase8Report({
      schemaVersion: PHASE8_VERSION,
      runnerId: 'phase8-coordinator',
      runId,
      tenantId: primaryTenantId,
      startedAt,
      finalizedAt,
      counters,
      caseResults,
      metricBundles: bundles,
      evidenceEnvelopes: envelopes,
      cleanupResult,
      environmentClass,
      provenance: `phase8://coordinator/${environmentClass.toLowerCase()}/${runId}`,
      sloEvaluation,
      adapterRegistrations: adapterRegistrations.map((r) => r.adapter),
      statisticalConfidence,
      regressionEvidence,
      operationalAlerts,
      notes: [
        'Phase 8 results are produced from in-memory simulation by default and do NOT represent real production or staging capacity.',
        'Phase 8 verdicts are evidence-only and do not authorize external SLO/SRE approval.',
        `environmentClass=${environmentClass}`,
        `alertsEmitted=${operationalAlerts.length}`,
      ],
    });
  }

  private async executeCleanup(
    envelopes: readonly EvidenceEnvelope[],
    runId: string,
    tenantId: string,
    alerts: OperationalAlert[],
  ): Promise<CleanupResult> {
    const cleanedResources: string[] = [];
    const failedCleanup: string[] = [];
    const orphanedResources: string[] = [];
    for (const env of envelopes) {
      try {
        const outcome = await this.cleanupPort.cleanup({
          id: env.evidenceId,
          tenantId: env.tenantId,
        });
        if (outcome.cleaned) {
          cleanedResources.push(env.evidenceId);
        } else {
          if (outcome.error && outcome.error !== 'already-cleaned-idempotent') {
            failedCleanup.push(env.evidenceId);
            alerts.push({
              schemaVersion: PHASE8_VERSION,
              alertId: randomUUID(),
              kind: 'CLEANUP_FAILURE',
              severity: 'CRITICAL',
              message: `cleanup failed for evidenceId=${env.evidenceId}: ${outcome.error}`,
              profileId: null,
              metricBundleId: null,
              runId,
              tenantId,
              observedAt: new Date().toISOString(),
              context: { evidenceId: env.evidenceId, error: outcome.error },
            });
          }
          if (outcome.orphans?.length)
            orphanedResources.push(...outcome.orphans);
        }
      } catch (err) {
        failedCleanup.push(env.evidenceId);
        orphanedResources.push(env.evidenceId);
        const msg = err instanceof Error ? err.message : String(err);
        alerts.push({
          schemaVersion: PHASE8_VERSION,
          alertId: randomUUID(),
          kind: 'CLEANUP_FAILURE',
          severity: 'CRITICAL',
          message: `cleanup threw for evidenceId=${env.evidenceId}: ${msg}`,
          profileId: null,
          metricBundleId: null,
          runId,
          tenantId,
          observedAt: new Date().toISOString(),
          context: { evidenceId: env.evidenceId, error: msg },
        });
      }
    }
    return {
      success: failedCleanup.length === 0 && orphanedResources.length === 0,
      cleanedResources,
      failedCleanup,
      orphanedResources,
    };
  }
}

function collectBundleAlerts(
  bundle: WorkloadMetricBundle,
  runId: string,
  tenantId: string,
  environmentClass: Phase8EnvironmentClass,
  alerts: OperationalAlert[],
): void {
  if (bundle.correctnessVerdict === 'FAILED') {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'CORRECTNESS_FAILURE',
      severity: 'CRITICAL',
      message: `correctness failed for ${bundle.profileId} (env=${environmentClass})`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: { environmentClass },
    });
  }
  if (bundle.isolationVerdict === 'FAILED') {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'ISOLATION_FAILURE',
      severity: 'CRITICAL',
      message: `isolation failed for ${bundle.profileId} (env=${environmentClass})`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: { environmentClass },
    });
  }
  if (bundle.saturationPoint) {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'SATURATION_DETECTED',
      severity: 'WARNING',
      message: `saturation detected for ${bundle.profileId} via ${bundle.saturationPoint.detection}`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: {
        metric: bundle.saturationPoint.metric,
        value: bundle.saturationPoint.inflectionValue,
        unit: bundle.saturationPoint.unit,
      },
    });
  }
  const pressure = bundle.pressureEvidence;
  if (
    pressure.providerThrottlePercent !== null &&
    pressure.providerThrottlePercent >= 30
  ) {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'PROVIDER_THROTTLE_SUSTAINED',
      severity: 'WARNING',
      message: `provider throttle sustained for ${bundle.profileId}`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: {
        providerThrottlePercent: pressure.providerThrottlePercent,
        providerDelayMs: pressure.providerDelayMs,
      },
    });
  }
  if (pressure.queueBacklogPeak !== null && pressure.queueBacklogPeak >= 50) {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'QUEUE_BACKLOG_GROWTH',
      severity: 'WARNING',
      message: `queue backlog growth for ${bundle.profileId}`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: { queueBacklogPeak: pressure.queueBacklogPeak },
    });
  }
  if (
    bundle.profileId === 'recovery' &&
    bundle.recoveryCurve !== null &&
    bundle.recoveryCurve.recoveryTimeMs > 0
  ) {
    const sampleSize = bundle.latency.sampleSize;
    if (
      sampleSize > 0 &&
      bundle.recoveryCurve.recoveryTimeMs > 1000 &&
      bundle.recoveryCurve.trailingErrorRate > 0.05
    ) {
      alerts.push({
        schemaVersion: PHASE8_VERSION,
        alertId: randomUUID(),
        kind: 'RECOVERY_FAILURE',
        severity: 'WARNING',
        message: `recovery took ${bundle.recoveryCurve.recoveryTimeMs}ms with trailing error rate ${(bundle.recoveryCurve.trailingErrorRate * 100).toFixed(2)}% for ${bundle.profileId}`,
        profileId: bundle.profileId,
        metricBundleId: bundle.metricBundleId,
        runId,
        tenantId,
        observedAt: new Date().toISOString(),
        context: {
          recoveryTimeMs: bundle.recoveryCurve.recoveryTimeMs,
          trailingErrorRate: bundle.recoveryCurve.trailingErrorRate,
        },
      });
    }
  }
  if (environmentClass === 'SIMULATED') {
    alerts.push({
      schemaVersion: PHASE8_VERSION,
      alertId: randomUUID(),
      kind: 'UNSUPPORTED_ROUTING',
      severity: 'INFO',
      message: `SIMULATED environment for ${bundle.profileId}; no real capacity can be authorized from this bundle`,
      profileId: bundle.profileId,
      metricBundleId: bundle.metricBundleId,
      runId,
      tenantId,
      observedAt: new Date().toISOString(),
      context: { environmentClass },
    });
  }
}

function defaultRetryable(err: unknown): boolean {
  if (err instanceof RunnerTimeoutError) return true;
  if (err instanceof Error && /PROVIDER_THROTTLED|aborted/i.test(err.message)) {
    return false;
  }
  return true;
}

function describeExpected(kind: WorkloadKind): string {
  switch (kind) {
    case 'BASELINE_COLD':
      return 'correctness-passed AND isolation-passed';
    case 'BASELINE_WARM':
      return 'baseline established';
    case 'SPIKE':
      return 'p95 under spike within budget';
    case 'STRESS':
      return 'saturation point identified without isolation breach';
    case 'SOAK':
      return 'no drift across windows';
    case 'PROVIDER_THROTTLE':
      return 'throttle handled with measurable pressure/recovery';
    case 'QUEUE_PRESSURE':
      return 'queue backlog drains with measurable pressure/recovery';
    case 'DB_PRESSURE':
      return 'db saturation measured without isolation breach';
    case 'CACHE_PRESSURE':
      return 'cache miss ratio degraded without isolation breach';
    case 'CONCURRENT_TENANTS':
      return 'no cross-tenant access';
    case 'CONCURRENT_AGENTS':
      return 'no agent contention breaches';
    case 'RECOVERY':
      return 'recovery within budget';
  }
}

function describeObserved(b: WorkloadMetricBundle): string {
  return [
    `correctness=${b.correctnessVerdict}`,
    `isolation=${b.isolationVerdict}`,
    `regression=${b.regressionVerdict}`,
    `p95=${b.latency.p95Ms.toFixed(1)}ms`,
    `err=${(b.errorRate * 100).toFixed(2)}%`,
    `env=${b.environmentClass}`,
  ].join('|');
}

export const PHASE8_KIND_LABELS: Readonly<Record<WorkloadKind, string>> =
  Object.freeze({
    BASELINE_COLD: 'baseline cold',
    BASELINE_WARM: 'baseline warm',
    SPIKE: 'spike',
    STRESS: 'stress',
    SOAK: 'soak',
    PROVIDER_THROTTLE: 'provider throttle',
    QUEUE_PRESSURE: 'queue pressure',
    DB_PRESSURE: 'db pressure',
    CACHE_PRESSURE: 'cache pressure',
    CONCURRENT_TENANTS: 'concurrent tenants',
    CONCURRENT_AGENTS: 'concurrent agents',
    RECOVERY: 'recovery',
  });

export function defaultProfiles(): WorkloadProfile[] {
  return PHASE8_DEFAULT_PROFILES.map((p) => WorkloadProfileSchema.parse(p));
}

export {
  FailingCleanupAdapter,
  UnsupportedCleanupAdapter,
  type Phase8ProductionAdapter,
};
