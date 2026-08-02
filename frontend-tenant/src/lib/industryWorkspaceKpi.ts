/**
 * industryWorkspaceKpi.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.2.2 (Phase 2.B step 2.B.6) —
 * Industry-specific KPI definitions for the 8 shared F&C workspace modules
 * (loans, portfolios, audits, compliance, risk, engagements, tax, payroll).
 *
 * The workspace components (loans, portfolios, etc.) call `getKpiConfigForTenant(tenant)`
 * to retrieve the KPI cards, metrics, and copy appropriate for the tenant's
 * `industry.slug`. Accounting tenants get accounting KPIs; financial-services
 * tenants get banking/insurance/wealth KPIs.
 *
 * Adding a new F&C Industry = add one entry to `INDUSTRY_KPI_CONFIGS`.
 * Adding a new workspace module = add a KPI config to each entry.
 *
 * SOLID: OCP — every Industry's KPI config is data; no `if (industry === ...)`
 * branches in components.
 */

import type { IndustryGroupSlug } from './industryGroups';

export interface WorkspaceKpiCard {
  /** Stable key — used as React list key. */
  id: string;
  /** Metric name (matches backend aggregation key). */
  metric: string;
  /** Display label. */
  label: string;
  /** Optional target/comparison value. */
  target?: number;
  /** Optional unit suffix. */
  unit?: string;
}

export interface WorkspaceKpiConfig {
  /** Module id matching INDUSTRY_NAV_CONFIGS[*].workspaceExtras[*].id */
  moduleId: string;
  /** Cards rendered on the module page. */
  cards: WorkspaceKpiCard[];
  /** One-line description (for tooltips). */
  description: string;
}

export interface IndustryKpiConfig {
  /** Industry slug (matches Tenant.industry). */
  industrySlug: string;
  /** Group label for fall-back / dashboards. */
  groupSlug: IndustryGroupSlug;
  /** Workspace KPIs for every module this Industry uses. */
  modules: WorkspaceKpiConfig[];
}

/**
 * KPI configurations keyed by industrySlug.
 * Only F&C Industries are filled in (accounting + financial-services).
 * Other kept Industries share their group nav config but their workspace
 * modules are built in Phase 3+ per the plan.
 */
export const INDUSTRY_KPI_CONFIGS: Record<string, IndustryKpiConfig> = {
  'accounting-audit-services': {
    industrySlug: 'accounting-audit-services',
    groupSlug: 'financial-compliance',
    modules: [
      {
        moduleId: 'loans',
        description: 'Active loans, payment schedule, compliance status (accounting view).',
        cards: [
          { id: 'a-loans-outstanding', metric: 'loans.outstanding.balance', label: 'Client loans outstanding', unit: 'USD' },
          { id: 'a-loans-delinquent',  metric: 'loans.delinquent.count',     label: 'Delinquent loans',         unit: 'loans' },
          { id: 'a-loans-yield',       metric: 'loans.portfolio.yield',      label: 'Avg portfolio yield',      unit: '%' },
        ],
      },
      {
        moduleId: 'portfolios',
        description: 'Holdings dashboard, allocation view, performance tracking.',
        cards: [
          { id: 'a-port-aum', metric: 'portfolios.aum',     label: 'Client AUM under advisory', unit: 'USD' },
          { id: 'a-port-mix', metric: 'portfolios.equityPct', label: 'Avg equity allocation',   unit: '%' },
        ],
      },
      {
        moduleId: 'audits',
        description: 'Audit engagement pipeline.',
        cards: [
          { id: 'a-aud-active',   metric: 'audits.active.count',   label: 'Active engagements' },
          { id: 'a-aud-overdue',  metric: 'audits.overdue.count',  label: 'Overdue fieldwork' },
          { id: 'a-aud-rate',     metric: 'audits.completion.rate', label: '90-day completion rate', unit: '%' },
        ],
      },
      {
        moduleId: 'compliance',
        description: 'Compliance frameworks, controls, evidence collection.',
        cards: [
          { id: 'a-cmp-controls', metric: 'compliance.controls.coverage', label: 'Controls with current evidence', unit: '%' },
          { id: 'a-cmp-overdue',  metric: 'compliance.tasks.overdue',      label: 'Overdue compliance tasks' },
        ],
      },
      {
        moduleId: 'risk',
        description: 'Client risk rating distribution.',
        cards: [
          { id: 'a-risk-high', metric: 'customers.riskRating.high.count', label: 'High-risk clients' },
          { id: 'a-risk-med',  metric: 'customers.riskRating.med.count',  label: 'Medium-risk clients' },
        ],
      },
    ],
  },

  'financial-services': {
    industrySlug: 'financial-services',
    groupSlug: 'financial-compliance',
    modules: [
      {
        moduleId: 'loans',
        description: 'Active loans, payment schedule, compliance status (banking view).',
        cards: [
          { id: 'fs-loans-portfolio', metric: 'loans.outstanding.balance', label: 'Loans portfolio balance', unit: 'USD' },
          { id: 'fs-loans-delinq',    metric: 'loans.delinquent.count',     label: 'Delinquent loans',        unit: 'loans' },
          { id: 'fs-loans-net-charge',metric: 'loans.netChargeOff.rate',   label: 'Net charge-off rate',     unit: '%' },
        ],
      },
      {
        moduleId: 'portfolios',
        description: 'Holdings dashboard, allocation view, performance tracking.',
        cards: [
          { id: 'fs-port-aum',   metric: 'portfolios.aum',      label: 'AUM under management',     unit: 'USD' },
          { id: 'fs-port-ytd',   metric: 'portfolios.ytdReturn', label: 'YTD portfolio return',   unit: '%' },
          { id: 'fs-port-accts', metric: 'portfolios.accountCount', label: 'Active wealth accounts' },
        ],
      },
      {
        moduleId: 'audits',
        description: 'Regulatory exam preparation + audit engagement pipeline.',
        cards: [
          { id: 'fs-aud-exams',   metric: 'audits.regulatory.upcoming',  label: 'Upcoming regulatory exams' },
          { id: 'fs-aud-kyc-q',   metric: 'audits.kycBacklog',           label: 'KYC backlog',                unit: 'cases' },
          { id: 'fs-aud-sar',     metric: 'audits.sarFiled',             label: 'SARs filed (YTD)' },
        ],
      },
      {
        moduleId: 'compliance',
        description: 'KYC/AML, regulatory reporting, internal audit.',
        cards: [
          { id: 'fs-cmp-kyc', metric: 'compliance.kyc.current',     label: 'Customers with current KYC', unit: '%' },
          { id: 'fs-cmp-aml', metric: 'compliance.aml.alerts.open', label: 'Open AML alerts' },
        ],
      },
      {
        moduleId: 'risk',
        description: 'Portfolio risk metrics, concentration alerts.',
        cards: [
          { id: 'fs-risk-var',  metric: 'risk.var.95',       label: 'VaR (95%)',       unit: 'USD' },
          { id: 'fs-risk-conc', metric: 'risk.concentration', label: 'Top-10 concentration', unit: '%' },
        ],
      },
    ],
  },

  // ─── Other kept Industries will add entries in their respective Phases ─────
};

/**
 * Resolve KPI config for a tenant. Returns null if no config exists for the
 * tenant's industry — components fall back to no KPI cards (no error).
 *
 * @param industrySlug Tenant.industry.slug
 * @param moduleId     moduleId from INDUSTRY_NAV_CONFIGS
 */
export function getWorkspaceKpiConfig(industrySlug: string | null | undefined, moduleId: string): WorkspaceKpiConfig | null {
  if (!industrySlug) return null;
  const config = INDUSTRY_KPI_CONFIGS[industrySlug];
  if (!config) return null;
  return config.modules.find((m) => m.moduleId === moduleId) ?? null;
}

/**
 * Group slug for an industry slug. Used for dashboards that need a fallback
 * to the group nav config when no per-Industry KPI config exists.
 */
export function getIndustryKpiGroupSlug(industrySlug: string | null | undefined): IndustryGroupSlug | null {
  if (!industrySlug) return null;
  return INDUSTRY_KPI_CONFIGS[industrySlug]?.groupSlug ?? null;
}