import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import {
  Phase8RunnerReportSchema,
  PHASE8_VERSION,
  type Phase8RunnerReport,
} from './contracts';
import {
  PHASE8_REPORT_MIGRATION_VERSION,
  ReportSchemaMigratorChain,
  roundTripPhase8Report,
  detectTampering,
  evaluateReportRetention,
  restoreReport,
  type ReportRetentionInput,
  type ReportRestoreInput,
  type ReportRestoreOutcome,
} from './report-migration';

export { PHASE8_REPORT_MIGRATION_VERSION };
export {
  ReportSchemaMigratorChain,
  roundTripPhase8Report,
  detectTampering,
  evaluateReportRetention,
  restoreReport,
};
export type { ReportRetentionInput, ReportRestoreInput, ReportRestoreOutcome };

export const PHASE8_REPORT_WRITER_VERSION = PHASE8_REPORT_MIGRATION_VERSION;

export interface WritePhase8ReportInput {
  report: Phase8RunnerReport;
  outDir: string;
  fileBaseName?: string;
}

export interface WritePhase8ReportOutput {
  jsonPath: string;
  summaryPath: string;
  capacityPath: string;
  checksumPath: string;
  integrityPath: string;
  jsonChecksum: string;
  summaryChecksum: string;
  capacityChecksum: string;
  integrityChecksum: string;
}

export interface Phase8Summary {
  schemaVersion: string;
  runnerId: string;
  runId: string;
  tenantId: string;
  status: Phase8RunnerReport['status'];
  outcome: Phase8RunnerReport['outcome'];
  startedAt: string;
  finalizedAt: string;
  counters: Phase8RunnerReport['counters'];
  cleanup: { success: boolean; failedCleanup: number; orphans: number };
  evidenceCount: number;
  bundleCount: number;
  reportChecksum: string;
  runnerVersion: string;
  notes: string[];
  statisticalConfidence: Phase8RunnerReport['statisticalConfidence'];
  regressionEvidence: Phase8RunnerReport['regressionEvidence'];
  operationalAlerts: Phase8RunnerReport['operationalAlerts'];
}

export function buildPhase8Summary(report: Phase8RunnerReport): Phase8Summary {
  return {
    schemaVersion: report.schemaVersion,
    runnerId: report.runnerId,
    runId: report.runId,
    tenantId: report.tenantId,
    status: report.status,
    outcome: report.outcome,
    startedAt: report.startedAt,
    finalizedAt: report.finalizedAt,
    counters: report.counters,
    cleanup: {
      success: report.cleanupResult.success,
      failedCleanup: report.cleanupResult.failedCleanup?.length ?? 0,
      orphans: report.cleanupResult.orphanedResources?.length ?? 0,
    },
    evidenceCount: report.evidenceEnvelopes.length,
    bundleCount: report.metricBundles.length,
    reportChecksum: report.reportChecksum,
    runnerVersion: PHASE8_VERSION,
    notes: report.notes,
    statisticalConfidence: report.statisticalConfidence,
    regressionEvidence: report.regressionEvidence,
    operationalAlerts: report.operationalAlerts,
  };
}

export interface Phase8IntegrityReport {
  schemaVersion: string;
  reportWriterVersion: string;
  generatedAt: string;
  runId: string;
  reportChecksum: string;
  jsonChecksum: string;
  summaryChecksum: string;
  capacityChecksum: string;
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

export function buildPhase8IntegrityReport(input: {
  report: Phase8RunnerReport;
  jsonChecksum: string;
  summaryChecksum: string;
  capacityChecksum: string;
  retention: ReportRetentionInput;
}): Phase8IntegrityReport {
  const tampering = detectTampering(input.report, input.report);
  const roundTrip = roundTripPhase8Report(input.report);
  const retention = evaluateReportRetention(input.retention);
  return {
    schemaVersion: PHASE8_VERSION,
    reportWriterVersion: PHASE8_REPORT_MIGRATION_VERSION,
    generatedAt: new Date().toISOString(),
    runId: input.report.runId,
    reportChecksum: input.report.reportChecksum,
    jsonChecksum: input.jsonChecksum,
    summaryChecksum: input.summaryChecksum,
    capacityChecksum: input.capacityChecksum,
    tampered: tampering.tampered,
    reasons: tampering.reasons,
    roundTrip: { checksumOk: roundTrip.checksumOk, reasons: roundTrip.reasons },
    retention: {
      kept: retention.kept,
      purged: retention.purged,
      reasons: retention.reasons,
    },
  };
}

export function buildPhase8CapacityReport(report: Phase8RunnerReport): {
  schemaVersion: string;
  generatedAt: string;
  runnerVersion: string;
  runId: string;
  tenantId: string;
  environmentClass: string;
  provenance: string;
  profiles: Array<{
    profileId: string;
    kind: string;
    sampleSize: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    throughputRps: number;
    errorRate: number;
    tokenCost: number;
    saturation: {
      metric: string;
      value: number;
      unit: string;
      detection: string;
    } | null;
    recoveryTimeMs: number | null;
    correctness: string;
    isolation: string;
    regression: string;
    soakWindows: number;
    environmentClass: string;
    provenance: string;
    pressureEvidence: unknown;
    notes: string[];
  }>;
  caveats: string[];
  verdict: string;
  sloEvaluation: Phase8RunnerReport['sloEvaluation'];
  adapterRegistrations: string[];
} {
  return {
    schemaVersion: PHASE8_VERSION,
    generatedAt: new Date().toISOString(),
    runnerVersion: PHASE8_VERSION,
    runId: report.runId,
    tenantId: report.tenantId,
    environmentClass: report.environmentClass,
    provenance: report.provenance,
    profiles: report.metricBundles.map((b) => ({
      profileId: b.profileId,
      kind: b.profileId,
      sampleSize: b.latency.sampleSize,
      p50Ms: b.latency.p50Ms,
      p95Ms: b.latency.p95Ms,
      p99Ms: b.latency.p99Ms,
      throughputRps: b.throughputRps,
      errorRate: b.errorRate,
      tokenCost: b.tokenCost.costUsd,
      saturation: b.saturationPoint
        ? {
            metric: b.saturationPoint.metric,
            value: b.saturationPoint.inflectionValue,
            unit: b.saturationPoint.unit,
            detection: b.saturationPoint.detection,
          }
        : null,
      recoveryTimeMs: b.recoveryCurve?.recoveryTimeMs ?? null,
      correctness: b.correctnessVerdict,
      isolation: b.isolationVerdict,
      regression: b.regressionVerdict,
      soakWindows: b.soakWindows.length,
      environmentClass: b.environmentClass,
      provenance: b.provenance,
      pressureEvidence: b.pressureEvidence,
      notes: b.notes,
    })),
    caveats: [
      'capacity derived from in-memory simulation, not production telemetry',
      'no external SLO/SRE approval implied',
      're-run weekly for capacity drift signals',
      `environmentClass=${report.environmentClass}`,
      'release capacity gate blocks on unapproved SLO policy or non-real environment',
    ],
    verdict:
      report.environmentClass === 'SIMULATED'
        ? 'SIMULATED_NO_PRODUCTION_CLAIM'
        : report.status === 'PASS'
          ? 'CAPACITY_REPORT_PASSED'
          : report.status === 'INCONCLUSIVE'
            ? 'CAPACITY_REPORT_INCONCLUSIVE_INVESTIGATE'
            : 'CAPACITY_REPORT_BLOCKED_FAIL_CLOSED',
    sloEvaluation: report.sloEvaluation,
    adapterRegistrations: report.adapterRegistrations,
  };
}

export function writePhase8Report(
  input: WritePhase8ReportInput,
  options: {
    retention?: ReportRetentionInput;
  } = {},
): WritePhase8ReportOutput {
  Phase8RunnerReportSchema.parse(input.report);
  const base =
    input.fileBaseName ??
    `phase8-${input.report.runnerId}-${input.report.runId}`;
  const jsonPath = `${input.outDir}/${base}.json`;
  const summaryPath = `${input.outDir}/${base}-summary.json`;
  const capacityPath = `${input.outDir}/${base}-capacity.json`;
  const checksumPath = `${input.outDir}/${base}-checksum.txt`;
  const integrityPath = `${input.outDir}/${base}-integrity.json`;
  mkdirSync(input.outDir, { recursive: true });
  const json = JSON.stringify(input.report, null, 2);
  const summary = buildPhase8Summary(input.report);
  const capacity = buildPhase8CapacityReport(input.report);
  const jsonChecksum = `sha256:${createHash('sha256').update(json).digest('hex')}`;
  const summaryChecksum = `sha256:${createHash('sha256').update(JSON.stringify(summary)).digest('hex')}`;
  const capacityChecksum = `sha256:${createHash('sha256').update(JSON.stringify(capacity)).digest('hex')}`;
  writeFileSync(jsonPath, json);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(capacityPath, JSON.stringify(capacity, null, 2));
  writeFileSync(
    checksumPath,
    `reportChecksum=${input.report.reportChecksum}\njsonChecksum=${jsonChecksum}\nsummaryChecksum=${summaryChecksum}\ncapacityChecksum=${capacityChecksum}\n`,
  );
  const retentionInput: ReportRetentionInput = options.retention ?? {
    runId: input.report.runId,
    retentionClass: 'MEDIUM_TERM',
    retentionUntilMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
    legalHold: false,
  };
  const integrity = buildPhase8IntegrityReport({
    report: input.report,
    jsonChecksum,
    summaryChecksum,
    capacityChecksum,
    retention: retentionInput,
  });
  const integrityJson = JSON.stringify(integrity, null, 2);
  const integrityChecksum = `sha256:${createHash('sha256').update(integrityJson).digest('hex')}`;
  writeFileSync(integrityPath, integrityJson);
  return {
    jsonPath,
    summaryPath,
    capacityPath,
    checksumPath,
    integrityPath,
    jsonChecksum,
    summaryChecksum,
    capacityChecksum,
    integrityChecksum,
  };
}
