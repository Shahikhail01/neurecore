/**
 * Phase 3 — Closing Integration Test
 *
 * Validates that all §10 Phase 3 deliverables are present and wired:
 *   - Shared fixture package (deliverable 1)
 *   - Deterministic tenant/data builders (deliverable 2)
 *   - Defect registry (deliverable 3)
 *   - Automatic failure-to-regression workflow (deliverable 4)
 *   - Test quarantine with owner/reason/expiry (deliverable 5)
 *   - Data contracts and drift checks (deliverable 6)
 *
 * And the §10 Phase 3 GATE:
 *   - Mandatory PR lane enabled for changed critical surfaces.
 *
 * Exit criteria from §10:
 *   - "critical known defects have replayable tests"
 *   - "flaky tests cannot be hidden indefinitely"
 *   - "fixture and cleanup reliability meet agreed thresholds"
 */

import {
  FixturePackage,
  SequentialIdFactory,
  InMemoryTenantProvisioner,
  UserBuilder,
  ProjectBuilder,
  computeCleanupMetrics,
  classifyFlakiness,
  TeardownReportSchema,
} from './fixtures';
import {
  DefectRegistry,
  InMemoryDefectStore,
  PromotionEngine,
  FailureToRegressionWorkflow,
  DefectRecordSchema,
} from './defects';
import {
  QuarantineEngine,
  InMemoryQuarantineStore,
  QuarantinePolicySchema,
} from './quarantine';
import {
  InMemoryDataContractStore,
  SchemaReferentialValidator,
  SchemaDriftDetector,
  DataQualityGate,
  DataContractSchema,
  LineageBuilder,
} from './data-quality';
import { Sha256ChecksumSchema } from './contracts';
import {
  LaneSelector,
  CriticalSurfaceGate,
  DEFAULT_LANE_POLICIES,
  ChangedSurfaceSchema,
  PR_LANE_VERSION,
} from './pr-lane';
import {
  RegressionCoordinator,
  IngestedFailureSchema,
  SweepReportSchema,
  REGRESSION_VERSION,
} from './regression';
import type { FailureLinkRequest } from './defects';

describe('Phase 3 — Deliverable 1: Shared Fixture Package', () => {
  it('exposes builders, clock, RNG, and id factory through one API', () => {
    const pkg = new FixturePackage({ seed: 'phase3-test' });
    expect(pkg.clock).toBeDefined();
    expect(pkg.rng).toBeDefined();
    expect(pkg.ids).toBeDefined();
    expect(pkg.tenants).toBeDefined();

    const tenant = pkg.tenants.provision({ industry: 'healthcare' });
    const user = pkg.user(tenant.tenantId).with({ email: 'a@b.com' }).build();
    const project = pkg
      .project(tenant.tenantId, user.userId)
      .with({ name: 'Q3 Audit' })
      .build();

    expect(user.tenantId).toBe(tenant.tenantId);
    expect(project.ownerId).toBe(user.userId);
  });

  it('is reproducible given the same seed', () => {
    const a = new FixturePackage({ seed: 'repro' });
    const b = new FixturePackage({ seed: 'repro' });
    expect(a.tenants.provision().tenantId).toBe(b.tenants.provision().tenantId);
  });

  it('cleanup reliability meets the default thresholds when teardown is clean', () => {
    const pkg = new FixturePackage();
    const tenant = pkg.tenants.provision();
    pkg.tenants.registerResource(tenant.tenantId, 'r1');
    const reports = [pkg.tenants.teardown(tenant.tenantId)];
    const metrics = computeCleanupMetrics(reports);
    expect(metrics.passesReliabilityThreshold).toBe(true);
  });
});

describe('Phase 3 — Deliverable 2: Deterministic Tenant / Data Builders', () => {
  it('UserBuilder produces deterministic ids for a given id factory', () => {
    const ids = new SequentialIdFactory('u');
    const u = new UserBuilder(ids, 't-1', { email: 'a@b.com' }).build();
    expect(u.userId).toBe('usr-00000001');
  });

  it('ProjectBuilder produces many records with independent ids', () => {
    const ids = new SequentialIdFactory('p');
    const projects = new ProjectBuilder(ids, 't-1', 'u-1').buildMany(3);
    expect(projects.map((p) => p.projectId)).toEqual([
      'proj-00000001',
      'proj-00000002',
      'proj-00000003',
    ]);
  });

  it('TenantProvisioner produces DISPOSABLE tenants for replay', () => {
    const t = new InMemoryTenantProvisioner();
    const tenant = t.provision({ isolationTier: 'DISPOSABLE' });
    expect(tenant.isolationTier).toBe('DISPOSABLE');
  });
});

describe('Phase 3 — Deliverable 3: Defect Registry + Mandatory Promotion Rules', () => {
  function makeDefect(
    opts: { mandatoryScenarioId: string; reviewer?: string } = {
      mandatoryScenarioId: 's1',
    },
  ) {
    const store = new InMemoryDefectStore();
    const clock = { now: () => new Date('2026-08-02T12:00:00.000Z') };
    const registry = new DefectRegistry(store, clock);
    const defect = registry.register({
      title: 'Modal blocks submit',
      description: 'Backdrop z-index issue',
      severity: 'CRITICAL',
      owner: {
        ownerId: 'qa-owner',
        ownerRole: 'QA',
        confirmedAt: '2026-08-02T00:00:00.000Z',
      },
      capabilityIds: ['cap-1'],
      initialExpectedBehavior: 'Submit creates a customer',
      initialAssertions: ['201', 'row visible'],
      createdBy: 'runner',
      initialLinks: [
        {
          scenarioId: opts.mandatoryScenarioId,
          mandatory: true,
          testPath: 'sim-04.spec.ts',
        },
      ],
    });
    return { defect: store.get(defect.defectId)!, store, registry };
  }

  it('DefectRecordSchema validates a registered defect', () => {
    const { defect } = makeDefect();
    expect(() => DefectRecordSchema.parse(defect)).not.toThrow();
  });

  it('promotion requires a different reviewer (separation of duties)', () => {
    const { defect } = makeDefect({ mandatoryScenarioId: 's1' });
    const engine = new PromotionEngine();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'VERIFIED',
        reviewer: defect.owner.ownerId, // self
        justification: 'looks good',
        executedScenarioIds: ['s1'],
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
  });

  it('promotion requires the mandatory linked scenario to have run', () => {
    const { defect } = makeDefect({ mandatoryScenarioId: 'sim-04-s2' });
    const engine = new PromotionEngine();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'FIXED',
        reviewer: 'independent-reviewer',
        justification: 'patch merged',
        executedScenarioIds: [], // none
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
  });
});

describe('Phase 3 — Deliverable 4: Automatic Failure-to-Regression Workflow', () => {
  it('deduplicates repeated failures on the same scenario/test path', () => {
    const registry = new DefectRegistry(new InMemoryDefectStore(), {
      now: () => new Date(),
    });
    const workflow = new FailureToRegressionWorkflow(registry, {
      owner: {
        ownerId: 'platform',
        ownerRole: 'Platform/QA',
        confirmedAt: '2026-08-02T00:00:00.000Z',
      },
      actor: 'harness',
    });
    const req = (runId: string): FailureLinkRequest => ({
      runId,
      scenarioId: 'sim-04-s2',
      capabilityIds: ['cap-1'],
      severity: 'HIGH' as const,
      observedOutcome: 'FAILED' as const,
      errorMessage: 'Submit blocked',
      actorId: 'runner',
      tenantId: 'tnt-1',
      expectedBehavior: 'Submit creates customer',
      assertions: ['201 returned'],
      suiteId: 'sim-04',
      testPath: 'sim-04.spec.ts',
      auth: {
        actorId: 'runner',
        actorType: 'SYSTEM' as const,
        actorRoles: ['SYSTEM'],
        tenantId: '11111111-1111-1111-1111-111111111111',
        correlationId: 'corr-runner',
        permissions: ['evidence:read'],
      },
    });
    const a = workflow.linkFailure(req('run-1'));
    const b = workflow.linkFailure(req('run-2'));
    expect(b.created).toBe(false);
    expect(b.defectId).toBe(a.defectId);
  });

  it('IngestedFailureSchema rejects an incomplete payload', () => {
    expect(() =>
      IngestedFailureSchema.parse({
        runId: 'r',
        scenarioId: 's',
        // missing many fields
      }),
    ).toThrow();
  });
});

describe('Phase 3 — Deliverable 5: Test Quarantine with Owner/Reason/Expiry', () => {
  function makeQuarantine(expiresAt: string, linkedDefectId?: string) {
    const policy = QuarantinePolicySchema.parse({ maxLifetimeDays: 30 });
    const clock = { now: () => new Date('2026-07-15T00:00:00.000Z') };
    const engine = new QuarantineEngine(
      new InMemoryQuarantineStore(),
      clock,
      policy,
    );
    const record = engine.register(
      {
        scenarioId: 'sim-04-s3',
        reason: 'FLAKY',
        description: 'Customer form occasionally fails under load',
        ownerId: 'qa',
        ownerRole: 'QA',
        createdBy: 'runner',
        expiresAt,
        linkedDefectId,
      },
      policy,
    );
    return { engine, record, policy };
  }

  it('quarantine without expiry (past) is rejected', () => {
    const clock = { now: () => new Date('2026-08-02T00:00:00.000Z') };
    const policy = QuarantinePolicySchema.parse({ maxLifetimeDays: 30 });
    const engine = new QuarantineEngine(
      new InMemoryQuarantineStore(),
      clock,
      policy,
    );
    expect(() =>
      engine.register(
        {
          scenarioId: 'sim-04-s4',
          reason: 'FLAKY',
          description: 'x',
          ownerId: 'qa',
          ownerRole: 'QA',
          createdBy: 'qa',
          expiresAt: '2026-08-02T00:00:00.000Z',
        },
        policy,
      ),
    ).toThrow(/future/);
  });

  it('expired quarantine without linked defect surfaces a recommendation', () => {
    const { engine } = makeQuarantine('2026-07-20T00:00:00.000Z'); // past relative to clock
    const expired = engine.sweepExpired('2026-08-10T00:00:00.000Z');
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe('EXPIRED');
  });

  it('expired quarantine with linked defect can be promoted', () => {
    const defectId = '11111111-1111-1111-1111-111111111111';
    const { engine, record } = makeQuarantine(
      '2026-07-20T00:00:00.000Z',
      defectId,
    );
    // Promote while ACTIVE, then sweep to mark the quarantined record expired.
    const promoted = engine.promote(record.quarantineId, defectId, 'qa');
    expect(promoted.status).toBe('PROMOTED');
    const expired = engine.sweepExpired('2026-08-10T00:00:00.000Z');
    // Already-promoted entries are no longer ACTIVE and won't be touched.
    expect(
      expired.find((r) => r.quarantineId === record.quarantineId),
    ).toBeUndefined();
  });

  it('flaky outcomes on a quarantined scenario are suppressed, not passed', () => {
    const { engine } = makeQuarantine('2026-08-10T00:00:00.000Z');
    const resolution = engine.resolveOutcome('sim-04-s3', 'FLAKY');
    expect(resolution.resolvedOutcome).toBe('QUARANTINED');
  });

  it('flaky outcomes on an untracked scenario are flagged POLICY_VIOLATION (§11)', () => {
    const { engine } = makeQuarantine('2026-08-10T00:00:00.000Z');
    const resolution = engine.resolveOutcome('sim-04-untracked', 'FLAKY');
    expect(resolution.resolvedOutcome).toBe('POLICY_VIOLATION');
  });
});

describe('Phase 3 — Deliverable 6: Data Contracts and Drift Checks', () => {
  const baseContract = DataContractSchema.parse({
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
    checksum: Sha256ChecksumSchema.parse('sha256:' + 'a'.repeat(64)),
  });

  it('validates rows against a contract', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract);
    const v = new SchemaReferentialValidator(store, { now: () => new Date() });
    const pass = v.validate('customer', [
      { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com' },
    ]);
    expect(pass.passed).toBe(true);
    const fail = v.validate('customer', [{ email: 'not-email' }]);
    expect(fail.passed).toBe(false);
  });

  it('detects drift between current and baseline distributions', () => {
    const d = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const report = d.detect(
      'customer',
      { rowCount: 100, freshnessSeconds: 60, numericFields: { amount: 1000 } },
      { rowCount: 100, freshnessSeconds: 60, numericFields: { amount: 1000 } },
    );
    expect(report.signals).toHaveLength(0);
    const drifted = d.detect(
      'customer',
      { rowCount: 200, freshnessSeconds: 60, numericFields: { amount: 1000 } },
      { rowCount: 100, freshnessSeconds: 60, numericFields: { amount: 1000 } },
    );
    expect(drifted.signals.some((s) => s.kind === 'VOLUME_DRIFT')).toBe(true);
  });

  it('LineageBuilder maps downstream impact', () => {
    const l = new LineageBuilder();
    l.addNode({ nodeId: 'src', kind: 'SOURCE', contractId: 'customer' });
    l.addNode({
      nodeId: 'report',
      kind: 'CONSUMER',
      contractId: 'customer-report',
    });
    l.addEdge({ from: 'src', to: 'report' });
    const impact = l.impactOf('src');
    expect(impact.map((n) => n.contractId)).toContain('customer-report');
  });

  it('DataQualityGate returns FAIL on validation error or CRITICAL drift', () => {
    const store = new InMemoryDataContractStore();
    store.upsert(baseContract);
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const gate = new DataQualityGate(validator, drift, undefined, {
      now: () => new Date(),
    });
    const v = gate.evaluate({
      contractId: 'customer',
      rows: [{}],
      current: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 100, freshnessSeconds: 60, numericFields: {} },
    });
    expect(v.verdict).toBe('FAIL');
  });
});

describe('Phase 3 — Gate: Mandatory PR Lane on Changed Critical Surfaces', () => {
  const selector = new LaneSelector();
  const gate = new CriticalSurfaceGate();

  it('critical source change forces PR_FAST and MAINLINE blocking', () => {
    const surf = ChangedSurfaceSchema.parse({
      prId: 'pr-gate',
      baseSha: 'b',
      headSha: 'h',
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
    const selection = selector.select({ prId: 'pr-gate', surface: surf });
    expect(selection.mandatoryCriticalLaneForced).toBe(true);
    const verdict = gate.evaluate({
      prId: 'pr-gate',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(verdict.passed).toBe(true);
  });

  it('critical source change with FAILED run blocks the lane', () => {
    const surf = ChangedSurfaceSchema.parse({
      prId: 'pr-gate-fail',
      baseSha: 'b',
      headSha: 'h',
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
    const selection = selector.select({ prId: 'pr-gate-fail', surface: surf });
    const verdict = gate.evaluate({
      prId: 'pr-gate-fail',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'FAILED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(verdict.passed).toBe(false);
  });

  it('PR_LANE_VERSION is exported and DEFAULT_LANE_POLICIES covers §11 lanes', () => {
    expect(PR_LANE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(DEFAULT_LANE_POLICIES).toHaveLength(8);
  });
});

describe('Phase 3 — End-to-End: regression coordinator closes the loop', () => {
  it('runs onFailure → sweep → recordReplay → evaluatePR without manual wiring', () => {
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
      checksum: Sha256ChecksumSchema.parse('sha256:' + 'a'.repeat(64)),
    });
    const validator = new SchemaReferentialValidator(store, {
      now: () => new Date(),
    });
    const drift = new SchemaDriftDetector(
      () => '00000000-0000-0000-0000-000000000000',
    );
    const dataQuality = new DataQualityGate(validator, drift);
    const coord = new RegressionCoordinator({ dataQuality });

    // 1. Failure → defect
    const failure = coord.onFailure({
      runId: 'r1',
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
    expect(failure.created).toBe(true);

    // 2. Replay reproduces the failure
    const replay = coord.recordReplay(
      failure.defectId,
      'sim-04-s2',
      'bundle-1',
      'REPRODUCED',
    );
    expect(replay.isReplayable).toBe(true);

    // 3. Sweep does nothing yet
    const report = coord.sweep('2026-08-02T00:00:00.000Z');
    SweepReportSchema.parse(report);
    expect(report.expiredQuarantines).toHaveLength(0);

    // 4. PR gate fires on critical change
    const surf = ChangedSurfaceSchema.parse({
      prId: 'pr-final',
      baseSha: 'b',
      headSha: 'h',
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
    const pr = coord.evaluatePR({
      prId: 'pr-final',
      surface: surf,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(pr.gate.passed).toBe(true);

    // 5. Data quality passes
    const dq = coord.evaluateDataQuality({
      contractId: 'customer',
      rows: [{ id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com' }],
      current: { rowCount: 1, freshnessSeconds: 60, numericFields: {} },
      baseline: { rowCount: 1, freshnessSeconds: 60, numericFields: {} },
    });
    expect(dq.verdict).toBe('PASS');

    // 6. Flake classification with insufficient evidence does not silently pass
    expect(classifyFlakiness([])).toBe('INSUFFICIENT_EVIDENCE');

    // 7. TeardownReportSchema validates a cleanup report
    expect(() =>
      TeardownReportSchema.parse({
        tenantId: 'tnt-1',
        removed: 1,
        orphaned: [],
        failures: [],
        durationMs: 1,
        success: true,
      }),
    ).not.toThrow();

    // 8. Module versions are stable
    expect(REGRESSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
