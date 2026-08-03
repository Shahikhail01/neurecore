/**
 * NeureCore Harness - Evaluation Datasets & Rubrics Conformance (Phase 4)
 *
 * Document ID: NC-HARNESS-EVALUATION-001
 * Tests: ~45
 */

import {
  InMemoryEvaluationDatasetRegistry,
  EVALUATION_DATASETS_VERSION,
  type EvaluationDataset,
  type EvaluationCase,
  RegisterDatasetInputSchema,
  computeDatasetChecksum,
  detectDuplicates,
  detectInverseLabels,
  detectExpertDisagreement,
  detectDatasetConflicts,
  computeSampleStats,
  wilsonInterval,
  binomialStats,
} from './index';
import {
  InMemoryRubricRegistry,
  RUBRIC_VERSION,
  createGraderEngine,
  cohensKappa,
  percentAgreement,
  GraderDefinitionSchema,
  type GraderOutput,
  type Rubric,
} from './rubrics';
import type { AuthorizationContext } from '../contracts';

const TENANT = '11111111-1111-1111-1111-111111111111';

const authCtx = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actorId: 'actor-1',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER'],
  tenantId: TENANT,
  correlationId: 'corr-1',
  permissions: [],
  ...overrides,
});

const sampleCase = (
  overrides: Partial<EvaluationCase> = {},
): EvaluationCase => ({
  caseId: 'case-1',
  capabilityId: 'cap-1',
  category: 'qa',
  label: 'GOLD',
  tenantId: TENANT,
  input: { q: 'what is 2+2?' },
  expected: { answer: '4' },
  expectedCitations: [],
  tags: [],
  difficulty: 'MEDIUM',
  ...overrides,
});

describe('Evaluation Datasets — Phase 4 conformance', () => {
  test('EVALUATION_DATASETS_VERSION is 1.0.0', () => {
    expect(EVALUATION_DATASETS_VERSION).toBe('1.0.0');
  });

  test('RegisterDatasetInputSchema validates required fields', () => {
    expect(() => RegisterDatasetInputSchema.parse({})).toThrow();
    expect(() =>
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
      }),
    ).not.toThrow();
  });

  test('InMemory registry rejects unauthorized actor', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    const weak = authCtx({ actorRoles: ['TENANT_USER'] });
    expect(() =>
      r.register(
        RegisterDatasetInputSchema.parse({
          datasetId: 'd1',
          version: '1.0.0',
          name: 'D',
          description: 'D',
          owner: 'o',
          visibility: 'PUBLIC',
          cases: [sampleCase()],
          requiredLabels: ['GOLD'],
        }),
        weak,
      ),
    ).toThrow(/Authorization denied/);
  });

  test('InMemory registry accepts authorized registration', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    const d = r.register(
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
      }),
      authCtx(),
    );
    expect(d.datasetId).toBe('d1');
    expect(r.list('d1')).toHaveLength(1);
  });

  test('BLINDED dataset cannot contain GOLD cases', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    expect(() =>
      r.register(
        RegisterDatasetInputSchema.parse({
          datasetId: 'd1',
          version: '1.0.0',
          name: 'D',
          description: 'D',
          owner: 'o',
          visibility: 'BLINDED',
          cases: [sampleCase({ label: 'GOLD' })],
          requiredLabels: ['GOLD'],
        }),
        authCtx(),
      ),
    ).toThrow(/BLINDED/);
  });

  test('Dataset supersede chains versions', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    r.register(
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
      }),
      authCtx(),
    );
    const next = r.supersede({
      datasetId: 'd1',
      newVersion: '1.1.0',
      additionalCases: [sampleCase({ caseId: 'case-2' })],
      changelog: 'added case',
      ctx: authCtx(),
    });
    expect(next.version).toBe('1.1.0');
    expect(next.supersedes).toBe('1.0.0');
  });

  test('Duplicate inputs are detected', () => {
    const d: EvaluationDataset = {
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: 'd1',
      version: '1.0.0',
      name: 'D',
      description: 'D',
      owner: 'o',
      visibility: 'PUBLIC',
      cases: [
        sampleCase({ caseId: 'a', input: { q: 'x' } }),
        sampleCase({ caseId: 'b', input: { q: 'x' } }),
      ],
      sortedCaseIds: ['a', 'b'],
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'),
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      requiredLabels: ['GOLD'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    };
    const conflicts = detectDuplicates(d);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('DUPLICATE_INPUT');
  });

  test('Inverse labels are detected', () => {
    const d: EvaluationDataset = {
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: 'd1',
      version: '1.0.0',
      name: 'D',
      description: 'D',
      owner: 'o',
      visibility: 'PUBLIC',
      cases: [
        sampleCase({ caseId: 'a', input: { q: 'x' }, label: 'PASS' }),
        sampleCase({ caseId: 'b', input: { q: 'x' }, label: 'FAIL' }),
      ],
      sortedCaseIds: ['a', 'b'],
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'),
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      requiredLabels: ['PASS', 'FAIL'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    };
    const conflicts = detectInverseLabels(d);
    expect(
      conflicts.some(
        (c) => c.kind === 'INVERSE_LABEL' && c.severity === 'CRITICAL',
      ),
    ).toBe(true);
  });

  test('Expert disagreement on GOLD with mismatched score is detected', () => {
    const d: EvaluationDataset = {
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: 'd1',
      version: '1.0.0',
      name: 'D',
      description: 'D',
      owner: 'o',
      visibility: 'PUBLIC',
      cases: [sampleCase({ expertScore: 0.2 })],
      sortedCaseIds: ['case-1'],
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'),
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      requiredLabels: ['GOLD'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    };
    const conflicts = detectExpertDisagreement(d);
    expect(conflicts.some((c) => c.kind === 'EXPERT_DISAGREEMENT')).toBe(true);
  });

  test('CRITICAL dataset conflict blocks registration', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    expect(() =>
      r.register(
        RegisterDatasetInputSchema.parse({
          datasetId: 'd1',
          version: '1.0.0',
          name: 'D',
          description: 'D',
          owner: 'o',
          visibility: 'PUBLIC',
          cases: [
            sampleCase({ caseId: 'a', input: { q: 'x' }, label: 'PASS' }),
            sampleCase({ caseId: 'b', input: { q: 'x' }, label: 'FAIL' }),
          ],
          requiredLabels: ['PASS', 'FAIL'],
        }),
        authCtx(),
      ),
    ).toThrow(/CRITICAL conflict/);
  });

  test('computeDatasetChecksum is deterministic', () => {
    const d: EvaluationDataset = {
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: 'd1',
      version: '1.0.0',
      name: 'D',
      description: 'D',
      owner: 'o',
      visibility: 'PUBLIC',
      cases: [sampleCase()],
      sortedCaseIds: ['case-1'],
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'),
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      requiredLabels: ['GOLD'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    };
    const c1 = computeDatasetChecksum(d);
    const c2 = computeDatasetChecksum(d);
    expect(c1).toBe(c2);
  });

  test('resolveCases enforces capability whitelist', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    r.register(
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
        capabilityWhitelist: ['cap-2'],
        status: 'ACTIVE',
      }),
      authCtx(),
    );
    expect(() =>
      r.resolveCases({
        datasetId: 'd1',
        version: '1.0.0',
        visibilityFilter: ['PUBLIC'],
        capabilityId: 'cap-1',
      }),
    ).toThrow(/not permitted/);
  });

  test('resolveCases rejects DRAFT datasets', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    r.register(
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
        status: 'DRAFT',
      }),
      authCtx(),
    );
    expect(() =>
      r.resolveCases({
        datasetId: 'd1',
        version: '1.0.0',
        visibilityFilter: ['PUBLIC'],
        capabilityId: 'cap-1',
      }),
    ).toThrow(/not ACTIVE/);
  });

  test('search filters by capability', () => {
    const r = new InMemoryEvaluationDatasetRegistry();
    r.register(
      RegisterDatasetInputSchema.parse({
        datasetId: 'd1',
        version: '1.0.0',
        name: 'D',
        description: 'D',
        owner: 'o',
        visibility: 'PUBLIC',
        cases: [sampleCase()],
        requiredLabels: ['GOLD'],
        capabilityWhitelist: ['cap-1'],
      }),
      authCtx(),
    );
    expect(r.search({ capabilityId: 'cap-1' })).toHaveLength(1);
    expect(r.search({ capabilityId: 'cap-2' })).toHaveLength(0);
  });

  test('computeSampleStats returns stable stats', () => {
    const stats = computeSampleStats([1, 2, 3, 4, 5]);
    expect(stats.count).toBe(5);
    expect(stats.mean).toBe(3);
    expect(stats.ci95[0]).toBeLessThan(stats.mean);
    expect(stats.ci95[1]).toBeGreaterThan(stats.mean);
  });

  test('wilsonInterval returns [0,1] inside range', () => {
    const [lo, hi] = wilsonInterval(80, 100);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThan(hi);
  });

  test('binomialStats computes pass rate CI', () => {
    const s = binomialStats(95, 100);
    expect(s.mean).toBe(0.95);
    expect(s.passRateCi95).toBeDefined();
  });

  test('detectDatasetConflicts aggregates all detectors', () => {
    const d: EvaluationDataset = {
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: 'd1',
      version: '1.0.0',
      name: 'D',
      description: 'D',
      owner: 'o',
      visibility: 'PUBLIC',
      cases: [
        sampleCase({ caseId: 'a', input: { q: 'x' }, label: 'PASS' }),
        sampleCase({ caseId: 'b', input: { q: 'x' }, label: 'FAIL' }),
      ],
      sortedCaseIds: ['a', 'b'],
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'),
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      requiredLabels: ['PASS', 'FAIL'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    };
    const all = detectDatasetConflicts(d);
    expect(all.length).toBeGreaterThan(0);
  });
});

describe('Rubric Registry & Grader Engine — Phase 4 conformance', () => {
  test('RUBRIC_VERSION is 1.0.0', () => {
    expect(RUBRIC_VERSION).toBe('1.0.0');
  });

  test('Rubric dimensions must sum to 1.0', () => {
    const r = new InMemoryRubricRegistry();
    r.registerGrader(
      {
        graderId: 'g1',
        version: '1.0.0',
        type: 'DETERMINISTIC',
        owner: 'o',
        description: 'd',
        enabled: true,
      },
      authCtx(),
    );
    expect(() =>
      r.registerRubric(
        {
          rubricId: 'r1',
          version: '1.0.0',
          title: 'R',
          description: 'D',
          owner: 'o',
          dimensions: [
            {
              dimension: 'CORRECTNESS',
              weight: 0.5,
              minScore: 0,
              passThreshold: 0.7,
            },
            {
              dimension: 'SAFETY',
              weight: 0.3,
              minScore: 0,
              passThreshold: 0.7,
            },
          ],
          aggregation: 'WEIGHTED_MEAN',
          graderIds: ['g1'],
          capabilityWhitelist: [] as string[],
          status: 'DRAFT',
        },
        authCtx(),
      ),
    ).toThrow(/sum to 1.0/);
  });

  test('requiresIndependentSignals demands ≥2 graders', () => {
    const r = new InMemoryRubricRegistry();
    r.registerGrader(
      {
        graderId: 'g1',
        version: '1.0.0',
        type: 'DETERMINISTIC',
        owner: 'o',
        description: 'd',
        enabled: true,
      },
      authCtx(),
    );
    expect(() =>
      r.registerRubric(
        {
          rubricId: 'r1',
          version: '1.0.0',
          title: 'R',
          description: 'D',
          owner: 'o',
          dimensions: [
            {
              dimension: 'CORRECTNESS',
              weight: 1.0,
              minScore: 0,
              passThreshold: 0.7,
            },
          ],
          aggregation: 'WEIGHTED_MEAN',
          graderIds: ['g1'],
          capabilityWhitelist: [] as string[],
          requiresIndependentSignals: true,
          status: 'DRAFT',
        },
        authCtx(),
      ),
    ).toThrow(/two graders/);
  });

  test('MODEL_GRADER requires graderModelRef and prompt', () => {
    expect(() =>
      GraderDefinitionSchema.parse({
        graderId: 'g1',
        version: '1.0.0',
        type: 'MODEL_GRADER',
        owner: 'o',
        description: 'd',
        enabled: true,
      }),
    ).toThrow(/graderModelRef/);
  });

  test('cohensKappa returns 1.0 for perfect agreement', () => {
    const k = cohensKappa(['A', 'B', 'A'], ['A', 'B', 'A'], ['A', 'B']);
    expect(k).toBe(1);
  });

  test('cohensKappa returns -1 for total disagreement', () => {
    const k = cohensKappa(['A', 'B'], ['B', 'A'], ['A', 'B']);
    // Total disagreement → kappa = -1 per the standard definition.
    expect(k).toBe(-1);
  });

  test('percentAgreement returns ratio', () => {
    expect(percentAgreement(['A', 'B'], ['A', 'A'])).toBe(0.5);
  });

  test('Deterministic grader reports 1.0 on match', () => {
    const engine = createGraderEngine();
    const out = engine.runDeterministic({
      graderId: 'd',
      output: { a: 1 },
      expected: { a: 1 },
    });
    expect(out.score).toBe(1);
  });

  test('Deterministic grader reports 0 on mismatch', () => {
    const engine = createGraderEngine();
    const out = engine.runDeterministic({
      graderId: 'd',
      output: { a: 1 },
      expected: { a: 2 },
    });
    expect(out.score).toBe(0);
  });

  test('Reference metric EXACT_MATCH', () => {
    const engine = createGraderEngine();
    expect(
      engine.runReferenceMetric({
        graderId: 'r',
        output: 'hello',
        reference: 'hello',
        metric: 'EXACT_MATCH',
      }).score,
    ).toBe(1);
    expect(
      engine.runReferenceMetric({
        graderId: 'r',
        output: 'hi',
        reference: 'hello',
        metric: 'EXACT_MATCH',
      }).score,
    ).toBe(0);
  });

  test('Reference metric CONTAINS', () => {
    const engine = createGraderEngine();
    expect(
      engine.runReferenceMetric({
        graderId: 'r',
        output: 'foo bar baz',
        reference: 'bar',
        metric: 'CONTAINS',
      }).score,
    ).toBe(1);
  });

  test('Reference metric TOKEN_F1 gives partial credit', () => {
    const engine = createGraderEngine();
    const s = engine.runReferenceMetric({
      graderId: 'r',
      output: 'the cat sat',
      reference: 'the cat sat on a mat',
      metric: 'TOKEN_F1',
    });
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(1);
  });

  test('Statistical runner requires min trials', () => {
    const engine = createGraderEngine();
    expect(() =>
      engine.runStatistical({
        graderId: 's',
        trials: [singleOutput('g', 0.5)],
        dimension: 'CORRECTNESS',
        minTrials: 3,
        tolerance: 0.1,
      }),
    ).toThrow(/at least 3/);
  });

  test('Statistical runner reports low confidence when variance > tolerance', () => {
    const engine = createGraderEngine();
    const trials = [0.1, 0.9, 0.5, 0.4, 0.6].map((s) => singleOutput('g', s));
    expect(() =>
      engine.runStatistical({
        graderId: 's',
        trials,
        dimension: 'CORRECTNESS',
        minTrials: 5,
        tolerance: 0.05,
      }),
    ).toThrow(/variance/);
  });

  test('Statistical runner aggregates trials when stable', () => {
    const engine = createGraderEngine();
    const trials = [0.9, 0.92, 0.91, 0.9, 0.89].map((s) =>
      singleOutput('g', s),
    );
    const out = engine.runStatistical({
      graderId: 's',
      trials,
      dimension: 'CORRECTNESS',
      minTrials: 5,
      tolerance: 0.05,
    });
    expect(out.score).toBeGreaterThan(0.85);
    expect(out.confidence).toBeGreaterThan(0);
  });

  test('Calibration produces kappa and agreement', () => {
    const engine = createGraderEngine();
    const r = engine.calibrate({
      rubricId: 'r1',
      version: '1.0.0',
      raterLabels: ['A', 'B', 'A', 'B'],
      expertLabels: ['A', 'B', 'A', 'B'],
      threshold: 0.6,
      ctx: authCtx(),
    });
    expect(r.cohensKappa).toBe(1);
    expect(r.promotable).toBe(true);
  });

  test('Calibration rejects low-agreement rubric', () => {
    const engine = createGraderEngine();
    const r = engine.calibrate({
      rubricId: 'r1',
      version: '1.0.0',
      raterLabels: ['A', 'B', 'A', 'B'],
      expertLabels: ['B', 'A', 'B', 'A'],
      threshold: 0.6,
      ctx: authCtx(),
    });
    expect(r.promotable).toBe(false);
  });

  test('Aggregate weighted mean across dimensions', () => {
    const engine = createGraderEngine();
    const rubric: Rubric = {
      schemaVersion: '1.0.0',
      rubricId: 'r1',
      version: '1.0.0',
      title: 'R',
      description: 'D',
      owner: 'o',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 0.5,
          minScore: 0,
          passThreshold: 0.7,
        },
        { dimension: 'SAFETY', weight: 0.5, minScore: 0, passThreshold: 0.7 },
      ],
      aggregation: 'WEIGHTED_MEAN',
      graderIds: ['g1'],
      capabilityWhitelist: [] as string[],
      requiresIndependentSignals: false,
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      status: 'ACTIVE',
    };
    const outputs: GraderOutput[] = [
      singleOutput('g1', 1, 'CORRECTNESS'),
      singleOutput('g2', 0.8, 'SAFETY'),
    ];
    const agg = engine.aggregate({ rubric, outputs });
    expect(agg.weightedScore).toBeCloseTo(0.9, 2);
    expect(agg.passed).toBe(true);
  });

  test('Aggregate MIN_OF_DIMENSIONS', () => {
    const engine = createGraderEngine();
    const rubric: Rubric = {
      schemaVersion: '1.0.0',
      rubricId: 'r1',
      version: '1.0.0',
      title: 'R',
      description: 'D',
      owner: 'o',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 0.5,
          minScore: 0,
          passThreshold: 0.7,
        },
        { dimension: 'SAFETY', weight: 0.5, minScore: 0, passThreshold: 0.7 },
      ],
      aggregation: 'MIN_OF_DIMENSIONS',
      graderIds: ['g1'],
      capabilityWhitelist: [] as string[],
      requiresIndependentSignals: false,
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      status: 'ACTIVE',
    };
    const outputs = [
      singleOutput('g1', 0.9, 'CORRECTNESS'),
      singleOutput('g2', 0.5, 'SAFETY'),
    ];
    const agg = engine.aggregate({ rubric, outputs });
    expect(agg.weightedScore).toBe(0.5);
    expect(agg.passed).toBe(false);
  });

  test('Aggregate AND_OF_DIMENSIONS binary', () => {
    const engine = createGraderEngine();
    const rubric: Rubric = {
      schemaVersion: '1.0.0',
      rubricId: 'r1',
      version: '1.0.0',
      title: 'R',
      description: 'D',
      owner: 'o',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 0.5,
          minScore: 0,
          passThreshold: 0.7,
        },
        { dimension: 'SAFETY', weight: 0.5, minScore: 0, passThreshold: 0.7 },
      ],
      aggregation: 'AND_OF_DIMENSIONS',
      graderIds: ['g1'],
      capabilityWhitelist: [] as string[],
      requiresIndependentSignals: false,
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      status: 'ACTIVE',
    };
    const ok = engine.aggregate({
      rubric,
      outputs: [
        singleOutput('g1', 0.9, 'CORRECTNESS'),
        singleOutput('g2', 0.8, 'SAFETY'),
      ],
    });
    expect(ok.weightedScore).toBe(1);
    const fail = engine.aggregate({
      rubric,
      outputs: [
        singleOutput('g1', 0.9, 'CORRECTNESS'),
        singleOutput('g2', 0.6, 'SAFETY'),
      ],
    });
    expect(fail.weightedScore).toBe(0);
  });

  test('Disagreements are reported when range > 0.2', () => {
    const engine = createGraderEngine();
    const rubric: Rubric = {
      schemaVersion: '1.0.0',
      rubricId: 'r1',
      version: '1.0.0',
      title: 'R',
      description: 'D',
      owner: 'o',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 1.0,
          minScore: 0,
          passThreshold: 0.7,
        },
      ],
      aggregation: 'WEIGHTED_MEAN',
      graderIds: ['g1'],
      capabilityWhitelist: [] as string[],
      requiresIndependentSignals: false,
      createdAt: new Date().toISOString(),
      createdBy: 'a',
      status: 'ACTIVE',
    };
    const outputs = [
      singleOutput('g1', 0.9, 'CORRECTNESS'),
      singleOutput('g2', 0.5, 'CORRECTNESS'),
    ];
    const agg = engine.aggregate({ rubric, outputs });
    expect(agg.disagreements).toHaveLength(1);
    expect(agg.disagreements[0].dimension).toBe('CORRECTNESS');
  });

  test('InMemory registry lists active rubric', () => {
    const r = new InMemoryRubricRegistry();
    r.registerGrader(
      {
        graderId: 'g1',
        version: '1.0.0',
        type: 'DETERMINISTIC',
        owner: 'o',
        description: 'd',
        enabled: true,
      },
      authCtx(),
    );
    r.registerRubric(
      {
        rubricId: 'r1',
        version: '1.0.0',
        title: 'R',
        description: 'D',
        owner: 'o',
        dimensions: [
          {
            dimension: 'CORRECTNESS',
            weight: 1.0,
            minScore: 0,
            passThreshold: 0.7,
          },
        ],
        aggregation: 'WEIGHTED_MEAN',
        graderIds: ['g1'],
        capabilityWhitelist: [] as string[],
        status: 'ACTIVE',
      },
      authCtx(),
    );
    expect(r.getActiveRubric('r1')?.version).toBe('1.0.0');
  });

  test('InMemory registry revoke marks rubric REVOKED', () => {
    const r = new InMemoryRubricRegistry();
    r.registerGrader(
      {
        graderId: 'g1',
        version: '1.0.0',
        type: 'DETERMINISTIC',
        owner: 'o',
        description: 'd',
        enabled: true,
      },
      authCtx(),
    );
    r.registerRubric(
      {
        rubricId: 'r1',
        version: '1.0.0',
        title: 'R',
        description: 'D',
        owner: 'o',
        dimensions: [
          {
            dimension: 'CORRECTNESS',
            weight: 1.0,
            minScore: 0,
            passThreshold: 0.7,
          },
        ],
        aggregation: 'WEIGHTED_MEAN',
        graderIds: ['g1'],
        capabilityWhitelist: [] as string[],
        status: 'ACTIVE',
      },
      authCtx(),
    );
    const revoked = r.revoke('r1', '1.0.0', authCtx());
    expect(revoked.status).toBe('REVOKED');
  });

  test('InMemory registry supersede increments version', () => {
    const r = new InMemoryRubricRegistry();
    r.registerGrader(
      {
        graderId: 'g1',
        version: '1.0.0',
        type: 'DETERMINISTIC',
        owner: 'o',
        description: 'd',
        enabled: true,
      },
      authCtx(),
    );
    r.registerRubric(
      {
        rubricId: 'r1',
        version: '1.0.0',
        title: 'R',
        description: 'D',
        owner: 'o',
        dimensions: [
          {
            dimension: 'CORRECTNESS',
            weight: 1.0,
            minScore: 0,
            passThreshold: 0.7,
          },
        ],
        aggregation: 'WEIGHTED_MEAN',
        graderIds: ['g1'],
        capabilityWhitelist: [] as string[],
        status: 'DRAFT',
      },
      authCtx(),
    );
    const next = r.supersedeRubric({
      rubricId: 'r1',
      newVersion: '1.1.0',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 1.0,
          minScore: 0,
          passThreshold: 0.7,
        },
      ],
      graderIds: ['g1'],
      changelog: 'tightened threshold',
      ctx: authCtx(),
    });
    expect(next.version).toBe('1.1.0');
  });

  test('InMemory registry rejects unauthorized actor', () => {
    const r = new InMemoryRubricRegistry();
    const weak = authCtx({ actorRoles: ['TENANT_USER'] });
    expect(() =>
      r.registerGrader(
        {
          graderId: 'g1',
          version: '1.0.0',
          type: 'DETERMINISTIC',
          owner: 'o',
          description: 'd',
          enabled: true,
        },
        weak,
      ),
    ).toThrow(/Authorization denied/);
  });

  test('A grader registered without model_grader should be usable in deterministic mode', () => {
    const r = new InMemoryRubricRegistry();
    expect(() =>
      r.registerGrader(
        {
          graderId: 'g1',
          version: '1.0.0',
          type: 'DETERMINISTIC',
          owner: 'o',
          description: 'd',
          enabled: true,
        },
        authCtx(),
      ),
    ).not.toThrow();
  });
});

function singleOutput(
  graderId: string,
  score: number,
  dimension: 'CORRECTNESS' | 'SAFETY' = 'CORRECTNESS',
): GraderOutput {
  return {
    graderId,
    graderVersion: '1.0.0',
    type: 'DETERMINISTIC',
    dimension,
    score,
  };
}
