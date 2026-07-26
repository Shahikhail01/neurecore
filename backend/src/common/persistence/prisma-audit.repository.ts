// src/common/persistence/prisma-audit.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditEntry, IAuditRepository, TransactionalClient } from '../ports/audit.port';

/**
 * Prisma adapter for IAuditRepository.
 */
@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: TransactionalClient): Promise<void> {
    const client = (tx ?? this.prisma) as any;
    await client.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actor: entry.actor,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        correlationId: entry.correlationId,
        causationId: entry.causationId,
        result: entry.result ?? 'success',
        details: (entry.details ?? {}) as any,
      },
    });
  }
}
