/**
 * TiersService - SOLID: Single Responsibility Principle
 *
 * SRP: Only handles tier CRUD operations
 * OCP: Extends via interface, not modification
 * DIP: Depends on Prisma abstraction
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  ITierService,
  CreateTierInput,
  UpdateTierInput,
} from './interfaces/tier.interface';
import type { Tier, Prisma } from '@prisma/client';

@Injectable()
export class TiersService implements ITierService {
  private readonly logger = new Logger(TiersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.tier.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { tierAgentPools: true, tenants: true },
        },
      },
    });
    return items;
  }

  async findById(id: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id },
      include: {
        tierAgentPools: {
          include: { template: true },
          orderBy: { slot: 'asc' },
        },
      },
    });
    if (!tier) throw new NotFoundException(`Tier ${id} not found`);
    return tier;
  }

  async findBySlug(slug: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { slug },
      include: {
        tierAgentPools: {
          include: { template: true },
          orderBy: { slot: 'asc' },
        },
      },
    });
    if (!tier) throw new NotFoundException(`Tier with slug ${slug} not found`);
    return tier;
  }

  async getDefault() {
    return this.prisma.tier.findFirst({
      where: { isDefault: true },
    });
  }

  async create(input: CreateTierInput) {
    // Check for duplicate slug
    const existing = await this.prisma.tier.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Tier with slug "${input.slug}" already exists`,
      );
    }

    const data: Prisma.TierCreateInput = {
      name: input.name,
      slug: input.slug,
      description: input.description,
      isActive: input.isActive ?? true,
      isDefault: input.isDefault ?? false,
      sortOrder: input.sortOrder ?? 0,
      monthlyPrice: input.monthlyPrice ?? 0,
      yearlyPrice: input.yearlyPrice ?? 0,
      currency: input.currency ?? 'USD',
      maxUsers: input.maxUsers ?? 2,
      maxAgents: input.maxAgents ?? 3,
      maxStorageGB: input.maxStorageGB ?? 1,
      maxApiCalls: input.maxApiCalls ?? 1000,
      maxConversationMessages: input.maxConversationMessages ?? 500,
      maxFileSizeMB: input.maxFileSizeMB ?? 10,
      allowCustomBranding: input.allowCustomBranding ?? false,
      allowApiAccess: input.allowApiAccess ?? false,
      allowSso: input.allowSso ?? false,
      allowAuditExport: input.allowAuditExport ?? false,
    };

    const tier = await this.prisma.tier.create({ data });
    this.logger.log(`Created tier: ${tier.name} (${tier.id})`);
    return tier;
  }

  async update(id: string, input: UpdateTierInput) {
    const existing = await this.findById(id);

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
      const duplicate = await this.prisma.tier.findUnique({
        where: { slug: input.slug },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Tier with slug "${input.slug}" already exists`,
        );
      }
    }

    const data: Prisma.TierUpdateInput = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.monthlyPrice !== undefined && {
        monthlyPrice: input.monthlyPrice,
      }),
      ...(input.yearlyPrice !== undefined && {
        yearlyPrice: input.yearlyPrice,
      }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.maxUsers !== undefined && { maxUsers: input.maxUsers }),
      ...(input.maxAgents !== undefined && { maxAgents: input.maxAgents }),
      ...(input.maxStorageGB !== undefined && {
        maxStorageGB: input.maxStorageGB,
      }),
      ...(input.maxApiCalls !== undefined && {
        maxApiCalls: input.maxApiCalls,
      }),
      ...(input.maxConversationMessages !== undefined && {
        maxConversationMessages: input.maxConversationMessages,
      }),
      ...(input.maxFileSizeMB !== undefined && {
        maxFileSizeMB: input.maxFileSizeMB,
      }),
      ...(input.allowCustomBranding !== undefined && {
        allowCustomBranding: input.allowCustomBranding,
      }),
      ...(input.allowApiAccess !== undefined && {
        allowApiAccess: input.allowApiAccess,
      }),
      ...(input.allowSso !== undefined && { allowSso: input.allowSso }),
      ...(input.allowAuditExport !== undefined && {
        allowAuditExport: input.allowAuditExport,
      }),
    };

    const tier = await this.prisma.tier.update({ where: { id }, data });
    this.logger.log(`Updated tier: ${tier.name} (${tier.id})`);
    return tier;
  }

  async delete(id: string) {
    const tier = await this.findById(id);

    // Check if any tenants are using this tier
    const tenantCount = await this.prisma.tenant.count({
      where: { tierId: id },
    });
    if (tenantCount > 0) {
      throw new BadRequestException(
        `Cannot delete tier "${tier.name}" - ${tenantCount} tenant(s) are using it`,
      );
    }

    await this.prisma.tier.delete({ where: { id } });
    this.logger.log(`Deleted tier: ${tier.name} (${tier.id})`);
  }

  async toggleActive(id: string, isActive: boolean) {
    const tier = await this.prisma.tier.update({
      where: { id },
      data: { isActive },
    });
    this.logger.log(
      `Tier ${tier.name} is now ${isActive ? 'active' : 'inactive'}`,
    );
    return tier;
  }

  async setDefault(id: string) {
    // Clear existing default
    await this.prisma.tier.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const tier = await this.prisma.tier.update({
      where: { id },
      data: { isDefault: true },
    });
    this.logger.log(`Set ${tier.name} as the default tier`);
    return tier;
  }

  async reorder(ids: string[]) {
    // Update sortOrder for each tier
    const updates = ids.map((id, index) =>
      this.prisma.tier.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    );

    const tiers = await this.prisma.$transaction(updates);
    this.logger.log(`Reordered ${tiers.length} tiers`);
    return tiers;
  }

  async getUsage(id: string) {
    await this.findById(id);

    const [tenants, users] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where: { tierId: id } }),
      this.prisma.user.count({ where: { tenant: { tierId: id } } }),
    ]);

    return { tenants, users };
  }
}
