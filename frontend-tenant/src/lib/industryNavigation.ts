/**
 * industryNavigation.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §7 — 80/20 navigation principle.
 *
 * 80% of the IconRail is identical across all Industries.
 * Only the Workspace section's "extras" and the Customers section's
 * label/icon change per Industry Group.
 *
 * This file is the SINGLE source of truth for per-group navigation
 * config. The IconRail reads from here at runtime; the
 * `/workspace/[feature]/page.tsx` stub page derives its title +
 * description + plannedPhase from here too. Never duplicate this
 * metadata in component-local maps — that's what caused the
 * INDUSTRY-SETUP-CONCEPT.md §4.5 G6 bug (Agriculture tenants saw
 * "Industrial & Infrastructure" labels for `production`).
 */

export interface RailItem {
  id: string;
  label: string;
  href: string;
  iconName: string; // lucide-react icon name (resolved by IconRail)
  /**
   * Short one-liner describing the module's purpose. Surfaced on the
   * stub page so the tenant sees meaningful copy, not lorem-ipsum.
   * (Phase 1 G6 — was previously a hardcoded map duplicated from here.)
   */
  description: string;
  /**
   * Roadmap marker — shown as a "Planned" pill on the stub page. Allows
   * the page to communicate phase status without re-introducing a parallel
   * status enum. Industry-specific extras legitimately differ in phasing
   * (Financial & Compliance is P0, Agriculture is later), so we surface
   * it directly on the item.
   */
  plannedPhase: string;
  /**
   * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.1 (P3) — sub-industry visibility filter.
   *
   * When set, this item is shown ONLY for tenants whose `industry.slug`
   * is in this list. When omitted, the item shows for ALL tenants in the
   * parent group (default — backward-compatible).
   *
   * Used by the `consumer-commerce` group to hide Products/Orders/Inventory/
   * Stores/Promotions for `media-communications-creative` tenants.
   *
   * Tenant filter happens at render time in IconRail.tsx — this is data,
   * not code (SOLID: OCP).
   */
  subIndustries?: string[];
}

export interface IndustryNavConfig {
  groupSlug: string;
  /** Group label, used by the stub page when an unknown feature is hit. */
  groupLabel: string;
  /** Items appended to the Workspace section. */
  workspaceExtras: RailItem[];
  /**
   * Phase 10.6 (R1-BACKLOG) — sales domain surfaces shown in a dedicated
   * "Sales" rail section. Defaults to the full 5-item set when omitted.
   * Each item is a top-level pipeline surface (deals, leads,
   * opportunities, quotes, emails).
   */
  salesExtras?: RailItem[];
  /** Customers section label override (null = keep default "Customers"). */
  customersLabel: string | null;
  /** Customers section icon override (null = keep default). */
  customersIcon: string | null;
}

/**
 * Phase 10.6 — default Sales rail items. Per-group configs can override
 * via `salesExtras` if a vertical needs different ordering/hiding (e.g.
 * healthcare tenants don't see Quotes). When omitted, this set is used.
 */
export const DEFAULT_SALES_EXTRAS: RailItem[] = [
  { id: 'deals',         label: 'Deals',         href: '/deals',         iconName: 'Handshake',     description: 'Pipeline from Lead to Won with weighted forecast.', plannedPhase: 'Phase 10.6 (shipped)' },
  { id: 'leads',         label: 'Leads',         href: '/leads',         iconName: 'UserPlus',      description: 'Top-of-funnel prospects, source attribution, qualification score.', plannedPhase: 'Phase 11 (planned)' },
  { id: 'opportunities', label: 'Opportunities', href: '/opportunities', iconName: 'Target',        description: 'Qualified deals in motion; mirrors deals with extra qualification metadata.', plannedPhase: 'Phase 11 (planned)' },
  { id: 'quotes',        label: 'Quotes',        href: '/quotes',        iconName: 'FileText',      description: 'Quote → counter-signature lifecycle tied to deals.', plannedPhase: 'Phase 11 (planned)' },
  { id: 'emails',        label: 'Emails',        href: '/emails',        iconName: 'Mail',          description: 'Outreach sequences, replies, meeting-booked signals.', plannedPhase: 'Phase 11 (planned)' },
];

/** Default fallback (when tenant has no industryGroup). */
const FALLBACK: IndustryNavConfig = {
  groupSlug: 'default',
  groupLabel: 'Unknown',
  workspaceExtras: [],
  customersLabel: null,
  customersIcon: null,
};

/** Per-group configuration — first vertical (Financial & Compliance) is fully wired. */
export const INDUSTRY_NAV_CONFIGS: Record<string, IndustryNavConfig> = {
  'financial-compliance': {
    groupSlug: 'financial-compliance',
    groupLabel: 'Financial & Compliance',
    customersLabel: 'Clients & Accounts',
    customersIcon: 'Landmark',
    workspaceExtras: [
      { id: 'engagements',  label: 'Engagements',  href: '/workspace/engagements',  iconName: 'Briefcase',     description: 'Service delivery pipeline, billable hours, retainer status.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'loans',        label: 'Loans',        href: '/workspace/loans',        iconName: 'Landmark',      description: 'Active loans, payment schedule, compliance status.',               plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'portfolios',   label: 'Portfolios',   href: '/workspace/portfolios',   iconName: 'PieChart',      description: 'Holdings dashboard, allocation view, performance tracking.',         plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'audits',       label: 'Audits',       href: '/workspace/audits',       iconName: 'ClipboardCheck',description: 'Audit planning, fieldwork, reporting, follow-up tracking.',          plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'tax',          label: 'Tax',          href: '/workspace/tax',          iconName: 'Receipt',       description: 'Tax filing calendar, return status, e-signature workflow.',          plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'payroll',      label: 'Payroll',      href: '/workspace/payroll',      iconName: 'Wallet',        description: 'Payroll processing, tax withholding, employee compensation.',         plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'compliance',   label: 'Compliance',   href: '/workspace/compliance',   iconName: 'ShieldCheck',   description: 'Compliance frameworks, controls, evidence collection, audit trails, regulatory reporting.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'risk',         label: 'Risk',         href: '/workspace/risk',         iconName: 'AlertTriangle', description: 'Portfolio risk metrics, concentration alerts, correlation analysis.', plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  healthcare: {
    groupSlug: 'healthcare',
    groupLabel: 'Healthcare & Life Sciences',
    customersLabel: 'Patients',
    customersIcon: 'Stethoscope',
    workspaceExtras: [
      { id: 'appointments',     label: 'Appointments',     href: '/workspace/appointments',     iconName: 'Calendar',  description: 'Calendar view, scheduling, no-show tracking.',                plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'medical-records',  label: 'Medical Records',  href: '/workspace/medical-records',  iconName: 'FileText',  description: 'Patient records, attachments, imaging, lab results.',          plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'pharmacy',         label: 'Pharmacy',         href: '/workspace/pharmacy',         iconName: 'Pill',      description: 'Prescription tracking, refill requests, inventory.',           plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'laboratory',       label: 'Laboratory',       href: '/workspace/laboratory',       iconName: 'TestTube',  description: 'Lab results dashboard, abnormality alerts, archiving.',        plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  'public-social': {
    groupSlug: 'public-social',
    groupLabel: 'Public & Social',
    customersLabel: 'Citizens & Beneficiaries',
    customersIcon: 'Users',
    workspaceExtras: [
      { id: 'programs',          label: 'Programs',          href: '/workspace/programs',          iconName: 'FolderKanban', description: 'Program directory, status dashboard, KPI tracker.',                       plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'grants',            label: 'Grants',            href: '/workspace/grants',            iconName: 'DollarSign',   description: 'Grant pipeline, proposal status, funding tracker, reporting calendar.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'field-operations',  label: 'Field Operations',  href: '/workspace/field-operations',  iconName: 'MapPin',       description: 'Field site data, activity logs, beneficiary tracking.',                    plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'cases',             label: 'Cases',             href: '/workspace/cases',             iconName: 'Briefcase',    description: 'Beneficiary case tracking, eligibility status, intervention history.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'licenses',          label: 'Licenses',          href: '/workspace/licenses',          iconName: 'FileBadge',    description: 'License applications, renewals, compliance status.',                      plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'inspections',       label: 'Inspections',       href: '/workspace/inspections',       iconName: 'ClipboardCheck', description: 'Inspection calendar, findings, corrective action, sign-off.',           plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  'business-technology': {
    groupSlug: 'business-technology',
    groupLabel: 'Business & Technology',
    customersLabel: 'Clients',
    customersIcon: 'UserCircle',
    workspaceExtras: [
      { id: 'tickets',     label: 'Tickets',         href: '/workspace/tickets',     iconName: 'Ticket',        description: 'Support ticket queue, severity/SLA, resolution tracking.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'releases',    label: 'Releases',        href: '/workspace/releases',    iconName: 'Rocket',        description: 'Release schedule, features in flight, deployment status.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'contracts',   label: 'Contracts',       href: '/workspace/contracts',   iconName: 'FileSignature', description: 'Contract terms, SLA terms, billing schedule, renewal dates.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'knowledge',   label: 'Knowledge Base',  href: '/workspace/knowledge',   iconName: 'BookOpen',      description: 'Internal documentation, architecture docs, runbooks.',        plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  'industrial-infrastructure': {
    groupSlug: 'industrial-infrastructure',
    groupLabel: 'Industrial & Infrastructure',
    customersLabel: 'Customers & Suppliers',
    customersIcon: 'Truck',
    workspaceExtras: [
      { id: 'sites',       label: 'Sites',       href: '/workspace/sites',       iconName: 'MapPin',   description: 'Project site dashboard, schedule, budget, progress tracking.',  plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'production',  label: 'Production',  href: '/workspace/production',  iconName: 'Factory',  description: 'Production schedule, line status, output tracking, quality metrics.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'work-orders', label: 'Work Orders', href: '/workspace/work-orders', iconName: 'Wrench',   description: 'Maintenance queue, assignment, completion status, cost tracking.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'equipment',   label: 'Equipment',   href: '/workspace/equipment',   iconName: 'Cog',      description: 'Asset inventory, maintenance history, uptime tracking, PM schedule.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'shipments',   label: 'Shipments',   href: '/workspace/shipments',   iconName: 'Package',  description: 'Active shipments, tracking, delivery status, billing.',         plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'fleet',       label: 'Fleet',       href: '/workspace/fleet',       iconName: 'Truck',    description: 'Vehicle inventory, location tracking, maintenance schedule, utilization.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'warehouses',  label: 'Warehouses',  href: '/workspace/warehouses',  iconName: 'Warehouse',description: 'Location inventory, stock levels, receiving schedule, picking queue.', plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  'consumer-commerce': {
    groupSlug: 'consumer-commerce',
    groupLabel: 'Consumer & Commerce',
    customersLabel: 'Customers & Members',
    customersIcon: 'Heart',
    workspaceExtras: [
      // PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.1 (P3): Products/Orders/
      // Inventory/Stores/Promotions are retail-only. Campaigns + Content
      // are shared across both consumer-commerce sub-industries.
      { id: 'products',    label: 'Products',    href: '/workspace/products',    iconName: 'Box',           description: 'Product catalog, inventory levels, pricing, promotion status.',       plannedPhase: 'Phase 2 (placeholder)', subIndustries: ['retail-commerce-consumer'] },
      { id: 'orders',      label: 'Orders',      href: '/workspace/orders',      iconName: 'ShoppingCart',  description: 'Order pipeline, fulfillment status, returns tracking, customer service.', plannedPhase: 'Phase 2 (placeholder)', subIndustries: ['retail-commerce-consumer'] },
      { id: 'inventory',   label: 'Inventory',   href: '/workspace/inventory',   iconName: 'Package',       description: 'Stock levels, reorder points, supplier performance, inventory turnover.', plannedPhase: 'Phase 2 (placeholder)', subIndustries: ['retail-commerce-consumer'] },
      { id: 'stores',      label: 'Stores',      href: '/workspace/stores',      iconName: 'Store',         description: 'Store performance dashboard, sales by store, inventory by location.', plannedPhase: 'Phase 2 (placeholder)', subIndustries: ['retail-commerce-consumer'] },
      { id: 'promotions',  label: 'Promotions',  href: '/workspace/promotions',  iconName: 'Tag',           description: 'Active promotions, discount tracking, ROI analysis, campaign calendar.', plannedPhase: 'Phase 2 (placeholder)', subIndustries: ['retail-commerce-consumer'] },
      { id: 'campaigns',   label: 'Campaigns',   href: '/workspace/campaigns',   iconName: 'Megaphone',     description: 'Marketing campaigns, audience targeting, performance, budget tracking.', plannedPhase: 'Phase 2 (placeholder)' },
      { id: 'content',     label: 'Content',     href: '/workspace/content',     iconName: 'FileEdit',      description: 'Content calendar, production schedule, publishing pipeline, performance.', plannedPhase: 'Phase 2 (placeholder)' },
    ],
  },

  'agriculture-food': {
    groupSlug: 'agriculture-food',
    groupLabel: 'Agriculture & Food',
    customersLabel: 'Buyers & Suppliers',
    customersIcon: 'Tractor',
    workspaceExtras: [
      { id: 'farms',      label: 'Farms',      href: '/workspace/farms',      iconName: 'Map',        description: 'Farm directory, crop planning, soil conditions, yield tracking.', plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'fields',     label: 'Fields',     href: '/workspace/fields',     iconName: 'LayoutGrid', description: 'Field directory, crop inventory, soil conditions, yield tracking.', plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'livestock',  label: 'Livestock',  href: '/workspace/livestock',  iconName: 'Beef',       description: 'Herd management, health records, breeding program, production tracking.', plannedPhase: 'Stage 3 (not yet scheduled)' },
      // SRP: `production` and `inventory` are reused ids across multiple
      // industry groups (Industrial & Infrastructure also has them). The
      // duplicate id only exists as workspaceExtras entries in different
      // group configs; the runtime IconRail uses each group's own copy.
      // No collision because `RailCustomizeModal` and `IconRail` look items
      // up by id within a single tenant's resolved group, not globally.
      { id: 'production', label: 'Production', href: '/workspace/production', iconName: 'Factory',    description: 'Processing schedule, batch tracking, inventory, quality control.', plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'inventory',  label: 'Inventory',  href: '/workspace/inventory',  iconName: 'Package',    description: 'Seed, fertilizer, and yield stock; reorder points and supplier performance.', plannedPhase: 'Stage 3 (not yet scheduled)' },
    ],
  },

  other: {
    groupSlug: 'other',
    groupLabel: 'Other',
    customersLabel: 'Organizations',
    customersIcon: 'Users',
    workspaceExtras: [
      { id: 'operations', label: 'Operations',      href: '/workspace/operations', iconName: 'Activity',   description: 'Inter-entity coordination, shared services, efficiency tracking.',  plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'assets',     label: 'Assets',          href: '/workspace/assets',     iconName: 'Briefcase',  description: 'Asset inventory, portfolio oversight, performance tracking.',         plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'documents',  label: 'Documents',       href: '/workspace/documents',  iconName: 'FileText',   description: 'Document library, indexing, versioning, governance records.',        plannedPhase: 'Stage 3 (not yet scheduled)' },
      { id: 'custom',     label: 'Custom Modules',  href: '/workspace/custom',     iconName: 'PlusSquare', description: 'Custom industry modules and extensions.',                            plannedPhase: 'Stage 3 (not yet scheduled)' },
    ],
  },
};

/**
 * Resolve the nav config for a given industry group slug.
 * Returns the FALLBACK config if the slug is unknown.
 */
export function getIndustryNavConfig(groupSlug: string | null | undefined): IndustryNavConfig {
  if (!groupSlug) return FALLBACK;
  return INDUSTRY_NAV_CONFIGS[groupSlug] ?? FALLBACK;
}
