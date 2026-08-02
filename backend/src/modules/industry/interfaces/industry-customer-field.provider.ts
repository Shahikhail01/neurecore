/**
 * industry-customer-field.provider.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.3 (R3 interface 3) — narrow
 * IndustryCustomerFieldProvider for per-Industry Customer field schemas.
 *
 * Re-exports the canonical CustomerFieldDef type from the underlying
 * registry (industry-customer-field-definitions.ts) so this interface and
 * the registry can never drift on the type shape.
 */

import type {
  CustomerFieldDef,
  CustomerFieldSection,
} from '../customer-fields/industry-customer-field-definitions';

export const INDUSTRY_CUSTOMER_FIELD = Symbol('INDUSTRY_CUSTOMER_FIELD');

/** Re-export canonical type for consumers. */
export type { CustomerFieldDef, CustomerFieldSection };

export interface IndustryCustomerFieldProvider {
  /** Get the field definitions for one Industry slug. Returns [] if unknown. */
  getFieldsForIndustry(slug: string): CustomerFieldDef[];

  /**
   * Get the union of field definitions for all Industries in a group.
   * Used by admin views that need to render a Customer form before the
   * tenant's Industry is chosen.
   */
  getFieldsByGroup(groupSlug: string): CustomerFieldDef[];
}
