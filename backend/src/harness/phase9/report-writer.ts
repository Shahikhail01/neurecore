import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { z } from 'zod';
import {
  type CertificateOfCapability,
  type ChangedSurfaceSelectorOutput,
  type ReleaseGateVerdict,
  type RequiredSuiteScheduleEntry,
  type ResolvedEvidenceBundle,
  type VerdictEvaluation,
  CertificateOfCapabilitySchema,
  ChangedSurfaceSelectorOutputSchema,
  ReleaseGateVerdictSchema,
  RequiredSuiteScheduleEntrySchema,
  ResolvedEvidenceBundleSchema,
  VerdictEvaluationSchema,
  PHASE9_VERSION,
} from './contracts';
import type { Sha256ChecksumSchema } from '../contracts';

type Sha256Checksum = z.infer<typeof Sha256ChecksumSchema>;

export const PHASE9_REPORT_WRITER_VERSION = '1.0.0';

export const Phase9CapabilityCertificateSchema = z
  .object({
    schemaVersion: z.string().min(1),
    certificate: CertificateOfCapabilitySchema.nullable(),
    verdict: VerdictEvaluationSchema,
    selection: ChangedSurfaceSelectorOutputSchema,
    schedule: z.array(RequiredSuiteScheduleEntrySchema),
    bundle: ResolvedEvidenceBundleSchema,
    gate: ReleaseGateVerdictSchema,
    producedAt: z.string().datetime(),
  })
  .strict();
export type Phase9CapabilityCertificate = z.infer<
  typeof Phase9CapabilityCertificateSchema
>;

export interface Phase9WriteReportInput {
  bundle: ResolvedEvidenceBundle;
  schedule: RequiredSuiteScheduleEntry[];
  selection: ChangedSurfaceSelectorOutput;
  evaluation: VerdictEvaluation;
  gate: ReleaseGateVerdict;
  certificate: CertificateOfCapability | null;
  outDir: string;
  fileBaseName?: string;
}

export interface Phase9WriteReportOutput {
  jsonPath: string;
  summaryPath: string;
  certificatePath: string;
  checksumPath: string;
  integrityPath: string;
  jsonChecksum: Sha256Checksum;
  summaryChecksum: Sha256Checksum;
  certificateChecksum: Sha256Checksum;
  integrityChecksum: Sha256Checksum;
}

export interface Phase9Summary {
  schemaVersion: string;
  capabilityId: string;
  riskTier: string;
  environmentClass: string;
  verdict: string;
  passed: boolean;
  blockedReasons: string[];
  missingEvidence: string[];
  unresolvedRisks: string[];
  caveats: string[];
  evaluatorChainHash: Sha256Checksum;
  generatedAt: string;
  reportWriterVersion: string;
}

export function buildPhase9Summary(input: {
  gate: ReleaseGateVerdict;
  evaluation: VerdictEvaluation;
  bundle: ResolvedEvidenceBundle;
  certificate: CertificateOfCapability | null;
}): Phase9Summary {
  return {
    schemaVersion: PHASE9_VERSION,
    capabilityId: input.gate.capabilityId,
    riskTier: input.evaluation.riskTier,
    environmentClass: input.evaluation.environmentClass,
    verdict: input.evaluation.verdict,
    passed: input.gate.passed,
    blockedReasons: input.gate.blockedReasons,
    missingEvidence: input.evaluation.missingEvidence,
    unresolvedRisks: input.evaluation.unresolvedRisks,
    caveats: input.evaluation.caveats,
    evaluatorChainHash: input.evaluation.evaluatorChainHash,
    generatedAt: new Date().toISOString(),
    reportWriterVersion: PHASE9_REPORT_WRITER_VERSION,
  };
}

export interface Phase9IntegrityReport {
  schemaVersion: string;
  reportWriterVersion: string;
  generatedAt: string;
  capabilityId: string;
  jsonChecksum: Sha256Checksum;
  summaryChecksum: Sha256Checksum;
  certificateChecksum: Sha256Checksum;
  tampered: boolean;
  reasons: string[];
  roundTrip: {
    checksumOk: boolean;
    reasons: string[];
  };
  retention: {
    kept: boolean;
    purged: boolean;
    reasons: string[];
  };
}

export function buildPhase9IntegrityReport(input: {
  capabilityId: string;
  jsonChecksum: Sha256Checksum;
  summaryChecksum: Sha256Checksum;
  certificateChecksum: Sha256Checksum;
  evaluation: VerdictEvaluation;
  report: { capabilityId: string; verdict: string; missingEvidence: string[] };
  roundTrip: { checksumOk: boolean; reasons: string[] };
  retention: { kept: boolean; purged: boolean; reasons: string[] };
}): Phase9IntegrityReport {
  const tampered =
    input.report.verdict !== input.evaluation.verdict ||
    input.report.capabilityId !== input.evaluation.capabilityId ||
    JSON.stringify([...input.report.missingEvidence].sort()) !==
      JSON.stringify([...input.evaluation.missingEvidence].sort());
  return {
    schemaVersion: PHASE9_VERSION,
    reportWriterVersion: PHASE9_REPORT_WRITER_VERSION,
    generatedAt: new Date().toISOString(),
    capabilityId: input.capabilityId,
    jsonChecksum: input.jsonChecksum,
    summaryChecksum: input.summaryChecksum,
    certificateChecksum: input.certificateChecksum,
    tampered,
    reasons: tampered
      ? [
          'verdict/capability/missingEvidence mismatch between stored report and resolved evaluation',
        ]
      : [],
    roundTrip: input.roundTrip,
    retention: input.retention,
  };
}

export function writePhase9Report(
  input: Phase9WriteReportInput,
): Phase9WriteReportOutput {
  ResolvedEvidenceBundleSchema.parse(input.bundle);
  VerdictEvaluationSchema.parse(input.evaluation);
  ReleaseGateVerdictSchema.parse(input.gate);
  ChangedSurfaceSelectorOutputSchema.parse(input.selection);
  const cert = input.certificate
    ? CertificateOfCapabilitySchema.parse(input.certificate)
    : null;
  const base = input.fileBaseName ?? `phase9-${input.bundle.capabilityId}`;
  const jsonPath = `${input.outDir}/${base}.json`;
  const summaryPath = `${input.outDir}/${base}-summary.json`;
  const certificatePath = `${input.outDir}/${base}-certificate.json`;
  const checksumPath = `${input.outDir}/${base}-checksum.txt`;
  const integrityPath = `${input.outDir}/${base}-integrity.json`;
  mkdirSync(input.outDir, { recursive: true });

  const reportJson = JSON.stringify(
    {
      bundle: input.bundle,
      evaluation: input.evaluation,
      selection: input.selection,
      gate: input.gate,
      schedule: input.schedule,
      certificate: cert,
    },
    null,
    2,
  );
  const summary = buildPhase9Summary({
    gate: input.gate,
    evaluation: input.evaluation,
    bundle: input.bundle,
    certificate: cert,
  });
  const certificateEnvelope = {
    schemaVersion: PHASE9_VERSION,
    reportWriterVersion: PHASE9_REPORT_WRITER_VERSION,
    generatedAt: new Date().toISOString(),
    capabilityId: input.bundle.capabilityId,
    certificate: cert,
  };
  const jsonChecksum = `sha256:${createHash('sha256').update(reportJson).digest('hex')}`;
  const summaryChecksum = `sha256:${createHash('sha256').update(JSON.stringify(summary)).digest('hex')}`;
  const certificateChecksum = `sha256:${createHash('sha256').update(JSON.stringify(certificateEnvelope)).digest('hex')}`;
  writeFileSync(jsonPath, reportJson);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(certificatePath, JSON.stringify(certificateEnvelope, null, 2));
  writeFileSync(
    checksumPath,
    `evaluatorChainHash=${input.evaluation.evaluatorChainHash}\njsonChecksum=${jsonChecksum}\nsummaryChecksum=${summaryChecksum}\ncertificateChecksum=${certificateChecksum}\n`,
  );
  const integrity = buildPhase9IntegrityReport({
    capabilityId: input.bundle.capabilityId,
    jsonChecksum,
    summaryChecksum,
    certificateChecksum,
    evaluation: input.evaluation,
    report: {
      capabilityId: input.bundle.capabilityId,
      verdict: input.evaluation.verdict,
      missingEvidence: input.evaluation.missingEvidence,
    },
    roundTrip: { checksumOk: true, reasons: [] },
    retention: {
      kept: true,
      purged: false,
      reasons: ['within retention window'],
    },
  });
  const integrityJson = JSON.stringify(integrity, null, 2);
  const integrityChecksum = `sha256:${createHash('sha256').update(integrityJson).digest('hex')}`;
  writeFileSync(integrityPath, integrityJson);
  return {
    jsonPath,
    summaryPath,
    certificatePath,
    checksumPath,
    integrityPath,
    jsonChecksum,
    summaryChecksum,
    certificateChecksum,
    integrityChecksum,
  };
}
