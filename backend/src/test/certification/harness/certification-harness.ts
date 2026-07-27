// src/test/certification/harness/certification-harness.ts
/**
 * Phase 9 — Certification Harness.
 *
 * Per NC-AWL-IMP-1 §2.6 / §11.1:
 *   - Deterministic reconstruction tenant provisioning/reset
 *   - Synthetic accounting data and attachments
 *   - Unique run IDs and record labeling
 *   - Safe cleanup without touching unrelated tenant data
 *   - Correlation capture across frontend, backend, events, workers, graphs, and tools
 *   - Machine-readable results and evidence index
 *   - Failure-injection seams
 *
 * This module is the single source of truth for the certification
 * harness. Spec files consume it; it does not consume any spec.
 */

import { randomUUID } from 'crypto';
import {
  generateSyntheticDataset,
  SyntheticAccountingDataset,
  DatasetCleanupManifest,
  toCleanupManifest,
} from '../synthetic/accounting-synthetic-data';
import { FailureInjectionBus } from '../fixtures/failure-injection';

export const RECONSTRUCTION_TEST_TENANT_ID = 'reconstruction-test-tenant';
export const ATTACKER_TENANT_ID = 'attacker-tenant';
export const ISOLATION_TENANT_ID = 'isolation-pair-tenant';

export interface RunId {
  readonly value: string;
  readonly createdAt: string;
}

export function newRunId(label: string): RunId {
  return {
    value: `${label}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

export interface CorrelationCapture {
  runId: string;
  tenantId: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  occurredAt: string;
  schemaVersion: number;
}

export function buildCorrelationCapture(
  runId: string,
  tenantId: string,
  actorId: string,
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM' = 'HUMAN',
  causationId: string | null = null,
): CorrelationCapture {
  return {
    runId,
    tenantId,
    correlationId: randomUUID(),
    causationId,
    idempotencyKey: `${runId}:${randomUUID()}`,
    actorId,
    actorType,
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

export class CertificationHarness {
  private readonly runs = new Map<string, SyntheticAccountingDataset>();
  readonly failures = new FailureInjectionBus();
  readonly correlations: CorrelationCapture[] = [];

  /**
   * Provisions a deterministic per-run dataset isolated by runId.
   * The dataset is stored in the harness so cross-test cleanup can
   * iterate without re-reading storage.
   */
  provisionDataset(
    tenantId: string,
    seedRunId?: string,
  ): SyntheticAccountingDataset {
    const ds = generateSyntheticDataset(tenantId, seedRunId);
    this.runs.set(ds.runId, ds);
    return ds;
  }

  /**
   * Returns the cleanup manifest for a single run. The harness never
   * touches data outside the runId; everything is labeled.
   */
  manifestFor(runId: string): DatasetCleanupManifest | null {
    const ds = this.runs.get(runId);
    if (!ds) return null;
    return toCleanupManifest(ds);
  }

  /**
   * Emits a correlation capture for a run. The list is append-only
   * and is the canonical evidence index for certification reports.
   */
  captureCorrelation(c: CorrelationCapture): void {
    this.correlations.push(c);
  }

  /**
   * Selects all correlation captures for a single run, ordered by
   * occurredAt. Used by the dashboard to reconstruct a timeline.
   */
  correlationsFor(runId: string): CorrelationCapture[] {
    return this.correlations
      .filter((c) => c.runId === runId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  /**
   * Evidence index: every persisted record (correlation or harness
   * event) carries the runId so cleanup is exact.
   */
  evidenceIndexSize(): number {
    return this.correlations.length + this.runs.size;
  }

  /**
   * Safe cleanup that only deletes records belonging to the given
   * runId. Called via a callback that the test wires to its storage
   * adapter; the harness itself does not own Prisma.
   */
  async safeCleanup(
    runId: string,
    deleteByRunId: (manifest: DatasetCleanupManifest) => Promise<void>,
  ): Promise<void> {
    const manifest = this.manifestFor(runId);
    if (!manifest) return;
    await deleteByRunId(manifest);
    this.runs.delete(runId);
  }

  /**
   * Statistics for the certification dashboard.
   */
  stats(): {
    runCount: number;
    correlationCount: number;
    failureRecords: number;
  } {
    return {
      runCount: this.runs.size,
      correlationCount: this.correlations.length,
      failureRecords: this.failures.getRecords().length,
    };
  }
}
