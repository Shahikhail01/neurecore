import { z } from 'zod';
import {
  SemverSchema,
  UuidSchema,
  IsoDateTimeSchema,
  Sha256ChecksumSchema,
  EvidenceEnvelopeSchema,
  RunOutcomeSchema,
} from '../contracts';

export const PHASE7_VERSION = '1.1.0';
export const PHASE7_COMPATIBILITY_POLICY =
  'strict-v1: additive-optional = minor, required-field or semantic change = major';

export const ExecutionEnvironmentSchema = z.enum([
  'IN_MEMORY_CONFORMANCE',
  'PRODUCTION',
]);
export type ExecutionEnvironment = z.infer<typeof ExecutionEnvironmentSchema>;

export const ProductionAdapterStatusSchema = z.object({
  isolationPort: z.enum(['REGISTERED', 'UNREGISTERED']),
  adversarialPort: z.enum(['REGISTERED', 'UNREGISTERED']),
  abusePort: z.enum(['REGISTERED', 'UNREGISTERED']),
  unsafeActionPort: z.enum(['REGISTERED', 'UNREGISTERED']),
  complianceEvidencePort: z.enum(['REGISTERED', 'UNREGISTERED']),
  reviewPort: z.enum(['REGISTERED', 'UNREGISTERED']),
  durableReviewQueueStore: z.enum(['REGISTERED', 'UNREGISTERED']),
  cleanupPort: z.enum(['REGISTERED', 'UNREGISTERED']),
});
export type ProductionAdapterStatus = z.infer<
  typeof ProductionAdapterStatusSchema
>;

export const ExternalApprovalStatusSchema = z.object({
  securityApproved: z.boolean(),
  complianceApproved: z.boolean(),
  approvedBy: z.array(z.string().min(1)).default([]),
  approvedAt: z.array(IsoDateTimeSchema).default([]),
  notes: z.array(z.string().min(1)).default([]),
});
export type ExternalApprovalStatus = z.infer<
  typeof ExternalApprovalStatusSchema
>;

export const DeterministicMeasurementSchema = z
  .object({
    mode: z.literal('DETERMINISTIC'),
    repetitionCount: z.number().int().positive(),
    observedVariance: z.enum([
      'ZERO_VARIANCE',
      'NON_ZERO_VARIANCE',
      'PARTIAL_VARIANCE',
    ]),
    entropyBits: z.number().nonnegative(),
    deterministicInputs: z.array(z.string().min(1)),
    nondeterministicInputs: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type DeterministicMeasurement = z.infer<
  typeof DeterministicMeasurementSchema
>;

export const OperationalAlertSeveritySchema = z.enum([
  'INFO',
  'WARNING',
  'CRITICAL',
]);
export type OperationalAlertSeverity = z.infer<
  typeof OperationalAlertSeveritySchema
>;

export const OperationalAlertResultSchema = z
  .object({
    alertId: UuidSchema,
    category: z.enum([
      'CLEANUP_FAILURE',
      'ORPHAN_RESOURCE',
      'EVIDENCE_CORRUPTION',
      'UNSUPPORTED_ROUTING',
      'CRITICAL_RUNNER_FAILURE',
    ]),
    severity: OperationalAlertSeveritySchema,
    target: z.string().min(1),
    message: z.string().min(1),
    emittedAt: IsoDateTimeSchema,
    delivered: z.boolean(),
    routing: z.enum(['IN_MEMORY', 'UNSUPPORTED']),
  })
  .strict();
export type OperationalAlertResult = z.infer<
  typeof OperationalAlertResultSchema
>;

export const IsolationLayerSchema = z.enum([
  'CONTROLLER',
  'SERVICE',
  'COMMAND',
  'REPOSITORY',
  'CACHE',
  'VECTOR',
  'FILES',
  'QUEUE',
  'SOCKET',
  'LOG',
  'EXPORT',
  'TELEMETRY',
]);
export type IsolationLayer = z.infer<typeof IsolationLayerSchema>;

export const IsolationActionSchema = z.enum([
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'EXECUTE',
  'EXPORT',
  'SUBSCRIBE',
  'ENQUEUE',
  'SEARCH',
]);
export type IsolationAction = z.infer<typeof IsolationActionSchema>;

export const IsolationResourceSchema = z.enum([
  'PROJECT',
  'GOAL',
  'TASK',
  'EXECUTION_ATTEMPT',
  'REVIEW',
  'EVIDENCE_ARTIFACT',
  'KNOWLEDGE_DOCUMENT',
  'CACHE_ENTRY',
  'VECTOR_ENTRY',
  'FILE',
  'QUEUE_MESSAGE',
  'SOCKET_EVENT',
  'LOG_ENTRY',
  'EXPORT_RECORD',
  'TELEMETRY_SPAN',
]);
export type IsolationResource = z.infer<typeof IsolationResourceSchema>;

export const IsolationExpectedSchema = z.enum([
  'ALLOW',
  'DENY',
  'NOT_FOUND',
  'REDACT',
]);
export type IsolationExpected = z.infer<typeof IsolationExpectedSchema>;

export const IsolationCaseSchema = z
  .object({
    schemaVersion: SemverSchema,
    caseId: z.string().min(1),
    tenantId: UuidSchema,
    foreignTenantId: UuidSchema,
    resource: IsolationResourceSchema,
    action: IsolationActionSchema,
    layer: IsolationLayerSchema,
    expected: IsolationExpectedSchema,
  })
  .strict();
export type IsolationCase = z.infer<typeof IsolationCaseSchema>;

export const AdversarialCategorySchema = z.enum([
  'PROMPT_INJECTION',
  'EXFILTRATION',
  'SSRF',
  'UNSAFE_TOOL',
  'AUTHORIZATION_BYPASS',
  'ABUSE',
  'POISONING',
]);
export type AdversarialCategory = z.infer<typeof AdversarialCategorySchema>;

export const AdversarialCaseSchema = z
  .object({
    schemaVersion: SemverSchema,
    caseId: z.string().min(1),
    category: AdversarialCategorySchema,
    payload: z.string().min(1),
    expected: z.literal('DENY'),
  })
  .strict();
export type AdversarialCase = z.infer<typeof AdversarialCaseSchema>;

export const AbuseCaseSchema = z
  .object({
    schemaVersion: SemverSchema,
    caseId: z.string().min(1),
    scenario: z.enum([
      'RATE_BURST',
      'BUDGET_EXHAUSTION',
      'LOOP',
      'SUSTAINED_RETRY',
    ]),
    expectedTerminal: z.enum([
      'RATE_LIMITED',
      'BUDGET_DENIED',
      'CYCLE_DETECTED',
      'CIRCUIT_OPEN',
    ]),
    threshold: z
      .object({
        windowMs: z.number().int().positive().optional(),
        maxInWindow: z.number().int().positive().optional(),
        maxTotal: z.number().int().positive().optional(),
        maxConsecutiveFailures: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type AbuseCase = z.infer<typeof AbuseCaseSchema>;

export const UnsafeActionCaseSchema = z
  .object({
    schemaVersion: SemverSchema,
    caseId: z.string().min(1),
    action: z.enum([
      'PAYMENT',
      'DESTRUCTIVE_WRITE',
      'EXTERNAL_WEBHOOK',
      'BULK_EXPORT',
    ]),
    expected: z.literal('REQUIRE_APPROVAL'),
  })
  .strict();
export type UnsafeActionCase = z.infer<typeof UnsafeActionCaseSchema>;

export const JurisdictionSchema = z.enum(['GLOBAL', 'EU', 'US', 'UK']);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const ComplianceBehaviorSchema = z.enum([
  'RETENTION',
  'CONSENT',
  'LEGAL_HOLD',
  'ERASURE',
  'EXPORT',
  'RESIDENCY',
]);
export type ComplianceBehavior = z.infer<typeof ComplianceBehaviorSchema>;

export const ComplianceControlSchema = z
  .object({
    schemaVersion: SemverSchema,
    controlId: z.string().min(1),
    jurisdiction: JurisdictionSchema,
    behavior: ComplianceBehaviorSchema,
    retentionClass: z.enum([
      'SHORT_TERM',
      'MEDIUM_TERM',
      'LONG_TERM',
      'PERMANENT',
    ]),
    evidenceRequired: z.array(z.string().min(1)).min(1),
    description: z.string().min(1),
  })
  .strict();
export type ComplianceControl = z.infer<typeof ComplianceControlSchema>;

export const ComplianceExecutionOutcomeSchema = z.enum([
  'PASSED',
  'FAILED',
  'INSUFFICIENT_EVIDENCE',
]);
export type ComplianceExecutionOutcome = z.infer<
  typeof ComplianceExecutionOutcomeSchema
>;

export const ReviewDecisionSchema = z.enum([
  'APPROVED',
  'REJECTED',
  'REVISED',
  'EXPIRED',
  'ESCALATED',
]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewPacketSchema = z
  .object({
    schemaVersion: SemverSchema,
    reviewId: UuidSchema,
    tenantId: UuidSchema,
    executionId: UuidSchema,
    reviewerId: z.string().min(1),
    subjectActorId: z.string().min(1),
    independence: z.boolean(),
    slaMinutes: z.number().int().positive(),
    escalationAfterMinutes: z.number().int().positive(),
    decision: ReviewDecisionSchema,
    decidedAt: z.string().datetime().nullable(),
    rationale: z.string().min(1).optional(),
  })
  .strict();
export type ReviewPacket = z.infer<typeof ReviewPacketSchema>;

export const ReviewQueueAssignmentSchema = z
  .object({
    assignmentId: UuidSchema,
    reviewId: UuidSchema,
    tenantId: UuidSchema,
    reviewerId: z.string().min(1),
    assignedAt: IsoDateTimeSchema,
    slaDeadline: IsoDateTimeSchema,
  })
  .strict();
export type ReviewQueueAssignment = z.infer<typeof ReviewQueueAssignmentSchema>;

export const EscalationEventSchema = z
  .object({
    escalationId: UuidSchema,
    reviewId: UuidSchema,
    triggeredAt: IsoDateTimeSchema,
    reason: z.enum([
      'SLA_TIMEOUT',
      'ESCALATION_THRESHOLD',
      'INDEPENDENCE_BREACH',
    ]),
    toRole: z.string().min(1),
  })
  .strict();
export type EscalationEvent = z.infer<typeof EscalationEventSchema>;

export const Phase7ReportStatusSchema = z.enum([
  'PASS',
  'BLOCK',
  'INCONCLUSIVE',
]);
export type Phase7ReportStatus = z.infer<typeof Phase7ReportStatusSchema>;

export const Phase7CountersSchema = z
  .object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    inconclusive: z.number().int().nonnegative(),
    criticalFailures: z.number().int().nonnegative(),
  })
  .strict();
export type Phase7Counters = z.infer<typeof Phase7CountersSchema>;

export const Phase7CaseResultSchema = z
  .object({
    caseId: z.string().min(1),
    expected: z.string().min(1),
    observed: z.string().min(1),
    passed: z.boolean(),
    criticalFailure: z.boolean(),
    evidenceRefs: z.array(z.string().min(1)),
    provenance: z.string().min(1),
  })
  .strict();
export type Phase7CaseResult = z.infer<typeof Phase7CaseResultSchema>;

export const Phase7CleanupOutcomeSchema = z
  .object({
    attempted: z.boolean(),
    success: z.boolean(),
    cleanedResources: z.array(z.string().min(1)).default([]),
    failedCleanup: z.array(z.string().min(1)).default([]),
    orphanedResources: z.array(z.string().min(1)).default([]),
    notAttemptedReason: z
      .enum([
        'NOT_REQUESTED',
        'NO_ENVELOPES',
        'CANCELLED_BEFORE_CLEANUP',
        'PRODUCTION_ADAPTER_UNREGISTERED',
      ])
      .optional(),
  })
  .strict()
  .transform((v, ctx) => {
    if (!v.attempted && v.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cleanup.success must be false when cleanup was not attempted',
      });
      return z.NEVER;
    }
    return v;
  });
export type Phase7CleanupOutcome = z.infer<typeof Phase7CleanupOutcomeSchema>;

export const Phase7RunnerReportSchema = z
  .object({
    schemaVersion: SemverSchema,
    runnerId: z.string().min(1),
    runId: UuidSchema,
    tenantId: UuidSchema,
    startedAt: IsoDateTimeSchema,
    finalizedAt: IsoDateTimeSchema,
    counters: Phase7CountersSchema,
    status: Phase7ReportStatusSchema,
    caseResults: z.array(Phase7CaseResultSchema),
    evidenceEnvelopes: z.array(EvidenceEnvelopeSchema),
    cleanupResult: Phase7CleanupOutcomeSchema,
    reportChecksum: Sha256ChecksumSchema,
    outcome: RunOutcomeSchema,
    notes: z.array(z.string().min(1)).default([]),
    executionEnvironment: ExecutionEnvironmentSchema,
    productionAdapterStatus: ProductionAdapterStatusSchema,
    externalApprovalStatus: ExternalApprovalStatusSchema,
    deterministicMeasurement: DeterministicMeasurementSchema,
    cleanupAttempted: z.boolean(),
    operationalAlerts: z.array(OperationalAlertResultSchema).default([]),
  })
  .strict();
export type Phase7RunnerReport = z.infer<typeof Phase7RunnerReportSchema>;

export const ISOLATION_RESOURCES = IsolationResourceSchema.options;
export const ISOLATION_ACTIONS = IsolationActionSchema.options;
export const ISOLATION_LAYERS = IsolationLayerSchema.options;

// ============================================================
// REPORT MIGRATION (versioned)
// ============================================================

export type Phase7ReportMigration = (raw: unknown) => {
  report: Phase7RunnerReport;
  migratedFrom: string | null;
};

export const PHASE7_REPORT_MIGRATIONS: Record<string, Phase7ReportMigration> = {
  '1.0.0': (raw) => {
    const obj = raw as Record<string, unknown> & {
      cleanupResult?: {
        success?: boolean;
        cleanedResources?: string[];
        failedCleanup?: string[];
        orphanedResources?: string[];
      };
    };
    const cleanup = obj.cleanupResult ?? {
      success: false,
      cleanedResources: [],
      failedCleanup: [],
      orphanedResources: [],
    };
    const attempted =
      (cleanup.cleanedResources?.length ?? 0) +
        (cleanup.failedCleanup?.length ?? 0) +
        (cleanup.orphanedResources?.length ?? 0) >
      0;
    const migrated = {
      ...obj,
      schemaVersion: '1.1.0',
      cleanupResult: {
        attempted,
        success: cleanup.success === true && attempted,
        cleanedResources: cleanup.cleanedResources ?? [],
        failedCleanup: cleanup.failedCleanup ?? [],
        orphanedResources: cleanup.orphanedResources ?? [],
        notAttemptedReason: attempted ? undefined : 'NOT_REQUESTED',
      },
      cleanupAttempted: attempted,
      executionEnvironment: obj.executionEnvironment ?? 'IN_MEMORY_CONFORMANCE',
      productionAdapterStatus: obj.productionAdapterStatus ?? {
        isolationPort: 'UNREGISTERED',
        adversarialPort: 'UNREGISTERED',
        abusePort: 'UNREGISTERED',
        unsafeActionPort: 'UNREGISTERED',
        complianceEvidencePort: 'UNREGISTERED',
        reviewPort: 'UNREGISTERED',
        durableReviewQueueStore: 'UNREGISTERED',
        cleanupPort: 'UNREGISTERED',
      },
      externalApprovalStatus: obj.externalApprovalStatus ?? {
        securityApproved: false,
        complianceApproved: false,
        approvedBy: [],
        approvedAt: [],
        notes: [],
      },
      deterministicMeasurement: obj.deterministicMeasurement ?? {
        mode: 'DETERMINISTIC',
        repetitionCount: 1,
        observedVariance: 'ZERO_VARIANCE',
        entropyBits: 0,
        deterministicInputs: [],
        nondeterministicInputs: [],
        notes: ['migrated from 1.0.0'],
      },
      operationalAlerts: obj.operationalAlerts ?? [],
    };
    return {
      report: Phase7RunnerReportSchema.parse(migrated),
      migratedFrom: '1.0.0',
    };
  },
  '1.1.0': (raw) => ({
    report: Phase7RunnerReportSchema.parse(raw),
    migratedFrom: null,
  }),
};

export function migratePhase7Report(raw: unknown): {
  report: Phase7RunnerReport;
  migratedFrom: string | null;
} {
  const obj = raw as { schemaVersion?: string };
  const v = obj.schemaVersion ?? '1.0.0';
  const fn = PHASE7_REPORT_MIGRATIONS[v];
  if (!fn) {
    throw new Error(
      `Phase 7 report schemaVersion ${v} has no registered migration`,
    );
  }
  return fn(raw);
}

export function restorePhase7Report(jsonText: string): {
  report: Phase7RunnerReport;
  migratedFrom: string | null;
} {
  const raw: unknown = JSON.parse(jsonText);
  return migratePhase7Report(raw);
}
