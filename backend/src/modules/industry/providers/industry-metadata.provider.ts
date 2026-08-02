/**
 * industry-metadata.provider.ts (concrete impl)
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding) — concrete
 * implementation of `IndustryMetadataProvider`. Wraps PrismaService directly
 * because the existing IndustriesService is a thin pool wrapper without the
 * granular getBySlug / listActive methods the interface needs.
 *
 * This is the **single** place in the codebase where Industry table queries
 * should happen for cross-cutting metadata. Consumers (onboarding, customer
 * form, nav service, etc.) inject INDUSTRY_METADATA, not PrismaService.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Industry, Prisma } from '@prisma/client';
import {
  type IndustryMetadataProvider,
  type ListIndustriesOptions,
} from '../interfaces';
import type { IndustryGroupSlug } from '../tier-industry-matrix';

@Injectable()
export class IndustryMetadataProviderImpl implements IndustryMetadataProvider {
  constructor(private readonly prisma: PrismaService) {}

  async getIndustry(slug: string): Promise<Industry | null> {
    return this.prisma.industry.findUnique({ where: { slug } });
  }

  async getIndustryById(id: string): Promise<Industry | null> {
    return this.prisma.industry.findUnique({ where: { id } });
  }

  async getGroupForIndustry(slug: string): Promise<IndustryGroupSlug | null> {
    const row = await this.prisma.industry.findUnique({
      where: { slug },
      select: { industryGroup: true },
    });
    return (row?.industryGroup as IndustryGroupSlug | null) ?? null;
  }

  async listIndustriesInGroup(group: IndustryGroupSlug): Promise<Industry[]> {
    return this.prisma.industry.findMany({
      where: { industryGroup: group, status: 'ACTIVE' },
      orderBy: { groupSortOrder: 'asc' },
    });
  }

  async listActiveIndustries(
    options: ListIndustriesOptions = {},
  ): Promise<Industry[]> {
    return this.prisma.industry.findMany({
      where: this.buildWhereClause({ ...options, status: 'ACTIVE' }),
      orderBy: [{ groupSortOrder: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  buildWhereClause(options: ListIndustriesOptions): Prisma.IndustryWhereInput {
    const where: Prisma.IndustryWhereInput = {};
    if (options.groupSlug) where.industryGroup = options.groupSlug;
    if (options.status) where.status = options.status;
    if (options.search) {
      where.OR = [
        { slug: { contains: options.search, mode: 'insensitive' } },
        { name: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}
