/**
 * NeureCore Harness - Regression Coordinator (Phase 3)
 *
 * Glues the Phase 3 deliverables together:
 *   - fixtures (test data)
 *   - defects (defect registry)
 *   - quarantine (test quarantine)
 *   - data-quality (data contracts / drift)
 *   - pr-lane (changed-surface mapping)
 *
 * This module exists so the rest of the harness can call ONE entry
 * point to execute Phase 3 workflows:
 *
 *   - onFailure()       — automatic failure-to-regression workflow
 *   - sweep()           — quarantine expiry sweep + defect promotion
 *   - evaluateDataQuality() — combines validator + drift + lineage
 *
 * SOLID alignment:
 *   - SRP: composition only; each subsystem owns its own logic.
 *   - DIP: subsystems injected through ports.
 *
 * Document ID: NC-HARNESS-REGRESSION-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema } from '../contracts';
import type { FailureLinkResult, IDefectRegistry } from '../defects';
import {
  FailureToRegressionWorkflow,
  DefectRegistry,
  InMemoryDefectStore,
  ReplayReproducibilityTracker,
} from '../defects';
import type { IQuarantineEngine, QuarantinePolicy } from '../quarantine';
import {
  QuarantineEngine,
  InMemoryQuarantineStore,
  QuarantinePolicySchema,
} from '../quarantine';
import type { IDataQualityGate, DataQualityVerdict } from '../data-quality';
import type { ILaneSelector, ICriticalSurfaceGate } from '../pr-lane';
import {
  LaneSelector,
  CriticalSurfaceGate,
  type ChangedSurface,
  type LaneSelection,
  type CriticalGateVerdict,
} from '../pr-lane';

export const REGRESSION_VERSION = '1.0.0';

// ============================================================
// FAILURE INGESTION PORT
// ============================================================

export const IngestedFailureSchema = z
  .object({
    runId: z.string().min(1),
    scenarioId: z.string().min(1),
    capabilityIds: z.array(z.string().min(1)).default([]),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    errorMessage: z.string().min(1),
    actorId: z.string().min(1),
    tenantId: z.string().min(1),
    expectedBehavior: z.string().min(1),
    assertions: z.array(z.string().min(1)).min(1),
    suiteId: z.string().min(1).optional(),
    testPath: z.string().min(1).optional(),
  })
  .strict();
export type IngestedFailure = z.infer<typeof IngestedFailureSchema>;

export interface IRegressionCoordinator {
  /** §10 Phase 3 — automatic failure-to-regression workflow. */
  onFailure(input: IngestedFailure): FailureLinkResult;

  /** §10 Phase 3 — flaky tests cannot be hidden indefinitely. */
  sweep(atIso: string): SweepReport;

  /** §10 Phase 3 — defect has a replayable test. */
  recordReplay(
    defectId: string,
    scenarioId: string,
    replayBundleId: string,
    outcome: 'REPRODUCED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE',
    note?: string,
  ): ReplayRecord;

  /** §10 Phase 3 — data quality verdict for a contract. */
  evaluateDataQuality(input: DataQualityInput): DataQualityVerdict;

  /** §10 Phase 3 — PR lane selection + critical-surface gate. */
  evaluatePR(input: {
    prId: string;
    surface: ChangedSurface;
    runs: Array<{
      lane: any;
      runId: string;
      outcome: string;
      finalized: boolean;
    }>;
  }): { selection: LaneSelection; gate: CriticalGateVerdict };
}

// ============================================================
// SWEEP REPORT
// ============================================================

export const SweepReportSchema = z
  .object({
    sweptAt: IsoDateTimeSchema,
    expiredQuarantines: z.array(UuidSchema).default([]),
    promotedToDefects: z.array(UuidSchema).default([]),
    revokeRecommendations: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type SweepReport = z.infer<typeof SweepReportSchema>;

// ============================================================
// REPLAY RECORD (returned by recordReplay)
// ============================================================

export const ReplayRecordSchema = z
  .object({
    defectId: UuidSchema,
    scenarioId: z.string().min(1),
    replayBundleId: z.string().min(1),
    isReplayable: z.boolean(),
    reproductionCount: z.number().int().nonnegative(),
    consecutiveFailures: z.number().int().nonnegative(),
  })
  .strict();
export type ReplayRecord = z.infer<typeof ReplayRecordSchema>;

// ============================================================
// DATA QUALITY INPUT
// ============================================================

export const DataQualityInputSchema = z
  .object({
    contractId: z.string().min(1),
    rows: z.array(z.record(z.unknown())).default([]),
    current: z.object({
      rowCount: z.number().int().nonnegative(),
      freshnessSeconds: z.number().nonnegative(),
      numericFields: z.record(z.number()).default({}),
    }),
    baseline: z.object({
      rowCount: z.number().int().nonnegative(),
      freshnessSeconds: z.number().nonnegative(),
      numericFields: z.record(z.number()).default({}),
    }),
  })
  .strict();
export type DataQualityInput = z.infer<typeof DataQualityInputSchema>;

// ============================================================
// COORDINATOR IMPLEMENTATION
// ============================================================

export class RegressionCoordinator implements IRegressionCoordinator {
  private readonly defects: IDefectRegistry;
  private readonly failureWorkflow: FailureToRegressionWorkflow;
  private readonly quarantine: IQuarantineEngine;
  private readonly quarantinePolicy: QuarantinePolicy;
  private readonly replay: ReplayReproducibilityTracker;
  private readonly dataQuality?: IDataQualityGate;
  private readonly laneSelector: ILaneSelector;
  private readonly gate: ICriticalSurfaceGate;

  constructor(
    config: {
      defects?: IDefectRegistry;
      quarantine?: IQuarantineEngine;
      quarantinePolicy?: QuarantinePolicy;
      dataQuality?: IDataQualityGate;
      laneSelector?: ILaneSelector;
      gate?: ICriticalSurfaceGate;
      replay?: ReplayReproducibilityTracker;
      clock?: { now(): Date };
      defaults?: { ownerId: string; ownerRole: string; actor: string };
    } = {},
  ) {
    const store = new InMemoryDefectStore();
    this.defects =
      config.defects ??
      new DefectRegistry(store, config.clock ?? { now: () => new Date() });
    const defaults = config.defaults ?? {
      ownerId: 'platform-owner',
      ownerRole: 'Platform/QA',
      actor: 'harness-coordinator',
    };
    this.failureWorkflow = new FailureToRegressionWorkflow(this.defects, {
      owner: {
        ownerId: defaults.ownerId,
        ownerRole: defaults.ownerRole,
        confirmedAt: new Date().toISOString(),
      },
      actor: defaults.actor,
    });
    this.quarantinePolicy =
      config.quarantinePolicy ?? require_quarantine_policy();
    this.quarantine =
      config.quarantine ??
      new QuarantineEngine(
        new InMemoryQuarantineStore(),
        config.clock ?? { now: () => new Date() },
      );
    this.replay = config.replay ?? new ReplayReproducibilityTracker();
    this.dataQuality = config.dataQuality;
    this.laneSelector = config.laneSelector ?? new LaneSelector();
    this.gate = config.gate ?? new CriticalSurfaceGate();
  }

  onFailure(input: IngestedFailure): FailureLinkResult {
    const parsed = IngestedFailureSchema.parse(input);
    return this.failureWorkflow.linkFailure({
      runId: parsed.runId,
      scenarioId: parsed.scenarioId,
      capabilityIds: parsed.capabilityIds,
      severity: parsed.severity,
      observedOutcome: 'FAILED',
      errorMessage: parsed.errorMessage,
      actorId: parsed.actorId,
      tenantId: parsed.tenantId,
      expectedBehavior: parsed.expectedBehavior,
      assertions: parsed.assertions,
      suiteId: parsed.suiteId,
      testPath: parsed.testPath,
      auth: {
        actorId: parsed.actorId,
        actorType: 'SYSTEM',
        actorRoles: ['SYSTEM'],
        tenantId: '00000000-0000-0000-0000-000000000001',
        correlationId: `corr-${parsed.runId}`,
        permissions: ['evidence:read'],
      },
    });
  }

  sweep(atIso: string): SweepReport {
    const now = Date.parse(atIso);
    const expiredIds: string[] = [];
    const promoted: string[] = [];
    const recommendations: string[] = [];

    // Find ACTIVE quarantines whose expiresAt <= now, then either
    // promote them (when defect-linked) or expire them.
    type WithStore = { store: import('../quarantine').IQuarantineStore };
    const store = (this.quarantine as unknown as WithStore).store;
    const activeRecords = store.list({
      status: 'ACTIVE',
    });
    for (const record of activeRecords) {
      if (Date.parse(record.expiresAt) > now) continue;
      if (record.linkedDefectId) {
        this.quarantine.promote(
          record.quarantineId,
          record.linkedDefectId,
          'harness-coordinator',
          this.quarantinePolicy,
        );
        promoted.push(record.linkedDefectId);
      } else {
        recommendations.push(
          `Quarantine ${record.quarantineId} expired without linked defect; promote or revoke`,
        );
      }
      // Mark expired via the engine to keep the status state machine consistent.
      const expired = this.quarantine.sweepExpired(atIso);
      expiredIds.push(...expired.map((r) => r.quarantineId));
    }

    return SweepReportSchema.parse({
      sweptAt: atIso,
      expiredQuarantines: [...new Set(expiredIds)],
      promotedToDefects: promoted,
      revokeRecommendations: recommendations,
    });
  }

  recordReplay(
    defectId: string,
    scenarioId: string,
    replayBundleId: string,
    outcome: 'REPRODUCED' | 'NOT_REPRODUCED' | 'INCONCLUSIVE',
    note?: string,
  ): ReplayRecord {
    const atIso = new Date().toISOString();
    const rec = this.replay.record(
      defectId,
      scenarioId,
      replayBundleId,
      outcome,
      atIso,
      note,
    );
    return ReplayRecordSchema.parse({
      defectId: rec.defectId,
      scenarioId: rec.scenarioId,
      replayBundleId: rec.replayBundleId,
      isReplayable: rec.isReplayable,
      reproductionCount: rec.reproductionCount,
      consecutiveFailures: rec.consecutiveFailures,
    });
  }

  evaluateDataQuality(input: DataQualityInput): DataQualityVerdict {
    if (!this.dataQuality) {
      throw new Error(
        'DataQualityGate not configured on RegressionCoordinator',
      );
    }
    return this.dataQuality.evaluate(input);
  }

  evaluatePR(input: {
    prId: string;
    surface: ChangedSurface;
    runs: Array<{
      lane: any;
      runId: string;
      outcome: string;
      finalized: boolean;
    }>;
  }): { selection: LaneSelection; gate: CriticalGateVerdict } {
    const selection = this.laneSelector.select({
      prId: input.prId,
      surface: input.surface,
    });
    const gate = this.gate.evaluate({
      prId: input.prId,
      selection,
      runs: input.runs,
    });
    return { selection, gate };
  }
}

function require_quarantine_policy(): QuarantinePolicy {
  // QuarantinePolicySchema is imported at the top of this file via the
  // `quarantine` module re-export to avoid circular module evaluation.
  return QuarantinePolicySchema.parse({});
}
