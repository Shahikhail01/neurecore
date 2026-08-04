import { randomUUID, createHash } from 'crypto';
import {
  CorpusRefreshRecordSchema,
  HardGateRecordSchema,
  IncidentDrillRecordSchema,
  OnCallCoverageSchema,
  ProductionPilotDashboardSchema,
  ProductionPilotSummarySchema,
  QuarterlyReviewRecordSchema,
  RestoreTestRecordSchema,
  RollbackDrillRecordSchema,
  ShadowGateRecordSchema,
  type CorpusRefreshRecord,
  type HardGateRecord,
  type IncidentDrillRecord,
  type OnCallCoverage,
  type ProductionPilotDashboard,
  type ProductionPilotSummary,
  type QuarterlyReviewRecord,
  type RestoreTestRecord,
  type RollbackDrillRecord,
  type ShadowGateRecord,
} from './contracts';

type DrillEvidence = { evidenceRef: string };

export class ProductionPilotGovernance {
  private shadowGates: ShadowGateRecord[] = [];
  private hardGates: HardGateRecord[] = [];
  private incidentDrills: IncidentDrillRecord[] = [];
  private rollbackDrills: RollbackDrillRecord[] = [];
  private restoreTests: RestoreTestRecord[] = [];
  private corpusRefreshes: CorpusRefreshRecord[] = [];
  private quarterlyReviews: QuarterlyReviewRecord[] = [];
  private onCallCoverage: OnCallCoverage | null = null;

  private digest(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  setOnCallCoverage(input: OnCallCoverage) {
    this.onCallCoverage = OnCallCoverageSchema.parse(input);
  }

  recordShadowGate(input: Omit<ShadowGateRecord, 'id'>) {
    const record = ShadowGateRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.shadowGates.push(record);
    return record;
  }

  recordHardGate(input: Omit<HardGateRecord, 'id'>) {
    const record = HardGateRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.hardGates.push(record);
    return record;
  }

  runIncidentDrill(input: Omit<IncidentDrillRecord, 'id'>) {
    const record = IncidentDrillRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.incidentDrills.push(record);
    return record;
  }

  runRollbackDrill(input: Omit<RollbackDrillRecord, 'id'>) {
    const record = RollbackDrillRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.rollbackDrills.push(record);
    return record;
  }

  runRestoreTest(input: Omit<RestoreTestRecord, 'id'>) {
    const record = RestoreTestRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.restoreTests.push(record);
    return record;
  }

  refreshCorpus(input: Omit<CorpusRefreshRecord, 'id'>) {
    const record = CorpusRefreshRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.corpusRefreshes.push(record);
    return record;
  }

  conductQuarterlyReview(input: Omit<QuarterlyReviewRecord, 'id'>) {
    const record = QuarterlyReviewRecordSchema.parse({
      ...input,
      id: randomUUID(),
    });
    this.quarterlyReviews.push(record);
    return record;
  }

  getDashboard(): ProductionPilotDashboard {
    const silentBypasses = this.shadowGates.filter((g) => g.bypassed);
    const openIncidents = this.incidentDrills.filter((g) => !g.passed).length;
    const reasons: string[] = [];
    if (this.shadowGates.length === 0) reasons.push('no shadow gates recorded');
    if (this.hardGates.length === 0) reasons.push('no selected hard gates recorded');
    if (silentBypasses.length > 0) reasons.push('silent bypass detected in shadow gate');
    if (openIncidents > 0) reasons.push('open incident drill remains unresolved');
    if (!this.rollbackDrills.some((r) => r.rollbackSucceeded))
      reasons.push('rollback drill has not succeeded');
    if (!this.restoreTests.some((r) => r.restoreSucceeded && r.integrityVerified))
      reasons.push('restore test has not succeeded');
    if (!this.corpusRefreshes.length) reasons.push('monthly corpus refresh missing');
    if (!this.quarterlyReviews.length)
      reasons.push('quarterly control review missing');
    if (!this.onCallCoverage) reasons.push('on-call coverage missing');
    const readiness =
      reasons.length === 0 ? 'READY' : 'NOT_READY';
    return ProductionPilotDashboardSchema.parse({
      shadowGateCount: this.shadowGates.length,
      hardGateCount: this.hardGates.length,
      incidentDrillCount: this.incidentDrills.length,
      rollbackDrillCount: this.rollbackDrills.length,
      restoreTestCount: this.restoreTests.length,
      corpusRefreshCount: this.corpusRefreshes.length,
      quarterlyReviewCount: this.quarterlyReviews.length,
      silentBypassCount: silentBypasses.length,
      openIncidents,
      readiness,
      reasons,
    });
  }

  summarize(): ProductionPilotSummary {
    const latestCorpusRefresh = this.corpusRefreshes.at(-1)?.refreshedAt ?? null;
    const latestReview = this.quarterlyReviews.at(-1)?.reviewedAt ?? null;
    return ProductionPilotSummarySchema.parse({
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      dashboard: this.getDashboard(),
      onCallCoverage: this.onCallCoverage,
      latestCorpusRefreshAt: latestCorpusRefresh,
      latestQuarterlyReviewAt: latestReview,
    });
  }

  buildEvidenceRef(prefix: string, payload: unknown) {
    return `${prefix}:${this.digest(payload).slice(0, 16)}`;
  }

  seedDefaultPilotEvidence() {
    const now = new Date().toISOString();
    const evidence = this.buildEvidenceRef('pilot', { now });
    this.recordShadowGate({
      capabilityId: 'CAP-PILOT-001',
      scenarioId: 'shadow-golden-path',
      observedAt: now,
      expectedOutcome: 'PASSED',
      actualOutcome: 'PASSED',
      bypassed: false,
      evidenceRef: evidence,
    });
    this.recordHardGate({
      capabilityId: 'CAP-PILOT-001',
      gateName: 'release-readiness',
      observedAt: now,
      passed: true,
      evidenceRef: evidence,
    });
    this.runIncidentDrill({
      incidentId: 'incident-001',
      severity: 'high',
      openedAt: now,
      resolvedAt: now,
      regressionCasesCreated: 2,
      passed: true,
      evidenceRef: evidence,
    });
    this.runRollbackDrill({
      runId: 'run-001',
      startedAt: now,
      completedAt: now,
      restorePoint: 'restore-point-001',
      rollbackSucceeded: true,
      evidenceRef: evidence,
    });
    this.runRestoreTest({
      backupId: 'backup-001',
      startedAt: now,
      completedAt: now,
      restoreSucceeded: true,
      integrityVerified: true,
      evidenceRef: evidence,
    });
    this.refreshCorpus({
      corpusName: 'monthly-pilot-corpus',
      refreshedAt: now,
      scenarioCount: 120,
      owner: 'qa-lead',
      evidenceRef: evidence,
    });
    this.conductQuarterlyReview({
      reviewedAt: now,
      reviewer: 'security-lead',
      operationalOwner: 'platform-owner',
      driftSummary: 'No drift observed; control cadence healthy.',
      ownershipConfirmed: true,
      onCallCoverageConfirmed: true,
      evidenceRef: evidence,
    });
    this.setOnCallCoverage({
      owner: 'platform-owner',
      primaryOnCall: 'primary-ops',
      secondaryOnCall: 'secondary-ops',
      confirmedAt: now,
    });
  }
}

