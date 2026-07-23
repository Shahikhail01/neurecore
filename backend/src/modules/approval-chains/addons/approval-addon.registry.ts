/**
 * Approval Addon Registry
 *
 * Stage 2 Phase 2A: Registry pattern for industry-specific approval addons.
 *
 * Follows the same pattern as ConnectorRegistry: addons register themselves
 * via onModuleInit. This avoids NestJS multi-provider type complications
 * with NestJS v11's Provider type definitions.
 *
 * FIX-COMPREHENSIVE 2026-07-23: tier catalog is the registry's
 * responsibility (SRP: the registry owns the additive projection from
 * `Tier.maxApprovalStages` to per-route ceiling checks). The catalog is
 * injected via `setTierCatalog()` from `ApprovalChainsService` which has
 * access to `TiersService` — keeping the registry scope-tight (no
 * direct `PrismaService` dependency here).
 *
 * SOLID:
 * - SRP: This registry only collects and queries addons + owns the
 *   tier-catalog projection for the cross-tier guard.
 * - OCP: New addon = new file + register in module. Zero changes here.
 * - DIP: ApprovalChainsService depends on this registry (abstraction).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Tier } from '@prisma/client';
import type {
  ApprovalAddon,
  ApprovalRoute,
  TierGuardOutcome,
} from './approval-addon.interface';

@Injectable()
export class ApprovalAddonRegistry {
  private readonly logger = new Logger(ApprovalAddonRegistry.name);
  private readonly addons: Map<string, ApprovalAddon> = new Map();
  /** FIX-COMPREHENSIVE: tier catalog set by `setTierCatalog` from the service layer. */
  private tierCatalog: Tier[] = [];

  register(addon: ApprovalAddon): void {
    for (const slug of addon.industrySlugs) {
      if (this.addons.has(slug)) {
        this.logger.warn(
          `Approval addon for industry "${slug}" already registered; overwriting`,
        );
      }
      this.addons.set(slug, addon);
    }
    this.logger.log(
      `Registered approval addon for industries: [${addon.industrySlugs.join(', ')}]`,
    );
  }

  getForIndustry(industrySlug: string): ApprovalAddon | undefined {
    return this.addons.get(industrySlug);
  }

  getForGroup(groupSlug: string): ApprovalAddon[] {
    const seen = new Set<ApprovalAddon>();
    for (const [industry, addon] of this.addons) {
      if (industry === groupSlug || industry.startsWith(groupSlug)) {
        seen.add(addon);
      }
    }
    return [...seen];
  }

  list(): string[] {
    return [...this.addons.keys()];
  }

  async getRoutesForIndustry(
    tenantId: string,
    industrySlug: string,
  ): Promise<ApprovalRoute[]> {
    const addon = this.addons.get(industrySlug);
    if (!addon) return [];
    return addon.getRoutes(tenantId);
  }

  async getRoutesForEvent(
    tenantId: string,
    industrySlug: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const addon = this.addons.get(industrySlug);
    if (!addon) return [];
    return addon.getRoutesForEvent(tenantId, event);
  }

  /**
   * FIX-COMPREHENSIVE 2026-07-23:
   *
   * `evaluateAgainstTier` is the single source of truth for the
   * cross-tier approval guard. Splits a list of routes into:
   *   - `eligible`: each route whose `stages.length <= maxApprovalStages`
   *   - `blocked`: over-cap routes carry `reason` + `minTierSlug`.
   *
   * SRP: this method owns the *ordering* of tiers and the *projection*
   * from `Tier.maxApprovalStages` to per-route ceiling check. It does NOT
   * mutate any tenant — that's `TierChangeService`.
   *
   * `null` ceiling (= tenant has no tier) treats every route as
   * eligible — the FE picker offers "Pick a tier first" CTA via its
   * own logic; we don't block at this layer.
   */
  evaluateAgainstTier(
    routes: ApprovalRoute[],
    maxApprovalStages: number | null,
    currentTierSlug: string | null,
  ): TierGuardOutcome {
    if (maxApprovalStages === null) {
      return {
        eligible: routes,
        blocked: [],
        currentTierSlug,
        maxApprovalStages,
      };
    }

    const eligible: ApprovalRoute[] = [];
    const blocked: TierGuardOutcome['blocked'] = [];
    for (const route of routes) {
      if (route.stages.length <= maxApprovalStages) {
        eligible.push(route);
        continue;
      }
      const minTierSlug =
        this.minTierForStages(route.stages.length)?.slug ?? 'enterprise';
      blocked.push({
        ...route,
        reason: `Route "${route.slug}" requires ${route.stages.length} approval stages; tier "${currentTierSlug ?? 'none'}" allows ${maxApprovalStages}. Upgrade to "${minTierSlug}" to enable.`,
        minTierSlug,
      });
    }
    return {
      eligible,
      blocked,
      currentTierSlug,
      maxApprovalStages,
    };
  }

  /**
   * `minTierForStages` returns the lowest tier whose `maxApprovalStages`
   * is at least `required`. Returns null when no tier in the catalog can
   * accommodate the requirement (callers fall back to `enterprise`).
   */
  minTierForStages(required: number): Tier | null {
    if (this.tierCatalog.length === 0) return null;
    const ORDER = ['basic', 'business', 'professional', 'enterprise'];
    const sorted = [...this.tierCatalog].sort((a, b) => {
      const ai = ORDER.indexOf(a.slug);
      const bi = ORDER.indexOf(b.slug);
      const ai2 = ai < 0 ? ORDER.length : ai;
      const bi2 = bi < 0 ? ORDER.length : bi;
      return ai2 - bi2;
    });
    for (const t of sorted) {
      if (t.maxApprovalStages >= required) return t;
    }
    return null;
  }

  /** Called by `ApprovalChainsService` (which has `TiersService`) to refresh the snapshot. */
  setTierCatalog(tiers: Tier[]): void {
    this.tierCatalog = tiers;
  }

  /** Test-only helper. */
  invalidateTierCatalog(): void {
    this.tierCatalog = [];
  }
}
