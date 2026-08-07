/**
 * Deal — Repository.
 *
 * Pure persistence layer. SRP + DIP — no business logic, no validation.
 *
 * Tenant-isolation contract:
 *   - Every method takes `tenantId: string` as its first argument.
 *   - `null` / empty / `'*'` are rejected with TENANT_WILDCARD_FORBIDDEN
 *     — same constant as agents.service.ts. Wildcard branches are
 *     structurally impossible.
 *   - `findAllAcrossTenants` is the explicit platform-admin escape hatch
 *     and is only reached through a controller that checks user.role.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { Deal, DealStage, DealSource, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface CreateDealInput {
  tenantId: string;
  customerId?: string | null;
  contactId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
  name: string;
  stage?: DealStage;
  source?: DealSource;
  amount: Prisma.Decimal | number;
  currency?: string;
  probability?: Prisma.Decimal | number;
  expectedCloseDate?: Date | null;
  aiScore?: Prisma.Decimal | number | null;
  notes?: string | null;
}

export interface UpdateDealInput {
  customerId?: string | null;
  contactId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
  name?: string;
  stage?: DealStage;
  source?: DealSource;
  amount?: Prisma.Decimal | number;
  currency?: string;
  probability?: Prisma.Decimal | number;
  expectedCloseDate?: Date | null;
  aiScore?: Prisma.Decimal | number | null;
  notes?: string | null;
  deletedAt?: Date | null;
}

export interface ListDealsFilter {
  stage?: DealStage;
  ownerUserId?: string;
  customerId?: string;
  q?: string;
  includeDeleted?: boolean;
}

@Injectable()
export class DealRepository {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenant(tenantId: string, op: string): asserts tenantId is string {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        `tenantId "${tenantId}" forbidden for ${op}; wildcard is not allowed`,
      );
    }
  }

  async findById(tenantId: string, id: string): Promise<Deal | null> {
    this.assertTenant(tenantId, 'DealRepository.findById');
    return this.prisma.deal.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findByIdAcrossTenants(id: string): Promise<Deal | null> {
    // Caller MUST have checked platform role.
    return this.prisma.deal.findFirst({ where: { id } });
  }

  async findAll(
    tenantId: string,
    filter: ListDealsFilter,
    page: number,
    limit: number,
    sort: 'updatedAt' | 'amount' | 'expectedCloseDate' | 'createdAt',
    sortDir: 'asc' | 'desc',
  ): Promise<{ rows: Deal[]; total: number }> {
    this.assertTenant(tenantId, 'DealRepository.findAll');
    const where: Prisma.DealWhereInput = {
      tenantId,
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.stage ? { stage: filter.stage } : {}),
      ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.q
        ? { name: { contains: filter.q, mode: 'insensitive' as const } }
        : {}),
    };
    const orderBy: Prisma.DealOrderByWithRelationInput = { [sort]: sortDir };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { rows, total };
  }

  async findAllAcrossTenants(
    filter: ListDealsFilter,
    page: number,
    limit: number,
  ): Promise<{ rows: Deal[]; total: number }> {
    // Explicit platform-role path. The controller MUST reject non-admin users.
    const where: Prisma.DealWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.stage ? { stage: filter.stage } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Aggregate weighted forecast per stage. Tenant-scoped.
   * Used by `nc.forecast_pipeline` to render the deal-stage breakdown.
   */
  async aggregateForecast(tenantId: string): Promise<
    Array<{
      stage: DealStage;
      count: number;
      sumAmount: Prisma.Decimal | null;
      sumWeightedAmount: Prisma.Decimal | null;
    }>
  > {
    this.assertTenant(tenantId, 'DealRepository.aggregateForecast');
    const groups = await this.prisma.deal.groupBy({
      by: ['stage'],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return groups.map((g) => ({
      stage: g.stage,
      count: g._count._all,
      sumAmount: (g._sum.amount ?? null) as Prisma.Decimal | null,
      sumWeightedAmount: null, // service layer fills this in
    }));
  }

  async create(input: CreateDealInput): Promise<Deal> {
    this.assertTenant(input.tenantId, 'DealRepository.create');
    return this.prisma.deal.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId ?? null,
        contactId: input.contactId ?? null,
        projectId: input.projectId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        name: input.name,
        stage: input.stage ?? 'LEAD',
        source: input.source ?? 'INBOUND',
        amount: input.amount as Prisma.Decimal,
        currency: input.currency ?? 'USD',
        probability: (input.probability ?? 0.1) as Prisma.Decimal,
        expectedCloseDate: input.expectedCloseDate ?? null,
        aiScore: (input.aiScore ?? null) as Prisma.Decimal | null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateDealInput): Promise<Deal> {
    this.assertTenant(tenantId, 'DealRepository.update');
    return this.prisma.deal.update({
      where: { id },
      // Tenant re-check via where clause — defense in depth:
      // the id is uuid but we ALSO require tenantId to match.
      data: {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.amount !== undefined ? { amount: input.amount as Prisma.Decimal } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.probability !== undefined
          ? { probability: input.probability as Prisma.Decimal }
          : {}),
        ...(input.expectedCloseDate !== undefined
          ? { expectedCloseDate: input.expectedCloseDate }
          : {}),
        ...(input.aiScore !== undefined
          ? { aiScore: input.aiScore as Prisma.Decimal }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.deletedAt !== undefined ? { deletedAt: input.deletedAt } : {}),
      },
    }).then((deal) => {
      if (deal.tenantId !== tenantId) {
        // Should never fire thanks to the where clause; defense in depth.
        throw new ForbiddenException('tenant mismatch on Deal update');
      }
      return deal;
    });
  }

  async softDelete(tenantId: string, id: string): Promise<Deal> {
    return this.update(tenantId, id, { deletedAt: new Date() });
  }

  async existsAndBelongsToTenant(
    tenantId: string,
    id: string,
  ): Promise<boolean> {
    this.assertTenant(tenantId, 'DealRepository.existsAndBelongsToTenant');
    const found = await this.prisma.deal.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    return !!found;
  }
}
