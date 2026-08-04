import { z } from 'zod';
import {
  IsoDateTimeSchema,
  RunOutcomeSchema,
  UuidSchema,
  type RunOutcome,
} from '../contracts';

export const PHASE11_VERSION = '1.0.0';

export const PilotLaneSchema = z.enum([
  'SHADOW',
  'SELECTED_HARD',
  'INCIDENT_DRILL',
  'ROLLBACK_DRILL',
  'RESTORE_TEST',
  'MONTHLY_REFRESH',
  'QUARTERLY_REVIEW',
]);
export type PilotLane = z.infer<typeof PilotLaneSchema>;

export const OnCallCoverageSchema = z
  .object({
    owner: z.string().min(1),
    primaryOnCall: z.string().min(1),
    secondaryOnCall: z.string().min(1),
    confirmedAt: IsoDateTimeSchema,
  })
  .strict();
export type OnCallCoverage = z.infer<typeof OnCallCoverageSchema>;

export const ShadowGateRecordSchema = z
  .object({
    id: UuidSchema,
    capabilityId: z.string().min(1),
    scenarioId: z.string().min(1),
    observedAt: IsoDateTimeSchema,
    expectedOutcome: RunOutcomeSchema,
    actualOutcome: RunOutcomeSchema,
    bypassed: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type ShadowGateRecord = z.infer<typeof ShadowGateRecordSchema>;

export const HardGateRecordSchema = z
  .object({
    id: UuidSchema,
    capabilityId: z.string().min(1),
    gateName: z.string().min(1),
    observedAt: IsoDateTimeSchema,
    passed: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type HardGateRecord = z.infer<typeof HardGateRecordSchema>;

export const IncidentDrillRecordSchema = z
  .object({
    id: UuidSchema,
    incidentId: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    openedAt: IsoDateTimeSchema,
    resolvedAt: IsoDateTimeSchema.nullable(),
    regressionCasesCreated: z.number().int().nonnegative(),
    passed: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type IncidentDrillRecord = z.infer<typeof IncidentDrillRecordSchema>;

export const RollbackDrillRecordSchema = z
  .object({
    id: UuidSchema,
    runId: z.string().min(1),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.nullable(),
    restorePoint: z.string().min(1),
    rollbackSucceeded: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type RollbackDrillRecord = z.infer<typeof RollbackDrillRecordSchema>;

export const RestoreTestRecordSchema = z
  .object({
    id: UuidSchema,
    backupId: z.string().min(1),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.nullable(),
    restoreSucceeded: z.boolean(),
    integrityVerified: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type RestoreTestRecord = z.infer<typeof RestoreTestRecordSchema>;

export const CorpusRefreshRecordSchema = z
  .object({
    id: UuidSchema,
    corpusName: z.string().min(1),
    refreshedAt: IsoDateTimeSchema,
    scenarioCount: z.number().int().nonnegative(),
    owner: z.string().min(1),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type CorpusRefreshRecord = z.infer<typeof CorpusRefreshRecordSchema>;

export const QuarterlyReviewRecordSchema = z
  .object({
    id: UuidSchema,
    reviewedAt: IsoDateTimeSchema,
    reviewer: z.string().min(1),
    operationalOwner: z.string().min(1),
    driftSummary: z.string().min(1),
    ownershipConfirmed: z.boolean(),
    onCallCoverageConfirmed: z.boolean(),
    evidenceRef: z.string().min(1),
  })
  .strict();
export type QuarterlyReviewRecord = z.infer<
  typeof QuarterlyReviewRecordSchema
>;

export const ProductionPilotDashboardSchema = z
  .object({
    shadowGateCount: z.number().int().nonnegative(),
    hardGateCount: z.number().int().nonnegative(),
    incidentDrillCount: z.number().int().nonnegative(),
    rollbackDrillCount: z.number().int().nonnegative(),
    restoreTestCount: z.number().int().nonnegative(),
    corpusRefreshCount: z.number().int().nonnegative(),
    quarterlyReviewCount: z.number().int().nonnegative(),
    silentBypassCount: z.number().int().nonnegative(),
    openIncidents: z.number().int().nonnegative(),
    readiness: z.enum(['READY', 'NOT_READY']),
    reasons: z.array(z.string().min(1)),
  })
  .strict();
export type ProductionPilotDashboard = z.infer<
  typeof ProductionPilotDashboardSchema
>;

export const ProductionPilotSummarySchema = z
  .object({
    schemaVersion: z.literal(PHASE11_VERSION),
    generatedAt: IsoDateTimeSchema,
    dashboard: ProductionPilotDashboardSchema,
    onCallCoverage: OnCallCoverageSchema.nullable(),
    latestCorpusRefreshAt: IsoDateTimeSchema.nullable(),
    latestQuarterlyReviewAt: IsoDateTimeSchema.nullable(),
  })
  .strict();
export type ProductionPilotSummary = z.infer<
  typeof ProductionPilotSummarySchema
>;

