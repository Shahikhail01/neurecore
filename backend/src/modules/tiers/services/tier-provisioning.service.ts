/**
 * TierProvisioningService - SOLID: Single Responsibility Principle
 *
 * SRP: ONLY handles automatic agent provisioning on tenant creation
 * OCP: New provisioning strategies extend without modifying core logic
 * DIP: Depends on abstractions (PrismaService), not concretions
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { TenantDeploymentService } from './tenant-deployment.service';

export interface ProvisioningResult {
  tenantId: string;
  tierId: string;
  agentsProvisioned: number;
  agentIds: string[];
}

export interface ITierProvisioningService {
  provisionAgents(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<ProvisioningResult>;
  getAvailableAgentsForTenant(tenantId: string): Promise<AvailableAgent[]>;
  selectAgent(
    tenantId: string,
    tierAgentPoolId: string,
    actorId: string,
  ): Promise<string>;
  deselectAgent(
    tenantId: string,
    agentId: string,
    actorId: string,
  ): Promise<void>;
  replaceAgent(
    tenantId: string,
    currentAgentId: string,
    newTierAgentPoolId: string,
    actorId: string,
  ): Promise<string>;
}

export interface AvailableAgent {
  tierAgentPoolId: string;
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  agentType: string;
  isRequired: boolean;
  isSelected: boolean;
  selectedAgentId?: string;
}

@Injectable()
export class TierProvisioningService implements ITierProvisioningService {
  private readonly logger = new Logger(TierProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDeploymentService: TenantDeploymentService,
  ) {}

  /**
   * Provision agents for a new tenant based on their tier's agent pool
   * Called automatically when a tenant is created
   */
  async provisionAgents(
    tenantId: string,
    tierId: string,
    actorId?: string,
  ): Promise<ProvisioningResult> {
    return this.tenantDeploymentService.provisionAgentsForTier(
      tenantId,
      tierId,
      actorId,
    );
  }

  /**
   * Get available agents a tenant can select from based on their tier
   */
  async getAvailableAgentsForTenant(
    tenantId: string,
  ): Promise<AvailableAgent[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierAgentPools: {
              include: { template: true },
              orderBy: { slot: 'asc' },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Get currently selected agents for this tenant
    const selectedAgents = await this.prisma.agent.findMany({
      where: { tenantId, isSelected: true, tierAgentPoolId: { not: null } },
      select: { tierAgentPoolId: true, id: true },
    });

    const selectedMap = new Map(
      selectedAgents.map((a) => [a.tierAgentPoolId!, a.id]),
    );

    // Check how many agents tenant can select (tier limit)
    const tierAgentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });

    const canSelectMore = tierAgentCount < tenant.tier.maxAgents;

    return tenant.tier.tierAgentPools.map((pool) => ({
      tierAgentPoolId: pool.id,
      templateId: pool.template.id,
      templateName: pool.template.name,
      templateDescription: pool.template.description,
      agentType: pool.template.type,
      isRequired: pool.isRequired,
      isSelected: selectedMap.has(pool.id) || pool.isRequired,
      selectedAgentId: selectedMap.get(pool.id),
    }));
  }

  /**
   * Select an agent from the tier's pool for a tenant
   */
  async selectAgent(
    tenantId: string,
    tierAgentPoolId: string,
    actorId: string,
  ): Promise<string> {
    // Verify tenant and tier access
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Verify the pool entry belongs to tenant's tier
    const poolEntry = await this.prisma.tierAgentPool.findUnique({
      where: { id: tierAgentPoolId },
      include: { template: true },
    });
    if (!poolEntry || poolEntry.tierId !== tenant.tierId) {
      throw new BadRequestException(
        `Agent template not available in your tier`,
      );
    }

    // Check tier agent limit
    const currentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    if (currentCount >= tenant.tier.maxAgents) {
      throw new BadRequestException(
        `Agent limit reached (${tenant.tier.maxAgents}). Deselect an agent first.`,
      );
    }

    // Check if already selected
    const existing = await this.prisma.agent.findFirst({
      where: { tenantId, tierAgentPoolId },
    });
    if (existing) {
      // Just activate it
      await this.prisma.agent.update({
        where: { id: existing.id },
        data: { isSelected: true },
      });
      return existing.id;
    }

    // Create new agent from pool
    const agent = await this.prisma.agent.create({
      data: {
        name: poolEntry.template.name,
        description: poolEntry.template.description,
        type: poolEntry.template.type,
        model: poolEntry.defaultModel ?? poolEntry.template.model,
        systemPrompt: poolEntry.template.systemPrompt,
        instructions: poolEntry.template.instructions,
        permissions: (poolEntry.template.permissions ??
          []) as Prisma.InputJsonValue,
        config: (poolEntry.template.config ?? {}) as Prisma.InputJsonValue,
        budgetPerDay: poolEntry.defaultBudgetPerDay,
        isActive: true,
        isSelected: true,
        tenantId,
        tierAgentPoolId,
        templateId: poolEntry.template.id,
        templateVersion: poolEntry.template.version,
        createdById: actorId,
      },
    });

    this.logger.log(`Tenant ${tenantId} selected agent ${agent.id} from pool`);
    return agent.id;
  }

  /**
   * Deselect (deactivate) an agent for a tenant
   * Cannot deselect required agents
   */
  async deselectAgent(
    tenantId: string,
    agentId: string,
    actorId: string,
  ): Promise<void> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found for tenant`);
    }

    if (agent.tierAgentPoolId) {
      const poolEntry = await this.prisma.tierAgentPool.findUnique({
        where: { id: agent.tierAgentPoolId },
      });
      if (poolEntry?.isRequired) {
        throw new BadRequestException(
          `Cannot deselect required agent "${poolEntry.id}"`,
        );
      }
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { isSelected: false, isActive: false },
    });

    this.logger.log(`Tenant ${tenantId} deselected agent ${agentId}`);
  }

  /**
   * Replace a selected agent with a different one from the pool
   */
  async replaceAgent(
    tenantId: string,
    currentAgentId: string,
    newTierAgentPoolId: string,
    actorId: string,
  ): Promise<string> {
    // Verify tenant and tier
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Verify current agent belongs to tenant
    const currentAgent = await this.prisma.agent.findFirst({
      where: { id: currentAgentId, tenantId },
    });
    if (!currentAgent) {
      throw new NotFoundException(
        `Agent ${currentAgentId} not found for tenant`,
      );
    }

    // Cannot replace required agents
    if (currentAgent.tierAgentPoolId) {
      const currentPool = await this.prisma.tierAgentPool.findUnique({
        where: { id: currentAgent.tierAgentPoolId },
      });
      if (currentPool?.isRequired) {
        throw new BadRequestException(`Cannot replace required agent`);
      }
    }

    // Verify new pool entry
    const newPool = await this.prisma.tierAgentPool.findUnique({
      where: { id: newTierAgentPoolId },
      include: { template: true },
    });
    if (!newPool || newPool.tierId !== tenant.tierId) {
      throw new BadRequestException(
        `Agent template not available in your tier`,
      );
    }

    // Check if new agent already selected
    const alreadySelected = await this.prisma.agent.findFirst({
      where: {
        tenantId,
        tierAgentPoolId: newTierAgentPoolId,
        isSelected: true,
      },
    });
    if (alreadySelected) {
      throw new BadRequestException(`Agent already selected`);
    }

    // Transaction: deactivate old, create new
    const result = await this.prisma.$transaction(async (tx) => {
      // Deactivate current agent
      await tx.agent.update({
        where: { id: currentAgentId },
        data: { isSelected: false, isActive: false },
      });

      // Create new agent from pool
      const newAgent = await tx.agent.create({
        data: {
          name: newPool.template.name,
          description: newPool.template.description,
          type: newPool.template.type,
          model: newPool.defaultModel ?? newPool.template.model,
          systemPrompt: newPool.template.systemPrompt,
          instructions: newPool.template.instructions,
          permissions: newPool.template.permissions,
          config: newPool.template.config,
          budgetPerDay: newPool.defaultBudgetPerDay,
          isActive: true,
          isSelected: true,
          tenantId,
          tierAgentPoolId: newTierAgentPoolId,
          templateId: newPool.template.id,
          templateVersion: newPool.template.version,
          createdById: actorId,
        },
      });

      return newAgent;
    });

    this.logger.log(
      `Tenant ${tenantId} replaced agent ${currentAgentId} with ${result.id}`,
    );
    return result.id;
  }
}
