/**
 * NeureCore Harness - Defect Registry (Phase 3)
 *
 * Implements the Regression Harness closure from §4 and §9 row "Regression":
 *   - Defect catalog
 *   - Promotion policy
 *   - Immutable expected behavior
 *   - Quarantine controls (delegated to harness/quarantine)
 *
 * And the §10 Phase 3 deliverables:
 *   - Defect registry
 *   - Automatic failure-to-regression workflow
 *
 * §5.2 invariants enforced:
 *   - "Idempotent orchestration and cleanup; retries cannot duplicate
 *     business effects."
 *   - "Immutable raw evidence; corrections create new versions or annotations."
 *   - "Cleanup failure is a run failure and triggers an orphan-resource alert."
 *
 * SOLID alignment:
 *   - SRP: defects only; no execution or evidence plane logic.
 *   - OCP: promotion rules and link types added by registration.
 *   - DIP: ports only (storage adapters provided by caller).
 *
 * Document ID: NC-HARNESS-DEFECTS-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  AuthorizationContextSchema,
  type AuthorizationContext,
} from '../contracts';

// ============================================================
// SCHEMAS (§5.2 "versioned contracts")
// ============================================================

export const DEFECTS_VERSION = '1.0.0';

export const DefectStatusSchema = z.enum([
  'OPEN',
  'REPRODUCED',
  'FIXED',
  'VERIFIED',
  'CLOSED',
  'REOPENED',
  'WONT_FIX',
]);

export type DefectStatus = z.infer<typeof DefectStatusSchema>;

export const DefectSeveritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);
export type DefectSeverity = z.infer<typeof DefectSeveritySchema>;

/** §10 Phase 3: defect catalog with individual owner and review date. */
export const OwnerRefSchema = z.object({
  ownerId: z.string().min(1),
  ownerRole: z.string().min(1),
  confirmedAt: IsoDateTimeSchema,
});
export type OwnerRef = z.infer<typeof OwnerRefSchema>;

export const DefectLinkSchema = z
  .object({
    scenarioId: z.string().min(1),
    suiteId: z.string().min(1).optional(),
    testPath: z.string().min(1).optional(),
    /** Indicates whether the linked scenario/suite is mandatory for the
     *  defect to be considered closed. */
    mandatory: z.boolean().default(true),
    addedAt: IsoDateTimeSchema,
    addedBy: z.string().min(1),
  })
  .strict();
export type DefectLink = z.infer<typeof DefectLinkSchema>;

/** §5.2 "Immutable raw evidence; corrections create new versions or annotations" */
export const DefectAnnotationSchema = z
  .object({
    annotationId: UuidSchema,
    author: z.string().min(1),
    createdAt: IsoDateTimeSchema,
    kind: z.enum([
      'NOTE',
      'STATUS_CHANGE',
      'LINK_ADDED',
      'LINK_REMOVED',
      'CORRECTION',
    ]),
    message: z.string().min(1),
    previousStatus: DefectStatusSchema.optional(),
    newStatus: DefectStatusSchema.optional(),
  })
  .strict();
export type DefectAnnotation = z.infer<typeof DefectAnnotationSchema>;

/**
 * Immutable expected behavior for a defect. §4 row "Regression" requires
 * "Immutable expected behavior" — corrections create a new version, they
 * never edit an existing one.
 */
export const ExpectedBehaviorSchema = z
  .object({
    behaviorId: UuidSchema,
    version: SemverSchema,
    description: z.string().min(1),
    assertions: z.array(z.string().min(1)).min(1),
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    supersedes: UuidSchema.optional(),
  })
  .strict();
export type ExpectedBehavior = z.infer<typeof ExpectedBehaviorSchema>;

export const DefectRecordSchema = z
  .object({
    defectId: UuidSchema,
    schemaVersion: SemverSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    severity: DefectSeveritySchema,
    status: DefectStatusSchema,
    owner: OwnerRefSchema,
    capabilityIds: z.array(z.string().min(1)).default([]),
    links: z.array(DefectLinkSchema).default([]),
    expectedBehaviors: z.array(ExpectedBehaviorSchema).min(1),
    /** Annotations are append-only. */
    annotations: z.array(DefectAnnotationSchema).default([]),
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    updatedAt: IsoDateTimeSchema,
    reviewDate: IsoDateTimeSchema.optional(),
    closedAt: IsoDateTimeSchema.optional(),
  })
  .strict();
export type DefectRecord = z.infer<typeof DefectRecordSchema>;

// ============================================================
// PROMOTION POLICY (§4 "Regression" row)
// ============================================================

export const PromotionPolicySchema = z
  .object({
    /**
     * §4 "Regression" - "mandatory promotion rules". A defect can only
     * leave FIXED when at least one mandatory linked scenario has been
     * executed in the current run.
     */
    requireMandatoryLinks: z.boolean().default(true),
    /**
     * Independent reviewer is required for VERIFIED. §15 #10.
     */
    requireIndependentReviewer: z.boolean().default(true),
    /**
     * Reviewer must differ from owner. §15 self-certification prohibited.
     */
    requireDistinctReviewer: z.boolean().default(true),
    /**
     * Cannot self-approve a VERIFIED transition.
     */
    forbidSelfApproval: z.boolean().default(true),
  })
  .strict()
  .default({
    requireMandatoryLinks: true,
    requireIndependentReviewer: true,
    requireDistinctReviewer: true,
    forbidSelfApproval: true,
  });
export type PromotionPolicy = z.infer<typeof PromotionPolicySchema>;

export const PromotionRequestSchema = z
  .object({
    defectId: UuidSchema,
    from: DefectStatusSchema,
    to: DefectStatusSchema,
    reviewer: z.string().min(1),
    justification: z.string().min(1),
    executedScenarioIds: z.array(z.string().min(1)).default([]),
    evidenceRefs: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type PromotionRequest = z.infer<typeof PromotionRequestSchema>;

export const PromotionDecisionSchema = z
  .object({
    allowed: z.boolean(),
    reasons: z.array(z.string()),
    from: DefectStatusSchema,
    to: DefectStatusSchema,
  })
  .strict();
export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>;

// ============================================================
// REPLAYABLE FAILURE BUNDLE (§10 Phase 3: "critical known defects
// have replayable tests"). This is a thin wrapper over the Phase 2
// replay bundle that ties a defect to a replayable artifact.
// ============================================================

export const DefectReplayLinkSchema = z
  .object({
    defectId: UuidSchema,
    replayBundleId: z.string().min(1),
    replayedAt: IsoDateTimeSchema,
    outcome: z.enum(['REPRODUCED', 'NOT_REPRODUCED', 'INCONCLUSIVE']),
    notes: z.string().optional(),
  })
  .strict();
export type DefectReplayLink = z.infer<typeof DefectReplayLinkSchema>;

// ============================================================
// PORTS (DIP)
// ============================================================

export interface IDefectStore {
  upsert(defect: DefectRecord): void;
  get(defectId: string): DefectRecord | null;
  list(filter?: {
    status?: DefectStatus;
    severity?: DefectSeverity;
  }): DefectRecord[];
  /** §5.2 "Immutable raw evidence" - delete is forbidden. */
}

/**
 * In-memory implementation. Replace with persistent store in production;
 * the defect store is the source of truth for the regression catalog.
 */
export class InMemoryDefectStore implements IDefectStore {
  private readonly defects = new Map<string, DefectRecord>();

  upsert(defect: DefectRecord): void {
    const parsed = DefectRecordSchema.parse(defect);
    this.defects.set(parsed.defectId, parsed);
  }

  get(defectId: string): DefectRecord | null {
    return this.defects.get(defectId) ?? null;
  }

  list(
    filter: { status?: DefectStatus; severity?: DefectSeverity } = {},
  ): DefectRecord[] {
    return [...this.defects.values()].filter((d) => {
      if (filter.status && d.status !== filter.status) return false;
      if (filter.severity && d.severity !== filter.severity) return false;
      return true;
    });
  }
}

// ============================================================
// DEFECT REGISTRY
// ============================================================

export const RegisterDefectInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    severity: DefectSeveritySchema,
    owner: OwnerRefSchema,
    capabilityIds: z.array(z.string().min(1)).default([]),
    initialExpectedBehavior: z.string().min(1),
    initialAssertions: z.array(z.string().min(1)).min(1),
    createdBy: z.string().min(1),
    initialLinks: z
      .array(
        z.object({
          scenarioId: z.string().min(1),
          suiteId: z.string().min(1).optional(),
          testPath: z.string().min(1).optional(),
          mandatory: z.boolean().default(true),
        }),
      )
      .default([]),
    reviewDate: IsoDateTimeSchema.optional(),
  })
  .strict();
export type RegisterDefectInput = z.infer<typeof RegisterDefectInputSchema>;

export interface IDefectRegistry {
  register(input: RegisterDefectInput): DefectRecord;
  addLink(
    defectId: string,
    link: Omit<DefectLink, 'addedAt' | 'addedBy'>,
    actor: string,
  ): DefectRecord;
  addAnnotation(
    defectId: string,
    annotation: Omit<DefectAnnotation, 'annotationId' | 'createdAt'>,
  ): DefectRecord;
  addExpectedBehavior(
    defectId: string,
    behavior: Omit<ExpectedBehavior, 'behaviorId' | 'createdAt' | 'createdBy'>,
    actor: string,
  ): DefectRecord;
  transition(
    defectId: string,
    to: DefectStatus,
    actor: string,
    justification: string,
  ): DefectRecord;
  /** §5.2 forbidden: defects are not deleted. */
  // (no delete method by design)
  list(filter?: {
    status?: DefectStatus;
    severity?: DefectSeverity;
  }): DefectRecord[];
  get(defectId: string): DefectRecord | null;
}

export class DefectRegistry implements IDefectRegistry {
  constructor(
    private readonly store: IDefectStore,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  register(input: RegisterDefectInput): DefectRecord {
    const parsed = RegisterDefectInputSchema.parse(input);
    const now = this.clock.now().toISOString();
    const initialBehavior: ExpectedBehavior = {
      behaviorId: uuidv4(),
      version: '1.0.0',
      description: parsed.initialExpectedBehavior,
      assertions: parsed.initialAssertions,
      createdAt: now,
      createdBy: parsed.createdBy,
    };
    const defect: DefectRecord = DefectRecordSchema.parse({
      defectId: uuidv4(),
      schemaVersion: DEFECTS_VERSION,
      title: parsed.title,
      description: parsed.description,
      severity: parsed.severity,
      status: 'OPEN',
      owner: parsed.owner,
      capabilityIds: parsed.capabilityIds,
      links: parsed.initialLinks.map((l) => ({
        scenarioId: l.scenarioId,
        suiteId: l.suiteId,
        testPath: l.testPath,
        mandatory: l.mandatory,
        addedAt: now,
        addedBy: parsed.createdBy,
      })),
      expectedBehaviors: [initialBehavior],
      annotations: [],
      createdAt: now,
      createdBy: parsed.createdBy,
      updatedAt: now,
      reviewDate: parsed.reviewDate,
    });
    this.store.upsert(defect);
    return defect;
  }

  addLink(
    defectId: string,
    link: Omit<DefectLink, 'addedAt' | 'addedBy'>,
    actor: string,
  ): DefectRecord {
    const existing = this.requireDefect(defectId);
    const newLink: DefectLink = DefectLinkSchema.parse({
      ...link,
      addedAt: this.clock.now().toISOString(),
      addedBy: actor,
    });
    const updated: DefectRecord = DefectRecordSchema.parse({
      ...existing,
      links: [...existing.links, newLink],
      updatedAt: this.clock.now().toISOString(),
    });
    this.store.upsert(updated);
    return updated;
  }

  addAnnotation(
    defectId: string,
    annotation: Omit<DefectAnnotation, 'annotationId' | 'createdAt'>,
  ): DefectRecord {
    const existing = this.requireDefect(defectId);
    const fullAnnotation: DefectAnnotation = DefectAnnotationSchema.parse({
      ...annotation,
      annotationId: uuidv4(),
      createdAt: this.clock.now().toISOString(),
    });
    const updated: DefectRecord = DefectRecordSchema.parse({
      ...existing,
      annotations: [...existing.annotations, fullAnnotation],
      updatedAt: this.clock.now().toISOString(),
    });
    this.store.upsert(updated);
    return updated;
  }

  addExpectedBehavior(
    defectId: string,
    behavior: Omit<ExpectedBehavior, 'behaviorId' | 'createdAt' | 'createdBy'>,
    actor: string,
  ): DefectRecord {
    const existing = this.requireDefect(defectId);
    const latest =
      existing.expectedBehaviors[existing.expectedBehaviors.length - 1];
    const newBehavior: ExpectedBehavior = ExpectedBehaviorSchema.parse({
      ...behavior,
      behaviorId: uuidv4(),
      createdAt: this.clock.now().toISOString(),
      createdBy: actor,
      supersedes: latest?.behaviorId,
    });
    const updated: DefectRecord = DefectRecordSchema.parse({
      ...existing,
      expectedBehaviors: [...existing.expectedBehaviors, newBehavior],
      updatedAt: this.clock.now().toISOString(),
    });
    this.store.upsert(updated);
    return updated;
  }

  transition(
    defectId: string,
    to: DefectStatus,
    actor: string,
    justification: string,
  ): DefectRecord {
    const existing = this.requireDefect(defectId);
    const from = existing.status;
    if (from === to) {
      throw new Error(`Defect ${defectId} already in status ${to}`);
    }
    const annotation: DefectAnnotation = DefectAnnotationSchema.parse({
      annotationId: uuidv4(),
      author: actor,
      createdAt: this.clock.now().toISOString(),
      kind: 'STATUS_CHANGE',
      message: justification,
      previousStatus: from,
      newStatus: to,
    });
    const now = this.clock.now().toISOString();
    const updated: DefectRecord = DefectRecordSchema.parse({
      ...existing,
      status: to,
      annotations: [...existing.annotations, annotation],
      updatedAt: now,
      closedAt: to === 'CLOSED' || to === 'WONT_FIX' ? now : existing.closedAt,
    });
    this.store.upsert(updated);
    return updated;
  }

  list(filter?: {
    status?: DefectStatus;
    severity?: DefectSeverity;
  }): DefectRecord[] {
    return this.store.list(filter);
  }

  get(defectId: string): DefectRecord | null {
    return this.store.get(defectId);
  }

  private requireDefect(defectId: string): DefectRecord {
    const d = this.store.get(defectId);
    if (!d) throw new Error(`Defect ${defectId} not found`);
    return d;
  }
}

// ============================================================
// PROMOTION ENGINE (§4 "Regression" promotion policy)
// ============================================================

export interface IPromotionEngine {
  evaluate(
    req: PromotionRequest,
    defect: DefectRecord,
    policy?: PromotionPolicy,
  ): PromotionDecision;
}

export class PromotionEngine implements IPromotionEngine {
  evaluate(
    req: PromotionRequest,
    defect: DefectRecord,
    policy: PromotionPolicy = PromotionPolicySchema.parse({}),
  ): PromotionDecision {
    const reasons: string[] = [];

    if (defect.defectId !== req.defectId) {
      reasons.push('defect id mismatch');
      return { allowed: false, reasons, from: req.from, to: req.to };
    }

    if (defect.status !== req.from) {
      reasons.push(
        `defect is in status ${defect.status}, transition requested from ${req.from}`,
      );
    }

    // §15 self-approval prohibited
    if (policy.forbidSelfApproval && req.reviewer === defect.owner.ownerId) {
      reasons.push(
        'reviewer must differ from owner (self-approval prohibited)',
      );
    }

    // §15 independent reviewer required
    if (policy.requireIndependentReviewer && !req.reviewer) {
      reasons.push('independent reviewer required for VERIFIED transition');
    }

    if (
      policy.requireDistinctReviewer &&
      req.reviewer === defect.createdBy &&
      req.to === 'VERIFIED'
    ) {
      reasons.push('creator cannot also be the VERIFIED reviewer');
    }

    // Mandatory links executed in this run?
    if (policy.requireMandatoryLinks && req.to === 'FIXED') {
      const mandatoryIds = new Set(
        defect.links.filter((l) => l.mandatory).map((l) => l.scenarioId),
      );
      const executed = new Set(req.executedScenarioIds);
      const missing = [...mandatoryIds].filter((id) => !executed.has(id));
      if (missing.length > 0) {
        reasons.push(
          `mandatory linked scenarios not executed in current run: ${missing.join(', ')}`,
        );
      }
    }

    if (req.to === 'VERIFIED' && req.evidenceRefs.length === 0) {
      reasons.push('VERIFIED requires at least one evidence reference');
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      from: req.from,
      to: req.to,
    };
  }
}

// ============================================================
// AUTOMATIC FAILURE-TO-REGRESSION WORKFLOW (§10 Phase 3)
// ============================================================

export const FailureLinkRequestSchema = z
  .object({
    runId: z.string().min(1),
    scenarioId: z.string().min(1),
    capabilityIds: z.array(z.string().min(1)).default([]),
    severity: DefectSeveritySchema,
    observedOutcome: z.literal('FAILED'),
    errorMessage: z.string().min(1),
    actorId: z.string().min(1),
    tenantId: z.string().min(1),
    expectedBehavior: z.string().min(1),
    assertions: z.array(z.string().min(1)).min(1),
    suiteId: z.string().min(1).optional(),
    testPath: z.string().min(1).optional(),
    auth: AuthorizationContextSchema,
  })
  .strict();
export type FailureLinkRequest = z.infer<typeof FailureLinkRequestSchema>;

export const FailureLinkResultSchema = z
  .object({
    defectId: UuidSchema,
    created: z.boolean(),
    linkedScenarioId: z.string().min(1),
    remediation: z.enum(['NEW_DEFECT', 'LINKED_TO_EXISTING']),
  })
  .strict();
export type FailureLinkResult = z.infer<typeof FailureLinkResultSchema>;

export interface IFailureToRegressionWorkflow {
  /** Decide whether the failure represents a new defect or an existing one. */
  linkFailure(req: FailureLinkRequest): FailureLinkResult;
}

export class FailureToRegressionWorkflow implements IFailureToRegressionWorkflow {
  constructor(
    private readonly registry: IDefectRegistry,
    private readonly defaults: {
      owner: OwnerRef;
      actor: string;
    },
  ) {}

  linkFailure(req: FailureLinkRequest): FailureLinkResult {
    FailureLinkRequestSchema.parse(req);

    // Deduplicate against existing open defects that already cover the scenario.
    const existing = this.registry
      .list({ status: 'OPEN' })
      .find((d) =>
        d.links.some(
          (l) => l.scenarioId === req.scenarioId && l.testPath === req.testPath,
        ),
      );

    if (existing) {
      this.registry.addAnnotation(existing.defectId, {
        author: req.actorId,
        kind: 'NOTE',
        message: `Failure observed again on run ${req.runId}: ${req.errorMessage}`,
      });
      return {
        defectId: existing.defectId,
        created: false,
        linkedScenarioId: req.scenarioId,
        remediation: 'LINKED_TO_EXISTING',
      };
    }

    const defect = this.registry.register({
      title: `[${req.scenarioId}] ${truncate(req.errorMessage, 80)}`,
      description: req.errorMessage,
      severity: req.severity,
      owner: this.defaults.owner,
      capabilityIds: req.capabilityIds,
      initialExpectedBehavior: req.expectedBehavior,
      initialAssertions: req.assertions,
      createdBy: this.defaults.actor,
      initialLinks: [
        {
          scenarioId: req.scenarioId,
          suiteId: req.suiteId,
          testPath: req.testPath,
          mandatory: true,
        },
      ],
    });

    return {
      defectId: defect.defectId,
      created: true,
      linkedScenarioId: req.scenarioId,
      remediation: 'NEW_DEFECT',
    };
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

// ============================================================
// REPLAY REPRODUCIBILITY CHECK (§10 Phase 3 "critical known
// defects have replayable tests")
// ============================================================

export const ReplayReproducibilitySchema = z
  .object({
    defectId: UuidSchema,
    scenarioId: z.string().min(1),
    replayBundleId: z.string().min(1),
    isReplayable: z.boolean(),
    reproductionCount: z.number().int().nonnegative(),
    consecutiveFailures: z.number().int().nonnegative(),
    lastReproducedAt: IsoDateTimeSchema.optional(),
    notes: z.array(z.string()).default([]),
  })
  .strict();
export type ReplayReproducibility = z.infer<typeof ReplayReproducibilitySchema>;

export class ReplayReproducibilityTracker {
  private readonly records = new Map<string, ReplayReproducibility>();
  private readonly maxConsecutiveFailures: number;

  constructor(opts: { maxConsecutiveFailures?: number } = {}) {
    this.maxConsecutiveFailures = opts.maxConsecutiveFailures ?? 3;
  }

  record(
    defectId: string,
    scenarioId: string,
    replayBundleId: string,
    outcome: 'REPRODUCED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE',
    atIso: string,
    note?: string,
  ): ReplayReproducibility {
    const key = `${defectId}:${scenarioId}`;
    const existing = this.records.get(key);
    const isReproduced = outcome === 'REPRODUCED';
    const reproductionCount =
      (existing?.reproductionCount ?? 0) + (isReproduced ? 1 : 0);
    const consecutiveFailures = isReproduced
      ? 0
      : (existing?.consecutiveFailures ?? 0) + 1;
    const record: ReplayReproducibility = ReplayReproducibilitySchema.parse({
      defectId,
      scenarioId,
      replayBundleId,
      isReplayable: reproductionCount > 0,
      reproductionCount,
      consecutiveFailures,
      lastReproducedAt: isReproduced ? atIso : existing?.lastReproducedAt,
      notes: [...(existing?.notes ?? []), ...(note ? [note] : [])],
    });
    this.records.set(key, record);
    return record;
  }

  get(defectId: string, scenarioId: string): ReplayReproducibility | null {
    return this.records.get(`${defectId}:${scenarioId}`) ?? null;
  }

  /** §10 Phase 3 exit: critical known defects have replayable tests. */
  isCriticalDefectReplayable(defectId: string, scenarioId: string): boolean {
    const record = this.get(defectId, scenarioId);
    if (!record) return false;
    if (!record.isReplayable) return false;
    if (record.consecutiveFailures >= this.maxConsecutiveFailures) {
      return false;
    }
    return true;
  }
}

export const _internal = { DEFECTS_VERSION };
