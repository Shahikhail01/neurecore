import { z } from 'zod';
import {
  Phase8RunnerReportSchema,
  PHASE8_VERSION,
  type Phase8RunnerReport,
  type StatisticalConfidence,
  type RegressionEvidence,
  type OperationalAlert,
} from './contracts';

export const PHASE8_REPORT_MIGRATION_VERSION = '1.0.0';

export const KNOWN_REPORT_VERSIONS = [
  '1.0.0',
  '1.1.0',
  PHASE8_VERSION,
] as const;
export type KnownReportVersion = (typeof KNOWN_REPORT_VERSIONS)[number];

export const MigratedReportEnvelopeSchema = z
  .object({
    schemaVersion: z.string().min(1),
    runnerVersion: z.string().min(1),
    reportWriterVersion: z.string().min(1),
    migratedFrom: z.array(z.string().min(1)).default([]),
    restoredAt: z.string().datetime().optional(),
    data: z.unknown(),
  })
  .strict();
export type MigratedReportEnvelope = z.infer<
  typeof MigratedReportEnvelopeSchema
>;

export const PHASE8_SUPPORTED_REPORT_WRITER_VERSIONS = ['1.0.0'] as const;

export interface MigrationStep {
  name: string;
  run: (report: unknown) => unknown;
}

export class ReportSchemaMigratorChain {
  constructor(
    public readonly fromVersion: KnownReportVersion,
    public readonly toVersion: KnownReportVersion,
    public readonly steps: readonly MigrationStep[],
  ) {}

  static buildDefaultChain(): ReportSchemaMigratorChain {
    return new ReportSchemaMigratorChain('1.0.0', PHASE8_VERSION, [
      {
        name: 'add statistical confidence',
        run: (input) => {
          const r = input as Record<string, unknown>;
          if (!Array.isArray(r['statisticalConfidence'])) {
            r['statisticalConfidence'] = [];
          }
          return r;
        },
      },
      {
        name: 'add regression evidence',
        run: (input) => {
          const r = input as Record<string, unknown>;
          if (!Array.isArray(r['regressionEvidence'])) {
            r['regressionEvidence'] = [];
          }
          return r;
        },
      },
      {
        name: 'add operational alerts',
        run: (input) => {
          const r = input as Record<string, unknown>;
          if (!Array.isArray(r['operationalAlerts'])) {
            r['operationalAlerts'] = [];
          }
          return r;
        },
      },
    ]);
  }

  plan(_report: unknown): {
    fromVersion: KnownReportVersion;
    toVersion: KnownReportVersion;
    steps: string[];
    dryRun: boolean;
  } {
    return {
      fromVersion: this.fromVersion,
      toVersion: this.toVersion,
      steps: this.steps.map((s) => s.name),
      dryRun: true,
    };
  }

  apply(report: unknown): {
    schemaVersion: KnownReportVersion;
    runnerVersion: string;
    reportWriterVersion: string;
    migratedFrom: string[];
    data: unknown;
  } {
    let cur = JSON.parse(JSON.stringify(report)) as unknown;
    const applied: string[] = [];
    for (const step of this.steps) {
      cur = step.run(cur);
      applied.push(step.name);
    }
    const finalVersion = (readVersion(cur) ??
      this.toVersion) as KnownReportVersion;
    return {
      schemaVersion: finalVersion,
      runnerVersion: PHASE8_VERSION,
      reportWriterVersion: PHASE8_REPORT_MIGRATION_VERSION,
      migratedFrom: [this.fromVersion, ...applied],
      data: cur,
    };
  }

  verify(report: unknown): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    try {
      Phase8RunnerReportSchema.parse(report);
      return { valid: true, reasons };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reasons.push(msg);
      return { valid: false, reasons };
    }
  }
}

function readVersion(report: unknown): string | null {
  if (report && typeof report === 'object' && 'schemaVersion' in report) {
    const v = (report as { schemaVersion: unknown }).schemaVersion;
    if (typeof v === 'string') return v;
  }
  return null;
}

export function roundTripPhase8Report(report: Phase8RunnerReport): {
  envelope: MigratedReportEnvelope;
  restored: Phase8RunnerReport;
  checksumOk: boolean;
  reasons: string[];
} {
  const chain = ReportSchemaMigratorChain.buildDefaultChain();
  const migrated = chain.apply(report);
  MigratedReportEnvelopeSchema.parse({
    schemaVersion: migrated.schemaVersion,
    runnerVersion: migrated.runnerVersion,
    reportWriterVersion: migrated.reportWriterVersion,
    migratedFrom: migrated.migratedFrom,
    data: migrated.data,
  });
  const restored = migrated.data as Phase8RunnerReport;
  const verify = chain.verify(restored);
  if (!verify.valid) {
    return {
      envelope: {
        schemaVersion: migrated.schemaVersion,
        runnerVersion: migrated.runnerVersion,
        reportWriterVersion: migrated.reportWriterVersion,
        migratedFrom: migrated.migratedFrom,
        data: migrated.data,
      },
      restored,
      checksumOk: false,
      reasons: verify.reasons,
    };
  }
  const checksumOk =
    restored.reportChecksum === report.reportChecksum &&
    JSON.stringify(restored.counters) === JSON.stringify(report.counters) &&
    restored.runId === report.runId;
  return {
    envelope: {
      schemaVersion: migrated.schemaVersion,
      runnerVersion: migrated.runnerVersion,
      reportWriterVersion: migrated.reportWriterVersion,
      migratedFrom: migrated.migratedFrom,
      data: migrated.data,
    },
    restored,
    checksumOk,
    reasons: checksumOk ? [] : ['checksum/counters mismatch after round-trip'],
  };
}

export function tamperedReport(
  report: Phase8RunnerReport,
  tamper: 'counters' | 'checksum' | 'status',
): Phase8RunnerReport {
  const cloned: Phase8RunnerReport = JSON.parse(
    JSON.stringify(report),
  ) as Phase8RunnerReport;
  switch (tamper) {
    case 'counters':
      cloned.counters = {
        ...cloned.counters,
        passed: cloned.counters.passed + 999,
      };
      return cloned;
    case 'checksum':
      cloned.reportChecksum =
        'sha256:0000000000000000000000000000000000000000000000000000000000000000' as never;
      return cloned;
    case 'status':
      cloned.status = cloned.status === 'PASS' ? 'BLOCK' : 'PASS';
      return cloned;
  }
}

export function detectTampering(
  original: Phase8RunnerReport,
  candidate: Phase8RunnerReport,
): { tampered: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (original.reportChecksum !== candidate.reportChecksum) {
    reasons.push('reportChecksum changed');
  }
  if (
    JSON.stringify(original.counters) !== JSON.stringify(candidate.counters)
  ) {
    reasons.push('counters mutated');
  }
  if (original.status !== candidate.status) {
    reasons.push('status mutated');
  }
  if (original.runId !== candidate.runId) {
    reasons.push('runId mutated');
  }
  return { tampered: reasons.length > 0, reasons };
}

export interface ReportRetentionInput {
  runId: string;
  retentionClass: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'PERMANENT';
  retentionUntilMs: number;
  nowMs?: number;
  legalHold: boolean;
}

export interface ReportRetentionOutcome {
  kept: boolean;
  purged: boolean;
  reasons: string[];
}

export function evaluateReportRetention(
  input: ReportRetentionInput,
): ReportRetentionOutcome {
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

export interface ReportRestoreInput {
  report: unknown;
  sourceChecksum: string;
  expectedSchemaVersion?: string;
}

export interface ReportRestoreOutcome {
  restored: boolean;
  valid: boolean;
  reasons: string[];
  report: Phase8RunnerReport | null;
}

export function restoreReport(input: ReportRestoreInput): ReportRestoreOutcome {
  const reasons: string[] = [];
  if (!input.report || typeof input.report !== 'object') {
    return {
      restored: false,
      valid: false,
      reasons: ['report is not an object'],
      report: null,
    };
  }
  const r = input.report as Partial<Phase8RunnerReport>;
  if (
    input.expectedSchemaVersion &&
    r.schemaVersion !== input.expectedSchemaVersion
  ) {
    reasons.push(
      `schemaVersion mismatch: got ${r.schemaVersion ?? 'unknown'} expected ${input.expectedSchemaVersion}`,
    );
  }
  if (!r.reportChecksum) {
    reasons.push('reportChecksum missing');
    return { restored: false, valid: false, reasons, report: null };
  }
  if (r.reportChecksum !== input.sourceChecksum) {
    reasons.push('checksum mismatch — report tampered or corrupted');
    return { restored: false, valid: false, reasons, report: null };
  }
  const parsed = Phase8RunnerReportSchema.safeParse(r);
  if (!parsed.success) {
    return {
      restored: true,
      valid: false,
      reasons: [...reasons, parsed.error.message],
      report: null,
    };
  }
  return { restored: true, valid: true, reasons: [], report: parsed.data };
}

export function emptyStatisticalConfidence(): StatisticalConfidence {
  return {
    schemaVersion: PHASE8_VERSION,
    sampleSize: 0,
    confidenceLevel: 0,
    method: 'NONE',
    marginOfError: null,
    sufficient: false,
    reason: 'no samples',
  };
}

export function emptyRegressionEvidence(): RegressionEvidence {
  return {
    schemaVersion: PHASE8_VERSION,
    baselineRunId: null,
    baselineBundleId: null,
    baselineProvenance: null,
    comparedAt: new Date(0).toISOString(),
    toleranceP95Ratio: 1.5,
    toleranceErrorRate: 0.05,
    observedP95Ratio: null,
    observedErrorDelta: null,
    reason: 'no comparison performed',
  };
}

export function emptyOperationalAlert(): OperationalAlert {
  return {
    schemaVersion: PHASE8_VERSION,
    alertId: '00000000-0000-0000-0000-000000000000',
    kind: 'UNSUPPORTED_ROUTING',
    severity: 'INFO',
    message: '',
    profileId: null,
    metricBundleId: null,
    runId: null,
    tenantId: null,
    observedAt: new Date(0).toISOString(),
    context: {},
  };
}
