/**
 * NeureCore Harness — Phase 9 STAGING-class evidence source.
 *
 * Reads finalized runIds + evidence envelopes from an `EvidenceStore`
 * populated by a real STAGING run of the 105-scenario G9 matrix
 * (`src/test/certification/certification-runner.ts`). Envelopes whose
 * checksum does not match the stored content (per
 * `EvidenceStore.verifyIntegrity`) are excluded. Envelopes with missing
 * or empty `scenarioId` are excluded.
 *
 * Document ID: NC-HARNESS-PHASE9-STAGING-EVIDENCE-001
 * Version: 1.0
 * Status: PHASE_9_IMPLEMENTED
 */

import { z } from 'zod';
import { EvidenceEnvelopeSchema, type EvidenceEnvelope } from '../../contracts';
import { EvidenceStore, createEvidenceEnvelope } from '../../evidence';

/**
 * Source for a single finalized STAGING run. Returns the evidence
 * envelopes associated with that `phase9StagingRunId` from the
 * supplied `EvidenceStore`, classified as `environmentClass=STAGING`.
 */
export interface StagingEvidenceSource {
  /**
   * Returns the evidence envelopes for a finalized STAGING run.
   *
   * The implementation MUST:
   * - read from the supplied `EvidenceStore`
   * - exclude envelopes whose checksum does not match
   *   (`EvidenceStore.verifyIntegrity` returns false)
   * - exclude envelopes that fail the strict `EvidenceEnvelopeSchema`
   *   parse (e.g. missing `scenarioId`)
   * - classify every envelope as STAGING (via the
   *   `environmentClass` on the returned wrapper)
   */
  getStagingEvidence(input: {
    phase9StagingRunId: string;
  }): StagingEvidenceBundle;
  /**
   * Returns the list of finalized runIds present in the source.
   */
  listFinalizedRunIds(): string[];
}

export const StagingEnvironmentClassSchema = z.literal('STAGING');
export type StagingEnvironmentClass = z.infer<
  typeof StagingEnvironmentClassSchema
>;

export const StagingEvidenceBundleSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    environmentClass: StagingEnvironmentClassSchema,
    runId: z.string().min(1),
    finalized: z.boolean(),
    envelopes: z.array(EvidenceEnvelopeSchema),
    excludedCount: z.number().int().nonnegative(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type StagingEvidenceBundle = z.infer<typeof StagingEvidenceBundleSchema>;

/**
 * Real `StagingEvidenceSource` backed by a populated `EvidenceStore`.
 * Accepts a `phase9StagingRunId` argument and returns the envelopes
 * for that run, classified as STAGING, after integrity verification.
 */
export class StagingEvidenceSourceImpl implements StagingEvidenceSource {
  constructor(private readonly store: EvidenceStore) {}

  listFinalizedRunIds(): string[] {
    const runIds = new Set<string>();
    for (const artifact of this.store.list()) {
      runIds.add(artifact.envelope.runId);
    }
    return [...runIds];
  }

  getStagingEvidence(input: {
    phase9StagingRunId: string;
  }): StagingEvidenceBundle {
    const runId = input.phase9StagingRunId;
    const notes: string[] = [];
    const envelopes: EvidenceEnvelope[] = [];
    let excludedCount = 0;

    const artifacts = this.store.getByRunId(runId);
    for (const artifact of artifacts) {
      if (!this.store.verifyIntegrity(artifact.envelope.evidenceId)) {
        excludedCount++;
        notes.push(
          `excluded envelope ${artifact.envelope.evidenceId}: checksum mismatch`,
        );
        continue;
      }
      const parsed = EvidenceEnvelopeSchema.safeParse(artifact.envelope);
      if (!parsed.success) {
        excludedCount++;
        notes.push(
          `excluded envelope ${artifact.envelope.evidenceId}: schema parse failed (${parsed.error.issues
            .map((i) => i.message)
            .join('; ')})`,
        );
        continue;
      }
      const env = parsed.data;
      if (!env.scenarioId || env.scenarioId.trim() === '') {
        excludedCount++;
        notes.push(`excluded envelope ${env.evidenceId}: missing scenarioId`);
        continue;
      }
      envelopes.push(env);
    }

    return StagingEvidenceBundleSchema.parse({
      schemaVersion: '1.0.0',
      environmentClass: 'STAGING',
      runId,
      finalized: envelopes.length > 0,
      envelopes,
      excludedCount,
      notes,
    });
  }
}

/**
 * In-memory `StagingEvidenceSource` for tests. Holds a pre-built map
 * of `phase9StagingRunId` → envelopes. Integrity is verified via the
 * per-envelope `checksum` field shape; envelopes with invalid checksum
 * shape or missing `scenarioId` are excluded.
 */
export class InMemoryStagingEvidenceSource implements StagingEvidenceSource {
  private readonly bundles = new Map<string, EvidenceEnvelope[]>();

  addRun(runId: string, envelopes: EvidenceEnvelope[]): void {
    this.bundles.set(runId, [...envelopes]);
  }

  listFinalizedRunIds(): string[] {
    return [...this.bundles.keys()];
  }

  getStagingEvidence(input: {
    phase9StagingRunId: string;
  }): StagingEvidenceBundle {
    const runId = input.phase9StagingRunId;
    const notes: string[] = [];
    const envelopes: EvidenceEnvelope[] = [];
    let excludedCount = 0;

    const raw = this.bundles.get(runId) ?? [];
    for (const env of raw) {
      const parsed = EvidenceEnvelopeSchema.safeParse(env);
      if (!parsed.success) {
        excludedCount++;
        notes.push(
          `excluded envelope ${env.evidenceId}: schema parse failed (${parsed.error.issues
            .map((i) => i.message)
            .join('; ')})`,
        );
        continue;
      }
      const valid = parsed.data;
      if (!valid.scenarioId || valid.scenarioId.trim() === '') {
        excludedCount++;
        notes.push(`excluded envelope ${valid.evidenceId}: missing scenarioId`);
        continue;
      }
      if (!isChecksumShapeValid(valid.checksum)) {
        excludedCount++;
        notes.push(
          `excluded envelope ${valid.evidenceId}: checksum shape invalid`,
        );
        continue;
      }
      envelopes.push(valid);
    }

    return StagingEvidenceBundleSchema.parse({
      schemaVersion: '1.0.0',
      environmentClass: 'STAGING',
      runId,
      finalized: envelopes.length > 0,
      envelopes,
      excludedCount,
      notes,
    });
  }
}

function isChecksumShapeValid(checksum: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(checksum);
}

export { createEvidenceEnvelope };
