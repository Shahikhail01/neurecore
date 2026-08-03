import { z } from 'zod';
import {
  SemverSchema,
  UuidSchema,
  IsoDateTimeSchema,
  Sha256ChecksumSchema,
  EvidenceEnvelopeSchema,
  RunOutcomeSchema,
  CleanupResultSchema,
} from '../contracts';

export const PHASE8_VERSION = '1.1.0';
export const PHASE8_COMPATIBILITY_POLICY =
  'strict-v1: additive-optional = minor, required-field or semantic change = major';

export const Phase8EnvironmentClassSchema = z.enum([
  'SIMULATED',
  'LOCAL',
  'CI',
  'STAGING',
  'PRODUCTION_PROBE',
  'PRODUCTION',
]);
export type Phase8EnvironmentClass = z.infer<
  typeof Phase8EnvironmentClassSchema
>;

export const WorkloadKindSchema = z.enum([
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
]);
export type WorkloadKind = z.infer<typeof WorkloadKindSchema>;

export const WorkloadProfileSchema = z
  .object({
    schemaVersion: SemverSchema,
    profileId: z.string().min(1),
    kind: WorkloadKindSchema,
    tenantCount: z.number().int().positive(),
    agentCount: z.number().int().positive(),
    targetRps: z.number().nonnegative(),
    durationMs: z.number().int().positive(),
    concurrency: z.number().int().positive(),
    arrivalPattern: z.enum(['CONSTANT', 'POISSON', 'BURST', 'RAMP', 'STEP']),
    seed: z.string().min(1).optional(),
    windows: z.number().int().positive().optional(),
    pressureConfig: z
      .object({
        cacheMissRatio: z.number().min(0).max(1).optional(),
        dbP99Ms: z.number().nonnegative().optional(),
        queueBacklog: z.number().int().nonnegative().optional(),
        providerThrottlePercent: z.number().min(0).max(100).optional(),
        providerDelayMs: z.number().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type WorkloadProfile = z.infer<typeof WorkloadProfileSchema>;

export const ResourceSampleSchema = z
  .object({
    timestamp: IsoDateTimeSchema,
    cpuPercent: z.number().min(0).max(100).optional(),
    memoryMb: z.number().nonnegative().optional(),
    queueDepth: z.number().int().nonnegative().optional(),
    dbConnections: z.number().int().nonnegative().optional(),
    cacheHitRatio: z.number().min(0).max(1).optional(),
    inflight: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ResourceSample = z.infer<typeof ResourceSampleSchema>;

export const LatencyDistributionSchema = z
  .object({
    p50Ms: z.number().nonnegative(),
    p95Ms: z.number().nonnegative(),
    p99Ms: z.number().nonnegative(),
    maxMs: z.number().nonnegative(),
    meanMs: z.number().nonnegative(),
    stddevMs: z.number().nonnegative(),
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();
export type LatencyDistribution = z.infer<typeof LatencyDistributionSchema>;

export const ConfidenceIntervalSchema = z
  .object({
    metric: z.string().min(1),
    lower: z.number().finite(),
    upper: z.number().finite(),
    confidenceLevel: z.number().min(0).max(100),
    sampleSize: z.number().int().nonnegative(),
    method: z.enum(['NORMAL_APPROX', 'BOOTSTRAP', 'WILCOXON', 'NONE']),
  })
  .strict();
export type ConfidenceInterval = z.infer<typeof ConfidenceIntervalSchema>;

export const TokenCostBreakdownSchema = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    costPerTaskUsd: z.number().nonnegative(),
    providerBreakdown: z
      .record(z.string().min(1), z.number().nonnegative())
      .default({}),
    queueWaitMs: z.number().nonnegative().default(0),
    providerLatencyMs: z.number().nonnegative().default(0),
    modelBreakdown: z
      .record(z.string().min(1), z.number().int().nonnegative())
      .default({}),
  })
  .strict();
export type TokenCostBreakdown = z.infer<typeof TokenCostBreakdownSchema>;

export const RegressionVerdictSchema = z.enum([
  'PASSED',
  'REGRESSED',
  'INSUFFICIENT_EVIDENCE',
  'NOT_APPLICABLE',
]);
export type RegressionVerdict = z.infer<typeof RegressionVerdictSchema>;

export const CorrectnessVerdictSchema = z.enum([
  'PASSED',
  'FAILED',
  'INCONCLUSIVE',
]);
export type CorrectnessVerdict = z.infer<typeof CorrectnessVerdictSchema>;

export const IsolationVerdictSchema = z.enum([
  'PASSED',
  'FAILED',
  'INCONCLUSIVE',
]);
export type IsolationVerdict = z.infer<typeof IsolationVerdictSchema>;

export const SaturationPointSchema = z
  .object({
    metric: z.string().min(1),
    inflectionValue: z.number().finite(),
    unit: z.string().min(1),
    observedAt: IsoDateTimeSchema,
    detection: z.enum([
      'P95_DERIVATIVE',
      'ERROR_RATE',
      'QUEUE_DEPTH',
      'DB_CONNECTIONS',
      'CPU_PERCENT',
      'CACHE_HIT_RATIO',
      'PROVIDER_LATENCY',
    ]),
    curve: z.array(ResourceSampleSchema),
  })
  .strict();
export type SaturationPoint = z.infer<typeof SaturationPointSchema>;

export const SoakWindowSchema = z
  .object({
    schemaVersion: SemverSchema,
    windowIndex: z.number().int().nonnegative(),
    startedAt: IsoDateTimeSchema,
    finalizedAt: IsoDateTimeSchema,
    sampleSize: z.number().int().nonnegative(),
    p95Ms: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    driftP95Ms: z.number().finite(),
    driftErrorRate: z.number().finite(),
    passed: z.boolean(),
  })
  .strict();
export type SoakWindow = z.infer<typeof SoakWindowSchema>;

export const RecoveryCurveSchema = z
  .object({
    schemaVersion: SemverSchema,
    startedAt: IsoDateTimeSchema,
    recoveredAt: IsoDateTimeSchema,
    recoveryTimeMs: z.number().int().nonnegative(),
    trailingP95Ms: z.number().nonnegative(),
    trailingErrorRate: z.number().min(0).max(1),
    pressureCurve: z.array(ResourceSampleSchema),
    recoveryCurve: z.array(ResourceSampleSchema),
  })
  .strict();
export type RecoveryCurve = z.infer<typeof RecoveryCurveSchema>;

export const SloThresholdSchema = z
  .object({
    metric: z.string().min(1),
    operator: z.enum(['LTE', 'GTE', 'LT', 'GT']),
    value: z.number().finite(),
    unit: z.string().min(1),
  })
  .strict();
export type SloThreshold = z.infer<typeof SloThresholdSchema>;

export const SloPolicySchema = z
  .object({
    schemaVersion: SemverSchema,
    policyId: z.string().min(1),
    approvedBy: z.string().min(1).nullable(),
    approvedAt: IsoDateTimeSchema.nullable(),
    approvedEnvironment: Phase8EnvironmentClassSchema.nullable(),
    errorBudgetPercent: z.number().min(0).max(100),
    thresholds: z.array(SloThresholdSchema).min(1),
    minimumSampleSize: z.number().int().nonnegative(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type SloPolicy = z.infer<typeof SloPolicySchema>;

export const SloEvaluationStatusSchema = z.enum([
  'PASS',
  'BREACH',
  'INSUFFICIENT_EVIDENCE',
  'UNAPPROVED',
  'UNSUPPORTED_ENVIRONMENT',
]);
export type SloEvaluationStatus = z.infer<typeof SloEvaluationStatusSchema>;

export const SloThresholdResultSchema = z
  .object({
    metric: z.string().min(1),
    observed: z.number().finite(),
    threshold: SloThresholdSchema,
    passed: z.boolean(),
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();
export type SloThresholdResult = z.infer<typeof SloThresholdResultSchema>;

export const SloEvaluationSchema = z
  .object({
    schemaVersion: SemverSchema,
    policyId: z.string().min(1),
    status: SloEvaluationStatusSchema,
    errorBudgetConsumedPercent: z.number().min(0).max(100).nullable(),
    errorBudgetRemainingPercent: z.number().min(0).max(100).nullable(),
    thresholdResults: z.array(SloThresholdResultSchema),
    missingSamples: z.array(z.string().min(1)).default([]),
    reasons: z.array(z.string().min(1)),
  })
  .strict();
export type SloEvaluation = z.infer<typeof SloEvaluationSchema>;

export const WorkloadMetricBundleSchema = z
  .object({
    schemaVersion: SemverSchema,
    metricBundleId: UuidSchema,
    profileId: z.string().min(1),
    startedAt: IsoDateTimeSchema,
    finalizedAt: IsoDateTimeSchema,
    latency: LatencyDistributionSchema,
    throughputRps: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    successCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
    totalRequests: z.number().int().nonnegative(),
    tokenCost: TokenCostBreakdownSchema,
    resourceCurves: z.array(ResourceSampleSchema),
    errorCurves: z.array(ResourceSampleSchema),
    confidenceIntervals: z.array(ConfidenceIntervalSchema),
    correctnessVerdict: CorrectnessVerdictSchema,
    isolationVerdict: IsolationVerdictSchema,
    saturationPoint: SaturationPointSchema.nullable(),
    recoveryCurve: RecoveryCurveSchema.nullable(),
    regressionVerdict: RegressionVerdictSchema,
    environmentClass: Phase8EnvironmentClassSchema,
    provenance: z.string().min(1),
    soakWindows: z.array(SoakWindowSchema).default([]),
    pressureEvidence: z
      .object({
        cacheHitRatio: z.number().min(0).max(1).nullable(),
        dbConnectionsPeak: z.number().int().nonnegative().nullable(),
        queueBacklogPeak: z.number().int().nonnegative().nullable(),
        providerThrottlePercent: z.number().min(0).max(100).nullable(),
        providerDelayMs: z.number().nonnegative().nullable(),
      })
      .strict()
      .default({
        cacheHitRatio: null,
        dbConnectionsPeak: null,
        queueBacklogPeak: null,
        providerThrottlePercent: null,
        providerDelayMs: null,
      }),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type WorkloadMetricBundle = z.infer<typeof WorkloadMetricBundleSchema>;

export const WorkloadResultStatusSchema = z.enum([
  'PASS',
  'BLOCK',
  'INCONCLUSIVE',
]);
export type WorkloadResultStatus = z.infer<typeof WorkloadResultStatusSchema>;

export const WorkloadCaseResultSchema = z
  .object({
    caseId: z.string().min(1),
    profileId: z.string().min(1),
    expected: z.string().min(1),
    observed: z.string().min(1),
    passed: z.boolean(),
    criticalFailure: z.boolean(),
    evidenceRefs: z.array(z.string().min(1)),
    provenance: z.string().min(1),
  })
  .strict();
export type WorkloadCaseResult = z.infer<typeof WorkloadCaseResultSchema>;

export const Phase8CountersSchema = z
  .object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    inconclusive: z.number().int().nonnegative(),
    criticalFailures: z.number().int().nonnegative(),
  })
  .strict();
export type Phase8Counters = z.infer<typeof Phase8CountersSchema>;

export const StatisticalConfidenceSchema = z
  .object({
    schemaVersion: SemverSchema,
    sampleSize: z.number().int().nonnegative(),
    confidenceLevel: z.number().min(0).max(100),
    method: z.enum(['NORMAL_APPROX', 'BOOTSTRAP', 'WILCOXON', 'NONE']),
    marginOfError: z.number().finite().nullable(),
    sufficient: z.boolean(),
    reason: z.string().min(1),
  })
  .strict();
export type StatisticalConfidence = z.infer<typeof StatisticalConfidenceSchema>;

export const RegressionEvidenceSchema = z
  .object({
    schemaVersion: SemverSchema,
    baselineRunId: UuidSchema.nullable(),
    baselineBundleId: UuidSchema.nullable(),
    baselineProvenance: z.string().min(1).nullable(),
    comparedAt: IsoDateTimeSchema,
    toleranceP95Ratio: z.number().nonnegative(),
    toleranceErrorRate: z.number().min(0).max(1),
    observedP95Ratio: z.number().nonnegative().nullable(),
    observedErrorDelta: z.number().finite().nullable(),
    reason: z.string().min(1),
  })
  .strict();
export type RegressionEvidence = z.infer<typeof RegressionEvidenceSchema>;

export const OperationalAlertSchema = z
  .object({
    schemaVersion: SemverSchema,
    alertId: UuidSchema,
    kind: z.enum([
      'CLEANUP_FAILURE',
      'CORRECTNESS_FAILURE',
      'ISOLATION_FAILURE',
      'SATURATION_DETECTED',
      'PROVIDER_THROTTLE_SUSTAINED',
      'QUEUE_BACKLOG_GROWTH',
      'RECOVERY_FAILURE',
      'UNSUPPORTED_ROUTING',
    ]),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
    message: z.string().min(1),
    profileId: z.string().min(1).nullable(),
    metricBundleId: UuidSchema.nullable(),
    runId: UuidSchema.nullable(),
    tenantId: UuidSchema.nullable(),
    observedAt: IsoDateTimeSchema,
    context: z.record(z.unknown(), z.unknown()).default({}),
  })
  .strict();
export type OperationalAlert = z.infer<typeof OperationalAlertSchema>;

export const Phase8RunnerReportSchema = z
  .object({
    schemaVersion: SemverSchema,
    runnerId: z.string().min(1),
    runId: UuidSchema,
    tenantId: UuidSchema,
    startedAt: IsoDateTimeSchema,
    finalizedAt: IsoDateTimeSchema,
    counters: Phase8CountersSchema,
    status: WorkloadResultStatusSchema,
    caseResults: z.array(WorkloadCaseResultSchema),
    metricBundles: z.array(WorkloadMetricBundleSchema),
    evidenceEnvelopes: z.array(EvidenceEnvelopeSchema),
    cleanupResult: CleanupResultSchema,
    reportChecksum: Sha256ChecksumSchema,
    outcome: RunOutcomeSchema,
    environmentClass: Phase8EnvironmentClassSchema,
    provenance: z.string().min(1),
    sloEvaluation: SloEvaluationSchema.nullable(),
    adapterRegistrations: z.array(z.string().min(1)),
    statisticalConfidence: z.array(StatisticalConfidenceSchema).default([]),
    regressionEvidence: z.array(RegressionEvidenceSchema).default([]),
    operationalAlerts: z.array(OperationalAlertSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type Phase8RunnerReport = z.infer<typeof Phase8RunnerReportSchema>;

export const Phase8ProductionAdapterSchema = z.enum([
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
]);
export type Phase8ProductionAdapter = z.infer<
  typeof Phase8ProductionAdapterSchema
>;

export const AdapterRegistrationSchema = z
  .object({
    schemaVersion: SemverSchema,
    adapter: Phase8ProductionAdapterSchema,
    status: z.enum(['REGISTERED', 'UNSUPPORTED']),
    reason: z.string().min(1),
    registeredAt: IsoDateTimeSchema,
  })
  .strict();
export type AdapterRegistration = z.infer<typeof AdapterRegistrationSchema>;

export const PHASE8_DEFAULT_PROFILES: WorkloadProfile[] = [
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'baseline-cold',
    kind: 'BASELINE_COLD',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 1,
    durationMs: 2000,
    concurrency: 1,
    arrivalPattern: 'CONSTANT',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'baseline-warm',
    kind: 'BASELINE_WARM',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 5,
    durationMs: 2000,
    concurrency: 4,
    arrivalPattern: 'CONSTANT',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'spike',
    kind: 'SPIKE',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 50,
    durationMs: 1500,
    concurrency: 16,
    arrivalPattern: 'BURST',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'stress',
    kind: 'STRESS',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 200,
    durationMs: 2000,
    concurrency: 32,
    arrivalPattern: 'RAMP',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'soak',
    kind: 'SOAK',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 5,
    durationMs: 5000,
    concurrency: 4,
    arrivalPattern: 'POISSON',
    windows: 5,
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'provider-throttle',
    kind: 'PROVIDER_THROTTLE',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 20,
    durationMs: 2000,
    concurrency: 8,
    arrivalPattern: 'CONSTANT',
    pressureConfig: {
      providerThrottlePercent: 40,
      providerDelayMs: 30,
    },
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'queue-pressure',
    kind: 'QUEUE_PRESSURE',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 100,
    durationMs: 2000,
    concurrency: 16,
    arrivalPattern: 'STEP',
    pressureConfig: {
      queueBacklog: 200,
    },
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'db-pressure',
    kind: 'DB_PRESSURE',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 80,
    durationMs: 2000,
    concurrency: 12,
    arrivalPattern: 'CONSTANT',
    pressureConfig: {
      dbP99Ms: 250,
    },
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'cache-pressure',
    kind: 'CACHE_PRESSURE',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 100,
    durationMs: 2000,
    concurrency: 8,
    arrivalPattern: 'CONSTANT',
    pressureConfig: {
      cacheMissRatio: 0.95,
    },
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'concurrent-tenants',
    kind: 'CONCURRENT_TENANTS',
    tenantCount: 4,
    agentCount: 1,
    targetRps: 10,
    durationMs: 2000,
    concurrency: 8,
    arrivalPattern: 'CONSTANT',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'concurrent-agents',
    kind: 'CONCURRENT_AGENTS',
    tenantCount: 1,
    agentCount: 4,
    targetRps: 20,
    durationMs: 2000,
    concurrency: 8,
    arrivalPattern: 'CONSTANT',
  },
  {
    schemaVersion: PHASE8_VERSION,
    profileId: 'recovery',
    kind: 'RECOVERY',
    tenantCount: 1,
    agentCount: 1,
    targetRps: 10,
    durationMs: 2500,
    concurrency: 4,
    arrivalPattern: 'CONSTANT',
    pressureConfig: {
      providerThrottlePercent: 60,
      providerDelayMs: 80,
      queueBacklog: 50,
    },
  },
];
