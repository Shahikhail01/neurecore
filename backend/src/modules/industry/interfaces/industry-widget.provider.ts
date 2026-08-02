/**
 * industry-widget.provider.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.5 (R3 interface 5) — narrow
 * IndustryWidgetProvider for per-Industry KPI widget resolution.
 *
 * Implementation lives in `widgets/widget-registry.ts`. `fc-widgets.ts` is the
 * canonical F&C group widget set; other groups can register their own.
 */

import type { IndustryGroupSlug } from '../tier-industry-matrix';
import type { TierSlug } from '../tier-industry-matrix';
import type { WidgetDefinition } from '../../widgets/widget-definition';

export const INDUSTRY_WIDGETS = Symbol('INDUSTRY_WIDGETS');

export interface IndustryWidgetProvider {
  /**
   * Get widgets visible to a tenant in this (groupSlug, tier) combination.
   * Widgets without an industryGroup are universal; industry-specific widgets
   * (industryGroup set) only return for matching group.
   */
  getWidgetsFor(
    groupSlug: IndustryGroupSlug,
    tenantTier: TierSlug,
  ): WidgetDefinition[];

  /** Get one widget by id. Returns null if not found. */
  getWidget(id: string): WidgetDefinition | null;
}
