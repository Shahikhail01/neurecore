/**
 * industryGroups.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §3 — 8 Industry Groups.
 * Frontend copy of the canonical groups, plus icon component lazy-loading.
 */

export const INDUSTRY_GROUPS = [
  {
    slug: 'healthcare' as const,
    label: 'Healthcare',
    icon: 'HeartPulse',
    sortOrder: 10,
    description: 'Patient care, clinical workflows, medical records',
  },
  {
    slug: 'public-social' as const,
    label: 'Public & Social',
    icon: 'Landmark',
    sortOrder: 20,
    description: 'Government, education, non-profit and humanitarian organisations',
  },
  {
    slug: 'financial-compliance' as const,
    label: 'Financial & Compliance',
    icon: 'Building',
    sortOrder: 30,
    description: 'Banking, insurance, accounting, audit and advisory',
  },
  {
    slug: 'business-technology' as const,
    label: 'Business & Technology',
    icon: 'Briefcase',
    sortOrder: 40,
    description: 'Consulting, agencies, software, IT services',
  },
  {
    slug: 'industrial-infrastructure' as const,
    label: 'Industrial & Infrastructure',
    icon: 'Factory',
    sortOrder: 50,
    description: 'Manufacturing, construction, energy, logistics',
  },
  {
    slug: 'consumer-commerce' as const,
    label: 'Consumer & Commerce',
    icon: 'ShoppingBag',
    sortOrder: 60,
    description: 'Retail, eCommerce, restaurants, media, creative',
  },
  {
    slug: 'agriculture-food' as const,
    label: 'Agriculture & Food',
    icon: 'Wheat',
    sortOrder: 70,
    description: 'Farms, livestock, fisheries, food production',
  },
  {
    slug: 'other' as const,
    label: 'Other',
    icon: 'Layers',
    sortOrder: 80,
    description: 'Family offices, holding companies, conglomerates',
  },
];

export type IndustryGroupSlug = (typeof INDUSTRY_GROUPS)[number]['slug'];

/** Map of group slug → list of Industry slugs in that group. */
export const INDUSTRY_GROUP_INDUSTRIES: Record<IndustryGroupSlug, string[]> = {
  'healthcare':                ['healthcare-life-sciences'],
  'public-social':             ['government-public-sector', 'education-research', 'nonprofit-international'],
  'financial-compliance':      ['accounting-audit-services', 'financial-services', 'insurance'],
  'business-technology':       ['professional-business-services', 'technology-digital-services'],
  'industrial-infrastructure': ['manufacturing-industrial', 'construction-engineering-infrastructure', 'energy-utilities-natural-resources', 'logistics-transportation-supply-chain'],
  'consumer-commerce':         ['retail-commerce-consumer', 'media-communications-creative'],
  'agriculture-food':          ['agriculture-food-systems'],
  'other':                     ['special-purpose-organizations'],
};

/** Reverse map: industry slug → group slug */
export function industryGroupOf(industrySlug: string): IndustryGroupSlug | null {
  for (const group of INDUSTRY_GROUPS) {
    if (INDUSTRY_GROUP_INDUSTRIES[group.slug].includes(industrySlug)) {
      return group.slug;
    }
  }
  return null;
}

/** Get group by slug */
export function getIndustryGroup(slug: string) {
  return INDUSTRY_GROUPS.find((g) => g.slug === slug) ?? null;
}
