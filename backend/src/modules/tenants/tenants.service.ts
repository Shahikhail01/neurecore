import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { TenantStatus } from '@prisma/client';
import {
  TenantDeploymentService,
  type TierDeploymentPreview,
} from '../tiers/services/tenant-deployment.service';

export type TierChangePreview = TierDeploymentPreview;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDeploymentService: TenantDeploymentService,
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

  async create(dto: CreateTenantDto, actorId?: string) {
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
    try {
      const result = await this.tenantDeploymentService.bootstrapTenantTier(
        tenant.id,
        tenant.tierId,
        actorId,
      );
      this.logger.log(
        `Tenant ${tenant.slug} provisioned with ${result.departmentsProvisioned} departments and ${result.agentsProvisioned} agents`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision tier resources for tenant ${tenant.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Don't fail tenant creation if provisioning fails.
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

  async previewTierChange(
    tenantId: string,
    newTierId: string,
  ): Promise<TierChangePreview> {
    return this.tenantDeploymentService.previewTierBootstrap(
      tenantId,
      newTierId,
    );
  }

  async changeTier(tenantId: string, newTierId: string, actorId?: string) {
    const tenant = await this.findOne(tenantId);
    const preview = await this.previewTierChange(tenantId, newTierId);
    if (!preview.compatibility.canChange) {
      throw new ConflictException(preview.compatibility.blockingReasons[0]);
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tierId: newTierId },
      include: { tier: true },
    });

    if (preview.impact.tierLinkedAgentsOutsideTargetPolicy.length > 0) {
      await Promise.all(
        preview.impact.tierLinkedAgentsOutsideTargetPolicy.map((agent) =>
          this.prisma.agent.update({
            where: { id: agent.id },
            data: { isSelected: false, isActive: false },
          }),
        ),
      );
    }

    if (preview.impact.tierLinkedDepartmentsOutsideTargetPolicy.length > 0) {
      await Promise.all(
        preview.impact.tierLinkedDepartmentsOutsideTargetPolicy.map(
          (department) =>
            this.prisma.department.update({
              where: { id: department.id },
              data: { isSelected: false, status: 'INACTIVE' },
            }),
        ),
      );
    }

    await this.tenantDeploymentService.bootstrapTenantTier(
      updated.id,
      newTierId,
      actorId,
    );

    const oldTierName =
      (tenant as any).tier?.name ?? (tenant as any).tierId ?? 'unknown';
    this.logger.log(
      `Tenant ${tenant.slug} changed from tier ${oldTierName} to ${preview.targetTier.name}`,
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
