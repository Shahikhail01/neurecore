// src/modules/reviews/domain/ports/review-repository.port.ts
import type { ReviewDecision, AwlReviewStatus } from '@prisma/client';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewEntity {
  id: string;
  tenantId: string;
  taskId: string;
  attemptId: string;
  status: AwlReviewStatus;
  decision: ReviewDecision;
  reviewerId: string | null;
  comment: string | null;
  revisionInstructions: string | null;
  decidedAt: Date | null;
  version: number;
}

export interface ReviewQueueItem extends ReviewEntity {
  task: {
    id: string;
    title: string;
    status: string;
    projectId: string | null;
    agentId: string | null;
  } | null;
  attempt: {
    id: string;
    attemptNumber: number;
    status: string;
  } | null;
}

export interface ReviewDetail extends ReviewEntity {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    agentId: string | null;
    projectId: string | null;
    requiredRole: string | null;
    requiredCapabilities: string[];
    version: number;
  } | null;
  attempt: {
    id: string;
    attemptNumber: number;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    tokensUsed: number | null;
    costCents: number | null;
    toolCallCount: number | null;
    outputSummary: string | null;
    modelVersion: string | null;
    promptVersion: string | null;
    graphVersion: string | null;
    toolVersion: string | null;
    evidence: Array<{
      id: string;
      artifactType: string;
      storageRef: string;
      mimeType: string | null;
      checksum: string;
      source: string;
      createdByActorId: string;
      createdAt: Date;
      metadata: unknown;
    }>;
  } | null;
}

export interface UpdateReviewInput {
  id: string;
  expectedVersion: number;
  status: AwlReviewStatus;
  decision: ReviewDecision;
  reviewerId: string;
  comment?: string;
  revisionInstructions?: string;
  decidedAt?: Date;
}

export interface CreateReviewInput {
  tenantId: string;
  taskId: string;
  attemptId: string;
}

export interface IReviewRepository {
  findById(
    tenantId: string,
    id: string,
    tx?: any,
  ): Promise<ReviewEntity | null>;
  create(input: CreateReviewInput, tx?: any): Promise<ReviewEntity>;
  update(input: UpdateReviewInput, tx?: any): Promise<ReviewEntity>;
  findPending(tenantId: string, tx?: any): Promise<ReviewEntity[]>;
  findPendingWithContext(tenantId: string, tx?: any): Promise<ReviewQueueItem[]>;
  findDetail(
    tenantId: string,
    reviewId: string,
    tx?: any,
  ): Promise<ReviewDetail | null>;
  upsertForAttempt(
    tenantId: string,
    taskId: string,
    attemptId: string,
    tx?: any,
  ): Promise<ReviewEntity>;
}
