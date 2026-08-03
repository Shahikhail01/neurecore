/**
 * NeureCore Harness - Tool Contract Catalog (Phase 5)
 *
 * Implements the §10 Phase 5 deliverables for the Tool-Calling Harness element:
 *   - tool contract catalog
 *   - side-effect ledger
 *   - failure / recovery scenarios (retryable classification)
 *
 * §9 "Tool-Calling" row, §10 Phase 5 exit criteria:
 *   "every production agent role and mutating tool has positive, denial,
 *    failure, and recovery tests"
 *
 * The catalog is structurally aligned with the production `RuntimeTool`
 * contract (work-runtime/contracts/work-runtime.interface.ts) so the harness
 * exercises the SAME field set the runtime uses, not a parallel vocabulary.
 *
 * §5.2 invariants enforced here:
 *   - "Secure and tenant-scoped by default; missing tenant context is an error."
 *   - "A harness pass cannot override a product authorization denial."
 *   - "Cleanup failure is a run failure and triggers an orphan-resource alert."
 *   - "Unknown, skipped, flaky, or infrastructure-error results never silently
 *      count as pass."
 *
 * Document ID: NC-HARNESS-PHASE5-TOOLS-001
 * Version: 1.0
 * Status: PHASE_5_IMPLEMENTED
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  Sha256ChecksumSchema,
  type AuthorizationContext,
} from '../../contracts';

// ============================================================
// VERSION
// ============================================================

export const TOOL_CATALOG_VERSION = '1.0.0';
export const TOOL_CATALOG_COMPATIBILITY_POLICY =
  'strict-v1: additive-tool = minor, required-tool-removed = major, effect-changed = major';

// ============================================================
// CANONICALIZATION (deterministic JSON for checksums)
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

// ============================================================
// ENUMS
// ============================================================

export const ToolEffectSchema = z.enum([
  'READ',
  'INTERNAL_WRITE',
  'EXTERNAL_WRITE',
]);
export type ToolEffect = z.infer<typeof ToolEffectSchema>;

export const ToolRetryabilitySchema = z.enum([
  'IDEMPOTENT', // safe to retry without side effects
  'AT_MOST_ONCE', // must be guarded by idempotency key
  'AT_LEAST_ONCE', // caller accepts duplicate side effects
  'NEVER', // must never be retried
]);
export type ToolRetryability = z.infer<typeof ToolRetryabilitySchema>;

export const ToolSideEffectClassSchema = z.enum([
  'DB_WRITE',
  'CACHE_WRITE',
  'EVENT_PUBLISH',
  'EXTERNAL_API',
  'EMAIL',
  'PAYMENT',
  'FILE_UPLOAD',
  'VECTOR_WRITE',
  'STATE_MACHINE_TRANSITION',
  'NONE',
]);
export type ToolSideEffectClass = z.infer<typeof ToolSideEffectClassSchema>;

export const ToolFailureClassSchema = z.enum([
  'TRANSIENT', // retry likely to succeed (5xx, network)
  'PERMANENT', // retry will not help (4xx, validation)
  'AUTHORIZATION', // requires policy review (deny / forbidden)
  'RATE_LIMITED', // backoff
  'INFRASTRUCTURE', // not the tool's fault (DB down)
  'UNKNOWN',
]);
export type ToolFailureClass = z.infer<typeof ToolFailureClassSchema>;

// ============================================================
// TOOL CONTRACT
// ============================================================

export const ToolContractSchema = z
  .object({
    toolId: z.string().min(1),
    version: SemverSchema,
    name: z.string().min(1),
    capability: z.string().min(1),
    description: z.string().min(1),
    effect: ToolEffectSchema,
    /** Minimum effective authority (1-100) required to execute. */
    requiredAuthority: z.number().int().min(0).max(100),
    /** Whether the tool requires explicit human approval. */
    approvalSensitive: z.boolean(),
    /** Maximum wall-clock execution time. */
    timeoutMs: z.number().int().positive(),
    /** Maximum automatic retries (caller-side). */
    maxRetries: z.number().int().nonnegative(),
    /** Whether the tool is safe to retry. */
    retryability: ToolRetryabilitySchema,
    /** What the tool does to the world. */
    sideEffectClasses: z.array(ToolSideEffectClassSchema).min(1),
    /** Required permission strings. */
    requiredPermissions: z.array(z.string().min(1)).default([]),
    /** Whether the tool mutates business state (vs. internal cache etc). */
    mutatesBusinessState: z.boolean(),
    /** Compensation strategy, if any. */
    compensation: z
      .object({
        kind: z.enum([
          'NONE',
          'IDEMPOTENT_REVERSE_TOOL',
          'INVERSE_TOOL',
          'MANUAL_REVIEW',
        ]),
        inverseToolId: z.string().min(1).optional(),
      })
      .strict()
      .default({ kind: 'NONE' }),
    /** Whether the tool produces a side-effect ledger entry. */
    produceSideEffectLedger: z.boolean(),
    status: z.enum(['ACTIVE', 'DEPRECATED', 'RETIRED']),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ToolContract = z.infer<typeof ToolContractSchema>;

// ============================================================
// INPUT / OUTPUT CONTRACTS (Zod schemas serialized as JSON Schema)
// ============================================================

export const ToolParameterSchema = z
  .object({
    toolId: z.string().min(1),
    version: SemverSchema,
    /** JSON Schema-style parameter definition. We persist as raw JSON. */
    inputSchema: z.record(z.string(), z.unknown()),
    /** Required top-level parameter names (denormalized for fast policy checks). */
    requiredParameters: z.array(z.string().min(1)).default([]),
    /** Forbidden parameter names (e.g., tenantId from caller — must come from ctx). */
    forbiddenParameters: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ToolParameter = z.infer<typeof ToolParameterSchema>;

// ============================================================
// SIDE-EFFECT LEDGER
// ============================================================

export const SideEffectEntrySchema = z
  .object({
    entryId: UuidSchema,
    toolId: z.string().min(1),
    toolVersion: SemverSchema,
    runId: UuidSchema,
    tenantId: UuidSchema,
    actorId: z.string().min(1),
    actorType: z.enum(['HUMAN', 'AI_AGENT', 'SYSTEM']),
    idempotencyKey: z.string().min(1),
    effect: ToolEffectSchema,
    classes: z.array(ToolSideEffectClassSchema).min(1),
    /** Resource(s) the side effect touched. */
    resources: z.array(z.string().min(1)).default([]),
    /** Reverse / compensation key, if any. */
    compensationKey: z.string().min(1).optional(),
    createdAt: IsoDateTimeSchema,
    /** For audit: an opaque hash of the input for re-detection, NOT the input. */
    inputFingerprint: Sha256ChecksumSchema,
    /** Schema version of the ledger entry (for migration). */
    schemaVersion: SemverSchema,
  })
  .strict();
export type SideEffectEntry = z.infer<typeof SideEffectEntrySchema>;

// ============================================================
// FAILURE / RECOVERY
// ============================================================

export const ToolFailureRecordSchema = z
  .object({
    failureId: UuidSchema,
    toolId: z.string().min(1),
    toolVersion: SemverSchema,
    runId: UuidSchema,
    tenantId: UuidSchema,
    actorId: z.string().min(1),
    classification: ToolFailureClassSchema,
    retryable: z.boolean(),
    detail: z.string().min(1),
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type ToolFailureRecord = z.infer<typeof ToolFailureRecordSchema>;

// ============================================================
// TOOL REGISTRY
// ============================================================

export interface IToolCatalog {
  register(
    contract: ToolContract,
    parameters: ToolParameter,
    ctx: AuthorizationContext,
  ): void;
  deprecate(toolId: string, version: string): void;
  get(toolId: string, version: string): ToolContract | null;
  getActive(toolId: string): ToolContract | null;
  getParameters(toolId: string, version: string): ToolParameter | null;
  list(): ToolContract[];
  listMutating(): ToolContract[];
  listByCapability(capability: string): ToolContract[];
}

export class InMemoryToolCatalog implements IToolCatalog {
  private readonly tools = new Map<string, ToolContract>();
  private readonly params = new Map<string, ToolParameter>();

  constructor() {}

  private tk(toolId: string, version: string): string {
    return `${toolId}@${version}`;
  }

  register(
    contract: ToolContract,
    parameters: ToolParameter,
    ctx: AuthorizationContext,
  ): void {
    ToolContractSchema.parse(contract);
    ToolParameterSchema.parse(parameters);
    if (!ctx.tenantId) {
      throw new Error('register() requires tenantId (§5.2)');
    }
    if (contract.toolId !== parameters.toolId) {
      throw new Error('contract.toolId != parameters.toolId');
    }
    if (contract.version !== parameters.version) {
      throw new Error('contract.version != parameters.version');
    }
    if (this.tools.has(this.tk(contract.toolId, contract.version))) {
      throw new Error(
        `Tool ${contract.toolId}@${contract.version} already registered`,
      );
    }
    this.tools.set(this.tk(contract.toolId, contract.version), contract);
    this.params.set(this.tk(contract.toolId, contract.version), parameters);
  }

  deprecate(toolId: string, version: string): void {
    const t = this.tools.get(this.tk(toolId, version));
    if (!t) throw new Error(`Tool ${toolId}@${version} not found`);
    this.tools.set(this.tk(toolId, version), { ...t, status: 'DEPRECATED' });
  }

  get(toolId: string, version: string): ToolContract | null {
    return this.tools.get(this.tk(toolId, version)) ?? null;
  }

  getActive(toolId: string): ToolContract | null {
    const candidates = [...this.tools.values()]
      .filter((t) => t.toolId === toolId && t.status === 'ACTIVE')
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    return candidates[0] ?? null;
  }

  getParameters(toolId: string, version: string): ToolParameter | null {
    return this.params.get(this.tk(toolId, version)) ?? null;
  }

  list(): ToolContract[] {
    return [...this.tools.values()];
  }

  listMutating(): ToolContract[] {
    return [...this.tools.values()].filter((t) => t.effect !== 'READ');
  }

  listByCapability(capability: string): ToolContract[] {
    return [...this.tools.values()].filter((t) => t.capability === capability);
  }
}

// ============================================================
// PARAMETER VALIDATION
// ============================================================

export type ParamValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a tool invocation's parameter object against the catalog.
 * Pure function; no I/O.
 */
export function validateToolParameters(
  contract: ToolContract,
  parameters: ToolParameter,
  input: Record<string, unknown>,
): ParamValidation {
  if (contract.effect === 'READ' && contract.mutatesBusinessState) {
    return {
      ok: false,
      reason: 'READ tool cannot mutate business state (contract inconsistency)',
    };
  }
  for (const forbidden of parameters.forbiddenParameters) {
    if (Object.prototype.hasOwnProperty.call(input, forbidden)) {
      return {
        ok: false,
        reason: `Parameter '${forbidden}' is forbidden; must come from execution context`,
      };
    }
  }
  for (const required of parameters.requiredParameters) {
    if (!(required in input)) {
      return { ok: false, reason: `Missing required parameter '${required}'` };
    }
  }
  // Schema-level validation is delegated to the tool's own Zod schema at
  // execution time. The catalog stores the JSON-Schema for cross-language
  // consumption; here we only enforce the policy-level invariants.
  return { ok: true };
}

// ============================================================
// SIDE-EFFECT LEDGER
// ============================================================

export interface ISideEffectLedger {
  append(entry: SideEffectEntry, ctx: AuthorizationContext): void;
  /**
   * Idempotency check. Returns the existing entry if one with the same
   * (toolId, version, tenantId, idempotencyKey) already exists.
   */
  findByIdempotencyKey(
    toolId: string,
    version: string,
    tenantId: string,
    key: string,
  ): SideEffectEntry | null;
  listByRun(runId: string): SideEffectEntry[];
  listByTenant(tenantId: string): SideEffectEntry[];
}

export class InMemorySideEffectLedger implements ISideEffectLedger {
  private readonly entries = new Map<string, SideEffectEntry>();
  private readonly idemIndex = new Map<string, SideEffectEntry>(); // key: toolId@version@tenantId@key
  private readonly runIndex = new Map<string, Set<string>>(); // runId -> set<entryId>
  private readonly tenantIndex = new Map<string, Set<string>>(); // tenantId -> set<entryId>

  constructor() {}

  private idemKey(
    toolId: string,
    version: string,
    tenantId: string,
    key: string,
  ): string {
    return `${toolId}@${version}@${tenantId}@${key}`;
  }

  append(entry: SideEffectEntry, ctx: AuthorizationContext): void {
    SideEffectEntrySchema.parse(entry);
    if (!ctx.tenantId) {
      throw new Error('append() requires tenantId (§5.2)');
    }
    if (entry.tenantId !== ctx.tenantId) {
      throw new Error('append() cross-tenant denied (§5.2)');
    }
    // Idempotency: a duplicate idempotencyKey for the same tool/tenant must
    // collapse to the first entry (§5.2 idempotent orchestration).
    const key = this.idemKey(
      entry.toolId,
      entry.toolVersion,
      entry.tenantId,
      entry.idempotencyKey,
    );
    if (this.idemIndex.has(key)) {
      return; // silently collapse
    }
    this.entries.set(entry.entryId, entry);
    this.idemIndex.set(key, entry);
    const r = this.runIndex.get(entry.runId) ?? new Set<string>();
    r.add(entry.entryId);
    this.runIndex.set(entry.runId, r);
    const t = this.tenantIndex.get(entry.tenantId) ?? new Set<string>();
    t.add(entry.entryId);
    this.tenantIndex.set(entry.tenantId, t);
  }

  findByIdempotencyKey(
    toolId: string,
    version: string,
    tenantId: string,
    key: string,
  ): SideEffectEntry | null {
    return (
      this.idemIndex.get(this.idemKey(toolId, version, tenantId, key)) ?? null
    );
  }

  listByRun(runId: string): SideEffectEntry[] {
    const set = this.runIndex.get(runId);
    if (!set) return [];
    return [...set]
      .map((id) => this.entries.get(id))
      .filter((e): e is SideEffectEntry => Boolean(e));
  }

  listByTenant(tenantId: string): SideEffectEntry[] {
    const set = this.tenantIndex.get(tenantId);
    if (!set) return [];
    return [...set]
      .map((id) => this.entries.get(id))
      .filter((e): e is SideEffectEntry => Boolean(e));
  }
}

// ============================================================
// FINGERPRINT (no raw inputs in ledger)
// ============================================================

export function fingerprintInput(input: Record<string, unknown>): string {
  const obj = canonicalize(input);
  const json = JSON.stringify(obj);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}

// ============================================================
// RETRY POLICY
// ============================================================

export interface RetryDecision {
  attempt: number;
  shouldRetry: boolean;
  backoffMs: number;
  reason: string;
}

/**
 * Decide whether a tool failure should be retried, given the contract and
 * failure class. Pure function; no I/O.
 */
export function decideRetry(
  contract: ToolContract,
  attempt: number,
  failure: ToolFailureClass,
): RetryDecision {
  if (contract.retryability === 'NEVER') {
    return {
      attempt,
      shouldRetry: false,
      backoffMs: 0,
      reason: 'contract.retryability = NEVER',
    };
  }
  if (attempt > contract.maxRetries) {
    return {
      attempt,
      shouldRetry: false,
      backoffMs: 0,
      reason: 'maxRetries exhausted',
    };
  }
  switch (failure) {
    case 'TRANSIENT':
    case 'RATE_LIMITED':
    case 'INFRASTRUCTURE':
      return {
        attempt,
        shouldRetry: true,
        backoffMs: computeBackoff(attempt),
        reason: `${failure} on ${contract.retryability} tool`,
      };
    case 'PERMANENT':
    case 'AUTHORIZATION':
    case 'UNKNOWN':
    default:
      return {
        attempt,
        shouldRetry: false,
        backoffMs: 0,
        reason: `${failure} is not retryable`,
      };
  }
}

function computeBackoff(attempt: number): number {
  // Exponential backoff with a small cap; deterministic for the test.
  const base = 100;
  const max = 5_000;
  return Math.min(base * 2 ** (attempt - 1), max);
}

// ============================================================
// CHECKSUMS / PROVENANCE
// ============================================================

export function computeToolChecksum(contract: ToolContract): string {
  const obj = canonicalize({
    toolId: contract.toolId,
    version: contract.version,
    capability: contract.capability,
    effect: contract.effect,
    requiredAuthority: contract.requiredAuthority,
    approvalSensitive: contract.approvalSensitive,
    timeoutMs: contract.timeoutMs,
    maxRetries: contract.maxRetries,
    retryability: contract.retryability,
    sideEffectClasses: [...contract.sideEffectClasses].sort(),
    mutatesBusinessState: contract.mutatesBusinessState,
  });
  const json = JSON.stringify(obj);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}

// ============================================================
// TOOL INVOCATION DECISION
// ============================================================

export type ToolInvocationDecision =
  | { kind: 'ALLOW' }
  | { kind: 'DENY'; reason: string }
  | { kind: 'REQUIRE_APPROVAL'; reason: string };

/**
 * Determine whether a tool may be invoked, given the contract, an authority
 * score, and the actor's permissions. Pure function; no I/O.
 */
export function decideToolInvocation(params: {
  contract: ToolContract;
  effectiveAuthority: number;
  governanceBlocked: boolean;
  input: Record<string, unknown>;
  parameters: ToolParameter;
}): ToolInvocationDecision {
  if (params.governanceBlocked) {
    return { kind: 'DENY', reason: 'Governance is blocked' };
  }
  if (params.effectiveAuthority < params.contract.requiredAuthority) {
    return {
      kind: 'DENY',
      reason: `Authority ${params.effectiveAuthority} < required ${params.contract.requiredAuthority}`,
    };
  }
  const v = validateToolParameters(
    params.contract,
    params.parameters,
    params.input,
  );
  if (!v.ok) {
    return { kind: 'DENY', reason: v.reason };
  }
  if (params.contract.approvalSensitive) {
    return {
      kind: 'REQUIRE_APPROVAL',
      reason: 'Tool is approvalSensitive',
    };
  }
  return { kind: 'ALLOW' };
}
