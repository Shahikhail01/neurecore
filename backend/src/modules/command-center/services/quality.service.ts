/**
 * command-center/services/quality.service.ts
 *
 * P8 — CR-AI-1202 Quality view.
 *
 * Surfaces the canonical quality signals:
 *   - ExecutionLog.evaluationScore + reflection (evaluator signal)
 *   - Review.decision / status (human feedback)
 *   - Aggregated summary (avg score, abstention/correction counts)
 *
 * Each row carries the source model so the dashboard can present
 * an evidence trail. No fabricated scores; null when absent.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  QualityResponseDto,
  QualitySummaryDto,
  QualityAttemptDto,
  QualityReviewDto,
} from '../dto/quality.dto';

const DEFAULT_WINDOW_HOURS = 24 * 7; // last 7 days

export function computeQualitySummary(
  logs: ReadonlyArray<{
    evaluationScore: number | null;
    reflection: string | null;
  }>,
  reviews: ReadonlyArray<{
    decision: string;
    comment: string | null;
  }>,
  revisionCount: number,
  feedbackCount: number,
): QualitySummaryDto {
  const scores = logs
    .map((l) => l.evaluationScore)
    .filter((s): s is number => typeof s === 'number');
  const averageScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  const abstentionCount = logs.filter(
    (l) =>
      typeof l.reflection === 'string' &&
      /abstain|abstention|not.?supported/i.test(l.reflection),
  ).length;
  const correctionCount = reviews.filter(
    (r) =>
      r.decision === 'REJECTED' ||
      r.decision === 'REVISION_REQUESTED' ||
      r.decision === 'NEEDS_REVISION',
  ).length;
  return {
    averageScore,
    evaluatedCount: logs.length,
    abstentionCount,
    correctionCount,
    revisionCount,
    feedbackCount,
  };
}

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuality(
    tenantId: string,
    windowHours = DEFAULT_WINDOW_HOURS,
    limit = 50,
  ): Promise<QualityResponseDto> {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const safeHours = Math.max(1, Math.min(24 * 30, windowHours));
    const now = new Date();
    const windowStart = new Date(now.getTime() - safeHours * 3600 * 1000);

    const [logs, reviews, revisionCount, feedbackCount] = await Promise.all([
      this.prisma.executionLog.findMany({
        where: {
          agent: { tenantId },
          createdAt: { gte: windowStart },
          OR: [
            { evaluationScore: { not: null } },
            { reflection: { not: null } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          agentId: true,
          taskId: true,
          evaluationScore: true,
          reflection: true,
          createdAt: true,
        },
      }),
      this.prisma.review.findMany({
        where: { tenantId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          taskId: true,
          attemptId: true,
          decision: true,
          status: true,
          comment: true,
          decidedAt: true,
        },
      }),
      this.prisma.review.count({
        where: {
          tenantId,
          decision: { in: ['REVISION_REQUESTED', 'NEEDS_REVISION'] },
          createdAt: { gte: windowStart },
        },
      }),
      this.prisma.review.count({
        where: {
          tenantId,
          comment: { not: null },
          createdAt: { gte: windowStart },
        },
      }),
    ]);

    const scores = logs
      .map((l) => l.evaluationScore)
      .filter((s): s is number => typeof s === 'number');
    const averageScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    const abstentionCount = logs.filter(
      (l) =>
        typeof l.reflection === 'string' &&
        /abstain|abstention|not.?supported/i.test(l.reflection),
    ).length;
    const correctionCount = reviews.filter(
      (r) =>
        r.decision === 'REJECTED' ||
        r.decision === 'REVISION_REQUESTED' ||
        r.decision === 'NEEDS_REVISION',
    ).length;

    return {
      tenantId,
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      fetchedAt: now.toISOString(),
      summary: {
        averageScore,
        evaluatedCount: logs.length,
        abstentionCount,
        correctionCount,
        revisionCount,
        feedbackCount,
      } satisfies QualitySummaryDto,
      attempts: logs.map<QualityAttemptDto>((l) => ({
        attemptId: l.id,
        taskId: l.taskId ?? '',
        agentId: l.agentId,
        score: l.evaluationScore,
        reflection: l.reflection,
        evaluatedAt: l.createdAt.toISOString(),
        source: 'ExecutionLog',
      })),
      reviews: reviews.map<QualityReviewDto>((r) => ({
        id: r.id,
        taskId: r.taskId,
        attemptId: r.attemptId,
        decision: String(r.decision),
        status: String(r.status),
        comment: r.comment,
        decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
        source: 'Review',
      })),
    };
  }
}
