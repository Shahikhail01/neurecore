import { z } from 'zod';
import { createHash } from 'crypto';
import {
  type CertificateOfCapability,
  CertificateOfCapabilitySchema,
  type ResolvedEvidenceBundle,
  type VerdictEvaluation,
  type ReleaseGateVerdict,
  type ChangedSurfaceSelectorOutput,
  type RequiredSuiteScheduleEntry,
  ResolvedEvidenceBundleSchema,
  VerdictEvaluationSchema,
  ReleaseGateVerdictSchema,
  ChangedSurfaceSelectorOutputSchema,
  RequiredSuiteScheduleEntrySchema,
  PHASE9_VERSION,
} from './contracts';
import {
  Phase9CapabilityCertificateSchema,
  type Phase9CapabilityCertificate,
} from './report-writer';

export const PHASE9_REPORT_MIGRATION_VERSION = '1.0.0';

export const KNOWN_PHASE9_REPORT_VERSIONS = [PHASE9_VERSION] as const;
export type KnownPhase9ReportVersion =
  (typeof KNOWN_PHASE9_REPORT_VERSIONS)[number];

export const Phase9ReportEnvelopeSchema = z
  .object({
    schemaVersion: z.string().min(1),
    runnerVersion: z.string().min(1),
    reportWriterVersion: z.string().min(1),
    migratedFrom: z.array(z.string().min(1)).default([]),
    restoredAt: z.string().datetime().optional(),
    data: z.unknown(),
  })
  .strict();
export type Phase9ReportEnvelope = z.infer<typeof Phase9ReportEnvelopeSchema>;

export interface Phase9ReportRestoreInput {
  report: unknown;
  sourceChecksum: string;
  expectedSchemaVersion?: string;
}

export interface Phase9ReportRestoreOutcome {
  restored: boolean;
  valid: boolean;
  reasons: string[];
  certificate: Phase9CapabilityCertificate | null;
}

export interface Phase9ReportRetentionInput {
  capabilityId: string;
  retentionClass: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'PERMANENT';
  retentionUntilMs: number;
  nowMs?: number;
  legalHold: boolean;
}

export interface Phase9ReportRetentionOutcome {
  kept: boolean;
  purged: boolean;
  reasons: string[];
}

export function checkRoundTrip(input: {
  bundle: ResolvedEvidenceBundle;
  evaluation: VerdictEvaluation;
  selection: ChangedSurfaceSelectorOutput;
  gate: ReleaseGateVerdict;
  schedule: RequiredSuiteScheduleEntry[];
  certificate: CertificateOfCapability | null;
}): {
  checksumOk: boolean;
  reasons: string[];
  restored: Phase9CapabilityCertificate;
} {
  const restored: Phase9CapabilityCertificate =
    Phase9CapabilityCertificateSchema.parse({
      schemaVersion: PHASE9_VERSION,
      certificate: input.certificate,
      verdict: input.evaluation,
      selection: input.selection,
      schedule: input.schedule,
      bundle: input.bundle,
      gate: input.gate,
      producedAt: new Date().toISOString(),
    });
  const recomputed = `${createHash('sha256')
    .update(
      JSON.stringify({
        bundle: input.bundle,
        evaluation: input.evaluation,
        selection: input.selection,
        gate: input.gate,
        schedule: input.schedule,
        certificate: input.certificate,
      }),
    )
    .digest('hex')}`;
  const stored = createHash('sha256')
    .update(
      JSON.stringify({
        bundle: restored.bundle,
        evaluation: restored.verdict,
        selection: restored.selection,
        gate: restored.gate,
        schedule: restored.schedule,
        certificate: restored.certificate,
      }),
    )
    .digest('hex');
  const equal = recomputed === stored;
  return {
    checksumOk: equal,
    reasons: equal ? [] : ['stored-vs-recomputed mismatch'],
    restored,
  };
}

export function roundTripPhase9Report(input: {
  bundle: ResolvedEvidenceBundle;
  evaluation: VerdictEvaluation;
  selection: ChangedSurfaceSelectorOutput;
  gate: ReleaseGateVerdict;
  schedule: RequiredSuiteScheduleEntry[];
  certificate: CertificateOfCapability | null;
}): {
  envelope: Phase9ReportEnvelope;
  checksumOk: boolean;
  reasons: string[];
} {
  const result = checkRoundTrip(input);
  const envelope = Phase9ReportEnvelopeSchema.parse({
    schemaVersion: PHASE9_VERSION,
    runnerVersion: PHASE9_VERSION,
    reportWriterVersion: PHASE9_REPORT_MIGRATION_VERSION,
    migratedFrom: [],
    restoredAt: new Date().toISOString(),
    data: {
      bundle: input.bundle,
      evaluation: input.evaluation,
      selection: input.selection,
      gate: input.gate,
      schedule: input.schedule,
      certificate: input.certificate,
    },
  });
  return {
    envelope,
    checksumOk: result.checksumOk,
    reasons: result.reasons,
  };
}

export function tamperedReport(input: {
  bundle: ResolvedEvidenceBundle;
  evaluation: VerdictEvaluation;
  selection: ChangedSurfaceSelectorOutput;
  gate: ReleaseGateVerdict;
  schedule: RequiredSuiteScheduleEntry[];
  certificate: CertificateOfCapability | null;
  tamper: 'verdict' | 'missingEvidence' | 'capabilityId';
}): {
  bundle: ResolvedEvidenceBundle;
  evaluation: VerdictEvaluation;
  selection: ChangedSurfaceSelectorOutput;
  gate: ReleaseGateVerdict;
  schedule: RequiredSuiteScheduleEntry[];
  certificate: CertificateOfCapability | null;
} {
  const cloned = JSON.parse(JSON.stringify(input)) as typeof input;
  switch (input.tamper) {
    case 'verdict':
      cloned.evaluation = {
        ...cloned.evaluation,
        verdict:
          cloned.evaluation.verdict === 'PASSED'
            ? 'INSUFFICIENT_EVIDENCE'
            : 'PASSED',
      };
      return cloned;
    case 'missingEvidence':
      cloned.evaluation = {
        ...cloned.evaluation,
        missingEvidence: [
          ...cloned.evaluation.missingEvidence,
          'injected-evidence-id',
        ],
      };
      return cloned;
    case 'capabilityId':
      cloned.bundle = {
        ...cloned.bundle,
        capabilityId: 'tampered-capability',
      };
      return cloned;
  }
}

export function detectTampering(input: {
  original: {
    bundle: ResolvedEvidenceBundle;
    evaluation: VerdictEvaluation;
  };
  candidate: {
    bundle: ResolvedEvidenceBundle;
    evaluation: VerdictEvaluation;
  };
}): { tampered: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (
    input.original.bundle.capabilityId !== input.candidate.bundle.capabilityId
  ) {
    reasons.push('capabilityId mutated');
  }
  if (
    input.original.evaluation.verdict !== input.candidate.evaluation.verdict
  ) {
    reasons.push('verdict mutated');
  }
  if (
    input.original.evaluation.evaluatorChainHash !==
    input.candidate.evaluation.evaluatorChainHash
  ) {
    reasons.push('evaluatorChainHash mutated');
  }
  if (
    JSON.stringify([...input.original.evaluation.missingEvidence].sort()) !==
    JSON.stringify([...input.candidate.evaluation.missingEvidence].sort())
  ) {
    reasons.push('missingEvidence mutated');
  }
  return { tampered: reasons.length > 0, reasons };
}

export function evaluateReportRetention(
  input: Phase9ReportRetentionInput,
): Phase9ReportRetentionOutcome {
  const now = input.nowMs ?? Date.now();
  const reasons: string[] = [];
  if (input.legalHold) {
    return { kept: true, purged: false, reasons: ['legal hold active'] };
  }
  if (now > input.retentionUntilMs) {
    reasons.push(
      `retention expired at ${new Date(input.retentionUntilMs).toISOString()}`,
    );
    return { kept: false, purged: true, reasons };
  }
  return { kept: true, purged: false, reasons: ['within retention window'] };
}

export function restoreReport(
  input: Phase9ReportRestoreInput,
): Phase9ReportRestoreOutcome {
  const reasons: string[] = [];
  if (!input.report || typeof input.report !== 'object') {
    return {
      restored: false,
      valid: false,
      reasons: ['report is not an object'],
      certificate: null,
    };
  }
  const r = input.report as {
    schemaVersion?: string;
    bundle?: unknown;
    evaluation?: unknown;
    selection?: unknown;
    gate?: unknown;
    schedule?: unknown;
    certificate?: unknown;
  };
  if (
    input.expectedSchemaVersion &&
    r.schemaVersion !== input.expectedSchemaVersion
  ) {
    reasons.push(
      `schemaVersion mismatch: got ${r.schemaVersion ?? 'unknown'} expected ${input.expectedSchemaVersion}`,
    );
  }
  const parsedBundle = ResolvedEvidenceBundleSchema.safeParse(r.bundle);
  if (!parsedBundle.success) {
    return {
      restored: false,
      valid: false,
      reasons: [...reasons, ...parsedBundle.error.errors.map((e) => e.message)],
      certificate: null,
    };
  }
  const parsedEvaluation = VerdictEvaluationSchema.safeParse(r.evaluation);
  if (!parsedEvaluation.success) {
    return {
      restored: false,
      valid: false,
      reasons: [
        ...reasons,
        ...parsedEvaluation.error.errors.map((e) => e.message),
      ],
      certificate: null,
    };
  }
  const parsedSelection = ChangedSurfaceSelectorOutputSchema.safeParse(
    r.selection,
  );
  if (!parsedSelection.success) {
    return {
      restored: false,
      valid: false,
      reasons: [
        ...reasons,
        ...parsedSelection.error.errors.map((e) => e.message),
      ],
      certificate: null,
    };
  }
  const parsedGate = ReleaseGateVerdictSchema.safeParse(r.gate);
  if (!parsedGate.success) {
    return {
      restored: false,
      valid: false,
      reasons: [...reasons, ...parsedGate.error.errors.map((e) => e.message)],
      certificate: null,
    };
  }
  const parsedSchedule = z
    .array(RequiredSuiteScheduleEntrySchema)
    .safeParse(r.schedule ?? []);
  if (!parsedSchedule.success) {
    return {
      restored: false,
      valid: false,
      reasons: [
        ...reasons,
        ...parsedSchedule.error.errors.map((e) => e.message),
      ],
      certificate: null,
    };
  }
  const parsedCertificate = r.certificate
    ? CertificateOfCapabilitySchema.safeParse(r.certificate)
    : ({ success: true, data: null } as const);
  if (!parsedCertificate.success) {
    return {
      restored: false,
      valid: false,
      reasons: [
        ...reasons,
        ...parsedCertificate.error.errors.map((e) => e.message),
      ],
      certificate: null,
    };
  }
  const restored: Phase9CapabilityCertificate =
    Phase9CapabilityCertificateSchema.parse({
      schemaVersion: PHASE9_VERSION,
      certificate: parsedCertificate.success ? parsedCertificate.data : null,
      verdict: parsedEvaluation.data,
      selection: parsedSelection.data,
      schedule: parsedSchedule.data,
      bundle: parsedBundle.data,
      gate: parsedGate.data,
      producedAt: new Date().toISOString(),
    });
  return {
    restored: true,
    valid: true,
    reasons,
    certificate: restored,
  };
}
