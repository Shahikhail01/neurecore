/**
 * Financial & Compliance widget definitions — Phase 7 G2.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.6 / IMPLEMENTATION-PLAN Phase 7.
 *
 * 4 F&C-specific KPI widgets keyed off the canonical WidgetDefinition
 * 4-layer schema (see widgets/widget-definition.ts). Each widget carries
 * an `industryGroup: 'financial-compliance'` field so WidgetRegistry
 * filters them out for tenants outside the F&C group at registration
 * time. The retail widget set follows the same pattern — see
 * retail/retail-widgets.ts for comparison.
 *
 * Each widget ID is prefixed `fc-kpi:` so they sort with the F&C pack
 * and never collide with the 12 built-in widgets or the 6 retail
 * widgets. IDs are stable — used in dashboard layout persistence, so
 * renaming them breaks saved dashboards (a deliberate break-on-rename
 * contract, like CRM module IDs).
 *
 * SOLID:
 *   - SRP — this file only owns the *definition* of F&C widgets. Runtime
 *     computation lives in the widgets aggregation engine.
 *   - OCP — new F&C widgets can be added without modifying the engine.
 *   - ISP — each widget exposes only the data + visualization it needs.
 */
import type { WidgetDefinition } from '../widgets/widget-definition';
import { INDUSTRY_GROUP } from '../industry/tier-industry-matrix';

/**
 * Audit engagement completion rate — % of active audit engagements
 * that hit a COMPLETED status in the trailing 90 days. Output is a GAUGE.
 * Computed as COUNT(stage_transitions WHERE status='COMPLETED' AND
 * stage_type='AUDIT') / COUNT(engagements WHERE type='audit').
 */
export const AUDIT_COMPLETION_RATE: WidgetDefinition = {
  id: 'fc-kpi:audit-completion-rate',
  capability: 'COMPLIANCE_STATUS',
  capabilityDomain: 'compliance',
  dataSources: [
    { entity: 'PROJECT', field: 'type' },
    { entity: 'PROJECT', field: 'status' },
  ],
  aggregationType: 'PERCENTAGE',
  computation: 'fcAuditCompletionRate',
  visualizations: ['GAUGE', 'SPARKLINE'],
  defaultVisualization: 'GAUGE',
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  defaultSize: { w: 3, h: 2 },
  configurableFields: [
    {
      key: 'days',
      label: 'Period',
      type: 'select',
      defaultValue: '90d',
      options: [
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
        { value: '365d', label: 'Last 365 days' },
      ],
    },
  ],
  refreshInterval: 300_000,
  title: 'Audit Completion Rate',
  subtitle: '% of audit engagements completed in period',
  icon: 'clipboard-check',
  entityTypes: ['PROJECT'],
  category: 'INDUSTRY_SPECIFIC',
  industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
};

/**
 * KYC verification rate — % of active customers with KYC status =
 * VERIFIED (not PENDING / EXPIRED / REJECTED). Output is a GAUGE.
 * Computed as COUNT(customers WHERE kycStatus='VERIFIED' AND status='ACTIVE')
 * / COUNT(customers WHERE status='ACTIVE').
 */
export const KYC_VERIFICATION_RATE: WidgetDefinition = {
  id: 'fc-kpi:kyc-verification-rate',
  capability: 'COMPLIANCE_STATUS',
  capabilityDomain: 'compliance',
  dataSources: [
    { entity: 'CUSTOMER', field: 'kycStatus' },
    { entity: 'CUSTOMER', field: 'status' },
  ],
  aggregationType: 'PERCENTAGE',
  computation: 'fcKycVerificationRate',
  visualizations: ['GAUGE', 'SPARKLINE'],
  defaultVisualization: 'GAUGE',
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  defaultSize: { w: 3, h: 2 },
  configurableFields: [],
  refreshInterval: 600_000,
  title: 'KYC Verification Rate',
  subtitle: '% of active customers with verified KYC',
  icon: 'shield-check',
  entityTypes: ['CUSTOMER'],
  category: 'INDUSTRY_SPECIFIC',
  industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
};

/**
 * High-risk customer exposure — count of active customers with
 * riskRating IN ('HIGH', 'CRITICAL'). Output is a CARD with a count.
 * Alert-style widget: the count drives immediate action (enhanced
 * due diligence).
 */
export const HIGH_RISK_CUSTOMER_EXPOSURE: WidgetDefinition = {
  id: 'fc-kpi:high-risk-customer-exposure',
  capability: 'RISK_POSTURE',
  capabilityDomain: 'risk',
  dataSources: [
    { entity: 'CUSTOMER', field: 'riskRating' },
    { entity: 'CUSTOMER', field: 'status' },
  ],
  aggregationType: 'COUNT',
  computation: 'fcHighRiskCustomerCount',
  visualizations: ['CARD', 'SPARKLINE'],
  defaultVisualization: 'CARD',
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  defaultSize: { w: 2, h: 2 },
  configurableFields: [
    {
      key: 'riskThreshold',
      label: 'Minimum risk rating',
      type: 'select',
      defaultValue: 'HIGH',
      options: [
        { value: 'CRITICAL', label: 'Critical only' },
        { value: 'HIGH', label: 'High + Critical' },
        { value: 'MEDIUM', label: 'Medium + High + Critical' },
      ],
    },
  ],
  refreshInterval: 600_000,
  title: 'High-Risk Customer Exposure',
  subtitle: 'Active customers rated HIGH or CRITICAL',
  icon: 'alert-triangle',
  entityTypes: ['CUSTOMER'],
  category: 'INDUSTRY_SPECIFIC',
  industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
};

/**
 * Tax filing calendar — count of tax filings due in next 30 days that
 * are not yet COMPLETED. Output is a CARD with a count + sparkline.
 * Drives the F&C "tax filing due" notification template.
 */
export const TAX_FILING_CALENDAR: WidgetDefinition = {
  id: 'fc-kpi:tax-filing-calendar',
  capability: 'COMPLIANCE_STATUS',
  capabilityDomain: 'compliance',
  dataSources: [
    { entity: 'PROJECT', field: 'type' },
    { entity: 'PROJECT', field: 'status' },
  ],
  aggregationType: 'COUNT',
  computation: 'fcTaxFilingsDueIn30d',
  visualizations: ['CARD', 'SPARKLINE'],
  defaultVisualization: 'CARD',
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  defaultSize: { w: 2, h: 2 },
  configurableFields: [
    {
      key: 'days',
      label: 'Look-ahead window',
      type: 'select',
      defaultValue: '30d',
      options: [
        { value: '7d', label: 'Next 7 days' },
        { value: '30d', label: 'Next 30 days' },
        { value: '90d', label: 'Next 90 days' },
      ],
    },
  ],
  refreshInterval: 600_000,
  title: 'Tax Filings Due',
  subtitle: 'Tax filings due in selected window',
  icon: 'calendar',
  entityTypes: ['PROJECT'],
  category: 'INDUSTRY_SPECIFIC',
  industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
};

/**
 * All F&C widgets bundled for one-shot registration. Consumers should
 * register this via WidgetRegistry.registerAll(FC_WIDGETS) — keeps
 * adding a new F&C widget to a single-file change.
 */
export const FC_WIDGETS: WidgetDefinition[] = [
  AUDIT_COMPLETION_RATE,
  KYC_VERIFICATION_RATE,
  HIGH_RISK_CUSTOMER_EXPOSURE,
  TAX_FILING_CALENDAR,
];
