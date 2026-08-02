/**
 * industry-nav.provider.ts (concrete impl)
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3 binding) — backend
 * implementation of IndustryNavProvider.
 *
 * On the backend, nav config is rarely needed (most nav is rendered FE).
 * This provider mirrors `frontend-tenant/src/lib/industryNavigation.ts` for
 * the cases where backend code needs to:
 *   - Generate per-tenant email subjects
 *   - Build OIDC/SCIM group names
 *   - Tag exports / backups
 *
 * Source of truth is FE; this is a hand-maintained mirror. Drift will be
 * caught by a Phase 8 spec (TODO).
 */

import { Injectable } from '@nestjs/common';
import {
  // INDUSTRY_NAV re-exported via interfaces/index.ts barrel; this provider
  // implements the interface but the symbol is bound in industries.module.ts.
  type IndustryNavProvider,
  type IndustryNavConfigDTO,
} from '../interfaces';
import type { IndustryGroupSlug } from '../tier-industry-matrix';

/**
 * Canonical backend nav config table.
 * MUST stay in sync with `frontend-tenant/src/lib/industryNavigation.ts`.
 */
const BACKEND_NAV_CONFIG: Record<string, IndustryNavConfigDTO> = {
  'financial-compliance': {
    groupSlug: 'financial-compliance',
    groupLabel: 'Financial & Compliance',
    customersLabel: 'Clients & Accounts',
    customersIcon: 'Landmark',
    workspaceExtras: [
      {
        id: 'engagements',
        label: 'Engagements',
        href: '/workspace/engagements',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'loans',
        label: 'Loans',
        href: '/workspace/loans',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'portfolios',
        label: 'Portfolios',
        href: '/workspace/portfolios',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'audits',
        label: 'Audits',
        href: '/workspace/audits',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'tax',
        label: 'Tax',
        href: '/workspace/tax',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'payroll',
        label: 'Payroll',
        href: '/workspace/payroll',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'compliance',
        label: 'Compliance',
        href: '/workspace/compliance',
        plannedPhase: 'Phase 2 (placeholder)',
      },
      {
        id: 'risk',
        label: 'Risk',
        href: '/workspace/risk',
        plannedPhase: 'Phase 2 (placeholder)',
      },
    ],
  },
  'business-technology': {
    groupSlug: 'business-technology',
    groupLabel: 'Business & Technology',
    customersLabel: 'Clients',
    customersIcon: 'UserCircle',
    workspaceExtras: [
      {
        id: 'tickets',
        label: 'Tickets',
        href: '/workspace/tickets',
        plannedPhase: 'Phase 3.A',
      },
      {
        id: 'releases',
        label: 'Releases',
        href: '/workspace/releases',
        plannedPhase: 'Phase 3.A',
      },
      {
        id: 'contracts',
        label: 'Contracts',
        href: '/workspace/contracts',
        plannedPhase: 'Phase 3.A',
      },
      {
        id: 'knowledge',
        label: 'Knowledge Base',
        href: '/workspace/knowledge',
        plannedPhase: 'Phase 3.A',
      },
    ],
  },
  'consumer-commerce': {
    groupSlug: 'consumer-commerce',
    groupLabel: 'Consumer & Commerce',
    customersLabel: 'Customers & Members',
    customersIcon: 'Heart',
    workspaceExtras: [
      {
        id: 'products',
        label: 'Products',
        href: '/workspace/products',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'orders',
        label: 'Orders',
        href: '/workspace/orders',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'inventory',
        label: 'Inventory',
        href: '/workspace/inventory',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'stores',
        label: 'Stores',
        href: '/workspace/stores',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'promotions',
        label: 'Promotions',
        href: '/workspace/promotions',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        href: '/workspace/campaigns',
        plannedPhase: 'Phase 4.A',
      },
      {
        id: 'content',
        label: 'Content',
        href: '/workspace/content',
        plannedPhase: 'Phase 4.A',
      },
    ],
  },
  'public-social': {
    groupSlug: 'public-social',
    groupLabel: 'Public & Social',
    customersLabel: 'Citizens & Beneficiaries',
    customersIcon: 'Users',
    workspaceExtras: [
      {
        id: 'programs',
        label: 'Programs',
        href: '/workspace/programs',
        plannedPhase: 'Phase 5.A',
      },
      {
        id: 'grants',
        label: 'Grants',
        href: '/workspace/grants',
        plannedPhase: 'Phase 5.A',
      },
      {
        id: 'field-operations',
        label: 'Field Operations',
        href: '/workspace/field-operations',
        plannedPhase: 'Phase 5.A',
      },
      {
        id: 'cases',
        label: 'Cases',
        href: '/workspace/cases',
        plannedPhase: 'Phase 5.A',
      },
      {
        id: 'licenses',
        label: 'Licenses',
        href: '/workspace/licenses',
        plannedPhase: 'Phase 5.A (hidden for NGO)',
      },
      {
        id: 'inspections',
        label: 'Inspections',
        href: '/workspace/inspections',
        plannedPhase: 'Phase 5.A (hidden for NGO)',
      },
    ],
  },
  other: {
    groupSlug: 'other',
    groupLabel: 'Other',
    customersLabel: 'Members',
    customersIcon: 'User',
    workspaceExtras: [
      {
        id: 'operations',
        label: 'Operations',
        href: '/workspace/operations',
        plannedPhase: 'Phase 5.B',
      },
      {
        id: 'assets',
        label: 'Assets',
        href: '/workspace/assets',
        plannedPhase: 'Phase 5.B',
      },
      {
        id: 'documents',
        label: 'Documents',
        href: '/workspace/documents',
        plannedPhase: 'Phase 5.B',
      },
    ],
  },
  // Cut groups — return null for any lookup.
  healthcare: {
    groupSlug: 'healthcare',
    groupLabel: 'Healthcare',
    customersLabel: null,
    customersIcon: null,
    workspaceExtras: [],
  },
  'industrial-infrastructure': {
    groupSlug: 'industrial-infrastructure',
    groupLabel: 'Industrial & Infrastructure',
    customersLabel: null,
    customersIcon: null,
    workspaceExtras: [],
  },
  'agriculture-food': {
    groupSlug: 'agriculture-food',
    groupLabel: 'Agriculture & Food',
    customersLabel: null,
    customersIcon: null,
    workspaceExtras: [],
  },
};

@Injectable()
export class IndustryNavProviderImpl implements IndustryNavProvider {
  getNavConfig(groupSlug: IndustryGroupSlug): IndustryNavConfigDTO | null {
    return BACKEND_NAV_CONFIG[groupSlug] ?? null;
  }

  getSubIndustryVisibility(
    groupSlug: IndustryGroupSlug,
    moduleId: string,
  ): string[] {
    // Sub-industry visibility is a tenant-FE concern (P3 in plan).
    // Backend never restricts by sub-industry; pass-through empty list
    // means "visible to all sub-industries in this group".
    void moduleId;
    return [];
  }
}
