// src/modules/reviews/domain/ports/review-repository.port.ts
import type {
  ReviewDecision,
  AwlReviewStatus as ReviewStatus,
} from '@prisma/client';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewEntity {
  id: string;
  tenantId: string;
  taskId: string;
  attemptId: string;
  status: ReviewStatus;
  decision: ReviewDecision;
  reviewerId: string | null;
  comment: string | null;
  revisionInstructions: string | null;
  decidedAt: Date | null;
  version: number;
}

export interface UpdateReviewInput {
  id: string;
  expectedVersion: number;
  status: ReviewStatus;
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
  findById(tenantId: string, id: string): Promise<ReviewEntity | null>;
  create(input: CreateReviewInput, tx?: any): Promise<ReviewEntity>;
  update(input: UpdateReviewInput, tx?: any): Promise<ReviewEntity>;
  findPending(tenantId: string, tx?: any): Promise<ReviewEntity[]>;
}
