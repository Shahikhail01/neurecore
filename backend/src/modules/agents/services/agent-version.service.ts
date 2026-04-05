/**
 * AgentVersionService
 *
 * SOLID:
 *   SRP  — Only manages version snapshots and rollback orchestration.
 *          Does NOT touch agent config directly — delegates to PrismaAgentVersionRepository.
 *   OCP  — Snapshot strategy can be changed without touching this service
 *          (swap the IAgentVersionRepository implementation).
 *   DIP  — Depends on PrismaAgentVersionRepository through constructor injection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaAgentVersionRepository } from '../repositories/prisma-agent-version.repository';
import type {
  AgentVersionDto,
  AgentConfigSnapshot,
  CreateAgentVersionInput,
} from '../interfaces/agent-version.interface';

@Injectable()
export class AgentVersionService {
  private readonly logger = new Logger(AgentVersionService.name);

  constructor(private readonly versionRepo: PrismaAgentVersionRepository) {}

  /**
   * Persist a new config snapshot for an agent.
   * Called automatically by AgentsService.update() and manually from the controller.
   */
  async snapshotAgent(
    input: CreateAgentVersionInput,
  ): Promise<AgentVersionDto> {
    this.logger.log(
      `Snapshotting agent ${input.agentId} by ${input.changedBy}`,
    );
    return this.versionRepo.create(input);
  }

  /**
   * List all versions for an agent, ordered newest → oldest.
   */
  async listVersions(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto[]> {
    return this.versionRepo.findByAgentId(agentId, tenantId);
  }

  /**
   * Return the currently active (deployed) version.
   */
  async getActiveVersion(
    agentId: string,
    tenantId: string,
  ): Promise<AgentVersionDto | null> {
    return this.versionRepo.findActive(agentId, tenantId);
  }

  /**
   * Roll an agent back to a specific version by version number.
   * Returns the newly-active version record.
   */
  async rollback(
    agentId: string,
    tenantId: string,
    versionNumber: number,
  ): Promise<AgentVersionDto> {
    this.logger.log(
      `Rolling back agent ${agentId} (tenant ${tenantId}) to v${versionNumber}`,
    );
    return this.versionRepo.rollback(agentId, tenantId, versionNumber);
  }

  /**
   * Build a config snapshot from a raw agent record object.
   * Keeps the snapshot contract stable even when the Agent model evolves.
   */
  buildSnapshot(agent: Record<string, unknown>): AgentConfigSnapshot {
    return {
      name: String(agent['name'] ?? ''),
      description:
        agent['description'] !== undefined
          ? (agent['description'] as string | null)
          : null,
      model: String(agent['model'] ?? 'gpt-4o-mini'),
      systemPrompt:
        agent['systemPrompt'] !== undefined
          ? (agent['systemPrompt'] as string | null)
          : null,
      instructions:
        agent['instructions'] !== undefined
          ? (agent['instructions'] as string | null)
          : null,
      budgetPerDay:
        agent['budgetPerDay'] !== undefined
          ? (agent['budgetPerDay'] as string | null)
          : null,
      permissions: Array.isArray(agent['permissions'])
        ? (agent['permissions'] as unknown[])
        : [],
      config:
        agent['config'] !== null &&
        typeof agent['config'] === 'object' &&
        !Array.isArray(agent['config'])
          ? (agent['config'] as Record<string, unknown>)
          : {},
    };
  }
}
