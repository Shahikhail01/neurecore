/**
 * tier-pool.service.ts — SOLID: Single Responsibility Principle
 *
 * SRP: This service has ONE reason to change — querying/managing pool slot state.
 * It does NOT enforce limits (TierEnforcementService), it does NOT provision agents.
 *
 * DIP: Depends on PrismaService abstraction.
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  DepartmentPoolSlot,
  ITierPoolService,
  PoolSlot,
  TenantDepartmentPoolStatus,
  TenantPoolStatus,
} from '../interfaces/pool-slot.interface';

@Injectable()
export class TierPoolService implements ITierPoolService {
  private readonly logger = new Logger(TierPoolService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * getSlotsForTier
   *
   * Returns all pool slots for a tier, with optional filled agent info.
   * Used by SUPER_ADMIN when managing tier pool configuration.
   */
  async getSlotsForTier(tierId: string): Promise<PoolSlot[]> {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
      include: {
        tierAgentPools: {
          include: {
            template: true,
            agents: {
              where: { tenantId: undefined }, // filled by any tenant — not filtered here
              take: 1,
            },
          },
          orderBy: { slot: 'asc' },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException(`Tier ${tierId} not found`);
    }

    return Promise.all(
      tier.tierAgentPools.map((pool) => this.mapPoolToSlot(pool)),
    );
  }

  /**
   * getPoolStatusForTenant
   *
   * Returns full pool status for a tenant: which slots are fixed/choice,
   * how many are filled, and how many choice slots remain.
   * Used by ADMIN tenant detail view and tenant's own agents page.
   */
  async getPoolStatusForTenant(tenantId: string): Promise<TenantPoolStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierAgentPools: {
              include: {
                template: true,
                agents: {
                  where: { tenantId },
                },
              },
              orderBy: { slot: 'asc' },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const fixedSlots: PoolSlot[] = [];
    const choiceSlots: PoolSlot[] = [];
    let filledFixed = 0;
    let filledChoice = 0;

    for (const pool of tenant.tier.tierAgentPools) {
      const slot = await this.mapPoolToSlot(pool, tenantId);
      if (slot.slotType === 'FIXED') {
        fixedSlots.push(slot);
        if (slot.filledAgentId) filledFixed++;
      } else {
        choiceSlots.push(slot);
        if (slot.filledAgentId) filledChoice++;
      }
    }

    const totalChoice = choiceSlots.length;
    const choiceRemaining = totalChoice - filledChoice;

    return {
      tenantId,
      tierId: tenant.tierId,
      tierName: tenant.tier.name,
      tierSlug: tenant.tier.slug,
      fixedSlots,
      choiceSlots,
      totalFixed: fixedSlots.length,
      totalChoice: totalChoice,
      filledFixed,
      filledChoice,
      choiceRemaining,
      canAddMoreChoiceAgents: choiceRemaining > 0,
      isAtLimit: choiceRemaining <= 0,
    };
  }

  /**
   * getFilledSlotsForTenant
   *
   * Returns flat list of all filled pool slots for a tenant.
   * Used by agent store to tag agents with slot info.
   */
  async getFilledSlotsForTenant(tenantId: string): Promise<PoolSlot[]> {
    const pools = await this.prisma.tierAgentPool.findMany({
      where: {
        agents: { some: { tenantId } },
      },
      include: {
        template: true,
        agents: {
          where: { tenantId },
          take: 1,
        },
      },
      orderBy: { slot: 'asc' },
    });

    return Promise.all(pools.map((p) => this.mapPoolToSlot(p, tenantId)));
  }

  /**
   * getSlotForAgent
   *
   * Returns the pool slot an agent was created from, if any.
   * Used by agents controller to check if agent is fixed before allowing deletion.
   */
  async getSlotForAgent(agentId: string): Promise<PoolSlot | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        tierAgentPool: {
          include: { template: true },
        },
      },
    });

    if (!agent?.tierAgentPool) return null;

    return this.mapPoolToSlot(agent.tierAgentPool as any, agent.tenantId);
  }

  async getDepartmentPoolStatusForTenant(
    tenantId: string,
  ): Promise<TenantDepartmentPoolStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierDepartmentPools: {
              include: {
                departmentTemplate: true,
                departments: {
                  where: { tenantId },
                },
              },
              orderBy: { slot: 'asc' },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const fixedSlots: DepartmentPoolSlot[] = [];
    const choiceSlots: DepartmentPoolSlot[] = [];
    let filledFixed = 0;
    let filledChoice = 0;

    for (const pool of tenant.tier.tierDepartmentPools) {
      const slot = this.mapDepartmentPoolToSlot(pool, tenantId);
      if (slot.slotType === 'FIXED') {
        fixedSlots.push(slot);
        if (slot.filledDepartmentId) filledFixed++;
      } else {
        choiceSlots.push(slot);
        if (slot.filledDepartmentId) filledChoice++;
      }
    }

    const totalChoice = choiceSlots.length;
    const choiceRemaining = totalChoice - filledChoice;

    return {
      tenantId,
      tierId: tenant.tierId,
      tierName: tenant.tier.name,
      tierSlug: tenant.tier.slug,
      fixedSlots,
      choiceSlots,
      totalFixed: fixedSlots.length,
      totalChoice,
      filledFixed,
      filledChoice,
      choiceRemaining,
      canAddMoreChoiceDepartments: choiceRemaining > 0,
      isAtLimit: choiceRemaining <= 0,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async mapPoolToSlot(pool: any, tenantId?: string): Promise<PoolSlot> {
    // Get the filled agent for this specific tenant (if tenantId provided)
    let filledAgent = null;
    if (tenantId) {
      filledAgent =
        pool.agents?.find((a: any) => a.tenantId === tenantId) ?? null;
    } else if (pool.agents?.length > 0) {
      filledAgent = pool.agents[0];
    }

    return {
      id: pool.id,
      tierId: pool.tierId,
      templateId: pool.templateId,
      templateName: pool.template?.name ?? 'Unknown Template',
      slot: pool.slot,
      slotType: pool.slotType as 'FIXED' | 'CHOICE',
      isRequired: pool.isRequired,
      isDefaultSelected: pool.isDefaultSelected,
      defaultBudgetPerDay: pool.defaultBudgetPerDay
        ? Number(pool.defaultBudgetPerDay)
        : undefined,
      defaultModel: pool.defaultModel ?? undefined,
      filledAgentId: filledAgent?.id ?? undefined,
      filledAgentName: filledAgent?.name ?? undefined,
      filledAgentStatus: filledAgent?.status ?? undefined,
      filledAt: filledAgent?.createdAt?.toISOString() ?? undefined,
    };
  }

  private mapDepartmentPoolToSlot(
    pool: any,
    tenantId?: string,
  ): DepartmentPoolSlot {
    let filledDepartment = null;
    if (tenantId) {
      filledDepartment =
        pool.departments?.find(
          (department: any) => department.tenantId === tenantId,
        ) ?? null;
    } else if (pool.departments?.length > 0) {
      filledDepartment = pool.departments[0];
    }

    return {
      id: pool.id,
      tierId: pool.tierId,
      departmentTemplateId: pool.departmentTemplateId,
      templateName: pool.departmentTemplate?.name ?? 'Unknown Template',
      slot: pool.slot,
      slotType: pool.slotType as 'FIXED' | 'CHOICE',
      isRequired: pool.isRequired,
      isDefaultSelected: pool.isDefaultSelected,
      filledDepartmentId: filledDepartment?.id ?? undefined,
      filledDepartmentName: filledDepartment?.name ?? undefined,
      filledAt: filledDepartment?.createdAt?.toISOString() ?? undefined,
    };
  }
}
