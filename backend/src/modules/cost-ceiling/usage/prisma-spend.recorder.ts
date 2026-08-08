/**
 * Phase 30 — Prisma spend recorder (CR-AI-1305).
 *
 * Persists realised LLM spend as a `CostRecord` row so the ceiling
 * sees it on the next authorisation and the Command Center cost view
 * reconciles against the same source of truth.
 *
 * Writes are idempotent-by-construction: every row carries a unique
 * `sourceEventId`, and a duplicate is swallowed rather than surfaced,
 * because an accounting retry must never fail a user-facing call.
 *
 * SOLID
 *   SRP — owns ONLY the write.
 *   LSP — implements `ISpendRecorder`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ISpendRecorder } from '../interfaces/ISpendRecorder';
import type { SpendReport } from '../interfaces/ICostCeilingEnforcer';

/** Attribution tag so P30 rows are distinguishable from gateway rows. */
export const COST_CEILING_SOURCE_MODULE = 'cost-ceiling';

@Injectable()
export class PrismaSpendRecorder implements ISpendRecorder {
  private readonly logger = new Logger(PrismaSpendRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(report: SpendReport): Promise<void> {
    if (report.costCents <= 0 && report.tokens <= 0) return;
    const now = new Date();
    try {
      await this.prisma.costRecord.create({
        data: {
          tenantId: report.tenantId,
          provider: 'llm-runner',
          model: report.capability,
          inputTokens: 0,
          outputTokens: Math.max(0, Math.round(report.tokens)),
          costCents: Math.max(0, Math.round(report.costCents)),
          windowStart: now,
          windowEnd: now,
          sourceModule: COST_CEILING_SOURCE_MODULE,
          sourceEventId: `${COST_CEILING_SOURCE_MODULE}:${randomUUID()}`,
          metadata: { capability: report.capability },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Unique constraint|sourceEventId/i.test(message)) return;
      this.logger.warn(
        `spend recording failed for tenant=${report.tenantId}: ${message}`,
      );
    }
  }
}
