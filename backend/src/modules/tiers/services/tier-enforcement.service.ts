/**
 * tier-enforcement.service.ts — SOLID: Single Responsibility Principle
 *
 * SRP: This service has ONE reason to change — enforcing tier feature limits.
 * It does NOT provision agents (that's PoolProvisioningService).
 * It does NOT manage pool slots (that's TierPoolService).
 *
 * DIP: Depends on PrismaService abstraction, not concretions.
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ITierEnforcementService } from '../interfaces/pool-slot.interface';

@Injectable()
export class TierEnforcementService implements ITierEnforcementService {
  private readonly logger = new Logger(TierEnforcementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * enforceAgentLimit
   *
   * Checks if tenant can add another agent.
   * Uses tier pool to count filled CHOICE slots vs total choice slots.
   *
   * @returns remaining choice slots (0 if at limit)
   * @throws ForbiddenException if no choice slots remaining
   */
  async enforceAgentLimit(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            tierAgentPools: {
              where: { slotType: 'CHOICE' },
              include: {
                _count: { select: { agents: true } },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const totalChoiceSlots = tenant.tier.tierAgentPools.length;
    const filledChoiceSlots = tenant.tier.tierAgentPools.reduce(
      (sum, pool) => sum + pool._count.agents,
      0,
    );
    const choiceRemaining = totalChoiceSlots - filledChoiceSlots;

    if (choiceRemaining <= 0) {
      throw new ForbiddenException(
        `Your ${this.capitalize(tenant.tier.slug)} tier includes ${totalChoiceSlots} agent${
          totalChoiceSlots !== 1 ? 's' : ''
        }. All choice slots are filled. Contact your administrator to modify your plan.`,
      );
    }

    return choiceRemaining;
  }

  /**
   * enforceApiAccess
   *
   * Checks if tenant's tier allows API key creation.
   * Throws clear ForbiddenException if tier's allowApiAccess flag is false.
   */
  async enforceApiAccess(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    if (!tenant.tier.allowApiAccess) {
      throw new ForbiddenException(
        `API access is not included in your ${this.capitalize(tenant.tier.slug)} plan. ` +
          'Upgrade your plan to enable API access.',
      );
    }
  }

  /**
   * enforceAuditExport
   *
   * Checks if tenant's tier allows audit log export.
   * Throws clear ForbiddenException if tier's allowAuditExport flag is false.
   */
  async enforceAuditExport(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    if (!tenant.tier.allowAuditExport) {
      throw new ForbiddenException(
        `Audit log export is not included in your ${this.capitalize(tenant.tier.slug)} plan. ` +
          'Upgrade your plan to enable audit exports.',
      );
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}