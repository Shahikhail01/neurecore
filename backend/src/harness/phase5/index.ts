/**
 * NeureCore Harness - Phase 5 Coordinator
 *
 * Composition glue for Phase 5 deliverables (§10):
 *   - role/ToR matrices
 *   - tool contract catalog
 *   - policy-decision oracle
 *   - memory and handoff tests
 *   - workflow state oracle
 *   - side-effect ledger
 *   - retry/compensation/concurrency scenarios
 *
 * Implements the §10 Phase 5 exit criteria:
 *   "every production agent role and mutating tool has positive, denial,
 *    failure, and recovery tests; loops and budgets are bounded."
 *
 * The coordinator is the single entry point for Phase 5 checks. It composes
 * the role registry, tool catalog, work-run store, side-effect ledger,
 * compensation ledger, concurrency guard, and policy oracle into one
 * verification surface.
 *
 * SRP: orchestration only; each component owns its own logic.
 * DIP: depends on ports (interfaces); no Prisma / LangChain / external HTTP.
 *
 * Document ID: NC-HARNESS-PHASE5-COORDINATOR-001
 * Version: 1.0
 * Status: PHASE_5_IMPLEMENTED
 */

import { createHash } from 'crypto';
import { UuidSchema, type AuthorizationContext } from '../contracts';
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  type IAgentRoleRegistry,
  type IAgentMemoryStore,
  InMemoryAgentRoleRegistry,
  InMemoryAgentMemoryStore,
  AutonomyBudgetTracker,
  validateHandoff,
  type AgentHandoff,
  type AgentEscalation,
  EscalationReasonSchema,
  type EscalationReason,
  type AgentRole,
  type AgentMemoryRecord,
  type AutonomyUsage,
  type BudgetViolation,
  computeRoleChecksum,
} from './agents';
import {
  type IToolCatalog,
  type ISideEffectLedger,
  InMemorySideEffectLedger,
  InMemoryToolCatalog,
  fingerprintInput,
  decideRetry,
  type ToolContract,
  type ToolParameter,
  type ToolInvocationDecision,
  type ToolFailureClass,
  type ToolFailureRecord,
  type SideEffectEntry,
  type ToolEffect,
  computeToolChecksum,
} from './tools';
import {
  type IWorkRunStore,
  type ICompensationLedger,
  InMemoryWorkRunStore,
  InMemoryCompensationLedger,
  WorkRunConcurrencyGuard,
  checkTimeout,
  validateRunTransition,
  validateStepTransition,
  isTerminalRunStatus,
  isTerminalStepStatus,
  type WorkRunStatus,
  type WorkRunStepStatus,
  type WorkRunRecord,
  type WorkRunStepRecord,
  type CompensationRecord,
  computeWorkflowChecksum,
} from './workflows';
import {
  decidePolicy,
  type IPolicyRegistry,
  InMemoryPolicyRegistry,
  type PolicyInput,
  type PolicyDecision,
} from './policy';

// ============================================================
// COORDINATOR DEPS
// ============================================================

export interface CoordinatorDeps {
  roles: IAgentRoleRegistry;
  tools: IToolCatalog;
  memory: IAgentMemoryStore;
  workRuns: IWorkRunStore;
  sideEffects: ISideEffectLedger;
  compensations: ICompensationLedger;
  policies: IPolicyRegistry;
  /** Optional: a pre-constructed concurrency guard (default: fresh). */
  concurrency?: WorkRunConcurrencyGuard;
  /** Optional: a pre-constructed autonomy tracker (default: fresh). */
  autonomy?: AutonomyBudgetTracker;
}

// ============================================================
// COORDINATOR RESULT TYPES
// ============================================================

export type RunVerificationVerdict =
  | 'VERIFIED'
  | 'BLOCKED_POLICY'
  | 'BLOCKED_BUDGET'
  | 'BLOCKED_WORKFLOW'
  | 'INSUFFICIENT_EVIDENCE';

export interface RunVerification {
  runId: string;
  policyDecision: PolicyDecision;
  budgetViolations: BudgetViolation[];
  workflowChecks: {
    runTransitionOk: boolean;
    stepTransitionsOk: boolean;
    timeoutOk: boolean;
  };
  sideEffects: SideEffectEntry[];
  compensations: CompensationRecord[];
  verdict: RunVerificationVerdict;
  rejectionReasons: string[];
  reportChecksum: string;
}

export interface Phase5CoordinatorReport {
  schemaVersion: string;
  generatedAt: string;
  totalRoles: number;
  totalTools: number;
  totalMutatingTools: number;
  totalWorkRuns: number;
  totalSideEffects: number;
  totalCompensations: number;
  reportChecksum: string;
}

// ============================================================
// COORDINATOR
// ============================================================

export class Phase5Coordinator {
  readonly concurrency: WorkRunConcurrencyGuard;
  readonly autonomy: AutonomyBudgetTracker;
  private readonly escalations: AgentEscalation[] = [];
  private readonly handoffs: AgentHandoff[] = [];
  private readonly failures: ToolFailureRecord[] = [];

  constructor(private readonly deps: CoordinatorDeps) {
    this.concurrency = deps.concurrency ?? new WorkRunConcurrencyGuard();
    this.autonomy = deps.autonomy ?? new AutonomyBudgetTracker(deps.roles);
  }

  // ============================================================
  // REGISTRATION (delegated to the registries; SRP)
  // ============================================================

  registerRole(role: AgentRole, ctx: AuthorizationContext): void {
    this.deps.roles.register(role, ctx);
  }

  registerTool(
    contract: ToolContract,
    parameters: ToolParameter,
    ctx: AuthorizationContext,
  ): void {
    this.deps.tools.register(contract, parameters, ctx);
  }

  registerPolicy(
    policyId: string,
    version: string,
    owner: string,
    description: string,
    ctx: AuthorizationContext,
  ): void {
    this.deps.policies.register(
      {
        policyId,
        version,
        owner,
        description,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      },
      ctx,
    );
  }

  // ============================================================
  // POLICY EVALUATION
  // ============================================================

  evaluatePolicy(input: PolicyInput): PolicyDecision {
    return decidePolicy(input);
  }

  // ============================================================
  // WORK-RUN LIFECYCLE
  // ============================================================

  createWorkRun(
    record: WorkRunRecord,
    ctx: AuthorizationContext,
  ): { record: WorkRunRecord; created: boolean } {
    return this.deps.workRuns.createOrGet(record, ctx);
  }

  transitionWorkRun(
    runId: string,
    next: WorkRunStatus,
    ctx: AuthorizationContext,
  ): { ok: true; record: WorkRunRecord } | { ok: false; reason: string } {
    return this.deps.workRuns.transition(runId, next, ctx);
  }

  transitionStep(
    runId: string,
    stepId: string,
    next: WorkRunStepStatus,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string } {
    return this.deps.workRuns.transitionStep(runId, stepId, next, ctx);
  }

  upsertStep(
    step: WorkRunStepRecord,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string } {
    return this.deps.workRuns.upsertStep(step, ctx);
  }

  // ============================================================
  // MEMORY + HANDOFF
  // ============================================================

  writeMemory(rec: AgentMemoryRecord, ctx: AuthorizationContext): void {
    this.deps.memory.write(rec, ctx);
  }

  readMemory(
    roleId: string,
    tenantId: string,
    ctx: AuthorizationContext,
  ): AgentMemoryRecord[] {
    return this.deps.memory.read(roleId, tenantId, ctx);
  }

  recordHandoff(
    handoff: AgentHandoff,
    fromRole: AgentRole,
    toRole: AgentRole,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string } {
    const v = validateHandoff(handoff, fromRole, toRole, ctx);
    if (!v.ok) return v;
    this.handoffs.push(handoff);
    return { ok: true };
  }

  // ============================================================
  // ESCALATION
  // ============================================================

  escalate(
    roleId: string,
    tenantId: string,
    runId: string,
    reason: EscalationReason,
    detail: string,
  ): AgentEscalation {
    EscalationReasonSchema.parse(reason);
    if (!tenantId) {
      throw new Error('escalate() requires tenantId (§5.2)');
    }
    const rec: AgentEscalation = {
      escalationId: crypto.randomUUID
        ? crypto.randomUUID()
        : UuidSchema.parse('00000000-0000-0000-0000-000000000000'),
      roleId,
      tenantId,
      runId,
      reason,
      detail,
      createdAt: new Date().toISOString(),
      reviewerRole: 'HUMAN_REVIEWER',
    };
    this.escalations.push(rec);
    return rec;
  }

  // ============================================================
  // SIDE-EFFECTS + COMPENSATION + FAILURES
  // ============================================================

  recordSideEffect(
    entry: SideEffectEntry,
    ctx: AuthorizationContext,
  ): { appended: boolean; duplicateOf?: string } {
    const before = this.deps.sideEffects
      .listByRun(entry.runId)
      .find(
        (e) =>
          e.toolId === entry.toolId &&
          e.toolVersion === entry.toolVersion &&
          e.tenantId === entry.tenantId &&
          e.idempotencyKey === entry.idempotencyKey,
      );
    this.deps.sideEffects.append(entry, ctx);
    return before
      ? { appended: false, duplicateOf: before.entryId }
      : { appended: true };
  }

  recordCompensation(rec: CompensationRecord, ctx: AuthorizationContext): void {
    this.deps.compensations.record(rec, ctx);
  }

  recordFailure(rec: ToolFailureRecord): void {
    this.failures.push(rec);
  }

  // ============================================================
  // RETRY DECISION
  // ============================================================

  shouldRetry(
    contract: ToolContract,
    attempt: number,
    failure: ToolFailureClass,
  ): ReturnType<typeof decideRetry> {
    return decideRetry(contract, attempt, failure);
  }

  // ============================================================
  // CONCURRENCY
  // ============================================================

  acquireLock(runId: string, stepId: string, owner: string): boolean {
    return this.concurrency.acquire(runId, stepId, owner);
  }

  releaseLock(runId: string, stepId: string, owner: string): boolean {
    return this.concurrency.release(runId, stepId, owner);
  }

  // ============================================================
  // TIMEOUT
  // ============================================================

  checkTimeout(
    startedAt: Date,
    budgetMs: number,
  ): ReturnType<typeof checkTimeout> {
    return checkTimeout(startedAt, budgetMs);
  }

  // ============================================================
  // END-TO-END VERIFICATION
  // ============================================================

  /**
   * End-to-end verification of a work-run: policy, budget, workflow,
   * side-effects, compensations, and timeout — all in one call. The
   * result is reproducible and checksumed.
   */
  verifyRun(
    runId: string,
    policyInput: PolicyInput,
    ctx: AuthorizationContext,
    options: {
      startedAt: Date;
      timeoutBudgetMs: number;
      observedSteps: number;
      observedToolCalls: number;
      observedCostUsd: number;
    },
  ): RunVerification {
    const role = policyInput.role;

    const policyDecision = this.evaluatePolicy(policyInput);

    const budgetViolations = this.autonomy.check(role, runId, {
      steps: options.observedSteps,
      toolCalls: options.observedToolCalls,
      costUsd: options.observedCostUsd,
      durationMs: Date.now() - options.startedAt.getTime(),
    });

    const runRecord = this.deps.workRuns.get(runId, ctx);
    const runTransitionOk = runRecord
      ? isTerminalRunStatus(runRecord.status)
        ? true
        : validateRunTransition(runRecord.status, runRecord.status).ok
      : false;
    const stepTransitionsOk = runRecord
      ? runRecord.steps.every((s) =>
          isTerminalStepStatus(s.status)
            ? true
            : validateStepTransition(s.status, s.status).ok,
        )
      : false;
    const t = this.checkTimeout(options.startedAt, options.timeoutBudgetMs);
    const timeoutOk = t.kind === 'WITHIN_BUDGET';

    const sideEffects = this.deps.sideEffects.listByRun(runId);
    const compensations = this.deps.compensations.listByRun(runId, ctx);

    let verdict: RunVerificationVerdict = 'VERIFIED';
    const rejectionReasons: string[] = [];

    // Compute all candidates; the highest-priority one wins.
    // Priority: BLOCKED_POLICY > BLOCKED_BUDGET > BLOCKED_WORKFLOW > INSUFFICIENT_EVIDENCE > VERIFIED
    const isBlockedPolicy =
      policyDecision.verdict === 'DENY' ||
      policyDecision.verdict === 'REQUIRE_APPROVAL';
    const hardBudget = budgetViolations.find((v) => v.kind !== 'LONG_HORIZON');
    const isBlockedBudget = Boolean(hardBudget);
    const isBlockedWorkflow = !runTransitionOk || !stepTransitionsOk;
    const isInsufficientEvidence = !runRecord || sideEffects.length === 0;

    if (isBlockedPolicy) {
      verdict = 'BLOCKED_POLICY';
      rejectionReasons.push(...policyDecision.reasons);
    }
    if (isBlockedBudget) {
      if (verdict === 'VERIFIED') verdict = 'BLOCKED_BUDGET';
      rejectionReasons.push(
        `budget: ${hardBudget!.kind} limit=${hardBudget!.limit} observed=${hardBudget!.observed}`,
      );
    }
    if (isBlockedWorkflow) {
      if (verdict === 'VERIFIED') verdict = 'BLOCKED_WORKFLOW';
      rejectionReasons.push(
        'workflow: one or more state transitions are invalid',
      );
    }
    if (!timeoutOk && t.kind === 'TIMED_OUT') {
      // Timeout alone is not a hard block unless the budget is exhausted;
      // surface it in the report and warn.
      rejectionReasons.push(
        `timeout: elapsed=${t.elapsedMs}ms budget=${t.budgetMs}ms`,
      );
    }
    if (isInsufficientEvidence) {
      if (verdict === 'VERIFIED') verdict = 'INSUFFICIENT_EVIDENCE';
      rejectionReasons.push(
        'insufficient evidence: missing run record or zero side effects',
      );
    }

    const reportChecksum = computeVerificationChecksum({
      policyDecision,
      budgetViolations,
      workflowChecks: { runTransitionOk, stepTransitionsOk, timeoutOk },
      sideEffects,
      compensations,
      verdict,
      rejectionReasons,
    });

    return {
      runId,
      policyDecision,
      budgetViolations,
      workflowChecks: { runTransitionOk, stepTransitionsOk, timeoutOk },
      sideEffects,
      compensations,
      verdict,
      rejectionReasons,
      reportChecksum,
    };
  }

  // ============================================================
  // AGGREGATE REPORT
  // ============================================================

  report(ctx: AuthorizationContext): Phase5CoordinatorReport {
    if (!ctx.tenantId) {
      throw new Error('report() requires tenantId (§5.2)');
    }
    const tools = this.deps.tools.list();
    const workRuns = this.deps.workRuns.listByTenant(ctx.tenantId, ctx);
    const sideEffects: SideEffectEntry[] = [];
    for (const r of workRuns) {
      sideEffects.push(...this.deps.sideEffects.listByRun(r.runId));
    }
    const compensations: CompensationRecord[] = [];
    for (const r of workRuns) {
      compensations.push(...this.deps.compensations.listByRun(r.runId, ctx));
    }
    const report: Phase5CoordinatorReport = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalRoles: this.deps.roles.list().length,
      totalTools: tools.length,
      totalMutatingTools: tools.filter((t) => t.effect !== 'READ').length,
      totalWorkRuns: workRuns.length,
      totalSideEffects: sideEffects.length,
      totalCompensations: compensations.length,
      reportChecksum: 'pending',
    };
    const json = JSON.stringify(report);
    report.reportChecksum =
      'sha256:' + createHash('sha256').update(json).digest('hex');
    return report;
  }

  // ============================================================
  // INSPECTION (for tests / dashboards; production should not rely on these)
  // ============================================================

  listEscalations(): AgentEscalation[] {
    return [...this.escalations];
  }

  listHandoffs(): AgentHandoff[] {
    return [...this.handoffs];
  }

  listFailures(): ToolFailureRecord[] {
    return [...this.failures];
  }
}

// ============================================================
// HELPERS
// ============================================================

function canonicalizeV(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => canonicalizeV(v));
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalizeV(obj[k]);
  }
  return sorted;
}

function computeVerificationChecksum(input: {
  policyDecision: PolicyDecision;
  budgetViolations: BudgetViolation[];
  workflowChecks: {
    runTransitionOk: boolean;
    stepTransitionsOk: boolean;
    timeoutOk: boolean;
  };
  sideEffects: SideEffectEntry[];
  compensations: CompensationRecord[];
  verdict: RunVerificationVerdict;
  rejectionReasons: string[];
}): string {
  const obj = canonicalizeV({
    policyDecision: {
      policyId: input.policyDecision.policyId,
      version: input.policyDecision.version,
      verdict: input.policyDecision.verdict,
      reasons: [...input.policyDecision.reasons].sort(),
    },
    budgetViolations: input.budgetViolations.map((v) => ({
      kind: v.kind,
      limit: v.limit,
      observed: v.observed,
    })),
    workflowChecks: input.workflowChecks,
    sideEffects: input.sideEffects.map((s) => ({
      entryId: s.entryId,
      toolId: s.toolId,
      toolVersion: s.toolVersion,
      idempotencyKey: s.idempotencyKey,
    })),
    compensations: input.compensations.map((c) => ({
      compensationId: c.compensationId,
      status: c.status,
    })),
    verdict: input.verdict,
    rejectionReasons: [...input.rejectionReasons].sort(),
  });
  const json = JSON.stringify(obj);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}

// ============================================================
// IN-MEMORY BUNDLE (for tests)
// ============================================================

export function createInMemoryBundle(): {
  roles: IAgentRoleRegistry;
  tools: IToolCatalog;
  memory: IAgentMemoryStore;
  workRuns: IWorkRunStore;
  sideEffects: ISideEffectLedger;
  compensations: ICompensationLedger;
  policies: IPolicyRegistry;
  concurrency: WorkRunConcurrencyGuard;
  autonomy: AutonomyBudgetTracker;
  coordinator: Phase5Coordinator;
} {
  const roles = new InMemoryAgentRoleRegistry();
  const tools = new InMemoryToolCatalog();
  const memory = new InMemoryAgentMemoryStore();
  const workRuns = new InMemoryWorkRunStore();
  const sideEffects = new InMemorySideEffectLedger();
  const compensations = new InMemoryCompensationLedger();
  const policies = new InMemoryPolicyRegistry();
  const concurrency = new WorkRunConcurrencyGuard();
  const autonomy = new AutonomyBudgetTracker(roles);
  const coordinator = new Phase5Coordinator({
    roles,
    tools,
    memory,
    workRuns,
    sideEffects,
    compensations,
    policies,
    concurrency,
    autonomy,
  });
  return {
    roles,
    tools,
    memory,
    workRuns,
    sideEffects,
    compensations,
    policies,
    concurrency,
    autonomy,
    coordinator,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  type IAgentRoleRegistry,
  type IAgentMemoryStore,
  InMemoryAgentRoleRegistry,
  InMemoryAgentMemoryStore,
  AutonomyBudgetTracker,
  validateHandoff,
  type AgentRole,
  type AgentMemoryRecord,
  type AgentHandoff,
  type AgentEscalation,
  type AutonomyUsage,
  type BudgetViolation,
  computeRoleChecksum,
} from './agents';

export {
  type IToolCatalog,
  type ISideEffectLedger,
  InMemorySideEffectLedger,
  InMemoryToolCatalog,
  fingerprintInput,
  decideRetry,
  validateToolParameters,
  type ToolContract,
  type ToolParameter,
  type ToolInvocationDecision,
  type ToolFailureClass,
  type ToolFailureRecord,
  type SideEffectEntry,
  type ToolEffect,
  computeToolChecksum,
} from './tools';

export {
  type IWorkRunStore,
  type ICompensationLedger,
  InMemoryWorkRunStore,
  InMemoryCompensationLedger,
  WorkRunConcurrencyGuard,
  checkTimeout,
  validateRunTransition,
  validateStepTransition,
  isTerminalRunStatus,
  isTerminalStepStatus,
  type WorkRunStatus,
  type WorkRunStepStatus,
  type WorkRunRecord,
  type WorkRunStepRecord,
  type CompensationRecord,
  computeWorkflowChecksum,
} from './workflows';

export {
  decidePolicy,
  type IPolicyRegistry,
  InMemoryPolicyRegistry,
  type PolicyInput,
  type PolicyDecision,
} from './policy';
/* eslint-enable @typescript-eslint/no-unused-vars */

export const PHASE5_VERSION = '1.0.0';
export const PHASE5_COMPATIBILITY_POLICY =
  'strict-v1: additive-deliverable = minor, required-deliverable-removed = major, oracle-composition-changed = major';
