import { ProductionPilotGovernance } from './production-pilot-governance';

describe('Phase 11 — Production Pilot and Continuous Improvement', () => {
  it('tracks shadow gates without permitting silent bypass', () => {
    const g = new ProductionPilotGovernance();
    g.recordShadowGate({
      capabilityId: 'CAP-1',
      scenarioId: 'scenario-1',
      observedAt: new Date().toISOString(),
      expectedOutcome: 'PASSED',
      actualOutcome: 'PASSED',
      bypassed: false,
      evidenceRef: 'pilot:shadow-1',
    });
    expect(g.getDashboard().readiness).toBe('NOT_READY');
    expect(g.getDashboard().reasons).toContain('no selected hard gates recorded');
  });

  it('treats silent bypasses as a hard blocker', () => {
    const g = new ProductionPilotGovernance();
    const now = new Date().toISOString();
    g.recordShadowGate({
      capabilityId: 'CAP-1',
      scenarioId: 'scenario-1',
      observedAt: now,
      expectedOutcome: 'PASSED',
      actualOutcome: 'FAILED',
      bypassed: true,
      evidenceRef: 'pilot:shadow-2',
    });
    expect(g.getDashboard().silentBypassCount).toBe(1);
    expect(g.getDashboard().reasons).toContain(
      'silent bypass detected in shadow gate',
    );
  });

  it('requires selected hard gates in addition to shadow gates', () => {
    const g = new ProductionPilotGovernance();
    g.recordShadowGate({
      capabilityId: 'CAP-1',
      scenarioId: 'scenario-1',
      observedAt: new Date().toISOString(),
      expectedOutcome: 'PASSED',
      actualOutcome: 'PASSED',
      bypassed: false,
      evidenceRef: 'pilot:shadow-3',
    });
    expect(g.getDashboard().hardGateCount).toBe(0);
    expect(g.getDashboard().reasons).toContain(
      'no selected hard gates recorded',
    );
  });

  it('records incident drills and treats unresolved incidents as blockers', () => {
    const g = new ProductionPilotGovernance();
    g.runIncidentDrill({
      incidentId: 'inc-1',
      severity: 'critical',
      openedAt: new Date().toISOString(),
      resolvedAt: null,
      regressionCasesCreated: 0,
      passed: false,
      evidenceRef: 'pilot:incident-1',
    });
    expect(g.getDashboard().openIncidents).toBe(1);
    expect(g.getDashboard().reasons).toContain(
      'open incident drill remains unresolved',
    );
  });

  it('requires rollback drill success', () => {
    const g = new ProductionPilotGovernance();
    g.recordShadowGate({
      capabilityId: 'CAP-1',
      scenarioId: 'scenario-1',
      observedAt: new Date().toISOString(),
      expectedOutcome: 'PASSED',
      actualOutcome: 'PASSED',
      bypassed: false,
      evidenceRef: 'pilot:shadow-4',
    });
    g.recordHardGate({
      capabilityId: 'CAP-1',
      gateName: 'selected-hard',
      observedAt: new Date().toISOString(),
      passed: true,
      evidenceRef: 'pilot:hard-1',
    });
    expect(g.getDashboard().reasons).toContain(
      'rollback drill has not succeeded',
    );
  });

  it('requires restore success with integrity verification', () => {
    const g = new ProductionPilotGovernance();
    g.recordShadowGate({
      capabilityId: 'CAP-1',
      scenarioId: 'scenario-1',
      observedAt: new Date().toISOString(),
      expectedOutcome: 'PASSED',
      actualOutcome: 'PASSED',
      bypassed: false,
      evidenceRef: 'pilot:shadow-5',
    });
    g.recordHardGate({
      capabilityId: 'CAP-1',
      gateName: 'selected-hard',
      observedAt: new Date().toISOString(),
      passed: true,
      evidenceRef: 'pilot:hard-2',
    });
    g.runRollbackDrill({
      runId: 'run-1',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      restorePoint: 'restore-1',
      rollbackSucceeded: true,
      evidenceRef: 'pilot:rb-1',
    });
    expect(g.getDashboard().reasons).toContain(
      'restore test has not succeeded',
    );
  });

  it('requires corpus refresh and quarterly review cadence', () => {
    const g = new ProductionPilotGovernance();
    expect(g.getDashboard().reasons).toContain(
      'monthly corpus refresh missing',
    );
    expect(g.getDashboard().reasons).toContain(
      'quarterly control review missing',
    );
  });

  it('requires on-call coverage to be operational', () => {
    const g = new ProductionPilotGovernance();
    expect(g.getDashboard().reasons).toContain(
      'on-call coverage missing',
    );
  });

  it('produces READY when all pilot controls are present', () => {
    const g = new ProductionPilotGovernance();
    g.seedDefaultPilotEvidence();
    const summary = g.summarize();
    expect(summary.dashboard.readiness).toBe('READY');
    expect(summary.dashboard.reasons).toHaveLength(0);
    expect(summary.onCallCoverage).not.toBeNull();
    expect(summary.latestCorpusRefreshAt).not.toBeNull();
    expect(summary.latestQuarterlyReviewAt).not.toBeNull();
  });
});

