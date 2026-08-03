/**
 * NeureCore Harness - Evaluation: Rubric Registry & Graders (Phase 4)
 *
 * Implements the §9 "Evaluation" row and §10 Phase 4 deliverable:
 *   "Rubric registry; calibrated graders; statistical runner, adjudication"
 *
 * Covering §8 Evaluation Protocol:
 *   - "Version every rubric, grader prompt, grader model, threshold, and
 *      aggregation rule."
 *   - "Measure agreement against expert labels before promotion."
 *   - "Use at least two independent signals for critical subjective gates;
 *      disagreement routes to human review."
 *   - "Never use the same uncalibrated model as both system-under-test and
 *      sole judge."
 *
 * §5.2 invariants enforced here:
 *   - "Probabilistic behavior is evaluated statistically, never mislabeled
 *      deterministic."
 *   - "Failed transaction creates neither aggregate nor outbox event" — by
 *      extension, a failed grading transaction produces no score record.
 *   - "Fail closed for authorization, policy, evidence integrity, and release
 *      verdicts."
 *
 * SOLID alignment:
 *   - SRP: rubric / grader logic only; no scenario execution.
 *   - OCP: new rubric kinds and grader types register by extension.
 *   - DIP: ports only (no LLM SDK / HTTP imports).
 *
 * Document ID: NC-HARNESS-EVALUATION-RUBRICS-001
 * Version: 1.0
 * Status: PHASE_4_IMPLEMENTED
 */

import { z } from 'zod';
import {
  IsoDateTimeSchema,
  SemverSchema,
  type AuthorizationContext,
} from '../contracts';

export const RUBRIC_VERSION = '1.0.0';
export const RUBRIC_COMPATIBILITY_POLICY =
  'strict-v1: additive-dimension = minor, removed-dimension = major, threshold-removed = major';

// ============================================================
// DIMENSIONS — §8.3 initial score dimensions
// ============================================================

export const ScoreDimensionSchema = z.enum([
  'CORRECTNESS',
  'TASK_COMPLETION',
  'GROUNDING_CITATION',
  'HALLUCINATION_RISK',
  'INSTRUCTION_ADHERENCE',
  'POLICY_COMPLIANCE',
  'TOOL_CORRECTNESS',
  'BUSINESS_USEFULNESS',
  'SAFETY',
  'LATENCY',
  'COST',
]);
export type ScoreDimension = z.infer<typeof ScoreDimensionSchema>;

export const RubricDimensionInputSchema = z
  .object({
    dimension: ScoreDimensionSchema,
    weight: z.number().min(0).max(1),
    minScore: z.number().min(0).max(1).optional(),
    passThreshold: z.number().min(0).max(1).optional(),
    /** Optional axis description. */
    description: z.string().optional(),
  })
  .strict();
export type RubricDimensionInput = z.infer<typeof RubricDimensionInputSchema>;

export const RubricDimensionSchema = RubricDimensionInputSchema.transform(
  (d) => ({
    ...d,
    minScore: d.minScore ?? 0,
    passThreshold: d.passThreshold ?? 0.7,
  }),
);
export type RubricDimension = z.infer<typeof RubricDimensionSchema>;

export const AggregationRuleSchema = z.enum([
  'WEIGHTED_MEAN',
  'MIN_OF_DIMENSIONS',
  'AND_OF_DIMENSIONS',
  'CONSENSUS',
]);
export type AggregationRule = z.infer<typeof AggregationRuleSchema>;

// ============================================================
// GRADERS
// ============================================================

export const GraderTypeSchema = z.enum([
  'DETERMINISTIC', // exact match / regex / schema
  'REFERENCE_METRIC', // BLEU / ROUGE / F1 style
  'MODEL_GRADER', // LLM-as-judge
  'HUMAN', // human rater
  'STATISTICAL', // repeated trials, CI
]);
export type GraderType = z.infer<typeof GraderTypeSchema>;

export const GraderDefinitionSchema = z
  .object({
    graderId: z.string().min(1),
    version: SemverSchema,
    type: GraderTypeSchema,
    owner: z.string().min(1),
    description: z.string().min(1),
    /** For MODEL_GRADER: the model identifier. */
    graderModelRef: z
      .object({
        refId: z.string().min(1),
        version: SemverSchema,
      })
      .optional(),
    /** For MODEL_GRADER: the prompt template; not the prompt registry version. */
    graderPrompt: z.string().min(1).optional(),
    /** Active flag. */
    enabled: z.boolean().default(true),
  })
  .strict()
  .superRefine((g, ctx) => {
    if (g.type === 'MODEL_GRADER' && !g.graderModelRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MODEL_GRADER requires graderModelRef',
      });
    }
    if (g.type === 'MODEL_GRADER' && !g.graderPrompt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MODEL_GRADER requires graderPrompt',
      });
    }
  });
export type GraderDefinition = z.infer<typeof GraderDefinitionSchema>;

// ============================================================
// RUBRIC
// ============================================================

export const RubricSchema = z
  .object({
    schemaVersion: SemverSchema,
    rubricId: z.string().min(1),
    version: SemverSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    /** Evaluates only the listed dimensions. */
    dimensions: z.array(RubricDimensionSchema).min(1),
    aggregation: AggregationRuleSchema,
    /** Required grader IDs the rubric dispatches to. */
    graderIds: z.array(z.string().min(1)).min(1),
    /** Capability whitelist. */
    capabilityWhitelist: z.array(z.string().min(1)).default([]),
    /** Critical: requires two independent graders (§8.2). */
    requiresIndependentSignals: z.boolean().default(false),
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    status: z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED', 'REVOKED']),
  })
  .strict()
  .superRefine((r, ctx) => {
    const total = r.dimensions.reduce((acc, d) => acc + d.weight, 0);
    if (Math.abs(total - 1.0) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Dimension weights must sum to 1.0 (got ${total.toFixed(4)})`,
      });
    }
    if (r.requiresIndependentSignals && r.graderIds.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requiresIndependentSignals demands at least two graders',
      });
    }
  });
export type Rubric = z.infer<typeof RubricSchema>;

// ============================================================
// GRADER OUTPUT, CALIBRATION, AGREEMENT
// ============================================================

export const GraderOutputSchema = z
  .object({
    graderId: z.string().min(1),
    graderVersion: SemverSchema,
    type: GraderTypeSchema,
    dimension: ScoreDimensionSchema,
    score: z.number().min(0).max(1),
    raw: z.unknown().optional(),
    confidence: z.number().min(0).max(1).optional(),
    notes: z.string().optional(),
  })
  .strict();
export type GraderOutput = z.infer<typeof GraderOutputSchema>;

export const CalibrationReportSchema = z
  .object({
    rubricId: z.string().min(1),
    version: SemverSchema,
    sampleSize: z.number().int().nonnegative(),
    /** Cohen's Kappa against the expert labels. */
    cohensKappa: z.number().finite(),
    /** Per-class agreement index, 0..1. */
    percentAgreement: z.number().min(0).max(1),
    /** Promotable means kappa >= threshold. */
    promotable: z.boolean(),
    threshold: z.number().min(0).max(1),
    calibratedAt: IsoDateTimeSchema,
    calibratedBy: z.string().min(1),
  })
  .strict();
export type CalibrationReport = z.infer<typeof CalibrationReportSchema>;

/**
 * Compute Cohen's kappa between two raters given paired discrete labels.
 * Returns 1.0 for perfect agreement, 0 for chance, negative for worse.
 */
export function cohensKappa(
  raterA: ReadonlyArray<string>,
  raterB: ReadonlyArray<string>,
  labels: ReadonlyArray<string>,
): number {
  if (raterA.length !== raterB.length)
    throw new Error('raters must have same length');
  if (raterA.length === 0) return 0;
  const n = raterA.length;
  let agree = 0;
  const countsA = new Map<string, number>();
  const countsB = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (raterA[i] === raterB[i]) agree++;
    countsA.set(raterA[i], (countsA.get(raterA[i]) ?? 0) + 1);
    countsB.set(raterB[i], (countsB.get(raterB[i]) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const l of labels) {
    const pA = (countsA.get(l) ?? 0) / n;
    const pB = (countsB.get(l) ?? 0) / n;
    pe += pA * pB;
  }
  if (pe === 1) return 1;
  return (po - pe) / (1 - pe);
}

/** Percent agreement between two raters. */
export function percentAgreement(
  raterA: ReadonlyArray<string>,
  raterB: ReadonlyArray<string>,
): number {
  if (raterA.length === 0) return 0;
  if (raterA.length !== raterB.length)
    throw new Error('raters must have same length');
  let agree = 0;
  for (let i = 0; i < raterA.length; i++) if (raterA[i] === raterB[i]) agree++;
  return agree / raterA.length;
}

// ============================================================
// GRADER ENGINE (deterministic + reference + statistical)
// ============================================================

export interface IGraderEngine {
  runDeterministic(input: {
    graderId: string;
    output: unknown;
    expected: unknown;
    customMatcher?: (output: unknown, expected: unknown) => boolean;
  }): GraderOutput;
  runReferenceMetric(input: {
    graderId: string;
    output: string;
    reference: string;
    metric: 'EXACT_MATCH' | 'CONTAINS' | 'TOKEN_F1';
  }): GraderOutput;
  /** Statistical runner: N trials must agree within tolerance. */
  runStatistical(input: {
    graderId: string;
    trials: ReadonlyArray<GraderOutput>;
    dimension: z.infer<typeof ScoreDimensionSchema>;
    minTrials: number;
    /** Sigma tolerance for trial variance. */
    tolerance: number;
  }): GraderOutput;
  /** Calibrate a model grader against an expert-labeled reference set. */
  calibrate(input: {
    rubricId: string;
    version: string;
    raterLabels: ReadonlyArray<string>;
    expertLabels: ReadonlyArray<string>;
    threshold: number;
    ctx: AuthorizationContext;
  }): CalibrationReport;
  /** Aggregate per-dimension grader outputs into a single rubric score. */
  aggregate(input: { rubric: Rubric; outputs: ReadonlyArray<GraderOutput> }): {
    dimensionScores: Record<ScoreDimension, number>;
    weightedScore: number;
    passed: boolean;
    disagreements: Array<{
      dimension: ScoreDimension;
      sources: string[];
      range: number;
    }>;
  };
}

export const DEFAULT_CALIBRATION_THRESHOLD = 0.6;

export function createGraderEngine(): IGraderEngine {
  return {
    runDeterministic(input) {
      const match = input.customMatcher
        ? input.customMatcher(input.output, input.expected)
        : defaultDeepEqual(input.output, input.expected);
      return {
        graderId: input.graderId,
        graderVersion: '1.0.0',
        type: 'DETERMINISTIC',
        dimension: 'CORRECTNESS',
        score: match ? 1 : 0,
        raw: { output: input.output, expected: input.expected },
      };
    },

    runReferenceMetric(input) {
      const out = input.output ?? '';
      const ref = input.reference ?? '';
      let score: number;
      switch (input.metric) {
        case 'EXACT_MATCH':
          score = out.trim() === ref.trim() ? 1 : 0;
          break;
        case 'CONTAINS':
          score = out.includes(ref) ? 1 : 0;
          break;
        case 'TOKEN_F1':
          score = tokenF1(out, ref);
          break;
      }
      return {
        graderId: input.graderId,
        graderVersion: '1.0.0',
        type: 'REFERENCE_METRIC',
        dimension: 'CORRECTNESS',
        score,
        raw: { metric: input.metric, output: out, reference: ref },
      };
    },

    runStatistical(input) {
      if (input.trials.length < input.minTrials) {
        throw new Error(
          `Statistical run requires at least ${input.minTrials} trials; got ${input.trials.length}`,
        );
      }
      const scores = input.trials.map((t) => t.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance =
        scores.length === 1
          ? 0
          : scores.reduce((a, b) => a + (b - mean) ** 2, 0) /
            (scores.length - 1);
      const stddev = Math.sqrt(variance);
      if (stddev > input.tolerance) {
        throw new Error(
          `Statistical run variance ${stddev.toFixed(4)} exceeds tolerance ${input.tolerance}`,
        );
      }
      return {
        graderId: input.graderId,
        graderVersion: '1.0.0',
        type: 'STATISTICAL',
        dimension: input.dimension,
        score: mean,
        raw: {
          mean,
          stddev,
          trialCount: scores.length,
          tolerance: input.tolerance,
        },
        confidence: Math.max(0, 1 - stddev),
      };
    },

    calibrate(input) {
      if (input.raterLabels.length !== input.expertLabels.length) {
        throw new Error('rater and expert labels must have same length');
      }
      const labels = Array.from(
        new Set([...input.raterLabels, ...input.expertLabels]),
      );
      const kappa = cohensKappa(input.raterLabels, input.expertLabels, labels);
      const agreement = percentAgreement(input.raterLabels, input.expertLabels);
      const promotable =
        kappa >= input.threshold && input.raterLabels.length > 0;
      return {
        rubricId: input.rubricId,
        version: input.version,
        sampleSize: input.raterLabels.length,
        cohensKappa: kappa,
        percentAgreement: agreement,
        promotable,
        threshold: input.threshold,
        calibratedAt: new Date().toISOString(),
        calibratedBy: input.ctx.actorId,
      };
    },

    aggregate(input) {
      const dimensionScores = {} as Record<ScoreDimension, number>;
      const sources: Record<ScoreDimension, string[]> = {} as Record<
        ScoreDimension,
        string[]
      >;
      for (const d of input.rubric.dimensions) {
        const dim = d.dimension;
        const relevant = input.outputs.filter((o) => o.dimension === dim);
        if (relevant.length === 0) {
          dimensionScores[dim] = 0;
        } else {
          const mean =
            relevant.reduce((a, b) => a + b.score, 0) / relevant.length;
          dimensionScores[dim] = mean;
        }
        sources[dim] = relevant.map((o) => `${o.graderId}@${o.graderVersion}`);
      }
      let weightedScore = 0;
      switch (input.rubric.aggregation) {
        case 'WEIGHTED_MEAN':
          weightedScore = input.rubric.dimensions.reduce(
            (acc, d) => acc + d.weight * (dimensionScores[d.dimension] ?? 0),
            0,
          );
          break;
        case 'MIN_OF_DIMENSIONS':
          weightedScore = Math.min(
            ...input.rubric.dimensions.map(
              (d) => dimensionScores[d.dimension] ?? 0,
            ),
          );
          break;
        case 'AND_OF_DIMENSIONS':
          weightedScore = input.rubric.dimensions.every(
            (d) => (dimensionScores[d.dimension] ?? 0) >= d.passThreshold,
          )
            ? 1
            : 0;
          break;
        case 'CONSENSUS':
          weightedScore = input.rubric.dimensions.every(
            (d) => (dimensionScores[d.dimension] ?? 0) >= d.passThreshold,
          )
            ? 1
            : 0;
          break;
      }
      const passed = input.rubric.dimensions.every(
        (d) => (dimensionScores[d.dimension] ?? 0) >= d.passThreshold,
      );
      const disagreements: Array<{
        dimension: ScoreDimension;
        sources: string[];
        range: number;
      }> = [];
      for (const d of input.rubric.dimensions) {
        const dim = d.dimension;
        const relevant = input.outputs.filter((o) => o.dimension === dim);
        if (relevant.length < 2) continue;
        const min = Math.min(...relevant.map((o) => o.score));
        const max = Math.max(...relevant.map((o) => o.score));
        if (max - min > 0.2) {
          disagreements.push({
            dimension: dim,
            sources: relevant.map((o) => `${o.graderId}@${o.graderVersion}`),
            range: max - min,
          });
        }
      }
      return {
        dimensionScores,
        weightedScore,
        passed,
        disagreements,
      };
    },
  };
}

// ============================================================
// UTILITIES
// ============================================================

function defaultDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (
        !defaultDeepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function tokenF1(output: string, reference: string): number {
  const outToks = tokenize(output);
  const refToks = tokenize(reference);
  if (outToks.length === 0 || refToks.length === 0) return 0;
  const common = countCommon(outToks, refToks);
  const precision = common / outToks.length;
  const recall = common / refToks.length;
  if (precision === 0 || recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function countCommon(a: string[], b: string[]): number {
  const counts = new Map<string, number>();
  for (const t of a) counts.set(t, (counts.get(t) ?? 0) + 1);
  let n = 0;
  for (const t of b) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      counts.set(t, c - 1);
      n++;
    }
  }
  return n;
}

// ============================================================
// RUBRIC REGISTRY PORT
// ============================================================

export interface IRubricRegistry {
  registerRubric(
    input: z.input<typeof RegisterRubricInputSchema>,
    ctx: AuthorizationContext,
  ): Rubric;
  registerGrader(
    input: GraderDefinition,
    ctx: AuthorizationContext,
  ): GraderDefinition;
  supersedeRubric(input: {
    rubricId: string;
    newVersion: z.infer<typeof SemverSchema>;
    dimensions: RubricDimension[];
    graderIds: string[];
    changelog: string;
    ctx: AuthorizationContext;
  }): Rubric;
  revoke(rubricId: string, version: string, ctx: AuthorizationContext): Rubric;
  getRubric(rubricId: string, version: string): Rubric | undefined;
  getActiveRubric(rubricId: string): Rubric | undefined;
  getGrader(graderId: string, version: string): GraderDefinition | undefined;
  listRubrics(rubricId: string): Rubric[];
  listGraders(): GraderDefinition[];
  searchRubrics(query: { rubricId?: string; capabilityId?: string }): Rubric[];
}

export const RegisterRubricInputSchema = z
  .object({
    rubricId: z.string().min(1),
    version: SemverSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    dimensions: z.array(RubricDimensionInputSchema).min(1),
    aggregation: AggregationRuleSchema,
    graderIds: z.array(z.string().min(1)).min(1),
    capabilityWhitelist: z.array(z.string().min(1)).default([]),
    requiresIndependentSignals: z.boolean().default(false),
    status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT'),
  })
  .strict();
export type RegisterRubricInput = z.infer<typeof RegisterRubricInputSchema>;

export class InMemoryRubricRegistry implements IRubricRegistry {
  private readonly rubrics = new Map<string, Rubric[]>();
  private readonly rubricByKey = new Map<string, Rubric>();
  private readonly graders = new Map<string, GraderDefinition[]>();
  private readonly graderByKey = new Map<string, GraderDefinition>();

  private rKey(rubricId: string, version: string): string {
    return `${rubricId}@${version}`;
  }
  private gKey(graderId: string, version: string): string {
    return `${graderId}@${version}`;
  }

  registerRubric(
    input: z.input<typeof RegisterRubricInputSchema>,
    ctx: AuthorizationContext,
  ): Rubric {
    const allowed = ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER', 'ARCHITECTURE'];
    if (
      !ctx.actorRoles.some((r) => allowed.includes(r as never)) &&
      ctx.isSuperAdmin !== true
    ) {
      throw new Error(
        `Authorization denied for actor ${ctx.actorId} (missing rubric role)`,
      );
    }
    // Verify all graderIds exist.
    for (const gid of input.graderIds) {
      const found = this.graders.get(gid) ?? [];
      if (found.length === 0) {
        throw new Error(`Grader not registered: ${gid}`);
      }
    }
    const normalizedDimensions = input.dimensions.map((d) =>
      RubricDimensionSchema.parse(d),
    );
    const rubric: Rubric = RubricSchema.parse({
      schemaVersion: RUBRIC_VERSION,
      rubricId: input.rubricId,
      version: input.version,
      title: input.title,
      description: input.description,
      owner: input.owner,
      dimensions: normalizedDimensions,
      aggregation: input.aggregation,
      graderIds: input.graderIds,
      capabilityWhitelist: input.capabilityWhitelist,
      requiresIndependentSignals: input.requiresIndependentSignals,
      createdAt: new Date().toISOString(),
      createdBy: ctx.actorId,
      status: input.status,
    });
    const list = this.rubrics.get(rubric.rubricId) ?? [];
    if (list.some((v) => v.version === rubric.version)) {
      throw new Error(
        `Rubric version already exists: ${rubric.rubricId}@${rubric.version}`,
      );
    }
    list.push(rubric);
    this.rubrics.set(rubric.rubricId, list);
    this.rubricByKey.set(this.rKey(rubric.rubricId, rubric.version), rubric);
    return rubric;
  }

  registerGrader(
    input: GraderDefinition,
    ctx: AuthorizationContext,
  ): GraderDefinition {
    const allowed = ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER', 'ARCHITECTURE'];
    if (
      !ctx.actorRoles.some((r) => allowed.includes(r as never)) &&
      ctx.isSuperAdmin !== true
    ) {
      throw new Error(
        `Authorization denied for actor ${ctx.actorId} (missing grader role)`,
      );
    }
    const grader = GraderDefinitionSchema.parse(input);
    const list = this.graders.get(grader.graderId) ?? [];
    if (list.some((g) => g.version === grader.version)) {
      throw new Error(
        `Grader version already exists: ${grader.graderId}@${grader.version}`,
      );
    }
    list.push(grader);
    this.graders.set(grader.graderId, list);
    this.graderByKey.set(this.gKey(grader.graderId, grader.version), grader);
    return grader;
  }

  supersedeRubric(input: {
    rubricId: string;
    newVersion: z.infer<typeof SemverSchema>;
    dimensions: RubricDimensionInput[];
    graderIds: string[];
    changelog: string;
    ctx: AuthorizationContext;
  }): Rubric {
    const list = this.rubrics.get(input.rubricId) ?? [];
    const latest = list[list.length - 1];
    if (!latest)
      throw new Error(
        `Cannot supersede: rubric ${input.rubricId} has no prior version`,
      );
    const next = this.registerRubric(
      RegisterRubricInputSchema.parse({
        rubricId: input.rubricId,
        version: input.newVersion,
        title: `[SUPERSEDES ${latest.version}] ${latest.title}`,
        description: latest.description,
        owner: latest.owner,
        dimensions: input.dimensions,
        aggregation: latest.aggregation,
        graderIds: input.graderIds,
        capabilityWhitelist: latest.capabilityWhitelist,
        requiresIndependentSignals: latest.requiresIndependentSignals,
        status: 'DRAFT',
      }),
      input.ctx,
    );
    return next;
  }

  revoke(rubricId: string, version: string, ctx: AuthorizationContext): Rubric {
    void ctx;
    const key = this.rKey(rubricId, version);
    const existing = this.rubricByKey.get(key);
    if (!existing) throw new Error(`Rubric not found: ${key}`);
    const revoked: Rubric = { ...existing, status: 'REVOKED' };
    this.rubricByKey.set(key, revoked);
    const list = this.rubrics.get(rubricId) ?? [];
    const idx = list.findIndex((v) => v.version === version);
    if (idx >= 0) list[idx] = revoked;
    this.rubrics.set(rubricId, list);
    return revoked;
  }

  getRubric(rubricId: string, version: string): Rubric | undefined {
    return this.rubricByKey.get(this.rKey(rubricId, version));
  }

  getActiveRubric(rubricId: string): Rubric | undefined {
    return (this.rubrics.get(rubricId) ?? []).find(
      (r) => r.status === 'ACTIVE',
    );
  }

  getGrader(graderId: string, version: string): GraderDefinition | undefined {
    return this.graderByKey.get(this.gKey(graderId, version));
  }

  listRubrics(rubricId: string): Rubric[] {
    return [...(this.rubrics.get(rubricId) ?? [])];
  }

  listGraders(): GraderDefinition[] {
    const out: GraderDefinition[] = [];
    for (const list of this.graders.values()) out.push(...list);
    return out;
  }

  searchRubrics(query: { rubricId?: string; capabilityId?: string }): Rubric[] {
    const all: Rubric[] = [];
    for (const list of this.rubrics.values()) all.push(...list);
    return all.filter((r) => {
      if (query.rubricId && r.rubricId !== query.rubricId) return false;
      if (
        query.capabilityId &&
        r.capabilityWhitelist.length > 0 &&
        !r.capabilityWhitelist.includes(query.capabilityId)
      ) {
        return false;
      }
      return true;
    });
  }
}
