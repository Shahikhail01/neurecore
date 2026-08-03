/**
 * Phase 3 — PR Lane Module Conformance
 *
 * Validates:
 *   - Lane selection always includes PR_FAST and MAINLINE
 *   - AI / prompt / dataset change forces PR_AI lane
 *   - Critical-surface change forces blocking lanes (§10 Phase 3 gate)
 *   - CriticalSurfaceGate rejects unacceptable outcomes on critical changes
 */

import {
  LaneSelector,
  CriticalSurfaceGate,
  DEFAULT_LANE_POLICIES,
  ChangedSurfaceSchema,
  type ChangedSurface,
} from './index';

function surface(prId: string, changes: any[]): ChangedSurface {
  const enriched = changes.map((c: Record<string, unknown>, i: number) => {
    const hex = (i + 1).toString(16).padStart(12, '0');
    const uuid = `11111111-1111-1111-1111-${hex}`;
    const out: Record<string, unknown> = { ...c };
    const cid = out.changeId;
    if (typeof cid !== 'string' || !/^[0-9a-f-]{36}$/i.test(cid)) {
      out.changeId = uuid;
    }
    return out;
  });
  return ChangedSurfaceSchema.parse({
    prId,
    baseSha: 'base-sha',
    headSha: 'head-sha',
    changes: enriched,
    detectedAt: '2026-08-02T00:00:00.000Z',
  });
}

describe('harness/pr-lane — LaneSelector', () => {
  const selector = new LaneSelector();

  it('always selects PR_FAST and MAINLINE', () => {
    const selection = selector.select({
      prId: 'pr-1',
      surface: surface('pr-1', []),
    });
    expect(selection.selectedLanes).toContain('PR_FAST');
    expect(selection.selectedLanes).toContain('MAINLINE');
    expect(selection.blockingLanes).toContain('PR_FAST');
    expect(selection.blockingLanes).toContain('MAINLINE');
  });

  it('forces PR_AI on prompt or dataset change', () => {
    const selection = selector.select({
      prId: 'pr-2',
      surface: surface('pr-2', [
        { changeId: 'c1', path: 'prompts/system.md', kind: 'PROMPT' },
      ]),
    });
    expect(selection.selectedLanes).toContain('PR_AI');
    expect(selection.aiChanges).toContain('prompts/system.md');
  });

  it('marks critical changes for blocking', () => {
    const selection = selector.select({
      prId: 'pr-3',
      surface: surface('pr-3', [
        {
          changeId: 'c1',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    expect(selection.mandatoryCriticalLaneForced).toBe(true);
    expect(selection.criticalChanges).toContain('src/auth/login.ts');
  });

  it('does not mark PR_AI for non-AI changes', () => {
    const selection = selector.select({
      prId: 'pr-4',
      surface: surface('pr-4', [
        { changeId: 'c1', path: 'src/foo.ts', kind: 'SOURCE' },
      ]),
    });
    expect(selection.selectedLanes).not.toContain('PR_AI');
  });

  it('DEFAULT_LANE_POLICIES contains all 8 lanes from §11', () => {
    const lanes = DEFAULT_LANE_POLICIES.map((p) => p.lane).sort();
    expect(lanes).toEqual(
      [
        'DEVELOPER',
        'MAINLINE',
        'NIGHTLY',
        'PR_AI',
        'PR_FAST',
        'PRODUCTION_PROBE',
        'RELEASE',
        'WEEKLY',
      ].sort(),
    );
  });
});

describe('harness/pr-lane — CriticalSurfaceGate (§10 Phase 3 gate)', () => {
  const selector = new LaneSelector();
  const gate = new CriticalSurfaceGate();

  it('passes trivially when there are no critical changes', () => {
    const selection = selector.select({
      prId: 'pr-1',
      surface: surface('pr-1', [
        { changeId: 'c1', path: 'src/foo.ts', kind: 'SOURCE' },
      ]),
    });
    const verdict = gate.evaluate({
      prId: 'pr-1',
      selection,
      runs: [],
    });
    expect(verdict.passed).toBe(true);
  });

  it('rejects when a critical change has a FAILED run', () => {
    const selection = selector.select({
      prId: 'pr-2',
      surface: surface('pr-2', [
        {
          changeId: 'c1',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    const verdict = gate.evaluate({
      prId: 'pr-2',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'FAILED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(verdict.passed).toBe(false);
    expect(
      verdict.reasons.some((r) => r.includes('unacceptable outcome')),
    ).toBe(true);
  });

  it('rejects FLAKY/SKIPPED outcomes on critical changes (§11)', () => {
    const selection = selector.select({
      prId: 'pr-3',
      surface: surface('pr-3', [
        {
          changeId: 'c1',
          path: 'src/billing/payments.ts',
          kind: 'SOURCE',
          capabilityId: 'payments',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    for (const outcome of [
      'FLAKY',
      'SKIPPED',
      'INFRA_ERROR',
      'BLOCKED',
      'UNKNOWN',
      'CANCELLED',
    ]) {
      const verdict = gate.evaluate({
        prId: `pr-3-${outcome}`,
        selection,
        runs: [{ lane: 'PR_FAST', runId: 'r', outcome, finalized: true }],
      });
      expect(verdict.passed).toBe(false);
      expect(verdict.reasons.length).toBeGreaterThan(0);
    }
  });

  it('rejects when a blocking lane did not run', () => {
    const selection = selector.select({
      prId: 'pr-4',
      surface: surface('pr-4', [
        {
          changeId: 'c1',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    const verdict = gate.evaluate({
      prId: 'pr-4',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: true },
      ],
      // MAINLINE missing
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((r) => r.includes('did not run'))).toBe(true);
  });

  it('rejects when a blocking lane is not finalized', () => {
    const selection = selector.select({
      prId: 'pr-5',
      surface: surface('pr-5', [
        {
          changeId: 'c1',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    const verdict = gate.evaluate({
      prId: 'pr-5',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: false },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.some((r) => r.includes('not finalized'))).toBe(true);
  });

  it('passes when all blocking lanes PASSED and finalized', () => {
    const selection = selector.select({
      prId: 'pr-6',
      surface: surface('pr-6', [
        {
          changeId: 'c1',
          path: 'src/auth/login.ts',
          kind: 'SOURCE',
          capabilityId: 'auth',
          riskTier: 'CRITICAL',
        },
      ]),
    });
    const verdict = gate.evaluate({
      prId: 'pr-6',
      selection,
      runs: [
        { lane: 'PR_FAST', runId: 'r1', outcome: 'PASSED', finalized: true },
        { lane: 'MAINLINE', runId: 'r2', outcome: 'PASSED', finalized: true },
      ],
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.reasons).toHaveLength(0);
  });
});
