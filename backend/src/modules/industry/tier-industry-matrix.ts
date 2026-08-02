/**
 * tier-industry-matrix.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §9.5 — Tier × Industry capability matrix.
 * Source of truth for the "Plan Impact" panel during onboarding.
 *
 * Capabilities are computed per (industry group, tier) combination.
 * Update when a new tier or industry group is added.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.1 (R1) — this file is the
 * SINGLE source of truth for industry-group slugs + tier slugs on the
 * backend. Consumers MUST import from here, never inline literals.
 */

export type TierSlug = 'basic' | 'business' | 'professional' | 'enterprise';

/**
 * Industry group slug constant object. The string literal value MUST equal
 * the matching member of the IndustryGroupSlug union below — TypeScript's
 * literal-type assignment check enforces this at compile time.
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
} as const satisfies Record<string, IndustryGroupSlug>;

export type IndustryGroupSlug =
  | 'healthcare'
  | 'public-social'
  | 'financial-compliance'
  | 'business-technology'
  | 'industrial-infrastructure'
  | 'consumer-commerce'
  | 'agriculture-food'
  | 'other';

/**
 * Set of group slugs whose Industries are selectable in the onboarding
 * picker AND show in the Customer Industry dropdown AND surface in marketing.
 *
 * Adding a new active Industry group = one entry here + one entry in the
 * IndustryGroupSlug union + one entry in INDUSTRY_GROUP above + one entry
 * in INDUSTRY_GROUP_INDUSTRIES below + one entry in CAPABILITY_MATRIX.
 */
export const ACTIVE_INDUSTRY_GROUPS: ReadonlySet<IndustryGroupSlug> = new Set([
  INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
  INDUSTRY_GROUP.BUSINESS_TECHNOLOGY,
  INDUSTRY_GROUP.CONSUMER_COMMERCE,
  INDUSTRY_GROUP.PUBLIC_SOCIAL,
  INDUSTRY_GROUP.OTHER,
]);

export interface IndustryCapabilityRow {
  maxAgents: number; // 9999 = unlimited
  maxDepartments: number; // 9999 = unlimited
  maxStorageGB: number; // 9999 = unlimited
  maxApprovalStages: number;
  activeAgentSlugs: string[]; // slugs of agents activated by default
  packageTiersAvailable: string[]; // 'business' | 'professional' | 'enterprise' | 'basic'
  projectTypesVisible: string[]; // slugs of project types visible in selector
  integrationsAvailable: string[]; // keys of integration features available
  featureFlags: string[]; // names of feature flags enabled
  description: string; // human-readable summary for "Plan Impact" panel
}

// ─── Industry Group → Industry Slugs ──────────────────────────────────────
export const INDUSTRY_GROUP_INDUSTRIES: Record<IndustryGroupSlug, string[]> = {
  healthcare: ['healthcare-life-sciences'],
  'public-social': [
    'government-public-sector',
    'education-research',
    'nonprofit-international',
  ],
  'financial-compliance': [
    'accounting-audit-services',
    'financial-services',
    'insurance',
  ],
  'business-technology': [
    'professional-business-services',
    'technology-digital-services',
  ],
  'industrial-infrastructure': [
    'manufacturing-industrial',
    'construction-engineering-infrastructure',
    'energy-utilities-natural-resources',
    'logistics-transportation-supply-chain',
  ],
  'consumer-commerce': [
    'retail-commerce-consumer',
    'media-communications-creative',
  ],
  'agriculture-food': ['agriculture-food-systems'],
  other: ['special-purpose-organizations'],
};

// ─── Default agent slugs per industry (used by capability preview) ────────
// Kept minimal — actual agent pool is seeded in the AI Agent Templates
const INDUSTRY_DEFAULT_AGENTS: Record<string, string[]> = {
  'accounting-audit-services': [
    'bookkeeper',
    'ap-specialist',
    'tax-junior',
    'ar-specialist',
    'audit-junior',
    'payroll',
    'tax-strategist',
    'audit-coordinator',
    'compliance-auditor',
    'forensic-auditor',
    'risk-manager',
    'quality-reviewer',
  ],
  'financial-services': [
    'relationship-manager',
    'loan-officer',
    'compliance-officer',
    'risk-analyst',
  ],
  'healthcare-life-sciences': [
    'patient-scheduler',
    'records-clerk',
    'triage-nurse',
  ],
  'government-public-sector': [
    'case-worker',
    'permit-clerk',
    'records-officer',
  ],
  'education-research': [
    'admissions-coordinator',
    'academic-advisor',
    'registrar',
  ],
  'nonprofit-international': [
    'program-manager',
    'grant-writer',
    'volunteer-coordinator',
  ],
  'professional-business-services': [
    'consultant',
    'project-manager',
    'analyst',
  ],
  'technology-digital-services': [
    'engineer',
    'product-manager',
    'support-agent',
  ],
  'manufacturing-industrial': [
    'production-planner',
    'quality-controller',
    'maintenance-tech',
  ],
  'construction-engineering-infrastructure': [
    'site-manager',
    'estimator',
    'procurement-officer',
  ],
  'energy-utilities-natural-resources': [
    'plant-operator',
    'compliance-officer',
    'incident-responder',
  ],
  'logistics-transportation-supply-chain': [
    'dispatcher',
    'fleet-manager',
    'warehouse-supervisor',
  ],
  'retail-commerce-consumer': [
    'store-manager',
    'merchandiser',
    'loyalty-marketer',
  ],
  'media-communications-creative': [
    'editor',
    'content-strategist',
    'campaign-manager',
  ],
  'agriculture-food-systems': [
    'farm-manager',
    'livestock-specialist',
    'harvest-coordinator',
  ],
  'special-purpose-organizations': ['operations-manager'],
};

/**
 * Sub-industry priority overrides.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.3 Phase 3: when a tenant's industry slug
 * is one of the parent entries in INDUSTRY_GROUP_INDUSTRIES (e.g.
 * 'government-public-sector' is a sub of 'public-social'), the
 * parent's default agent list is too generic. This map lifts the
 * specialised agents to the top of the provisioning queue so the
 * right agents are activated first.
 *
 * Schema: array of slug prefixes. Agents in INDUSTRY_DEFAULT_AGENTS
 * that start with one of these prefixes are sorted ahead of others
 * (alphabetical by slug within the priority bucket).
 *
 * SRP: this map is the ONLY place where sub-industry priority lives.
 * Consumers (OnboardingService.complete, Plan Impact FE panel) read
 * it via `resolveDefaultAgentsForIndustry()` which falls back to the
 * generic list when no override matches.
 */
export const SUB_INDUSTRY_AGENT_PRIORITIES: Record<string, readonly string[]> =
  {
    // Healthcare: clinical roles prioritise triage + records specialists
    'healthcare-life-sciences': ['triage', 'records', 'patient', 'pharm'],
    // Government: compliance + records + permits first
    'government-public-sector': ['permit', 'records', 'case-', 'compliance'],
    // Education: registrar + advisor first
    'education-research': ['registrar', 'advisor', 'admissions'],
    // Nonprofit: grant + program first
    'nonprofit-international': ['grant', 'program', 'volunteer'],
    // Manufacturing: production planner first
    'manufacturing-industrial': ['production', 'maintenance', 'quality'],
    // Construction: estimator + site first
    'construction-engineering-infrastructure': [
      'estimator',
      'site',
      'procurement',
    ],
    // Energy: compliance + incident first
    'energy-utilities-natural-resources': ['compliance', 'incident', 'plant'],
    // Logistics: dispatcher + fleet first
    'logistics-transportation-supply-chain': [
      'dispatcher',
      'fleet',
      'warehouse',
    ],
    // Retail: loyalty + store first
    'retail-commerce-consumer': ['loyalty', 'store', 'merchandis'],
    // Media: editor + content first
    'media-communications-creative': ['editor', 'content', 'campaign'],
    // Accounting & audit: senior staff before juniors
    'accounting-audit-services': [
      'tax-strategist',
      'audit-coordinator',
      'compliance-auditor',
      'risk-manager',
      'forensic',
      'quality-reviewer',
    ],
  };

/**
 * Resolve the default agents for a tenant's industry, applying sub-industry
 * priority overrides when present.
 *
 * @param industrySlug  The tenant's `Tenant.industry` value (a sub-industry
 *                      slug like 'accounting-audit-services').
 * @returns Ordered array of agent slugs; sub-industry priority bucket first,
 *          then the remaining agents from INDUSTRY_DEFAULT_AGENTS in their
 *          original order.
 *
 * SRP: single purpose (sub-industry priority sort). Pure function — no
 * I/O, no state. DRY: this is the only place the priority map is consumed.
 */
export function resolveDefaultAgentsForIndustry(
  industrySlug: string,
): string[] {
  const base = INDUSTRY_DEFAULT_AGENTS[industrySlug] ?? [];
  if (base.length === 0) return [];

  const priorities = SUB_INDUSTRY_AGENT_PRIORITIES[industrySlug];
  if (!priorities || priorities.length === 0) {
    return [...base];
  }

  const bucket: string[] = [];
  const rest: string[] = [];
  for (const slug of base) {
    if (priorities.some((prefix) => slug.startsWith(prefix))) {
      bucket.push(slug);
    } else {
      rest.push(slug);
    }
  }
  // Stable, alphabetical within bucket so the output is deterministic.
  bucket.sort();
  return [...bucket, ...rest];
}

// ─── Tier × Industry-Group capability matrix ─────────────────────────────
const BASE_FEATURES = ['core-platform'];
const TIER_FEATURES: Record<TierSlug, string[]> = {
  basic: [...BASE_FEATURES],
  business: [
    ...BASE_FEATURES,
    'workflow-automation',
    'api-access',
    'audit-logs',
  ],
  professional: [
    ...BASE_FEATURES,
    'workflow-automation',
    'api-access',
    'audit-logs',
    'sso',
    'two-factor',
    'custom-branding',
    'predictive-analytics',
    'custom-dashboards',
  ],
  enterprise: [
    ...BASE_FEATURES,
    'workflow-automation',
    'api-access',
    'audit-logs',
    'sso',
    'two-factor',
    'white-label',
    'custom-branding',
    'predictive-analytics',
    'custom-dashboards',
    'multi-tenant',
    'multi-office',
  ],
};

const TIER_PACKAGES: Record<TierSlug, string[]> = {
  basic: [], // trial — previews only
  business: [
    'business-foundation',
    'business-operations',
    'business-finance',
    'business-compliance',
  ],
  professional: [
    'business-foundation',
    'business-operations',
    'business-finance',
    'business-compliance',
    'professional-operations',
    'professional-knowledge',
    'professional-people',
    'professional-customer-experience',
  ],
  enterprise: [
    'business-foundation',
    'business-operations',
    'business-finance',
    'business-compliance',
    'professional-operations',
    'professional-knowledge',
    'professional-people',
    'professional-customer-experience',
    'enterprise-operations',
    'enterprise-firm-ops',
    'executive-analytics',
  ],
};

const TIER_PROJECT_TYPES: Record<TierSlug, string[]> = {
  basic: [], // preview only
  business: ['bookkeeping-cycle', 'payroll-cycle'],
  professional: [
    'bookkeeping-cycle',
    'payroll-cycle',
    'tax-filing',
    'compliance-review',
    'audit-engagement',
  ],
  enterprise: [
    'bookkeeping-cycle',
    'payroll-cycle',
    'tax-filing',
    'compliance-review',
    'audit-engagement',
    'forensic-audit',
    'multi-office-operations',
  ],
};

// Industry-group-specific extras
const GROUP_SPECIFIC: Record<
  IndustryGroupSlug,
  Partial<Record<TierSlug, { integrations?: string[]; extras?: string[] }>>
> = {
  healthcare: {
    business: { integrations: ['ms365', 'google-workspace'] },
    professional: {
      integrations: ['ms365', 'google-workspace', 'epic-export', 'hl7-bridge'],
    },
    enterprise: {
      integrations: [
        'ms365',
        'google-workspace',
        'epic-export',
        'hl7-bridge',
        'hipaa-baa',
      ],
    },
  },
  'public-social': {
    business: { integrations: ['ms365', 'google-workspace'] },
    professional: { integrations: ['ms365', 'google-workspace', 'grants-gov'] },
    enterprise: {
      integrations: [
        'ms365',
        'google-workspace',
        'grants-gov',
        'fedramp-vendor',
      ],
    },
  },
  'financial-compliance': {
    business: { integrations: ['quickbooks', 'ms365'] },
    professional: { integrations: ['quickbooks', 'ms365', 'xero', 'sage'] },
    enterprise: {
      integrations: [
        'quickbooks',
        'ms365',
        'xero',
        'sage',
        'erp-api',
        'on-prem-connector',
      ],
    },
  },
  'business-technology': {
    business: { integrations: ['github', 'gitlab', 'jira', 'ms365'] },
    professional: {
      integrations: [
        'github',
        'gitlab',
        'jira',
        'ms365',
        'salesforce',
        'hubspot',
      ],
    },
    enterprise: {
      integrations: [
        'github',
        'gitlab',
        'jira',
        'ms365',
        'salesforce',
        'hubspot',
        'erp-api',
        'on-prem-connector',
      ],
    },
  },
  'industrial-infrastructure': {
    business: { integrations: ['ms365'] },
    professional: { integrations: ['ms365', 'erp', 'scada-bridge'] },
    enterprise: {
      integrations: [
        'ms365',
        'erp',
        'scada-bridge',
        'iot-platform',
        'on-prem-connector',
      ],
    },
  },
  'consumer-commerce': {
    business: { integrations: ['square', 'shopify', 'stripe'] },
    professional: {
      integrations: ['square', 'shopify', 'stripe', 'mailchimp', 'klaviyo'],
    },
    enterprise: {
      integrations: [
        'square',
        'shopify',
        'stripe',
        'mailchimp',
        'klaviyo',
        'erp-api',
        'on-prem-connector',
      ],
    },
  },
  'agriculture-food': {
    business: { integrations: ['ms365'] },
    professional: { integrations: ['ms365', 'erp', 'iot-sensors'] },
    enterprise: {
      integrations: [
        'ms365',
        'erp',
        'iot-sensors',
        'supply-chain-api',
        'on-prem-connector',
      ],
    },
  },
  other: {
    business: { integrations: ['ms365'] },
    professional: { integrations: ['ms365', 'google-workspace'] },
    enterprise: { integrations: ['ms365', 'google-workspace', 'erp-api'] },
  },
};

export function getCapabilityMatrix(
  group: IndustryGroupSlug,
  tier: TierSlug,
): IndustryCapabilityRow {
  const baseMax: Record<
    TierSlug,
    { agents: number; depts: number; storage: number; stages: number }
  > = {
    basic: { agents: 3, depts: 1, storage: 1, stages: 1 },
    business: { agents: 10, depts: 3, storage: 10, stages: 2 },
    professional: { agents: 50, depts: 10, storage: 100, stages: 3 },
    enterprise: { agents: 9999, depts: 9999, storage: 1000, stages: 4 },
  };

  const base = baseMax[tier];
  const groupSpecific = GROUP_SPECIFIC[group]?.[tier] ?? {};
  const features = TIER_FEATURES[tier];

  // Phase 3: surface the priority-sorted agents so the Plan Impact
  // panel shows the actual provisioning order, not just the
  // group's flat list. Falls back to the original array if no
  // sub-industry priority map exists.
  const primaryIndustry = INDUSTRY_GROUP_INDUSTRIES[group][0];
  const activeAgents = primaryIndustry
    ? resolveDefaultAgentsForIndustry(primaryIndustry)
    : [];

  return {
    maxAgents: base.agents,
    maxDepartments: base.depts,
    maxStorageGB: base.storage,
    maxApprovalStages: base.stages,
    activeAgentSlugs: activeAgents,
    packageTiersAvailable: TIER_PACKAGES[tier],
    projectTypesVisible: TIER_PROJECT_TYPES[tier],
    integrationsAvailable: groupSpecific.integrations ?? [],
    featureFlags: features,
    description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier in ${group}: ${base.agents >= 9999 ? 'unlimited' : base.agents} agents, ${base.depts >= 9999 ? 'unlimited' : base.depts} departments, ${base.storage >= 9999 ? 'unlimited' : base.storage} GB storage, ${base.stages}-stage approvals.`,
  };
}
