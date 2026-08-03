/**
 * NeureCore Harness - Policy-Decision Oracle (Phase 5)
 *
 * Implements the §10 Phase 5 deliverable:
 *   - policy-decision oracle
 *
 * §9 "Tool-Calling" / "Agent" / "Workflow" rows; §10 Phase 5 exit criteria:
 *   "every production agent role and mutating tool has positive, denial,
 *    failure, and recovery tests"
 *
 * The oracle composes the three Phase 5 sub-deciders (role boundary, tool
 * invocation, workflow state) into a single decision surface that callers
 * can query for a (role, tool, workflow-state) triple. It is intentionally
 * a *pure* function — it never mutates state. State-mutating side effects
 * belong to the role registry, tool catalog, and work-run store.
 *
 * §5.2 invariants:
 *   - "Fail closed for authorization, policy, evidence integrity, and
 *      release verdicts."
 *   - "A harness pass cannot override a product authorization denial."
 *
 * Document ID: NC-HARNESS-PHASE5-POLICY-001
 * Version: 1.0
 * Status: PHASE_5_IMPLEMENTED
 */

import { z } from 'zod';
import { SemverSchema, type AuthorizationContext } from '../../contracts';
import {
  checkRoleBoundary,
  type AgentRole,
  type RoleBoundaryDecision,
} from '../agents';
import {
  decideToolInvocation,
  type ToolContract,
  type ToolParameter,
  type ToolInvocationDecision,
} from '../tools';
import {
  validateRunTransition,
  validateStepTransition,
  type WorkRunStatus,
  type WorkRunStepStatus,
} from '../workflows';

// ============================================================
// VERSION
// ============================================================

export const POLICY_ORACLE_VERSION = '1.0.0';
export const POLICY_ORACLE_COMPATIBILITY_POLICY =
  'strict-v1: additive-decision-kind = minor, required-decision-kind-removed = major';

// ============================================================
// POLICY INPUT
// ============================================================

export const PolicyInputSchema = z
  .object({
    policyId: z.string().min(1),
    version: SemverSchema,
    role: z.custom<AgentRole>(),
    tool: z.custom<ToolContract>(),
    toolParameters: z.custom<ToolParameter>(),
    effectiveAuthority: z.number().int().min(0).max(100),
    governanceBlocked: z.boolean(),
    input: z.record(z.string(), z.unknown()),
    /** Optional: a workflow state transition to check in addition. */
    workflowState: z
      .object({
        from: z.custom<WorkRunStatus>(),
        to: z.custom<WorkRunStatus>(),
      })
      .optional(),
    stepState: z
      .object({
        from: z.custom<WorkRunStepStatus>(),
        to: z.custom<WorkRunStepStatus>(),
      })
      .optional(),
  })
  .strict();
export type PolicyInput = z.infer<typeof PolicyInputSchema>;

// ============================================================
// POLICY DECISION
// ============================================================

export const PolicyDecisionSchema = z
  .object({
    policyId: z.string().min(1),
    version: SemverSchema,
    roleDecision: z.custom<RoleBoundaryDecision>(),
    toolDecision: z.custom<ToolInvocationDecision>(),
    workflowDecision: z
      .object({ ok: z.boolean(), reason: z.string().optional() })
      .optional(),
    stepDecision: z
      .object({ ok: z.boolean(), reason: z.string().optional() })
      .optional(),
    /**
     * Final verdict: ALLOW iff every layer says ALLOW; REQUIRE_APPROVAL
     * iff any layer requires approval; otherwise DENY.
     */
    verdict: z.enum(['ALLOW', 'DENY', 'REQUIRE_APPROVAL']),
    reasons: z.array(z.string().min(1)),
    decidedAt: z.string().datetime(),
  })
  .strict();
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

// ============================================================
// POLICY ORACLE (pure function)
// ============================================================

/**
 * Evaluate a policy input against the role boundary, tool invocation, and
 * (optionally) workflow state machines. The decision is fail-closed: any
 * DENY or error short-circuits to DENY.
 */
export function decidePolicy(input: PolicyInput): PolicyDecision {
  PolicyInputSchema.parse(input);

  const reasons: string[] = [];

  // ── Role boundary ──────────────────────────────────────────────
  const roleDecision = checkRoleBoundary(
    input.role,
    input.tool.capability,
    input.tool.name,
    input.tool.effect,
  );
  if (roleDecision.kind === 'DENY') {
    reasons.push(`role: ${roleDecision.reason}`);
  }

  // ── Tool invocation ────────────────────────────────────────────
  const toolDecision = decideToolInvocation({
    contract: input.tool,
    effectiveAuthority: input.effectiveAuthority,
    governanceBlocked: input.governanceBlocked,
    input: input.input,
    parameters: input.toolParameters,
  });
  if (toolDecision.kind === 'DENY') {
    reasons.push(`tool: ${toolDecision.reason}`);
  }

  // ── Workflow state machine (optional) ─────────────────────────
  let workflowDecision: { ok: boolean; reason?: string } | undefined;
  if (input.workflowState) {
    const t = validateRunTransition(
      input.workflowState.from,
      input.workflowState.to,
    );
    workflowDecision = t.ok ? { ok: true } : { ok: false, reason: t.reason };
    if (!t.ok) reasons.push(`workflow: ${t.reason}`);
  }

  // ── Step state machine (optional) ─────────────────────────────
  let stepDecision: { ok: boolean; reason?: string } | undefined;
  if (input.stepState) {
    const t = validateStepTransition(input.stepState.from, input.stepState.to);
    stepDecision = t.ok ? { ok: true } : { ok: false, reason: t.reason };
    if (!t.ok) reasons.push(`step: ${t.reason}`);
  }

  // ── Verdict composition ────────────────────────────────────────
  let verdict: PolicyDecision['verdict'] = 'ALLOW';

  const anyDeny =
    roleDecision.kind === 'DENY' ||
    toolDecision.kind === 'DENY' ||
    (workflowDecision && !workflowDecision.ok) ||
    (stepDecision && !stepDecision.ok);

  const anyRequireApproval =
    roleDecision.kind === 'REQUIRE_APPROVAL' ||
    toolDecision.kind === 'REQUIRE_APPROVAL';

  if (anyDeny) {
    verdict = 'DENY';
  } else if (anyRequireApproval) {
    verdict = 'REQUIRE_APPROVAL';
  }

  return {
    policyId: input.policyId,
    version: input.version,
    roleDecision,
    toolDecision,
    workflowDecision,
    stepDecision,
    verdict,
    reasons,
    decidedAt: new Date().toISOString(),
  };
}

// ============================================================
// POLICY REGISTRY (versioned; for promotion / rollback)
// ============================================================

export const PolicyVersionRecordSchema = z
  .object({
    policyId: z.string().min(1),
    version: SemverSchema,
    owner: z.string().min(1),
    description: z.string().min(1),
    createdAt: z.string().datetime(),
    status: z.enum(['ACTIVE', 'DEPRECATED', 'RETIRED']),
  })
  .strict();
export type PolicyVersionRecord = z.infer<typeof PolicyVersionRecordSchema>;

export interface IPolicyRegistry {
  register(rec: PolicyVersionRecord, ctx: AuthorizationContext): void;
  getActive(policyId: string): PolicyVersionRecord | null;
  list(): PolicyVersionRecord[];
}

export class InMemoryPolicyRegistry implements IPolicyRegistry {
  private readonly records = new Map<string, PolicyVersionRecord>(); // key: policyId@version
  constructor() {}

  private k(policyId: string, version: string): string {
    return `${policyId}@${version}`;
  }

  register(rec: PolicyVersionRecord, ctx: AuthorizationContext): void {
    PolicyVersionRecordSchema.parse(rec);
    if (!ctx.tenantId) {
      throw new Error('register() requires tenantId (§5.2)');
    }
    if (this.records.has(this.k(rec.policyId, rec.version))) {
      throw new Error(
        `Policy ${rec.policyId}@${rec.version} already registered`,
      );
    }
    this.records.set(this.k(rec.policyId, rec.version), rec);
  }

  getActive(policyId: string): PolicyVersionRecord | null {
    const candidates = [...this.records.values()]
      .filter((r) => r.policyId === policyId && r.status === 'ACTIVE')
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    return candidates[0] ?? null;
  }

  list(): PolicyVersionRecord[] {
    return [...this.records.values()];
  }
}
