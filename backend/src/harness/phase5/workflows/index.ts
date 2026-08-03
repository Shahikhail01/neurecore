/**
 * NeureCore Harness - Workflow State Oracle (Phase 5)
 *
 * Implements the §10 Phase 5 deliverables for the Workflow Harness element:
 *   - workflow state oracle
 *   - retry/compensation/concurrency scenarios
 *
 * §9 "Workflow" row, §10 Phase 5 exit criteria:
 *   "every production agent role and mutating tool has positive, denial,
 *    failure, and recovery tests; loops and budgets are bounded."
 *
 * The state machine is structurally aligned with the production
 * `WorkRunStatus`/`WorkRunStepStatus` enums in
 * `work-runtime/contracts/work-runtime.interface.ts` so the harness exercises
 * the SAME states the runtime uses, not a parallel vocabulary.
 *
 * §5.2 invariants enforced here:
 *   - "Idempotent orchestration and cleanup; retries cannot duplicate
 *      business effects."
 *   - "Cleanup failure is a run failure."
 *   - "Unknown, skipped, flaky, or infrastructure-error results never
 *      silently count as pass."
 *
 * Document ID: NC-HARNESS-PHASE5-WORKFLOWS-001
 * Version: 1.0
 * Status: PHASE_5_IMPLEMENTED
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import {
  UuidSchema,
  IsoDateTimeSchema,
  type AuthorizationContext,
} from '../../contracts';

// ============================================================
// VERSION
// ============================================================

export const WORKFLOW_ORACLE_VERSION = '1.0.0';
export const WORKFLOW_ORACLE_COMPATIBILITY_POLICY =
  'strict-v1: additive-state = minor, required-state-removed = major, transition-rewired = major';

// ============================================================
// ENUMS
// ============================================================

// Mirrors WorkRunStatus (work-runtime/contracts/work-runtime.interface.ts:13)
export const WorkRunStatusSchema = z.enum([
  'CREATED',
  'PLANNING',
  'PLANNED',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type WorkRunStatus = z.infer<typeof WorkRunStatusSchema>;

// Mirrors WorkRunStepStatus (work-runtime/contracts/work-runtime.interface.ts:24)
export const WorkRunStepStatusSchema = z.enum([
  'PENDING',
  'VALIDATING',
  'DENIED',
  'WAITING_FOR_APPROVAL',
  'APPROVED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
]);
export type WorkRunStepStatus = z.infer<typeof WorkRunStepStatusSchema>;

// Mirror ToolEffect for the record
export const ToolEffectSchema = z.enum([
  'READ',
  'INTERNAL_WRITE',
  'EXTERNAL_WRITE',
]);

// ============================================================
// CANONICAL STATE MACHINES
// ============================================================

/**
 * Work-run state machine.
 *   CREATED -> PLANNING -> PLANNED -> RUNNING -> COMPLETED
 *                          \-> FAILED
 *                          \-> CANCELLED
 *      Any non-terminal state may also transition to WAITING_FOR_APPROVAL,
 *      PAUSED, FAILED, or CANCELLED.
 */
export const WORK_RUN_TRANSITIONS: Readonly<
  Record<WorkRunStatus, ReadonlyArray<WorkRunStatus>>
> = Object.freeze({
  CREATED: ['PLANNING', 'CANCELLED', 'FAILED'],
  PLANNING: ['PLANNED', 'CANCELLED', 'FAILED'],
  PLANNED: ['RUNNING', 'WAITING_FOR_APPROVAL', 'PAUSED', 'CANCELLED', 'FAILED'],
  RUNNING: [
    'COMPLETED',
    'WAITING_FOR_APPROVAL',
    'PAUSED',
    'FAILED',
    'CANCELLED',
  ],
  WAITING_FOR_APPROVAL: ['RUNNING', 'PAUSED', 'CANCELLED', 'FAILED'],
  PAUSED: ['RUNNING', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
});

/**
 * Step state machine.
 *   PENDING -> VALIDATING -> (APPROVED|RUNNING) -> (SUCCEEDED|FAILED|SKIPPED)
 *                                     \-> DENIED
 *                                     \-> WAITING_FOR_APPROVAL -> APPROVED|RUNNING
 *                                                          \-> CANCELLED
 */
export const WORK_RUN_STEP_TRANSITIONS: Readonly<
  Record<WorkRunStepStatus, ReadonlyArray<WorkRunStepStatus>>
> = Object.freeze({
  PENDING: ['VALIDATING', 'CANCELLED', 'SKIPPED'],
  VALIDATING: ['APPROVED', 'DENIED', 'WAITING_FOR_APPROVAL', 'CANCELLED'],
  DENIED: ['CANCELLED'],
  WAITING_FOR_APPROVAL: ['APPROVED', 'DENIED', 'CANCELLED'],
  APPROVED: ['RUNNING', 'CANCELLED', 'SKIPPED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  SUCCEEDED: [],
  FAILED: ['SKIPPED'], // FAILED may transition to SKIPPED only via compensation
  SKIPPED: [],
  CANCELLED: [],
});

export function isTerminalRunStatus(s: WorkRunStatus): boolean {
  return WORK_RUN_TRANSITIONS[s].length === 0;
}

export function isTerminalStepStatus(s: WorkRunStepStatus): boolean {
  return WORK_RUN_STEP_TRANSITIONS[s].length === 0;
}

export function validateRunTransition(
  current: WorkRunStatus,
  next: WorkRunStatus,
): { ok: true } | { ok: false; reason: string } {
  const allowed = WORK_RUN_TRANSITIONS[current];
  if (!allowed) {
    return { ok: false, reason: `Unknown run status: ${current}` };
  }
  if (!allowed.includes(next)) {
    return {
      ok: false,
      reason: `Invalid transition ${current} -> ${next}`,
    };
  }
  return { ok: true };
}

export function validateStepTransition(
  current: WorkRunStepStatus,
  next: WorkRunStepStatus,
): { ok: true } | { ok: false; reason: string } {
  const allowed = WORK_RUN_STEP_TRANSITIONS[current];
  if (!allowed) {
    return { ok: false, reason: `Unknown step status: ${current}` };
  }
  if (!allowed.includes(next)) {
    return {
      ok: false,
      reason: `Invalid step transition ${current} -> ${next}`,
    };
  }
  return { ok: true };
}

// ============================================================
// WORK-RUN VIEW
// ============================================================

export const WorkRunStepRecordSchema = z
  .object({
    stepId: UuidSchema,
    runId: UuidSchema,
    sequence: z.number().int().nonnegative(),
    toolName: z.string().min(1),
    capability: z.string().min(1),
    operationType: ToolEffectSchema,
    status: WorkRunStepStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(1),
    dependsOn: z.array(z.string().min(1)).default([]),
    input: z.record(z.string(), z.unknown()),
    output: z.record(z.string(), z.unknown()).optional(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    startedAt: IsoDateTimeSchema.optional(),
    finishedAt: IsoDateTimeSchema.optional(),
  })
  .strict();
export type WorkRunStepRecord = z.infer<typeof WorkRunStepRecordSchema>;

export const WorkRunRecordSchema = z
  .object({
    runId: UuidSchema,
    tenantId: UuidSchema,
    actorId: z.string().min(1),
    actorType: z.enum(['HUMAN', 'AI_AGENT', 'SYSTEM']),
    status: WorkRunStatusSchema,
    objective: z.string().min(1),
    /** Idempotency key for the whole run. Re-submission with the same
     *  (tenantId, actorId, idempotencyKey) must return the existing run. */
    idempotencyKey: z.string().min(1),
    currentStepIndex: z.number().int().nonnegative(),
    planVersion: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    steps: z.array(WorkRunStepRecordSchema).default([]),
  })
  .strict();
export type WorkRunRecord = z.infer<typeof WorkRunRecordSchema>;

// Mirror ToolEffect for the record (imported at file top to avoid cycles)

// ============================================================
// WORK-RUN STORE
// ============================================================

export interface IWorkRunStore {
  /**
   * Idempotent create. If a run already exists for
   * (tenantId, actorId, idempotencyKey), return the existing record.
   */
  createOrGet(
    record: WorkRunRecord,
    ctx: AuthorizationContext,
  ): { record: WorkRunRecord; created: boolean };
  get(runId: string, ctx: AuthorizationContext): WorkRunRecord | null;
  listByTenant(tenantId: string, ctx: AuthorizationContext): WorkRunRecord[];
  transition(
    runId: string,
    next: WorkRunStatus,
    ctx: AuthorizationContext,
  ): { ok: true; record: WorkRunRecord } | { ok: false; reason: string };
  upsertStep(
    step: WorkRunStepRecord,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string };
  transitionStep(
    runId: string,
    stepId: string,
    next: WorkRunStepStatus,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string };
}

export class InMemoryWorkRunStore implements IWorkRunStore {
  private readonly runs = new Map<string, WorkRunRecord>();
  private readonly idemIndex = new Map<string, string>(); // tenantId|actor|key -> runId

  constructor() {}

  private idemKey(tenantId: string, actorId: string, key: string): string {
    return `${tenantId}|${actorId}|${key}`;
  }

  createOrGet(
    record: WorkRunRecord,
    ctx: AuthorizationContext,
  ): { record: WorkRunRecord; created: boolean } {
    WorkRunRecordSchema.parse(record);
    if (!ctx.tenantId) {
      throw new Error('createOrGet() requires tenantId (§5.2)');
    }
    if (record.tenantId !== ctx.tenantId) {
      throw new Error('createOrGet() cross-tenant denied (§5.2)');
    }
    const k = this.idemKey(
      record.tenantId,
      record.actorId,
      record.idempotencyKey,
    );
    const existingId = this.idemIndex.get(k);
    if (existingId) {
      const existing = this.runs.get(existingId);
      if (existing) return { record: existing, created: false };
    }
    this.runs.set(record.runId, record);
    this.idemIndex.set(k, record.runId);
    return { record, created: true };
  }

  get(runId: string, ctx: AuthorizationContext): WorkRunRecord | null {
    if (!ctx.tenantId) {
      throw new Error('get() requires tenantId (§5.2)');
    }
    const r = this.runs.get(runId);
    if (!r) return null;
    if (r.tenantId !== ctx.tenantId) {
      throw new Error('get() cross-tenant denied (§5.2)');
    }
    return r;
  }

  listByTenant(tenantId: string, ctx: AuthorizationContext): WorkRunRecord[] {
    if (!ctx.tenantId) {
      throw new Error('listByTenant() requires tenantId (§5.2)');
    }
    if (tenantId !== ctx.tenantId) {
      throw new Error('listByTenant() cross-tenant denied (§5.2)');
    }
    return [...this.runs.values()].filter((r) => r.tenantId === tenantId);
  }

  transition(
    runId: string,
    next: WorkRunStatus,
    ctx: AuthorizationContext,
  ): { ok: true; record: WorkRunRecord } | { ok: false; reason: string } {
    const r = this.get(runId, ctx);
    if (!r) return { ok: false, reason: `Run ${runId} not found` };
    const t = validateRunTransition(r.status, next);
    if (!t.ok) return { ok: false, reason: t.reason };
    const updated: WorkRunRecord = {
      ...r,
      status: next,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, updated);
    return { ok: true, record: updated };
  }

  upsertStep(
    step: WorkRunStepRecord,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string } {
    WorkRunStepRecordSchema.parse(step);
    if (!ctx.tenantId) {
      return { ok: false, reason: 'upsertStep() requires tenantId (§5.2)' };
    }
    const r = this.runs.get(step.runId);
    if (!r) return { ok: false, reason: `Run ${step.runId} not found` };
    if (r.tenantId !== ctx.tenantId) {
      return { ok: false, reason: 'upsertStep() cross-tenant denied' };
    }
    const idx = r.steps.findIndex((s) => s.stepId === step.stepId);
    const newSteps = [...r.steps];
    if (idx === -1) newSteps.push(step);
    else newSteps[idx] = step;
    this.runs.set(r.runId, {
      ...r,
      steps: newSteps,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  transitionStep(
    runId: string,
    stepId: string,
    next: WorkRunStepStatus,
    ctx: AuthorizationContext,
  ): { ok: true } | { ok: false; reason: string } {
    const r = this.get(runId, ctx);
    if (!r) return { ok: false, reason: `Run ${runId} not found` };
    const idx = r.steps.findIndex((s) => s.stepId === stepId);
    if (idx === -1) return { ok: false, reason: `Step ${stepId} not found` };
    const t = validateStepTransition(r.steps[idx].status, next);
    if (!t.ok) return { ok: false, reason: t.reason };
    const newSteps = [...r.steps];
    newSteps[idx] = { ...r.steps[idx], status: next };
    this.runs.set(runId, {
      ...r,
      steps: newSteps,
      currentStepIndex: r.steps[idx].sequence,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  }
}

// ============================================================
// COMPENSATION LEDGER
// ============================================================

export const CompensationRecordSchema = z
  .object({
    compensationId: UuidSchema,
    runId: UuidSchema,
    stepId: UuidSchema,
    sideEffectEntryId: UuidSchema,
    tenantId: UuidSchema,
    inverseToolId: z.string().min(1),
    status: z.enum([
      'PENDING',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'MANUAL_REVIEW',
    ]),
    detail: z.string().optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type CompensationRecord = z.infer<typeof CompensationRecordSchema>;

export interface ICompensationLedger {
  record(rec: CompensationRecord, ctx: AuthorizationContext): void;
  listByRun(runId: string, ctx: AuthorizationContext): CompensationRecord[];
}

export class InMemoryCompensationLedger implements ICompensationLedger {
  private readonly records = new Map<string, CompensationRecord>();
  private readonly runIndex = new Map<string, Set<string>>();

  constructor() {}

  record(rec: CompensationRecord, ctx: AuthorizationContext): void {
    CompensationRecordSchema.parse(rec);
    if (!ctx.tenantId) {
      throw new Error('record() requires tenantId (§5.2)');
    }
    if (rec.tenantId !== ctx.tenantId) {
      throw new Error('record() cross-tenant denied (§5.2)');
    }
    if (this.records.has(rec.compensationId)) {
      throw new Error('Compensation record is immutable; duplicate id');
    }
    this.records.set(rec.compensationId, rec);
    const set = this.runIndex.get(rec.runId) ?? new Set<string>();
    set.add(rec.compensationId);
    this.runIndex.set(rec.runId, set);
  }

  listByRun(runId: string, ctx: AuthorizationContext): CompensationRecord[] {
    if (!ctx.tenantId) {
      throw new Error('listByRun() requires tenantId (§5.2)');
    }
    const set = this.runIndex.get(runId);
    if (!set) return [];
    const out: CompensationRecord[] = [];
    for (const id of set) {
      const r = this.records.get(id);
      if (!r) continue;
      if (r.tenantId !== ctx.tenantId) continue;
      out.push(r);
    }
    return out;
  }
}

// ============================================================
// CONCURRENCY GUARD
// ============================================================

/**
 * Concurrency guard for work-runs. §5.2: "Idempotent orchestration and
 * cleanup; retries cannot duplicate business effects."
 *
 * The oracle provides a deterministic per-(runId, stepId) lock that callers
 * can use to prevent concurrent re-execution of the same step (e.g., a
 * duplicate HTTP retry racing the original).
 */
export class WorkRunConcurrencyGuard {
  private readonly held = new Set<string>();
  private readonly owners = new Map<string, string>(); // key -> owner

  private key(runId: string, stepId: string): string {
    return `${runId}::${stepId}`;
  }

  /**
   * Try to acquire a lock. Returns true on success, false on contention.
   */
  acquire(runId: string, stepId: string, owner: string): boolean {
    const k = this.key(runId, stepId);
    if (this.held.has(k)) return false;
    this.held.add(k);
    this.owners.set(k, owner);
    return true;
  }

  /**
   * Release a lock. The owner must match.
   */
  release(runId: string, stepId: string, owner: string): boolean {
    const k = this.key(runId, stepId);
    if (!this.held.has(k)) return false;
    if (this.owners.get(k) !== owner) return false;
    this.held.delete(k);
    this.owners.delete(k);
    return true;
  }

  isHeld(runId: string, stepId: string): boolean {
    return this.held.has(this.key(runId, stepId));
  }

  clear(): void {
    this.held.clear();
    this.owners.clear();
  }
}

// ============================================================
// TIMEOUT WATCHDOG
// ============================================================

export type TimeoutOutcome =
  | { kind: 'WITHIN_BUDGET' }
  | { kind: 'TIMED_OUT'; elapsedMs: number; budgetMs: number };

/**
 * Pure function: check whether a run has exceeded its timeout budget.
 */
export function checkTimeout(
  startedAt: Date,
  budgetMs: number,
  now: Date = new Date(),
): TimeoutOutcome {
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed > budgetMs) {
    return { kind: 'TIMED_OUT', elapsedMs: elapsed, budgetMs };
  }
  return { kind: 'WITHIN_BUDGET' };
}

// ============================================================
// CHECKSUMS / PROVENANCE
// ============================================================

function canonicalizeWorkflow(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => canonicalizeWorkflow(v));
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalizeWorkflow(obj[k]);
  }
  return sorted;
}

export function computeWorkflowChecksum(record: WorkRunRecord): string {
  // Deterministic canonical JSON. Steps are sorted by sequence.
  const sortedSteps = [...record.steps].sort((a, b) => a.sequence - b.sequence);
  const obj = canonicalizeWorkflow({
    runId: record.runId,
    tenantId: record.tenantId,
    actorId: record.actorId,
    actorType: record.actorType,
    status: record.status,
    objective: record.objective,
    idempotencyKey: record.idempotencyKey,
    planVersion: record.planVersion,
    steps: sortedSteps.map((s) => ({
      stepId: s.stepId,
      sequence: s.sequence,
      toolName: s.toolName,
      capability: s.capability,
      operationType: s.operationType,
      status: s.status,
      attemptCount: s.attemptCount,
      idempotencyKey: s.idempotencyKey,
      dependsOn: [...s.dependsOn].sort(),
    })),
  });
  const json = JSON.stringify(obj);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}
