/**
 * NeureCore Harness - Phase 5 Workflows Conformance
 *
 * Document ID: NC-HARNESS-PHASE5-WORKFLOWS-CONFORMANCE-001
 */

import { randomUUID } from 'crypto';
import {
  InMemoryWorkRunStore,
  InMemoryCompensationLedger,
  WorkRunConcurrencyGuard,
  checkTimeout,
  validateRunTransition,
  validateStepTransition,
  isTerminalRunStatus,
  isTerminalStepStatus,
  computeWorkflowChecksum,
  type WorkRunRecord,
  type WorkRunStepRecord,
  type CompensationRecord,
} from './index';
import type { AuthorizationContext } from '../../contracts';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const ctx = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actorId: 'a',
  actorType: 'AI_AGENT',
  actorRoles: ['DOMAIN_OWNER'],
  tenantId: TENANT_A,
  correlationId: 'c',
  permissions: [],
  ...overrides,
});

const makeRun = (overrides: Partial<WorkRunRecord> = {}): WorkRunRecord => {
  const now = new Date().toISOString();
  return {
    runId: randomUUID(),
    tenantId: TENANT_A,
    actorId: 'a',
    actorType: 'AI_AGENT',
    status: 'CREATED',
    objective: 'o',
    idempotencyKey: `k-${Math.random()}`,
    currentStepIndex: 0,
    planVersion: 1,
    createdAt: now,
    updatedAt: now,
    steps: [],
    ...overrides,
  };
};

const makeStep = (
  overrides: Partial<WorkRunStepRecord> = {},
): WorkRunStepRecord => ({
  stepId: randomUUID(),
  runId: randomUUID(),
  sequence: 0,
  toolName: 't.read',
  capability: 'data',
  operationType: 'READ',
  status: 'PENDING',
  attemptCount: 0,
  idempotencyKey: 'sk',
  dependsOn: [],
  input: {},
  ...overrides,
});

describe('Phase 5 — Workflows Conformance', () => {
  describe('Run state machine', () => {
    test('CREATED -> PLANNING -> PLANNED -> RUNNING -> COMPLETED is valid', () => {
      expect(validateRunTransition('CREATED', 'PLANNING').ok).toBe(true);
      expect(validateRunTransition('PLANNING', 'PLANNED').ok).toBe(true);
      expect(validateRunTransition('PLANNED', 'RUNNING').ok).toBe(true);
      expect(validateRunTransition('RUNNING', 'COMPLETED').ok).toBe(true);
      expect(isTerminalRunStatus('COMPLETED')).toBe(true);
    });

    test('COMPLETED -> RUNNING is REJECTED', () => {
      expect(validateRunTransition('COMPLETED', 'RUNNING').ok).toBe(false);
    });

    test('CREATED -> RUNNING skips planning and is REJECTED', () => {
      expect(validateRunTransition('CREATED', 'RUNNING').ok).toBe(false);
    });

    test('any non-terminal state may transition to FAILED or CANCELLED', () => {
      for (const s of [
        'CREATED',
        'PLANNING',
        'PLANNED',
        'RUNNING',
        'WAITING_FOR_APPROVAL',
        'PAUSED',
      ] as const) {
        expect(validateRunTransition(s, 'FAILED').ok).toBe(true);
        expect(validateRunTransition(s, 'CANCELLED').ok).toBe(true);
      }
    });
  });

  describe('Step state machine', () => {
    test('PENDING -> VALIDATING -> APPROVED -> RUNNING -> SUCCEEDED is valid', () => {
      expect(validateStepTransition('PENDING', 'VALIDATING').ok).toBe(true);
      expect(validateStepTransition('VALIDATING', 'APPROVED').ok).toBe(true);
      expect(validateStepTransition('APPROVED', 'RUNNING').ok).toBe(true);
      expect(validateStepTransition('RUNNING', 'SUCCEEDED').ok).toBe(true);
      expect(isTerminalStepStatus('SUCCEEDED')).toBe(true);
    });

    test('SUCCEEDED -> RUNNING is REJECTED', () => {
      expect(validateStepTransition('SUCCEEDED', 'RUNNING').ok).toBe(false);
    });

    test('FAILED -> SKIPPED (compensation) is valid', () => {
      expect(validateStepTransition('FAILED', 'SKIPPED').ok).toBe(true);
    });
  });

  describe('Work-run store', () => {
    test('createOrGet is idempotent on idempotencyKey', () => {
      const s = new InMemoryWorkRunStore();
      const r = makeRun();
      const a = s.createOrGet(r, ctx());
      expect(a.created).toBe(true);
      const b = s.createOrGet({ ...r, runId: randomUUID() }, ctx());
      expect(b.created).toBe(false);
      expect(b.record.runId).toBe(r.runId);
    });

    test('cross-tenant create is REJECTED', () => {
      const s = new InMemoryWorkRunStore();
      expect(() =>
        s.createOrGet(makeRun({ tenantId: TENANT_B }), ctx()),
      ).toThrow(/cross-tenant/);
    });

    test('transition() respects state machine', () => {
      const s = new InMemoryWorkRunStore();
      const r = makeRun();
      s.createOrGet(r, ctx());
      const ok = s.transition(r.runId, 'PLANNING', ctx());
      expect(ok.ok).toBe(true);
      const bad = s.transition(r.runId, 'COMPLETED', ctx());
      expect(bad.ok).toBe(false);
    });

    test('upsertStep is tenant-scoped', () => {
      const s = new InMemoryWorkRunStore();
      const r = makeRun();
      s.createOrGet(r, ctx());
      const step = makeStep({ runId: r.runId });
      expect(s.upsertStep(step, ctx()).ok).toBe(true);
      expect(s.upsertStep(step, ctx({ tenantId: TENANT_B })).ok).toBe(false);
    });

    test('transitionStep requires the step to be in the run', () => {
      const s = new InMemoryWorkRunStore();
      const r = makeRun();
      s.createOrGet(r, ctx());
      const t = s.transitionStep(r.runId, randomUUID(), 'VALIDATING', ctx());
      expect(t.ok).toBe(false);
    });
  });

  describe('Compensation ledger', () => {
    const makeComp = (
      overrides: Partial<CompensationRecord> = {},
    ): CompensationRecord => ({
      compensationId: randomUUID(),
      runId: randomUUID(),
      stepId: randomUUID(),
      sideEffectEntryId: randomUUID(),
      tenantId: TENANT_A,
      inverseToolId: 't.inverse',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      ...overrides,
    });

    test('record() requires tenantId match', () => {
      const c = new InMemoryCompensationLedger();
      expect(() => c.record(makeComp({ tenantId: TENANT_B }), ctx())).toThrow(
        /cross-tenant/,
      );
    });

    test('record() is immutable: duplicate id throws', () => {
      const c = new InMemoryCompensationLedger();
      const r = makeComp();
      c.record(r, ctx());
      expect(() => c.record(r, ctx())).toThrow(/immutable/);
    });

    test('listByRun returns the run’s entries', () => {
      const c = new InMemoryCompensationLedger();
      const runId1 = randomUUID();
      const runId2 = randomUUID();
      const r1 = makeComp({ runId: runId1 });
      const r2 = makeComp({ runId: runId2 });
      c.record(r1, ctx());
      c.record(r2, ctx());
      expect(c.listByRun(runId1, ctx()).length).toBe(1);
      expect(c.listByRun(runId2, ctx()).length).toBe(1);
    });
  });

  describe('Concurrency guard', () => {
    test('acquire + release works as expected', () => {
      const g = new WorkRunConcurrencyGuard();
      expect(g.acquire('r', 's', 'A')).toBe(true);
      expect(g.acquire('r', 's', 'B')).toBe(false);
      expect(g.release('r', 's', 'B')).toBe(false);
      expect(g.release('r', 's', 'A')).toBe(true);
      expect(g.acquire('r', 's', 'B')).toBe(true);
      g.clear();
    });

    test('isHeld reports correct state', () => {
      const g = new WorkRunConcurrencyGuard();
      g.acquire('r', 's', 'A');
      expect(g.isHeld('r', 's')).toBe(true);
      g.release('r', 's', 'A');
      expect(g.isHeld('r', 's')).toBe(false);
    });
  });

  describe('Timeout watchdog', () => {
    test('WITHIN_BUDGET for fresh run', () => {
      expect(checkTimeout(new Date(), 1_000).kind).toBe('WITHIN_BUDGET');
    });

    test('TIMED_OUT for elapsed > budget', () => {
      const past = new Date(Date.now() - 10_000);
      const t = checkTimeout(past, 1_000);
      expect(t.kind).toBe('TIMED_OUT');
      if (t.kind === 'TIMED_OUT') {
        expect(t.budgetMs).toBe(1_000);
        expect(t.elapsedMs).toBeGreaterThanOrEqual(10_000);
      }
    });
  });

  describe('Checksum / provenance', () => {
    test('workflow checksum is sha256 and deterministic', () => {
      const r = makeRun();
      r.steps = [makeStep({ runId: r.runId, sequence: 0 })];
      const a = computeWorkflowChecksum(r);
      const b = computeWorkflowChecksum(r);
      expect(a).toBe(b);
      expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });
});
