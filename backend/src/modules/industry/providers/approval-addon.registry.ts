/**
 * approval-addon.registry.ts (concrete impl)
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding) — concrete
 * addon registry. Mirrors the actual ApprovalAddon interface from
 * `approval-addons.interface.ts`.
 *
 * Course correction (2026-07-31): the interface actually exposes
 * `industrySlugs: string[]` + `getRoutes(tenantId)` + `getRoutesForEvent(tenantId, event)`.
 * Not `supports(context)` / `buildRoutes(context)` as the plan §4.3.4 had it.
 * This registry wraps the actual API.
 *
 * Existing `FinancialApprovalAddon` is auto-registered via NestJS module init.
 * Future Industry-specific addons (Phase 5+ etc.) register themselves.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  type IndustryApprovalAddonRegistry,
  type ApprovalContext,
} from '../interfaces';
import type {
  ApprovalAddon,
  ApprovalRoute,
} from '../../approval-chains/addons/approval-addon.interface';
import { FinancialApprovalAddon } from '../../approval-chains/addons/financial-approval.addon';

@Injectable()
export class ApprovalAddonRegistry
  implements IndustryApprovalAddonRegistry, OnModuleInit
{
  private readonly addons: ApprovalAddon[] = [];

  constructor(private readonly financialAddon: FinancialApprovalAddon) {}

  onModuleInit(): void {
    // Auto-register F&C addon. Future phases add more here.
    this.register(this.financialAddon);
  }

  register(addon: ApprovalAddon): void {
    // Dedup by class identity (addon.constructor).
    if (
      this.addons.some((existing) => existing.constructor === addon.constructor)
    )
      return;
    this.addons.push(addon);
  }

  getAddons(_context: ApprovalContext): ApprovalAddon[] {
    // Per ApprovalAddon interface: addons are filtered by their own
    // `industrySlugs` array (not by context). Tenant-independence is by
    // design — the addon queries its own routes per tenantId.
    void _context;
    return [...this.addons];
  }

  /**
   * Convenience helper: build routes for a (tenant, event) combination by
   * concatenating results from every registered addon. Used by ApprovalChainsService.
   */
  async buildRoutesForEvent(
    tenantId: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const routes: ApprovalRoute[] = [];
    for (const addon of this.addons) {
      const matched = await addon.getRoutesForEvent(tenantId, event);
      routes.push(...matched);
    }
    return routes;
  }

  /**
   * Async variant of buildRoutes. Walks every registered addon and asks
   * it for routes that match the tenant. Additive default — most addons
   * filter by their own `industrySlugs` and return `[]` when the slug
   * doesn't match.
   */
  async getRoutesForIndustry(
    tenantId: string,
    _industrySlug: string,
  ): Promise<ApprovalRoute[]> {
    const routes: ApprovalRoute[] = [];
    for (const addon of this.addons) {
      const matched = await addon.getRoutes(tenantId);
      routes.push(...matched);
    }
    return routes;
  }

  /**
   * Async variant: build routes for a (tenant, event) tuple. The
   * `industrySlug` is part of the interface but not used by individual
   * addons — they filter by their own `industrySlugs`.
   * ApprovalChainsService calls this on the hot path.
   */
  async getRoutesForEvent(
    tenantId: string,
    _industrySlug: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const routes: ApprovalRoute[] = [];
    for (const addon of this.addons) {
      const matched = await addon.getRoutesForEvent(tenantId, event);
      routes.push(...matched);
    }
    return routes;
  }

  /**
   * Synchronous variant for the legacy registry interface. Not all addons
   * support sync route resolution; callers that need sync must use
   * `buildRoutesForEvent` instead.
   */
  buildRoutes(_context: ApprovalContext): ApprovalRoute[] {
    void _context;
    return [];
  }
}
