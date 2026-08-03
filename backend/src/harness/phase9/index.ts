export * from './contracts';
export * from './ports';
export * from './runners';
export * from './ci-lane';
export * from './report-writer';
export * from './report-migration';

// Re-export classes/types that are referenced from runners.ts to keep the
// surface coherent for downstream callers (test suites, scripts).
export type {
  CapabilityRegistryEntry,
  CertificateOfCapability,
  RollbackDrillRequirement,
  Phase9ReleaseWaiver,
  VerdictEvaluation,
  ChangedSurfaceSelectorOutput,
  ResolvedEvidenceBundle,
} from './contracts';

export {
  InMemoryCapabilityRegistry,
  InMemoryEvidenceResolver,
  InMemoryWaiversLedger,
  InMemoryRollbackRegistry,
  SupportSignatureAuthority,
} from './ports';

export type { WaiverStatus } from './ports';

export {
  Phase9ReleaseGateCoordinator,
  defaultPhase9Policies,
  findPolicy,
  buildPhase9Evaluation,
  buildReleaseGateVerdict,
  buildRequiredSuiteSchedule,
} from './runners';

export {
  Phase9LaneSelector,
  Phase9ReleaseGate,
  PHASE9_CI_LANE_VERSION,
  PHASE9_DEFAULT_LANES,
  Phase9LanePolicySchema,
  aggregatePhase9,
} from './ci-lane';

export type { Phase9LanePolicy } from './ci-lane';

export {
  Phase9CapabilityCertificateSchema,
  buildPhase9Summary,
  buildPhase9IntegrityReport,
  writePhase9Report,
  PHASE9_REPORT_WRITER_VERSION,
} from './report-writer';

export type {
  Phase9CapabilityCertificate,
  Phase9Summary,
  Phase9IntegrityReport,
  Phase9WriteReportInput,
  Phase9WriteReportOutput,
} from './report-writer';

export {
  roundTripPhase9Report,
  detectTampering,
  evaluateReportRetention,
  restoreReport,
  tamperedReport,
  PHASE9_REPORT_MIGRATION_VERSION,
  KNOWN_PHASE9_REPORT_VERSIONS,
  Phase9ReportEnvelopeSchema,
} from './report-migration';

export type {
  Phase9ReportEnvelope,
  Phase9ReportRestoreInput,
  Phase9ReportRestoreOutcome,
  Phase9ReportRetentionInput,
  Phase9ReportRetentionOutcome,
} from './report-migration';
