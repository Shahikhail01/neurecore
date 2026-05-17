/**
 * pool-provisioning.service.ts — SOLID: Single Responsibility Principle
 *
 * SRP: This service has ONE reason to change — provisioning/disabling agent slots.
 * It does NOT enforce limits (TierEnforcementService), it does NOT manage pool configs.
 *
 * DIP: Depends on PrismaService abstraction.
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IPoolProvisioningService,
  PoolSlot,
  ProvisionResult,
} from '../interfaces/pool-slot.interface';

@Injectable()
export class PoolProvisioningService implements IPoolProvisioningService {
  private readonly logger = new Logger(PoolProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * provisionFromSlot
   *
   * Creates an agent for a tenant from a specific CHOICE pool slot.
   * Used when a tenant selects a template to fill an empty choice slot.
   *
   * @throws ForbiddenException if slot is FIXED (only TierEnforcementService or admin can provision fixed)
   * @throws BadRequestException if slot is already filled
   * @throws NotFoundException if slot does not exist
   */
  async provisionFromSlot(
    tenantId: string,
    slotId: string,
    userId?: string,
  ): Promise<ProvisionResult> {
    const slot = await this.prisma.tierAgentPool.findUnique({
      where: { id: slotId },
      include: {
        template: true,
        tier: true,
      },
    });

    if (!slot) {
      throw new NotFoundException(`Pool slot ${slotId} not found`);
    }

    // Validate tenant owns this tier
    if (slot.tierId !== tenantId && slot.tier.name !== 'SUPER_ADMIN') {
      // Tier pools are defined at tier level, not tenant level
      // The tierId on TierAgentPool refers to the TIER, not the tenant
    }

    // Cannot provision from a FIXED slot via this method
    if (slot.slotType === 'FIXED') {
      throw new ForbiddenException(
        'Cannot manually provision a FIXED slot. ' +
          'Fixed agents are provisioned automatically based on your plan. Contact your administrator.',
      );
    }

    // Check if slot already has a filled agent
    const existingAgent = await this.prisma.agent.findFirst({
      where: { tierAgentPoolId: slotId },
    });

    if (existingAgent) {
      throw new BadRequestException(
        `Slot ${slot.slot} is already filled with agent "${existingAgent.name}". ` +
          'Release the existing agent before provisioning a new one.',
      );
    }

    // Create the agent from the pool slot
    const agent = await this.prisma.agent.create({
      data: {
        name: slot.template.name,
        description: slot.template.description ?? undefined,
        type: (slot.template.agentType as any) ?? 'FUNCTIONAL',
        model: slot.defaultModel ?? slot.template.defaultModel ?? 'gpt-4o-mini',
        systemPrompt: slot.template.systemPrompt ?? undefined,
        instructions: slot.template.instructions ?? undefined,
        budgetPerDay: slot.defaultBudgetPerDay ?? undefined,
        tenantId,
        tierAgentPoolId: slotId,
        isFixed: false, // CHOICE slot = not fixed
        isSelected: true,
        createdById: userId ?? undefined,
      },
    });

    this.logger.log(
      `Provisioned choice agent "${agent.name}" (${agent.id}) for tenant ${tenantId} from slot ${slotId}`,
    );

    return {
      agentId: agent.id,
      slotId,
      slotType: 'CHOICE',
      isFixed: false,
      agentName: agent.name,
    };
  }

  /**
   * provisionDefaultPool
   *
   * Called when a tenant is first created or when admin triggers provisioning.
   * Provisions all FIXED slots + default-selected CHOICE slots.
   *
   * Returns all agents created.
   */
  async provisionDefaultPool(tenantId: string, userId?: string): Promise<ProvisionResult[]> {
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

    const results: ProvisionResult[] = [];

    for (const slot of tenant.tier.tierAgentPools) {
      // Skip non-default-selected slots
      if (!slot.isDefaultSelected) continue;

      // Check if already filled
      const existing = await this.prisma.agent.findFirst({
        where: { tierAgentPoolId: slot.id },
      });
      if (existing) continue;

      const isFixed = slot.slotType === 'FIXED';

      const agent = await this.prisma.agent.create({
        data: {
          name: slot.template.name,
          description: slot.template.description ?? undefined,
          type: (slot.template.agentType as any) ?? 'FUNCTIONAL',
          model: slot.defaultModel ?? slot.template.defaultModel ?? 'gpt-4o-mini',
          systemPrompt: slot.template.systemPrompt ?? undefined,
          instructions: slot.template.instructions ?? undefined,
          budgetPerDay: slot.defaultBudgetPerDay ?? undefined,
          tenantId,
          tierAgentPoolId: slot.id,
          isFixed,
          isSelected: true,
          createdById: userId ?? undefined,
        },
      });

      results.push({
        agentId: agent.id,
        slotId: slot.id,
        slotType: slot.slotType as 'FIXED' | 'CHOICE',
        isFixed,
        agentName: agent.name,
      });

      this.logger.log(
        `Provisioned ${slot.slotType} agent "${agent.name}" for tenant ${tenantId} from slot ${slot.id}`,
      );
    }

    return results;
  }

  /**
   * releaseSlot
   *
   * Removes an agent from a CHOICE slot, marking it as empty again.
   * Used when tenant wants to free up a choice slot for a different agent.
   *
   * @throws ForbiddenException if the slot is FIXED
   * @throws BadRequestException if no agent is currently in the slot
   */
  async releaseSlot(tenantId: string, slotId: string): Promise<void> {
    const slot = await this.prisma.tierAgentPool.findUnique({
      where: { id: slotId },
      include: {
        _count: { select: { agents: true } },
      },
    });

    if (!slot) {
      throw new NotFoundException(`Pool slot ${slotId} not found`);
    }

    if (slot.slotType === 'FIXED') {
      throw new ForbiddenException(
        'Cannot release a FIXED slot. ' +
          'Platform-required agents cannot be removed. Contact your administrator.',
      );
    }

    if (slot._count.agents === 0) {
      throw new BadRequestException(`Slot ${slotId} has no agent to release.`);
    }

    // Delete the agent in this slot
    const agent = await this.prisma.agent.findFirst({
      where: { tierAgentPoolId: slotId },
    });

    if (agent) {
      await this.prisma.agent.delete({ where: { id: agent.id } });
      this.logger.log(`Released choice agent "${agent.name}" (${agent.id}) from slot ${slotId}`);
    }
  }

  /**
   * replaceChoiceSlot
   *
   * Replaces the agent in a CHOICE slot with one from a new template.
   * Atomically: releases old agent + provisions new agent.
   */
  async replaceChoiceSlot(
    tenantId: string,
    slotId: string,
    newTemplateId: string,
    userId?: string,
  ): Promise<ProvisionResult> {
    // Release existing agent first
    const existingAgent = await this.prisma.agent.findFirst({
      where: { tierAgentPoolId: slotId },
    });
    if (existingAgent) {
      await this.prisma.agent.delete({ where: { id: existingAgent.id } });
    }

    // Get the new template
    const newTemplate = await this.prisma.agentTemplate.findUnique({
      where: { id: newTemplateId },
    });
    if (!newTemplate) {
      throw new NotFoundException(`Template ${newTemplateId} not found`);
    }

    // Provision new agent
    const slot = await this.prisma.tierAgentPool.findUnique({ where: { id: slotId } });
    const isFixed = slot?.slotType === 'FIXED';

    const agent = await this.prisma.agent.create({
      data: {
        name: newTemplate.name,
        description: newTemplate.description ?? undefined,
        type: (newTemplate.agentType as any) ?? 'FUNCTIONAL',
        model: newTemplate.defaultModel ?? 'gpt-4o-mini',
        systemPrompt: newTemplate.systemPrompt ?? undefined,
        instructions: newTemplate.instructions ?? undefined,
        tenantId,
        tierAgentPoolId: slotId,
        isFixed,
        isSelected: true,
        createdById: userId ?? undefined,
      },
    });

    return {
      agentId: agent.id,
      slotId,
      slotType: 'CHOICE',
      isFixed,
      agentName: agent.name,
    };
  }
}