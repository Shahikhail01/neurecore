/**
 * NeureCore Harness - Core Contracts
 *
 * This module defines the fundamental TypeScript interfaces and Zod schemas
 * for the harness platform. These contracts are runtime-validated, strict,
 * and versioned per ADR-001 (Contracts Authority).
 *
 * Document ID: NC-HARNESS-CONTRACTS-001
 * Version: 1.1
 * Status: PHASE_0_ACCEPTED
 */

import { z } from 'zod';

export const CONTRACTS_VERSION = '1.1.0';
export const CONTRACTS_COMPATIBILITY_POLICY =
  'strict-v1: additive-optional = minor, required-added-or-removed-or-narrowed = major';

// ============================================================
// PRIMITIVE CONSTRAINTS
// ============================================================

export const UuidSchema = z.string().uuid();
export const OptionalUuidSchema = UuidSchema.optional();
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const Sha256ChecksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

// ============================================================
// CORE ENUMS (Section 6.3)
// ============================================================

export const RunOutcomeSchema = z.enum([
  'PASSED',
  'FAILED',
  'BLOCKED',
  'CANCELLED',
  'INFRA_ERROR',
  'FLAKY',
  'SKIPPED',
  'UNKNOWN',
]);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

export const RiskTierSchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const ExecutionModeSchema = z.enum(['DETERMINISTIC', 'STATISTICAL', 'HUMAN']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

// Section 6.3 requires EXACTLY these 4 environment classes for ScenarioManifest
export const EnvironmentClassSchema = z.enum(['LOCAL', 'CI', 'STAGING', 'PRODUCTION_PROBE']);
export type EnvironmentClass = z.infer<typeof EnvironmentClassSchema>;

// Separate enum for certification/replay scope (may include PRODUCTION for read-only observation)
export const CertificationEnvironmentSchema = z.enum([
  'LOCAL',
  'CI',
  'STAGING',
  'PRODUCTION_PROBE',
  'PRODUCTION',
]);
export type CertificationEnvironment = z.infer<typeof CertificationEnvironmentSchema>;

export const CertificateVerdictSchema = z.enum([
  'PASSED',
  'FAILED',
  'INCONCLUSIVE',
  'BLOCKED',
  'INSUFFICIENT_EVIDENCE',
]);
export type CertificateVerdict = z.infer<typeof CertificateVerdictSchema>;

export const RunStatusSchema = z.enum([
  'QUEUED',
  'PROVISIONING',
  'RUNNING',
  'EVALUATING',
  'CLEANING_UP',
  'FINALIZED',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// ============================================================
// SCENARIO MANIFEST (Section 6.3 - exact fields)
// ============================================================

export const DatasetRefSchema = z
  .object({
    datasetId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })
  .strict();
export type DatasetRef = z.infer<typeof DatasetRefSchema>;

export const VersionRefSchema = z
  .object({
    refId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })
  .strict();
export type VersionRef = z.infer<typeof VersionRefSchema>;

export const StepManifestSchema = z
  .object({
    stepId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional(),
    adapter: z.string().min(1),
    config: z.record(z.unknown(), z.unknown()).optional(),
  })
  .strict();
export type StepManifest = z.infer<typeof StepManifestSchema>;

export const AssertionManifestSchema = z
  .object({
    assertionId: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['DETERMINISTIC', 'STATISTICAL', 'HUMAN']),
    expression: z.string().min(1),
    passThreshold: z.number().finite().optional(),
  })
  .strict();
export type AssertionManifest = z.infer<typeof AssertionManifestSchema>;

export const CleanupPolicySchema = z
  .object({
    cleanupPolicy: z.enum(['IMMEDIATE', 'ON_SUCCESS', 'MANUAL', 'NEVER']),
    timeout: z.number().int().positive().optional(),
  })
  .strict();
export type CleanupPolicy = z.infer<typeof CleanupPolicySchema>;

export const EvidencePolicySchema = z
  .object({
    retentionClass: z.enum(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM', 'PERMANENT']),
    classification: z.enum([
      'PUBLIC',
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
      'REGULATED',
    ]),
    redactionRequired: z.boolean(),
  })
  .strict();
export type EvidencePolicy = z.infer<typeof EvidencePolicySchema>;

export const ScenarioManifestSchema = z
  .object({
    schemaVersion: SemverSchema,
    scenarioId: z.string().min(1),
    scenarioVersion: SemverSchema,
    capabilityIds: z.array(z.string().min(1)).min(1),
    riskTier: RiskTierSchema,
    executionMode: ExecutionModeSchema,
    environmentClass: EnvironmentClassSchema,
    requiredFeatures: z.array(z.string().min(1)),
    requiredDatasets: z.array(DatasetRefSchema),
    steps: z.array(StepManifestSchema).min(1),
    assertions: z.array(AssertionManifestSchema).min(1),
    cleanupPolicy: CleanupPolicySchema,
    evidencePolicy: EvidencePolicySchema,
  })
  .strict();
export type ScenarioManifest = z.infer<typeof ScenarioManifestSchema>;

// ============================================================
// RUN PROVENANCE (Section 6.3 - exact fields)
// ============================================================

export const RunProvenanceSchema = z
  .object({
    runId: UuidSchema,
    parentRunId: OptionalUuidSchema,
    tenantId: UuidSchema,
    actorId: z.string().min(1),
    codeSha: z.string().regex(/^[a-f0-9]{40,64}$/),
    buildId: z.string().min(1),
    environmentId: z.string().min(1),
    modelRefs: z.array(VersionRefSchema),
    promptRefs: z.array(VersionRefSchema),
    policyRefs: z.array(VersionRefSchema),
    toolRefs: z.array(VersionRefSchema),
    datasetRefs: z.array(DatasetRefSchema),
    seed: z.string().min(1).optional(),
    startedAt: IsoDateTimeSchema,
  })
  .strict();
export type RunProvenance = z.infer<typeof RunProvenanceSchema>;

// ============================================================
// ASSERTION RESULTS
// ============================================================

export const AssertionResultSchema = z
  .object({
    assertionId: z.string().min(1),
    name: z.string().min(1),
    passed: z.boolean(),
    message: z.string().min(1).optional(),
    actual: z.unknown().optional(),
    expected: z.unknown().optional(),
    durationMs: z.number().nonnegative().optional(),
  })
  .strict();
export type AssertionResult = z.infer<typeof AssertionResultSchema>;

// ============================================================
// METRICS
// ============================================================

export const MetricValueSchema = z
  .object({
    name: z.string().min(1),
    value: z.number().finite(),
    unit: z.string().min(1),
    timestamp: IsoDateTimeSchema.optional(),
  })
  .strict();
export type MetricValue = z.infer<typeof MetricValueSchema>;

// ============================================================
// EVIDENCE
// ============================================================

export const EvidenceRefSchema = z
  .object({
    evidenceId: UuidSchema,
    mediaType: z.string().min(1),
    storageRef: z.string().min(1),
    checksum: Sha256ChecksumSchema,
    size: z.number().int().nonnegative().optional(),
  })
  .strict();
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

// ============================================================
// CLEANUP
// ============================================================

export const CleanupResultSchema = z
  .object({
    success: z.boolean(),
    cleanedResources: z.array(z.string().min(1)),
    failedCleanup: z.array(z.string().min(1)).optional(),
    orphanedResources: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type CleanupResult = z.infer<typeof CleanupResultSchema>;

// ============================================================
// DIAGNOSTICS
// ============================================================

export const SanitizedDiagnosticSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
    context: z.record(z.unknown(), z.unknown()).optional(),
  })
  .strict();
export type SanitizedDiagnostic = z.infer<typeof SanitizedDiagnosticSchema>;

// ============================================================
// HARNESS RESULT (Section 6.3 - exact fields)
// ============================================================

export const HarnessResultSchema = z
  .object({
    schemaVersion: SemverSchema,
    outcome: RunOutcomeSchema,
    assertionResults: z.array(AssertionResultSchema),
    metrics: z.array(MetricValueSchema),
    evidenceRefs: z.array(EvidenceRefSchema).min(1),
    cleanupResult: CleanupResultSchema,
    diagnostics: z.array(SanitizedDiagnosticSchema),
  })
  .strict();
export type HarnessResult = z.infer<typeof HarnessResultSchema>;

// ============================================================
// RUN STATE MACHINE (Section 6.3 - canonical)
// ============================================================
//
//   QUEUED -> PROVISIONING -> RUNNING -> EVALUATING -> CLEANING_UP -> FINALIZED
//      |           |            |            |              |
//      +---------- failure/cancel/timeout always routes through CLEANING_UP
//
// Certification consumes only FINALIZED runs.

export const VALID_TRANSITIONS: Readonly<Record<RunStatus, ReadonlyArray<RunStatus>>> = Object.freeze(
  {
    QUEUED: ['PROVISIONING', 'CLEANING_UP'],
    PROVISIONING: ['RUNNING', 'CLEANING_UP'],
    RUNNING: ['EVALUATING', 'CLEANING_UP'],
    EVALUATING: ['CLEANING_UP'],
    CLEANING_UP: ['FINALIZED'],
    FINALIZED: [],
  }
);

export function validateTransition(current: RunStatus, next: RunStatus): boolean {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) {
    throw new Error(`Unknown run state: ${current}`);
  }
  return allowed.includes(next);
}

export function isFinalized(status: RunStatus): boolean {
  return status === 'FINALIZED';
}

export function isTerminal(status: RunStatus): boolean {
  return status === 'FINALIZED';
}

// ============================================================
// CERTIFICATE
// ============================================================

export const EnvironmentScopeSchema = z
  .object({
    environmentClass: CertificationEnvironmentSchema,
    modelProvider: z.string().min(1).optional(),
    modelVersion: SemverSchema.optional(),
    buildId: z.string().min(1).optional(),
  })
  .strict();
export type EnvironmentScope = z.infer<typeof EnvironmentScopeSchema>;

export const EvaluatorInfoSchema = z
  .object({
    evaluatorId: z.string().min(1),
    evaluatorVersion: SemverSchema,
    evaluatorType: z.enum(['AUTOMATED', 'HUMAN', 'HYBRID']),
  })
  .strict();
export type EvaluatorInfo = z.infer<typeof EvaluatorInfoSchema>;

export const ScoreSchema = z
  .object({
    value: z.number().finite(),
    maxValue: z.number().finite(),
    confidenceInterval: z.tuple([z.number().finite(), z.number().finite()]).optional(),
    sampleSize: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Score = z.infer<typeof ScoreSchema>;

export const UncertaintySchema = z
  .object({
    type: z.enum(['CONFIDENCE_INTERVAL', 'MARGIN_OF_ERROR', 'NONE']),
    value: z.number().nonnegative(),
    confidenceLevel: z.number().min(0).max(100).optional(),
  })
  .strict();
export type Uncertainty = z.infer<typeof UncertaintySchema>;

export const SignerRoleSchema = z.enum([
  'EVALUATOR',
  'QA_LEAD',
  'DOMAIN_OWNER',
  'SECURITY',
  'COMPLIANCE',
  'ARCHITECTURE',
]);
export type SignerRole = z.infer<typeof SignerRoleSchema>;

export const SignatureSchema = z
  .object({
    signerId: z.string().min(1),
    signerRole: SignerRoleSchema,
    signedAt: IsoDateTimeSchema,
    signature: z.string().min(1),
    publicKey: z.string().min(1),
  })
  .strict();
export type Signature = z.infer<typeof SignatureSchema>;

export const CertificateStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED']);
export type CertificateStatus = z.infer<typeof CertificateStatusSchema>;

// Required signatures per risk tier (ADR-004)
export const REQUIRED_SIGNATURES_BY_TIER: Readonly<Record<RiskTier, ReadonlyArray<SignerRole>>> =
  Object.freeze({
    CRITICAL: ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER', 'SECURITY', 'COMPLIANCE', 'ARCHITECTURE'],
    HIGH: ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER'],
    MEDIUM: ['EVALUATOR', 'QA_LEAD'],
    LOW: ['EVALUATOR'],
  });

export const CertificateSchema = z
  .object({
    certificateId: UuidSchema,
    schemaVersion: SemverSchema,
    capabilityId: z.string().min(1),
    capabilityVersion: SemverSchema,
    riskTier: RiskTierSchema,
    environmentScope: EnvironmentScopeSchema,
    testSuiteIds: z.array(z.string().min(1)).min(1),
    runIds: z.array(UuidSchema).min(1),
    evidenceRefs: z.array(EvidenceRefSchema).min(1),
    evaluator: EvaluatorInfoSchema,
    evaluationDate: IsoDateTimeSchema,
    verdict: CertificateVerdictSchema,
    score: ScoreSchema.optional(),
    uncertainty: UncertaintySchema.optional(),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    status: CertificateStatusSchema,
    signatures: z.array(SignatureSchema),
    unresolvedRisks: z.array(z.string().min(1)),
    caveats: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((cert, ctx) => {
    // ADR-004: PASSED requires signatures per risk tier
    const requiredRoles = REQUIRED_SIGNATURES_BY_TIER[cert.riskTier];
    const presentRoles = new Set(cert.signatures.map((s) => s.signerRole));
    const missing = requiredRoles.filter((r) => !presentRoles.has(r));
    if (cert.verdict === 'PASSED' && missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PASSED verdict for ${cert.riskTier} tier requires signatures from: ${missing.join(', ')}`,
      });
    }
    // expiresAt must be after issuedAt
    if (new Date(cert.expiresAt).getTime() <= new Date(cert.issuedAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expiresAt must be after issuedAt',
      });
    }
    // ACTIVE status cannot have past expiry
    if (cert.status === 'ACTIVE' && new Date(cert.expiresAt).getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ACTIVE certificate cannot have expiresAt in the past',
      });
    }
    // PASSED with unresolved risks is prohibited (Section 15 DoD #9)
    if (cert.verdict === 'PASSED' && cert.unresolvedRisks.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSED verdict requires zero unresolvedRisks',
      });
    }
  });
export type Certificate = z.infer<typeof CertificateSchema>;

// ============================================================
// EVIDENCE ENVELOPE (Section 7.1)
// ============================================================

export const EvidenceClassificationSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'REGULATED',
]);
export type EvidenceClassification = z.infer<typeof EvidenceClassificationSchema>;

export const RetentionClassSchema = z.enum(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM', 'PERMANENT']);
export type RetentionClass = z.infer<typeof RetentionClassSchema>;

export const RedactionStatusSchema = z.enum(['PENDING', 'APPLIED', 'NOT_REQUIRED']);
export type RedactionStatus = z.infer<typeof RedactionStatusSchema>;

// Section 7.1: every evidence item includes scenario/capability IDs (not optional)
export const EvidenceEnvelopeSchema = z
  .object({
    schemaVersion: SemverSchema,
    evidenceId: UuidSchema,
    runId: UuidSchema,
    scenarioId: z.string().min(1),
    capabilityId: z.string().min(1),
    tenantId: UuidSchema,
    timestamp: IsoDateTimeSchema,
    producer: z.string().min(1),
    mediaType: z.string().min(1),
    classification: EvidenceClassificationSchema,
    checksum: Sha256ChecksumSchema,
    storageRef: z.string().min(1),
    retentionClass: RetentionClassSchema,
    redactionStatus: RedactionStatusSchema,
    correlationIds: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type EvidenceEnvelope = z.infer<typeof EvidenceEnvelopeSchema>;

// ============================================================
// EXPORTS
// ============================================================

// ============================================================
// AUTHORIZATION CONTEXT (§5.2 fail-closed authorization)
// ============================================================

export const AuthorizationRoleSchema = z.enum([
  'SUPER_ADMIN',
  'SECURITY',
  'COMPLIANCE',
  'ARCHITECTURE',
  'QA_LEAD',
  'DOMAIN_OWNER',
  'EVALUATOR',
  'TENANT_ADMIN',
  'TENANT_USER',
  'SYSTEM',
]);
export type AuthorizationRole = z.infer<typeof AuthorizationRoleSchema>;

export const AuthorizationPermissionSchema = z.enum([
  'evidence:read',
  'evidence:annotate',
  'evidence:create',
  'evidence:verify',
  'evidence:erase',
  'evidence:retain:legal-hold',
  'evidence:retain:release',
  'replay:create',
  'replay:execute',
  'replay:view',
  'storage:admin',
  'retention:admin',
]);
export type AuthorizationPermission = z.infer<typeof AuthorizationPermissionSchema>;

export const AuthorizationContextSchema = z
  .object({
    actorId: z.string().min(1),
    actorType: z.enum(['HUMAN', 'AI_AGENT', 'SYSTEM']),
    actorRoles: z.array(AuthorizationRoleSchema).min(1),
    tenantId: UuidSchema,
    correlationId: z.string().min(1),
    permissions: z.array(AuthorizationPermissionSchema),
    isSuperAdmin: z.boolean().optional(),
  })
  .strict()
  .superRefine((ctx, refinementCtx) => {
    // §5.2: "Secure and tenant-scoped by default; missing tenant context is an error"
    if (!ctx.tenantId) {
      refinementCtx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AuthorizationContext requires tenantId (§5.2)',
      });
    }
  });
export type AuthorizationContext = z.infer<typeof AuthorizationContextSchema>;

export function hasPermission(
  ctx: AuthorizationContext,
  permission: AuthorizationPermission,
): boolean {
  if (ctx.isSuperAdmin === true) return true;
  return ctx.permissions.includes(permission);
}

export function hasRole(
  ctx: AuthorizationContext,
  role: AuthorizationRole,
): boolean {
  if (ctx.isSuperAdmin === true) return true;
  return ctx.actorRoles.includes(role);
}

// ============================================================
// EXPORTS
// ============================================================

export const ALL_SCHEMAS = {
  RunOutcome: RunOutcomeSchema,
  RiskTier: RiskTierSchema,
  ExecutionMode: ExecutionModeSchema,
  EnvironmentClass: EnvironmentClassSchema,
  CertificationEnvironment: CertificationEnvironmentSchema,
  CertificateVerdict: CertificateVerdictSchema,
  RunStatus: RunStatusSchema,
  ScenarioManifest: ScenarioManifestSchema,
  RunProvenance: RunProvenanceSchema,
  HarnessResult: HarnessResultSchema,
  Certificate: CertificateSchema,
  EvidenceEnvelope: EvidenceEnvelopeSchema,
  AuthorizationContext: AuthorizationContextSchema,
} as const;