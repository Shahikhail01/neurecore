// src/modules/assignments/domain/agent-capability.ts
// Phase 4 (AI-IMPLEMENTATION-PLAN-v2.md §6.1) — agent capability
// metadata + deterministic scoring policy.
//
// The scoring policy is **versioned**. When the weights change,
// bump POLICY_VERSION. Old persisted rationales remain attributable
// to the version that produced them. This matches the plan's
// "versioned deterministic scoring policy" requirement.

export type AgentAvailabilityState =
  | 'AVAILABLE'
  | 'BUSY'
  | 'OFFLINE'
  | 'ARCHIVED';

export type AgentDataClassification =
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export interface AgentCapability {
  agentId: string;
  tenantId: string;
  name: string;
  role: string | null;
  specializations: string[];
  permissions: string[];
  maxConcurrency: number;
  currentWorkload: number;
  availability: AgentAvailabilityState;
  archived: boolean;
  dataClassification: AgentDataClassification;
  departmentId: string | null;
}

export interface AssignmentFilter {
  tenantId: string;
  requiredRole: string | null;
  requiredCapabilities: string[];
  departmentConstraint?: string | null;
  dataClassification?: AgentDataClassification;
  /** Maximum active workload an eligible agent may carry. */
  maxActiveWorkload?: number;
}

/**
 * SCORING POLICY — single source of truth for the assignment rubric.
 *
 * Weights (must sum to 100):
 *   capability match (40)
 *   current workload (30)
 *   department alignment (20)
 *   historical performance (10)
 *
 * Tweak rules:
 *   - The weights live ONLY here. AssignmentService reads them via
 *     `getActiveScoringPolicy()`. Tests freeze a known version.
 *   - Adding a new signal: bump POLICY_VERSION and document the new
 *     field in plan §6.2 and the G4 evidence.
 */
export interface ScoringWeights {
  capability: number;
  workload: number;
  department: number;
  historical: number;
}

export interface ScoringPolicy {
  version: string;
  weights: ScoringWeights;
  /** Cap on the workload-penalty curve (number of active tasks = 0). */
  maxWorkloadPenalty: number;
  /** Per-task workload penalty. */
  workloadPenaltyPerTask: number;
  /**
   * Department alignment: same department → full points, partial
   * (same tenant, different department) → half points.
   */
  departmentFullPoints: number;
  departmentPartialPoints: number;
}

export const SCORING_POLICY_V1: ScoringPolicy = {
  version: '1.0',
  weights: {
    capability: 40,
    workload: 30,
    department: 20,
    historical: 10,
  },
  maxWorkloadPenalty: 30,
  workloadPenaltyPerTask: 3,
  departmentFullPoints: 20,
  departmentPartialPoints: 10,
};

export function getActiveScoringPolicy(): ScoringPolicy {
  // Future versions: read from a config table or tenant flag.
  return SCORING_POLICY_V1;
}

export interface ScoredAgent {
  agentId: string;
  name: string;
  score: number;
  rationale: string;
  currentWorkload: number;
  capabilityScore: number;
  workloadScore: number;
  departmentScore: number;
  historicalScore: number;
  policyVersion: string;
}

export interface ActiveExecutionSummary {
  activeCount: number;
  inProgressCount: number;
  queuedCount: number;
  blockedCount: number;
  historicalSuccessRate: number;
}

/**
 * Apply the deterministic scoring policy to a single agent given the
 * eligibility filter the agent passed. Pure function — easy to test.
 */
export function scoreAgent(
  agent: AgentCapability,
  filter: AssignmentFilter,
  historicalSuccessRate: number,
  activeSummary: ActiveExecutionSummary,
  policy: ScoringPolicy = getActiveScoringPolicy(),
): ScoredAgent {
  const requiredCaps = filter.requiredCapabilities ?? [];
  const matchedCaps = requiredCaps.filter((cap) =>
    agent.specializations.includes(cap) || agent.permissions.includes(cap),
  );
  const capabilityScore =
    requiredCaps.length === 0
      ? policy.weights.capability
      : Math.round(
          (matchedCaps.length / requiredCaps.length) * policy.weights.capability,
        );

  const workloadUnits = activeSummary.activeCount;
  const workloadPenalty = Math.min(
    policy.maxWorkloadPenalty,
    workloadUnits * policy.workloadPenaltyPerTask,
  );
  const workloadScore = Math.max(0, policy.weights.workload - workloadPenalty);

  let departmentScore = 0;
  if (filter.departmentConstraint && agent.departmentId === filter.departmentConstraint) {
    departmentScore = policy.departmentFullPoints;
  } else if (filter.departmentConstraint) {
    departmentScore = policy.departmentPartialPoints;
  } else {
    departmentScore = Math.round(policy.departmentFullPoints / 2);
  }

  const historicalScore = Math.round(
    Math.max(0, Math.min(100, historicalSuccessRate)) * (policy.weights.historical / 100),
  );

  const total = capabilityScore + workloadScore + departmentScore + historicalScore;

  const rationaleSegments = [
    `capability ${matchedCaps.length}/${requiredCaps.length} (+${capabilityScore})`,
    `workload ${workloadUnits} (-${workloadPenalty}, +${workloadScore})`,
    `department ${filter.departmentConstraint ? (agent.departmentId === filter.departmentConstraint ? 'match' : 'partial') : 'open'} (+${departmentScore})`,
    `historical success rate ${historicalSuccessRate.toFixed(2)}% (+${historicalScore})`,
    `total ${total} (policy ${policy.version})`,
  ];

  return {
    agentId: agent.agentId,
    name: agent.name,
    score: total,
    rationale: rationaleSegments.join('; '),
    currentWorkload: activeSummary.activeCount,
    capabilityScore,
    workloadScore,
    departmentScore,
    historicalScore,
    policyVersion: policy.version,
  };
}

/**
 * Tie-breaker for deterministic selection when two eligible agents
 * score the same. Keeps the same on every replay so a (task, agent)
 * decision is reproducible.
 */
export function tieBreak(
  a: AgentCapability,
  b: AgentCapability,
): -1 | 0 | 1 {
  if (a.agentId === b.agentId) return 0;
  if (a.currentWorkload !== b.currentWorkload) {
    return a.currentWorkload < b.currentWorkload ? -1 : 1;
  }
  if (a.maxConcurrency !== b.maxConcurrency) {
    return a.maxConcurrency > b.maxConcurrency ? -1 : 1;
  }
  return a.agentId < b.agentId ? -1 : 1;
}
