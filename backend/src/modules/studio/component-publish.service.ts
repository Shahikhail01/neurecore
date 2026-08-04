/**
 * Studio Marketplace + Publish Gate.
 *
 * Source plan: §5.13.11 — Marketplace publish flow for tenant components.
 *
 * Solid:
 *   • SRP — only the publish gate. The component table itself is
 *     composed from Phase 5.2's StudioModule.
 *   • OCP — adding a new publish state = new branch in `decide`.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ComponentPublishStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class ComponentPublishService {
  private readonly logger = new Logger(ComponentPublishService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Submit ──────────────────────────────────────────────────────

  async submit(args: {
    tenantId: string;
    componentId: string;
    submittedBy: string;
    notes?: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const component = await this.prisma.studioComponent.findUnique({
      where: { id: args.componentId },
    });
    if (!component) throw new NotFoundException('component not found');
    if (component.tenantId !== args.tenantId) {
      throw new ForbiddenException(
        'only the component owner can submit it for review',
      );
    }
    return this.prisma.componentPublishRequest.create({
      data: {
        tenantId: args.tenantId,
        componentId: args.componentId,
        notes: args.notes,
      },
    });
  }

  // ─── Reviewer queue ────────────────────────────────────────────

  async listPendingReview() {
    return this.prisma.componentPublishRequest.findMany({
      where: { status: ComponentPublishStatus.PENDING_REVIEW },
      orderBy: { submittedAt: 'asc' },
    });
  }

  // ─── Decision ───────────────────────────────────────────────────

  async decide(args: {
    requestId: string;
    reviewerId: string;
    decision: 'ACTIVE' | 'REJECTED';
    decisionNotes?: string;
  }) {
    const req = await this.prisma.componentPublishRequest.findUnique({
      where: { id: args.requestId },
    });
    if (!req) throw new NotFoundException('publish request not found');
    if (req.status !== ComponentPublishStatus.PENDING_REVIEW) {
      throw new ForbiddenException(
        `request is already in status ${req.status}`,
      );
    }
    const newStatus =
      args.decision === 'ACTIVE'
        ? ComponentPublishStatus.ACTIVE
        : ComponentPublishStatus.REJECTED;
    await this.prisma.componentPublishRequest.update({
      where: { id: args.requestId },
      data: {
        status: newStatus,
        reviewerId: args.reviewerId,
        decidedAt: new Date(),
        decisionNotes: args.decisionNotes,
      },
    });
    if (args.decision === 'ACTIVE') {
      // Flip the component's origin from TENANT to COMMUNITY so
      // marketplace listings surface it. Solid: no separate table.
      const component = await this.prisma.studioComponent.findUnique({
        where: { id: req.componentId },
      });
      if (component && component.tenantId) {
        await this.prisma.studioComponent.update({
          where: { id: req.componentId },
          data: {
            origin: 'COMMUNITY',
            schema: {
              ...((component.schema as Record<string, unknown>) ?? {}),
              publishedAt: new Date().toISOString(),
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
    return { id: req.id, status: newStatus };
  }

  // ─── Discovery ──────────────────────────────────────────────────

  async listMarketplaceComponents(tenantId: string) {
    return this.prisma.studioComponent.findMany({
      where: {
        OR: [
          { tenantId: null }, // PREDEFINED
          { tenantId, origin: 'COMMUNITY' },
        ],
      },
      orderBy: [{ origin: 'asc' }, { displayName: 'asc' }],
    });
  }
}
