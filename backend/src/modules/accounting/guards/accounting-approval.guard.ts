/**
 * AccountingApprovalGuard — enforces TIER + period + COA + SoD checks
 * before ledger writes.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Decorator API:
 *
 *   @Post('postings')
 *   @UseGuards(JwtAuthGuard, AccountingApprovalGuard)
 *   @ApprovalTier('TIER_2')
 *   async postJournalEntry(...) {}
 *
 * The guard reads the tier from the decorator metadata, then:
 *   TIER_1: pass through (auto-approved).
 *   TIER_2: require that req.body.approvalId is set to an APPROVED
 *           ApprovalWorkflow for this tenant; the approver must satisfy
 *           SoD (poster ≠ approver).
 */

import { Injectable, CanActivate, ExecutionContext, BadRequestException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AccountingRole } from '@prisma/client';
import { SegregationOfDutiesService } from '../services/segregation-of-duties.service';

export type ApprovalTier = 'TIER_1' | 'TIER_2';
export const APPROVAL_TIER_KEY = 'accounting.approvalTier';
export const ApprovalTier = (tier: ApprovalTier) => SetMetadata(APPROVAL_TIER_KEY, tier);

@Injectable()
export class AccountingApprovalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sod: SegregationOfDutiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tier = this.reflector.getAllAndOverride<ApprovalTier>(APPROVAL_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!tier) {
      throw new BadRequestException(
        `@ApprovalTier('TIER_1' | 'TIER_2') decorator is required on this route`,
      );
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id: string; tenantId: string } | undefined;
    if (!user?.id || !user?.tenantId) {
      throw new ForbiddenException('Authenticated user context required');
    }

    if (tier === 'TIER_1') {
      // Read-only / compute endpoints: any authenticated tenant member.
      return true;
    }

    // TIER_2: require an approved ApprovalRequest linked in the body.
    const body = req.body as { approvalId?: string; postingUserId?: string };
    if (!body.approvalId) {
      throw new ForbiddenException(
        'TIER_2 endpoint requires an approvalId. Create an ApprovalRequest first and resolve it before posting.',
      );
    }
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: body.approvalId, tenantId: user.tenantId },
    });
    if (!approval) {
      throw new ForbiddenException(`ApprovalRequest ${body.approvalId} not found for tenant`);
    }
    if (approval.status !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        `ApprovalRequest ${body.approvalId} is ${approval.status}, expected APPROVED`,
      );
    }
    if (!approval.reviewedById || !approval.approvedAt) {
      throw new ForbiddenException(
        `ApprovalRequest ${body.approvalId} is APPROVED but missing reviewer/approvedAt — data integrity issue`,
      );
    }

    // SoD: the body must include postingUserId, and the approver must differ.
    if (!body.postingUserId) {
      throw new BadRequestException(
        'TIER_2 body must include postingUserId for SoD verification',
      );
    }
    await this.sod.enforceSegregation(
      user.tenantId,
      body.postingUserId,
      approval.reviewedById,
    );

    // Stash the approval resolution for the controller/service.
    req.accountingApproval = {
      approvalId: approval.id,
      approvedById: approval.reviewedById,
      approvedAt: approval.approvedAt,
    };
    return true;
  }
}