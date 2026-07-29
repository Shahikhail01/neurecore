// src/services/execution.service.ts
//
// Phase 7 — Execution UX surface client. Wraps the read endpoints
// (detail, evidence download / preview) and the operator recovery
// commands (retry, cancel) added by ExecutionController.

import api from './api';

export interface ExecutionAttemptSummary {
  id: string;
  attemptNumber: number;
  status: string;
  taskId: string;
  agentId: string;
  startedAt: string | null;
  endedAt: string | null;
  tokensUsed: number;
  costCents: number;
  toolCallCount: number;
  outputSummary: string | null;
  lastError: string | null;
  lastErrorClassification: string | null;
  promptVersion: string | null;
  graphVersion: string | null;
  modelVersion: string | null;
  toolVersion: string | null;
  policy: Record<string, unknown>;
  parentAttemptId: string | null;
  task?: {
    id: string;
    title: string;
    status: string;
    projectId: string;
    requiredRole: string | null;
    requiredCapabilities: string[];
  };
  agent?: {
    id: string;
    name: string;
    role: string;
  };
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: string;
    sideEffect: boolean;
    occurredAt: string;
    errorClassification: string | null;
  }>;
  evidence: Array<EvidenceArtifact>;
  reviews: Array<{
    id: string;
    status: string;
    decision: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceArtifact {
  id: string;
  artifactType: string;
  storageRef: string;
  mimeType: string;
  checksum: string;
  source: string;
  createdByActorId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const executionService = {
  async listAttempts(): Promise<ExecutionAttemptSummary[]> {
    const res = await api.get('/execution/attempts');
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return Array.isArray(inner) ? (inner as ExecutionAttemptSummary[]) : [];
  },

  async getAttempt(attemptId: string): Promise<ExecutionAttemptSummary | null> {
    const res = await api.get(`/execution/attempt/${attemptId}`);
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return inner && typeof inner === 'object' ? (inner as ExecutionAttemptSummary) : null;
  },

  async cancel(attemptId: string): Promise<{ cancelled: boolean }> {
    const res = await api.post(`/execution/cancel/${attemptId}`);
    return { cancelled: true };
  },

  async retry(
    attemptId: string,
    reason?: string,
  ): Promise<{ retried: boolean; attemptId: string; attemptNumber: number }> {
    const res = await api.post(`/execution/retry/${attemptId}`, { reason });
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return {
      retried: true,
      attemptId: inner?.attemptId ?? attemptId,
      attemptNumber: inner?.attemptNumber ?? 0,
    };
  },

  evidenceDownloadUrl(evidenceId: string): string {
    const base = (api.defaults.baseURL ?? '/api/v1').replace(/\/$/, '');
    return `${base}/execution/evidence/${evidenceId}/download`;
  },

  evidencePreviewUrl(evidenceId: string): string {
    const base = (api.defaults.baseURL ?? '/api/v1').replace(/\/$/, '');
    return `${base}/execution/evidence/${evidenceId}/preview`;
  },
};
