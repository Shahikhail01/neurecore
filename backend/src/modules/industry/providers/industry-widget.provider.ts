/**
 * industry-widget.provider.ts (concrete impl)
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding) — concrete
 * IndustryWidgetProvider. Wraps the existing WidgetRegistry.
 *
 * Existing WidgetRegistry (`widgets/widget-registry.ts`) is the canonical
 * store for all widget definitions. This provider exposes the read-only
 * portion (filtered by tenant's industryGroup + tier) via the
 * INDUSTRY_WIDGETS DI symbol.
 */

import { Injectable } from '@nestjs/common';
import { type IndustryWidgetProvider } from '../interfaces';
import { WidgetRegistry } from '../../widgets/widget-registry';
import type { IndustryGroupSlug, TierSlug } from '../tier-industry-matrix';
import type { WidgetDefinition } from '../../widgets/widget-definition';

@Injectable()
export class IndustryWidgetProviderImpl implements IndustryWidgetProvider {
  constructor(private readonly registry: WidgetRegistry) {}

  getWidgetsFor(
    groupSlug: IndustryGroupSlug,
    _tenantTier: TierSlug,
  ): WidgetDefinition[] {
    void _tenantTier; // tier filter TODO — defer to Stage 2
    return this.registry.listForIndustryGroup(groupSlug);
  }

  getWidget(id: string): WidgetDefinition | null {
    return this.registry.get(id) ?? null;
  }
}
