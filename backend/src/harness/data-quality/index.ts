/**
 * NeureCore Harness - Data Quality (Phase 3)
 *
 * Implements the Data Quality closure from §4 and §9 row "Data Quality":
 *   - Data contracts
 *   - Schema / referential / semantic validation
 *   - Lineage
 *   - Drift detection
 *   - Quarantine and repair (delegated to harness/quarantine)
 *
 * §10 Phase 3 exit: "fixture and cleanup reliability meet agreed thresholds"
 * (the data-quality fixtures integrate with harness/fixtures).
 *
 * SOLID alignment:
 *   - SRP: data quality only; no execution logic.
 *   - OCP: new contract kinds and validators added by registration.
 *   - DIP: ports only.
 *
 * Document ID: NC-HARNESS-DATA-QUALITY-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  Sha256ChecksumSchema,
  type AuthorizationContext,
} from '../contracts';

export const DATA_QUALITY_VERSION = '1.0.0';

// ============================================================
// DATA CONTRACT
// ============================================================

export const DataContractKindSchema = z.enum([
  'SCHEMA',
  'REFERENTIAL',
  'SEMANTIC',
  'STREAMING',
  'METRIC',
]);
export type DataContractKind = z.infer<typeof DataContractKindSchema>;

export const DataContractFieldSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    nullable: z.boolean().default(false),
    description: z.string().optional(),
    pii: z.boolean().optional().default(false),
  })
  .strict();
export type DataContractField = z.infer<typeof DataContractFieldSchema>;

export const DataContractSchema = z
  .object({
    contractId: z.string().min(1),
    name: z.string().min(1),
    kind: DataContractKindSchema,
    version: SemverSchema,
    owner: z.string().min(1),
    fields: z.array(DataContractFieldSchema).default([]),
    /** For REFERENTIAL contracts. */
    references: z
      .array(
        z.object({
          field: z.string().min(1),
          targetContractId: z.string().min(1),
          targetField: z.string().min(1),
        }),
      )
      .default([]),
    /** For SEMANTIC contracts. */
    invariants: z.array(z.string().min(1)).default([]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    checksum: Sha256ChecksumSchema,
  })
  .strict();
export type DataContract = z.infer<typeof DataContractSchema>;

export const DataContractVersionSchema = z
  .object({
    contractId: z.string().min(1),
    version: SemverSchema,
    changes: z.string().min(1),
    changedBy: z.string().min(1),
    changedAt: IsoDateTimeSchema,
    checksum: Sha256ChecksumSchema,
    supersedes: z.string().min(1).optional(),
  })
  .strict();
export type DataContractVersion = z.infer<typeof DataContractVersionSchema>;

// ============================================================
// LINEAGE
// ============================================================

export const DataLineageNodeSchema = z
  .object({
    nodeId: z.string().min(1),
    kind: z.enum(['SOURCE', 'TRANSFORM', 'DATASET', 'CONSUMER']),
    name: z.string().min(1).optional(),
    contractId: z.string().min(1).optional(),
  })
  .strict();
export type DataLineageNode = z.infer<typeof DataLineageNodeSchema>;

export const DataLineageEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    field: z.string().min(1).optional(),
  })
  .strict();
export type DataLineageEdge = z.infer<typeof DataLineageEdgeSchema>;

export const DataLineageGraphSchema = z
  .object({
    lineageId: UuidSchema,
    nodes: z.array(DataLineageNodeSchema).min(1),
    edges: z.array(DataLineageEdgeSchema).default([]),
  })
  .strict();
export type DataLineageGraph = z.infer<typeof DataLineageGraphSchema>;

// ============================================================
// VALIDATION
// ============================================================

export const ValidationIssueSeveritySchema = z.enum([
  'INFO',
  'WARN',
  'ERROR',
  'CRITICAL',
]);
export type ValidationIssueSeverity = z.infer<
  typeof ValidationIssueSeveritySchema
>;

export const ValidationIssueSchema = z
  .object({
    issueId: UuidSchema,
    contractId: z.string().min(1),
    field: z.string().optional(),
    rule: z.string().min(1),
    severity: ValidationIssueSeveritySchema,
    message: z.string().min(1),
    sampleValue: z.unknown().optional(),
  })
  .strict();
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z
  .object({
    reportId: UuidSchema,
    contractId: z.string().min(1),
    contractVersion: SemverSchema,
    datasetVersion: z.string().min(1),
    rowCount: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
    issues: z.array(ValidationIssueSchema).default([]),
    passed: z.boolean(),
    evaluatedAt: IsoDateTimeSchema,
    durationMs: z.number().nonnegative(),
  })
  .strict();
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

// ============================================================
// DRIFT
// ============================================================

export const DriftKindSchema = z.enum([
  'SCHEMA_DRIFT',
  'VALUE_DRIFT',
  'VOLUME_DRIFT',
  'FRESHNESS_DRIFT',
  'DISTRIBUTION_DRIFT',
]);
export type DriftKind = z.infer<typeof DriftKindSchema>;

export const DriftSignalSchema = z
  .object({
    signalId: UuidSchema,
    contractId: z.string().min(1),
    kind: DriftKindSchema,
    observedAt: IsoDateTimeSchema,
    severity: ValidationIssueSeveritySchema,
    metric: z.string().min(1),
    observed: z.number(),
    expected: z.number(),
    delta: z.number(),
    message: z.string().min(1),
  })
  .strict();
export type DriftSignal = z.infer<typeof DriftSignalSchema>;

export const DriftReportSchema = z
  .object({
    reportId: UuidSchema,
    contractId: z.string().min(1),
    detectedAt: IsoDateTimeSchema,
    signals: z.array(DriftSignalSchema).default([]),
    highestSeverity: ValidationIssueSeveritySchema,
    quarantined: z.boolean(),
  })
  .strict();
export type DriftReport = z.infer<typeof DriftReportSchema>;

export const DriftThresholdsSchema = z
  .object({
    maxValueDriftRatio: z.number().nonnegative().default(0.1),
    maxVolumeDriftRatio: z.number().nonnegative().default(0.2),
    maxFreshnessSeconds: z.number().nonnegative().default(3600),
    maxDistributionDelta: z.number().nonnegative().default(0.05),
  })
  .strict();
export type DriftThresholds = z.infer<typeof DriftThresholdsSchema>;

// ============================================================
// STORAGE PORT
// ============================================================

export interface IDataContractStore {
  upsert(contract: DataContract): void;
  get(contractId: string): DataContract | null;
  list(): DataContract[];
  addVersion(version: DataContractVersion): void;
  versions(contractId: string): DataContractVersion[];
}

export class InMemoryDataContractStore implements IDataContractStore {
  private readonly contracts = new Map<string, DataContract>();
  private readonly versionHistory = new Map<string, DataContractVersion[]>();

  upsert(contract: DataContract): void {
    const parsed = DataContractSchema.parse(contract);
    this.contracts.set(parsed.contractId, parsed);
  }

  get(contractId: string): DataContract | null {
    return this.contracts.get(contractId) ?? null;
  }

  list(): DataContract[] {
    return [...this.contracts.values()];
  }

  addVersion(version: DataContractVersion): void {
    const parsed = DataContractVersionSchema.parse(version);
    const arr = this.versionHistory.get(parsed.contractId) ?? [];
    arr.push(parsed);
    this.versionHistory.set(parsed.contractId, arr);
  }

  versions(contractId: string): DataContractVersion[] {
    return this.versionHistory.get(contractId) ?? [];
  }
}

// ============================================================
// VALIDATOR
// ============================================================

export interface IDataValidator {
  validate(
    contractId: string,
    rows: readonly Record<string, unknown>[],
  ): ValidationReport;
}

export interface IClockLike {
  now(): Date;
}

export class SchemaReferentialValidator implements IDataValidator {
  constructor(
    private readonly store: IDataContractStore,
    private readonly clock: IClockLike = { now: () => new Date() },
    private readonly seedId: () => string = () => uuidv4(),
  ) {}

  validate(
    contractId: string,
    rows: readonly Record<string, unknown>[],
  ): ValidationReport {
    const contract = this.store.get(contractId);
    if (!contract) throw new Error(`Contract ${contractId} not found`);
    const started = Date.now();
    const issues: ValidationIssue[] = [];
    for (const row of rows) {
      // SCHEMA validation
      if (contract.kind === 'SCHEMA' || contract.kind === 'REFERENTIAL') {
        for (const field of contract.fields) {
          const value = row[field.name];
          if (value === undefined || value === null) {
            if (!field.nullable) {
              issues.push(
                ValidationIssueSchema.parse({
                  issueId: this.seedId(),
                  contractId,
                  field: field.name,
                  rule: 'NOT_NULL',
                  severity: 'ERROR',
                  message: `Field ${field.name} is required`,
                  sampleValue: value,
                }),
              );
            }
            continue;
          }
          if (!validateType(value, field.type)) {
            issues.push(
              ValidationIssueSchema.parse({
                issueId: this.seedId(),
                contractId,
                field: field.name,
                rule: 'TYPE_MISMATCH',
                severity: 'ERROR',
                message: `Field ${field.name} expected ${field.type}, got ${typeof value}`,
                sampleValue: value,
              }),
            );
          }
        }
      }
      // REFERENTIAL validation
      if (contract.kind === 'REFERENTIAL') {
        for (const ref of contract.references) {
          const value = row[ref.field];
          if (value === undefined || value === null) continue;
          const target = this.store.get(ref.targetContractId);
          if (!target) {
            issues.push(
              ValidationIssueSchema.parse({
                issueId: this.seedId(),
                contractId,
                field: ref.field,
                rule: 'MISSING_TARGET_CONTRACT',
                severity: 'CRITICAL',
                message: `Referenced contract ${ref.targetContractId} does not exist`,
                sampleValue: value,
              }),
            );
            continue;
          }
          if (!target.fields.some((f) => f.name === ref.targetField)) {
            issues.push(
              ValidationIssueSchema.parse({
                issueId: this.seedId(),
                contractId,
                field: ref.field,
                rule: 'MISSING_TARGET_FIELD',
                severity: 'ERROR',
                message: `Target field ${ref.targetField} not in contract ${ref.targetContractId}`,
                sampleValue: value,
              }),
            );
          }
        }
      }
      // SEMANTIC validation (basic invariant pattern check)
      if (contract.kind === 'SEMANTIC') {
        for (const invariant of contract.invariants) {
          if (!checkSimpleInvariant(row, invariant)) {
            issues.push(
              ValidationIssueSchema.parse({
                issueId: this.seedId(),
                contractId,
                rule: `INVARIANT:${invariant}`,
                severity: 'ERROR',
                message: `Semantic invariant violated: ${invariant}`,
                sampleValue: row,
              }),
            );
          }
        }
      }
    }
    const passed = !issues.some(
      (i) => i.severity === 'ERROR' || i.severity === 'CRITICAL',
    );
    return ValidationReportSchema.parse({
      reportId: this.seedId(),
      contractId,
      contractVersion: contract.version,
      datasetVersion: 'ad-hoc',
      rowCount: rows.length,
      issueCount: issues.length,
      issues,
      passed,
      evaluatedAt: this.clock.now().toISOString(),
      durationMs: Date.now() - started,
    });
  }
}

function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'uuid':
      return typeof value === 'string' && UuidSchema.safeParse(value).success;
    case 'iso-datetime':
      return (
        typeof value === 'string' && IsoDateTimeSchema.safeParse(value).success
      );
    case 'email':
      return (
        typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      );
    case 'json':
      return value !== undefined;
    default:
      return true;
  }
}

/**
 * A tiny semantic-invariant DSL. Supports patterns like:
 *   "status in [ACTIVE, COMPLETED]"
 *   "amount >= 0"          (literal on the right)
 *   "completedAt >= startedAt"
 */
function checkSimpleInvariant(
  row: Record<string, unknown>,
  invariant: string,
): boolean {
  const enumMatch = invariant.match(/^(\w+)\s+in\s+\[([^\]]+)\]$/);
  if (enumMatch) {
    const [, field, list] = enumMatch;
    const allowed = list.split(',').map((s) => s.trim());
    return allowed.includes(String(row[field]));
  }
  const cmpMatch = invariant.match(/^(\w+)\s*(>=|<=|>|<|==|!=)\s*(\w+)$/);
  if (cmpMatch) {
    const [, a, op, b] = cmpMatch;
    const av = row[a];
    // Literal RHS: number
    if (/^-?\d+(?:\.\d+)?$/.test(b)) {
      const bv = Number(b);
      if (typeof av === 'number') {
        switch (op) {
          case '>=':
            return av >= bv;
          case '<=':
            return av <= bv;
          case '>':
            return av > bv;
          case '<':
            return av < bv;
          case '==':
            return av === bv;
          case '!=':
            return av !== bv;
        }
      }
      return false;
    }
    const bv = row[b];
    if (typeof av === 'number' && typeof bv === 'number') {
      switch (op) {
        case '>=':
          return av >= bv;
        case '<=':
          return av <= bv;
        case '>':
          return av > bv;
        case '<':
          return av < bv;
        case '==':
          return av === bv;
        case '!=':
          return av !== bv;
      }
    }
    return false;
  }
  return true;
}

// ============================================================
// DRIFT DETECTOR
// ============================================================

export interface IDriftDetector {
  detect(
    contractId: string,
    current: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    },
    baseline: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    },
    thresholds?: DriftThresholds,
  ): DriftReport;
}

export class SchemaDriftDetector implements IDriftDetector {
  private readonly seedId: () => string;

  constructor(seedId: () => string = () => uuidv4()) {
    this.seedId = seedId;
  }

  detect(
    contractId: string,
    current: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    },
    baseline: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    },
    thresholds: DriftThresholds = DriftThresholdsSchema.parse({}),
  ): DriftReport {
    const detectedAt = new Date().toISOString();
    const signals: DriftSignal[] = [];

    // Volume drift
    if (baseline.rowCount > 0) {
      const delta = (current.rowCount - baseline.rowCount) / baseline.rowCount;
      if (Math.abs(delta) > thresholds.maxVolumeDriftRatio) {
        signals.push(
          DriftSignalSchema.parse({
            signalId: this.seedId(),
            contractId,
            kind: 'VOLUME_DRIFT',
            observedAt: detectedAt,
            severity:
              Math.abs(delta) > 2 * thresholds.maxVolumeDriftRatio
                ? 'ERROR'
                : 'WARN',
            metric: 'rowCount',
            observed: current.rowCount,
            expected: baseline.rowCount,
            delta,
            message: `Row count drifted by ${(delta * 100).toFixed(1)}%`,
          }),
        );
      }
    }

    // Freshness drift
    if (current.freshnessSeconds > thresholds.maxFreshnessSeconds) {
      signals.push(
        DriftSignalSchema.parse({
          signalId: this.seedId(),
          contractId,
          kind: 'FRESHNESS_DRIFT',
          observedAt: detectedAt,
          severity:
            current.freshnessSeconds > 2 * thresholds.maxFreshnessSeconds
              ? 'CRITICAL'
              : 'ERROR',
          metric: 'freshnessSeconds',
          observed: current.freshnessSeconds,
          expected: thresholds.maxFreshnessSeconds,
          delta: current.freshnessSeconds - thresholds.maxFreshnessSeconds,
          message: `Dataset freshness ${current.freshnessSeconds}s exceeds threshold ${thresholds.maxFreshnessSeconds}s`,
        }),
      );
    }

    // Value drift per numeric field
    for (const [field, baselineVal] of Object.entries(baseline.numericFields)) {
      const currentVal = current.numericFields[field];
      if (currentVal === undefined) continue;
      if (baselineVal === 0) continue;
      const delta = (currentVal - baselineVal) / baselineVal;
      if (Math.abs(delta) > thresholds.maxValueDriftRatio) {
        signals.push(
          DriftSignalSchema.parse({
            signalId: this.seedId(),
            contractId,
            kind: 'VALUE_DRIFT',
            observedAt: detectedAt,
            severity:
              Math.abs(delta) > 2 * thresholds.maxValueDriftRatio
                ? 'ERROR'
                : 'WARN',
            metric: field,
            observed: currentVal,
            expected: baselineVal,
            delta,
            message: `Field ${field} drifted by ${(delta * 100).toFixed(1)}%`,
          }),
        );
      }
    }

    const order: ValidationIssueSeverity[] = [
      'CRITICAL',
      'ERROR',
      'WARN',
      'INFO',
    ];
    const highestSeverity: ValidationIssueSeverity =
      signals.length === 0
        ? 'INFO'
        : (order.find((s) => signals.some((sig) => sig.severity === s)) ??
          'INFO');
    return DriftReportSchema.parse({
      reportId: this.seedId(),
      contractId,
      detectedAt,
      signals,
      highestSeverity,
      quarantined: highestSeverity === 'CRITICAL',
    });
  }
}

// ============================================================
// LINEAGE BUILDER
// ============================================================

export class LineageBuilder {
  private readonly nodes = new Map<string, DataLineageNode>();
  private readonly edges: DataLineageEdge[] = [];

  addNode(node: DataLineageNode): this {
    this.nodes.set(node.nodeId, node);
    return this;
  }

  addEdge(edge: DataLineageEdge): this {
    this.edges.push(edge);
    return this;
  }

  build(): DataLineageGraph {
    return DataLineageGraphSchema.parse({
      lineageId: uuidv4(),
      nodes: [...this.nodes.values()],
      edges: this.edges,
    });
  }

  /**
   * Reverse impact: which downstream nodes depend on the given node?
   * Used to map data-quality issues to downstream suites/scenarios.
   */
  impactOf(nodeId: string): DataLineageNode[] {
    const reachable = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    return [...reachable]
      .map((id) => this.nodes.get(id))
      .filter((n): n is DataLineageNode => n !== undefined);
  }
}

// ============================================================
// DATA QUALITY GATE — composes validation + drift + lineage.
// Maps a contract + dataset into a verdict that the release gate
// can consume (§9 row "Data Quality" minimum release evidence).
// ============================================================

export const DataQualityVerdictSchema = z
  .object({
    contractId: z.string().min(1),
    validation: ValidationReportSchema,
    drift: DriftReportSchema,
    affectedScenarios: z.array(z.string().min(1)).default([]),
    verdict: z.enum(['PASS', 'WARN', 'FAIL']),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type DataQualityVerdict = z.infer<typeof DataQualityVerdictSchema>;

export interface IDataQualityGate {
  evaluate(input: {
    contractId: string;
    rows: readonly Record<string, unknown>[];
    current: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    };
    baseline: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    };
  }): DataQualityVerdict;
}

export class DataQualityGate implements IDataQualityGate {
  constructor(
    private readonly validator: IDataValidator,
    private readonly drift: IDriftDetector,
    private readonly lineage?: LineageBuilder,
    private readonly clock: IClockLike = { now: () => new Date() },
  ) {}

  evaluate(input: {
    contractId: string;
    rows: readonly Record<string, unknown>[];
    current: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    };
    baseline: {
      rowCount: number;
      freshnessSeconds: number;
      numericFields: Record<string, number>;
    };
  }): DataQualityVerdict {
    const validation = this.validator.validate(input.contractId, input.rows);
    const drift = this.drift.detect(
      input.contractId,
      input.current,
      input.baseline,
    );
    const affected: string[] = [];
    if (this.lineage) {
      for (const node of this.lineage.impactOf(input.contractId)) {
        if (node.contractId) affected.push(node.contractId);
      }
    }
    const verdict: DataQualityVerdict['verdict'] = (() => {
      if (drift.highestSeverity === 'CRITICAL' || !validation.passed)
        return 'FAIL';
      if (drift.highestSeverity === 'ERROR' || drift.highestSeverity === 'WARN')
        return 'WARN';
      return 'PASS';
    })();
    return DataQualityVerdictSchema.parse({
      contractId: input.contractId,
      validation,
      drift,
      affectedScenarios: affected,
      verdict,
      evaluatedAt: this.clock.now().toISOString(),
    });
  }
}

// ============================================================
// AUTHORIZATION CONTEXT PRESENCE
// ============================================================

export function requireAuth(
  ctx: AuthorizationContext | undefined,
  action: string,
): asserts ctx is AuthorizationContext {
  if (!ctx) {
    throw new Error(
      `Missing authorization context for ${action} (§5.2 missing tenant context is an error)`,
    );
  }
  if (!ctx.tenantId || !ctx.actorId) {
    throw new Error(
      `Authorization context for ${action} must include tenantId and actorId`,
    );
  }
}
