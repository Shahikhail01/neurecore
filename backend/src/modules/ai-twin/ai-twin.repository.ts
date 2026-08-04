/**
 * AI Twin — Repository.
 *
 * Pure persistence for AiTwin + AiTwinAuditLog. No business logic.
 * SRP + DIP.
 */

import { Injectable } from '@nestjs/common';
import {
  AiTwin,
  AiTwinAuditLog,
  Prisma,
  TwinLifecycleStatus,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface CreateTwinInput {
  tenantId: string;
  ownerUserId: string;
  slug: string;
  displayName: string;
  description?: string | null;
  step1Goal?: Prisma.InputJsonValue;
  allowedReadScopes?: Prisma.InputJsonValue;
  allowedWriteScopes?: Prisma.InputJsonValue;
}

export interface UpdateTwinInput {
  displayName?: string;
  description?: string | null;
  wizardStep?: number;
  step1Goal?: Prisma.InputJsonValue;
  step2Iteration?: Prisma.InputJsonValue;
  step3Test?: Prisma.InputJsonValue;
  step4Deploy?: Prisma.InputJsonValue;
  allowedReadScopes?: Prisma.InputJsonValue;
  allowedWriteScopes?: Prisma.InputJsonValue;
  agentTemplateId?: string | null;
  agentTemplateVersionId?: string | null;
}

@Injectable()
export class AiTwinRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOwnerAndSlug(
    tenantId: string,
    ownerUserId: string,
    slug: string,
  ): Promise<AiTwin | null> {
    return this.prisma.aiTwin.findUnique({
      where: {
        tenantId_ownerUserId_slug: { tenantId, ownerUserId, slug },
      },
    });
  }

  findById(id: string): Promise<AiTwin | null> {
    return this.prisma.aiTwin.findUnique({ where: { id } });
  }

  findAllForOwner(
    tenantId: string,
    ownerUserId: string,
  ): Promise<AiTwin[]> {
    return this.prisma.aiTwin.findMany({
      where: { tenantId, ownerUserId },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  create(input: CreateTwinInput): Promise<AiTwin> {
    return this.prisma.aiTwin.create({ data: input });
  }

  update(id: string, input: UpdateTwinInput): Promise<AiTwin> {
    return this.prisma.aiTwin.update({ where: { id }, data: input });
  }

  setStatus(
    id: string,
    status: TwinLifecycleStatus,
    occurredAt: Date,
  ): Promise<AiTwin> {
    return this.prisma.aiTwin.update({
      where: { id },
      data: {
        status,
        activatedAt: status === 'ACTIVE' ? occurredAt : undefined,
        archivedAt: status === 'ARCHIVED' ? occurredAt : undefined,
      },
    });
  }

  appendAudit(input: {
    tenantId: string;
    twinId: string;
    actorUserId: string;
    action: string;
    outcome: string;
    envelope: Prisma.InputJsonValue;
    reason?: string;
  }): Promise<AiTwinAuditLog> {
    return this.prisma.aiTwinAuditLog.create({ data: input });
  }

  listAudits(args: {
    tenantId: string;
    twinId?: string;
    actorUserId?: string;
    skip?: number;
    take?: number;
  }): Promise<AiTwinAuditLog[]> {
    return this.prisma.aiTwinAuditLog.findMany({
      where: {
        tenantId: args.tenantId,
        ...(args.twinId ? { twinId: args.twinId } : {}),
        ...(args.actorUserId ? { actorUserId: args.actorUserId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      skip: args.skip,
      take: args.take ?? 50,
    });
  }
}
