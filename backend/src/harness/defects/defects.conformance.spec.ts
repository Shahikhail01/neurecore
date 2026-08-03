/**
 * Phase 3 — Defects Module Conformance
 *
 * Validates:
 *   - Defect registration, annotations, links (append-only)
 *   - Immutable expected behavior (corrections create new versions)
 *   - Promotion policy enforces mandatory links + reviewer independence
 *   - Automatic failure-to-regression workflow deduplicates by scenario
 *   - ReplayReproducibilityTracker counts reproductions correctly
 */

import {
  DefectRegistry,
  InMemoryDefectStore,
  PromotionEngine,
  FailureToRegressionWorkflow,
  ReplayReproducibilityTracker,
  DEFECTS_VERSION,
  type RegisterDefectInput,
  type FailureLinkRequest,
  type DefectRecord,
} from './index';

const baseInput: RegisterDefectInput = {
  title: 'Customer form submit blocked',
  description:
    'Modal backdrop intercepts pointer events on the Create Customer button.',
  severity: 'HIGH',
  owner: {
    ownerId: 'qa-owner',
    ownerRole: 'QA Automation',
    confirmedAt: '2026-08-02T00:00:00.000Z',
  },
  capabilityIds: ['cap-1'],
  initialExpectedBehavior: 'Submitting the form creates a customer record.',
  initialAssertions: [
    'POST /customers returns 201',
    'Customer row is visible on the page after submit',
  ],
  createdBy: 'test-runner',
  initialLinks: [
    {
      scenarioId: 'sim-04-s2',
      suiteId: 'sim-04',
      mandatory: true,
      testPath: 'sim-04.spec.ts',
    },
  ],
};

function makeRegistry() {
  const store = new InMemoryDefectStore();
  const clock = { now: () => new Date('2026-08-02T12:00:00.000Z') };
  return { store, registry: new DefectRegistry(store, clock) };
}

describe('harness/defects — Registry', () => {
  it('registers a defect with an initial expected behavior', () => {
    const { registry } = makeRegistry();
    const defect = registry.register(baseInput);
    expect(defect.status).toBe('OPEN');
    expect(defect.expectedBehaviors).toHaveLength(1);
    expect(defect.expectedBehaviors[0].version).toBe('1.0.0');
    expect(defect.schemaVersion).toBe(DEFECTS_VERSION);
    expect(defect.links).toHaveLength(1);
  });

  it('adds a link with a timestamp', () => {
    const { registry } = makeRegistry();
    const defect = registry.register(baseInput);
    const updated = registry.addLink(
      defect.defectId,
      { scenarioId: 'sim-04-s3', mandatory: true },
      'test-runner',
    );
    expect(updated.links).toHaveLength(2);
    expect(updated.links[1].scenarioId).toBe('sim-04-s3');
    expect(updated.links[1].addedBy).toBe('test-runner');
  });

  it('appends annotations without mutating previous ones', () => {
    const { registry, store } = makeRegistry();
    const defect = registry.register(baseInput);
    registry.addAnnotation(defect.defectId, {
      author: 'qa-owner',
      kind: 'NOTE',
      message: 'Reproduced twice on staging',
    });
    const stored = store.get(defect.defectId);
    expect(stored!.annotations).toHaveLength(1);
    registry.addAnnotation(defect.defectId, {
      author: 'qa-owner',
      kind: 'NOTE',
      message: 'Backdrop z-index still too low',
    });
    const final = store.get(defect.defectId);
    expect(final!.annotations).toHaveLength(2);
    expect(final!.annotations[0].message).toBe('Reproduced twice on staging');
    expect(final!.annotations[1].message).toBe(
      'Backdrop z-index still too low',
    );
  });

  it('appends a new expected behavior with supersedes chain', () => {
    const { registry } = makeRegistry();
    const defect = registry.register(baseInput);
    const next = registry.addExpectedBehavior(
      defect.defectId,
      {
        version: '1.1.0',
        description: 'Submitting the form creates a customer within 5 seconds.',
        assertions: [
          'POST /customers returns 201',
          'Customer row appears in the table within 5s',
        ],
      },
      'qa-owner',
    );
    expect(next.expectedBehaviors).toHaveLength(2);
    expect(next.expectedBehaviors[1].version).toBe('1.1.0');
    expect(next.expectedBehaviors[1].supersedes).toBe(
      defect.expectedBehaviors[0].behaviorId,
    );
    // Original is untouched
    expect(next.expectedBehaviors[0].description).toBe(
      'Submitting the form creates a customer record.',
    );
  });

  it('records status transitions and sets closedAt on CLOSED', () => {
    const { registry } = makeRegistry();
    const defect = registry.register(baseInput);
    const inProgress = registry.transition(
      defect.defectId,
      'REPRODUCED',
      'qa-owner',
      'reproduced',
    );
    expect(inProgress.status).toBe('REPRODUCED');
    expect(inProgress.annotations[inProgress.annotations.length - 1].kind).toBe(
      'STATUS_CHANGE',
    );
    const closed = registry.transition(
      defect.defectId,
      'CLOSED',
      'qa-owner',
      'fix shipped',
    );
    expect(closed.closedAt).toBe('2026-08-02T12:00:00.000Z');
  });

  it('throws when transitioning to the same status', () => {
    const { registry } = makeRegistry();
    const defect = registry.register(baseInput);
    expect(() =>
      registry.transition(defect.defectId, 'OPEN', 'qa-owner', 'noop'),
    ).toThrow(/already in status/);
  });

  it('lists defects by status and severity', () => {
    const { registry } = makeRegistry();
    registry.register({ ...baseInput, severity: 'CRITICAL' });
    const other = registry.register({ ...baseInput, severity: 'LOW' });
    registry.transition(other.defectId, 'REPRODUCED', 'qa-owner', 'repro');
    expect(registry.list({ status: 'OPEN' })).toHaveLength(1);
    expect(registry.list({ severity: 'CRITICAL' })).toHaveLength(1);
  });
});

describe('harness/defects — Promotion Engine', () => {
  function getDefect(): DefectRecord {
    const { registry } = makeRegistry();
    const d = registry.register(baseInput);
    registry.addLink(
      d.defectId,
      { scenarioId: 'sim-04-s3', mandatory: true },
      'test-runner',
    );
    // The promotion tests below request from: 'REPRODUCED', so move
    // the defect into that state first.
    const updated = registry.transition(
      d.defectId,
      'REPRODUCED',
      'test-runner',
      'reproduced in CI',
    );
    return updated;
  }

  it('rejects self-approval (§15)', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'VERIFIED',
        reviewer: defect.owner.ownerId, // self
        justification: 'looks good',
        executedScenarioIds: ['sim-04-s2', 'sim-04-s3'],
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((r) => r.includes('self-approval'))).toBe(
      true,
    );
  });

  it('rejects creator-as-reviewer on VERIFIED', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'VERIFIED',
        reviewer: defect.createdBy, // creator
        justification: 'tried it',
        executedScenarioIds: ['sim-04-s2', 'sim-04-s3'],
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
  });

  it('requires mandatory linked scenarios to have been executed for FIXED', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
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
    expect(
      decision.reasons.some((r) =>
        r.includes('mandatory linked scenarios not executed'),
      ),
    ).toBe(true);
  });

  it('requires evidence refs for VERIFIED', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'VERIFIED',
        reviewer: 'independent-reviewer',
        justification: 'looks good',
        executedScenarioIds: ['sim-04-s2', 'sim-04-s3'],
        evidenceRefs: [], // none
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
  });

  it('allows VERIFIED when all conditions are met', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'REPRODUCED',
        to: 'VERIFIED',
        reviewer: 'independent-reviewer',
        justification: 'reviewed against the bug',
        executedScenarioIds: ['sim-04-s2', 'sim-04-s3'],
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    if (!decision.allowed) {
      throw new Error(
        'reasons: ' +
          JSON.stringify(decision.reasons) +
          ' status: ' +
          defect.status,
      );
    }
    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toHaveLength(0);
  });

  it('rejects promotion from the wrong starting status', () => {
    const engine = new PromotionEngine();
    const defect = getDefect();
    const decision = engine.evaluate(
      {
        defectId: defect.defectId,
        from: 'CLOSED',
        to: 'FIXED',
        reviewer: 'independent-reviewer',
        justification: 'wrong from',
        executedScenarioIds: ['sim-04-s2'],
        evidenceRefs: ['ev-1'],
      },
      defect,
    );
    expect(decision.allowed).toBe(false);
  });
});

describe('harness/defects — FailureToRegressionWorkflow', () => {
  function setup() {
    const { registry, store } = makeRegistry();
    const workflow = new FailureToRegressionWorkflow(registry, {
      owner: {
        ownerId: 'platform-owner',
        ownerRole: 'Platform/QA',
        confirmedAt: '2026-08-02T00:00:00.000Z',
      },
      actor: 'harness-coordinator',
    });
    return { registry, store, workflow };
  }

  const baseReq: FailureLinkRequest = {
    runId: 'run-1',
    scenarioId: 'sim-04-s2',
    capabilityIds: ['cap-1'],
    severity: 'HIGH',
    observedOutcome: 'FAILED',
    errorMessage: 'Submit button unreachable',
    actorId: 'runner',
    tenantId: 'tnt-1',
    expectedBehavior: 'Submit creates customer',
    assertions: ['201 returned', 'row appears'],
    suiteId: 'sim-04',
    testPath: 'sim-04.spec.ts',
    auth: {
      actorId: 'runner',
      actorType: 'SYSTEM',
      actorRoles: ['SYSTEM'],
      tenantId: '11111111-1111-1111-1111-111111111111',
      correlationId: 'corr-runner',
      permissions: ['evidence:read'],
    },
  };

  it('creates a new defect on first failure', () => {
    const { workflow, store } = setup();
    const result = workflow.linkFailure(baseReq);
    expect(result.created).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it('annotates an existing open defect when scenario matches', () => {
    const { workflow, store } = setup();
    const first = workflow.linkFailure(baseReq);
    const second = workflow.linkFailure({ ...baseReq, runId: 'run-2' });
    expect(second.defectId).toBe(first.defectId);
    expect(second.created).toBe(false);
    expect(store.list()).toHaveLength(1);
    const updated = store.get(first.defectId)!;
    expect(
      updated.annotations.some(
        (a) => a.kind === 'NOTE' && a.message.includes('run-2'),
      ),
    ).toBe(true);
  });
});

describe('harness/defects — Replay Reproducibility (§10 Phase 3 exit)', () => {
  const DEFECT = '11111111-1111-1111-1111-111111111111';

  it('marks a defect as replayable after a single REPRODUCED outcome', () => {
    const tracker = new ReplayReproducibilityTracker();
    const rec = tracker.record(
      DEFECT,
      'sim-04-s2',
      'bundle-1',
      'REPRODUCED',
      '2026-08-02T00:00:00.000Z',
    );
    expect(rec.isReplayable).toBe(true);
    expect(tracker.isCriticalDefectReplayable(DEFECT, 'sim-04-s2')).toBe(true);
  });

  it('marks a defect as not-replayable after too many NOT_REPRODUCED outcomes', () => {
    const tracker = new ReplayReproducibilityTracker({
      maxConsecutiveFailures: 2,
    });
    tracker.record(
      DEFECT,
      'sim-04-s2',
      'b1',
      'NOT_REPRODUCED',
      '2026-08-02T00:00:00.000Z',
    );
    tracker.record(
      DEFECT,
      'sim-04-s2',
      'b2',
      'NOT_REPRODUCED',
      '2026-08-02T00:01:00.000Z',
    );
    expect(tracker.isCriticalDefectReplayable(DEFECT, 'sim-04-s2')).toBe(false);
  });

  it('resets consecutive failures after a successful reproduction', () => {
    const tracker = new ReplayReproducibilityTracker({
      maxConsecutiveFailures: 2,
    });
    tracker.record(
      DEFECT,
      's',
      'b1',
      'NOT_REPRODUCED',
      '2026-08-02T00:00:00.000Z',
    );
    tracker.record(DEFECT, 's', 'b2', 'REPRODUCED', '2026-08-02T00:01:00.000Z');
    tracker.record(
      DEFECT,
      's',
      'b3',
      'NOT_REPRODUCED',
      '2026-08-02T00:02:00.000Z',
    );
    expect(tracker.get(DEFECT, 's')!.consecutiveFailures).toBe(1);
  });
});
