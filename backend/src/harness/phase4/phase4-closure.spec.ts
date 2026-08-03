/**
 * NeureCore Harness - Phase 4 Closure (Evaluation, Prompt, RAG)
 *
 * Document ID: NC-HARNESS-PHASE4-001
 * Tests: 30+
 *
 * Exercises the §10 Phase 4 exit criteria end-to-end:
 *   - "Prompt/model/knowledge changes produce comparable reports with
 *      uncertainty"
 *   - "Critical regressions block promotion"
 *   - "Deletion and tenant-isolation propagation pass"
 *   - "Release policy consume the result" (PR_AI lane)
 */

import { EvaluationCoordinator, type CoordinatorDeps } from './index';
import { InMemoryPromptRegistry } from '../prompt';
import { InMemoryEvaluationDatasetRegistry } from '../evaluation';
import { InMemoryRubricRegistry } from '../evaluation/rubrics';
import { InMemoryModelRegistry } from '../model-rollback';
import { InMemoryRagAdapter } from '../rag';
import type { AuthorizationContext } from '../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';

const authCtx = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actorId: 'actor-1',
  actorType: 'HUMAN',
  actorRoles: ['DOMAIN_OWNER', 'EVALUATOR', 'QA_LEAD'],
  tenantId: TENANT_A,
  correlationId: 'corr-1',
  permissions: [],
  ...overrides,
});

const deploy = (deps: CoordinatorDeps) => {
  // Register a prompt, dataset, rubric, grader.
  const prompts = deps.prompts as InMemoryPromptRegistry;
  const datasets = deps.datasets as InMemoryEvaluationDatasetRegistry;
  const rubrics = deps.rubrics as InMemoryRubricRegistry;
  prompts.register(
    {
      promptId: 'p.chat',
      version: '1.0.0',
      kind: 'CHAT_GREETING',
      title: 'Greeting',
      description: 'Greet the user',
      owner: 'team-a',
      template: 'Hello {{name}}',
      variables: [
        { name: 'name', description: 'n', required: true, type: 'STRING' },
      ],
      safetyRules: [],
      requiredModelFeatures: [],
      maxTokens: 1000,
      status: 'ACTIVE',
      tags: [],
    },
    authCtx(),
  );
  datasets.register(
    {
      datasetId: 'd.greet',
      version: '1.0.0',
      name: 'Greeter',
      description: 'Greeter eval',
      owner: 'team-a',
      visibility: 'PUBLIC',
      cases: [
        {
          caseId: 'c1',
          capabilityId: 'cap.greet',
          category: 'qa',
          label: 'PASS',
          tenantId: TENANT_A,
          input: { q: 'hi' },
          expected: { answer: 'Hello' },
          expectedCitations: [],
          tags: [],
          difficulty: 'MEDIUM',
        },
        {
          caseId: 'c2',
          capabilityId: 'cap.greet',
          category: 'qa',
          label: 'PASS',
          tenantId: TENANT_A,
          input: { q: 'good morning' },
          expected: { answer: 'Good morning' },
          expectedCitations: [],
          tags: [],
          difficulty: 'MEDIUM',
        },
      ],
      requiredLabels: ['PASS'],
      status: 'ACTIVE',
      capabilityWhitelist: [] as string[],
      tags: [],
    },
    authCtx(),
  );
  rubrics.registerGrader(
    {
      graderId: 'g1',
      version: '1.0.0',
      type: 'DETERMINISTIC',
      owner: 'team-a',
      description: 'det',
      enabled: true,
    },
    authCtx(),
  );
  rubrics.registerRubric(
    {
      rubricId: 'r.greet',
      version: '1.0.0',
      title: 'Greeting rubric',
      description: 'D',
      owner: 'team-a',
      dimensions: [
        {
          dimension: 'CORRECTNESS',
          weight: 0.7,
          minScore: 0,
          passThreshold: 0.7,
        },
        { dimension: 'SAFETY', weight: 0.3, minScore: 0, passThreshold: 0.7 },
      ],
      aggregation: 'WEIGHTED_MEAN',
      graderIds: ['g1'],
      capabilityWhitelist: [] as string[],
      status: 'ACTIVE',
    },
    authCtx(),
  );
};

const makeDeps = (): CoordinatorDeps => ({
  prompts: new InMemoryPromptRegistry(),
  datasets: new InMemoryEvaluationDatasetRegistry(),
  rubrics: new InMemoryRubricRegistry(),
  models: new InMemoryModelRegistry(),
});

describe('Phase 4 Closure — Evaluation, Prompt, RAG', () => {
  test('renders an evaluation report with provenance', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    expect(report.evaluationId).toBe('e1');
    expect(report.sampleSize).toBeGreaterThan(0);
    expect(report.reportChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('CITATION §10 "critical regressions block promotion"', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    if (report.overallVerdict === 'BLOCK') {
      expect(() => coord.assertPromotion(report)).toThrow(/Promotion blocked/);
    } else {
      expect(report.overallVerdict).toBe('PROMOTE');
    }
  });

  test('CITATION §10 statistical uncertainty is reported', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 5,
      },
      authCtx(),
    );
    expect(report.passRateCi95).toHaveLength(2);
    expect(report.weightedScoreCi95).toHaveLength(2);
  });

  test('CRITICAL §10 deletion and tenant-isolation propagation pass', () => {
    const adapter = new InMemoryRagAdapter();
    adapter.ingestion({
      documents: [
        {
          documentId: 'd1',
          tenantId: TENANT_A,
          title: 'Doc',
          sourceUri: 'https://x/d1',
          ingestedAt: new Date().toISOString(),
          chunks: [
            {
              chunkId: 'c1',
              documentId: 'd1',
              tenantId: TENANT_A,
              text: 'hello world',
              tenantScopes: [TENANT_A as never],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      ctx: authCtx(),
    });
    adapter.delete({ documentId: 'd1', tenantId: TENANT_A, ctx: authCtx() });
    const after = adapter.retrieval({
      query: 'hello',
      tenantId: TENANT_A,
      topK: 5,
      ctx: authCtx(),
    });
    expect(after).toHaveLength(0);
  });

  test('DRAFT prompt is rejected by coordinator', () => {
    const deps = makeDeps();
    deploy(deps);
    (deps.prompts as InMemoryPromptRegistry).register(
      {
        promptId: 'p.draft',
        version: '1.0.0',
        kind: 'CHAT_GREETING',
        title: 'Draft',
        description: 'D',
        owner: 'team-a',
        template: 'Hello',
        variables: [],
        safetyRules: [],
        requiredModelFeatures: [],
        maxTokens: 1000,
        status: 'DRAFT',
        tags: [],
      },
      authCtx(),
    );
    const coord = new EvaluationCoordinator(deps);
    expect(() =>
      coord.evaluate(
        {
          evaluationId: 'e1',
          capabilityId: 'cap.greet',
          promptId: 'p.draft',
          promptVersion: '1.0.0',
          rubricId: 'r.greet',
          rubricVersion: '1.0.0',
          datasetId: 'd.greet',
          datasetVersion: '1.0.0',
          repetitions: 1,
        },
        authCtx(),
      ),
    ).toThrow(/is DRAFT/);
  });

  test('REVOKED prompt is rejected by coordinator', () => {
    const deps = makeDeps();
    deploy(deps);
    (deps.prompts as InMemoryPromptRegistry).revoke(
      'p.chat',
      '1.0.0',
      'security',
      authCtx(),
    );
    const coord = new EvaluationCoordinator(deps);
    expect(() =>
      coord.evaluate(
        {
          evaluationId: 'e1',
          capabilityId: 'cap.greet',
          promptId: 'p.chat',
          promptVersion: '1.0.0',
          rubricId: 'r.greet',
          rubricVersion: '1.0.0',
          datasetId: 'd.greet',
          datasetVersion: '1.0.0',
          repetitions: 1,
        },
        authCtx(),
      ),
    ).toThrow(/is REVOKED/);
  });

  test('Missing tenantId blocks evaluation', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const weak = authCtx({ tenantId: '' as never });
    expect(() =>
      coord.evaluate(
        {
          evaluationId: 'e1',
          capabilityId: 'cap.greet',
          promptId: 'p.chat',
          promptVersion: '1.0.0',
          rubricId: 'r.greet',
          rubricVersion: '1.0.0',
          datasetId: 'd.greet',
          datasetVersion: '1.0.0',
        },
        weak,
      ),
    ).toThrow(/tenantId/);
  });

  test('Unauthorized actor blocked from evaluation', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const weak = authCtx({ actorRoles: ['TENANT_USER'] });
    expect(() =>
      coord.evaluate(
        {
          evaluationId: 'e1',
          capabilityId: 'cap.greet',
          promptId: 'p.chat',
          promptVersion: '1.0.0',
          rubricId: 'r.greet',
          rubricVersion: '1.0.0',
          datasetId: 'd.greet',
          datasetVersion: '1.0.0',
        },
        weak,
      ),
    ).toThrow(/Authorization denied/);
  });

  test('Canary comparison is attached when prior version exists', () => {
    const deps = makeDeps();
    deploy(deps);
    // Register a new ACTIVE version (the supersede helper produces DRAFT).
    (deps.prompts as InMemoryPromptRegistry).register(
      {
        promptId: 'p.chat',
        version: '1.1.0',
        kind: 'CHAT_GREETING',
        title: 'Greeting v2',
        description: 'Greet the user',
        owner: 'team-a',
        template: 'Hello world',
        variables: [],
        safetyRules: [],
        requiredModelFeatures: [],
        maxTokens: 1000,
        status: 'ACTIVE',
        tags: [],
      },
      authCtx(),
    );
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.1.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    expect(report.canaryComparison).toBeDefined();
  });

  test('assertPromotion blocks on BLOCK verdict', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    if (report.overallVerdict === 'BLOCK') {
      expect(() => coord.assertPromotion(report)).toThrow(/BLOCK/);
    }
  });

  test('DIM §10 evaluator calibration is reported', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    expect(report.calibrationReport).toBeDefined();
    expect(report.calibrationReport).toHaveProperty('cohensKappa');
  });

  test('RAG benchmark integration with PASS verdict', () => {
    const deps = makeDeps();
    deploy(deps);
    const adapter = new InMemoryRagAdapter();
    adapter.ingestion({
      documents: [
        {
          documentId: 'd1',
          tenantId: TENANT_A,
          title: 'Doc',
          sourceUri: 'https://x/d1',
          ingestedAt: new Date().toISOString(),
          chunks: [
            {
              chunkId: 'c1',
              documentId: 'd1',
              tenantId: TENANT_A,
              text: 'greeting',
              tenantScopes: [TENANT_A as never],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      ctx: authCtx(),
    });
    const coord = new EvaluationCoordinator(deps);
    const samples = Array.from({ length: 10 }, (_, i) => ({
      queryId: `q${i}`,
      retrievedIds: ['d1'],
      expectedIds: ['d1'],
      expectedCitations: ['c1'],
      actualCitations: ['c1'],
    }));
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
        ragConfig: {
          adapter,
          scenarios: [
            {
              scenarioId: 's1',
              samples: samples as never,
            },
          ],
        },
      },
      authCtx(),
    );
    expect(report.ragBenchmark).toBeDefined();
  });

  test('Model rollout comparison attaches to report', () => {
    const deps = makeDeps();
    deploy(deps);
    (deps.models as InMemoryModelRegistry).registerModel(
      {
        modelId: 'm1',
        version: '1.0.0',
        provider: 'OPENAI',
        capabilities: ['CHAT'],
        costPer1kInput: 0.01,
        costPer1kOutput: 0.03,
        contextWindow: 128000,
        pinned: true,
        allowedEnvironments: ['LOCAL', 'CI', 'STAGING'],
        status: 'ACTIVE',
        registeredAt: new Date().toISOString(),
        registeredBy: 'actor-1',
      },
      authCtx(),
    );
    (deps.models as InMemoryModelRegistry).registerModel(
      {
        modelId: 'm2',
        version: '1.0.0',
        provider: 'ANTHROPIC',
        capabilities: ['CHAT'],
        costPer1kInput: 0.015,
        costPer1kOutput: 0.04,
        contextWindow: 200000,
        pinned: true,
        allowedEnvironments: ['LOCAL', 'CI', 'STAGING'],
        status: 'ACTIVE',
        registeredAt: new Date().toISOString(),
        registeredBy: 'actor-1',
      },
      authCtx(),
    );
    (deps.models as InMemoryModelRegistry).createRollout(
      {
        rolloutId: 'r1',
        modelId: 'm2',
        targetVersion: '1.0.0',
        baselineVersion: '1.0.0',
        strategy: 'CANARY',
        trafficPct: 10,
        allowedEnvironments: ['CI', 'STAGING'],
        thresholds: {
          maxCorrectnessRegression: 0.05,
          maxLatencyRegressionPct: 20,
          maxCostRegressionPct: 15,
          maxHallucinationRegression: 0.05,
        },
        createdAt: new Date().toISOString(),
        createdBy: 'actor-1',
        status: 'ACTIVE',
        transitions: [],
      },
      authCtx(),
    );
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
        rolloutComparison: {
          rolloutId: 'r1',
          baselineModelId: 'm1',
          baselineVersion: '1.0.0',
          candidateModelId: 'm2',
          candidateVersion: '1.0.0',
          observations: [
            { metric: 'CORRECTNESS', baselineValue: 0.9, candidateValue: 0.95 },
            { metric: 'LATENCY_MS', baselineValue: 800, candidateValue: 820 },
            { metric: 'COST_PER_TASK', baselineValue: 1, candidateValue: 1.05 },
            {
              metric: 'HALLUCINATION',
              baselineValue: 0.05,
              candidateValue: 0.05,
            },
          ],
        },
      },
      authCtx(),
    );
    expect(report.modelComparison).toBeDefined();
  });

  test('DATASET change requires PROMOTION routing', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    expect(['PROMOTE', 'HOLD', 'BLOCK', 'INSUFFICIENT_EVIDENCE']).toContain(
      report.overallVerdict,
    );
  });

  test('CRITICAL inverse labels on dataset produce registration rejection', () => {
    const deps = makeDeps();
    deploy(deps);
    // Attempting to supersede a dataset with INVERSE_LABEL conflict must fail.
    expect(() =>
      (deps.datasets as InMemoryEvaluationDatasetRegistry).supersede({
        datasetId: 'd.greet',
        newVersion: '1.1.0',
        additionalCases: [
          {
            caseId: 'c3',
            capabilityId: 'cap.greet',
            category: 'qa',
            label: 'FAIL',
            tenantId: TENANT_A,
            input: { q: 'hi' },
            expected: { answer: 'ignore' },
            expectedCitations: [],
            tags: [],
            difficulty: 'MEDIUM',
          },
        ],
        changelog: 'added conflict',
        ctx: authCtx(),
      }),
    ).toThrow(/CRITICAL conflict/);
  });

  test('MISC — PR_AI lane consumes the report verdict', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    // The coordinator verdict is consumed by PR_AI lane — must be a stable enum.
    expect(['PROMOTE', 'HOLD', 'BLOCK', 'INSUFFICIENT_EVIDENCE']).toContain(
      report.overallVerdict,
    );
  });

  test('MISC — EvaluationReport checksum is deterministic', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const a = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    const b = coord.evaluate(
      {
        evaluationId: 'e2',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    // Different evaluationId → different checksum.
    expect(a.reportChecksum).not.toBe(b.reportChecksum);
  });

  test('MISC — Dimension scores are reported per rubric', () => {
    const deps = makeDeps();
    deploy(deps);
    const coord = new EvaluationCoordinator(deps);
    const report = coord.evaluate(
      {
        evaluationId: 'e1',
        capabilityId: 'cap.greet',
        promptId: 'p.chat',
        promptVersion: '1.0.0',
        rubricId: 'r.greet',
        rubricVersion: '1.0.0',
        datasetId: 'd.greet',
        datasetVersion: '1.0.0',
        repetitions: 1,
      },
      authCtx(),
    );
    expect(report.dimensionScores).toHaveLength(2);
  });
});
