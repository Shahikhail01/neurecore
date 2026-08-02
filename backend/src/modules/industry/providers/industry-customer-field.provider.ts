/**
 * industry-customer-field.provider.ts (concrete impl)
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding) — wraps the
 * existing `industry-customer-field-definitions.ts` Record.
 *
 * The existing file is already SOLID-compliant (Record<slug, ...> + resolver
 * function). This provider class is the NestJS DI-friendly wrapper so other
 * modules inject INDUSTRY_CUSTOMER_FIELD instead of importing the data file
 * directly.
 */

import { Injectable } from '@nestjs/common';
import {
  type IndustryCustomerFieldProvider,
  type CustomerFieldDef,
} from '../interfaces';
import { getCustomerFieldDefs } from '../customer-fields/industry-customer-field-definitions';
import {
  INDUSTRY_GROUP_INDUSTRIES,
  type IndustryGroupSlug,
} from '../tier-industry-matrix';

@Injectable()
export class IndustryCustomerFieldProviderImpl implements IndustryCustomerFieldProvider {
  getFieldsForIndustry(slug: string): CustomerFieldDef[] {
    return getCustomerFieldDefs(slug) ?? [];
  }

  getFieldsByGroup(groupSlug: string): CustomerFieldDef[] {
    // The existing field-defs map is keyed by Industry slug, not group.
    // To get the union of fields for a group, walk the canonical group map.
    const slugs: string[] =
      INDUSTRY_GROUP_INDUSTRIES[groupSlug as IndustryGroupSlug] ?? [];
    const merged: CustomerFieldDef[] = [];
    const seen = new Set<string>();
    for (const slug of slugs) {
      for (const def of getCustomerFieldDefs(slug) ?? []) {
        if (!seen.has(def.key)) {
          seen.add(def.key);
          merged.push(def);
        }
      }
    }
    return merged;
  }
}
