/**
 * Industry Dashboard Registry
 *
 * Stage 2 Phase 2A: KPI widget packs per industry group.
 *
 * Each industry group defines its own KPI layout, chart widgets,
 * and list widgets. The DashboardRenderer reads the matching template
 * and renders the appropriate widgets.
 *
 * SOLID: OCP — new industry group = add entry to this registry.
 * Zero changes to the DashboardRenderer.
 */

import type { StatusColor } from '@/types/ui.types';
import { INDUSTRY_GROUP } from '@/lib/industryGroups';

export interface KpiWidgetDef {
  metric: string;
  label: string;
  color: StatusColor;
  target?: number;
  format?: 'number' | 'currency' | 'percent';
  inverse?: boolean;
}

export interface ChartWidgetDef {
  type: 'line' | 'bar' | 'pie' | 'area';
  metric: string;
  label: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface ListWidgetDef {
  type: string;
  label: string;
  maxItems: number;
}

export interface DashboardTemplate {
  groupSlug: string;
  kpiWidgets: KpiWidgetDef[];
  chartWidgets: ChartWidgetDef[];
  listWidgets: ListWidgetDef[];
  defaultTimeRange: string;
  /** Phase 2D: Specialized secondary KPIs (risk analytics, SLA monitoring, etc.) */
  phase2dKpiWidgets?: KpiWidgetDef[];
  /** Phase 2D: Specialized secondary charts */
  phase2dChartWidgets?: ChartWidgetDef[];
  /** Phase 2D: Specialized secondary list widgets */
  phase2dListWidgets?: ListWidgetDef[];
}

export const INDUSTRY_DASHBOARDS: Record<string, DashboardTemplate> = {

  // ─── Financial & Compliance ──────────────────────────────────────────
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: {
    groupSlug: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
    kpiWidgets: [
      { metric: 'totalClients', label: 'Total Clients', color: 'neutral' },
      { metric: 'complianceScore', label: 'Compliance Score', color: 'profit', target: 95, format: 'percent' },
      { metric: 'pipelineValue', label: 'Pipeline Value', format: 'currency', color: 'neutral' },
      { metric: 'activeEngagements', label: 'Active Engagements', color: 'ops' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'revenueTrend', label: 'Revenue Trend', period: 'monthly' },
      { type: 'bar', metric: 'engagementByType', label: 'Engagements by Type' },
    ],
    listWidgets: [
      { type: 'approvals', label: 'Pending Approvals', maxItems: 5 },
      { type: 'deadlines', label: 'Upcoming Deadlines', maxItems: 5 },
    ],
    defaultTimeRange: '30d',
    phase2dKpiWidgets: [
      { metric: 'riskScore', label: 'Risk Score', color: 'risk', target: 80, format: 'percent' },
      { metric: 'kycVerificationRate', label: 'KYC Verification Rate', color: 'profit', target: 98, format: 'percent' },
      { metric: 'fraudAlerts', label: 'Fraud Alerts (30d)', color: 'warn', inverse: true },
      { metric: 'regulatoryFindings', label: 'Open Regulatory Findings', color: 'risk', inverse: true },
    ],
    phase2dChartWidgets: [
      { type: 'area', metric: 'riskExposureTrend', label: 'Risk Exposure Trend', period: 'monthly' },
      { type: 'bar', metric: 'kycByClientType', label: 'KYC Status by Client Type' },
    ],
    phase2dListWidgets: [
      { type: 'highRiskClients', label: 'High-Risk Clients', maxItems: 5 },
      { type: 'idVerifications', label: 'Pending ID Verifications', maxItems: 5 },
    ],
  },

  // ─── Healthcare & Life Sciences ──────────────────────────────────────
  'healthcare': {
    groupSlug: 'healthcare',
    kpiWidgets: [
      { metric: 'totalPatients', label: 'Total Patients', color: 'neutral' },
      { metric: 'appointmentsToday', label: "Today's Appointments", color: 'profit' },
      { metric: 'noShowRate', label: 'No-Show Rate', format: 'percent', target: 10, inverse: true, color: 'risk' },
      { metric: 'bedOccupancy', label: 'Bed Occupancy', format: 'percent', color: 'warn' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'patientVolume', label: 'Patient Volume', period: 'monthly' },
      { type: 'bar', metric: 'visitType', label: 'Visits by Type' },
    ],
    listWidgets: [
      { type: 'appointments', label: "Today's Appointments", maxItems: 10 },
      { type: 'abnormalResults', label: 'Abnormal Lab Results', maxItems: 5 },
    ],
    defaultTimeRange: '7d',
    phase2dKpiWidgets: [
      { metric: 'noShowPrediction', label: 'No-Show Prediction (Next 7d)', color: 'warn', format: 'percent' },
      { metric: 'avgWaitTime', label: 'Avg Patient Wait Time', color: 'ops', target: 15 },
      { metric: 'hipaaCompliance', label: 'HIPAA Compliance', color: 'profit', target: 100, format: 'percent' },
      { metric: 'clinicalOutcomes', label: 'Clinical Outcomes Score', color: 'strategy', target: 90, format: 'percent' },
    ],
    phase2dChartWidgets: [
      { type: 'line', metric: 'waitTimeTrend', label: 'Wait Time Trend', period: 'weekly' },
      { type: 'area', metric: 'noShowPredictionTrend', label: 'No-Show Prediction Trend', period: 'monthly' },
    ],
    phase2dListWidgets: [
      { type: 'pendingReferrals', label: 'Pending Specialist Referrals', maxItems: 5 },
      { type: 'medicationReviews', label: 'Medication Reviews Due', maxItems: 5 },
    ],
  },

  // ─── Business & Technology ───────────────────────────────────────────
  'business-technology': {
    groupSlug: 'business-technology',
    kpiWidgets: [
      { metric: 'activeProjects', label: 'Active Projects', color: 'neutral' },
      { metric: 'slaCompliance', label: 'SLA Compliance', format: 'percent', target: 95, color: 'profit' },
      { metric: 'ticketResolution', label: 'Avg Resolution Time', format: 'number', color: 'ops' },
      { metric: 'revenueMRR', label: 'MRR', format: 'currency', color: 'strategy' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'ticketVolume', label: 'Ticket Volume', period: 'weekly' },
      { type: 'pie', metric: 'projectType', label: 'Projects by Type' },
    ],
    listWidgets: [
      { type: 'escalations', label: 'Open Escalations', maxItems: 5 },
      { type: 'deployments', label: 'Recent Deployments', maxItems: 5 },
    ],
    defaultTimeRange: '7d',
    phase2dKpiWidgets: [
      { metric: 'slaBreachRisk', label: 'SLA Breach Risk', color: 'risk', format: 'percent', inverse: true },
      { metric: 'ticketAutoTriageRate', label: 'Auto-Triage Rate', color: 'profit', target: 80, format: 'percent' },
      { metric: 'engagementProfitMargin', label: 'Engagement Profit Margin', color: 'strategy', target: 30, format: 'percent' },
      { metric: 'deploymentFrequency', label: 'Deployments/Week', color: 'ops' },
    ],
    phase2dChartWidgets: [
      { type: 'line', metric: 'slaTrendPerClient', label: 'SLA Trend by Client', period: 'weekly' },
      { type: 'bar', metric: 'autoTriageVsManual', label: 'Auto-Triage vs Manual Resolution' },
    ],
    phase2dListWidgets: [
      { type: 'slaAtRisk', label: 'Clients at SLA Risk', maxItems: 5 },
      { type: 'agingTickets', label: 'Aging Tickets (>48h)', maxItems: 5 },
    ],
  },

  // ─── Consumer & Commerce ─────────────────────────────────────────────
  'consumer-commerce': {
    groupSlug: 'consumer-commerce',
    kpiWidgets: [
      { metric: 'dailyRevenue', label: 'Daily Revenue', format: 'currency', color: 'profit' },
      { metric: 'ordersToday', label: 'Orders Today', color: 'neutral' },
      { metric: 'inventoryAccuracy', label: 'Inventory Accuracy', format: 'percent', target: 95, color: 'ops' },
      { metric: 'campaignROI', label: 'Campaign ROI', format: 'percent', color: 'strategy' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'revenueTrend', label: 'Revenue Trend', period: 'daily' },
      { type: 'bar', metric: 'categoryPerformance', label: 'Sales by Category' },
    ],
    listWidgets: [
      { type: 'lowStock', label: 'Low Stock Alerts', maxItems: 5 },
      { type: 'pendingRefunds', label: 'Pending Refunds', maxItems: 5 },
    ],
    defaultTimeRange: '24h',
    phase2dKpiWidgets: [
      { metric: 'inventoryTurnover', label: 'Inventory Turnover Rate', color: 'ops', target: 8 },
      { metric: 'orderFulfillmentTime', label: 'Avg Fulfillment Time', color: 'warn', inverse: true },
      { metric: 'campaignConversionRate', label: 'Campaign Conversion', color: 'profit', target: 5, format: 'percent' },
      { metric: 'customerLTV', label: 'Avg Customer LTV', format: 'currency', color: 'strategy' },
    ],
    phase2dChartWidgets: [
      { type: 'area', metric: 'inventoryLevelTrend', label: 'Inventory Level Trend', period: 'weekly' },
      { type: 'bar', metric: 'campaignPerformance', label: 'Campaign Performance by Channel' },
    ],
    phase2dListWidgets: [
      { type: 'fulfillmentDelays', label: 'Fulfillment Delays', maxItems: 5 },
      { type: 'topCampaigns', label: 'Top Performing Campaigns', maxItems: 5 },
    ],
  },

  // ─── Industrial & Infrastructure ─────────────────────────────────────
  'industrial-infrastructure': {
    groupSlug: 'industrial-infrastructure',
    kpiWidgets: [
      { metric: 'productionOutput', label: 'Production Output', color: 'neutral' },
      { metric: 'safetyIncidents', label: 'Safety Incidents (MTD)', color: 'risk', inverse: true },
      { metric: 'equipmentUptime', label: 'Equipment Uptime', format: 'percent', target: 95, color: 'profit' },
      { metric: 'workOrdersOpen', label: 'Open Work Orders', color: 'warn' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'productionTrend', label: 'Production Trend', period: 'weekly' },
      { type: 'bar', metric: 'downtimeByReason', label: 'Downtime by Reason' },
    ],
    listWidgets: [
      { type: 'maintenanceDue', label: 'Maintenance Due', maxItems: 5 },
      { type: 'safetyAlerts', label: 'Safety Alerts', maxItems: 5 },
    ],
    defaultTimeRange: '7d',
    phase2dKpiWidgets: [
      { metric: 'OEE', label: 'Overall Equipment Effectiveness', color: 'profit', target: 85, format: 'percent' },
      { metric: 'maintenanceCompliance', label: 'PM Compliance', color: 'ops', target: 95, format: 'percent' },
      { metric: 'downtimeHours', label: 'Downtime Hours (MTD)', color: 'risk', inverse: true },
      { metric: 'workOrderBacklog', label: 'Work Order Backlog', color: 'warn' },
    ],
    phase2dChartWidgets: [
      { type: 'line', metric: 'OEETrend', label: 'OEE Trend', period: 'weekly' },
      { type: 'bar', metric: 'maintenanceByEquipment', label: 'Maintenance by Equipment' },
    ],
    phase2dListWidgets: [
      { type: 'automatedWorkOrders', label: 'Auto-Generated Work Orders', maxItems: 5 },
      { type: 'maintenanceSchedule', label: 'Upcoming Maintenance', maxItems: 5 },
    ],
  },

  // ─── Public & Social ─────────────────────────────────────────────────
  'public-social': {
    groupSlug: 'public-social',
    kpiWidgets: [
      { metric: 'activeCases', label: 'Active Cases', color: 'neutral' },
      { metric: 'grantsAwarded', label: 'Grants Awarded', format: 'currency', color: 'profit' },
      { metric: 'volunteerHours', label: 'Volunteer Hours', color: 'ops' },
      { metric: 'programCompletion', label: 'Program Completion', format: 'percent', target: 90, color: 'strategy' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'caseVolume', label: 'Case Volume', period: 'monthly' },
      { type: 'pie', metric: 'fundingSource', label: 'Funding by Source' },
    ],
    listWidgets: [
      { type: 'grantDeadlines', label: 'Grant Deadlines', maxItems: 5 },
      { type: 'pendingApprovals', label: 'Pending Approvals', maxItems: 5 },
    ],
    defaultTimeRange: '30d',
    phase2dKpiWidgets: [
      { metric: 'grantUtilizationRate', label: 'Grant Utilization Rate', color: 'profit', target: 90, format: 'percent' },
      { metric: 'volunteerRetention', label: 'Volunteer Retention Rate', color: 'ops', target: 80, format: 'percent' },
      { metric: 'caseResolutionTime', label: 'Avg Case Resolution', color: 'warn', target: 14 },
      { metric: 'beneficiariesServed', label: 'Beneficiaries Served', color: 'strategy' },
    ],
    phase2dChartWidgets: [
      { type: 'bar', metric: 'grantVsActual', label: 'Grant Budget vs Actual Spend' },
      { type: 'line', metric: 'volunteerTrend', label: 'Volunteer Engagement Trend', period: 'monthly' },
    ],
    phase2dListWidgets: [
      { type: 'caseWorkflows', label: 'Active Case Workflows', maxItems: 5 },
      { type: 'volunteerAssignments', label: 'Volunteer Assignments', maxItems: 5 },
    ],
  },

  // ─── Agriculture & Food ──────────────────────────────────────────────
  'agriculture-food': {
    groupSlug: 'agriculture-food',
    kpiWidgets: [
      { metric: 'cropYield', label: 'Crop Yield (Est.)', color: 'neutral' },
      { metric: 'livestockCount', label: 'Livestock Count', color: 'ops' },
      { metric: 'qualityPassRate', label: 'Quality Pass Rate', format: 'percent', target: 95, color: 'profit' },
      { metric: 'waterUsage', label: 'Water Usage (gal)', color: 'warn' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'yieldTrend', label: 'Yield Trend', period: 'monthly' },
      { type: 'bar', metric: 'productDistribution', label: 'Distribution by Product' },
    ],
    listWidgets: [
      { type: 'inspectionDue', label: 'Inspections Due', maxItems: 5 },
      { type: 'harvestSchedule', label: 'Harvest Schedule', maxItems: 5 },
    ],
    defaultTimeRange: '30d',
    phase2dKpiWidgets: [
      { metric: 'yieldProjection', label: 'Yield Projection (Next Season)', color: 'strategy', format: 'percent' },
      { metric: 'qualityRejectionRate', label: 'Quality Rejection Rate', color: 'risk', inverse: true, format: 'percent' },
      { metric: 'distributionEfficiency', label: 'Distribution Efficiency', color: 'ops', target: 95, format: 'percent' },
      { metric: 'inputCostPerAcre', label: 'Input Cost / Acre', format: 'currency', color: 'warn' },
    ],
    phase2dChartWidgets: [
      { type: 'area', metric: 'cropPlanningProjection', label: 'Crop Planning Projection', period: 'monthly' },
      { type: 'bar', metric: 'qualityByBatch', label: 'Quality Pass Rate by Batch' },
    ],
    phase2dListWidgets: [
      { type: 'plannedCrops', label: 'Crop Planning Schedule', maxItems: 5 },
      { type: 'distributionOrders', label: 'Pending Distribution Orders', maxItems: 5 },
    ],
  },

  // ─── Other ────────────────────────────────────────────────────────────
  'other': {
    groupSlug: 'other',
    kpiWidgets: [
      { metric: 'totalEntities', label: 'Entities', color: 'neutral' },
      { metric: 'portfolioValue', label: 'Portfolio Value', format: 'currency', color: 'profit' },
      { metric: 'activeProjects', label: 'Active Projects', color: 'ops' },
      { metric: 'governanceScore', label: 'Governance Score', format: 'percent', target: 90, color: 'strategy' },
    ],
    chartWidgets: [
      { type: 'line', metric: 'portfolioTrend', label: 'Portfolio Trend', period: 'monthly' },
      { type: 'pie', metric: 'entityType', label: 'Holdings by Type' },
    ],
    listWidgets: [
      { type: 'complianceTasks', label: 'Compliance Tasks', maxItems: 5 },
      { type: 'boardMeetings', label: 'Upcoming Board Meetings', maxItems: 5 },
    ],
    defaultTimeRange: '30d',
    phase2dKpiWidgets: [
      { metric: 'portfolioDiversification', label: 'Portfolio Diversification Index', color: 'strategy', target: 80, format: 'percent' },
      { metric: 'entityPerformance', label: 'Entity Performance Score', color: 'profit', target: 85, format: 'percent' },
      { metric: 'governanceCompliance', label: 'Governance Compliance', color: 'ops', target: 100, format: 'percent' },
      { metric: 'consolidatedCashFlow', label: 'Consolidated Cash Flow', format: 'currency', color: 'warn' },
    ],
    phase2dChartWidgets: [
      { type: 'area', metric: 'consolidatedPerformance', label: 'Consolidated Performance Trend', period: 'monthly' },
      { type: 'pie', metric: 'assetAllocation', label: 'Asset Allocation Breakdown' },
    ],
    phase2dListWidgets: [
      { type: 'governanceTasks', label: 'Governance Action Items', maxItems: 5 },
      { type: 'entityUpdates', label: 'Entity Performance Updates', maxItems: 5 },
    ],
  },
};

export function getDashboardTemplate(groupSlug: string): DashboardTemplate | undefined {
  return INDUSTRY_DASHBOARDS[groupSlug];
}

export function getDefaultDashboardTemplate(): DashboardTemplate {
  return INDUSTRY_DASHBOARDS['other'];
}
