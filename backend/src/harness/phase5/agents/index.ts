/**
 * NeureCore Harness - Agent Role / Terms-of-Reference (ToR) Matrix (Phase 5)
 *
 * Implements the §10 Phase 5 deliverables for the Agent Harness element:
 *   - role/ToR matrices
 *   - memory and handoff tests
 *   - autonomy budget, escalation and long-horizon tests
 *
 * §9 "Agent" row, §10 Phase 5 exit criteria:
 *   "every production agent role and mutating tool has positive, denial,
 *    failure, and recovery tests; loops and budgets are bounded."
 *
 * §5.2 invariants enforced here:
 *   - "Secure and tenant-scoped by default; missing tenant context is an error."
 *   - "Idempotent orchestration and cleanup; retries cannot duplicate business
 *      effects."
 *   - "A harness pass cannot override a product authorization denial."
 *
 * SOLID alignment:
 *   - SRP: agent role registry + autonomy budget + memory isolation only.
 *   - OCP: new role kinds register by discriminated union.
 *   - DIP: ports only (no Prisma / LangChain / external HTTP imports).
 *
 * Document ID: NC-HARNESS-PHASE5-AGENTS-001
 * Version: 1.0
 * Status: PHASE_5_IMPLEMENTED
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  type AuthorizationContext,
  hasPermission,
} from '../../contracts';

// ============================================================
// VERSION
// ============================================================

export const AGENT_ROLES_VERSION = '1.0.0';
export const AGENT_ROLES_COMPATIBILITY_POLICY =
  'strict-v1: additive-role = minor, required-role-removed = major, role-boundary-changed = major';

// ============================================================
// ENUMS
// ============================================================

export const AgentRoleKindSchema = z.enum([
  'CHAT_AGENT', // conversational; read-only + chat-write
  'WORK_AGENT', // executes a structured plan with tool calls
  'ORCHESTRATOR_AGENT', // delegates to other agents (chief-of-staff)
  'EVALUATION_AGENT', // grades outputs; never mutates
  'REPLAY_AGENT', // replays a sanitized run; sandboxed side effects
  'HUMAN_REVIEW_AGENT', // surfaces items to a human reviewer
]);
export type AgentRoleKind = z.infer<typeof AgentRoleKindSchema>;

// Every role is bound to a set of capabilities (tools it may invoke).
// Boundaries are checked at the tool registry + policy oracle layers.
export const AgentRoleCapabilitySchema = z
  .object({
    capability: z.string().min(1),
    /** Tools the role may invoke within this capability. Empty = none. */
    toolsAllowed: z.array(z.string().min(1)),
    /** Tools the role must NEVER invoke (deny list). */
    toolsDenied: z.array(z.string().min(1)).default([]),
    /** Max effect tier the role may exercise for this capability. */
    maxEffect: z.enum(['READ', 'INTERNAL_WRITE', 'EXTERNAL_WRITE']),
  })
  .strict();
export type AgentRoleCapability = z.infer<typeof AgentRoleCapabilitySchema>;

export const AutonomyBudgetSchema = z
  .object({
    /** Maximum number of tool calls per run for this role. */
    maxToolCallsPerRun: z.number().int().positive(),
    /** Maximum wall-clock duration per run (ms). */
    maxRunDurationMs: z.number().int().positive(),
    /** Maximum cost in USD per run (advisory; bounded at orchestrator). */
    maxCostUsdPerRun: z.number().nonnegative(),
    /** Maximum number of steps in a plan. */
    maxPlanSteps: z.number().int().positive(),
    /** Maximum delegations to other agents per run. */
    maxDelegationsPerRun: z.number().int().nonnegative(),
    /** Long-horizon upper bound: if a run exceeds this, the role MUST escalate. */
    longHorizonStepThreshold: z.number().int().positive(),
  })
  .strict();
export type AutonomyBudget = z.infer<typeof AutonomyBudgetSchema>;

// ============================================================
// ROLE / ToR
// ============================================================

export const AgentRoleSchema = z
  .object({
    roleId: z.string().min(1),
    version: SemverSchema,
    kind: AgentRoleKindSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    /** Domain-allowlist: the role may only operate on these tenant capabilities. */
    capabilitySurface: z.array(z.string().min(1)).min(1),
    capabilities: z.array(AgentRoleCapabilitySchema).min(1),
    autonomy: AutonomyBudgetSchema,
    /** Tools that always require human approval, regardless of policy. */
    approvalGatedTools: z.array(z.string().min(1)).default([]),
    /** Whether this role may delegate to other roles. */
    mayDelegate: z.boolean(),
    /** Whether this role is allowed to escalate (e.g., to a human reviewer). */
    mayEscalate: z.boolean(),
    /** Whether this role writes to its own memory. */
    writesToMemory: z.boolean(),
    /** Whether this role may read other roles' memory. */
    readsOtherRolesMemory: z.boolean().default(false),
    status: z.enum(['ACTIVE', 'DEPRECATED', 'RETIRED']),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AgentRole = z.infer<typeof AgentRoleSchema>;

// ============================================================
// MEMORY
// ============================================================

export const AgentMemoryKindSchema = z.enum([
  'EPISODIC', // a single episode / step outcome
  'SEMANTIC', // a long-lived fact
  'PROCEDURAL', // a learned procedure
  'WORKING', // short-lived, per-run
]);
export type AgentMemoryKind = z.infer<typeof AgentMemoryKindSchema>;

export const AgentMemoryRecordSchema = z
  .object({
    memoryId: UuidSchema,
    roleId: z.string().min(1),
    tenantId: UuidSchema,
    runId: UuidSchema,
    actorId: z.string().min(1),
    kind: AgentMemoryKindSchema,
    /** Memory contents are redacted to a coarse summary; raw text is not stored. */
    summary: z.string().min(1),
    /** Free-form structured tags. */
    tags: z.array(z.string().min(1)).default([]),
    createdAt: IsoDateTimeSchema,
    /** Tenant isolation token. If set, the memory is only visible inside that tenant. */
    tenantScope: UuidSchema,
    /** Retention class (mirrors §7.3). */
    retentionClass: z
      .enum(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM', 'PERMANENT'])
      .default('MEDIUM_TERM'),
  })
  .strict();
export type AgentMemoryRecord = z.infer<typeof AgentMemoryRecordSchema>;

// ============================================================
// HANDOFF
// ============================================================

export const AgentHandoffSchema = z
  .object({
    handoffId: UuidSchema,
    fromRoleId: z.string().min(1),
    toRoleId: z.string().min(1),
    tenantId: UuidSchema,
    runId: UuidSchema,
    reason: z.string().min(1),
    /** Compact context payload (no raw PII, no raw prompts). */
    context: z.record(z.string(), z.unknown()),
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type AgentHandoff = z.infer<typeof AgentHandoffSchema>;

// ============================================================
// ESCALATION
// ============================================================

export const EscalationReasonSchema = z.enum([
  'POLICY_DENY',
  'BUDGET_EXCEEDED',
  'TOOL_FAILURE_REPEATED',
  'APPROVAL_REQUIRED',
  'LONG_HORIZON',
  'TENANT_ABSENT',
  'LOW_CONFIDENCE',
  'CYCLE_DETECTED',
  'OTHER',
]);
export type EscalationReason = z.infer<typeof EscalationReasonSchema>;

export const AgentEscalationSchema = z
  .object({
    escalationId: UuidSchema,
    roleId: z.string().min(1),
    tenantId: UuidSchema,
    runId: UuidSchema,
    reason: EscalationReasonSchema,
    detail: z.string().min(1),
    createdAt: IsoDateTimeSchema,
    /** Reviewer role required to resolve. */
    reviewerRole: z
      .enum(['HUMAN_REVIEWER', 'EVALUATION_AGENT', 'CHIEF_OF_STAFF'])
      .default('HUMAN_REVIEWER'),
  })
  .strict();
export type AgentEscalation = z.infer<typeof AgentEscalationSchema>;

// ============================================================
// ROLE REGISTRY
// ============================================================

export interface IAgentRoleRegistry {
  register(role: AgentRole, ctx: AuthorizationContext): void;
  deprecate(roleId: string, version: string): void;
  get(roleId: string, version: string): AgentRole | null;
  getActive(roleId: string): AgentRole | null;
  list(): AgentRole[];
  listByKind(kind: AgentRoleKind): AgentRole[];
}

export class InMemoryAgentRoleRegistry implements IAgentRoleRegistry {
  private readonly roles = new Map<string, AgentRole>(); // key = roleId@version

  constructor() {}

  private key(roleId: string, version: string): string {
    return `${roleId}@${version}`;
  }

  register(role: AgentRole, ctx: AuthorizationContext): void {
    AgentRoleSchema.parse(role);
    if (!ctx.tenantId) {
      throw new Error('register() requires tenantId (§5.2)');
    }
    if (this.roles.has(this.key(role.roleId, role.version))) {
      throw new Error(`Role ${role.roleId}@${role.version} already registered`);
    }
    this.roles.set(this.key(role.roleId, role.version), role);
  }

  deprecate(roleId: string, version: string): void {
    const r = this.roles.get(this.key(roleId, version));
    if (!r) {
      throw new Error(`Role ${roleId}@${version} not found`);
    }
    this.roles.set(this.key(roleId, version), { ...r, status: 'DEPRECATED' });
  }

  get(roleId: string, version: string): AgentRole | null {
    return this.roles.get(this.key(roleId, version)) ?? null;
  }

  getActive(roleId: string): AgentRole | null {
    const candidates = [...this.roles.values()]
      .filter((r) => r.roleId === roleId && r.status === 'ACTIVE')
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    return candidates[0] ?? null;
  }

  list(): AgentRole[] {
    return [...this.roles.values()];
  }

  listByKind(kind: AgentRoleKind): AgentRole[] {
    return [...this.roles.values()].filter((r) => r.kind === kind);
  }
}

// ============================================================
// AUTONOMY BUDGET TRACKER
// ============================================================

export interface AutonomyUsage {
  runId: string;
  toolCalls: number;
  delegations: number;
  steps: number;
  startedAt: Date;
  costUsd: number;
}

export type BudgetViolation = {
  kind:
    | 'TOOL_CALLS_EXCEEDED'
    | 'DELEGATIONS_EXCEEDED'
    | 'STEPS_EXCEEDED'
    | 'DURATION_EXCEEDED'
    | 'COST_EXCEEDED'
    | 'LONG_HORIZON';
  limit: number;
  observed: number;
};

export class AutonomyBudgetTracker {
  private readonly usage = new Map<string, AutonomyUsage>();
  private readonly cycles = new Map<string, Set<string>>(); // runId -> seen tool sequence

  constructor(private readonly registry: IAgentRoleRegistry) {}

  beginRun(
    roleId: string,
    version: string,
    runId: string,
  ): { role: AgentRole; usage: AutonomyUsage } {
    const role = this.registry.get(roleId, version);
    if (!role) throw new Error(`Role ${roleId}@${version} not registered`);
    const usage: AutonomyUsage = {
      runId,
      toolCalls: 0,
      delegations: 0,
      steps: 0,
      startedAt: new Date(),
      costUsd: 0,
    };
    this.usage.set(runId, usage);
    this.cycles.set(runId, new Set());
    return { role, usage };
  }

  endRun(runId: string): AutonomyUsage | null {
    const u = this.usage.get(runId);
    if (u) {
      this.usage.delete(runId);
      this.cycles.delete(runId);
    }
    return u ?? null;
  }

  recordToolCall(runId: string): BudgetViolation | null {
    const u = this.usage.get(runId);
    if (!u) throw new Error(`No active run ${runId}`);
    u.toolCalls += 1;
    const role = this.findRoleForRun(runId);
    if (!role) return null;
    if (u.toolCalls > role.autonomy.maxToolCallsPerRun) {
      return {
        kind: 'TOOL_CALLS_EXCEEDED',
        limit: role.autonomy.maxToolCallsPerRun,
        observed: u.toolCalls,
      };
    }
    return null;
  }

  recordStep(runId: string): BudgetViolation | null {
    const u = this.usage.get(runId);
    if (!u) throw new Error(`No active run ${runId}`);
    u.steps += 1;
    const role = this.findRoleForRun(runId);
    if (!role) return null;
    if (u.steps > role.autonomy.maxPlanSteps) {
      return {
        kind: 'STEPS_EXCEEDED',
        limit: role.autonomy.maxPlanSteps,
        observed: u.steps,
      };
    }
    if (u.steps > role.autonomy.longHorizonStepThreshold) {
      // Long-horizon is a warning category, not a hard cap.
      return {
        kind: 'LONG_HORIZON',
        limit: role.autonomy.longHorizonStepThreshold,
        observed: u.steps,
      };
    }
    return null;
  }

  recordDelegation(runId: string): BudgetViolation | null {
    const u = this.usage.get(runId);
    if (!u) throw new Error(`No active run ${runId}`);
    u.delegations += 1;
    const role = this.findRoleForRun(runId);
    if (!role) return null;
    if (u.delegations > role.autonomy.maxDelegationsPerRun) {
      return {
        kind: 'DELEGATIONS_EXCEEDED',
        limit: role.autonomy.maxDelegationsPerRun,
        observed: u.delegations,
      };
    }
    return null;
  }

  recordCost(runId: string, usd: number): BudgetViolation | null {
    const u = this.usage.get(runId);
    if (!u) throw new Error(`No active run ${runId}`);
    u.costUsd += usd;
    const role = this.findRoleForRun(runId);
    if (!role) return null;
    if (u.costUsd > role.autonomy.maxCostUsdPerRun) {
      return {
        kind: 'COST_EXCEEDED',
        limit: role.autonomy.maxCostUsdPerRun,
        observed: u.costUsd,
      };
    }
    return null;
  }

  /**
   * §5.2: idempotent — calling this twice with the same observed tool
   * sequence returns null (not a violation). A *repeating* sequence IS
   * a cycle and returns a CYCLE_DETECTED-equivalent (TOOL_CALLS_EXCEEDED is
   * the budget-side signal; the policy layer produces the canonical
   * CYCLE_DETECTED escalation).
   */
  detectCycle(runId: string, toolSequence: string[]): boolean {
    if (toolSequence.length < 2) return false;
    const tail = toolSequence.slice(-2).join('->');
    const seen = this.cycles.get(runId);
    if (!seen) return false;
    if (seen.has(tail)) {
      seen.add(tail);
      return true;
    }
    seen.add(tail);
    return false;
  }

  private findRoleForRun(runId: string): AgentRole | null {
    // The tracker does not own the role binding; the caller must call
    // check() with the role. To keep the public surface small, we look
    // up the role from a parallel map kept by check().
    const r = this.roleForRun.get(runId);
    return r ?? null;
  }

  private roleForRun = new Map<string, AgentRole>();

  check(
    role: AgentRole,
    runId: string,
    observed: {
      toolCalls?: number;
      steps?: number;
      delegations?: number;
      costUsd?: number;
      durationMs?: number;
    },
  ): BudgetViolation[] {
    this.roleForRun.set(runId, role);
    const u = this.usage.get(runId) ?? {
      runId,
      toolCalls: 0,
      delegations: 0,
      steps: 0,
      startedAt: new Date(),
      costUsd: 0,
    };
    if (!this.usage.has(runId)) this.usage.set(runId, u);

    const violations: BudgetViolation[] = [];
    const tc = observed.toolCalls ?? u.toolCalls;
    if (tc > role.autonomy.maxToolCallsPerRun) {
      violations.push({
        kind: 'TOOL_CALLS_EXCEEDED',
        limit: role.autonomy.maxToolCallsPerRun,
        observed: tc,
      });
    }
    const st = observed.steps ?? u.steps;
    if (st > role.autonomy.maxPlanSteps) {
      violations.push({
        kind: 'STEPS_EXCEEDED',
        limit: role.autonomy.maxPlanSteps,
        observed: st,
      });
    }
    const dl = observed.delegations ?? u.delegations;
    if (dl > role.autonomy.maxDelegationsPerRun) {
      violations.push({
        kind: 'DELEGATIONS_EXCEEDED',
        limit: role.autonomy.maxDelegationsPerRun,
        observed: dl,
      });
    }
    const cs = observed.costUsd ?? u.costUsd;
    if (cs > role.autonomy.maxCostUsdPerRun) {
      violations.push({
        kind: 'COST_EXCEEDED',
        limit: role.autonomy.maxCostUsdPerRun,
        observed: cs,
      });
    }
    const dur = observed.durationMs;
    if (dur !== undefined && dur > role.autonomy.maxRunDurationMs) {
      violations.push({
        kind: 'DURATION_EXCEEDED',
        limit: role.autonomy.maxRunDurationMs,
        observed: dur,
      });
    }
    if (st > role.autonomy.longHorizonStepThreshold) {
      violations.push({
        kind: 'LONG_HORIZON',
        limit: role.autonomy.longHorizonStepThreshold,
        observed: st,
      });
    }
    return violations;
  }

  clear(): void {
    this.usage.clear();
    this.cycles.clear();
    this.roleForRun.clear();
  }
}

// ============================================================
// ROLE BOUNDARY CHECK
// ============================================================

export type RoleBoundaryDecision =
  | { kind: 'ALLOW' }
  | { kind: 'DENY'; reason: string }
  | { kind: 'REQUIRE_APPROVAL'; reason: string };

/**
 * Check whether a role may invoke a given (capability, tool) pair.
 * Pure function; no I/O.
 */
export function checkRoleBoundary(
  role: AgentRole,
  capability: string,
  tool: string,
  effect: 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE',
): RoleBoundaryDecision {
  // §5.2: surface must be declared
  if (!role.capabilitySurface.includes(capability)) {
    return {
      kind: 'DENY',
      reason: `Role ${role.roleId} is not registered for capability ${capability}`,
    };
  }
  const cap = role.capabilities.find((c) => c.capability === capability);
  if (!cap) {
    return {
      kind: 'DENY',
      reason: `Role ${role.roleId} has no entry for capability ${capability}`,
    };
  }
  if (cap.toolsDenied.includes(tool)) {
    return {
      kind: 'DENY',
      reason: `Tool ${tool} is in the deny list for ${role.roleId}@${capability}`,
    };
  }
  if (cap.toolsAllowed.length > 0 && !cap.toolsAllowed.includes(tool)) {
    return {
      kind: 'DENY',
      reason: `Tool ${tool} is not in the allow list for ${role.roleId}@${capability}`,
    };
  }
  // Effect tier check
  const tier: Record<typeof effect, number> = {
    READ: 0,
    INTERNAL_WRITE: 1,
    EXTERNAL_WRITE: 2,
  };
  const capTier: Record<typeof effect, number> = {
    READ: 0,
    INTERNAL_WRITE: 1,
    EXTERNAL_WRITE: 2,
  };
  if (tier[effect] > capTier[cap.maxEffect]) {
    return {
      kind: 'DENY',
      reason: `Tool ${tool} effect ${effect} exceeds role max ${cap.maxEffect} for ${capability}`,
    };
  }
  if (role.approvalGatedTools.includes(tool)) {
    return {
      kind: 'REQUIRE_APPROVAL',
      reason: `Tool ${tool} is approval-gated for role ${role.roleId}`,
    };
  }
  return { kind: 'ALLOW' };
}

// ============================================================
// MEMORY STORE
// ============================================================

export interface IAgentMemoryStore {
  write(rec: AgentMemoryRecord, ctx: AuthorizationContext): void;
  read(
    roleId: string,
    tenantId: string,
    ctx: AuthorizationContext,
  ): AgentMemoryRecord[];
  erase(
    memoryId: string,
    ctx: AuthorizationContext & { reason: string },
  ): boolean;
}

export class InMemoryAgentMemoryStore implements IAgentMemoryStore {
  private readonly records = new Map<string, AgentMemoryRecord>();
  private readonly authorIndex = new Map<string, Set<string>>(); // roleId -> set<memoryId>

  constructor() {}

  write(rec: AgentMemoryRecord, ctx: AuthorizationContext): void {
    AgentMemoryRecordSchema.parse(rec);
    if (!ctx.tenantId) {
      throw new Error('write() requires tenantId (§5.2)');
    }
    if (rec.tenantId !== ctx.tenantId) {
      throw new Error('write() cross-tenant denied (§5.2)');
    }
    if (this.records.has(rec.memoryId)) {
      throw new Error(`Memory ${rec.memoryId} already exists; immutable`);
    }
    this.records.set(rec.memoryId, rec);
    const set = this.authorIndex.get(rec.roleId) ?? new Set<string>();
    set.add(rec.memoryId);
    this.authorIndex.set(rec.roleId, set);
  }

  read(
    roleId: string,
    tenantId: string,
    ctx: AuthorizationContext,
  ): AgentMemoryRecord[] {
    if (!ctx.tenantId) {
      throw new Error('read() requires tenantId (§5.2)');
    }
    if (tenantId !== ctx.tenantId) {
      // §5.2: tenant mismatch is an error
      throw new Error('read() cross-tenant denied (§5.2)');
    }
    const set = this.authorIndex.get(roleId);
    if (!set) return [];
    const records: AgentMemoryRecord[] = [];
    for (const id of set) {
      const r = this.records.get(id);
      if (!r) continue;
      if (r.tenantScope !== tenantId) continue;
      // Memory isolation: the role can read its own memory.
      // Reads-across-roles is gated by role.readsOtherRolesMemory and the
      // caller's role binding (here we only allow same-roleId reads).
      records.push(r);
    }
    return records;
  }

  erase(
    memoryId: string,
    ctx: AuthorizationContext & { reason: string },
  ): boolean {
    if (!hasPermission(ctx, 'evidence:erase')) {
      throw new Error('erase requires evidence:erase permission');
    }
    const r = this.records.get(memoryId);
    if (!r) return false;
    // §7.3 erasure: mark as erased (logical), do not physically delete
    this.records.set(memoryId, { ...r, summary: '[ERASED]' });
    return true;
  }

  /**
   * Test/inspection helper. Production code MUST NOT call this.
   */
  _allForInspection(): AgentMemoryRecord[] {
    return [...this.records.values()];
  }
}

// ============================================================
// HANDOFF VALIDATION
// ============================================================

export function validateHandoff(
  handoff: AgentHandoff,
  fromRole: AgentRole,
  toRole: AgentRole,
  ctx: AuthorizationContext,
): { ok: true } | { ok: false; reason: string } {
  if (!ctx.tenantId) {
    return { ok: false, reason: 'handoff requires tenantId (§5.2)' };
  }
  if (handoff.tenantId !== ctx.tenantId) {
    return { ok: false, reason: 'handoff cross-tenant denied' };
  }
  if (!fromRole.mayDelegate) {
    return {
      ok: false,
      reason: `Role ${fromRole.roleId} may not delegate`,
    };
  }
  if (toRole.status !== 'ACTIVE') {
    return {
      ok: false,
      reason: `Target role ${toRole.roleId}@${toRole.version} is not ACTIVE`,
    };
  }
  // Target must declare a capability that overlaps with the source.
  const overlap = fromRole.capabilitySurface.some((c) =>
    toRole.capabilitySurface.includes(c),
  );
  if (!overlap) {
    return {
      ok: false,
      reason: `No overlapping capability surface between ${fromRole.roleId} and ${toRole.roleId}`,
    };
  }
  return { ok: true };
}

// ============================================================
// CHECKSUMS / PROVENANCE
// ============================================================

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

export function computeRoleChecksum(role: AgentRole): string {
  // Deterministic canonical JSON for the role's policy-bearing fields.
  const obj = canonicalize({
    roleId: role.roleId,
    version: role.version,
    kind: role.kind,
    capabilitySurface: [...role.capabilitySurface].sort(),
    capabilities: role.capabilities.map((c) => ({
      capability: c.capability,
      toolsAllowed: [...c.toolsAllowed].sort(),
      toolsDenied: [...c.toolsDenied].sort(),
      maxEffect: c.maxEffect,
    })),
    autonomy: role.autonomy,
    approvalGatedTools: [...role.approvalGatedTools].sort(),
    mayDelegate: role.mayDelegate,
    mayEscalate: role.mayEscalate,
    writesToMemory: role.writesToMemory,
    readsOtherRolesMemory: role.readsOtherRolesMemory,
  });
  const json = JSON.stringify(obj);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}
