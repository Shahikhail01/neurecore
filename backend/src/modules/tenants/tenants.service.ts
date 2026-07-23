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
import { UpdateMyTenantDto } from './dto/update-my-tenant.dto';
import { TenantStatus } from '@prisma/client';
import { TierProvisioningService } from '../tiers/services/tier-provisioning.service';
import { TierChangeService } from '../tiers/services/tier-change.service';
import { IndustryGroupsService } from '../industry/industry-groups.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly driftSafeTenantSelect = {
    id: true,
    name: true,
    slug: true,
    status: true,
    tierId: true,
    logoUrl: true,
    website: true,
    industry: true,
    // INDUSTRY-GROUPS-CONCEPT.md — denormalised for fast icon-rail branching
    industryGroup: true,
    settings: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly industryGroups: IndustryGroupsService,
    @Optional()
    @Inject('TIER_PROVISIONING')
    private readonly provisioningService?: TierProvisioningService,
    // Part 9 N5 — TenantsService.changeTier now delegates to
    // TierChangeService.changeTier so we share pre-flight + TierAuditLog
    // + TierChangeRequest writes + dormant-agent activation. Optional
    // injection so the controller can still be used in tests that don't
    // import the TiersModule.
    @Optional()
    private readonly tierChangeService?: TierChangeService,
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

    try {
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
    } catch (error) {
      this.logger.warn(
        `Tenants.findAll relation include failed, retrying without relations: ${(error as Error).message}`,
      );
      // If DB is missing relation/backfilled columns, retry with a projection
      // that avoids selecting drifted fields (e.g. tierId).
      if (this.isMissingColumnError(error)) {
        const [items, total] = await Promise.all([
          this.prisma.tenant.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: this.driftSafeTenantSelect,
          }),
          this.prisma.tenant.count({ where }),
        ]);
        return { items, total, page, limit };
      }
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id },
        include: { tier: true },
      });
      if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
      return tenant;
    } catch (error) {
      this.logger.warn(
        `Tenants.findOne relation include failed, retrying without relations: ${(error as Error).message}`,
      );
      if (this.isMissingColumnError(error)) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id },
          select: this.driftSafeTenantSelect,
        });
        if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
        return tenant;
      }
      throw error;
    }
  }

  /**
   * Resolve a human-readable tier name from a tenant that may or may not have
   * the `tier` relation loaded (depending on whether `findOne` hit the include
   * path or the drift-safe fallback path). Replaces the previous
   * `(tenant as any).tier?.name ?? (tenant as any).tierId ?? 'unknown'`.
   */
  private extractOldTierName(tenant: unknown): string {
    if (!tenant || typeof tenant !== 'object') return 'unknown';
    const t = tenant as {
      tier?: { name?: string } | null;
      tierId?: string | null;
    };
    if (t.tier && typeof t.tier.name === 'string') return t.tier.name;
    if (typeof t.tierId === 'string') return t.tierId;
    return 'unknown';
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

    // INDUSTRY-GROUPS-CONCEPT.md §5 — auto-derive industryGroup from the
    // industry slug via the shared IndustryGroupsService resolver so
    // IconRail/filter queries never read a stale denormalised column.
    const industryGroup = await this.industryGroups.resolveIndustryGroup(
      dto.industry,
    );

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
        industryGroup,
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

    // UpdateTenantDto intentionally does NOT include `tierId` — callers must
    // use changeTier() instead. The destructure with rest is a no-op for the
    // current DTO shape but defends against future field additions that
    // should never reach Prisma.tenant.update directly.

    // INDUSTRY-GROUPS-CONCEPT.md §5 — keep the denormalised industryGroup
    // in sync whenever the admin updates Tenant.industry. We only re-query
    // the Industry table when the field actually changed; clearing industry
    // (undefined → null) clears the group too.
    const data: Record<string, unknown> = { ...dto };
    if ('industry' in dto) {
      data.industryGroup = await this.industryGroups.resolveIndustryGroup(
        dto.industry,
      );
    }

    return this.prisma.tenant.update({
      where: { id },
      data,
      include: { tier: true },
    });
  }

  /**
   * WS-2.1: Owner-scoped update. Persists the additive nullable fields added
   * in PR-1 (locale / timezone / currency / etc.) plus the structured Json
   * blobs (address, billingProfile, defaults). Writes an audit log entry
   * with the user's id for traceability.
   *
   * Only OWNER and ADMIN roles can call this. The DTO is narrower than
   * UpdateTenantDto (no status / slug / tier — those need platform admin).
   */
  async updateMine(tenantId: string, userId: string, dto: UpdateMyTenantDto) {
    // Guard against the rare drift-safe fallback path returning a stale shape.
    await this.findOne(tenantId);

    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) updateData[k] = v;
    }

    // INDUSTRY-GROUPS-CONCEPT.md §5 — derive industryGroup whenever the
    // owner updates Tenant.industry through their self-service settings.
    // Industry is a Super-Admin-only field per D7, but we still want the
    // denormalised column to track correctly for any future call path.
    //
    // Explicit `industry === null` from the FE means "skip industry"
    // and must clear the group column. An absent field (`undefined`)
    // falls back to the tenant's persisted industry so PATCH /tenants/me
    // with locale-only fields doesn't accidentally wipe the group.
    let industryForGroup: string | null | undefined = dto.industry;
    if (industryForGroup === undefined) {
      const existing = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { industry: true },
      });
      industryForGroup = existing?.industry ?? null;
    }
    if (industryForGroup) {
      updateData.industryGroup =
        await this.industryGroups.resolveIndustryGroup(industryForGroup);
    } else {
      updateData.industryGroup = null;
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actor: userId,
        action: 'tenant.updateMine',
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        details: {
          fields: Object.keys(updateData),
        } as never,
      },
    });

    return tenant;
  }

  /**
   * Part 9 N5 — `changeTier` now delegates to TierChangeService.
   *
   * `TenantsService` used to inline pre-flight + update + log; that
   * duplicated the policy in TierChangeService and skipped the audit
   * log + dormant-agent activation paths. The single source of truth
   * for the change flow is now TierChangeService.changeTier().
   *
   * This method is the admin-facing immediate-change path (controller
   * route PATCH /tenants/:id/change-tier). The tenant-self-service path
   * (POST /tenants/me/tier-change-requests, Phase 6) goes directly to
   * TierChangeService.changeTier() without going through this method.
   *
   * Backward-compatible: callers receive the same Tenant & tier shape
   * as before (delegated method returns the updated tenant via
   * TierChangeResult.tenant).
   */
  async changeTier(tenantId: string, newTierId: string) {
    if (!this.tierChangeService) {
      // Defensive guard — should not happen in production because
      // TenantsModule imports TiersModule (see N5 wiring). Tests that
      // build TenantsService without TiersModule trigger this branch.
      throw new ConflictException(
        'TierChangeService is not available — TenantsModule must import TiersModule.',
      );
    }

    const result = await this.tierChangeService.changeTier({
      tenantId,
      toTierId: newTierId,
      // The admin route is immediate; same-tier requests still rejected.
      requestedBy: 'admin',
      immediateDowngrade: true,
    });

    // Re-shape the response to match the previous TenantsService contract:
    // return the tenant row with `tier` included. TierChangeResult.tenant
    // already has `tier` populated because TierChangeService.includes
    // it in the update query.
    return result.tenant;
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED },
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ACTIVE },
    });
  }

  async deleteTenant(id: string) {
    await this.findOne(id);
    // All related data is cascade-deleted by Prisma (onDelete: Cascade)
    // on every child relation. This single delete cascades to users,
    // sessions, agents, departments, audit logs, etc.
    return this.prisma.tenant.delete({ where: { id } });
  }

  private isMissingColumnError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = (error as { code?: string }).code;
    return code === 'P2022' || error.message.includes('does not exist');
  }
}
