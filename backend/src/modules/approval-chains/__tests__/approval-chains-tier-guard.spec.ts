/**
 * FIX-COMPREHENSIVE 2026-07-23 — Cross-tier approval-guard tests.
 *
 * Proves that `ApprovalChainsService.getIndustryRoutes` returns the new
 * `TierGuardOutcome` shape and correctly:
 *   1. Routes a tenant with no tier — outcome.eligible carries everything,
 *      blocked is empty, maxApprovalStages is null. (Graceful degradation.)
 *   2. Routes a tenant on Professional (maxApprovalStages=3): 3-stage routes
 *      land in `eligible`, 4+-stage routes land in `blocked` with the
 *      correct `minTierSlug` (Professional allows 3, so 4-stage routes must
 *      point at `enterprise`).
 *   3. The registry catalog is refreshed via `setTierCatalog()` on every call
 *      so tier mutations don't silently leak between requests.
 *   4. `blocked[].reason` includes the route slug, projected stages, and the
 *      current tier + ceiling so the FE upgrade CTA has everything it needs.
 */

import { Test } from '@nestjs/testing';
import { ApprovalChainsService } from '../approval-chains.service';
import {
  APPROVAL_CHAIN_REPOSITORY,
  type IApprovalChainRepository,
} from '../interfaces/approval-chain.interface';
import {
  DELIVERABLE_REPOSITORY,
  type IDeliverableRepository,
} from '../../deliverables/interfaces/deliverable.interface';
import { ApprovalAddonRegistry } from '../addons/approval-addon.registry';
import type {
  ApprovalAddon,
  ApprovalRoute,
} from '../addons/approval-addon.interface';
import { TiersService } from '../../tiers/tiers.service';
import {
  TierResolver,
  type ResolvedCapability,
} from '../../tiers/services/tier-resolver.service';
import type { Tier } from '@prisma/client';
import { Prisma } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory fakes
// ──────────────────────────────────────────────────────────────────────────────

class EmptyChainRepo implements IApprovalChainRepository {
  async findProjectTypeVersionById(): Promise<any> {
    return null;
  }
  async findWorkflowById(): Promise<any> {
    return null;
  }
  async updateWorkflow(): Promise<any> {}
  async findStepWithWorkflow(): Promise<any> {
    return null;
  }
  async findWorkflows(): Promise<any[]> {
    return [];
  }
}

class EmptyDeliverableRepo implements IDeliverableRepository {
  async findById(): Promise<any> {
    return null;
  }
  async create(): Promise<any> {
    throw new Error('not used');
  }
  async findAll(): Promise<any> {
    return { data: [], total: 0 };
  }
  async update(): Promise<any> {
    throw new Error('not used');
  }
  async delete(): Promise<void> {
    throw new Error('not used');
  }
  async createVersion(): Promise<any> {
    throw new Error('not used');
  }
  async findVersionsByDeliverableId(): Promise<any[]> {
    return [];
  }
  async getLatestVersion(): Promise<any> {
    return null;
  }
}

/** Test addon: returns the routes passed to its constructor. */
class TestAddon implements ApprovalAddon {
  readonly industrySlugs = ['financial-services'];
  constructor(private readonly routes: ApprovalRoute[]) {}
  async getRoutes() {
    return this.routes;
  }
  async getRoutesForEvent(_: string, event: string) {
    return this.routes.filter((r) => r.triggers.some((t) => t.event === event));
  }
}

function mkRoute(slug: string, stageCount: number): ApprovalRoute {
  return {
    slug,
    label: `Route ${slug}`,
    stages: Array.from({ length: stageCount }).map((_, i) => ({
      role: `R${i + 1}`,
      order: i + 1,
      action: 'approve' as const,
    })),
    triggers: [{ event: 'test.evt' }],
  };
}

function mkTier(slug: string, maxApprovalStages: number): Tier {
  return {
    id: `tier-${slug}`,
    slug,
    name: slug,
    monthlyPrice: new Prisma.Decimal('0'),
    yearlyPrice: new Prisma.Decimal('0'),
    currency: 'USD',
    billingCycle: 'monthly',
    trialDays: null,
    maxUsers: 1,
    maxAgents: 1,
    maxDepartments: 1,
    maxStorageGB: 1,
    maxApiCalls: 1,
    maxConversationMessages: 1,
    maxFileSizeMB: 1,
    maxApprovalStages,
    allowCustomBranding: false,
    allowApiAccess: false,
    allowSso: false,
    allowAuditExport: false,
    allowWhiteLabel: false,
    allowPredictiveAnalytics: false,
    allowCustomDashboards: false,
    allowMultiOffice: false,
    autoDowngradeTierId: '',
    description: null,
    tagline: null,
    icon: null,
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Partial TiersService — only findAll is exercised. */
function fakeTiers(tiers: Tier[]) {
  return {
    async findAll() {
      return tiers;
    },
  } as unknown as TiersService;
}

/** Partial TierResolver — only resolveCapabilities is exercised. */
function fakeResolver(caps: ResolvedCapability | null) {
  return {
    async resolveCapabilities() {
      return caps;
    },
  } as unknown as TierResolver;
}

const CAPS = (slug: string, maxStages: number): ResolvedCapability => ({
  tenantId: 'tenant-1',
  tierId: `tier-${slug}`,
  tierSlug: slug,
  tierName: slug,
  limits: {
    maxUsers: 1,
    maxAgents: 1,
    maxDepartments: 1,
    maxStorageGB: 1,
    maxApiCalls: 1,
    maxConversationMessages: 1,
    maxFileSizeMB: 1,
    maxApprovalStages: maxStages,
  },
  features: {
    allowCustomBranding: false,
    allowApiAccess: false,
    allowSso: false,
    allowAuditExport: false,
    allowWhiteLabel: false,
    allowPredictiveAnalytics: false,
    allowCustomDashboards: false,
    allowMultiOffice: false,
  },
  billingCycle: 'monthly',
  trialDays: null,
});

const FOUR_TIERS = () => [
  mkTier('basic', 1),
  mkTier('business', 2),
  mkTier('professional', 3),
  mkTier('enterprise', 9999),
];

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ApprovalChainsService — cross-tier guard (FIX-COMPREHENSIVE 2026-07-23)', () => {
  async function build(opts: {
    tiers: Tier[];
    capabilities: ResolvedCapability | null;
    addonRoutes: ApprovalRoute[];
  }) {
    const registry = new ApprovalAddonRegistry();
    const addon = new TestAddon(opts.addonRoutes);
    registry.register(addon);
    registry.setTierCatalog(opts.tiers);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApprovalChainsService,
        { provide: APPROVAL_CHAIN_REPOSITORY, useClass: EmptyChainRepo },
        { provide: DELIVERABLE_REPOSITORY, useClass: EmptyDeliverableRepo },
        { provide: ApprovalAddonRegistry, useValue: registry },
        { provide: TiersService, useValue: fakeTiers(opts.tiers) },
        { provide: TierResolver, useValue: fakeResolver(opts.capabilities) },
      ],
    }).compile();

    const service = moduleRef.get(ApprovalChainsService);
    return { service, registry };
  }

  it('returns the canonical TierGuardOutcome for a Professional tenant', async () => {
    const routes = [
      mkRoute('one-stage', 1),
      mkRoute('two-stage', 2),
      mkRoute('three-stage', 3),
      mkRoute('four-stage', 4),
      mkRoute('ten-stage', 10),
    ];
    const { service, registry } = await build({
      tiers: FOUR_TIERS(),
      capabilities: CAPS('professional', 3),
      addonRoutes: routes,
    });

    const outcome = await service.getIndustryRoutes(
      'tenant-1',
      'financial-services',
    );

    expect(outcome.currentTierSlug).toBe('professional');
    expect(outcome.maxApprovalStages).toBe(3);
    expect(outcome.eligible.map((r) => r.slug)).toEqual([
      'one-stage',
      'two-stage',
      'three-stage',
    ]);
    expect(outcome.blocked.map((r) => r.slug).sort()).toEqual([
      'four-stage',
      'ten-stage',
    ]);

    for (const blocked of outcome.blocked) {
      expect(blocked.minTierSlug).toBe('enterprise');
      expect(blocked.reason).toContain(blocked.slug);
      expect(blocked.reason).toContain('professional');
      expect(blocked.reason).toContain('3');
    }
    expect(registry.list()).toContain('financial-services');
  });

  it('treats a no-tier tenant as eligible for everything (graceful fallback)', async () => {
    const routes = [mkRoute('one-stage', 1), mkRoute('ten-stage', 10)];
    const { service } = await build({
      tiers: FOUR_TIERS(),
      capabilities: null,
      addonRoutes: routes,
    });

    const outcome = await service.getIndustryRoutes(
      'tenant-1',
      'financial-services',
    );
    expect(outcome.currentTierSlug).toBeNull();
    expect(outcome.maxApprovalStages).toBeNull();
    expect(outcome.eligible.length).toBe(2);
    expect(outcome.blocked.length).toBe(0);
  });

  it('Basic-tier (max 1) routes 2-stage chains to business and 4+ to enterprise', async () => {
    const routes = [mkRoute('two-stage', 2), mkRoute('four-stage', 4)];
    const { service } = await build({
      tiers: FOUR_TIERS(),
      capabilities: CAPS('basic', 1),
      addonRoutes: routes,
    });

    const outcome = await service.getIndustryRoutes(
      'tenant-1',
      'financial-services',
    );
    expect(outcome.eligible).toEqual([]);
    expect(outcome.blocked.length).toBe(2);
    const byRoute = Object.fromEntries(
      outcome.blocked.map((b) => [b.slug, b.minTierSlug]),
    );
    expect(byRoute['two-stage']).toBe('business');
    expect(byRoute['four-stage']).toBe('enterprise');
  });

  it('updates the registry tier catalog on each call (no stale leak)', async () => {
    const tiersV1 = FOUR_TIERS();
    const routes = [mkRoute('two-stage', 2)];

    const { service, registry } = await build({
      tiers: tiersV1,
      capabilities: CAPS('professional', 3),
      addonRoutes: routes,
    });

    // Sanity check via direct registry call
    expect(registry.list()).toContain('financial-services');

    // Trim the catalog to just the basic tier — service should re-populate.
    registry.setTierCatalog([mkTier('basic', 1)]);
    await service.getIndustryRoutes('tenant-1', 'financial-services');
    // After the call, the registry should be re-populated by the service.
    const refreshed = (registry as unknown as { tierCatalog: Tier[] })
      .tierCatalog;
    expect(refreshed.length).toBe(4);
  });
});
