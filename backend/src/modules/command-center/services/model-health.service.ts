/**
 * command-center/services/model-health.service.ts
 *
 * P8 — CR-AI-1204 Model Health view.
 *
 * Aggregates ExecutionAttempt rows to compute per-model latency
 * p50/p95, error rate, success rate and an overall grade. The
 * grade is derived, never hard-coded.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  ModelHealthResponseDto,
  ModelHealthEntryDto,
} from '../dto/model-health.dto';

const DEFAULT_WINDOW_HOURS = 24;

export type Grade = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export function grade(errorRate: number, attempts: number): Grade {
  if (attempts === 0) return 'UNKNOWN';
  if (errorRate >= 0.25) return 'UNHEALTHY';
  if (errorRate >= 0.1) return 'DEGRADED';
  return 'HEALTHY';
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[idx];
}

export function computeModelHealthBuckets(
  attempts: ReadonlyArray<{
    modelVersion: string | null;
    startedAt: Date | null;
    endedAt: Date | null;
    status: string;
  }>,
): {
  models: ModelHealthEntryDto[];
  totalAttempts: number;
  totalFailed: number;
} {
  const buckets = new Map<
    string,
    { durations: number[]; total: number; failed: number }
  >();
  let totalAttempts = 0;
  let totalFailed = 0;
  for (const a of attempts) {
    const model = a.modelVersion ?? 'unknown';
    const b = buckets.get(model) ?? { durations: [], total: 0, failed: 0 };
    b.total += 1;
    totalAttempts += 1;
    if (a.status === 'FAILED' || a.status === 'CANCELLED') {
      b.failed += 1;
      totalFailed += 1;
    }
    if (a.startedAt && a.endedAt) {
      const d = a.endedAt.getTime() - a.startedAt.getTime();
      if (d >= 0) b.durations.push(d);
    }
    buckets.set(model, b);
  }
  const models: ModelHealthEntryDto[] = [];
  for (const [model, b] of buckets.entries()) {
    b.durations.sort((x, y) => x - y);
    const avg =
      b.durations.length > 0
        ? b.durations.reduce((a2, b2) => a2 + b2, 0) / b.durations.length
        : null;
    const p95 = percentile(b.durations, 0.95);
    const errorRate = b.total > 0 ? b.failed / b.total : 0;
    models.push({
      model,
      attempts: b.total,
      successful: b.total - b.failed,
      failed: b.failed,
      avgDurationMs: avg,
      p95DurationMs: p95,
      errorRate,
      grade: grade(errorRate, b.total),
      source: 'ExecutionAttempt',
    });
  }
  models.sort((a, b) => b.attempts - a.attempts);
  return { models, totalAttempts, totalFailed };
}

@Injectable()
export class ModelHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getModelHealth(
    tenantId: string,
    windowHours = DEFAULT_WINDOW_HOURS,
  ): Promise<ModelHealthResponseDto> {
    const safeHours = Math.max(1, Math.min(24 * 30, windowHours));
    const now = new Date();
    const windowStart = new Date(now.getTime() - safeHours * 3600 * 1000);

    const attempts = await this.prisma.executionAttempt.findMany({
      where: { tenantId, createdAt: { gte: windowStart } },
      select: {
        id: true,
        modelVersion: true,
        startedAt: true,
        endedAt: true,
        status: true,
      },
    });

    const { models, totalAttempts, totalFailed } =
      computeModelHealthBuckets(attempts);

    return {
      tenantId,
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      fetchedAt: now.toISOString(),
      totalAttempts,
      overallErrorRate: totalAttempts > 0 ? totalFailed / totalAttempts : 0,
      models,
    };
  }
}
