/**
 * industry-approval-addon.registry.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.4 (R3 interface 4) — addon registry
 * for Industry-specific approval chain overrides.
 *
 * `financial-approval.addon.ts` is the canonical implementation; any new
 * Industry addon (e.g. `healthcare-hipaa.addon.ts`) is registered at NestJS
 * module init via `.register()`.
 */

import type {
  ApprovalAddon,
  ApprovalRoute,
} from '../../approval-chains/addons/approval-addon.interface';
import type { IndustryGroupSlug } from '../tier-industry-matrix';

export const INDUSTRY_APPROVAL_ADDONS = Symbol('INDUSTRY_APPROVAL_ADDONS');

/**
 * Context passed to addon.supports() — encapsulates all addon-needs-to-decide
 * inputs in one object.
 */
export interface ApprovalContext {
  /** Tenant's industry group. */
  industryGroup: IndustryGroupSlug;
  /** Tenant's industry slug (more specific than group). */
  industrySlug: string;
  /** Event being approved (e.g. 'customer.created', 'project.completed'). */
  event: string;
  /** Free-form metadata (e.g. customer.financialSubType, project.amount). */
  metadata?: Record<string, unknown>;
}

export interface IndustryApprovalAddonRegistry {
  /** Register a new addon at module init. Idempotent (dedupes by class). */
  register(addon: ApprovalAddon): void;

  /**
   * Get all addons that support this context.
   * Order matters: routes are concatenated in registration order.
   */
  getAddons(context: ApprovalContext): ApprovalAddon[];

  /**
   * Sync convenience: build flat route list for a context.
   * Async variants (with tenantId) live on `getRoutesForIndustry(tenantId, slug)`
   * and `getRoutesForEvent(tenantId, event)` on the inner ApprovalAddonRegistry.
   */
  buildRoutes(context: ApprovalContext): ApprovalRoute[];

  /** Async: routes for one Industry slug, scoped to a tenant. */
  getRoutesForIndustry(tenantId: string, industrySlug: string): Promise<ApprovalRoute[]>;

  /** Async: routes matching an event in an Industry, scoped to a tenant. */
  getRoutesForEvent(tenantId: string, industrySlug: string, event: string): Promise<ApprovalRoute[]>;
}
