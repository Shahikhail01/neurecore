/**
 * Approval Addon Interface
 *
 * Stage 2 Phase 2A: Industry-specific approval routing.
 * FIX-COMPREHENSIVE 2026-07-23: Add TierGuardOutcome to surface which
 * routes are blocked because of `Tier.maxApprovalStages` so the FE can
 * render an actionable "Upgrade tier" CTA instead of silently omitting
 * the rule.
 *
 * Each addon implements this interface to provide industry-specific
 * approval escalation chains. The base ApprovalChainsService delegates
 * to these addons when an industry-specific chain is needed.
 *
 * SOLID:
 * - ISP: Exposes only the methods an industry needs to override.
 * - LSP: All addons implement this interface — interchangeable.
 * - DIP: ApprovalChainsService depends on ApprovalAddon[] (abstract).
 */

export interface ApprovalRouteTriggerCondition {
  amount?: { gt?: number; lt?: number };
  industryGroup?: string;
  riskTier?: string;
  projectType?: string;
}

export interface ApprovalRouteTrigger {
  event: string;
  conditions?: ApprovalRouteTriggerCondition;
}

export interface ApprovalStage {
  role: string;
  order: number;
  action:
    | 'verify'
    | 'assess'
    | 'approve'
    | 'review'
    | 'sign-off'
    | 'endorse'
    | 'authorize';
}

export interface ApprovalRoute {
  slug: string;
  label: string;
  description?: string;
  stages: ApprovalStage[];
  triggers: ApprovalRouteTrigger[];
}

export interface ApprovalAddon {
  /** Which industry group slugs this addon applies to. */
  readonly industrySlugs: string[];

  /** Returns the industry-specific approval routes for a tenant. */
  getRoutes(tenantId: string): Promise<ApprovalRoute[]>;

  /** Returns routes matching a specific event trigger. */
  getRoutesForEvent(tenantId: string, event: string): Promise<ApprovalRoute[]>;
}

/**
 * FIX-COMPREHENSIVE 2026-07-23:
 *
 * `TierGuardOutcome` is the single source of truth for the cross-tier
 * guard service to report a route as eligible/blocked. Blocked routes
 * carry the *minimum tier slug* required so the FE can route the user
 * directly to `/admin/tiers` for that target tier.
 *
 * `minTierSlug` resolution is an O(n) lookup against the tier catalog —
 * the registry holds it once, lazily, on first use.
 */
export interface TierGuardOutcome {
  eligible: ApprovalRoute[];
  blocked: Array<ApprovalRoute & { reason: string; minTierSlug: string }>;
  /** Effective tier the tenant is on. null when tenant has no tier row. */
  currentTierSlug: string | null;
  /** Numeric `maxApprovalStages` ceiling of the tenant's current tier. */
  maxApprovalStages: number | null;
}

export const APPROVAL_ADDON = 'APPROVAL_ADDON';
