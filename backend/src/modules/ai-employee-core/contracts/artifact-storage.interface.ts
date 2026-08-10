import type { ArtifactReference } from './employee-run.types';

export interface SaveDraftInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly stepIdempotencyKey: string;
  readonly name: string;
  readonly title: string;
  readonly content: string;
  readonly mimeType: string;
  readonly projectId?: string;
  readonly customerId?: string;
}

export interface ArtifactRecord {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly mimeType: string;
  readonly checksum: string;
  readonly tenantId: string;
}

export interface IArtifactStorage {
  saveDraft(input: SaveDraftInput): Promise<ArtifactRecord>;
}

export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');
