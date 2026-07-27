// src/modules/reviews/infrastructure/prisma-review.repository.ts
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Review,
  type AwlReviewStatus,
  type ReviewDecision,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  type IReviewRepository,
  type ReviewDetail,
  type ReviewEntity,
  type ReviewQueueItem,
  type CreateReviewInput,
  type UpdateReviewInput,
} from '../domain/ports/review-repository.port';

type TxClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: Review): ReviewEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      taskId: row.taskId,
      attemptId: row.attemptId,
      status: row.status,
      decision: row.decision,
      reviewerId: row.reviewerId,
      comment: row.comment,
      revisionInstructions: row.revisionInstructions,
      decidedAt: row.decidedAt,
      version: row.version,
    };
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewEntity | null> {
    const client = (tx ?? this.prisma) as TxClient;
    const row = await client.review.findFirst({ where: { id, tenantId } });
    return row ? this.toEntity(row) : null;
  }

  async create(
    input: CreateReviewInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewEntity> {
    const client = (tx ?? this.prisma) as TxClient;
    const row = await client.review.create({
      data: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        attemptId: input.attemptId,
        status: 'PENDING' as AwlReviewStatus,
        decision: 'PENDING' as ReviewDecision,
      },
    });
    return this.toEntity(row);
  }

  async update(
    input: UpdateReviewInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewEntity> {
    const client = (tx ?? this.prisma) as TxClient;

    const data: Prisma.ReviewUpdateManyMutationInput = {
      status: input.status,
      decision: input.decision,
      reviewerId: input.reviewerId,
      decidedAt: input.decidedAt ?? new Date(),
      version: { increment: 1 },
    };
    if (input.comment !== undefined) data.comment = input.comment;
    if (input.revisionInstructions !== undefined)
      data.revisionInstructions = input.revisionInstructions;

    // Optimistic concurrency: only update if version still matches.
    // updateMany returns { count }; if 0, another writer raced us.
    const result = await client.review.updateMany({
      where: { id: input.id, version: input.expectedVersion },
      data,
    });
    if (result.count === 0) {
      throw new Error('OPTIMISTIC_LOCK_FAILED');
    }
    const row = await client.review.findUniqueOrThrow({
      where: { id: input.id },
    });
    return this.toEntity(row);
  }

  async findPending(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewEntity[]> {
    const client = (tx ?? this.prisma) as TxClient;
    const rows = await client.review.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findPendingWithContext(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewQueueItem[]> {
    const client = (tx ?? this.prisma) as TxClient;
    const rows = await client.review.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            projectId: true,
            agentId: true,
          },
        },
        attempt: {
          select: {
            id: true,
            attemptNumber: true,
            status: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      ...this.toEntity(row),
      task: row.task,
      attempt: row.attempt,
    }));
  }

  async findDetail(
    tenantId: string,
    reviewId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewDetail | null> {
    const client = (tx ?? this.prisma) as TxClient;
    const row = await client.review.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            agentId: true,
            projectId: true,
            requiredRole: true,
            requiredCapabilities: true,
            version: true,
          },
        },
        attempt: {
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            startedAt: true,
            endedAt: true,
            tokensUsed: true,
            costCents: true,
            toolCallCount: true,
            outputSummary: true,
            modelVersion: true,
            promptVersion: true,
            graphVersion: true,
            toolVersion: true,
            evidence: {
              select: {
                id: true,
                artifactType: true,
                storageRef: true,
                mimeType: true,
                checksum: true,
                source: true,
                createdByActorId: true,
                createdAt: true,
                metadata: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!row) return null;
    return {
      ...this.toEntity(row),
      task: row.task,
      attempt: row.attempt,
    };
  }

  async upsertForAttempt(
    tenantId: string,
    taskId: string,
    attemptId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewEntity> {
    const client = (tx ?? this.prisma) as TxClient;
    // attemptId is unique at the DB level; we MUST also enforce tenant
    // isolation here because two tenants could in principle share an
    // attemptId if the cuid was not generated per-tenant (UUIDs are not
    // guaranteed unique across tenants without per-tenant prefixes).
    const existing = await client.review.findFirst({
      where: { attemptId, tenantId },
    });
    if (existing) {
      return this.toEntity(existing);
    }
    const row = await client.review.create({
      data: {
        tenantId,
        taskId,
        attemptId,
        status: 'PENDING' as AwlReviewStatus,
        decision: 'PENDING' as ReviewDecision,
      },
    });
    return this.toEntity(row);
  }
}
