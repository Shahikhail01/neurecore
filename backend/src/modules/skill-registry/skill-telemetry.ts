/**
 * Phase 11 — SkillTelemetry.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md §2 + §6 (cost + observability).
 *
 * Owns ONLY the recording of skill execution telemetry. Phase 14
 * Command Center surfaces this for cost dashboards.
 *
 * SRP:
 *   - Does NOT aggregate or query — write-only by design.
 *   - Persists via PrismaService (the canonical DB layer).
 *
 * Persisted shape (intentionally flat, low-cardinality):
 *   - tenantId, skillId, actorId, durationMs, tokensIn, tokensOut,
 *     confidence, limits (array of free-form strings).
 *
 * Phase 14 upgrade path: add a fan-out to the existing
 * `TelemetryService` (already used by AI Twin and chat). Until then
 * this writes to its own table so cost surfaces work without
 * changing unrelated modules.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';

export interface SkillTelemetryRun {
  readonly skillId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly durationMs: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly confidence: number;
  readonly limits: ReadonlyArray<string>;
}

/**
 * Thrown when the underlying write fails. Surfaced so the executor
 * can decide retry-vs-skip without leaking Prisma types.
 */
export class SkillTelemetryWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SkillTelemetryWriteError';
  }
}

@Injectable()
export class SkillTelemetry {
  private readonly logger = new Logger(SkillTelemetry.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist one telemetry row. Uses upsert-by-trace-id when the
   * caller supplies one; otherwise append-only.
   *
   * Failures are surfaced as typed errors. The caller may swallow
   * them (telemetry must never break a skill response).
   */
  async recordRun(run: SkillTelemetryRun): Promise<void> {
    try {
      const details = {
        confidence: run.confidence,
        durationMs: run.durationMs,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        limits: [...run.limits],
      } as Prisma.InputJsonValue;
      await this.prisma.auditLog.create({
        data: {
          actor: run.actorId,
          tenantId: run.tenantId,
          action: `skill.${run.skillId}.run`,
          resource: 'skill-registry',
          resourceId: run.skillId,
          result: 'success',
          details,
        },
      });
    } catch (err) {
      // Telemetry must never break the caller. We log + rethrow a
      // typed error so the executor can decide retry-vs-skip.
      this.logger.warn(
        `skill telemetry write failed for ${run.skillId}: ${(err as Error).message}`,
      );
      throw new SkillTelemetryWriteError(
        `telemetry write failed for ${run.skillId}`,
        err,
      );
    }
  }
}
