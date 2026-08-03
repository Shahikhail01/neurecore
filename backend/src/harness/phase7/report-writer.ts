import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { Phase7RunnerReportSchema, type Phase7RunnerReport } from './contracts';
import { PHASE7_VERSION } from './contracts';

export const PHASE7_REPORT_WRITER_VERSION = '1.0.0';

export interface WriteReportInput {
  report: Phase7RunnerReport;
  outDir: string;
  fileBaseName?: string;
}

export interface WriteReportOutput {
  jsonPath: string;
  summaryPath: string;
  checksumPath: string;
  jsonChecksum: string;
  summaryChecksum: string;
}

export function writeMachineReadableReport(
  input: WriteReportInput,
): WriteReportOutput {
  Phase7RunnerReportSchema.parse(input.report);
  const base =
    input.fileBaseName ??
    `phase7-${input.report.runnerId}-${input.report.runId}`;
  const jsonPath = `${input.outDir}/${base}.json`;
  const summaryPath = `${input.outDir}/${base}-summary.json`;
  const checksumPath = `${input.outDir}/${base}-checksum.txt`;
  mkdirSync(input.outDir, { recursive: true });
  const json = JSON.stringify(input.report, null, 2);
  const summary = buildSummary(input.report);
  const jsonChecksum = `sha256:${createHash('sha256').update(json).digest('hex')}`;
  const summaryChecksum = `sha256:${createHash('sha256').update(JSON.stringify(summary)).digest('hex')}`;
  writeFileSync(jsonPath, json);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(
    checksumPath,
    `reportChecksum=${input.report.reportChecksum}\njsonChecksum=${jsonChecksum}\nsummaryChecksum=${summaryChecksum}\n`,
  );
  return { jsonPath, summaryPath, checksumPath, jsonChecksum, summaryChecksum };
}

export interface Phase7Summary {
  schemaVersion: string;
  runnerId: string;
  runId: string;
  tenantId: string;
  status: Phase7RunnerReport['status'];
  outcome: Phase7RunnerReport['outcome'];
  startedAt: string;
  finalizedAt: string;
  counters: Phase7RunnerReport['counters'];
  cleanup: {
    attempted: boolean;
    success: boolean;
    failedCleanup: number;
    orphans: number;
    notAttemptedReason?: string;
  };
  evidenceCount: number;
  reportChecksum: string;
  runnerVersion: string;
  executionEnvironment: Phase7RunnerReport['executionEnvironment'];
  productionAdapterStatus: Phase7RunnerReport['productionAdapterStatus'];
  externalApprovalStatus: Phase7RunnerReport['externalApprovalStatus'];
  deterministicMeasurement: Phase7RunnerReport['deterministicMeasurement'];
  cleanupAttempted: boolean;
  operationalAlerts: Phase7RunnerReport['operationalAlerts'];
}

export function buildSummary(report: Phase7RunnerReport): Phase7Summary {
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
      attempted: report.cleanupResult.attempted,
      success: report.cleanupResult.success,
      failedCleanup: report.cleanupResult.failedCleanup.length,
      orphans: report.cleanupResult.orphanedResources.length,
      notAttemptedReason: report.cleanupResult.attempted
        ? undefined
        : report.cleanupResult.notAttemptedReason,
    },
    evidenceCount: report.evidenceEnvelopes.length,
    reportChecksum: report.reportChecksum,
    runnerVersion: PHASE7_VERSION,
    executionEnvironment: report.executionEnvironment,
    productionAdapterStatus: report.productionAdapterStatus,
    externalApprovalStatus: report.externalApprovalStatus,
    deterministicMeasurement: report.deterministicMeasurement,
    cleanupAttempted: report.cleanupAttempted,
    operationalAlerts: report.operationalAlerts,
  };
}
