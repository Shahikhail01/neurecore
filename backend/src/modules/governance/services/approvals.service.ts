import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ApprovalStatus, ApprovalPriority } from '@prisma/client';

export interface CreateApprovalInput {
  title: string;
  description?: string;
  resourceType: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  priority?: ApprovalPriority;
  requiredRole?: string;
  expiresAt?: string;
  tenantId: string;
  requestedById?: string;
}

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string | null | undefined,
    options?: { status?: ApprovalStatus; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = options ?? {};
    const skip = (page - 1) * limit;
    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(status && { status }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId?: string | null) {
    const req = await this.prisma.approvalRequest.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!req) throw new NotFoundException(`Approval request ${id} not found`);
    return req;
  }

  async create(input: CreateApprovalInput) {
    return this.prisma.approvalRequest.create({
      data: {
        title: input.title,
        description: input.description,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        payload: (input.payload ?? {}) as never,
        priority: input.priority ?? 'MEDIUM',
        requiredRole: input.requiredRole,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        tenantId: input.tenantId,
        requestedById: input.requestedById,
      },
    });
  }

  async review(
    id: string,
    tenantId: string,
    reviewerId: string,
    decision: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string },
  ) {
    const req = await this.findOne(id, tenantId);
    if (req.status !== 'PENDING') {
      throw new ForbiddenException(`Approval request is already ${req.status}`);
    }

    return this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: decision.status,
        reviewedById: reviewerId,
        approvedAt: decision.status === 'APPROVED' ? new Date() : undefined,
        rejectedAt: decision.status === 'REJECTED' ? new Date() : undefined,
        rejectionReason: decision.rejectionReason,
      },
    });
  }

  async cancel(id: string, tenantId: string, userId: string) {
    const req = await this.findOne(id, tenantId);
    if (req.requestedById !== userId)
      throw new ForbiddenException('Not your request');
    if (req.status !== 'PENDING')
      throw new ForbiddenException('Cannot cancel a decided request');

    return this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async getPendingCount(tenantId: string): Promise<number> {
    return this.prisma.approvalRequest.count({
      where: { tenantId, status: 'PENDING' },
    });
  }

  async getPendingCountPlatform(): Promise<number> {
    return this.prisma.approvalRequest.count({ where: { status: 'PENDING' } });
  }

  /**
   * GET /approvals/:id/history — returns the full lifecycle of an approval request.
   * SRP: read-only projection; does not mutate state.
   * For now, history is synthesised from the stored timestamps on the record;
   * a proper audit-events table could be added in a future migration.
   */
  async getHistory(id: string, tenantId?: string | null) {
    const req = await this.findOne(id, tenantId);

    const events: Array<{ event: string; at: Date; actor?: string }> = [];

    events.push({ event: 'CREATED', at: req.createdAt });

    if (req.status === 'APPROVED' && req.approvedAt) {
      events.push({
        event: 'APPROVED',
        at: req.approvedAt,
        actor: req.reviewedById ?? undefined,
      });
    } else if (req.status === 'REJECTED' && req.rejectedAt) {
      events.push({
        event: 'REJECTED',
        at: req.rejectedAt,
        actor: req.reviewedById ?? undefined,
      });
    } else if (req.status === 'CANCELLED') {
      events.push({ event: 'CANCELLED', at: req.updatedAt });
    }

    return {
      approvalId: req.id,
      title: req.title,
      currentStatus: req.status,
      history: events,
      rejectionReason: req.rejectionReason,
    };
  }
}
