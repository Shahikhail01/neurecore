/**
 * Phase 23 — AgentRunStore implementation.
 *
 * Persists agent runs + evidence rows. Implements IAgentRunStore
 * with no awareness of routing or LLM concerns.
 *
 * SOLID — SRP: persistence only.
 * SOLID — DIP: depends only on PrismaService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AgentRunNotFoundError, AgentRunTenantMismatchError } from '../errors';
import type {
  AgentRunCreateInput,
  AgentRunEvidence,
  AgentRunRecord,
  AgentRunStatus,
  IAgentRunStore,
} from '../interfaces/agent-runtime.interface';
import type { AgentId } from '../../agent-templates/agents.registry';

@Injectable()
export class AgentRunStore implements IAgentRunStore {
  private readonly logger = new Logger(AgentRunStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: AgentRunCreateInput): Promise<AgentRunRecord> {
    const created = await this.prisma.agentRun.create({
      data: {
        tenantId: input.tenantId,
        agentId: input.agentId as string,
        intent: input.intent,
        status: input.status,
        actorUserId: input.actorUserId,
        conversationId: input.conversationId ?? null,
        finalOutput: input.finalOutput ?? null,
        clarificationPrompt: input.clarificationPrompt ?? null,
        clarificationSuggestions: (input.clarificationSuggestions ??
          []) as string[],
        evidence: input.evidence as unknown as object,
      },
    });
    return this.toRecord(created);
  }

  async update(
    runId: string,
    patch: Partial<
      Pick<
        AgentRunCreateInput,
        | 'status'
        | 'finalOutput'
        | 'clarificationPrompt'
        | 'clarificationSuggestions'
        | 'evidence'
      >
    >,
    tenantId: string,
  ): Promise<AgentRunRecord> {
    const existing = await this.prisma.agentRun.findUnique({
      where: { id: runId },
    });
    if (!existing) throw new AgentRunNotFoundError(runId);
    if (existing.tenantId !== tenantId) {
      throw new AgentRunTenantMismatchError(runId, tenantId);
    }
    const updated = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: patch.status ?? existing.status,
        finalOutput:
          patch.finalOutput !== undefined
            ? patch.finalOutput
            : existing.finalOutput,
        clarificationPrompt:
          patch.clarificationPrompt !== undefined
            ? patch.clarificationPrompt
            : existing.clarificationPrompt,
        clarificationSuggestions:
          patch.clarificationSuggestions !== undefined
            ? (patch.clarificationSuggestions as string[])
            : existing.clarificationSuggestions,
        evidence:
          patch.evidence !== undefined
            ? (patch.evidence as unknown as object)
            : (existing.evidence as unknown as object),
      },
    });
    return this.toRecord(updated);
  }

  async get(runId: string, tenantId: string): Promise<AgentRunRecord> {
    const row = await this.prisma.agentRun.findUnique({ where: { id: runId } });
    if (!row) throw new AgentRunNotFoundError(runId);
    if (row.tenantId !== tenantId) {
      throw new AgentRunTenantMismatchError(runId, tenantId);
    }
    return this.toRecord(row);
  }

  async list(
    tenantId: string,
    opts?: { agentId?: AgentId; limit?: number },
  ): Promise<ReadonlyArray<AgentRunRecord>> {
    const rows = await this.prisma.agentRun.findMany({
      where: {
        tenantId,
        agentId: opts?.agentId as string | undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
    });
    return rows.map((r) => this.toRecord(r));
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    agentId: string;
    intent: string;
    status: AgentRunStatus;
    finalOutput: string | null;
    clarificationPrompt: string | null;
    clarificationSuggestions: string[];
    evidence: unknown;
    actorUserId: string;
    conversationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AgentRunRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId as AgentId,
      intent: row.intent,
      status: row.status,
      finalOutput: row.finalOutput,
      clarificationPrompt: row.clarificationPrompt,
      clarificationSuggestions: Object.freeze([
        ...(row.clarificationSuggestions ?? []),
      ]),
      evidence: Object.freeze(this.parseEvidence(row.evidence)),
      actorUserId: row.actorUserId,
      conversationId: row.conversationId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseEvidence(raw: unknown): ReadonlyArray<AgentRunEvidence> {
    if (!Array.isArray(raw)) return [];
    return (raw as Array<Record<string, unknown>>).map((e) => ({
      skillKey: typeof e['skillKey'] === 'string' ? e['skillKey'] : 'unknown',
      confidence: Number(e['confidence'] ?? 0),
      citationsCount: Number(e['citationsCount'] ?? 0),
      durationMs: Number(e['durationMs'] ?? 0),
    }));
  }
}
