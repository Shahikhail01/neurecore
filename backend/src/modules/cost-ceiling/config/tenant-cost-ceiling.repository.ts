/**
 * Phase 30 — Ceiling configuration repository (CR-AI-1305).
 *
 * Reads and writes `tenant_cost_ceilings`. Every method is
 * tenant-scoped and refuses the wildcard, per the v3 P-1 rule §11.
 *
 * A dimension with no row has no ceiling: the platform never invents
 * a default limit, because a silently-applied ceiling would deny
 * production traffic that an operator never opted into.
 *
 * SOLID
 *   SRP — owns ONLY ceiling persistence.
 *   DIP — the only class in the module that touches Prisma for
 *         configuration, so the service stays pure policy.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  CostCeilingScopeError,
  InvalidCeilingLimitError,
} from '../cost-ceiling.errors';
import type { CeilingConfig, CostDimension } from '../interfaces/ICeilingRule';

export interface SetCeilingInput {
  readonly tenantId: string;
  readonly dimension: CostDimension;
  readonly limitValue: number;
  readonly enabled: boolean;
  readonly actorUserId?: string;
}

@Injectable()
export class TenantCostCeilingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ReadonlyArray<CeilingConfig>> {
    this.assertScope(tenantId, 'list');
    const rows = await this.prisma.tenantCostCeiling.findMany({
      where: { tenantId },
      orderBy: { dimension: 'asc' },
      select: { dimension: true, limitValue: true, enabled: true },
    });
    return rows.map((row) => ({
      dimension: row.dimension as CostDimension,
      limitValue: row.limitValue,
      enabled: row.enabled,
    }));
  }

  async set(input: SetCeilingInput): Promise<CeilingConfig> {
    this.assertScope(input.tenantId, 'set');
    this.assertLimit(input.limitValue);
    const row = await this.prisma.tenantCostCeiling.upsert({
      where: {
        tenantId_dimension: {
          tenantId: input.tenantId,
          dimension: input.dimension,
        },
      },
      create: {
        tenantId: input.tenantId,
        dimension: input.dimension,
        limitValue: input.limitValue,
        enabled: input.enabled,
        ...(input.actorUserId ? { updatedByUserId: input.actorUserId } : {}),
      },
      update: {
        limitValue: input.limitValue,
        enabled: input.enabled,
        ...(input.actorUserId ? { updatedByUserId: input.actorUserId } : {}),
      },
      select: { dimension: true, limitValue: true, enabled: true },
    });
    return {
      dimension: row.dimension as CostDimension,
      limitValue: row.limitValue,
      enabled: row.enabled,
    };
  }

  private assertScope(tenantId: string, operation: string): void {
    if (!tenantId || tenantId === '*') {
      throw new CostCeilingScopeError(operation);
    }
  }

  private assertLimit(limitValue: number): void {
    if (!Number.isSafeInteger(limitValue) || limitValue < 0) {
      throw new InvalidCeilingLimitError(limitValue);
    }
  }
}
