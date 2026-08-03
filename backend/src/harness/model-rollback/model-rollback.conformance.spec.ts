/**
 * NeureCore Harness - Model/Provider Rollback Conformance (Phase 4)
 *
 * Document ID: NC-HARNESS-MODEL-ROLLBACK-001
 * Tests: ~22
 */

import {
  InMemoryModelRegistry,
  MODEL_ROLLBACK_VERSION,
  createModelComparison,
  validateRolloutTransition,
  ROLLOUT_TRANSITIONS,
  type ModelVersion,
  type RolloutPolicy,
} from './index';
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

const sampleModel = (overrides: Partial<ModelVersion> = {}): ModelVersion => ({
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
  ...overrides,
});

const sampleRollout = (
  overrides: Partial<RolloutPolicy> = {},
): RolloutPolicy => ({
  rolloutId: 'r1',
  modelId: 'm1',
  targetVersion: '1.1.0',
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
  status: 'DRAFT',
  transitions: [],
  ...overrides,
});

describe('Model / Provider Rollback — Phase 4 conformance', () => {
  test('MODEL_ROLLBACK_VERSION is 1.0.0', () => {
    expect(MODEL_ROLLBACK_VERSION).toBe('1.0.0');
  });

  test('ROLLOUT_TRANSITIONS covers DRAFT→ACTIVE', () => {
    expect(ROLLOUT_TRANSITIONS.DRAFT).toContain('ACTIVE');
  });

  test('validateRolloutTransition rejects COMPLETED → ACTIVE', () => {
    expect(validateRolloutTransition('COMPLETED', 'ACTIVE')).toBe(false);
  });

  test('validateRolloutTransition accepts ACTIVE → PAUSED', () => {
    expect(validateRolloutTransition('ACTIVE', 'PAUSED')).toBe(true);
  });

  test('InMemory registry registers model', () => {
    const r = new InMemoryModelRegistry();
    const m = r.registerModel(sampleModel(), authCtx());
    expect(m.modelId).toBe('m1');
  });

  test('InMemory registry rejects duplicate version', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    expect(() => r.registerModel(sampleModel(), authCtx())).toThrow(
      /already exists/,
    );
  });

  test('InMemory registry rejects unauthorized actor', () => {
    const r = new InMemoryModelRegistry();
    const weak = authCtx({ actorRoles: ['TENANT_USER'] });
    expect(() => r.registerModel(sampleModel(), weak)).toThrow(
      /Authorization denied/,
    );
  });

  test('InMemory registry supersedes a model', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    const next = r.supersede({
      modelId: 'm1',
      newVersion: '1.1.0',
      ctx: authCtx(),
    });
    expect(next.version).toBe('1.1.0');
    expect(r.list('m1')).toHaveLength(2);
  });

  test('InMemory registry revokes model', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    const revoked = r.revoke('m1', '1.0.0', 'security incident', authCtx());
    expect(revoked.status).toBe('REVOKED');
  });

  test('InMemory registry quarantines model', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    const m = r.quarantine('m1', '1.0.0', 'safety concern', authCtx());
    expect(m.status).toBe('QUARANTINED');
  });

  test('InMemory registry getActive picks ACTIVE', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    expect(r.getActive('m1')?.version).toBe('1.0.0');
  });

  test('InMemory registry searchByCapability filters', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel({ capabilities: ['CHAT'] }), authCtx());
    r.registerModel(
      sampleModel({
        modelId: 'm2',
        version: '1.0.0',
        capabilities: ['EMBEDDING'],
      }),
      authCtx(),
    );
    expect(r.searchByCapability('CHAT')).toHaveLength(1);
    expect(r.searchByCapability('EMBEDDING')).toHaveLength(1);
  });

  test('Rollout creation requires authorized actor', () => {
    const r = new InMemoryModelRegistry();
    const weak = authCtx({ actorRoles: ['TENANT_USER'] });
    expect(() => r.createRollout(sampleRollout(), weak)).toThrow(
      /Authorization denied/,
    );
  });

  test('Rollout creation stores policy', () => {
    const r = new InMemoryModelRegistry();
    const policy = r.createRollout(sampleRollout(), authCtx());
    expect(policy.rolloutId).toBe('r1');
    expect(r.listRollouts()).toHaveLength(1);
  });

  test('Rollout transition DRAFT→ACTIVE appends audit entry', () => {
    const r = new InMemoryModelRegistry();
    r.createRollout(sampleRollout(), authCtx());
    const next = r.transitionRollout({
      rolloutId: 'r1',
      next: 'ACTIVE',
      reason: 'ready for canary',
      ctx: authCtx(),
    });
    expect(next.status).toBe('ACTIVE');
    expect(next.transitions).toHaveLength(1);
  });

  test('Rollout transition rejects invalid moves', () => {
    const r = new InMemoryModelRegistry();
    r.createRollout(sampleRollout({ status: 'COMPLETED' }), authCtx());
    expect(() =>
      r.transitionRollout({
        rolloutId: 'r1',
        next: 'ACTIVE',
        reason: 'x',
        ctx: authCtx(),
      }),
    ).toThrow(/Invalid rollout transition/);
  });

  test('Comparison engine returns PROMOTE on all passes', () => {
    const c = createModelComparison();
    const cmp = c.compare({
      rollout: sampleRollout(),
      baseline: sampleModel(),
      candidate: sampleModel({ version: '1.1.0' }),
      observations: [
        { metric: 'CORRECTNESS', baselineValue: 0.9, candidateValue: 0.92 },
        { metric: 'LATENCY_MS', baselineValue: 800, candidateValue: 820 },
        { metric: 'COST_PER_TASK', baselineValue: 1, candidateValue: 1.05 },
        { metric: 'HALLUCINATION', baselineValue: 0.05, candidateValue: 0.06 },
      ],
      ctx: authCtx(),
    });
    expect(cmp.verdict).toBe('PROMOTE');
  });

  test('Comparison engine returns ROLLBACK on critical regression', () => {
    const c = createModelComparison();
    const cmp = c.compare({
      rollout: sampleRollout(),
      baseline: sampleModel(),
      candidate: sampleModel({ version: '1.1.0' }),
      observations: [
        { metric: 'CORRECTNESS', baselineValue: 0.9, candidateValue: 0.7 },
        { metric: 'HALLUCINATION', baselineValue: 0.05, candidateValue: 0.2 },
      ],
      ctx: authCtx(),
    });
    expect(cmp.verdict).toBe('ROLLBACK');
  });

  test('Comparison engine returns HOLD on non-critical regression', () => {
    const c = createModelComparison();
    const cmp = c.compare({
      rollout: sampleRollout(),
      baseline: sampleModel(),
      candidate: sampleModel({ version: '1.1.0' }),
      observations: [
        { metric: 'CORRECTNESS', baselineValue: 0.9, candidateValue: 0.9 },
        { metric: 'LATENCY_MS', baselineValue: 800, candidateValue: 1000 },
        { metric: 'COST_PER_TASK', baselineValue: 1, candidateValue: 1.1 },
        { metric: 'HALLUCINATION', baselineValue: 0.05, candidateValue: 0.05 },
      ],
      ctx: authCtx(),
    });
    expect(cmp.verdict).toBe('HOLD');
  });

  test('attachComparison stores comparison', () => {
    const r = new InMemoryModelRegistry();
    const c = createModelComparison();
    const cmp = c.compare({
      rollout: sampleRollout(),
      baseline: sampleModel(),
      candidate: sampleModel({ version: '1.1.0' }),
      observations: [
        { metric: 'CORRECTNESS', baselineValue: 0.9, candidateValue: 0.95 },
      ],
      ctx: authCtx(),
    });
    r.attachComparison(cmp);
    expect(r.listComparisons('r1')).toHaveLength(1);
  });

  test('Search by capability filters out non-ACTIVE', () => {
    const r = new InMemoryModelRegistry();
    r.registerModel(sampleModel(), authCtx());
    r.registerModel(
      sampleModel({ modelId: 'm2', version: '1.0.0', status: 'DEPRECATED' }),
      authCtx(),
    );
    expect(r.searchByCapability('CHAT')).toHaveLength(1);
  });

  test('Rollout transitions are immutable history', () => {
    const r = new InMemoryModelRegistry();
    r.createRollout(sampleRollout(), authCtx());
    r.transitionRollout({
      rolloutId: 'r1',
      next: 'ACTIVE',
      reason: 'go',
      ctx: authCtx(),
    });
    r.transitionRollout({
      rolloutId: 'r1',
      next: 'PAUSED',
      reason: 'incident',
      ctx: authCtx(),
    });
    const final = r.getRollout('r1');
    expect(final?.transitions).toHaveLength(2);
    expect(final?.transitions[0].from).toBe('DRAFT');
    expect(final?.transitions[0].to).toBe('ACTIVE');
  });
});
