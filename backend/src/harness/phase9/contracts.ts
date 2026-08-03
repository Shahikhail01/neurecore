import { z } from 'zod';
import {
  SemverSchema,
  UuidSchema,
  IsoDateTimeSchema,
  Sha256ChecksumSchema,
  EvidenceEnvelopeSchema,
  RiskTierSchema,
  CertificateVerdictSchema,
  CertificateStatusSchema,
  SignatureSchema,
  REQUIRED_SIGNATURES_BY_TIER,
} from '../contracts';
import { WaiverRecordSchema } from '../quarantine';

export const PHASE9_VERSION = '1.0.0';
export const PHASE9_COMPATIBILITY_POLICY =
  'strict-v1: additive-optional = minor, required-field or semantic change = major';

export const Phase9EnvironmentClassSchema = z.enum([
  'SIMULATED',
  'LOCAL',
  'CI',
  'STAGING',
  'PRODUCTION_PROBE',
  'PRODUCTION',
]);
export type Phase9EnvironmentClass = z.infer<
  typeof Phase9EnvironmentClassSchema
>;

// ============================================================
// CAPABILITY REGISTRY
// ============================================================

export const CapabilityRegistryEntrySchema = z
  .object({
    schemaVersion: SemverSchema,
    capabilityId: z.string().min(1),
    capabilityVersion: SemverSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    riskTier: RiskTierSchema,
    owner: z.object({
      ownerId: z.string().min(1),
      ownerRole: z.string().min(1),
      confirmedAt: IsoDateTimeSchema,
    }),
    environmentScope: z
      .object({
        environmentClass: Phase9EnvironmentClassSchema,
        modelProvider: z.string().min(1).optional(),
        modelVersion: SemverSchema.optional(),
        buildId: z.string().min(1).optional(),
      })
      .strict(),
    requiredSuites: z.array(z.string().min(1)).min(1),
    surfaces: z.array(z.string().min(1)).min(1),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type CapabilityRegistryEntry = z.infer<
  typeof CapabilityRegistryEntrySchema
>;

// ============================================================
// RISK TIER GATE POLICY
// ============================================================

export const GateThresholdSchema = z
  .object({
    metric: z.string().min(1),
    operator: z.enum(['LTE', 'GTE', 'LT', 'GT']),
    value: z.number().finite(),
    unit: z.string().min(1),
  })
  .strict();
export type GateThreshold = z.infer<typeof GateThresholdSchema>;

export const RiskTierGatePolicySchema = z
  .object({
    schemaVersion: SemverSchema,
    riskTier: RiskTierSchema,
    fullSuiteIds: z.array(z.string().min(1)).min(1),
    requiredSuiteIds: z.array(z.string().min(1)).min(1),
    thresholds: z.array(GateThresholdSchema).default([]),
    waiversAllowed: z.boolean().default(false),
    rollbackDrillRequired: z.boolean().default(true),
    minimumSampleSize: z.number().int().nonnegative().default(0),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type RiskTierGatePolicy = z.infer<typeof RiskTierGatePolicySchema>;

// ============================================================
// CHANGED SURFACE SELECTOR
// ============================================================

export const ChangedSurfaceKindSchema = z.enum([
  'SOURCE',
  'TEST',
  'CONTRACT',
  'PROMPT',
  'DATASET',
  'CONFIG',
  'DOCS',
  'INFRA',
  'POLICY',
  'CAPABILITY_REGISTRY',
]);
export type ChangedSurfaceKind = z.infer<typeof ChangedSurfaceKindSchema>;

export const ChangedSurfaceSchema = z
  .object({
    changeId: UuidSchema,
    path: z.string().min(1),
    kind: ChangedSurfaceKindSchema,
    capabilityId: z.string().min(1).optional(),
    riskTier: RiskTierSchema.optional(),
  })
  .strict();
export type ChangedSurface = z.infer<typeof ChangedSurfaceSchema>;

export const ChangedSurfaceSelectorInputSchema = z
  .object({
    capabilityId: z.string().min(1),
    changedSurfaces: z.array(ChangedSurfaceSchema),
  })
  .strict();
export type ChangedSurfaceSelectorInput = z.infer<
  typeof ChangedSurfaceSelectorInputSchema
>;

export const ChangedSurfaceSelectorOutputSchema = z
  .object({
    capabilityId: z.string().min(1),
    selectedLanes: z.array(z.string().min(1)),
    blockingLanes: z.array(z.string().min(1)),
    requiredSuiteIds: z.array(z.string().min(1)),
    criticalSurfaces: z.array(z.string().min(1)),
    reasons: z.array(z.string().min(1)),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type ChangedSurfaceSelectorOutput = z.infer<
  typeof ChangedSurfaceSelectorOutputSchema
>;

// ============================================================
// REQUIRED SUITE SCHEDULE
// ============================================================

export const RequiredSuiteScheduleEntrySchema = z
  .object({
    schemaVersion: SemverSchema,
    scheduleId: UuidSchema,
    capabilityId: z.string().min(1),
    riskTier: RiskTierSchema,
    suiteId: z.string().min(1),
    cadence: z.enum(['PER_PR', 'NIGHTLY', 'WEEKLY', 'RELEASE', 'MANUAL']),
    requiredForApproval: z.boolean().default(true),
    minimumSampleSize: z.number().int().nonnegative().default(0),
    lastRunId: UuidSchema.nullable().default(null),
    lastRunAt: IsoDateTimeSchema.nullable().default(null),
    lastOutcome: z
      .enum([
        'PASSED',
        'FAILED',
        'BLOCKED',
        'CANCELLED',
        'INFRA_ERROR',
        'FLAKY',
        'SKIPPED',
        'UNKNOWN',
      ])
      .nullable()
      .default(null),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type RequiredSuiteScheduleEntry = z.infer<
  typeof RequiredSuiteScheduleEntrySchema
>;

// ============================================================
// WAIVER (re-uses existing WaiverRecord but adds a narrower Phase 9 schema)
// ============================================================

export const Phase9ReleaseWaiverSchema = z
  .object({
    schemaVersion: SemverSchema,
    waiverId: UuidSchema,
    capabilityId: z.string().min(1),
    scope: z.string().min(1),
    reason: z.string().min(1),
    compensatingControl: z.string().min(1),
    owner: z.string().min(1),
    approver: z.string().min(1),
    issueLink: z.string().url().optional(),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.nullable().default(null),
    revokedReason: z.string().min(1).nullable().default(null),
    phase9Signers: z
      .object({
        ownerId: z.string().min(1),
        approverId: z.string().min(1),
        issuerId: z.string().min(1),
      })
      .strict()
      .refine((v) => v.ownerId !== v.approverId, {
        message: 'owner and approver must differ (separation of duties)',
      })
      .refine((v) => v.issuerId !== v.approverId, {
        message: 'issuer and approver must differ (separation of duties)',
      }),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .refine((v) => Date.parse(v.expiresAt) > Date.parse(v.issuedAt), {
    message: 'expiresAt must be strictly after issuedAt',
  });
export type Phase9ReleaseWaiver = z.infer<typeof Phase9ReleaseWaiverSchema>;

// ============================================================
// ROLLBACK DRILL
// ============================================================

export const RollbackDrillStatusSchema = z.enum([
  'NOT_RUN',
  'SCHEDULED',
  'RUNNING',
  'PASSED',
  'FAILED',
  'EXPIRED',
]);
export type RollbackDrillStatus = z.infer<typeof RollbackDrillStatusSchema>;

export const RollbackDrillRequirementSchema = z
  .object({
    schemaVersion: SemverSchema,
    drillId: UuidSchema,
    capabilityId: z.string().min(1),
    riskTier: RiskTierSchema,
    requiredScenarios: z.array(z.string().min(1)).min(1),
    maxAgeDays: z.number().int().positive(),
    status: RollbackDrillStatusSchema,
    lastSuccessfulDrillAt: IsoDateTimeSchema.nullable(),
    executedAt: IsoDateTimeSchema.nullable(),
    executedBy: z.string().min(1).nullable(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type RollbackDrillRequirement = z.infer<
  typeof RollbackDrillRequirementSchema
>;

// ============================================================
// CAPABILITY CERTIFICATE (reuses CertificateSchema + Phase 9 additions)
// ============================================================

const CertificateOfCapabilityShape = z
  .object({
    schemaVersion: SemverSchema,
    certificateId: UuidSchema,
    capabilityId: z.string().min(1),
    capabilityVersion: SemverSchema,
    riskTier: RiskTierSchema,
    environmentScope: z
      .object({
        environmentClass: Phase9EnvironmentClassSchema,
        modelProvider: z.string().min(1).optional(),
        modelVersion: SemverSchema.optional(),
        buildId: z.string().min(1).optional(),
      })
      .strict(),
    testSuiteIds: z.array(z.string().min(1)).min(1),
    runIds: z.array(UuidSchema).min(1),
    evidenceRefs: z
      .array(
        z
          .object({
            evidenceId: UuidSchema,
            mediaType: z.string().min(1),
            storageRef: z.string().min(1),
            checksum: Sha256ChecksumSchema,
            size: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .min(1),
    evaluator: z
      .object({
        evaluatorId: z.string().min(1),
        evaluatorVersion: SemverSchema,
        evaluatorType: z.enum(['AUTOMATED', 'HUMAN', 'HYBRID']),
      })
      .strict(),
    evaluationDate: IsoDateTimeSchema,
    verdict: CertificateVerdictSchema,
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    status: CertificateStatusSchema,
    signatures: z.array(SignatureSchema),
    requiredSignaturesByTier: z.record(
      RiskTierSchema,
      z.array(z.string().min(1)),
    ),
    unresolvedRisks: z.array(z.string().min(1)).default([]),
    caveats: z.array(z.string().min(1)).default([]),
    evaluatorChainHash: Sha256ChecksumSchema,
    rollbackDrillRef: z
      .object({
        drillId: UuidSchema,
        lastSuccessfulDrillAt: IsoDateTimeSchema.nullable(),
        status: RollbackDrillStatusSchema,
      })
      .strict(),
    waivers: z.array(Phase9ReleaseWaiverSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const CertificateOfCapabilitySchema =
  CertificateOfCapabilityShape.superRefine((cert, ctx) => {
    const c = cert;
    const requiredRoles = REQUIRED_SIGNATURES_BY_TIER[c.riskTier];
    const presentRoles = new Set(
      c.signatures.map((s: { signerRole: string }) => s.signerRole),
    );
    const missing = requiredRoles.filter((r) => !presentRoles.has(r));
    if (c.verdict === 'PASSED' && missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PASSED verdict for ${c.riskTier} tier requires signatures from: ${missing.join(', ')}`,
      });
    }
    if (new Date(c.expiresAt).getTime() <= new Date(c.issuedAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expiresAt must be after issuedAt',
      });
    }
    if (
      c.status === 'ACTIVE' &&
      new Date(c.expiresAt).getTime() <= Date.now()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ACTIVE certificate cannot have expiresAt in the past',
      });
    }
    if (c.verdict === 'PASSED' && c.unresolvedRisks.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSED verdict requires zero unresolvedRisks',
      });
    }
    if (
      c.verdict === 'PASSED' &&
      (c.riskTier === 'CRITICAL' || c.riskTier === 'HIGH') &&
      c.rollbackDrillRef.status !== 'PASSED'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PASSED verdict for ${c.riskTier} requires a PASSED rollback drill; got ${c.rollbackDrillRef.status}`,
      });
    }
  });
export type CertificateOfCapability = z.infer<
  typeof CertificateOfCapabilitySchema
>;

// ============================================================
// UNRESOLVED RISK & CAVEAT
// ============================================================

export const UnresolvedRiskSchema = z
  .object({
    schemaVersion: SemverSchema,
    riskId: UuidSchema,
    capabilityId: z.string().min(1),
    description: z.string().min(1),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    openedAt: IsoDateTimeSchema,
    evidenceRefs: z.array(z.string().min(1)).default([]),
    proposedMitigation: z.string().min(1).optional(),
  })
  .strict();
export type UnresolvedRisk = z.infer<typeof UnresolvedRiskSchema>;

export const CaveatSchema = z
  .object({
    schemaVersion: SemverSchema,
    caveatId: UuidSchema,
    capabilityId: z.string().min(1),
    description: z.string().min(1),
    scope: z.string().min(1),
    observedAt: IsoDateTimeSchema,
    evidenceRefs: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type Caveat = z.infer<typeof CaveatSchema>;

// ============================================================
// RESOLVED EVIDENCE BUNDLE
// ============================================================

export const ResolvedEvidenceBundleSchema = z
  .object({
    schemaVersion: SemverSchema,
    capabilityId: z.string().min(1),
    contractVersion: SemverSchema,
    resolvedAt: IsoDateTimeSchema,
    runIds: z.array(UuidSchema),
    evidenceEnvelopes: z.array(EvidenceEnvelopeSchema),
    finalizedRunIds: z.array(UuidSchema),
    evidenceResolverHash: Sha256ChecksumSchema,
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ResolvedEvidenceBundle = z.infer<
  typeof ResolvedEvidenceBundleSchema
>;

// ============================================================
// VERDICT EVALUATION
// ============================================================

export const VerdictEvaluationSchema = z
  .object({
    schemaVersion: SemverSchema,
    capabilityId: z.string().min(1),
    riskTier: RiskTierSchema,
    environmentClass: Phase9EnvironmentClassSchema,
    verdict: CertificateVerdictSchema,
    reasons: z.array(z.string().min(1)),
    missingEvidence: z.array(z.string().min(1)),
    unresolvedRisks: z.array(z.string().min(1)),
    caveats: z.array(z.string().min(1)),
    certificate: CertificateOfCapabilitySchema.nullable(),
    evaluatedAt: IsoDateTimeSchema,
    evaluatorChainHash: Sha256ChecksumSchema,
  })
  .strict();
export type VerdictEvaluation = z.infer<typeof VerdictEvaluationSchema>;

// ============================================================
// RELEASE GATE VERDICT
// ============================================================

export const ReleaseGateVerdictSchema = z
  .object({
    schemaVersion: SemverSchema,
    gateId: UuidSchema,
    capabilityId: z.string().min(1),
    lane: z.enum([
      'DEVELOPER',
      'PR_FAST',
      'PR_AI',
      'MAINLINE',
      'NIGHTLY',
      'WEEKLY_SOAK',
      'RELEASE',
    ]),
    selection: z
      .object({
        requiredLanes: z.array(z.string().min(1)),
        blockingLanes: z.array(z.string().min(1)),
        requiredSuiteIds: z.array(z.string().min(1)),
      })
      .strict(),
    runResults: z.array(
      z
        .object({
          lane: z.string().min(1),
          runId: UuidSchema,
          outcome: z.enum([
            'PASSED',
            'FAILED',
            'BLOCKED',
            'CANCELLED',
            'INFRA_ERROR',
            'FLAKY',
            'SKIPPED',
            'UNKNOWN',
          ]),
          finalized: z.boolean(),
          simulatedOnly: z.boolean(),
          reasons: z.array(z.string().min(1)).default([]),
        })
        .strict(),
    ),
    verdict: VerdictEvaluationSchema.nullable(),
    passed: z.boolean(),
    blockedReasons: z.array(z.string().min(1)),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type ReleaseGateVerdict = z.infer<typeof ReleaseGateVerdictSchema>;

// ============================================================
// REPORT MIGRATION KNOWN VERSIONS
// ============================================================

export const KNOWN_PHASE9_VERSIONS = [PHASE9_VERSION] as const;
export type KnownPhase9Version = (typeof KNOWN_PHASE9_VERSIONS)[number];

// ============================================================
// RE-EXPORTS
// ============================================================

export { WaiverRecordSchema };
export type { WaiverRecord } from '../quarantine';
