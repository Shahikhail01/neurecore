// src/modules/agent-templates/agent-lifecycle-audit.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AgentLifecycleAuditAction,
  AgentLifecycleAuditLog,
  AgentLifecycleAuditSubject,
} from '@prisma/client';

/**
 * AgentLifecycleAuditRepository — append-only audit log for every
 * transition on a template, version, or skill.
 *
 * Phase 4 §audit history: every transition MUST write one row.
 * Tenant-scoped reads via `listForSubject` / `listForTenant`.
 */
@Injectable()
export class AgentLifecycleAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(args: {
    tenantId: string;
    actorId: string;
    action: AgentLifecycleAuditAction;
    subjectType: AgentLifecycleAuditSubject;
    subjectId: string;
    previousState: Prisma.JsonValue;
    newState: Prisma.JsonValue;
    reason: string;
  }): Promise<AgentLifecycleAuditLog> {
    return this.prisma.agentLifecycleAuditLog.create({
      data: {
        tenantId: args.tenantId,
        actorId: args.actorId,
        action: args.action,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        previousState: (args.previousState ?? {}) as Prisma.InputJsonValue,
        newState: (args.newState ?? {}) as Prisma.InputJsonValue,
        reason: args.reason,
      },
    });
  }

  async listForSubject(args: {
    tenantId: string;
    subjectType: AgentLifecycleAuditSubject;
    subjectId: string;
    limit?: number;
  }): Promise<AgentLifecycleAuditLog[]> {
    return this.prisma.agentLifecycleAuditLog.findMany({
      where: {
        tenantId: args.tenantId,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
      },
      orderBy: { occurredAt: 'desc' },
      take: args.limit ?? 100,
    });
  }

  async listForTemplate(args: {
    tenantId: string;
    templateId: string;
    limit?: number;
  }): Promise<AgentLifecycleAuditLog[]> {
    return this.prisma.agentLifecycleAuditLog.findMany({
      where: {
        tenantId: args.tenantId,
        OR: [
          { subjectType: 'TEMPLATE', subjectId: args.templateId },
          { subjectType: 'VERSION' },
        ],
      },
      orderBy: { occurredAt: 'desc' },
      take: args.limit ?? 200,
    });
  }

  async listForTenant(
    tenantId: string,
    limit = 100,
  ): Promise<AgentLifecycleAuditLog[]> {
    return this.prisma.agentLifecycleAuditLog.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }
}
