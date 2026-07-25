/**
 * industries.controller.ts — REST surface for /api/v1/industries.
 *
 * Phase 10 — Admin Business Composition.
 * SOLID: thin controller; delegates to IndustriesService.
 *
 * INDUSTRY-GROUPS-CONCEPT.md §6.6 — endpoints:
 *   GET /industries/groups                (public) → IndustryGroup[]
 *   GET /industries/groups/:groupSlug     (public) → IndustryGroup + industries[]
 *   GET /industries/by-group/:groupSlug   (public) → Industry[]
 *   GET /industries/:slug/capabilities?tier=<slug>  (public) → IndustryCapabilityRow
 *
 * Standard CRUD endpoints are inherited from PoolController (auth required).
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PoolController } from '../../common/pool/pool.controller';
import { Public } from '../../common/decorators/roles.decorator';
import { IndustriesService } from './industries.service';
import { IndustryGroupsService } from './industry-groups.service';
import { IndustryCustomerFieldsService } from './customer-fields/industry-customer-fields.service';
import {
  getIntegrationPresets,
  getIntegrationPresetsSorted,
} from '../integrations/industry-integration-presets';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  getCapabilityMatrix,
  IndustryGroupSlug,
  TierSlug,
} from './tier-industry-matrix';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Industry } from '@prisma/client';
import type { CreateIndustryDto } from './dto/create-industry.dto';
import type { UpdateIndustryDto } from './dto/update-industry.dto';

@ApiTags('industries')
@ApiBearerAuth()
@Controller({ path: 'industries', version: '1' })
export class IndustriesController extends PoolController<
  Industry,
  CreateIndustryDto,
  UpdateIndustryDto
> {
  protected readonly service: IndustriesService;

  constructor(
    service: IndustriesService,
    private readonly groupsService: IndustryGroupsService,
    private readonly customerFieldsService: IndustryCustomerFieldsService,
    private readonly prisma: PrismaService,
  ) {
    super();
    this.service = service;
  }

  // ─── Public Industry Group endpoints (no auth — onboarding uses these) ──

  /** GET /api/v1/industries/groups — list all 8 Industry Groups. */
  @Public()
  @Get('groups')
  listGroups() {
    return this.groupsService.list();
  }

  /** GET /api/v1/industries/groups/:groupSlug — single group with its industries. */
  @Public()
  @Get('groups/:groupSlug')
  async getGroup(@Param('groupSlug') groupSlug: string) {
    const group = this.groupsService.get(groupSlug as IndustryGroupSlug);
    if (!group)
      throw new NotFoundException(`Industry group '${groupSlug}' not found`);
    const industries = await this.prisma.industry.findMany({
      where: { industryGroup: groupSlug, status: 'ACTIVE' },
      orderBy: { groupSortOrder: 'asc' },
    });
    return { ...group, industries };
  }

  /** GET /api/v1/industries/by-group/:groupSlug — industries in a group. */
  @Public()
  @Get('by-group/:groupSlug')
  async listByGroup(@Param('groupSlug') groupSlug: string) {
    if (!this.groupsService.get(groupSlug as IndustryGroupSlug)) {
      throw new NotFoundException(`Industry group '${groupSlug}' not found`);
    }
    return this.prisma.industry.findMany({
      where: { industryGroup: groupSlug, status: 'ACTIVE' },
      orderBy: { groupSortOrder: 'asc' },
    });
  }

  /**
   * GET /api/v1/industries/:slug/capabilities?tier=<tierSlug>
   * Returns the capability row for an Industry + Tier combination.
   * Used by the "Plan Impact" panel during onboarding.
   */
  @Public()
  @Get(':slug/capabilities')
  async getCapabilities(
    @Param('slug') slug: string,
    @Query('tier') tierSlug: string,
  ) {
    // FIX-COMPREHENSIVE-R3 (2026-07-24): PlanImpactPanel supports a
    // "universal baseline" preview when the tenant has no industry
    // picked yet (Skip-industry path). The sentinel `__universal__`
    // resolves to the `default` industry group's capabilities which
    // is what `seed-platform-templates.cjs` overlays for every tenant.
    // PlanImpactPanel calls this with the sentinel before any industry
    // is chosen so the user still sees a meaningful preview of what
    // their tier unlocks.
    if (slug === '__universal__') {
      return {
        industry: {
          slug: '__universal__',
          name: 'Universal baseline',
          industryGroup: 'other',
        },
        tier: tierSlug,
        capabilities: getCapabilityMatrix(
          'other' as IndustryGroupSlug,
          tierSlug as TierSlug,
        ),
        universal: true,
      };
    }

    const industry = await this.prisma.industry.findUnique({ where: { slug } });
    if (!industry) throw new NotFoundException(`Industry '${slug}' not found`);
    if (!industry.industryGroup) {
      throw new BadRequestException(
        `Industry '${slug}' has no industryGroup assigned`,
      );
    }
    const validTiers: TierSlug[] = [
      'basic',
      'business',
      'professional',
      'enterprise',
    ];
    if (!validTiers.includes(tierSlug as TierSlug)) {
      throw new BadRequestException(
        `Invalid tier '${tierSlug}'. Valid: ${validTiers.join(', ')}`,
      );
    }
    return {
      industry: {
        slug: industry.slug,
        name: industry.name,
        industryGroup: industry.industryGroup,
      },
      tier: tierSlug,
      capabilities: getCapabilityMatrix(
        industry.industryGroup as IndustryGroupSlug,
        tierSlug as TierSlug,
      ),
    };
  }

  /**
   * GET /api/v1/industries/:slug/customer-fields
   * Returns per-industry customer field definitions grouped by section.
   * Used by the CustomerForm to render dynamic industry-specific fields.
   */
  @Public()
  @Get(':slug/customer-fields')
  getCustomerFields(@Param('slug') slug: string) {
    const defs = this.customerFieldsService.getFieldDefs(slug);
    const sections = this.customerFieldsService.getFieldSections(slug);
    return {
      industrySlug: slug,
      hasFields: defs !== null,
      fields: defs ?? [],
      sections,
    };
  }

  /**
   * GET /api/v1/industries/:slug/integration-presets?tier=<tierSlug>
   * Returns per-industry integration presets (recommended connectors).
   * Used by the Marketplace page to show industry-relevant integrations.
   * Optional tier filter sorts by relevance to the tenant's tier.
   */
  @Public()
  @Get(':slug/integration-presets')
  getIntegrationPresets(
    @Param('slug') slug: string,
    @Query('tier') tier?: string,
  ) {
    const presets = tier
      ? getIntegrationPresetsSorted(slug, tier)
      : getIntegrationPresets(slug);
    return {
      industrySlug: slug,
      hasPresets: presets.length > 0,
      presets,
    };
  }
}
