/**
 * Phase 3 — Regression Coordinator Conformance
 *
 * Validates the composition glue between the Phase 3 modules:
 *   - onFailure routes through FailureToRegressionWorkflow
 *   - sweep expires quarantines and promotes them when defect-linked
 *   - recordReplay updates ReplayReproducibilityTracker
 *   - evaluateDataQuality delegates to DataQualityGate
 *   - evaluatePR selects lanes and evaluates the critical-surface gate
 */

import {
  RegressionCoordinator,
  DataQualityInputSchema,
  type DataQualityInput,
} from './index';
import { ChangedSurfaceSchema } from '../pr-lane';
import {
  InMemoryDataContractStore,
  SchemaReferentialValidator,
  SchemaDriftDetector,
  DataQualityGate,
} from '../data-quality';

const FIXED_ID = () => '00000000-0000-0000-0000-000000000000';

describe('harness/regression — onFailure', () => {
  it('creates a new defect on first failure', () => {
    const coord = new RegressionCoordinator();
    const result = coord.onFailure({
      runId: 'run-1',
      scenarioId: 'sim-04-s2',
      capabilityIds: ['cap-1'],
      severity: 'HIGH',
      errorMessage: 'Submit button unreachable',
      actorId: 'runner',
      tenantId: 'tnt-1',
      expectedBehavior: 'Submit creates customer',
      assertions: ['201 returned'],
    });
    expect(result.created).toBe(true);
    expect(result.remediation).toBe('NEW_DEFECT');
  });

  it('links to existing defect when scenario + test path match', () => {
    const coord = new RegressionCoordinator();
    const a = coord.onFailure({
      runId: 'run-1',
      scenarioId: 'sim-04-s2',
      capabilityIds: ['cap-1'],
      severity: 'HIGH',
      errorMessage: 'Submit blocked',
      actorId: 'runner',
      tenantId: 'tnt-1',
      expectedBehavior: 'Submit creates customer',
      assertions: ['201 returned'],
      testPath: 'sim-04.spec.ts',
    });
    const b = coord.onFailure({
      runId: 'run-2',
      scenarioId: 'sim-04-s2',
      capabilityIds: ['cap-1'],
      severity: 'HIGH',
      errorMessage: 'Submit blocked again',
      actorId: 'runner',
      tenantId: 'tnt-1',
      expectedBehavior: 'Submit creates customer',
      assertions: ['201 returned'],
      testPath: 'sim-04.spec.ts',
    });
    expect(b.defectId).toBe(a.defectId);
    expect(b.created).toBe(false);
  });
});

describe('harness/regression — sweep', () => {
  function makeCoord() {
    // Freeze the clock so register() accepts "future" expiries relative to
    // a known anchor and the sweep can mark them expired later.
    const clock = { now: () => new Date('2026-07-01T00:00:00.000Z') };
    return { coord: new RegressionCoordinator({ clock }), clock };
  }

  it('expired quarantines without linked defect generate recommendations', () => {
    const { coord } = makeCoord();
    const engine = (coord as any)
      .quarantine as import('../quarantine').QuarantineEngine;
    engine.register({
      scenarioId: 'sim-04-s3',
      reason: 'FLAKY',
      description: 'still flaky',
      ownerId: 'qa',
      ownerRole: 'QA',
      createdBy: 'qa',
      expiresAt: '2026-07-15T00:00:00.000Z', // 14d future relative to frozen clock
    });
    const report = coord.sweep('2026-08-10T00:00:00.000Z');
    expect(report.expiredQuarantines.length).toBe(1);
    expect(report.revokeRecommendations.length).toBe(1);
    expect(report.promotedToDefects).toHaveLength(0);
  });

  it('expired quarantines with linked defect are promoted', () => {
    const { coord } = makeCoord();
    const engine = (coord as any)
      .quarantine as import('../quarantine').QuarantineEngine;
    const defectId = '11111111-1111-1111-1111-111111111111';
    engine.register({
      scenarioId: 'sim-04-s3',
      reason: 'FLAKY',
      description: 'fixed',
      ownerId: 'qa',
      ownerRole: 'QA',
      createdBy: 'qa',
      expiresAt: '2026-07-15T00:00:00.000Z',
      linkedDefectId: defectId,
    });
    const report = coord.sweep('2026-08-10T00:00:00.000Z');
    expect(report.promotedToDefects).toContain(defectId);
    expect(report.revokeRecommendations).toHaveLength(0);
  });
});

describe('harness/regression — recordReplay', () => {
  it('updates the replay tracker', () => {
    const coord = new RegressionCoordinator();
    const rec = coord.recordReplay(
      '11111111-1111-1111-1111-111111111111',
      'sim-04-s2',
      'bundle-1',
      'REPRODUCED',
      'replayed',
    );
    expect(rec.isReplayable).toBe(true);
    expect(rec.reproductionCount).toBe(1);
  });
});

describe('harness/regression — evaluateDataQuality', () => {
  it('evaluates via DataQualityGate', () => {
    const store = new InMemoryDataContractStore();
    store.upsert({
      contractId: 'customer',
      name: 'Customer',
      kind: 'SCHEMA',
      version: '1.0.0',
      owner: 'data-platform',
      fields: [
        { name: 'id', type: 'uuid', nullable: false, pii: false },
        { name: 'email', type: 'email', nullable: false, pii: false },
      ],
      references: [],
      invariants: [],
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      checksum: 'sha256:' + 'a'.repeat(64),
    });
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(FIXED_ID);
    const gate = new DataQualityGate(validator, drift);
    const coord = new RegressionCoordinator({ dataQuality: gate });
    const input: DataQualityInput = DataQualityInputSchema.parse({
      contractId: 'customer',
      rows: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'a@example.com',
        },
      ],
      current: { rowCount: 1, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 1, freshnessSeconds: 60, numericFields: {} },
    });
    const verdict = coord.evaluateDataQuality(input);
    expect(verdict.verdict).toBe('PASS');
  });

  it('throws when DataQualityGate not configured', () => {
    const coord = new RegressionCoordinator();
    expect(() =>
      coord.evaluateDataQuality(
        DataQualityInputSchema.parse({
          contractId: 'customer',
          rows: [],
          current: { rowCount: 0, freshnessSeconds: 60, numericFields: {} },
          baseline: { rowCount: 0, freshnessSeconds: 60, numericFields: {} },
        }),
      ),
    ).toThrow(/DataQualityGate not configured/);
  });
});

describe('harness/regression — evaluatePR', () => {
  it('runs lane selection and the critical-surface gate together', () => {
    const coord = new RegressionCoordinator();
    const surf = ChangedSurfaceSchema.parse({
      prId: 'pr-x',
      baseSha: 'base',
      headSha: 'head',
      changes: [
        {
          changeId: '11111111-1111-1111-1111-111111111111',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ],
      detectedAt: '2026-08-02T00:00:00.000Z',
    });
    const out = coord.evaluatePR({
      prId: 'pr-x',
      surface: surf,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(out.selection.mandatoryCriticalLaneForced).toBe(true);
    expect(out.gate.passed).toBe(true);
  });
});
