// src/test/unit/assignment-scoring.spec.ts
// Phase 4 (plan §6.1) — deterministic scoring policy and tie-break.

import {
  scoreAgent,
  tieBreak,
  SCORING_POLICY_V1,
  getActiveScoringPolicy,
  AgentCapability,
  AgentDataClassification,
} from '../../modules/assignments/domain/agent-capability';

function buildAgent(overrides: Partial<AgentCapability> = {}): AgentCapability {
  return {
    agentId: 'agent-1',
    tenantId: 'tnt-acme',
    name: 'Senior Accountant',
    role: 'SENIOR_ACCOUNTANT',
    specializations: ['data_entry', 'review', 'reconciliation'],
    permissions: ['data_entry', 'review', 'reconciliation'],
    maxConcurrency: 5,
    currentWorkload: 0,
    availability: 'AVAILABLE',
    archived: false,
    dataClassification: 'INTERNAL',
    departmentId: 'dept-accounting',
    ...overrides,
  };
}

describe('SCORING_POLICY_V1 weights', () => {
  it('sum to 100', () => {
    const total =
      SCORING_POLICY_V1.weights.capability +
      SCORING_POLICY_V1.weights.workload +
      SCORING_POLICY_V1.weights.department +
      SCORING_POLICY_V1.weights.historical;
    expect(total).toBe(100);
  });

  it('is returned as the active policy by getActiveScoringPolicy', () => {
    expect(getActiveScoringPolicy().version).toBe('1.0');
  });
});

describe('scoreAgent', () => {
  it('returns full capability score when no required capabilities', () => {
    const result = scoreAgent(
      buildAgent(),
      {
        tenantId: 'tnt-acme',
        requiredRole: null,
        requiredCapabilities: [],
      },
      50,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 50,
      },
    );
    expect(result.capabilityScore).toBe(40);
    expect(result.workloadScore).toBe(30);
    expect(result.departmentScore).toBeGreaterThan(0);
    expect(result.historicalScore).toBeGreaterThan(0);
    expect(result.policyVersion).toBe('1.0');
  });

  it('returns a deterministic score for the same input', () => {
    const agent = buildAgent();
    const filter = {
      tenantId: 'tnt-acme',
      requiredRole: 'SENIOR_ACCOUNTANT' as string | null,
      requiredCapabilities: ['data_entry', 'review'],
      departmentConstraint: 'dept-accounting',
    };
    const summary = {
      activeCount: 1,
      inProgressCount: 1,
      queuedCount: 0,
      blockedCount: 0,
      historicalSuccessRate: 75,
    };
    const a = scoreAgent(agent, filter, 75, summary);
    const b = scoreAgent(agent, filter, 75, summary);
    expect(a.score).toBe(b.score);
    expect(a.rationale).toBe(b.rationale);
  });

  it('penalizes workload above zero', () => {
    const base = scoreAgent(
      buildAgent({ currentWorkload: 0 }),
      { tenantId: 'tnt-acme', requiredRole: null, requiredCapabilities: [] },
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    const busy = scoreAgent(
      buildAgent({ currentWorkload: 5 }),
      { tenantId: 'tnt-acme', requiredRole: null, requiredCapabilities: [] },
      0,
      {
        activeCount: 5,
        inProgressCount: 0,
        queuedCount: 5,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(busy.workloadScore).toBeLessThan(base.workloadScore);
    expect(busy.score).toBeLessThan(base.score);
  });

  it('caps workload penalty at the policy maxWorkloadPenalty', () => {
    const heavy = scoreAgent(
      buildAgent({ currentWorkload: 20 }),
      { tenantId: 'tnt-acme', requiredRole: null, requiredCapabilities: [] },
      0,
      {
        activeCount: 20,
        inProgressCount: 0,
        queuedCount: 20,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(heavy.workloadScore).toBe(0);
  });

  it('rewards same-department alignment fully', () => {
    const same = scoreAgent(
      buildAgent({ departmentId: 'dept-accounting' }),
      {
        tenantId: 'tnt-acme',
        requiredRole: null,
        requiredCapabilities: [],
        departmentConstraint: 'dept-accounting',
      },
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    const other = scoreAgent(
      buildAgent({ departmentId: 'dept-other' }),
      {
        tenantId: 'tnt-acme',
        requiredRole: null,
        requiredCapabilities: [],
        departmentConstraint: 'dept-accounting',
      },
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(same.departmentScore).toBe(SCORING_POLICY_V1.departmentFullPoints);
    expect(other.departmentScore).toBe(SCORING_POLICY_V1.departmentPartialPoints);
  });

  it('maps a partial capability match', () => {
    const partial = scoreAgent(
      buildAgent({ specializations: ['data_entry'], permissions: ['data_entry'] }),
      {
        tenantId: 'tnt-acme',
        requiredRole: null,
        requiredCapabilities: ['data_entry', 'review'],
      },
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(partial.capabilityScore).toBe(20);
  });

  it('embeds the policy version in the rationale', () => {
    const result = scoreAgent(
      buildAgent(),
      { tenantId: 'tnt-acme', requiredRole: null, requiredCapabilities: [] },
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(result.rationale).toContain('policy 1.0');
    expect(result.policyVersion).toBe('1.0');
  });

  it('honors data classification when set on filter (no scoring effect, passed through)', () => {
    const filter = {
      tenantId: 'tnt-acme',
      requiredRole: null,
      requiredCapabilities: [],
      dataClassification: 'CONFIDENTIAL' as AgentDataClassification,
    };
    const result = scoreAgent(
      buildAgent({ dataClassification: 'CONFIDENTIAL' }),
      filter,
      0,
      {
        activeCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
        historicalSuccessRate: 0,
      },
    );
    expect(result.capabilityScore).toBe(40);
  });
});

describe('tieBreak', () => {
  it('prefers lower workload', () => {
    const a = buildAgent({ agentId: 'A', currentWorkload: 1 });
    const b = buildAgent({ agentId: 'B', currentWorkload: 3 });
    expect(tieBreak(a, b)).toBe(-1);
  });

  it('falls back to higher maxConcurrency when workload is equal', () => {
    const a = buildAgent({ agentId: 'A', currentWorkload: 2, maxConcurrency: 10 });
    const b = buildAgent({ agentId: 'B', currentWorkload: 2, maxConcurrency: 5 });
    expect(tieBreak(a, b)).toBe(-1);
  });

  it('falls back to lexicographic id order when workload and capacity are equal', () => {
    const a = buildAgent({ agentId: 'A', currentWorkload: 2, maxConcurrency: 5 });
    const b = buildAgent({ agentId: 'B', currentWorkload: 2, maxConcurrency: 5 });
    expect(tieBreak(a, b)).toBe(-1);
    expect(tieBreak(b, a)).toBe(1);
  });

  it('returns 0 for identical agents', () => {
    const a = buildAgent();
    const b = buildAgent();
    expect(tieBreak(a, b)).toBe(0);
  });
});