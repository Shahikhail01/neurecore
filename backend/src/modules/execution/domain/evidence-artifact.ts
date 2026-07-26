// src/modules/execution/domain/evidence-artifact.ts
export interface EvidenceArtifact {
  id: string;
  tenantId: string;
  projectId: string;
  taskId: string;
  executionAttemptId: string;
  artifactType: 'DRAFT' | 'REPORT' | 'DOCUMENT' | 'DATA' | 'OUTPUT';
  storageRef: string;
  mimeType: string;
  checksum: string;
  source: 'AI_GENERATED' | 'HUMAN_PROVIDED' | 'SYSTEM_DERIVED';
  createdByActorId: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}
