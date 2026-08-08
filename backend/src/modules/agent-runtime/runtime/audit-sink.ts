/**
 * Phase 23 — AuditSink implementation.
 *
 * Append-only evidence chain for every agent run. Writes one row
 * per outcome so the certification gate (G23-A-009) can assert the
 * trail is preserved.
 *
 * SOLID — SRP: persists evidence; doesn't run, doesn't route.
 * SOLID — DIP: injected PrismaService; no direct `new PrismaClient`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AgentRunRecord,
  AgentRunEvidence,
} from '../interfaces/agent-runtime.interface';

export interface AuditSink {
  record(run: AgentRunRecord): Promise<void>;
  evidence(
    runId: string,
    items: ReadonlyArray<AgentRunEvidence>,
  ): Promise<void>;
}

@Injectable()
export class AgentRunAuditSink implements AuditSink {
  private readonly logger = new Logger(AgentRunAuditSink.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(run: AgentRunRecord): Promise<void> {
    // Append-only — we never update or delete an existing audit row.
    // The store owns the canonical `agent_runs` row; this sink writes
    // a parallel immutable record keyed by run id for cross-checking.
    await this.prisma.agentRunAudit.create({
      data: {
        id: `audit_${run.id}`,
        runId: run.id,
        tenantId: run.tenantId,
        agentId: run.agentId,
        status: run.status,
        actorUserId: run.actorUserId,
        recordedAt: new Date(run.createdAt),
      },
    });
    this.logger.debug(`audit-sink: recorded run ${run.id} (${run.status})`);
  }

  async evidence(
    runId: string,
    items: ReadonlyArray<AgentRunEvidence>,
  ): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.agentRunEvidence.createMany({
      data: items.map((e, idx) => ({
        id: `ev_${runId}_${idx}`,
        runId,
        skillKey: e.skillKey,
        confidence: e.confidence,
        citationsCount: e.citationsCount,
        durationMs: e.durationMs,
      })),
    });
  }
}
