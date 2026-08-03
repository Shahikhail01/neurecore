/**
 * NeureCore Harness - Test Quarantine (Phase 3)
 *
 * Implements §10 Phase 3 deliverable:
 *   - Test quarantine with owner/reason/expiry
 *
 * §10 Phase 3 exit: "flaky tests cannot be hidden indefinitely".
 * §11 gate rule: "Flaky, skipped, blocked, infrastructure-error, and
 * insufficient-evidence outcomes are tracked separately and resolved by
 * policy; they are never converted to pass."
 *
 * SOLID alignment:
 *   - SRP: quarantine only; flake detection delegated to fixtures module.
 *   - OCP: policies are data; new policies added without code changes.
 *   - DIP: storage behind a port.
 *
 * Document ID: NC-HARNESS-QUARANTINE-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { UuidSchema, IsoDateTimeSchema, SemverSchema } from '../contracts';

export const QUARANTINE_VERSION = '1.0.0';

// ============================================================
// SCHEMAS
// ============================================================

export const QuarantineReasonSchema = z.enum([
  'FLAKY',
  'INFRA_ERROR',
  'PROVIDER_OUTAGE',
  'KNOWN_BUG',
  'AWAITING_FIX',
  'AWAITING_DATA',
  'AWAITING_REVIEW',
  'ENVIRONMENT_UNSUPPORTED',
  'OTHER',
]);
export type QuarantineReason = z.infer<typeof QuarantineReasonSchema>;

export const QuarantineStatusSchema = z.enum([
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'PROMOTED',
]);
export type QuarantineStatus = z.infer<typeof QuarantineStatusSchema>;

/**
 * §10 Phase 3: owner / reason / expiry are mandatory fields. A
 * quarantine record without an owner or expiry is rejected by the
 * schema — there is no way to hide a flaky test indefinitely.
 */
export const QuarantineRecordSchema = z
  .object({
    quarantineId: UuidSchema,
    schemaVersion: SemverSchema,
    scenarioId: z.string().min(1),
    suiteId: z.string().min(1).optional(),
    testPath: z.string().min(1).optional(),
    reason: QuarantineReasonSchema,
    description: z.string().min(1),
    owner: z.object({
      ownerId: z.string().min(1),
      ownerRole: z.string().min(1),
      confirmedAt: IsoDateTimeSchema,
    }),
    status: QuarantineStatusSchema,
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    expiresAt: IsoDateTimeSchema,
    promotedAt: IsoDateTimeSchema.optional(),
    revokedAt: IsoDateTimeSchema.optional(),
    revokedReason: z.string().optional(),
    extensionCount: z.number().int().nonnegative().default(0),
    /** §4 row "Regression" — defect linkage is the only way out of a
     *  quarantine; quarantines promote into the regression catalog. */
    linkedDefectId: UuidSchema.optional(),
    annotations: z
      .array(
        z.object({
          annotationId: UuidSchema,
          author: z.string().min(1),
          createdAt: IsoDateTimeSchema,
          kind: z.enum(['NOTE', 'EXTENDED', 'EXPIRED', 'REVOKED', 'PROMOTED']),
          message: z.string().min(1),
        }),
      )
      .default([]),
  })
  .strict();
export type QuarantineRecord = z.infer<typeof QuarantineRecordSchema>;

export const RegisterQuarantineInputSchema = z
  .object({
    scenarioId: z.string().min(1),
    suiteId: z.string().min(1).optional(),
    testPath: z.string().min(1).optional(),
    reason: QuarantineReasonSchema,
    description: z.string().min(1),
    ownerId: z.string().min(1),
    ownerRole: z.string().min(1),
    createdBy: z.string().min(1),
    /** Hard rule: a quarantine without an expiry cannot be hidden
     *  indefinitely. The runtime guard (in QuarantineEngine.register)
     *  enforces the future-expiry rule against the supplied clock;
     *  the schema only ensures expiresAt is a valid datetime. */
    expiresAt: IsoDateTimeSchema,
    linkedDefectId: UuidSchema.optional(),
  })
  .strict();
export type RegisterQuarantineInput = z.infer<
  typeof RegisterQuarantineInputSchema
>;

// ============================================================
// QUARANTINE POLICY (§10 Phase 3, §11 gate rules)
// ============================================================

export const QuarantinePolicySchema = z
  .object({
    /** Maximum lifetime for a quarantine entry from creation. */
    maxLifetimeDays: z.number().positive().default(30),
    /** Maximum number of extensions allowed per quarantine entry. */
    maxExtensions: z.number().int().nonnegative().default(2),
    /** Maximum days per extension. */
    maxExtensionDays: z.number().positive().default(14),
    /**
     * §11 — FLAKY / SKIPPED / INFRA_ERROR / UNKNOWN outcomes must never
     * silently count as PASS. When true, the verifier rejects runs whose
     * outcome is one of these but the underlying scenario is not
     * quarantined.
     */
    blockUntrackedFlakeOutcomes: z.boolean().default(true),
    /**
     * When true, the quarantine cannot be promoted out of ACTIVE without
     * a linked defect.
     */
    requireDefectForPromotion: z.boolean().default(true),
  })
  .strict()
  .default({
    maxLifetimeDays: 30,
    maxExtensions: 2,
    maxExtensionDays: 14,
    blockUntrackedFlakeOutcomes: true,
    requireDefectForPromotion: true,
  });
export type QuarantinePolicy = z.infer<typeof QuarantinePolicySchema>;

// ============================================================
// STORAGE PORT
// ============================================================

export interface IQuarantineStore {
  upsert(record: QuarantineRecord): void;
  get(quarantineId: string): QuarantineRecord | null;
  findActiveByScenario(scenarioId: string): QuarantineRecord | null;
  list(filter?: QuarantineFilter): QuarantineRecord[];
}

export type QuarantineFilter = {
  status?: QuarantineStatus;
  reason?: QuarantineReason;
  scenarioId?: string;
  expiringBefore?: string;
};

export class InMemoryQuarantineStore implements IQuarantineStore {
  private readonly records = new Map<string, QuarantineRecord>();
  private readonly byScenario = new Map<string, string>();

  upsert(record: QuarantineRecord): void {
    const parsed = QuarantineRecordSchema.parse(record);
    this.records.set(parsed.quarantineId, parsed);
    if (parsed.status === 'ACTIVE') {
      this.byScenario.set(parsed.scenarioId, parsed.quarantineId);
    } else {
      const current = this.byScenario.get(parsed.scenarioId);
      if (current === parsed.quarantineId)
        this.byScenario.delete(parsed.scenarioId);
    }
  }

  get(quarantineId: string): QuarantineRecord | null {
    return this.records.get(quarantineId) ?? null;
  }

  findActiveByScenario(scenarioId: string): QuarantineRecord | null {
    const id = this.byScenario.get(scenarioId);
    if (!id) return null;
    const r = this.records.get(id);
    return r && r.status === 'ACTIVE' ? r : null;
  }

  list(filter: QuarantineFilter = {}): QuarantineRecord[] {
    return [...this.records.values()].filter((r) => {
      if (filter.status && r.status !== filter.status) return false;
      if (filter.reason && r.reason !== filter.reason) return false;
      if (filter.scenarioId && r.scenarioId !== filter.scenarioId) return false;
      if (
        filter.expiringBefore &&
        Date.parse(r.expiresAt) > Date.parse(filter.expiringBefore)
      ) {
        return false;
      }
      return true;
    });
  }
}

// ============================================================
// QUARANTINE ENGINE
// ============================================================

export const QUARANTINE_OUTCOMES = [
  'FLAKY',
  'INFRA_ERROR',
  'SKIPPED',
  'BLOCKED',
  'UNKNOWN',
] as const;
export type QuarantineOutcome = (typeof QUARANTINE_OUTCOMES)[number];

export interface IQuarantineEngine {
  register(
    input: RegisterQuarantineInput,
    policy?: QuarantinePolicy,
  ): QuarantineRecord;
  extend(
    quarantineId: string,
    additionalDays: number,
    actor: string,
    justification: string,
    policy?: QuarantinePolicy,
  ): QuarantineRecord;
  promote(
    quarantineId: string,
    defectId: string,
    actor: string,
    policy?: QuarantinePolicy,
  ): QuarantineRecord;
  revoke(quarantineId: string, actor: string, reason: string): QuarantineRecord;
  /** Move ACTIVE entries to EXPIRED when expiresAt < now. */
  sweepExpired(atIso: string): QuarantineRecord[];
  /**
   * §11 — outcome resolution. Given a scenario outcome, returns whether
   * the run is acceptable (PASS / quarantined outcome) or whether it
   * constitutes a policy violation.
   */
  resolveOutcome(
    scenarioId: string,
    outcome: QuarantineOutcome | 'PASSED' | 'FAILED',
    policy?: QuarantinePolicy,
  ): QuarantineOutcomeResolution;
}

export const QuarantineOutcomeResolutionSchema = z
  .object({
    scenarioId: z.string().min(1),
    reportedOutcome: z.string().min(1),
    resolvedOutcome: z.enum([
      'PASS',
      'FAIL',
      'QUARANTINED',
      'POLICY_VIOLATION',
    ]),
    quarantineId: UuidSchema.optional(),
    reasons: z.array(z.string()).default([]),
  })
  .strict();
export type QuarantineOutcomeResolution = z.infer<
  typeof QuarantineOutcomeResolutionSchema
>;

export class QuarantineEngine implements IQuarantineEngine {
  private readonly defaultPolicy: QuarantinePolicy;
  constructor(
    private readonly store: IQuarantineStore,
    private readonly clock: { now(): Date } = { now: () => new Date() },
    defaultPolicy: QuarantinePolicy = QuarantinePolicySchema.parse({}),
  ) {
    this.defaultPolicy = defaultPolicy;
  }

  register(
    input: RegisterQuarantineInput,
    policy: QuarantinePolicy = QuarantinePolicySchema.parse({}),
  ): QuarantineRecord {
    const parsed = RegisterQuarantineInputSchema.parse(input);
    const now = this.clock.now();
    // No indefinite quarantine: expiresAt must be strictly after the
    // current clock. We allow a 60s grace to account for clock skew.
    if (Date.parse(parsed.expiresAt) <= now.getTime() + 60_000) {
      throw new Error(
        'expiresAt must be in the future (no indefinite quarantine)',
      );
    }
    const maxLifetime = policy.maxLifetimeDays * 86_400_000;
    const requestedLifetime = Date.parse(parsed.expiresAt) - now.getTime();
    if (requestedLifetime > maxLifetime) {
      throw new Error(
        `Quarantine lifetime ${Math.round(requestedLifetime / 86_400_000)}d exceeds policy max ${policy.maxLifetimeDays}d`,
      );
    }
    const record: QuarantineRecord = QuarantineRecordSchema.parse({
      quarantineId: uuidv4(),
      schemaVersion: QUARANTINE_VERSION,
      scenarioId: parsed.scenarioId,
      suiteId: parsed.suiteId,
      testPath: parsed.testPath,
      reason: parsed.reason,
      description: parsed.description,
      owner: {
        ownerId: parsed.ownerId,
        ownerRole: parsed.ownerRole,
        confirmedAt: now.toISOString(),
      },
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      createdBy: parsed.createdBy,
      expiresAt: parsed.expiresAt,
      linkedDefectId: parsed.linkedDefectId,
      annotations: [],
    });
    this.store.upsert(record);
    return record;
  }

  extend(
    quarantineId: string,
    additionalDays: number,
    actor: string,
    justification: string,
    policy: QuarantinePolicy = QuarantinePolicySchema.parse({}),
  ): QuarantineRecord {
    const existing = this.requireRecord(quarantineId);
    if (existing.status !== 'ACTIVE') {
      throw new Error(`Cannot extend quarantine in status ${existing.status}`);
    }
    if (existing.extensionCount >= policy.maxExtensions) {
      throw new Error(
        `Quarantine ${quarantineId} has reached max extensions (${policy.maxExtensions})`,
      );
    }
    if (additionalDays <= 0 || additionalDays > policy.maxExtensionDays) {
      throw new Error(
        `Extension must be 1..${policy.maxExtensionDays} days (got ${additionalDays})`,
      );
    }
    const now = this.clock.now();
    const newExpiresAt = new Date(
      Math.max(Date.parse(existing.expiresAt), now.getTime()) +
        additionalDays * 86_400_000,
    ).toISOString();
    const updated: QuarantineRecord = QuarantineRecordSchema.parse({
      ...existing,
      expiresAt: newExpiresAt,
      extensionCount: existing.extensionCount + 1,
      annotations: [
        ...existing.annotations,
        {
          annotationId: uuidv4(),
          author: actor,
          createdAt: now.toISOString(),
          kind: 'EXTENDED',
          message: `${justification} (+${additionalDays}d)`,
        },
      ],
    });
    this.store.upsert(updated);
    return updated;
  }

  promote(
    quarantineId: string,
    defectId: string,
    actor: string,
    policy: QuarantinePolicy = QuarantinePolicySchema.parse({}),
  ): QuarantineRecord {
    const existing = this.requireRecord(quarantineId);
    if (policy.requireDefectForPromotion && !defectId) {
      throw new Error('Promotion requires a linked defect id');
    }
    if (existing.status !== 'ACTIVE') {
      throw new Error(`Cannot promote quarantine in status ${existing.status}`);
    }
    const now = this.clock.now().toISOString();
    const updated: QuarantineRecord = QuarantineRecordSchema.parse({
      ...existing,
      status: 'PROMOTED',
      linkedDefectId: defectId,
      promotedAt: now,
      annotations: [
        ...existing.annotations,
        {
          annotationId: uuidv4(),
          author: actor,
          createdAt: now,
          kind: 'PROMOTED',
          message: `Promoted to defect ${defectId}`,
        },
      ],
    });
    this.store.upsert(updated);
    return updated;
  }

  revoke(
    quarantineId: string,
    actor: string,
    reason: string,
  ): QuarantineRecord {
    const existing = this.requireRecord(quarantineId);
    if (existing.status !== 'ACTIVE') {
      throw new Error(`Cannot revoke quarantine in status ${existing.status}`);
    }
    const now = this.clock.now().toISOString();
    const updated: QuarantineRecord = QuarantineRecordSchema.parse({
      ...existing,
      status: 'REVOKED',
      revokedAt: now,
      revokedReason: reason,
      annotations: [
        ...existing.annotations,
        {
          annotationId: uuidv4(),
          author: actor,
          createdAt: now,
          kind: 'REVOKED',
          message: reason,
        },
      ],
    });
    this.store.upsert(updated);
    return updated;
  }

  sweepExpired(atIso: string): QuarantineRecord[] {
    const now = Date.parse(atIso);
    const expired: QuarantineRecord[] = [];
    for (const record of this.store.list({ status: 'ACTIVE' })) {
      if (Date.parse(record.expiresAt) <= now) {
        const updated: QuarantineRecord = QuarantineRecordSchema.parse({
          ...record,
          status: 'EXPIRED',
          annotations: [
            ...record.annotations,
            {
              annotationId: uuidv4(),
              author: 'system',
              createdAt: atIso,
              kind: 'EXPIRED',
              message: 'Auto-expired by sweep',
            },
          ],
        });
        this.store.upsert(updated);
        expired.push(updated);
      }
    }
    return expired;
  }

  resolveOutcome(
    scenarioId: string,
    outcome: QuarantineOutcome | 'PASSED' | 'FAILED',
    policy: QuarantinePolicy = this.defaultPolicy,
  ): QuarantineOutcomeResolution {
    const active = this.store.findActiveByScenario(scenarioId);
    if (outcome === 'PASSED' || outcome === 'FAILED') {
      return QuarantineOutcomeResolutionSchema.parse({
        scenarioId,
        reportedOutcome: outcome,
        resolvedOutcome: outcome === 'PASSED' ? 'PASS' : 'FAIL',
        reasons: [],
      });
    }
    if (active) {
      return QuarantineOutcomeResolutionSchema.parse({
        scenarioId,
        reportedOutcome: outcome,
        resolvedOutcome: 'QUARANTINED',
        quarantineId: active.quarantineId,
        reasons: [
          `Outcome ${outcome} suppressed by active quarantine ${active.quarantineId}`,
        ],
      });
    }
    if (policy.blockUntrackedFlakeOutcomes) {
      return QuarantineOutcomeResolutionSchema.parse({
        scenarioId,
        reportedOutcome: outcome,
        resolvedOutcome: 'POLICY_VIOLATION',
        reasons: [
          `Outcome ${outcome} for scenario ${scenarioId} is not quarantined. ` +
            '§11 gate rule: flaky / infra_error / skipped / blocked / unknown must never silently count as pass.',
        ],
      });
    }
    return QuarantineOutcomeResolutionSchema.parse({
      scenarioId,
      reportedOutcome: outcome,
      resolvedOutcome: 'FAIL',
      reasons: [`Untracked ${outcome} outcome; treating as failure`],
    });
  }

  private requireRecord(id: string): QuarantineRecord {
    const r = this.store.get(id);
    if (!r) throw new Error(`Quarantine ${id} not found`);
    return r;
  }
}

// ============================================================
// WAIVERS — overlap but distinct from quarantine. Quarantines hide
// failure modes while we fix them; waivers grant a release-time
// exception. Both must carry owner/reason/expiry per the §10 Phase 3
// rule and §11 waiver requirements.
// ============================================================

export const WaiverRecordSchema = z
  .object({
    waiverId: UuidSchema,
    capabilityId: z.string().min(1),
    scope: z.string().min(1),
    reason: z.string().min(1),
    compensatingControl: z.string().min(1),
    owner: z.string().min(1),
    approver: z.string().min(1),
    issueLink: z.string().url().optional(),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .refine((v) => v.owner !== v.approver, {
    message: 'owner and approver must differ (separation of duties)',
  });
export type WaiverRecord = z.infer<typeof WaiverRecordSchema>;
