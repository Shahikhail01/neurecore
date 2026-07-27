// services/reviews.service.ts
//
// Phase 6 — Human Review, Revision, and Lifecycle
// Frontend service for the Review inbox + decision flow.
// All mutations go through the canonical command path on the backend.

import axios from '@/services/api';

export type ReviewDecision =
  | 'APPROVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED'
  | 'CANCELLED';

export type ReviewStatus = ReviewDecision | 'PENDING';

export interface ReviewEntity {
  id: string;
  tenantId: string;
  taskId: string;
  attemptId: string;
  status: ReviewStatus;
  decision: ReviewDecision | 'PENDING';
  reviewerId: string | null;
  comment: string | null;
  revisionInstructions: string | null;
  decidedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListItem extends ReviewEntity {
  task?: {
    id: string;
    title: string;
    status: string;
    projectId: string;
    agentId: string | null;
  } | null;
  attempt?: {
    id: string;
    attemptNumber: number;
    status: string;
  } | null;
}

export interface ReviewDetail {
  id: string;
  tenantId: string;
  taskId: string;
  attemptId: string;
  status: ReviewStatus;
  decision: ReviewDecision | 'PENDING';
  reviewerId: string | null;
  comment: string | null;
  revisionInstructions: string | null;
  decidedAt: string | null;
  version: number;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    agentId: string | null;
    projectId: string;
    requiredRole: string | null;
    requiredCapabilities: string[];
    version: number;
  } | null;
  attempt: {
    id: string;
    attemptNumber: number;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    tokensUsed: number;
    costCents: number;
    toolCallCount: number;
    outputSummary: string | null;
    modelVersion: string | null;
    promptVersion: string | null;
    graphVersion: string | null;
    toolVersion: string | null;
    evidence: EvidenceArtifact[];
  } | null;
}

export interface EvidenceArtifact {
  id: string;
  artifactType: 'DRAFT' | 'REPORT' | 'DOCUMENT' | 'DATA' | 'OUTPUT';
  storageRef: string;
  mimeType: string;
  checksum: string;
  source: 'AI_GENERATED' | 'HUMAN_PROVIDED' | 'SYSTEM_DERIVED';
  createdByActorId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface DecideReviewInput {
  decision: ReviewDecision;
  comment?: string;
  revisionInstructions?: string;
}

export interface DecideReviewResult {
  reviewId: string;
  taskId: string;
  previousReviewStatus: string;
  newReviewStatus: string;
  newTaskStatus: string | null;
  revisionAttemptCreated: boolean;
  revisionAttemptId: string | null;
  correlationId: string;
  decidedAt: string;
}

export interface AdvanceProjectStageInput {
  projectId: string;
  toStage: string;
  waiverReason?: string;
}

export interface AdvanceProjectStageResult {
  projectId: string;
  fromStage: string;
  toStage: string;
  waiverId: string | null;
  correlationId: string;
  occurredAt: string;
}

/**
 * Unwrap the standard `{ status, data, meta }` envelope returned by the
 * backend `TransformResponseInterceptor`. Returns `null` when the inner
 * `data` is missing so callers can `if (!result) ...` safely.
 */
function unwrap<T>(payload: { data: T } | T | undefined | null): T | null {
  if (payload === null || payload === undefined) return null;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    (payload as { data: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function isAbortOrNotFound(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const err = error as {
    isAxiosError?: boolean;
    response?: { status?: number };
    code?: string;
    name?: string;
  };
  // Treat 404 + aborted requests as a safe no-op for list/detail calls.
  // Other errors (5xx, network) are surfaced to the caller.
  const status = err.response?.status ?? 0;
  return (
    err.isAxiosError === true &&
    (status === 404 || err.code === 'ERR_CANCELED' || err.name === 'AbortError')
  );
}

export const reviewsService = {
  /**
   * Lists all pending reviews for the current tenant. The inbox view
   * uses this to show what needs a human decision.
   */
  async listPending(): Promise<ReviewListItem[]> {
    try {
      const res = await axios.get('/reviews/pending');
      return unwrap<ReviewListItem[]>(res.data ?? res) ?? [];
    } catch (e) {
      if (isAbortOrNotFound(e)) return [];
      throw e;
    }
  },

  /**
   * Loads the full detail (task, attempt, evidence artifacts) for one
   * review. Drives the review decision modal/screen.
   */
  async getDetail(reviewId: string): Promise<ReviewDetail | null> {
    try {
      const res = await axios.get(`/reviews/${encodeURIComponent(reviewId)}`);
      const data = unwrap<ReviewDetail | null>(res.data ?? res);
      // Backend returns the row OR null when the review doesn't exist in
      // the caller's tenant. Some 404 envelopes come through as `null`.
      return data ?? null;
    } catch (e) {
      if (isAbortOrNotFound(e)) return null;
      throw e;
    }
  },

  /**
   * Submits a review decision (APPROVED | REVISION_REQUESTED | REJECTED | CANCELLED).
   * Goes through the canonical DecideTaskReviewCommand on the backend:
   * single transaction, optimistic concurrency, audit + outbox event.
   *
   * Returns the inner `CommandResult.data` so callers receive the typed
   * `DecideReviewResult` rather than the wrapped command envelope.
   */
  async decide(
    reviewId: string,
    input: DecideReviewInput,
  ): Promise<DecideReviewResult> {
    if (!input.decision) {
      throw new Error('Decision required');
    }
    if (
      input.decision === 'REVISION_REQUESTED' &&
      !input.revisionInstructions?.trim()
    ) {
      throw new Error('Revision instructions are required when requesting a revision');
    }
    const res = await axios.post(
      `/reviews/${encodeURIComponent(reviewId)}/decide`,
      input,
    );
    const envelope = unwrap<{ data: DecideReviewResult }>(res.data ?? res);
    if (!envelope || !envelope.data) {
      throw new Error('Empty response from decide endpoint');
    }
    return envelope.data;
  },

  /**
   * Advances a project lifecycle stage. Required by the G6 gate
   * (project completion guard). When the guard would fail, the
   * caller may pass a structured `waiverReason`; the backend
   * records a LifecycleWaiver row before applying the transition.
   */
  async advanceProjectStage(
    projectId: string,
    toStage: string,
    waiverReason?: string,
  ): Promise<AdvanceProjectStageResult> {
    if (!projectId) throw new Error('projectId required');
    if (!toStage) throw new Error('toStage required');
    if (waiverReason !== undefined && !waiverReason.trim()) {
      throw new Error('waiverReason must be a non-empty string when supplied');
    }
    const res = await axios.post(
      `/projects/${encodeURIComponent(projectId)}/advance-stage`,
      { toStage, waiverReason: waiverReason?.trim() },
    );
    const envelope = unwrap<{ data: AdvanceProjectStageResult }>(res.data ?? res);
    if (!envelope || !envelope.data) {
      throw new Error('Empty response from advance-stage endpoint');
    }
    return envelope.data;
  },
};
