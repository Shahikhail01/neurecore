import { randomUUID } from 'crypto';
import { type EvidenceEnvelope, type AuthorizationContext } from '../contracts';
import { createEvidenceEnvelope, EvidenceStore } from '../evidence';
import type {
  ConfidenceInterval,
  CorrectnessVerdict,
  IsolationVerdict,
  LatencyDistribution,
  OperationalAlert,
  RecoveryCurve,
  ResourceSample,
  SaturationPoint,
  TokenCostBreakdown,
  WorkloadKind,
  WorkloadMetricBundle,
  WorkloadProfile,
} from './contracts';

export interface WorkloadRequest {
  requestId: string;
  tenantId: string;
  agentId: string;
  enqueuedAt: number;
  payload: unknown;
}

export interface WorkloadResponse {
  requestId: string;
  status: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';
  durationMs: number;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  model?: string;
  queueWaitMs?: number;
  providerLatencyMs?: number;
  failureReason?: string;
  isolationBreach?: boolean;
  attempts?: number;
}

export interface WorkloadPort {
  execute(req: WorkloadRequest, signal: AbortSignal): Promise<WorkloadResponse>;
}

export interface MetricsPort {
  record(latencyMs: number, status: WorkloadResponse['status']): void;
  reset(): void;
  snapshot(): {
    latencies: number[];
    successCount: number;
    failureCount: number;
    timeoutCount: number;
    cancelledCount: number;
    startedAt: number;
    finalizedAt: number;
  };
}

export interface PressurePort {
  begin(profile: WorkloadProfile): void;
  tick(now: number): ResourceSample;
  finalize(): ResourceSample;
  inducedErrorRate(): number;
  setErrorRate(value: number): void;
  setQueueDepth(value: number): void;
  setDbConnections(value: number): void;
  setMemory(value: number): void;
  setCacheHitRatio(value: number): void;
  setInflight(value: number): void;
  setCpuPercent(value: number): void;
  setProviderLatencyMs(value: number): void;
  listSamples(): readonly ResourceSample[];
  elapsed(): number;
  reset(): void;
}

export interface CachePort {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  invalidate(): Promise<void>;
  stats(): { hitCount: number; missCount: number; size: number };
  setMissRatio(ratio: number): void;
  reset(): void;
}

export interface DbPort {
  query<T>(stmt: string, params?: unknown[]): Promise<T[]>;
  beginTx(): Promise<{ commit(): Promise<void>; rollback(): Promise<void> }>;
  connectionCount(): number;
  peakConnections(): number;
  setLatencyMs(p50: number, p99: number): void;
  reset(): void;
}

export interface QueuePort {
  enqueue(job: WorkloadRequest): Promise<void>;
  take(): Promise<WorkloadRequest | null>;
  depth(): number;
  peakDepth(): number;
  setServiceMs(value: number): void;
  setBacklog(value: number): void;
  drain(): Promise<number>;
  reset(): void;
}

export interface ProviderPort {
  invoke(prompt: string): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    model: string;
    providerLatencyMs: number;
  }>;
  setThrottle(percent: number, delayMs: number): void;
  clear(): void;
  throttlePercent(): number;
  delayMs(): number;
}

export interface CorrectnessOracle {
  evaluate(req: WorkloadRequest, resp: WorkloadResponse): CorrectnessVerdict;
}

export interface IsolationOracle {
  evaluate(
    primaryTenantId: string,
    otherTenantIds: readonly string[],
    samples: ReadonlyMap<string, WorkloadResponse>,
  ): IsolationVerdict;
}

export interface CleanupPort {
  cleanup(target: { id: string; tenantId: string }): Promise<CleanupOutcome>;
  listOrphans(): string[];
}

export interface CleanupOutcome {
  cleaned: boolean;
  error?: string;
  orphans: string[];
}

export interface OperationalAlertPort {
  emit(alert: OperationalAlert): void;
  list(): OperationalAlert[];
  reset(): void;
}

export interface ReportSchemaVersion {
  schemaVersion: string;
  runnerVersion: string;
  reportWriterVersion: string;
}

export interface ReportSchemaMigration {
  fromVersion: string;
  toVersion: string;
  appliedAt: string;
  steps: string[];
  dryRun: boolean;
}

export interface ReportSchemaMigrator {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly dryRun: boolean;
  plan(report: unknown): ReportSchemaMigration;
  apply(report: unknown): unknown;
  verify(report: unknown): { valid: boolean; reasons: string[] };
}

export type WorkloadPhase = 'WARMUP' | 'PRESSURE' | 'COOLDOWN' | 'STEADY';

export class InMemoryMetricsPort implements MetricsPort {
  private latencies: number[] = [];
  private successCount = 0;
  private failureCount = 0;
  private timeoutCount = 0;
  private cancelledCount = 0;
  private startedAt = Date.now();
  private finalizedAt = Date.now();

  record(latencyMs: number, status: WorkloadResponse['status']): void {
    this.latencies.push(latencyMs);
    if (status === 'OK') this.successCount++;
    else if (status === 'ERROR') this.failureCount++;
    else if (status === 'TIMEOUT') this.timeoutCount++;
    else if (status === 'CANCELLED') this.cancelledCount++;
  }

  reset(): void {
    this.latencies = [];
    this.successCount = 0;
    this.failureCount = 0;
    this.timeoutCount = 0;
    this.cancelledCount = 0;
    this.startedAt = Date.now();
    this.finalizedAt = Date.now();
  }

  snapshot(): {
    latencies: number[];
    successCount: number;
    failureCount: number;
    timeoutCount: number;
    cancelledCount: number;
    startedAt: number;
    finalizedAt: number;
  } {
    this.finalizedAt = Date.now();
    return {
      latencies: [...this.latencies],
      successCount: this.successCount,
      failureCount: this.failureCount,
      timeoutCount: this.timeoutCount,
      cancelledCount: this.cancelledCount,
      startedAt: this.startedAt,
      finalizedAt: this.finalizedAt,
    };
  }
}

export class InMemoryPressurePort implements PressurePort {
  private samples: ResourceSample[] = [];
  private errorRate = 0;
  private queueDepth = 0;
  private dbConn = 0;
  private memMb = 0;
  private cacheHitRatio = 1;
  private inflight = 0;
  private cpuPercent = 0;
  private providerLatencyMs = 0;
  private startTs = Date.now();

  begin(profile: WorkloadProfile): void {
    this.reset();
    this.dbConn = Math.min(profile.concurrency, 4);
    this.startTs = Date.now();
  }

  reset(): void {
    this.samples = [];
    this.errorRate = 0;
    this.queueDepth = 0;
    this.dbConn = 0;
    this.memMb = 0;
    this.cacheHitRatio = 1;
    this.inflight = 0;
    this.cpuPercent = 0;
    this.providerLatencyMs = 0;
    this.startTs = Date.now();
  }

  tick(now: number): ResourceSample {
    const sample: ResourceSample = {
      timestamp: new Date(now).toISOString(),
      cpuPercent: this.cpuPercent,
      memoryMb: this.memMb,
      queueDepth: this.queueDepth,
      dbConnections: this.dbConn,
      cacheHitRatio: this.cacheHitRatio,
      inflight: this.inflight,
    };
    this.samples.push(sample);
    return sample;
  }

  finalize(): ResourceSample {
    const last = this.samples[this.samples.length - 1];
    return (
      last ?? {
        timestamp: new Date().toISOString(),
        cpuPercent: 0,
        memoryMb: this.memMb,
        queueDepth: this.queueDepth,
        dbConnections: this.dbConn,
        cacheHitRatio: this.cacheHitRatio,
        inflight: this.inflight,
      }
    );
  }

  inducedErrorRate(): number {
    return this.errorRate;
  }

  setErrorRate(value: number): void {
    this.errorRate = value;
  }

  setQueueDepth(value: number): void {
    this.queueDepth = value;
  }

  setDbConnections(value: number): void {
    this.dbConn = value;
  }

  setMemory(value: number): void {
    this.memMb = value;
  }

  setCacheHitRatio(value: number): void {
    this.cacheHitRatio = value;
  }

  setInflight(value: number): void {
    this.inflight = value;
  }

  setCpuPercent(value: number): void {
    this.cpuPercent = Math.max(0, Math.min(100, value));
  }

  setProviderLatencyMs(value: number): void {
    this.providerLatencyMs = Math.max(0, value);
  }

  listSamples(): readonly ResourceSample[] {
    return [...this.samples];
  }

  elapsed(): number {
    return Date.now() - this.startTs;
  }
}

export class InMemoryCachePort implements CachePort {
  private map = new Map<string, { value: unknown; expiresAt: number }>();
  private hitCount = 0;
  private missCount = 0;
  private missRatio = 0;

  async get(key: string): Promise<unknown> {
    await Promise.resolve();
    if (Math.random() < this.missRatio) {
      this.missCount++;
      return null;
    }
    const entry = this.map.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      this.missCount++;
      return null;
    }
    this.hitCount++;
    return entry.value;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await Promise.resolve();
    const expiresAt = ttlMs ? Date.now() + ttlMs : Number.MAX_SAFE_INTEGER;
    this.map.set(key, { value, expiresAt });
  }

  async invalidate(): Promise<void> {
    await Promise.resolve();
    this.map.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  stats(): { hitCount: number; missCount: number; size: number } {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      size: this.map.size,
    };
  }

  setMissRatio(ratio: number): void {
    this.missRatio = Math.max(0, Math.min(1, ratio));
  }

  reset(): void {
    this.map.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.missRatio = 0;
  }
}

export class InMemoryDbPort implements DbPort {
  private rows: unknown[] = [];
  private open = 0;
  private peak = 0;
  private latencyP50 = 5;
  private latencyP99 = 25;

  async query<T>(_stmt: string, _params?: unknown[]): Promise<T[]> {
    this.open++;
    this.peak = Math.max(this.peak, this.open);
    await new Promise((r) => {
      const jitter = Math.random() * (this.latencyP99 - this.latencyP50);
      setTimeout(r, this.latencyP50 + jitter);
    });
    this.open--;
    return this.rows as T[];
  }

  async beginTx(): Promise<{
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }> {
    await Promise.resolve();
    this.open++;
    this.peak = Math.max(this.peak, this.open);
    return {
      commit: async () => {
        await Promise.resolve();
        this.open--;
      },
      rollback: async () => {
        await Promise.resolve();
        this.open--;
      },
    };
  }

  connectionCount(): number {
    return this.open;
  }

  peakConnections(): number {
    return this.peak;
  }

  setLatencyMs(p50: number, p99: number): void {
    this.latencyP50 = p50;
    this.latencyP99 = Math.max(p99, p50 + 1);
  }

  seed<T>(rows: T[]): void {
    this.rows = rows;
  }

  reset(): void {
    this.rows = [];
    this.open = 0;
    this.peak = 0;
    this.latencyP50 = 5;
    this.latencyP99 = 25;
  }
}

export class InMemoryQueuePort implements QueuePort {
  private jobs: WorkloadRequest[] = [];
  private serviceMs = 1;
  private backlog = 0;
  private peak = 0;

  async enqueue(job: WorkloadRequest): Promise<void> {
    await Promise.resolve();
    this.jobs.push(job);
    this.backlog++;
    this.peak = Math.max(this.peak, this.jobs.length);
  }

  async take(): Promise<WorkloadRequest | null> {
    await Promise.resolve();
    const job = this.jobs.shift() ?? null;
    if (job) this.backlog = Math.max(0, this.backlog - 1);
    return job;
  }

  depth(): number {
    return this.jobs.length;
  }

  peakDepth(): number {
    return this.peak;
  }

  setServiceMs(value: number): void {
    this.serviceMs = Math.max(0, value);
  }

  setBacklog(value: number): void {
    this.backlog = Math.max(0, value);
    while (this.jobs.length < value) {
      this.jobs.push({
        requestId: randomUUID(),
        tenantId: '00000000-0000-0000-0000-000000000000',
        agentId: 'synth',
        enqueuedAt: Date.now(),
        payload: {},
      });
    }
    this.peak = Math.max(this.peak, this.jobs.length);
  }

  async drain(): Promise<number> {
    await Promise.resolve();
    let drained = 0;
    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (job) drained++;
    }
    this.backlog = 0;
    return drained;
  }

  reset(): void {
    this.jobs = [];
    this.serviceMs = 1;
    this.backlog = 0;
    this.peak = 0;
  }

  serviceMsValue(): number {
    return this.serviceMs;
  }
}

export class InMemoryProviderPort implements ProviderPort {
  private throttlePct = 0;
  private delayMsValue = 0;

  async invoke(prompt: string): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    model: string;
    providerLatencyMs: number;
  }> {
    if (Math.random() * 100 < this.throttlePct) {
      throw new Error('PROVIDER_THROTTLED');
    }
    if (this.delayMsValue > 0) {
      await new Promise((r) => setTimeout(r, this.delayMsValue));
    }
    const promptTokens = Math.max(1, Math.floor(prompt.length / 4));
    const completionTokens = Math.max(1, Math.floor(promptTokens / 4));
    const costUsd = (promptTokens + completionTokens) * 0.000002;
    return {
      text: `ok:${prompt.slice(0, 16)}`,
      promptTokens,
      completionTokens,
      costUsd,
      model: 'sim-model-v1',
      providerLatencyMs:
        50 + this.delayMsValue + Math.floor(Math.random() * 50),
    };
  }

  setThrottle(percent: number, delayMs: number): void {
    this.throttlePct = Math.max(0, Math.min(100, percent));
    this.delayMsValue = Math.max(0, delayMs);
  }

  clear(): void {
    this.throttlePct = 0;
    this.delayMsValue = 0;
  }

  throttlePercent(): number {
    return this.throttlePct;
  }

  delayMs(): number {
    return this.delayMsValue;
  }
}

export class DeterministicCorrectnessOracle implements CorrectnessOracle {
  evaluate(req: WorkloadRequest, resp: WorkloadResponse): CorrectnessVerdict {
    if (resp.status !== 'OK') return 'INCONCLUSIVE';
    if (resp.provider === '__breach__') return 'FAILED';
    if (resp.isolationBreach) return 'FAILED';
    if (!resp.requestId || resp.requestId !== req.requestId) return 'FAILED';
    if (
      resp.attempts !== undefined &&
      resp.attempts > 1 &&
      req.payload &&
      typeof req.payload === 'object' &&
      'kind' in req.payload &&
      (req.payload as { kind?: unknown }).kind === 'CONCURRENT_TENANTS'
    ) {
      return 'FAILED';
    }
    return 'PASSED';
  }
}

export class DeterministicIsolationOracle implements IsolationOracle {
  evaluate(
    primaryTenantId: string,
    otherTenantIds: readonly string[],
    samples: ReadonlyMap<string, WorkloadResponse>,
  ): IsolationVerdict {
    if (!primaryTenantId) return 'FAILED';
    const allowedTenants = new Set<string>([
      primaryTenantId,
      ...otherTenantIds,
    ]);
    let anyFailure = false;
    for (const [requestId, resp] of samples) {
      if (resp.isolationBreach) return 'FAILED';
      if (resp.status !== 'OK') anyFailure = true;
      if (!requestId) return 'FAILED';
      if (resp.requestId !== requestId) return 'FAILED';
      const inferredTenant = inferTenantFromProvider(resp.provider);
      if (inferredTenant && !allowedTenants.has(inferredTenant))
        return 'FAILED';
    }
    if (anyFailure) return 'INCONCLUSIVE';
    if (samples.size === 0) return 'INCONCLUSIVE';
    return 'PASSED';
  }
}

function inferTenantFromProvider(provider?: string): string | null {
  if (!provider) return null;
  const match = provider.match(/tenant:([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

export class TenantKeyIsolationOracle implements IsolationOracle {
  evaluate(
    primaryTenantId: string,
    otherTenantIds: readonly string[],
    samples: ReadonlyMap<string, WorkloadResponse>,
  ): IsolationVerdict {
    if (!primaryTenantId) return 'FAILED';
    const allowed = new Set([primaryTenantId, ...otherTenantIds]);
    for (const [, resp] of samples) {
      if (resp.isolationBreach) return 'FAILED';
      if (resp.provider?.startsWith('tenant:')) {
        const tenantId = resp.provider.slice('tenant:'.length);
        if (!allowed.has(tenantId)) return 'FAILED';
      }
    }
    return samples.size === 0 ? 'INCONCLUSIVE' : 'PASSED';
  }
}

export class InMemoryCleanupPort implements CleanupPort {
  private cleaned = new Set<string>();
  private orphans = new Set<string>();

  async cleanup(target: {
    id: string;
    tenantId: string;
  }): Promise<CleanupOutcome> {
    await Promise.resolve();
    if (this.cleaned.has(target.id)) {
      return {
        cleaned: true,
        orphans: [],
        error: 'already-cleaned-idempotent',
      };
    }
    this.cleaned.add(target.id);
    this.orphans.delete(target.id);
    return { cleaned: true, orphans: [] };
  }

  listOrphans(): string[] {
    return [...this.orphans];
  }

  recordOrphan(id: string): void {
    this.orphans.add(id);
  }

  reset(): void {
    this.cleaned = new Set<string>();
    this.orphans = new Set<string>();
  }
}

export class FailingCleanupAdapter implements CleanupPort {
  private readonly orphans = new Set<string>();

  async cleanup(target: {
    id: string;
    tenantId: string;
  }): Promise<CleanupOutcome> {
    await Promise.resolve();
    this.orphans.add(target.id);
    return {
      cleaned: false,
      error: 'CLEANUP_FAILED',
      orphans: [target.id],
    };
  }

  listOrphans(): string[] {
    return [...this.orphans];
  }
}

export class UnsupportedCleanupAdapter implements CleanupPort {
  readonly status = 'UNSUPPORTED' as const;
  readonly reason =
    'PHASE8_CLEANUP_UNSUPPORTED: no production cleanup adapter registered. Use an in-memory adapter only for conformance.';

  async cleanup(target: {
    id: string;
    tenantId: string;
  }): Promise<CleanupOutcome> {
    void target;
    return Promise.reject(new Error(this.reason));
  }

  listOrphans(): string[] {
    return [];
  }
}

export const UNSUPPORTED_ALERT_REASON =
  'PHASE8_ALERT_UNSUPPORTED: no production alert sink registered; use InMemoryOperationalAlertPort for conformance';

export class InMemoryOperationalAlertPort implements OperationalAlertPort {
  private readonly alerts: OperationalAlert[] = [];

  emit(alert: OperationalAlert): void {
    this.alerts.push(alert);
  }

  list(): OperationalAlert[] {
    return [...this.alerts];
  }

  reset(): void {
    this.alerts.length = 0;
  }

  countByKind(): Record<OperationalAlert['kind'], number> {
    const out: Record<OperationalAlert['kind'], number> = {
      CLEANUP_FAILURE: 0,
      CORRECTNESS_FAILURE: 0,
      ISOLATION_FAILURE: 0,
      SATURATION_DETECTED: 0,
      PROVIDER_THROTTLE_SUSTAINED: 0,
      QUEUE_BACKLOG_GROWTH: 0,
      RECOVERY_FAILURE: 0,
      UNSUPPORTED_ROUTING: 0,
    };
    for (const a of this.alerts) out[a.kind] = (out[a.kind] ?? 0) + 1;
    return out;
  }
}

export class UnsupportedOperationalAlertPort implements OperationalAlertPort {
  readonly status = 'UNSUPPORTED' as const;
  readonly reason = UNSUPPORTED_ALERT_REASON;

  emit(alert: OperationalAlert): void {
    void alert;
  }

  list(): OperationalAlert[] {
    return [];
  }

  reset(): void {
    /* no-op */
  }
}

export class Phase8EvidenceSink {
  private readonly store = new EvidenceStore();
  private readonly envelopes: EvidenceEnvelope[] = [];

  append(envelope: EvidenceEnvelope, content: unknown): void {
    this.store.append(envelope, content);
    this.envelopes.push(envelope);
  }

  list(): EvidenceEnvelope[] {
    return [...this.envelopes];
  }

  buildEnvelope(input: {
    runId: string;
    scenarioId: string;
    capabilityId: string;
    tenantId: string;
    producer: string;
    correlationIds: string[];
    classification:
      | 'PUBLIC'
      | 'INTERNAL'
      | 'CONFIDENTIAL'
      | 'RESTRICTED'
      | 'REGULATED';
    retentionClass: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'PERMANENT';
    redactionStatus: 'PENDING' | 'APPLIED' | 'NOT_REQUIRED';
    content: unknown;
  }): EvidenceEnvelope {
    const envelope = createEvidenceEnvelope({
      runId: input.runId,
      scenarioId: input.scenarioId,
      capabilityId: input.capabilityId,
      tenantId: input.tenantId,
      producer: input.producer,
      mediaType: 'application/json',
      classification: input.classification,
      retentionClass: input.retentionClass,
      redactionStatus: input.redactionStatus,
      correlationIds: input.correlationIds,
      content: input.content,
    });
    this.append(envelope, input.content);
    return envelope;
  }
}

export function createAuthorizationContext(
  tenantId: string,
): AuthorizationContext {
  return {
    actorId: 'phase8-runner',
    actorType: 'AI_AGENT',
    actorRoles: ['TENANT_USER'],
    tenantId,
    correlationId: randomUUID(),
    permissions: [],
  };
}

export function defaultSaturation(
  _p95: number,
  _observedAt: string,
): SaturationPoint | null {
  return null;
}

export function detectSaturationFromCurves(
  samples: readonly ResourceSample[],
  errorSamples: readonly ResourceSample[],
): SaturationPoint | null {
  if (samples.length === 0) return null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (cur.queueDepth !== undefined && prev.queueDepth !== undefined) {
      if (cur.queueDepth - prev.queueDepth >= 50 && cur.queueDepth > 100) {
        return {
          metric: 'queue-depth',
          inflectionValue: cur.queueDepth,
          unit: 'jobs',
          observedAt: cur.timestamp,
          detection: 'QUEUE_DEPTH',
          curve: [...samples],
        };
      }
    }
    if (
      cur.dbConnections !== undefined &&
      prev.dbConnections !== undefined &&
      cur.dbConnections - prev.dbConnections >= 4 &&
      cur.dbConnections >= 8
    ) {
      return {
        metric: 'db-connections',
        inflectionValue: cur.dbConnections,
        unit: 'connections',
        observedAt: cur.timestamp,
        detection: 'DB_CONNECTIONS',
        curve: [...samples],
      };
    }
    if (cur.cpuPercent !== undefined && cur.cpuPercent >= 90) {
      return {
        metric: 'cpu-percent',
        inflectionValue: cur.cpuPercent,
        unit: 'percent',
        observedAt: cur.timestamp,
        detection: 'CPU_PERCENT',
        curve: [...samples],
      };
    }
    if (
      cur.cacheHitRatio !== undefined &&
      cur.cacheHitRatio < 0.2 &&
      prev.cacheHitRatio !== undefined &&
      prev.cacheHitRatio > 0.5
    ) {
      return {
        metric: 'cache-hit-ratio',
        inflectionValue: cur.cacheHitRatio,
        unit: 'ratio',
        observedAt: cur.timestamp,
        detection: 'CACHE_HIT_RATIO',
        curve: [...samples],
      };
    }
  }
  for (let i = 1; i < errorSamples.length; i++) {
    const cur = errorSamples[i];
    if (cur.inflight !== undefined && cur.inflight >= 10) {
      return {
        metric: 'error-inflight',
        inflectionValue: cur.inflight,
        unit: 'count',
        observedAt: cur.timestamp,
        detection: 'ERROR_RATE',
        curve: [...errorSamples],
      };
    }
  }
  return null;
}

export function defaultRecovery(
  startedAt: string,
  recoveredAt: string,
  trailingP95Ms: number,
  trailingErrorRate: number,
  pressureCurve: readonly ResourceSample[],
  recoveryCurve: readonly ResourceSample[],
): RecoveryCurve {
  const start = new Date(startedAt).getTime();
  const end = new Date(recoveredAt).getTime();
  return {
    schemaVersion: '1.0.0',
    startedAt,
    recoveredAt,
    recoveryTimeMs: Math.max(0, end - start),
    trailingP95Ms,
    trailingErrorRate,
    pressureCurve: [...pressureCurve],
    recoveryCurve: [...recoveryCurve],
  };
}

export function buildLatencyDistribution(
  samples: readonly number[],
): LatencyDistribution {
  if (samples.length === 0) {
    return {
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      meanMs: 0,
      stddevMs: 0,
      sampleSize: 0,
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx];
  };
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance =
    sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;
  return {
    p50Ms: pick(0.5),
    p95Ms: pick(0.95),
    p99Ms: pick(0.99),
    maxMs: sorted[sorted.length - 1],
    meanMs: mean,
    stddevMs: Math.sqrt(variance),
    sampleSize: sorted.length,
  };
}

export function buildConfidenceIntervals(
  profile: WorkloadProfile,
  bundle: Pick<WorkloadMetricBundle, 'latency' | 'throughputRps' | 'errorRate'>,
): ConfidenceInterval[] {
  const sampleSize = bundle.latency.sampleSize || profile.durationMs;
  const method: ConfidenceInterval['method'] =
    sampleSize >= 30 ? 'NORMAL_APPROX' : 'NONE';
  if (method === 'NONE') {
    return [
      {
        metric: 'p95-latency-ms',
        lower: bundle.latency.p95Ms,
        upper: bundle.latency.p95Ms,
        confidenceLevel: 0,
        sampleSize,
        method,
      },
      {
        metric: 'error-rate',
        lower: bundle.errorRate,
        upper: bundle.errorRate,
        confidenceLevel: 0,
        sampleSize,
        method,
      },
      {
        metric: 'throughput-rps',
        lower: bundle.throughputRps,
        upper: bundle.throughputRps,
        confidenceLevel: 0,
        sampleSize,
        method,
      },
    ];
  }
  const halfWidth =
    (bundle.latency.stddevMs * 1.96) / Math.max(1, Math.sqrt(sampleSize));
  return [
    {
      metric: 'p95-latency-ms',
      lower: Math.max(0, bundle.latency.p95Ms - halfWidth),
      upper: bundle.latency.p95Ms + halfWidth,
      confidenceLevel: 95,
      sampleSize,
      method,
    },
    {
      metric: 'error-rate',
      lower: Math.max(0, bundle.errorRate - halfWidth / 1000),
      upper: Math.min(1, bundle.errorRate + halfWidth / 1000),
      confidenceLevel: 95,
      sampleSize,
      method,
    },
    {
      metric: 'throughput-rps',
      lower: Math.max(0, bundle.throughputRps - halfWidth / 100),
      upper: bundle.throughputRps + halfWidth / 100,
      confidenceLevel: 95,
      sampleSize,
      method,
    },
  ];
}

export const SUFFICIENT_SAMPLE_THRESHOLD = 30;

export function buildStatisticalConfidence(
  metric: string,
  bundle: Pick<WorkloadMetricBundle, 'latency'>,
): {
  sampleSize: number;
  confidenceLevel: number;
  method: import('./contracts').StatisticalConfidence['method'];
  marginOfError: number | null;
  sufficient: boolean;
  reason: string;
} {
  const sampleSize = bundle.latency.sampleSize;
  const sufficient = sampleSize >= SUFFICIENT_SAMPLE_THRESHOLD;
  if (!sufficient) {
    return {
      sampleSize,
      confidenceLevel: 0,
      method: 'NONE',
      marginOfError: null,
      sufficient: false,
      reason: `insufficient samples (${sampleSize} < ${SUFFICIENT_SAMPLE_THRESHOLD}) for ${metric}; statistical inference not justified`,
    };
  }
  const halfWidth =
    (bundle.latency.stddevMs * 1.96) / Math.max(1, Math.sqrt(sampleSize));
  return {
    sampleSize,
    confidenceLevel: 95,
    method: 'NORMAL_APPROX',
    marginOfError: Number(halfWidth.toFixed(4)),
    sufficient: true,
    reason:
      'normal approximation with t=1.96; assumes independent identically distributed samples',
  };
}

export function buildTokenCost(
  responses: readonly WorkloadResponse[],
): TokenCostBreakdown {
  const providerBreakdown: Record<string, number> = {};
  const modelBreakdown: Record<string, number> = {};
  let promptTokens = 0;
  let completionTokens = 0;
  let costUsd = 0;
  let queueWaitMs = 0;
  let providerLatencyMs = 0;
  let counted = 0;
  for (const r of responses) {
    if (r.status !== 'OK') continue;
    counted++;
    if (r.provider) {
      providerBreakdown[r.provider] =
        (providerBreakdown[r.provider] ?? 0) + (r.costUsd ?? 0);
    }
    if (r.model) {
      modelBreakdown[r.model] = (modelBreakdown[r.model] ?? 0) + 1;
    }
    promptTokens += r.promptTokens ?? 0;
    completionTokens += r.completionTokens ?? 0;
    costUsd += r.costUsd ?? 0;
    queueWaitMs += r.queueWaitMs ?? 0;
    providerLatencyMs += r.providerLatencyMs ?? 0;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd,
    costPerTaskUsd: counted === 0 ? 0 : costUsd / counted,
    providerBreakdown,
    queueWaitMs,
    providerLatencyMs,
    modelBreakdown,
  };
}

export function expectedCostPerToken(): number {
  return 0.000002;
}

export function emptyTokenCost(): TokenCostBreakdown {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    costPerTaskUsd: 0,
    providerBreakdown: {},
    queueWaitMs: 0,
    providerLatencyMs: 0,
    modelBreakdown: {},
  };
}

export function determineRegression(
  baseline: WorkloadMetricBundle | null,
  current: WorkloadMetricBundle,
  toleranceP95Ratio = 1.5,
  toleranceErrorRate = 0.05,
): {
  verdict: WorkloadMetricBundle['regressionVerdict'];
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!baseline) {
    return { verdict: 'INSUFFICIENT_EVIDENCE', reasons: ['no baseline'] };
  }
  if (baseline.latency.p95Ms <= 0 || current.latency.p95Ms <= 0) {
    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      reasons: ['zero baseline latency'],
    };
  }
  const ratio = current.latency.p95Ms / baseline.latency.p95Ms;
  const errorDelta = current.errorRate - baseline.errorRate;
  if (ratio > toleranceP95Ratio) {
    reasons.push(
      `p95 regression: ${baseline.latency.p95Ms}ms -> ${current.latency.p95Ms}ms (x${ratio.toFixed(2)})`,
    );
  }
  if (errorDelta > toleranceErrorRate) {
    reasons.push(
      `error-rate regression: ${(baseline.errorRate * 100).toFixed(2)}% -> ${(current.errorRate * 100).toFixed(2)}%`,
    );
  }
  if (reasons.length === 0) return { verdict: 'PASSED', reasons: [] };
  return { verdict: 'REGRESSED', reasons };
}

export const WORKLOAD_KINDS: readonly WorkloadKind[] = [
  'BASELINE_COLD',
  'BASELINE_WARM',
  'SPIKE',
  'STRESS',
  'SOAK',
  'PROVIDER_THROTTLE',
  'QUEUE_PRESSURE',
  'DB_PRESSURE',
  'CACHE_PRESSURE',
  'CONCURRENT_TENANTS',
  'CONCURRENT_AGENTS',
  'RECOVERY',
] as const;

export class SimulatedWorkloadPort implements WorkloadPort {
  constructor(
    private readonly provider: ProviderPort = new InMemoryProviderPort(),
    private readonly db: DbPort = new InMemoryDbPort(),
    private readonly cache: CachePort = new InMemoryCachePort(),
    private readonly queue: QueuePort = new InMemoryQueuePort(),
    private readonly perRequestTimeoutMs: number = 5000,
  ) {}

  async execute(
    req: WorkloadRequest,
    signal: AbortSignal,
  ): Promise<WorkloadResponse> {
    const t0 = Date.now();
    if (signal.aborted) {
      return {
        requestId: req.requestId,
        status: 'CANCELLED',
        durationMs: 0,
        attempts: 0,
      };
    }
    const idx =
      req.payload && typeof req.payload === 'object' && 'idx' in req.payload
        ? (req.payload as { idx: unknown }).idx
        : 'x';
    const cacheKey = `phase8:${req.tenantId}:${String(idx)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return {
        requestId: req.requestId,
        status: 'OK',
        durationMs: 1,
        provider: 'cache',
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        model: 'cache',
        queueWaitMs: 0,
        providerLatencyMs: 0,
        attempts: 1,
      };
    }
    await Promise.race([
      this.db.query('SELECT 1'),
      abortableSleep(this.perRequestTimeoutMs, signal),
    ]).catch(() => undefined);
    if (signal.aborted) {
      return {
        requestId: req.requestId,
        status: 'CANCELLED',
        durationMs: Date.now() - t0,
        attempts: 1,
      };
    }
    try {
      const r = await this.provider.invoke(`req:${req.requestId}`);
      await this.cache.set(cacheKey, r.text, 5000);
      return {
        requestId: req.requestId,
        status: 'OK',
        durationMs: Date.now() - t0,
        provider: 'simulated',
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        costUsd: r.costUsd,
        model: r.model,
        queueWaitMs: 0,
        providerLatencyMs: r.providerLatencyMs,
        attempts: 1,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isolationBreach = msg.includes('isolation-breach');
      return {
        requestId: req.requestId,
        status: isolationBreach ? 'ERROR' : 'TIMEOUT',
        durationMs: Date.now() - t0,
        failureReason: msg,
        isolationBreach,
        attempts: 1,
      };
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface Phase8AdapterRegistry {
  register(
    adapter: import('./contracts').Phase8ProductionAdapter,
    port?: object,
  ): void;
  resolve(
    adapter: import('./contracts').Phase8ProductionAdapter,
  ): object | null;
  list(): import('./contracts').Phase8ProductionAdapter[];
  registrations(): import('./contracts').AdapterRegistration[];
}

export class InMemoryPhase8AdapterRegistry implements Phase8AdapterRegistry {
  private readonly map = new Map<
    import('./contracts').Phase8ProductionAdapter,
    object
  >();
  private readonly stamps: import('./contracts').AdapterRegistration[] = [];

  register(
    adapter: import('./contracts').Phase8ProductionAdapter,
    port: object,
  ): void {
    if (this.map.has(adapter)) {
      throw new Error(`Phase 8 adapter ${adapter} already registered`);
    }
    this.map.set(adapter, port);
    this.stamps.push({
      schemaVersion: '1.0.0',
      adapter,
      status: 'REGISTERED',
      reason: 'production adapter registered',
      registeredAt: new Date().toISOString(),
    });
  }

  resolve(
    adapter: import('./contracts').Phase8ProductionAdapter,
  ): object | null {
    return this.map.get(adapter) ?? null;
  }

  list(): import('./contracts').Phase8ProductionAdapter[] {
    return [...this.map.keys()];
  }

  registrations(): import('./contracts').AdapterRegistration[] {
    return [...this.stamps];
  }
}

export const UNSUPPORTED_ADAPTER_REASON =
  'PHASE8_ADAPTER_UNSUPPORTED: production adapter is not registered; fail-closed defaults required';

export class UnsupportedPhase8Adapters implements Phase8AdapterRegistry {
  readonly status = 'UNSUPPORTED' as const;
  readonly reason = UNSUPPORTED_ADAPTER_REASON;

  register(_a?: unknown, _b?: unknown): never {
    throw new Error(UNSUPPORTED_ADAPTER_REASON);
  }

  resolve(_adapter: import('./contracts').Phase8ProductionAdapter): null {
    return null;
  }

  list(): [] {
    return [];
  }

  registrations(): import('./contracts').AdapterRegistration[] {
    return [];
  }
}

export function listAdapters(): import('./contracts').Phase8ProductionAdapter[] {
  return [
    'WORKLOAD_PORT',
    'METRICS_PORT',
    'PRESSURE_PORT',
    'CACHE_PORT',
    'DB_PORT',
    'QUEUE_PORT',
    'PROVIDER_PORT',
    'CORRECTNESS_ORACLE',
    'ISOLATION_ORACLE',
    'CLEANUP_PORT',
    'OBSERVABILITY_PORT',
  ];
}

export function unsupportedRegistrationStamps(): import('./contracts').AdapterRegistration[] {
  const now = new Date().toISOString();
  return listAdapters().map((adapter) => ({
    schemaVersion: '1.0.0',
    adapter,
    status: 'UNSUPPORTED' as const,
    reason: UNSUPPORTED_ADAPTER_REASON,
    registeredAt: now,
  }));
}

export const PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX =
  'PHASE8_PROD_ADAPTER_UNSUPPORTED';

export interface ProductionAdapterStubBase {
  readonly adapter: import('./contracts').Phase8ProductionAdapter;
  readonly status: 'UNSUPPORTED';
  readonly reason: string;
  readonly registeredAt: string;
  assertNotInvoked(method: string): never;
}

export class UnsupportedProductionAdapterStub implements ProductionAdapterStubBase {
  readonly status = 'UNSUPPORTED' as const;
  readonly registeredAt: string;
  readonly reason: string;

  constructor(
    public readonly adapter: import('./contracts').Phase8ProductionAdapter,
    private readonly stubVersion: string = '1.0.0',
  ) {
    this.registeredAt = new Date().toISOString();
    this.reason = `${PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX}: production ${adapter} adapter is intentionally a stub; it cannot measure real infrastructure. Wire a real adapter via InMemoryPhase8AdapterRegistry.register() before invoking.`;
  }

  assertNotInvoked(method: string): never {
    throw new Error(
      `${PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX}: method=${method} adapter=${this.adapter} version=${this.stubVersion}`,
    );
  }
}

export function unsupportedProductionAdapterStubs(): Record<
  import('./contracts').Phase8ProductionAdapter,
  UnsupportedProductionAdapterStub
> {
  const out = {} as Record<
    import('./contracts').Phase8ProductionAdapter,
    UnsupportedProductionAdapterStub
  >;
  for (const a of listAdapters()) {
    out[a] = new UnsupportedProductionAdapterStub(a);
  }
  return out;
}
