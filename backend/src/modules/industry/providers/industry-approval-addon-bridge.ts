/**
 * industry-approval-addon-bridge.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding 4) — thin adapter
 * that exposes the EXISTING `ApprovalAddonRegistry` (in `approval-chains/`)
 * via the `INDUSTRY_APPROVAL_ADDONS` symbol. No new instance, no new state.
 *
 * The real registry lives at `approval-chains/addons/approval-addon.registry.ts`
 * (created 2026-07-23 in Stage 2 Phase 2A). We adapt its concrete methods
 * to the R3 `IndustryApprovalAddonRegistry` interface.
 *
 * DRIFT NOTE: My original spec assumed `supports(context)` + `buildRoutes(context)`.
 * The actual interface has `register(addon)` + `getForIndustry(slug)` +
 * `getRoutesForIndustry(tenantId, slug)` + `getRoutesForEvent(...)`. This bridge
 * adapts one to the other without re-instantiating.
 */

import { Injectable } from '@nestjs/common';
import { ApprovalAddonRegistry } from '../../approval-chains/addons/approval-addon.registry';
import type { ApprovalAddon, ApprovalRoute } from '../../approval-chains/addons/approval-addon.interface';
import {
  INDUSTRY_APPROVAL_ADDONS,
  type IndustryApprovalAddonRegistry,
  type ApprovalContext,
} from '../interfaces';

@Injectable()
export class IndustryApprovalAddonBridge implements IndustryApprovalAddonRegistry {
  constructor(private readonly inner: ApprovalAddonRegistry) {}

  register(addon: ApprovalAddon): void {
    this.inner.register(addon);
  }

  getAddons(context: ApprovalContext): ApprovalAddon[] {
    const byIndustry = this.inner.getForIndustry(context.industrySlug);
    if (byIndustry) return [byIndustry];
    return this.inner.getForGroup(context.industryGroup);
  }

  buildRoutes(context: ApprovalContext): ApprovalRoute[] {
    // Sync approximation: best-effort by combining every known addon's static
    // routes. For the full tenant-scoped async API, callers should use
    // getRoutesForIndustry / getRoutesForEvent (which this bridge delegates).
    const addons = this.getAddons(context);
    return addons.flatMap((a) => {
      try {
        // getRoutes is async on the addon interface; for the sync wrapper we
        // can't await. The narrow contract is: addon-supplied sync metadata
        // only. Most addons carry all routes statically so this works.
        const maybe = (a as unknown as { getRoutesSync?: (tenantId: string) => ApprovalRoute[] }).getRoutesSync;
        if (typeof maybe === 'function') return maybe('anonymous');
      } catch {
        // ignore
      }
      return [];
    });
  }

  async getRoutesForIndustry(tenantId: string, industrySlug: string): Promise<ApprovalRoute[]> {
    return this.inner.getRoutesForIndustry(tenantId, industrySlug);
  }

  async getRoutesForEvent(tenantId: string, industrySlug: string, event: string): Promise<ApprovalRoute[]> {
    return this.inner.getRoutesForEvent(tenantId, industrySlug, event);
  }
}

/**
 * Module provider — binds INDUSTRY_APPROVAL_ADDONS to the bridge.
 */
export const INDUSTRY_APPROVAL_ADDONS_PROVIDER = {
  provide: INDUSTRY_APPROVAL_ADDONS,
  useClass: IndustryApprovalAddonBridge,
};
// Re-export ApprovalRoute so callers don't need to import from approval-chains.
export type { ApprovalRoute };