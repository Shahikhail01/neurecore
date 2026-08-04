/**
 * Service Operations — Landing pages + Field work orders + Root-cause.
 *
 * Source plan: §5.10.2 (Landing page builder), §5.9.7 (Field work
 * order dispatch), §5.9.6 (Recurring incident / root-cause analysis).
 *
 * Solid: SRP — three closely-related service surfaces in one module
 * because they share the same audit + scheduling surface and the
 * same test suite.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FieldWorkOrderStatus, LandingPageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

// ─── Landing page (5.10.2) ──────────────────────────────────────────

@Injectable()
export class LandingPageService {
  private readonly logger = new Logger(LandingPageService.name);
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.landingPage.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    content?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.landingPage.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        content: args.content ?? {},
      },
    });
  }

  async publish(tenantId: string, id: string) {
    const page = await this.prisma.landingPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('landing page not found');
    if (page.tenantId !== tenantId) {
      throw new ForbiddenException('landing page belongs to a different tenant');
    }
    return this.prisma.landingPage.update({
      where: { id },
      data: { status: LandingPageStatus.PUBLISHED, publishedAt: new Date() },
    });
  }
}

// ─── Field work order dispatch (5.9.7) ──────────────────────────────

@Injectable()
export class FieldWorkOrderService {
  private readonly logger = new Logger(FieldWorkOrderService.name);
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, status?: FieldWorkOrderStatus) {
    return this.prisma.fieldWorkOrder.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async create(args: {
    tenantId: string;
    caseId?: string;
    assigneeId?: string;
    requiredSkills?: string[];
    scheduledFor?: Date;
    durationMin?: number;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.fieldWorkOrder.create({
      data: {
        tenantId: args.tenantId,
        caseId: args.caseId,
        assigneeId: args.assigneeId,
        requiredSkills: args.requiredSkills ?? [],
        scheduledFor: args.scheduledFor,
        durationMin: args.durationMin,
        latitude: args.latitude,
        longitude: args.longitude,
        notes: args.notes,
      },
    });
  }

  async dispatch(tenantId: string, id: string, assigneeId: string) {
    const wo = await this.prisma.fieldWorkOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('work order not found');
    if (wo.tenantId !== tenantId) {
      throw new ForbiddenException('work order belongs to a different tenant');
    }
    return this.prisma.fieldWorkOrder.update({
      where: { id },
      data: {
        assigneeId,
        status: FieldWorkOrderStatus.DISPATCHED,
      },
    });
  }
}

// ─── Root-cause analysis (5.9.6) ──────────────────────────────────

@Injectable()
export class RootCauseAnalysisService {
  private readonly logger = new Logger(RootCauseAnalysisService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(args: {
    tenantId: string;
    triggerId: string;
    cause: string;
    confidence: number;
    caseIds?: string[];
    remediation?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (args.confidence < 0 || args.confidence > 1) {
      throw new BadRequestException('confidence must be in [0, 1]');
    }
    return this.prisma.rootCauseAnalysis.create({
      data: {
        tenantId: args.tenantId,
        triggerId: args.triggerId,
        cause: args.cause,
        confidence: args.confidence,
        caseIds: args.caseIds ?? [],
        remediation: args.remediation ?? [],
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.rootCauseAnalysis.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
