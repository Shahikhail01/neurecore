/**
 * Enterprise Cognitive Coordination Layer — contracts (Phase 5).
 *
 * A governed REASONING + COORDINATION layer. It understands intent, decomposes
 * objectives, reasons over enterprise state, coordinates specialist AI
 * employees, and RECOMMENDS. It NEVER executes: enterprise mutation flows
 * through the Phase 4 Governed Work Runtime. It consumes Context Plane +
 * Work Runtime public interfaces only; no direct capability access.
 *
 * Explainability principle: every cognitive output carries evidence, confidence,
 * reasoning, assumptions, rejected alternatives, and policies considered.
 */

// ── Confidence (never percentages) ──────────────────────────────────────────
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

// ── Evidence + reasoning (attached to every conclusion/recommendation) ──────
export interface Evidence {
  /** Where the fact came from — MUST be a real source, not fabricated. */
  source:
    | 'CONTEXT_PLANE'
    | 'PLANNING_MEMORY'
    | 'ORGANIZATIONAL_MEMORY'
    | 'RUNTIME_HISTORY'
    | 'GOVERNANCE'
    | 'CAPABILITY_SUMMARY';
  capability?: string;
  reference: string; // entity id / metric name / plan id
  detail: string;
}

export interface ReasoningTrace {
  conclusion: string;
  evidence: Evidence[];
  assumptions: string[];
  knownUnknowns: string[];
  alternativesConsidered: string[];
  rejectedAlternatives: string[];
  policiesConsidered: string[];
  confidence: Confidence;
}

// ── Objective analysis (IObjectiveAnalyzer) ─────────────────────────────────
export interface EnterpriseObjective {
  id: string;
  tenantId: string;
  statement: string; // the enterprise objective, not the raw request
  departments: string[];
  requiredContextCapabilities: string[];
  constraints: string[];
  expectedDeliverables: string[];
  successCriteria: string[];
  reasoning: ReasoningTrace;
}

// ── Goal decomposition (IGoalDecomposer) ────────────────────────────────────
export interface DecomposedGoal {
  id: string;
  sequence: number;
  title: string;
  description: string;
  dependsOn: string[];
  suggestedDepartment: string | null;
  /** true → this goal is a candidate for a Work Runtime run (still recommended, not executed). */
  executable: boolean;
}

export interface GoalDecomposition {
  objectiveId: string;
  goals: DecomposedGoal[];
  reasoning: ReasoningTrace;
}

// ── Recommendation (IRecommendationEngine) — structured, never free text ────
export interface EnterpriseRecommendation {
  id: string;
  tenantId: string;
  title: string;
  summary: string;
  priority: Priority;
  confidence: Confidence;
  evidence: Evidence[];
  reasoning: string;
  assumptions: string[];
  risks: string[];
  alternatives: string[];
  departments: string[];
  recommendedAgentRole: string | null;
  requiresApproval: boolean;
  shouldBecomeWorkRun: boolean;
  /** If shouldBecomeWorkRun, the request handed to the Work Runtime (never executed here). */
  proposedWorkRequest: string | null;
}

// ── Specialist AI employees (reasoning-only) ────────────────────────────────
export interface SpecialistAgent {
  role: string; // e.g. 'Finance Analyst'
  department: string;
  expertise: string[];
  /** Reasoning scope; specialists NEVER execute tools. */
  reasoningScope: string[];
  maxAuthority: number; // advisory ceiling; does not grant execution
}

export interface SpecialistOpinion {
  role: string;
  department: string;
  opinion: string;
  reasoning: ReasoningTrace;
}

// ── Strategy (IStrategyEvaluator) ───────────────────────────────────────────
export interface StrategicFinding {
  area: 'OKR' | 'KPI' | 'DEPARTMENT_GOAL' | 'PRIORITY_CONFLICT' | 'RESOURCE_CONFLICT' | 'STRATEGIC_DRIFT';
  finding: string;
  priority: Priority;
  reasoning: ReasoningTrace;
}

// ── Planning memory (IPlanningMemory) — structured, NOT chat ────────────────
export type PlanningMemoryKind =
  | 'SUCCESSFUL_PLAN'
  | 'FAILED_PLAN'
  | 'APPROVAL_OUTCOME'
  | 'EXECUTION_METRIC'
  | 'PLAN_TEMPLATE';

export interface PlanningMemoryEntry {
  id: string;
  tenantId: string;
  kind: PlanningMemoryKind;
  objective: string;
  outcome: string;
  metrics: Record<string, number>;
  createdAt: string;
}

// ── Cognitive evaluation (ICognitiveEvaluator) ──────────────────────────────
export interface CognitiveScore {
  reasoningQuality: Confidence;
  evidenceCoverage: Confidence;
  hallucinationRisk: Confidence; // VERY_LOW is best
  consistency: Confidence;
  issues: string[];
}

// ── Top-level result ────────────────────────────────────────────────────────
export interface CognitiveResult {
  requestId: string;
  tenantId: string;
  objective: EnterpriseObjective;
  decomposition: GoalDecomposition;
  specialistOpinions: SpecialistOpinion[];
  recommendations: EnterpriseRecommendation[];
  strategicFindings: StrategicFinding[];
  score: CognitiveScore;
  producedAt: string;
  /** Execution NEVER happens here; ids of any work runs the caller chose to create. */
  handedOffWorkRunIds: string[];
}

// ── Ports ───────────────────────────────────────────────────────────────────
export interface CognitionScope {
  projectId?: string;
  customerId?: string;
  departmentId?: string;
  includeCapabilities?: string[];
}

export const OBJECTIVE_ANALYZER = Symbol('OBJECTIVE_ANALYZER');
export interface IObjectiveAnalyzer {
  analyze(tenantId: string, actorId: string, request: string, context: Record<string, unknown>): Promise<EnterpriseObjective>;
}

export const GOAL_DECOMPOSER = Symbol('GOAL_DECOMPOSER');
export interface IGoalDecomposer {
  decompose(objective: EnterpriseObjective, context: Record<string, unknown>): Promise<GoalDecomposition>;
}

export const REASONING_ENGINE = Symbol('REASONING_ENGINE');
export interface IReasoningEngine {
  reason(tenantId: string, question: string, context: Record<string, unknown>): Promise<ReasoningTrace>;
}

export const RECOMMENDATION_ENGINE = Symbol('RECOMMENDATION_ENGINE');
export interface IRecommendationEngine {
  recommend(params: {
    tenantId: string;
    objective: EnterpriseObjective;
    decomposition: GoalDecomposition;
    opinions: SpecialistOpinion[];
    context: Record<string, unknown>;
  }): Promise<EnterpriseRecommendation[]>;
}

export const AGENT_SELECTOR = Symbol('AGENT_SELECTOR');
export interface IAgentSelector {
  select(objective: EnterpriseObjective): SpecialistAgent[]; // deterministic
  listAll(): SpecialistAgent[];
}

export const AGENT_COORDINATOR = Symbol('AGENT_COORDINATOR');
export interface IAgentCoordinator {
  coordinate(params: {
    tenantId: string;
    objective: EnterpriseObjective;
    specialists: SpecialistAgent[];
    context: Record<string, unknown>;
  }): Promise<SpecialistOpinion[]>;
}

export const STRATEGY_EVALUATOR = Symbol('STRATEGY_EVALUATOR');
export interface IStrategyEvaluator {
  evaluate(tenantId: string, context: Record<string, unknown>): Promise<StrategicFinding[]>;
}

export const PLANNING_MEMORY = Symbol('PLANNING_MEMORY');
export interface IPlanningMemory {
  record(entry: Omit<PlanningMemoryEntry, 'id' | 'createdAt'>): Promise<PlanningMemoryEntry>;
  recall(tenantId: string, kind?: PlanningMemoryKind, limit?: number): Promise<PlanningMemoryEntry[]>;
}

export const COGNITIVE_EVALUATOR = Symbol('COGNITIVE_EVALUATOR');
export interface ICognitiveEvaluator {
  score(result: Omit<CognitiveResult, 'score' | 'producedAt' | 'handedOffWorkRunIds'>): CognitiveScore;
}

export const ENTERPRISE_COGNITION = Symbol('ENTERPRISE_COGNITION');
export interface CognizeParams {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT';
  request: string;
  scope?: CognitionScope;
  /** If true, executable recommendations are handed to the Work Runtime (governed). Default false. */
  autoHandoff?: boolean;
  /**
   * The Employee (tenant Agent UUID) that executes handed-off work. Required
   * for autoHandoff; if autoHandoff is true but this is absent, the handoff is
   * BLOCKED (no dormant CREATED WorkRun is created) and the reason recorded.
   */
  handoffEmployeeId?: string;
}
export interface IEnterpriseCognition {
  cognize(params: CognizeParams): Promise<CognitiveResult>;
}
