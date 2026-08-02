/**
 * Industry Workflow Definitions
 *
 * Stage 2 Phase 2D: Per-industry automated workflow/automation templates.
 *
 * Each industry group defines automated workflow templates that can
 * be configured and activated by tenants. These represent the automated
 * actions described in Phase 2D:
 * - KYC verification workflows, risk analytics
 * - Ticket auto-triage, SLA monitoring
 * - Work order automation, maintenance scheduling
 * - Grant compliance monitoring, volunteer management
 * - Crop planning, quality tracking
 *
 * Templates follow the same structure as Routine definitions:
 */

import { INDUSTRY_GROUP } from '../industry/tier-industry-matrix';

/**
 * trigger, action, channels, and optional conditions.
 *
 * SOLID:
 * - OCP: New workflow = add entry to this registry.
 * - ISP: IndustryWorkflowTemplate is a focused type.
 */

export type WorkflowTriggerType = 'schedule' | 'event' | 'manual' | 'condition';

export interface IndustryWorkflowTemplate {
  /** Unique template slug */
  slug: string;
  /** Display name */
  name: string;
  /** Description of what this workflow does */
  description: string;
  /** How this workflow is triggered */
  trigger: {
    type: WorkflowTriggerType;
    /** For schedule: cron expression or time spec. For event: event name. */
    spec: string;
    /** Optional conditions that must be met */
    conditions?: Record<string, unknown>;
  };
  /** What the workflow does */
  action: string;
  /** Delivery channels */
  channels: string[];
  /** Business category */
  category: string;
  /** Which roles should be notified/assigned */
  assignToRole?: string;
  /** Estimated frequency */
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export const INDUSTRY_WORKFLOW_TEMPLATES: Record<
  string,
  IndustryWorkflowTemplate[]
> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: [
    {
      slug: 'daily-kyc-verification',
      name: 'Daily KYC Document Verification',
      description:
        'Scans client records for expiring KYC documents and notifies relationship managers to collect updated documentation.',
      trigger: { type: 'schedule', spec: '0 9 * * *' },
      action:
        'Notify relationship manager for any client whose KYC expires within 30 days. Include document checklist and client contact details.',
      channels: ['in-app', 'email'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'daily',
    },
    {
      slug: 'weekly-risk-assessment',
      name: 'Weekly Portfolio Risk Assessment',
      description:
        'Evaluates client portfolio risk scores, flags high-risk clients, and generates a risk heatmap for review.',
      trigger: { type: 'schedule', spec: '0 8 * * 1' },
      action:
        'Compute risk scores for all active clients. Generate risk analytics dashboard update. Flag clients with score > 75 for enhanced review.',
      channels: ['in-app', 'email'],
      category: 'Risk Analytics',
      assignToRole: 'RiskManager',
      frequency: 'weekly',
    },
    {
      slug: 'regulatory-filing-reminder',
      name: 'Regulatory Filing Calendar Monitor',
      description:
        'Monitors the regulatory filing calendar and sends escalating reminders as deadlines approach.',
      trigger: { type: 'schedule', spec: '0 7 * * 1-5' },
      action:
        'Check regulatory filing deadlines. Send reminders at 30d, 14d, 7d, 3d, and 1d before deadline. Escalate overdue filings to Director.',
      channels: ['in-app', 'email', 'sms'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'daily',
    },
    {
      slug: 'aml-transaction-monitoring',
      name: 'AML Transaction Monitoring Alert',
      description:
        'Monitors client transactions for suspicious activity patterns and generates alerts for compliance review.',
      trigger: {
        type: 'condition',
        spec: 'transaction.amount > threshold',
        conditions: { threshold: 10000 },
      },
      action:
        'Flag suspicious transactions. Generate AML alert with transaction details. Assign to compliance officer for review within 24 hours.',
      channels: ['in-app', 'email', 'push'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'realtime',
    },
  ],

  // ─── Healthcare ────────────────────────────────────────────────────────
  healthcare: [
    {
      slug: 'no-show-prediction',
      name: 'Appointment No-Show Prediction',
      description:
        'Analyzes patient appointment history to predict no-show risk and triggers proactive outreach to at-risk patients.',
      trigger: { type: 'schedule', spec: '0 18 * * *' },
      action:
        'Evaluate next-day appointments against no-show prediction model. For patients with >50% predicted no-show risk, send SMS reminder and flag for staff follow-up call.',
      channels: ['in-app', 'sms', 'push'],
      category: 'Clinical',
      assignToRole: 'PatientScheduler',
      frequency: 'daily',
    },
    {
      slug: 'abnormal-lab-escalation',
      name: 'Abnormal Lab Result Escalation',
      description:
        'Automatically escalates abnormal lab results to the ordering clinician and tracks response time.',
      trigger: {
        type: 'event',
        spec: 'lab.result.received',
        conditions: { resultFlag: 'abnormal' },
      },
      action:
        'Notify ordering clinician immediately. If no acknowledgment within 2 hours, escalate to Chief Medical Officer. Log response time for compliance.',
      channels: ['in-app', 'email', 'push', 'sms'],
      category: 'Clinical',
      assignToRole: 'Clinician',
      frequency: 'realtime',
    },
    {
      slug: 'hipaa-compliance-audit',
      name: 'HIPAA Access Audit & Compliance Check',
      description:
        'Reviews patient record access logs and generates audit reports. Flags any unauthorized access patterns.',
      trigger: { type: 'schedule', spec: '0 2 * * 0' },
      action:
        'Review all patient record access events for the week. Flag suspicious access patterns (excessive views, off-hours access). Generate compliance audit report.',
      channels: ['in-app', 'email'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'weekly',
    },
    {
      slug: 'medication-refill-automation',
      name: 'Medication Refill Request Processing',
      description:
        'Processes incoming medication refill requests, verifies eligibility, and routes to prescriber for approval.',
      trigger: { type: 'event', spec: 'medication.refill.requested' },
      action:
        'Verify patient eligibility and prescription status. Check for contraindications. Route to prescribing clinician for approval with 48-hour SLA.',
      channels: ['in-app', 'email'],
      category: 'Clinical',
      assignToRole: 'ClinicalPharmacist',
      frequency: 'realtime',
    },
  ],

  // ─── Business & Technology ─────────────────────────────────────────────
  'business-technology': [
    {
      slug: 'ticket-auto-triage',
      name: 'Support Ticket Auto-Triage',
      description:
        'Analyzes incoming support tickets, categorizes by type/urgency, and routes to the appropriate team based on skill matching.',
      trigger: { type: 'event', spec: 'ticket.created' },
      action:
        'Classify ticket by category, urgency, and complexity. Match to best-suited engineer based on skills and current workload. Route within 5 minutes.',
      channels: ['in-app', 'email'],
      category: 'Support',
      assignToRole: 'SupportLead',
      frequency: 'realtime',
    },
    {
      slug: 'sla-breach-monitor',
      name: 'SLA Breach Early Warning',
      description:
        'Monitors all active tickets and engagements for approaching SLA breaches. Provides escalating alerts at 75%, 90%, and 95% of SLA threshold.',
      trigger: { type: 'schedule', spec: '0 * * * *' },
      action:
        'Scan all active tickets. Alert team lead for tickets at 75% of SLA threshold. Escalate to manager at 90%. Auto-create escalation ticket at 95%.',
      channels: ['in-app', 'email', 'push'],
      category: 'Support',
      assignToRole: 'ServiceManager',
      frequency: 'hourly',
    },
    {
      slug: 'engagement-profitability',
      name: 'Monthly Engagement Profitability Review',
      description:
        'Calculates profitability for each active engagement by comparing billable hours/retainers against costs, and flags underperforming engagements.',
      trigger: { type: 'schedule', spec: '0 9 1 * *' },
      action:
        'Calculate margin for each engagement. Flag engagements with margin below 20%. Generate profitability report with recommendations.',
      channels: ['in-app', 'email'],
      category: 'Finance',
      assignToRole: 'FinanceDirector',
      frequency: 'monthly',
    },
    {
      slug: 'deployment-risk-check',
      name: 'Production Deployment Risk Assessment',
      description:
        'Evaluates deployment readiness by checking test coverage, recent changes, and environment parity before approving production deployment.',
      trigger: { type: 'event', spec: 'deployment.production.requested' },
      action:
        'Verify test coverage > 80%. Check for recent hotfixes. Validate staging parity. Generate deployment risk score. Block deployment if risk score > 60.',
      channels: ['in-app', 'email'],
      category: 'Development',
      assignToRole: 'TechLead',
      frequency: 'realtime',
    },
  ],

  // ─── Consumer & Commerce ───────────────────────────────────────────────
  'consumer-commerce': [
    {
      slug: 'inventory-replenishment',
      name: 'Automated Inventory Replenishment',
      description:
        'Monitors inventory levels against sales velocity and generates purchase orders when stock drops below reorder points.',
      trigger: { type: 'schedule', spec: '0 6 * * *' },
      action:
        'Calculate sales velocity per SKU. Identify items below reorder point. Generate purchase order drafts for manager approval.',
      channels: ['in-app', 'email'],
      category: 'Operations',
      assignToRole: 'InventoryManager',
      frequency: 'daily',
    },
    {
      slug: 'campaign-roi-tracker',
      name: 'Campaign ROI Auto-Tracker',
      description:
        'Monitors active marketing campaigns, calculates real-time ROI metrics, and alerts when campaigns underperform.',
      trigger: { type: 'schedule', spec: '0 8 * * *' },
      action:
        'Pull campaign spend and attribution data. Calculate ROI, CPA, ROAS. Alert marketing manager if ROI drops below 2x within first week.',
      channels: ['in-app', 'email'],
      category: 'Marketing',
      assignToRole: 'MarketingManager',
      frequency: 'daily',
    },
    {
      slug: 'order-fulfillment-monitor',
      name: 'Order Fulfillment Delay Monitor',
      description:
        'Tracks order fulfillment pipeline, identifies bottlenecks, and escalates delayed orders.',
      trigger: { type: 'schedule', spec: '*/30 * * * *' },
      action:
        'Monitor order fulfillment status. Flag orders exceeding SLA. Assign to warehouse supervisor. Escalate to operations manager for >24h delays.',
      channels: ['in-app', 'push'],
      category: 'Operations',
      assignToRole: 'WarehouseSupervisor',
      frequency: 'realtime',
    },
    {
      slug: 'customer-churn-prediction',
      name: 'Customer Churn Risk Assessment',
      description:
        'Analyzes customer purchase patterns, support tickets, and engagement to predict churn risk and trigger retention campaigns.',
      trigger: { type: 'schedule', spec: '0 9 * * 1' },
      action:
        'Calculate churn risk score per customer. Trigger retention campaign for high-risk customers. Notify account manager with personalized retention recommendations.',
      channels: ['in-app', 'email'],
      category: 'CRM',
      assignToRole: 'CustomerSuccessManager',
      frequency: 'weekly',
    },
  ],

  // ─── Industrial & Infrastructure ────────────────────────────────────────
  'industrial-infrastructure': [
    {
      slug: 'work-order-auto-generation',
      name: 'Preventive Maintenance Work Order Generation',
      description:
        'Generates work orders based on equipment maintenance schedules and meter readings, including parts requisition.',
      trigger: { type: 'schedule', spec: '0 5 * * *' },
      action:
        'Check maintenance schedules against equipment runtime meters. Auto-generate work orders for due/overdue maintenance. Include parts list and estimated hours.',
      channels: ['in-app', 'email'],
      category: 'Maintenance',
      assignToRole: 'MaintenanceSupervisor',
      frequency: 'daily',
    },
    {
      slug: 'safety-incident-response',
      name: 'Safety Incident Automated Response',
      description:
        'Triggers an immediate response workflow when a safety incident is reported, including notifications, investigation assignment, and escalation.',
      trigger: { type: 'event', spec: 'safety.incident.reported' },
      action:
        'Notify site safety officer immediately. Create incident investigation task. Alert operations director for severe incidents. Start 24-hour investigation clock.',
      channels: ['in-app', 'email', 'sms', 'push'],
      category: 'Safety',
      assignToRole: 'SafetyOfficer',
      frequency: 'realtime',
    },
    {
      slug: 'equipment-downtime-analyzer',
      name: 'Equipment Downtime Analysis & Reporting',
      description:
        'Analyzes equipment downtime events, calculates OEE impact, and generates root cause analysis reports.',
      trigger: {
        type: 'event',
        spec: 'equipment.status.changed',
        conditions: { newStatus: 'DOWN' },
      },
      action:
        'Log downtime event with timestamp. Calculate OEE impact. Notify maintenance team. Generate downtime report when equipment back online.',
      channels: ['in-app', 'email'],
      category: 'Operations',
      assignToRole: 'ProductionManager',
      frequency: 'realtime',
    },
    {
      slug: 'permit-renewal-manager',
      name: 'Permit & Certification Renewal Manager',
      description:
        'Tracks all operating permits and certifications, sends renewal reminders, and monitors compliance status.',
      trigger: { type: 'schedule', spec: '0 7 * * 1' },
      action:
        'Review all permits and certifications. Send reminders for items expiring within 90, 60, 30, and 14 days. Escalate expiring permits to compliance officer.',
      channels: ['in-app', 'email'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'weekly',
    },
  ],

  // ─── Public & Social ───────────────────────────────────────────────────
  'public-social': [
    {
      slug: 'grant-deadline-monitor',
      name: 'Grant Application Deadline Monitor',
      description:
        'Tracks all grant opportunities and ensures applications are completed and submitted before deadlines.',
      trigger: { type: 'schedule', spec: '0 8 * * 1-5' },
      action:
        'Review active grant opportunities. Notify grant writer of approaching deadlines at 30, 14, 7, 3 days. Auto-escalate to program manager for overdue submissions.',
      channels: ['in-app', 'email'],
      category: 'Grants',
      assignToRole: 'GrantWriter',
      frequency: 'daily',
    },
    {
      slug: 'volunteer-scheduling',
      name: 'Volunteer Shift Scheduling & Confirmation',
      description:
        'Auto-schedules volunteers based on availability and program needs, sends shift confirmations, and tracks attendance.',
      trigger: { type: 'schedule', spec: '0 7 * * 1,3,5' },
      action:
        'Review upcoming program staffing needs. Match volunteers to shifts based on skills and availability. Send shift confirmations with 48-hour response window.',
      channels: ['in-app', 'email', 'sms'],
      category: 'Operations',
      assignToRole: 'VolunteerCoordinator',
      frequency: 'weekly',
    },
    {
      slug: 'case-workflow-automation',
      name: 'Client Case Intake & Routing',
      description:
        'Automatically processes new case intakes, categorizes by type and urgency, and routes to appropriate case worker.',
      trigger: { type: 'event', spec: 'case.created' },
      action:
        'Classify case by category and priority. Match to case worker based on caseload and expertise. Set initial response SLA (urgent: 4h, standard: 24h).',
      channels: ['in-app', 'email', 'push'],
      category: 'Case Management',
      assignToRole: 'CaseWorker',
      frequency: 'realtime',
    },
    {
      slug: 'grant-reporting-calendar',
      name: 'Grant Reporting Calendar & Compliance',
      description:
        'Tracks grant reporting requirements and ensures progress and financial reports are submitted on time.',
      trigger: { type: 'schedule', spec: '0 9 * * 1' },
      action:
        'Review all active grants. Identify upcoming reporting deadlines. Assign report preparation tasks. Notify program managers of reports due within 30 days.',
      channels: ['in-app', 'email'],
      category: 'Grants',
      assignToRole: 'ProgramManager',
      frequency: 'weekly',
    },
  ],

  // ─── Agriculture & Food ────────────────────────────────────────────────
  'agriculture-food': [
    {
      slug: 'crop-planning-scheduler',
      name: 'Crop Planning & Rotation Scheduler',
      description:
        'Generates crop planning recommendations based on soil data, weather forecasts, market prices, and rotation requirements.',
      trigger: { type: 'schedule', spec: '0 8 * * 1' },
      action:
        'Analyze soil conditions, weather forecast, and market trends. Generate crop planning recommendation with yield projections and input requirements.',
      channels: ['in-app', 'email'],
      category: 'Planning',
      assignToRole: 'FarmManager',
      frequency: 'weekly',
    },
    {
      slug: 'quality-inspection-trigger',
      name: 'Post-Harvest Quality Inspection Trigger',
      description:
        'Automatically generates quality inspection tasks after each harvest batch and tracks pass/fail rates.',
      trigger: { type: 'event', spec: 'harvest.completed' },
      action:
        'Generate quality inspection checklist for harvest batch. Assign to quality inspector. Track inspection results. Flag batches below 90% pass rate for review.',
      channels: ['in-app', 'email'],
      category: 'Quality',
      assignToRole: 'QualityInspector',
      frequency: 'realtime',
    },
    {
      slug: 'distribution-optimization',
      name: 'Distribution Route Optimization',
      description:
        'Optimizes product distribution routes based on order priorities, delivery windows, and transportation costs.',
      trigger: { type: 'schedule', spec: '0 5 * * *' },
      action:
        'Consolidate pending distribution orders. Optimize delivery routes for cost and time efficiency. Generate daily dispatch schedule with driver assignments.',
      channels: ['in-app', 'email'],
      category: 'Logistics',
      assignToRole: 'DistributionManager',
      frequency: 'daily',
    },
    {
      slug: 'livestock-health-monitor',
      name: 'Livestock Health Monitoring & Alert',
      description:
        'Monitors livestock health metrics, feeding patterns, and environmental conditions. Alerts on anomalies.',
      trigger: { type: 'schedule', spec: '0 6,14,20 * * *' },
      action:
        'Collect health metrics from IoT sensors. Compare against baseline. Alert veterinarian for anomalies (temp > 3° deviation, feed drop > 20%).',
      channels: ['in-app', 'email', 'sms', 'push'],
      category: 'Health',
      assignToRole: 'Veterinarian',
      frequency: 'daily',
    },
  ],

  // ─── Other ──────────────────────────────────────────────────────────────
  other: [
    {
      slug: 'portfolio-consolidation',
      name: 'Portfolio Consolidation Report',
      description:
        'Consolidates financial and operational data across all entities into a single dashboard view.',
      trigger: { type: 'schedule', spec: '0 8 * * 1' },
      action:
        'Pull financial data from all entities. Consolidate into portfolio view. Flag performance anomalies. Generate executive summary.',
      channels: ['in-app', 'email'],
      category: 'Finance',
      assignToRole: 'CFO',
      frequency: 'weekly',
    },
    {
      slug: 'governance-compliance-tracker',
      name: 'Governance & Board Compliance Tracker',
      description:
        'Tracks board meeting schedules, resolution requirements, and governance compliance deadlines.',
      trigger: { type: 'schedule', spec: '0 9 * * 1' },
      action:
        'Review board calendar. Track resolution status. Send reminders for upcoming meetings. Monitor governance compliance checklist.',
      channels: ['in-app', 'email'],
      category: 'Governance',
      assignToRole: 'CorporateSecretary',
      frequency: 'weekly',
    },
    {
      slug: 'entity-performance-alert',
      name: 'Entity Performance Alert System',
      description:
        'Monitors key performance indicators across all entities and alerts on significant deviations.',
      trigger: { type: 'schedule', spec: '0 7 * * *' },
      action:
        'Calculate entity performance scores. Compare against targets and prior period. Alert management for deviations > 10%.',
      channels: ['in-app', 'email'],
      category: 'Operations',
      assignToRole: 'PortfolioManager',
      frequency: 'daily',
    },
    {
      slug: 'document-compliance-check',
      name: 'Document Compliance & Filing Check',
      description:
        'Verifies that all required corporate filings, registrations, and regulatory documents are current.',
      trigger: { type: 'schedule', spec: '0 8 1 * *' },
      action:
        'Check all entity registrations and filings. Flag expiring or missing documents. Generate compliance status report for board review.',
      channels: ['in-app', 'email'],
      category: 'Compliance',
      assignToRole: 'ComplianceOfficer',
      frequency: 'monthly',
    },
  ],
};

export function getWorkflowTemplates(
  industryGroup: string,
): IndustryWorkflowTemplate[] {
  return (
    INDUSTRY_WORKFLOW_TEMPLATES[industryGroup] ??
    INDUSTRY_WORKFLOW_TEMPLATES['other'] ??
    []
  );
}

export function getWorkflowTemplate(
  industryGroup: string,
  slug: string,
): IndustryWorkflowTemplate | undefined {
  return getWorkflowTemplates(industryGroup).find((t) => t.slug === slug);
}

export function getWorkflowsByCategory(
  industryGroup: string,
  category: string,
): IndustryWorkflowTemplate[] {
  return getWorkflowTemplates(industryGroup).filter(
    (t) => t.category === category,
  );
}

export function getAllWorkflowGroupSlugs(): string[] {
  return Object.keys(INDUSTRY_WORKFLOW_TEMPLATES);
}
