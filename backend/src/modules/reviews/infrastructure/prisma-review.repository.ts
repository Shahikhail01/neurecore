// src/modules/reviews/infrastructure/prisma-review.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IReviewRepository,
  ReviewEntity,
  CreateReviewInput,
  UpdateReviewInput,
} from '../domain/ports/review-repository.port';
import type {
  ReviewDecision,
  AwlReviewStatus,
} from '@prisma/client';

@Injectable()
export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): ReviewEntity {
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
      version: 1,
    };
  }

  async findById(tenantId: string, id: string): Promise<ReviewEntity | null> {
    const row = await this.prisma.review.findFirst({ where: { id, tenantId } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateReviewInput, tx?: any): Promise<ReviewEntity> {
    const client = tx ?? this.prisma;
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

  async update(input: UpdateReviewInput, tx?: any): Promise<ReviewEntity> {
    const client = tx ?? this.prisma;
    const data: any = {
      status: input.status,
      decision: input.decision,
      reviewerId: input.reviewerId,
      decidedAt: input.decidedAt ?? new Date(),
    };
    if (input.comment !== undefined) data.comment = input.comment;
    if (input.revisionInstructions !== undefined)
      data.revisionInstructions = input.revisionInstructions;
    const row = await client.review.update({ where: { id: input.id }, data });
    return this.toEntity(row);
  }

  async findPending(tenantId: string, tx?: any): Promise<ReviewEntity[]> {
    const client = tx ?? this.prisma;
    const rows = await client.review.findMany({
      where: { tenantId, status: 'PENDING' },
      include: { task: true, attempt: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r: any) => this.toEntity(r));
  }
}
