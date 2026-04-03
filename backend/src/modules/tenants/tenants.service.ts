import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { TenantStatus } from '@prisma/client';
import { TierProvisioningService } from '../tiers/services/tier-provisioning.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject('TIER_PROVISIONING')
    private readonly provisioningService?: TierProvisioningService,
  ) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { tier: true },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { tier: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    // Get default tier if not specified
    let tierId = dto.tierId;
    if (!tierId) {
      const defaultTier = await this.prisma.tier.findFirst({
        where: { isDefault: true },
      });
      if (!defaultTier) {
        throw new ConflictException('No default tier configured');
      }
      tierId = defaultTier.id;
    }

    // Verify tier exists
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException(`Tier ${tierId} not found`);
    }

    // Create tenant with tier
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        status: TenantStatus.TRIAL,
        tierId,
        logoUrl: dto.logoUrl,
        website: dto.website,
        industry: dto.industry,
      },
      include: { tier: true },
    });

    // Auto-provision agents based on tier
    if (this.provisioningService) {
      try {
        const result = await this.provisioningService.provisionAgents(
          tenant.id,
          tenant.tierId,
        );
        this.logger.log(
          `Tenant ${tenant.slug} provisioned with ${result.agentsProvisioned} agents`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to provision agents for tenant ${tenant.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        // Don't fail tenant creation if provisioning fails
        // Admin can manually provision later
      }
    }

    this.logger.log(`Tenant created: ${tenant.slug} on tier ${tier.name}`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    // Prevent changing tierId directly - use changeTier instead
    const { tierId, ...updateData } = dto as any;

    return this.prisma.tenant.update({
      where: { id },
      data: updateData,
      include: { tier: true },
    });
  }

  async changeTier(tenantId: string, newTierId: string) {
    const tenant = await this.findOne(tenantId);

    const newTier = await this.prisma.tier.findUnique({
      where: { id: newTierId },
    });
    if (!newTier) {
      throw new NotFoundException(`Tier ${newTierId} not found`);
    }

    // Get current selected agent count
    const currentAgentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });

    // Check if new tier allows current agent count
    if (currentAgentCount > newTier.maxAgents) {
      throw new ConflictException(
        `Cannot change to tier "${newTier.name}" - it allows only ${newTier.maxAgents} agents, ` +
          `but tenant has ${currentAgentCount} agents selected`,
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tierId: newTierId },
      include: { tier: true },
    });

    const oldTierName =
      (tenant as any).tier?.name ?? (tenant as any).tierId ?? 'unknown';
    this.logger.log(
      `Tenant ${tenant.slug} changed from tier ${oldTierName} to ${newTier.name}`,
    );
    return updated;
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED },
    });
  }
}
