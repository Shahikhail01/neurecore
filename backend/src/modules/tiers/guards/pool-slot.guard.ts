/**
 * pool-slot.guard.ts — SOLID: Single Responsibility Principle
 *
 * SRP: This guard has ONE reason to exist — prevent deletion of FIXED pool agents.
 * Applied to DELETE /agents/:id
 *
 * DIP: Depends on TierPoolService abstraction, not concretion.
 */

import {
  Injectable,
  CanActivate,
  ForbiddenException,
  NotFoundException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/common';
import { TierPoolService } from '../services/tier-pool.service';

// ─── Guard Metadata Key ────────────────────────────────────────────────────────

export const POOL_SLOT_GUARD_KEY = Symbol('poolSlotGuard');

/**
 * PoolSlotGuard
 *
 * Applied to agent deletion endpoints.
 * Checks if the agent being deleted was provisioned from a FIXED pool slot.
 * If so, throws ForbiddenException — fixed agents cannot be deleted by tenant.
 */
@Injectable()
export class PoolSlotGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tierPoolService: TierPoolService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string; tenantId?: string } | undefined;
    const agentId = request.params?.id;

    if (!agentId) {
      // No agent ID in params — let the controller handle it
      return true;
    }

    // SUPER_ADMIN can always delete agents (platform management context)
    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const slot = await this.tierPoolService.getSlotForAgent(agentId);

    if (!slot) {
      // Agent not from a pool slot — free-form agent, allow deletion
      return true;
    }

    if (slot.slotType === 'FIXED') {
      throw new ForbiddenException(
        `Cannot remove "${slot.templateName}". ` +
          'This is a platform-required agent included in your plan. ' +
          'Contact your administrator if you need changes.',
      );
    }

    // CHOICE slot — allow deletion (tenant can free up the slot)
    return true;
  }
}