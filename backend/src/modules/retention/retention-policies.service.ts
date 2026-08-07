/**
 * Phase 18 — RetentionPoliciesService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §4.
 *
 * Closes CR-AI-1302 — "Privacy + retention + deletion + legal hold".
 *
 * Adds a typed policy DSL + the chat-history bridge that the
 * ChatExportService can call to enforce retention on exports
 * (auto-purge after retention expires).
 *
 * SRP — owns ONLY the policy DSL + the chat-history retention bridge.
 * The knowledge/ retention service retains its surface; this is
 * an additive layer for the broader cross-domain contract.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export class RetentionPolicyForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetentionPolicyForbiddenError';
  }
}

export interface RetentionPolicyDSL {
  readonly id: string;
  readonly tenantId: string;
  readonly scope: 'chat' | 'knowledge' | 'agent_logs';
  readonly retentionDays: number;
  readonly hardDeleteGraceDays: number;
  readonly legalHold: boolean;
  readonly redactPII: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class RetentionPoliciesService {
  private readonly logger = new Logger(RetentionPoliciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ReadonlyArray<RetentionPolicyDSL>> {
    if (!tenantId || tenantId === '*') return [];
    const rows = await this.prisma.$queryRaw<
      RetentionPolicyDSL[]
    >`SELECT id, "tenantId", scope, "retentionDays", "hardDeleteGraceDays",
            "legalHold", "redactPII", "createdAt", "updatedAt"
       FROM retention_policies
       WHERE "tenantId" = ${tenantId}::text
       ORDER BY scope`;
    return rows;
  }

  async upsert(
    tenantId: string,
    scope: RetentionPolicyDSL['scope'],
    retentionDays: number,
    hardDeleteGraceDays: number,
    legalHold: boolean,
    redactPII: boolean,
  ): Promise<RetentionPolicyDSL> {
    if (!tenantId || tenantId === '*') {
      throw new RetentionPolicyForbiddenError('tenantId required');
    }
    if (retentionDays < 0 || hardDeleteGraceDays < 0) {
      throw new RetentionPolicyForbiddenError('retention days must be >= 0');
    }
    const existing = await this.prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM retention_policies
       WHERE "tenantId" = ${tenantId}::text AND scope = ${scope}::text`;
    const id = existing[0]?.id ?? `ret_${tenantId}_${scope}_${Date.now()}`;
    const now = new Date();
    await this.prisma.$executeRaw`
      INSERT INTO retention_policies
        (id, "tenantId", scope, "retentionDays", "hardDeleteGraceDays",
         "legalHold", "redactPII", "createdAt", "updatedAt")
      VALUES
        (${id}::text, ${tenantId}::text, ${scope}::text, ${retentionDays}::int,
         ${hardDeleteGraceDays}::int, ${legalHold}::bool, ${redactPII}::bool,
         ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        "retentionDays" = ${retentionDays}::int,
        "hardDeleteGraceDays" = ${hardDeleteGraceDays}::int,
        "legalHold" = ${legalHold}::bool,
        "redactPII" = ${redactPII}::bool,
        "updatedAt" = ${now.toISOString()}::timestamptz
    `;
    return {
      id,
      tenantId,
      scope,
      retentionDays,
      hardDeleteGraceDays,
      legalHold,
      redactPII,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  async forScope(
    tenantId: string,
    scope: RetentionPolicyDSL['scope'],
  ): Promise<RetentionPolicyDSL | null> {
    if (!tenantId || tenantId === '*') return null;
    const all = await this.list(tenantId);
    return all.find((p) => p.scope === scope) ?? null;
  }

  /**
   * Bridge used by ChatExportService — returns whether an export is
   * still within the policy window. Returns true (retain) when no
   * policy exists yet (default behaviour). Returns false when
   * `createdAt + retentionDays < now` AND no legal hold.
   */
  async isExportWithinPolicy(
    tenantId: string,
    scope: RetentionPolicyDSL['scope'],
    exportCreatedAt: Date,
  ): Promise<boolean> {
    const policy = await this.forScope(tenantId, scope);
    if (!policy) return true;
    if (policy.legalHold) return true;
    const expiresAt = new Date(exportCreatedAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + policy.retentionDays);
    return expiresAt.getTime() >= Date.now();
  }
}
