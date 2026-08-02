/**
 * SegregationOfDutiesService — role and SoD enforcement.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Roles (per tenant):
 *   - VIEWER      read-only
 *   - PREPARER    create draft journal entries (still requires posting role)
 *   - POSTING     required to submit a journal entry for posting
 *   - REVIEWER    required to approve a journal entry
 *   - CONTROLLER  can approve up to a tenant-configured amount threshold
 *   - CFO         can approve any amount
 *   - AUDITOR     read-only across all tenants for compliance
 *
 * SoD rules:
 *   - The user who posts a journal entry CANNOT be the user who approves it.
 *     Enforced both at this service AND at the DB level (CHECK constraint
 *     in 20260730_acct_capability_init/migration.sql).
 *   - Role gating is checked BEFORE entry creation, not at write time.
 */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { AccountingRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface UserAccountingRoles {
  userId: string;
  tenantId: string;
  roles: AccountingRole[];
}

@Injectable()
export class SegregationOfDutiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load all non-revoked accounting roles for a user in a tenant.
   */
  async loadRoles(tenantId: string, userId: string): Promise<AccountingRole[]> {
    const rows = await this.prisma.userAccountingRole.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
      },
      select: { role: true },
    });
    return rows.map((r) => r.role);
  }

  async hasRole(tenantId: string, userId: string, role: AccountingRole): Promise<boolean> {
    const roles = await this.loadRoles(tenantId, userId);
    return roles.includes(role);
  }

  /**
   * Throws ForbiddenException if the user lacks any of the required roles.
   */
  async requireAnyRole(
    tenantId: string,
    userId: string,
    required: AccountingRole[],
  ): Promise<void> {
    const roles = await this.loadRoles(tenantId, userId);
    const has = required.some((r) => roles.includes(r));
    if (!has) {
      throw new ForbiddenException(
        `User ${userId} lacks required accounting role(s): ${required.join(', ')}`,
      );
    }
  }

  /**
   * Throws ForbiddenException if poster and approver are the same user.
   * Mirrors the DB CHECK constraint as a defense-in-depth check.
   */
  async enforceSegregation(
    tenantId: string,
    postingUserId: string,
    approvingUserId: string,
  ): Promise<void> {
    if (postingUserId === approvingUserId) {
      throw new ForbiddenException(
        `Segregation of duties violation: user ${postingUserId} cannot approve their own posting`,
      );
    }
    // Also verify the approver holds REVIEWER (or higher).
    await this.requireAnyRole(tenantId, approvingUserId, [
      AccountingRole.REVIEWER,
      AccountingRole.CONTROLLER,
      AccountingRole.CFO,
    ]);
  }

  /**
   * Grant a role to a user. Idempotent: existing role is left as-is.
   */
  async grantRole(
    tenantId: string,
    userId: string,
    role: AccountingRole,
    grantedById: string,
  ): Promise<void> {
    try {
      await this.prisma.userAccountingRole.create({
        data: { tenantId, userId, role, grantedById },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return; // already has it — idempotent
      }
      throw e;
    }
  }

  /**
   * Revoke a role from a user. No-op if the role wasn't granted.
   */
  async revokeRole(tenantId: string, userId: string, role: AccountingRole): Promise<void> {
    await this.prisma.userAccountingRole.updateMany({
      where: { tenantId, userId, role, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}