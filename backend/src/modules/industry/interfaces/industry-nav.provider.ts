/**
 * industry-nav.provider.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.2 (R3 interface 2) — narrow
 * IndustryNavProvider for nav config lookup + sub-industry filtering.
 *
 * Frontend (industryNavigation.ts) is the implementation; backend consumers
 * needing nav config for an Industry (e.g. for email templates, export
 * descriptors, sidecar hints) depend on this interface.
 */

import type { IndustryGroupSlug } from '../tier-industry-matrix';

export const INDUSTRY_NAV = Symbol('INDUSTRY_NAV');

/**
 * Mirror of frontend `IndustryNavConfig` in industryNavigation.ts.
 * Keep these in sync manually until Stage 2 federates them.
 */
export interface IndustryNavConfigDTO {
  groupSlug: string;
  groupLabel: string;
  customersLabel: string | null;
  customersIcon: string | null;
  /** Workspace extras — IDs only on backend (icon resolution is FE). */
  workspaceExtras: Array<{
    id: string;
    label: string;
    href: string;
    plannedPhase: string;
  }>;
}

export interface IndustryNavProvider {
  /**
   * Get nav config for a group.
   * Returns null if no config exists for the group.
   */
  getNavConfig(groupSlug: IndustryGroupSlug): IndustryNavConfigDTO | null;

  /**
   * Get the list of Industry slugs a particular workspace module should
   * be visible to. Empty array = visible to all Industries in the group.
   * (Mirror of `RailItem.subIndustries` in industryNavigation.ts.)
   */
  getSubIndustryVisibility(
    groupSlug: IndustryGroupSlug,
    moduleId: string,
  ): string[];
}
