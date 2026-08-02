/**
 * industryGroups.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.1 (R1) — Industry group slug constants.
 *
 * Single source of truth for industry group slugs across the frontend (tenant + admin).
 * Every consumer MUST import from this module instead of hardcoding literals.
 *
 * Mirrors `backend/src/modules/industry/industry-group.constants.ts`.
 * The 8 Industry Groups are defined in `memory-bank-arc/industries/INDUSTRY-GROUPS-CONCEPT.md §3`.
 * The 5 ACTIVE groups (kept Industries) are listed in `ACTIVE_INDUSTRY_GROUPS` below.
 */

export const INDUSTRY_GROUP = {
  // ─── Active (kept, ship to customers) ───────────────────────────────────
  FINANCIAL_COMPLIANCE: 'financial-compliance',
  BUSINESS_TECHNOLOGY: 'business-technology',
  CONSUMER_COMMERCE: 'consumer-commerce',
  PUBLIC_SOCIAL: 'public-social',
  OTHER: 'other',

  // ─── Inactive (cut — DB rows retained for grandfathering) ───────────────
  HEALTHCARE: 'healthcare',
  INDUSTRIAL_INFRASTRUCTURE: 'industrial-infrastructure',
  AGRICULTURE_FOOD: 'agriculture-food',
} as const;

export type IndustryGroupSlug = typeof INDUSTRY_GROUP[keyof typeof INDUSTRY_GROUP];

/**
 * IndustryGroup metadata used by the onboarding picker + IndustryGroupPicker.
 * Single source of truth — IndustryStubPage.tsx + CompanyStep.tsx read from
 * here. Adding a new Industry Group = one entry here.
 */
export interface IndustryGroupMeta {
  slug: IndustryGroupSlug;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
}

export const INDUSTRY_GROUPS: ReadonlyArray<IndustryGroupMeta> = [
  { slug: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,        label: 'Financial & Compliance',         description: 'Banking, insurance, accounting, audit and advisory',  icon: 'Landmark', sortOrder: 30 },
  { slug: INDUSTRY_GROUP.BUSINESS_TECHNOLOGY,         label: 'Business & Technology',         description: 'Software, consulting, MSPs, product teams',            icon: 'Briefcase', sortOrder: 40 },
  { slug: INDUSTRY_GROUP.CONSUMER_COMMERCE,           label: 'Consumer & Commerce',           description: 'Retail, e-commerce, restaurants, media and creative',  icon: 'ShoppingCart', sortOrder: 50 },
  { slug: INDUSTRY_GROUP.PUBLIC_SOCIAL,               label: 'Public & Social (Non-Profit)', description: 'NGOs, international development, foundations',         icon: 'Heart', sortOrder: 60 },
  { slug: INDUSTRY_GROUP.OTHER,                       label: 'Other',                          description: 'Holding companies, special-purpose organisations',     icon: 'Briefcase', sortOrder: 70 },
];

/**
 * Map of Industry Group → Industry slugs within that group.
 * Used by onboarding allocator to enumerate valid Industry picks.
 */
export const INDUSTRY_GROUP_INDUSTRIES: Record<IndustryGroupSlug, readonly string[]> = {
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]:        ['accounting-audit-services', 'financial-services'],
  [INDUSTRY_GROUP.BUSINESS_TECHNOLOGY]:         ['technology-digital-services', 'professional-business-services'],
  [INDUSTRY_GROUP.CONSUMER_COMMERCE]:           ['retail-commerce-consumer', 'media-communications-creative'],
  [INDUSTRY_GROUP.PUBLIC_SOCIAL]:               ['nonprofit-international'],
  [INDUSTRY_GROUP.OTHER]:                       ['special-purpose-organizations'],
  // Cut groups — DB rows retained for grandfathering, not selectable in picker.
  [INDUSTRY_GROUP.HEALTHCARE]:                  [],
  [INDUSTRY_GROUP.INDUSTRIAL_INFRASTRUCTURE]:   [],
  [INDUSTRY_GROUP.AGRICULTURE_FOOD]:            [],
};

export const ACTIVE_INDUSTRY_GROUPS: ReadonlySet<IndustryGroupSlug> = new Set([
  INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
  INDUSTRY_GROUP.BUSINESS_TECHNOLOGY,
  INDUSTRY_GROUP.CONSUMER_COMMERCE,
  INDUSTRY_GROUP.PUBLIC_SOCIAL,
  INDUSTRY_GROUP.OTHER,
]);

/** Convenience predicate for the F&C first-class-customer-column guard. */
export const isFinancialComplianceGroup = (g: string | null | undefined): boolean =>
  g === INDUSTRY_GROUP.FINANCIAL_COMPLIANCE;

/**
 * The 8 Industries we actively sell to (per PRUNED-TAXONOMY-PROPOSAL §5).
 * Used by the Customer Industry dropdown filter.
 */
export const ACTIVE_INDUSTRY_SLUGS: ReadonlySet<string> = new Set([
  'accounting-audit-services',
  'financial-services',
  'technology-digital-services',
  'professional-business-services',
  'retail-commerce-consumer',
  'media-communications-creative',
  'nonprofit-international',
  'special-purpose-organizations',
]);