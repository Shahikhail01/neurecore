/**
 * NeureCore Harness - Evaluation Dataset Registry (Phase 4)
 *
 * Implements the §9 "Evaluation" row and §10 Phase 4 deliverable:
 *   "Curated/versioned evaluation datasets ... golden sets, uncertainty and
 *    inter-rater checks."
 *
 * Covering §8 Evaluation Protocol:
 *   - "Maintain blinded golden examples including pass, fail, borderline, and
 *      adversarial cases."
 *   - "Report sample size, variance, confidence interval, and insufficient-
 *      evidence outcomes."
 *   - "Never use the same uncalibrated model as both system-under-test and
 *      sole judge."
 *
 * §5.2 invariants enforced here:
 *   - "Secure and tenant-scoped by default; missing tenant context is an
 *      error."
 *   - "Immutable raw evidence; corrections create new versions or annotations."
 *   - "Dataset version, validation report, drift status and downstream impact
 *      mapping" (§4 row "Data Quality").
 *
 * SOLID alignment:
 *   - SRP: dataset registry only; no grading or execution logic.
 *   - OCP: new dataset/case kinds register via discriminated unions.
 *   - DIP: ports only (no Prisma / Redis / external HTTP imports).
 *
 * Document ID: NC-HARNESS-EVALUATION-DATASETS-001
 * Version: 1.0
 * Status: PHASE_4_IMPLEMENTED
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  Sha256ChecksumSchema,
  type AuthorizationContext,
} from '../contracts';

// ============================================================
// VERSION
// ============================================================

export const EVALUATION_DATASETS_VERSION = '1.0.0';
export const EVALUATION_DATASETS_COMPATIBILITY_POLICY =
  'strict-v1: additive-case = minor, required-case-removed = major, rubric-binding-changed = major';

export const DatasetVisibilitySchema = z.enum([
  'PUBLIC', // visible to all consumers incl. training
  'INTERNAL', // visible to internal eval consumers
  'BLINDED', // held-out; never visible to system under test
  'EXPERT_ONLY', // human-rater only
]);
export type DatasetVisibility = z.infer<typeof DatasetVisibilitySchema>;

export const DatasetCaseLabelSchema = z.enum([
  'PASS',
  'FAIL',
  'BORDERLINE',
  'ADVERSARIAL',
  'AMBIGUOUS',
  'GOLD', // tested result, must match expected
]);
export type DatasetCaseLabel = z.infer<typeof DatasetCaseLabelSchema>;

// ============================================================
// CASES
// ============================================================

export const EvaluationCaseSchema = z
  .object({
    caseId: z.string().min(1),
    /** Capability this case exercises. */
    capabilityId: z.string().min(1),
    /** Free-text category for grouping. */
    category: z.string().min(1),
    label: DatasetCaseLabelSchema,
    /** Tenant scope; required for §5.2 tenant discipline. */
    tenantId: UuidSchema,
    /** Input presented to the system under test. */
    input: z.record(z.unknown(), z.unknown()),
    /** Optional expected output; required for GOLD label. */
    expected: z.unknown().optional(),
    /** Reference citations (RAG cases). */
    expectedCitations: z.array(z.string().min(1)).default([]),
    /** Optional human-authored rubric scoring anchors. */
    expertScore: z.number().finite().optional(),
    /** Seed for deterministic re-runs. */
    seed: z.string().min(1).optional(),
    /** Tags for filtering. */
    tags: z.array(z.string().min(1)).default([]),
    /** Difficulty bucket. */
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).default('MEDIUM'),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.label === 'GOLD' && c.expected === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOLD case must include expected output',
      });
    }
  });
export type EvaluationCase = z.infer<typeof EvaluationCaseSchema>;

// ============================================================
// DATASET
// ============================================================

export const EvaluationDatasetSchema = z
  .object({
    schemaVersion: SemverSchema,
    datasetId: z.string().min(1),
    version: SemverSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    visibility: DatasetVisibilitySchema,
    cases: z.array(EvaluationCaseSchema).min(1),
    /** Deterministic ordering for reproducible runs. */
    sortedCaseIds: z.array(z.string().min(1)),
    contentChecksum: Sha256ChecksumSchema,
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    /** Required labelset for the dataset to be considered complete. */
    requiredLabels: z.array(DatasetCaseLabelSchema).min(1),
    /** Previous version this one supersedes. */
    supersedes: SemverSchema.optional(),
    /** Status. */
    status: z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED', 'REVOKED']),
    /** Capability bindings — what this dataset is allowed to evaluate. */
    capabilityWhitelist: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((d, ctx) => {
    // BLINDED datasets must not include GOLD cases (they are for holdout).
    if (d.visibility === 'BLINDED') {
      const hasGold = d.cases.some((c) => c.label === 'GOLD');
      if (hasGold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BLINDED datasets cannot contain GOLD cases',
        });
      }
    }
    // All sortedCaseIds must exist.
    const ids = new Set(d.cases.map((c) => c.caseId));
    for (const cid of d.sortedCaseIds) {
      if (!ids.has(cid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `sortedCaseId references unknown case: ${cid}`,
        });
      }
    }
    // Required labels must be present.
    const presentLabels = new Set(d.cases.map((c) => c.label));
    for (const required of d.requiredLabels) {
      if (!presentLabels.has(required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `dataset is missing required label: ${required}`,
        });
      }
    }
  });
export type EvaluationDataset = z.infer<typeof EvaluationDatasetSchema>;

// ============================================================
// CONFLICT / POISONING DETECTION (§14 row "Test poisoning")
// ============================================================

export const DatasetConflictSchema = z
  .object({
    caseIdA: z.string().min(1),
    caseIdB: z.string().min(1),
    kind: z.enum(['DUPLICATE_INPUT', 'INVERSE_LABEL', 'EXPERT_DISAGREEMENT']),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    message: z.string().min(1),
  })
  .strict();
export type DatasetConflict = z.infer<typeof DatasetConflictSchema>;

export interface IStatement {
  statement: string;
}

export function detectDuplicates(d: EvaluationDataset): DatasetConflict[] {
  const conflicts: DatasetConflict[] = [];
  const seen = new Map<string, string>();
  for (const c of d.cases) {
    const key = canonicalizeInput(c.input);
    const prior = seen.get(key);
    if (prior) {
      conflicts.push({
        caseIdA: prior,
        caseIdB: c.caseId,
        kind: 'DUPLICATE_INPUT',
        severity: 'HIGH',
        message: `Duplicate input key between ${prior} and ${c.caseId}`,
      });
    } else {
      seen.set(key, c.caseId);
    }
  }
  return conflicts;
}

export function detectInverseLabels(d: EvaluationDataset): DatasetConflict[] {
  const conflicts: DatasetConflict[] = [];
  const buckets = new Map<string, Map<string, string[]>>();
  for (const c of d.cases) {
    const key = canonicalizeInput(c.input);
    const labels = buckets.get(key) ?? new Map<string, string[]>();
    const arr = labels.get(c.label) ?? [];
    arr.push(c.caseId);
    labels.set(c.label, arr);
    buckets.set(key, labels);
  }
  for (const [key, labels] of buckets) {
    // Both a PASS and a FAIL claim against the same input is an inverse label.
    if (labels.has('PASS') && labels.has('FAIL')) {
      conflicts.push({
        caseIdA: labels.get('PASS')![0],
        caseIdB: labels.get('FAIL')![0],
        kind: 'INVERSE_LABEL',
        severity: 'CRITICAL',
        message: `Inverse labels for identical input under key ${key.slice(0, 32)}`,
      });
    }
  }
  return conflicts;
}

export function detectExpertDisagreement(
  d: EvaluationDataset,
): DatasetConflict[] {
  const conflicts: DatasetConflict[] = [];
  for (const c of d.cases) {
    if (c.expected === undefined || c.expertScore === undefined) continue;
    // Heuristic: if the label is GOLD but the expert score deviates from
    // 1.0 by more than 0.5, treat as disagreement signal.
    if (c.label === 'GOLD' && Math.abs(c.expertScore - 1.0) > 0.5) {
      conflicts.push({
        caseIdA: c.caseId,
        caseIdB: c.caseId,
        kind: 'EXPERT_DISAGREEMENT',
        severity: 'MEDIUM',
        message: `GOLD case has expert score ${c.expertScore}`,
      });
    }
  }
  return conflicts;
}

export function detectDatasetConflicts(
  d: EvaluationDataset,
): DatasetConflict[] {
  return [
    ...detectDuplicates(d),
    ...detectInverseLabels(d),
    ...detectExpertDisagreement(d),
  ];
}

// ============================================================
// INTEGRITY / CHECKSUM
// ============================================================

export function canonicalizeInput(input: Record<string, unknown>): string {
  const sortedKeys = Object.keys(input).sort();
  const obj: Record<string, unknown> = {};
  for (const k of sortedKeys) obj[k] = input[k];
  return JSON.stringify(obj);
}

export function computeDatasetChecksum(d: EvaluationDataset): string {
  const canonical = JSON.stringify({
    datasetId: d.datasetId,
    version: d.version,
    cases: d.cases.map((c) => ({
      caseId: c.caseId,
      capabilityId: c.capabilityId,
      category: c.category,
      label: c.label,
      tenantId: c.tenantId,
      input: c.input,
      expected: c.expected ?? null,
      expectedCitations: c.expectedCitations,
      expertScore: c.expertScore ?? null,
      seed: c.seed ?? null,
      tags: c.tags,
      difficulty: c.difficulty,
    })),
    sortedCaseIds: d.sortedCaseIds,
  });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

// ============================================================
// REGISTRY PORT
// ============================================================

export interface IEvaluationDatasetRegistry {
  register(
    input: RegisterDatasetInput,
    ctx: AuthorizationContext,
  ): EvaluationDataset;
  supersede(input: {
    datasetId: string;
    newVersion: z.infer<typeof SemverSchema>;
    additionalCases: EvaluationCase[];
    changelog: string;
    ctx: AuthorizationContext;
  }): EvaluationDataset;
  get(datasetId: string, version: string): EvaluationDataset | undefined;
  getActive(datasetId: string): EvaluationDataset | undefined;
  list(datasetId: string): EvaluationDataset[];
  listAll(): EvaluationDataset[];
  search(query: {
    datasetId?: string;
    visibility?: DatasetVisibility;
    tag?: string;
    capabilityId?: string;
  }): EvaluationDataset[];
  resolveCases(input: {
    datasetId: string;
    version: string;
    visibilityFilter: ReadonlyArray<DatasetVisibility>;
    capabilityId: string;
    limit?: number;
    seed?: string;
  }): EvaluationCase[];
  reject(input: {
    datasetId: string;
    version: string;
    conflicts: ReadonlyArray<DatasetConflict>;
    ctx: AuthorizationContext;
  }): never;
  conflicts(datasetId: string, version: string): DatasetConflict[];
}

export const RegisterDatasetInputSchema = z
  .object({
    datasetId: z.string().min(1),
    version: SemverSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    visibility: DatasetVisibilitySchema,
    cases: z.array(EvaluationCaseSchema).min(1),
    requiredLabels: z.array(DatasetCaseLabelSchema).min(1),
    capabilityWhitelist: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
    status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT'),
  })
  .strict();
export type RegisterDatasetInput = z.infer<typeof RegisterDatasetInputSchema>;

// ============================================================
// IN-MEMORY REGISTRY
// ============================================================

export class InMemoryEvaluationDatasetRegistry implements IEvaluationDatasetRegistry {
  private readonly byDataset = new Map<string, EvaluationDataset[]>();
  private readonly byKey = new Map<string, EvaluationDataset>();
  private readonly conflictsByKey = new Map<string, DatasetConflict[]>();

  private key(datasetId: string, version: string): string {
    return `${datasetId}@${version}`;
  }

  register(
    input: RegisterDatasetInput,
    ctx: AuthorizationContext,
  ): EvaluationDataset {
    const allowed = [
      'DOMAIN_OWNER',
      'QA_LEAD',
      'EVALUATOR',
      'SECURITY',
      'ARCHITECTURE',
    ];
    if (
      !ctx.actorRoles.some((r) => allowed.includes(r as never)) &&
      ctx.isSuperAdmin !== true
    ) {
      throw new Error(
        `Authorization denied for actor ${ctx.actorId} (missing eval-dataset role)`,
      );
    }
    const sortedCaseIds = [...input.cases.map((c) => c.caseId)].sort();
    const dataset: EvaluationDataset = EvaluationDatasetSchema.parse({
      schemaVersion: EVALUATION_DATASETS_VERSION,
      datasetId: input.datasetId,
      version: input.version,
      name: input.name,
      description: input.description,
      owner: input.owner,
      visibility: input.visibility,
      cases: input.cases,
      sortedCaseIds,
      contentChecksum: 'sha256:'.padEnd(7 + 64, '0'), // patched below
      createdAt: new Date().toISOString(),
      createdBy: ctx.actorId,
      requiredLabels: input.requiredLabels,
      status: input.status,
      capabilityWhitelist: input.capabilityWhitelist,
      tags: input.tags,
    });
    dataset.contentChecksum = computeDatasetChecksum(dataset);
    // Conflict detection runs before accept.
    const conflicts = detectDatasetConflicts(dataset);
    this.conflictsByKey.set(
      this.key(dataset.datasetId, dataset.version),
      conflicts,
    );
    if (conflicts.some((c) => c.severity === 'CRITICAL')) {
      throw new Error(
        `Dataset registration blocked: CRITICAL conflict (${conflicts.find((c) => c.severity === 'CRITICAL')?.kind})`,
      );
    }
    const list = this.byDataset.get(dataset.datasetId) ?? [];
    if (list.some((v) => v.version === dataset.version)) {
      throw new Error(
        `Dataset version already exists: ${dataset.datasetId}@${dataset.version}`,
      );
    }
    list.push(dataset);
    this.byDataset.set(dataset.datasetId, list);
    this.byKey.set(this.key(dataset.datasetId, dataset.version), dataset);
    return dataset;
  }

  supersede(input: {
    datasetId: string;
    newVersion: z.infer<typeof SemverSchema>;
    additionalCases: EvaluationCase[];
    changelog: string;
    ctx: AuthorizationContext;
  }): EvaluationDataset {
    const list = this.byDataset.get(input.datasetId) ?? [];
    const latest = list[list.length - 1];
    if (!latest) {
      throw new Error(
        `Cannot supersede: dataset ${input.datasetId} has no prior version`,
      );
    }
    const cases = [...latest.cases, ...input.additionalCases];
    const next = this.register(
      RegisterDatasetInputSchema.parse({
        datasetId: input.datasetId,
        version: input.newVersion,
        name: latest.name,
        description: latest.description,
        owner: latest.owner,
        visibility: latest.visibility,
        cases,
        requiredLabels: latest.requiredLabels,
        capabilityWhitelist: latest.capabilityWhitelist,
        tags: latest.tags,
        status: 'DRAFT',
      }),
      input.ctx,
    );
    next.supersedes = latest.version;
    return next;
  }

  get(datasetId: string, version: string): EvaluationDataset | undefined {
    return this.byKey.get(this.key(datasetId, version));
  }

  getActive(datasetId: string): EvaluationDataset | undefined {
    return (this.byDataset.get(datasetId) ?? []).find(
      (d) => d.status === 'ACTIVE',
    );
  }

  list(datasetId: string): EvaluationDataset[] {
    return [...(this.byDataset.get(datasetId) ?? [])];
  }

  listAll(): EvaluationDataset[] {
    const out: EvaluationDataset[] = [];
    for (const list of this.byDataset.values()) out.push(...list);
    return out;
  }

  search(query: {
    datasetId?: string;
    visibility?: DatasetVisibility;
    tag?: string;
    capabilityId?: string;
  }): EvaluationDataset[] {
    const all = this.listAll();
    return all.filter((d) => {
      if (query.datasetId && d.datasetId !== query.datasetId) return false;
      if (query.visibility && d.visibility !== query.visibility) return false;
      if (query.tag && !d.tags.includes(query.tag)) return false;
      if (
        query.capabilityId &&
        d.capabilityWhitelist.length > 0 &&
        !d.capabilityWhitelist.includes(query.capabilityId)
      ) {
        return false;
      }
      return true;
    });
  }

  resolveCases(input: {
    datasetId: string;
    version: string;
    visibilityFilter: ReadonlyArray<DatasetVisibility>;
    capabilityId: string;
    limit?: number;
    seed?: string;
  }): EvaluationCase[] {
    const dataset = this.get(input.datasetId, input.version);
    if (!dataset)
      throw new Error(`Dataset not found: ${input.datasetId}@${input.version}`);
    if (dataset.status !== 'ACTIVE') {
      throw new Error(
        `Dataset ${input.datasetId}@${input.version} is not ACTIVE`,
      );
    }
    if (
      dataset.capabilityWhitelist.length > 0 &&
      !dataset.capabilityWhitelist.includes(input.capabilityId)
    ) {
      throw new Error(
        `Capability ${input.capabilityId} not permitted to use dataset ${input.datasetId}`,
      );
    }
    let cases = dataset.cases.filter((c) => {
      if (c.capabilityId !== input.capabilityId) return false;
      return input.visibilityFilter.includes(dataset.visibility);
    });
    // Stable order using sortedCaseIds.
    const order = new Map(
      dataset.sortedCaseIds.map((id, idx) => [id, idx] as const),
    );
    cases = [...cases].sort(
      (a, b) => (order.get(a.caseId) ?? 0) - (order.get(b.caseId) ?? 0),
    );
    // Seeded shuffle: derive a numeric key from seed and skip through.
    if (input.seed) {
      const seedN = hashSeed(input.seed);
      cases = seededShuffle(cases, seedN);
    }
    if (input.limit !== undefined) cases = cases.slice(0, input.limit);
    return cases;
  }

  reject(input: {
    datasetId: string;
    version: string;
    conflicts: ReadonlyArray<DatasetConflict>;
    ctx: AuthorizationContext;
  }): never {
    const allowed = ['QA_LEAD', 'SECURITY', 'DOMAIN_OWNER', 'ARCHITECTURE'];
    if (
      !input.ctx.actorRoles.some((r) => allowed.includes(r as never)) &&
      input.ctx.isSuperAdmin !== true
    ) {
      throw new Error(
        `Authorization denied for actor ${input.ctx.actorId} (missing reject role)`,
      );
    }
    const key = this.key(input.datasetId, input.version);
    const dataset = this.byKey.get(key);
    if (!dataset) throw new Error(`Dataset not found: ${key}`);
    const next: EvaluationDataset = { ...dataset, status: 'REVOKED' };
    this.byKey.set(key, next);
    const list = this.byDataset.get(input.datasetId) ?? [];
    const idx = list.findIndex((d) => d.version === input.version);
    if (idx >= 0) list[idx] = next;
    this.byDataset.set(input.datasetId, list);
    this.conflictsByKey.set(key, [
      ...(this.conflictsByKey.get(key) ?? []),
      ...input.conflicts,
    ]);
    throw new Error(
      `Dataset ${key} rejected: ${input.conflicts.map((c) => c.kind).join(', ')}`,
    );
  }

  conflicts(datasetId: string, version: string): DatasetConflict[] {
    return [...(this.conflictsByKey.get(this.key(datasetId, version)) ?? [])];
  }
}

// ============================================================
// STATISTICAL UTILITIES
// ============================================================

function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 0x9c8e1f7a);
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface SampleStats {
  count: number;
  mean: number;
  variance: number;
  stddev: number;
  ci95: [number, number];
  /** Wilson 95% CI for a binary pass rate. */
  passRateCi95?: [number, number];
}

/** Compute mean / variance / stddev / 95% CI for a sample. */
export function computeSampleStats(values: readonly number[]): SampleStats {
  if (values.length === 0) {
    return { count: 0, mean: 0, variance: 0, stddev: 0, ci95: [0, 0] };
  }
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.length === 1
      ? 0
      : values.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
        (values.length - 1);
  const stddev = Math.sqrt(variance);
  // 95% CI using 1.96 for n >= 30; otherwise t-table for small n.
  const z = values.length >= 30 ? 1.96 : t95(values.length - 1);
  const half = z * (stddev / Math.sqrt(values.length));
  return {
    count: values.length,
    mean,
    variance,
    stddev,
    ci95: [mean - half, mean + half],
  };
}

/** Wilson 95% CI for a binary proportion. */
export function wilsonInterval(
  passes: number,
  total: number,
): [number, number] {
  if (total === 0) return [0, 0];
  const z = 1.96;
  const p = passes / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
    denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** Approximate t critical value for 95% two-sided CI. */
function t95(df: number): number {
  // Hard-coded small-samples table; for df >= 30 we use 1.96.
  const table: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.16,
    14: 2.145,
    15: 2.131,
    16: 2.12,
    17: 2.11,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    21: 2.08,
    22: 2.074,
    23: 2.069,
    24: 2.064,
    25: 2.06,
    26: 2.056,
    27: 2.052,
    28: 2.048,
    29: 2.045,
    30: 2.042,
  };
  return table[df] ?? 1.96;
}

export function binomialStats(passes: number, total: number): SampleStats {
  const rate = total === 0 ? 0 : passes / total;
  const variance = total === 0 ? 0 : (rate * (1 - rate)) / total;
  const stddev = Math.sqrt(variance);
  const ci = wilsonInterval(passes, total);
  return {
    count: total,
    mean: rate,
    variance,
    stddev,
    ci95: ci,
    passRateCi95: ci,
  };
}
