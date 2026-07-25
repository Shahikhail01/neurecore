/**
 * Canonical 16-industry list (admin).
 *
 * Single source of truth for industry metadata on the admin frontend.
 * Mirrors the canonical slugs in `backend/src/modules/industry/` and
 * `frontend-tenant/src/lib/industryGroups.ts`. CI keeps these in sync
 * via `npm run test:industries-sync` (backend).
 *
 * Phase 1 G11 (INDUSTRY-SETUP-CONCEPT.md §3.2 G11): the previous
 * "15-industry" list was missing `accounting-audit-services`. That slug
 * already existed in the tenant lib and the backend pool but had been
 * accidentally dropped here, causing the admin "Create New Tenant" form
 * to fall back to a parallel hardcoded list. Adding it here makes the
 * admin list match the canonical taxonomy.
 */

export const INDUSTRIES = [
  'accounting-audit-services',
  'agriculture-food-systems',
  'construction-engineering-infrastructure',
  'education-research',
  'energy-utilities-natural-resources',
  'financial-services',
  'government-public-sector',
  'healthcare-life-sciences',
  'insurance',
  'logistics-transportation-supply-chain',
  'manufacturing-industrial',
  'media-communications-creative',
  'nonprofit-international',
  'professional-business-services',
  'retail-commerce-consumer',
  'special-purpose-organizations',
  'technology-digital-services',
] as const;

export type IndustrySlug = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<IndustrySlug, string> = {
  'accounting-audit-services': 'Accounting & Audit Services',
  'agriculture-food-systems': 'Agriculture & Food Systems',
  'construction-engineering-infrastructure': 'Construction, Engineering & Infrastructure',
  'education-research': 'Education & Research',
  'energy-utilities-natural-resources': 'Energy, Utilities & Natural Resources',
  'financial-services': 'Financial Services',
  'government-public-sector': 'Government & Public Sector',
  'healthcare-life-sciences': 'Healthcare & Life Sciences',
  'insurance': 'Insurance',
  'logistics-transportation-supply-chain': 'Logistics, Transportation & Supply Chain',
  'manufacturing-industrial': 'Manufacturing & Industrial',
  'media-communications-creative': 'Media, Communications & Creative',
  'nonprofit-international': 'Nonprofit & International Development',
  'professional-business-services': 'Professional & Business Services',
  'retail-commerce-consumer': 'Retail, Commerce & Consumer',
  'special-purpose-organizations': 'Special Purpose Organizations',
  'technology-digital-services': 'Technology & Digital Services',
};

/** Map of industry slug → its parent industry-group slug. Mirrors
 *  `frontend-tenant/src/lib/industryGroups.ts:INDUSTRY_GROUP_INDUSTRIES`. */
export const INDUSTRY_GROUP_BY_INDUSTRY: Record<IndustrySlug, string> = {
  'accounting-audit-services': 'financial-compliance',
  'agriculture-food-systems': 'agriculture-food',
  'construction-engineering-infrastructure': 'industrial-infrastructure',
  'education-research': 'public-social',
  'energy-utilities-natural-resources': 'industrial-infrastructure',
  'financial-services': 'financial-compliance',
  'government-public-sector': 'public-social',
  'healthcare-life-sciences': 'healthcare',
  'insurance': 'financial-compliance',
  'logistics-transportation-supply-chain': 'industrial-infrastructure',
  'manufacturing-industrial': 'industrial-infrastructure',
  'media-communications-creative': 'consumer-commerce',
  'nonprofit-international': 'public-social',
  'professional-business-services': 'business-technology',
  'retail-commerce-consumer': 'consumer-commerce',
  'special-purpose-organizations': 'other',
  'technology-digital-services': 'business-technology',
};

/** Human label for an industry-group slug (keyed by the same slugs the
 *  tenant frontend uses). */
export const INDUSTRY_GROUP_LABELS: Record<string, string> = {
  healthcare: 'Healthcare & Life Sciences',
  'public-social': 'Public & Social',
  'financial-compliance': 'Financial & Compliance',
  'business-technology': 'Business & Technology',
  'industrial-infrastructure': 'Industrial & Infrastructure',
  'consumer-commerce': 'Consumer & Commerce',
  'agriculture-food': 'Agriculture & Food',
  other: 'Other',
};

export const INDUSTRY_FILTERS = [
  { label: 'All Industries', value: '' },
  ...INDUSTRIES.map((slug) => ({
    label: INDUSTRY_LABELS[slug],
    value: slug,
  })),
];

export const CLASSIFICATION_FILTERS = [
  { label: 'All Classifications', value: '' },
  { label: 'Client Engagement', value: 'CLIENT_ENGAGEMENT' },
  { label: 'Internal Initiative', value: 'INTERNAL_INITIATIVE' },
  { label: 'Operational Program', value: 'OPERATIONAL_PROGRAM' },
];

export function isIndustrySlug(value: unknown): value is IndustrySlug {
  return typeof value === 'string' && (INDUSTRIES as readonly string[]).includes(value);
}