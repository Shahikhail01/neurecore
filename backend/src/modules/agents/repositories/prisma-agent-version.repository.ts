/**
 * PrismaAgentVersionRepository
 *
 * SOLID:
 *   SRP  — Only handles AgentVersion persistence. No business logic.
 *   OCP  — New storage backends added by implementing IAgentVersionRepository.
 *   LSP  — Fully satisfies every method in IAgentVersionRepository.
 *   DIP  — AgentVersionService depends on IAgentVersionRepository, not this class directly.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IAgentVersionRepository,
  AgentVersionDto,
  AgentConfigSnapshot,
  CreateAgentVersionInput,
} from '../interfaces/agent-version.interface';

@Injectable()
export class PrismaAgentVersionRepository implements IAgentVersionRepository {
  private readonly logger = new Logger(PrismaAgentVersionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── create ─────────────────────────────────────────────────────────────

  /**
   * Persists a new snapshot for the given agent.
   * Runs inside a transaction to avoid version-number races and to
   * deactivate all previous versions before marking the new one active.
   */
  async create(input: CreateAgentVersionInput): Promise<AgentVersionDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Determine next sequential version number
      const last = await tx.agentVersion.findFirst({
        where: { agentId: input.agentId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;

      // 2. Deactivate all previous active versions
      await tx.agentVersion.updateMany({
        where: { agentId: input.agentId, isActive: true },
        data: { isActive: false },
      });

      // 3. Create and immediately activate new version
      const record = await tx.agentVersion.create({
        data: {
          agentId: input.agentId,
          tenantId: input.tenantId,
          versionNumber,
          label: input.label ?? null,
          configSnapshot: input.configSnapshot as never,
          changedBy: input.changedBy,
          changeNote: input.changeNote ?? null,
          isActive: true,
        },
      });

      this.logger.debug(
        `Snapshot v${versionNumber} created for agent ${input.agentId}`,
      );
      return this.toDto(record);
    });
  }

  // ─── findByAgentId ───────────────────────────────────────────────────────

  async findByAgentId(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto[]> {
    const records = await this.prisma.agentVersion.findMany({
      where: { agentId, tenantId },
      orderBy: { versionNumber: 'desc' },
    });
    return records.map((r) => this.toDto(r));
  }

  // ─── findActive ──────────────────────────────────────────────────────────

  async findActive(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto | null> {
    const record = await this.prisma.agentVersion.findFirst({
      where: { agentId, tenantId, isActive: true },
      orderBy: { versionNumber: 'desc' },
    });
    return record ? this.toDto(record) : null;
  }

  // ─── rollback ────────────────────────────────────────────────────────────

  /**
   * Applies the snapshot of a given version back to the agent row,
   * then marks that version as the active one.
   * All other versions remain – history is never deleted.
   */
  async rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify target version exists and belongs to this tenant
      const target = await tx.agentVersion.findFirst({
        where: { agentId, tenantId, versionNumber },
      });
      if (!target) {
        throw new NotFoundException(
          `Version ${versionNumber} not found for agent ${agentId}`,
        );
      }

      const snapshot = target.configSnapshot as unknown as AgentConfigSnapshot;

      // 2. Apply snapshot fields back to the agent row
      await tx.agent.update({
        where: { id: agentId },
        data: {
          ...(snapshot.name && { name: snapshot.name }),
          ...(snapshot.description !== undefined && {
            description: snapshot.description,
          }),
          ...(snapshot.model && { model: snapshot.model }),
          ...(snapshot.systemPrompt !== undefined && {
            systemPrompt: snapshot.systemPrompt,
          }),
          ...(snapshot.instructions !== undefined && {
            instructions: snapshot.instructions,
          }),
          ...(snapshot.budgetPerDay !== undefined && {
            budgetPerDay: snapshot.budgetPerDay ?? null,
          }),
          ...(snapshot.permissions && {
            permissions: snapshot.permissions as never,
          }),
          ...(snapshot.config && { config: snapshot.config as never }),
        },
      });

      // 3. Deactivate all versions, then activate the target
      await tx.agentVersion.updateMany({
        where: { agentId, isActive: true },
        data: { isActive: false },
      });
      const updated = await tx.agentVersion.update({
        where: { id: target.id },
        data: { isActive: true },
      });

      this.logger.log(
        `Rolled back agent ${agentId} to v${versionNumber} (id=${target.id})`,
      );
      return this.toDto(updated);
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private toDto(record: {
    id: string;
    agentId: string;
    tenantId: string;
    versionNumber: number;
    label: string | null;
    configSnapshot: unknown;
    changedBy: string;
    changeNote: string | null;
    isActive: boolean;
    createdAt: Date;
  }): AgentVersionDto {
    return {
      id: record.id,
      agentId: record.agentId,
      tenantId: record.tenantId,
      versionNumber: record.versionNumber,
      label: record.label,
      configSnapshot: record.configSnapshot as AgentConfigSnapshot,
      changedBy: record.changedBy,
      changeNote: record.changeNote,
      isActive: record.isActive,
      createdAt: record.createdAt,
    };
  }
}
