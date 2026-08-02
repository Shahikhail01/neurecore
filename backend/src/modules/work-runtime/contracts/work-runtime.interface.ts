/**
 * Governed Work Runtime — contracts (ADR-003 / ADR-004, Phase 4).
 *
 * Deterministic runtime, probabilistic planner. The runtime consumes
 * organizational context ONLY through the Context Plane, executes ONLY
 * registered tools, evaluates governance per step, pauses for approval, and
 * produces auditable outcomes. No direct capability Prisma; no autonomous
 * business decisions.
 */

// ── Status enums (mirror Prisma; closed sets) ───────────────────────────────

export type WorkRunStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'PLANNED'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type WorkRunStepStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'DENIED'
  | 'WAITING_FOR_APPROVAL'
  | 'APPROVED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type ToolEffect = 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE';
export type ActorType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

// ── Structured plan (planner output; schema-validated) ──────────────────────

export interface WorkPlanStep {
  id: string;
  sequence: number;
  description: string;
  toolName: string;
  capability: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  effect: ToolEffect;
  expectedOutput: string;
}

export interface WorkPlan {
  objective: string;
  assumptions: string[];
  requiredContextCapabilities: string[];
  steps: WorkPlanStep[];
  completionCriteria: string[];
}

// ── Runtime domain model (subset returned to callers) ───────────────────────

export interface WorkRunView {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  status: WorkRunStatus;
  request: string;
  currentStepIndex: number;
  planVersion: number;
  summary: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface WorkRunStepView {
  id: string;
  sequence: number;
  toolName: string;
  capability: string;
  operationType: ToolEffect;
  status: WorkRunStepStatus;
  governanceDecision: string | null;
  governanceReason: string | null;
  policySource: string | null;
  approvalId: string | null;
  attemptCount: number;
  errorCode: string | null;
  // input/result are REDACTED in views (sensitive)
}

// ── Governance decision (runtime) ───────────────────────────────────────────

export type RuntimeGovernanceOutcome = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export interface RuntimeGovernanceDecision {
  outcome: RuntimeGovernanceOutcome;
  reason: string;
  policySource: string;
  policyVersion: string;
  toolRegistrationsVersion: string;
  actorId: string;
  scope: { tenantId: string; capability: string; toolName: string };
  decidedAt: string;
}

// ── Tool contracts (ADR-004) ────────────────────────────────────────────────

export interface ToolContext {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  runId: string;
  stepId: string;
}

export interface RuntimeToolResult {
  ok: boolean;
  data?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface RuntimeTool {
  name: string;
  capability: string;
  description: string;
  effect: ToolEffect;
  /** Minimum effective authority to execute (governance may still gate). */
  requiredAuthority: number;
  /** Whether execution requires human approval by policy (external/irreversible). */
  approvalSensitive: boolean;
  timeoutMs: number;
  maxRetries: number;
  /** Validate input; throw on invalid. */
  validateInput(input: Record<string, unknown>): void;
  /** Execute against the owning capability's public command. */
  execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<RuntimeToolResult>;
}

export interface ToolMetadata {
  name: string;
  capability: string;
  description: string;
  effect: ToolEffect;
  requiredAuthority: number;
  approvalSensitive: boolean;
}

// ── Ports ───────────────────────────────────────────────────────────────────

export const TOOL_REGISTRY = Symbol('TOOL_REGISTRY');
export interface IToolRegistry {
  register(tool: RuntimeTool): void;
  get(name: string): RuntimeTool | undefined;
  has(name: string): boolean;
  list(): ToolMetadata[];
  /** Tools an actor at a given authority may see (planner's authorized view). */
  listForAuthority(authority: number): ToolMetadata[];
}

export const WORK_RUN_REPOSITORY = Symbol('WORK_RUN_REPOSITORY');
export interface CreateRunInput {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  hermesAgentId?: string | null;
  workspaceId?: string | null;
  threadId?: string | null;
  request: string;
  contextProvenance: Record<string, unknown>;
}

export const WORK_PLANNER = Symbol('WORK_PLANNER');
export interface PlanRequest {
  tenantId: string;
  actorId: string;
  request: string;
  authorizedTools: ToolMetadata[];
  /** Authorized organizational context summary (from Context Plane). */
  organizationSummary: Record<string, unknown>;
}
export interface IWorkPlanner {
  /** Produce a structured plan. MUST NOT execute tools. */
  plan(req: PlanRequest): Promise<WorkPlan>;
}

export const RUNTIME_GOVERNANCE = Symbol('RUNTIME_GOVERNANCE');
export interface IRuntimeGovernanceEvaluator {
  evaluateStep(params: {
    tenantId: string;
    actorId: string;
    effectiveAuthority: number;
    governanceBlocked: boolean;
    tool: RuntimeTool;
    input: Record<string, unknown>;
  }): Promise<RuntimeGovernanceDecision>;
}

export const WORK_RUNTIME = Symbol('WORK_RUNTIME');
export interface CreateAndRunParams {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  hermesAgentId?: string | null;
  workspaceId?: string | null;
  threadId?: string | null;
  request: string;
  scope?: {
    projectId?: string;
    customerId?: string;
    includeCapabilities?: string[];
  };
}
export interface IWorkRuntime {
  createRun(params: CreateAndRunParams): Promise<WorkRunView>;
  execute(runId: string, tenantId: string): Promise<WorkRunView>;
  resume(runId: string, tenantId: string): Promise<WorkRunView>;
  cancel(runId: string, tenantId: string, reason: string): Promise<WorkRunView>;
  getRun(runId: string, tenantId: string): Promise<WorkRunView | null>;
  getSteps(runId: string, tenantId: string): Promise<WorkRunStepView[]>;
}
