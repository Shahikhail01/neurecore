/**
 * Phase 18 — AuditEvidenceCorrelationService.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §1.
 *
 * Closes CR-AI-1303 "audit + evidence + observability". The
 * service writes append-only `audit_evidence_chains` rows that
 * correlate one `correlationId` across:
 *
 *   - skills run   (one row per skill execution against that chain)
 *   - reads        (record / thread / file lookups)
 *   - writes       (mutations executed against authenticated agents)
 *
 * One chain per actor run (typically per chat completion). The
 * chain is closed (closedAt set) when the run terminates. The
 * service exposes:
 *
 *   1. openChain(correlationId, actor)
 *   2. recordSkill(correlationId, skillId)
 *   3. recordRead(correlationId, recordType, recordId)
 *   4. recordWrite(correlationId, mutation)
 *   5. closeChain(correlationId)
 *   6. correlateFor(correlationId)   read-only — used by the
 *                                          audit-correlation CC route
 *
 * SRP — owns ONLY the chain surface. Persistence via Prisma; tenant
 * scope in Prisma `where: { tenantId, correlationId }`.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';

export class AuditEvidenceForbiddenError extends Error {
  constructor(readonly reason: string) {
    super(`audit-evidence forbidden: ${reason}`);
    this.name = 'AuditEvidenceForbiddenError';
  }
}

export interface AuditEvidenceChain {
  readonly correlationId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly skills: ReadonlyArray<{
    readonly skillId: string;
    readonly recordedAt: string;
  }>;
  readonly reads: ReadonlyArray<{
    readonly recordType: string;
    readonly recordId: string;
    readonly recordedAt: string;
  }>;
  readonly writes: ReadonlyArray<{
    readonly mutation: string;
    readonly recordedAt: string;
  }>;
  readonly closedAt: string | null;
  readonly createdAt: string;
}

@Injectable()
export class AuditEvidenceCorrelationService {
  private readonly logger = new Logger(
    AuditEvidenceCorrelationService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  /** Create or upsert an open chain. Idempotent — re-opening the
   *  same correlationId returns the existing row. */
  async openChain(
    tenantId: string,
    actorId: string,
    correlationId: string,
  ): Promise<void> {
    if (!tenantId || tenantId === '*') {
      throw new AuditEvidenceForbiddenError('tenant context required');
    }
    await this.prisma.auditEvidenceChain.upsert({
      where: {
        tenantId_correlationId: { tenantId, correlationId },
      },
      create: { tenantId, actorId, correlationId, closedAt: null },
      update: { actorId, closedAt: null },
    });
  }

  async recordSkill(
    tenantId: string,
    correlationId: string,
    skillId: string,
  ): Promise<void> {
    if (!tenantId || tenantId === '*') return;
    const row = await this.fetch(tenantId, correlationId);
    if (!row) return;
    const skills = this.touch(row.skillsJson as unknown[], 'skillId', skillId);
    await this.persistSkills(tenantId, row.id, skills);
  }

  async recordRead(
    tenantId: string,
    correlationId: string,
    recordType: string,
    recordId: string,
  ): Promise<void> {
    if (!tenantId || tenantId === '*') return;
    const row = await this.fetch(tenantId, correlationId);
    if (!row) return;
    const reads = this.touch(row.readsJson as unknown[], 'recordType', recordType, 'recordId', recordId);
    await this.persistReads(tenantId, row.id, reads);
  }

  async recordWrite(
    tenantId: string,
    correlationId: string,
    mutation: string,
  ): Promise<void> {
    if (!tenantId || tenantId === '*') return;
    const row = await this.fetch(tenantId, correlationId);
    if (!row) return;
    const writes = this.touch(
      row.writesJson as unknown[],
      'mutation',
      mutation,
    );
    await this.persistWrites(tenantId, row.id, writes);
  }

  async closeChain(tenantId: string, correlationId: string): Promise<void> {
    if (!tenantId || tenantId === '*') return;
    await this.prisma.auditEvidenceChain.updateMany({
      where: { tenantId, correlationId, closedAt: null },
      data: { closedAt: new Date() },
    });
  }

  /** Read-only surface used by the CC audit-correlation route. */
  async correlateFor(
    tenantId: string,
    correlationId: string,
  ): Promise<AuditEvidenceChain | null> {
    if (!tenantId || tenantId === '*') return null;
    const row = await this.prisma.auditEvidenceChain.findUnique({
      where: {
        tenantId_correlationId: { tenantId, correlationId },
      },
    });
    if (!row) return null;
    return {
      correlationId: row.correlationId,
      tenantId: row.tenantId,
      actorId: row.actorId,
      skills: (row.skillsJson as Array<{ skillId: string; recordedAt: string }>) ?? [],
      reads: (row.readsJson as Array<{
        recordType: string;
        recordId: string;
        recordedAt: string;
      }>) ?? [],
      writes: (row.writesJson as Array<{ mutation: string; recordedAt: string }>) ?? [],
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Convenience used by tests + the integrity self-test in the
   *  Phase-18 runner. Counts chains in a tenant. */
  async countForTenant(tenantId: string): Promise<number> {
    if (!tenantId || tenantId === '*') return 0;
    return this.prisma.auditEvidenceChain.count({ where: { tenantId } });
  }

  private async fetch(tenantId: string, correlationId: string) {
    return this.prisma.auditEvidenceChain.findUnique({
      where: {
        tenantId_correlationId: { tenantId, correlationId },
      },
    });
  }

  private touch(
    arr: unknown[],
    key1: 'skillId' | 'recordType' | 'mutation',
    value1: string,
    key2?: 'recordId',
    value2?: string,
  ): Prisma.JsonArray {
    const next = [...arr, { [key1]: value1, ...(key2 ? { [key2]: value2 } : {}), recordedAt: new Date().toISOString() }];
    return next as Prisma.JsonArray;
  }

  private async persistSkills(
    tenantId: string,
    id: string,
    next: Prisma.JsonArray,
  ): Promise<void> {
    await this.prisma.auditEvidenceChain.update({
      where: { id },
      data: { skillsJson: next },
    });
    void tenantId;
  }

  private async persistReads(
    tenantId: string,
    id: string,
    next: Prisma.JsonArray,
  ): Promise<void> {
    await this.prisma.auditEvidenceChain.update({
      where: { id },
      data: { readsJson: next },
    });
    void tenantId;
  }

  private async persistWrites(
    tenantId: string,
    id: string,
    next: Prisma.JsonArray,
  ): Promise<void> {
    await this.prisma.auditEvidenceChain.update({
      where: { id },
      data: { writesJson: next },
    });
    void tenantId;
  }
}

export class _NotFoundForCaller extends NotFoundException {}
