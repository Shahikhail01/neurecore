import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ApprovalStatus, ApprovalPriority } from '@prisma/client';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';

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

  constructor(
    private readonly prisma: PrismaService,
    // Optional: publish enterprise.approval.granted/rejected so the Work Runtime
    // (and Context Plane invalidation) can react. Non-transactional post-commit
    // publish, guarded by deterministic idempotency key.
    @Optional()
    @Inject(EVENT_TRANSPORT)
    private readonly transport?: IEnterpriseEventTransport,
  ) {}

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

  async findOne(id: string, tenantId: string) {
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id, tenantId },
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

    // Phase 7 (SOL-02 §7) — self-approval prohibition.
    // The AI Employee that requested the work-run approval cannot be the
    // reviewer. This is the authoritative decision boundary; no caller may
    // bypass it. An empty/undefined reviewerId is never accepted either.
    if (!reviewerId) {
      throw new ForbiddenException(
        'SELF_APPROVAL_FORBIDDEN: reviewerId is required',
      );
    }
    if (req.requestedById && req.requestedById === reviewerId) {
      throw new ForbiddenException(
        'SELF_APPROVAL_FORBIDDEN: requester cannot approve their own request',
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: decision.status,
        reviewedById: reviewerId,
        approvedAt: decision.status === 'APPROVED' ? new Date() : undefined,
        rejectedAt: decision.status === 'REJECTED' ? new Date() : undefined,
        rejectionReason: decision.rejectionReason,
      },
    });

    // Publish the decision so paused Work Runtime runs (and caches) can react.
    if (this.transport) {
      const eventType =
        decision.status === 'APPROVED'
          ? 'enterprise.approval.granted'
          : 'enterprise.approval.rejected';
      try {
        await this.transport.publish({
          eventType,
          tenantId,
          actorType: 'HUMAN',
          actorId: reviewerId,
          idempotencyKey: `${eventType}.${id}`,
          sourceModule: 'governance',
          payload: {
            approvalId: id,
            resourceType: req.resourceType,
            resourceId: req.resourceId ?? null,
            decision: decision.status,
            reviewerId,
            reason: decision.rejectionReason ?? null,
          },
        });
      } catch (e) {
        this.logger.warn(
          `Failed to publish ${eventType} for approval ${id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    return updated;
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
  async getHistory(id: string, tenantId: string) {
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
