import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  IArtifactStorage,
  SaveDraftInput,
  ArtifactRecord,
} from '../contracts/artifact-storage.interface';
import type { ArtifactReference } from '../contracts/employee-run.types';

/**
 * Stores draft artifact metadata in the WorkRun step result.
 *
 * This provides idempotent, tenant-scoped artifact creation without a
 * separate database table. Step-level idempotency (enforced by the
 * WorkRuntime's `findSucceededByIdempotencyKey`) ensures exactly one
 * artifact record per retry/concurrent execution.
 *
 * The full artifact content is NOT stored in the step result — only the
 * artifact ID, checksum, MIME type, and display name are persisted.
 */
@Injectable()
export class StepArtifactStorageService implements IArtifactStorage {
  private readonly logger = new Logger(StepArtifactStorageService.name);

  async saveDraft(input: SaveDraftInput): Promise<ArtifactRecord> {
    this.validate(input);

    const artifactId = this.deriveArtifactId(input);
    const checksum = this.checksum(input.content);

    this.logger.log(
      `saveDraft artifact=${artifactId} checksum=${checksum} run=${input.runId} step=${input.stepId}`,
    );

    return Object.freeze({
      id: artifactId,
      type: 'REPORT',
      name: input.title,
      mimeType: input.mimeType,
      checksum,
      tenantId: input.tenantId,
    });
  }

  /**
   * Derive a deterministic artifact ID from the step idempotency key.
   * Retries with the same key produce the same artifact ID.
   */
  deriveArtifactId(input: SaveDraftInput): string {
    return `artifact-${this.checksum(input.stepIdempotencyKey).slice(0, 16)}`;
  }

  checksum(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private validate(input: SaveDraftInput): void {
    for (const key of [
      'tenantId',
      'actorId',
      'runId',
      'stepId',
      'stepIdempotencyKey',
      'name',
      'title',
      'content',
      'mimeType',
    ] as const) {
      if (!input[key] || typeof input[key] !== 'string' || !input[key].trim()) {
        throw new Error(
          `reports.save_draft requires non-empty string "${key}"`,
        );
      }
    }
    if (input.content.length > 1_000_000) {
      throw new Error('report content exceeds maximum size (1 MB)');
    }
    const validMimes = [
      'text/markdown',
      'text/html',
      'text/plain',
      'application/json',
    ];
    if (!validMimes.includes(input.mimeType)) {
      throw new Error(
        `unsupported mimeType "${input.mimeType}". Allowed: ${validMimes.join(', ')}`,
      );
    }
  }
}
