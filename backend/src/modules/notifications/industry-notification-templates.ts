/**
 * Industry Notification Templates
 *
 * Stage 2 Phase 2C: Per-industry notification template strings.
 *
 * Each industry group defines pre-configured notification templates
 * for common scenarios: compliance reminders, onboarding, deadlines,
 * and general updates. These are consumed by the NotificationsService
 * when sending industry-specific notifications.
 *
 * Each template includes title, body, and recommended channel preferences.
 */

import { INDUSTRY_GROUP } from '../industry/tier-industry-matrix';

/**
 * SOLID:
 * - OCP: New industry = add entry to this registry.
 * - ISP: NotificationTemplate is a focused type.
 */

export type NotificationChannel = 'in-app' | 'email' | 'sms' | 'push';

export interface NotificationTemplate {
  /** Unique template slug (e.g. 'compliance-reminder', 'onboarding-welcome') */
  slug: string;
  /** Template category for grouping */
  category: 'compliance' | 'onboarding' | 'deadline' | 'update' | 'alert';
  /** Subject line / title */
  title: string;
  /** Body template (supports variables like {{customerName}}, {{deadline}}, etc.) */
  body: string;
  /** Preferred delivery channels in priority order */
  channels: NotificationChannel[];
  /** Optional frequency hint */
  frequency?: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface IndustryNotificationTemplateSet {
  industryGroup: string;
  templates: NotificationTemplate[];
}

export const INDUSTRY_NOTIFICATION_TEMPLATES: Record<
  string,
  NotificationTemplate[]
> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: [
    {
      slug: 'kyc-expiry-reminder',
      category: 'compliance',
      title: 'KYC Documents Expiring — {{customerName}}',
      body: 'The KYC documents for {{customerName}} will expire on {{expiryDate}}. Please initiate the refresh process to maintain compliance. Required documents: {{documents}}.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'aml-training-reminder',
      category: 'compliance',
      title: 'AML Training Deadline Approaching',
      body: 'The quarterly AML training deadline is {{deadline}}. Currently, {{completionRate}}% of staff have completed the training. Please ensure all team members complete it by the deadline.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'regulatory-filing-due',
      category: 'deadline',
      title: 'Regulatory Filing Due — {{filingType}}',
      body: 'The {{filingType}} regulatory filing is due on {{deadline}}. Late submissions may incur penalties. Please review and submit by the deadline.',
      channels: ['in-app', 'email', 'sms'],
      frequency: 'daily',
    },
    {
      slug: 'audit-preparation-start',
      category: 'update',
      title: 'Audit Preparation Checklist Available',
      body: 'Audit preparation has been initiated. Please review the checklist at {{checklistLink}} and ensure all required documents are uploaded by {{deadline}}.',
      channels: ['in-app', 'email'],
      frequency: 'once',
    },
    {
      slug: 'high-risk-client-alert',
      category: 'alert',
      title: 'High-Risk Client Alert — {{customerName}}',
      body: '{{customerName}} has been flagged as high-risk based on the latest risk assessment. Enhanced due diligence is required. Risk score: {{riskScore}}. Please review immediately.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
  ],

  // ─── Healthcare ────────────────────────────────────────────────────────
  healthcare: [
    {
      slug: 'hipaa-training-reminder',
      category: 'compliance',
      title: 'HIPAA Training Due — {{deadline}}',
      body: 'Annual HIPAA compliance training is due by {{deadline}}. Currently {{completionRate}}% complete. Non-compliant staff must complete training to maintain access to PHI systems.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'access-audit-required',
      category: 'compliance',
      title: 'Patient Record Access Audit Required',
      body: 'The quarterly patient record access audit is {{daysOverdue}} days overdue. Please complete the audit within 7 days to maintain compliance.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'appointment-reminder',
      category: 'update',
      title: 'Appointment Tomorrow — {{patientName}}',
      body: '{{patientName}} has an appointment tomorrow at {{time}} with {{provider}}. Please review the patient chart and prepare any necessary documentation.',
      channels: ['in-app', 'push'],
      frequency: 'daily',
    },
    {
      slug: 'abnormal-lab-results',
      category: 'alert',
      title: 'Abnormal Lab Results — {{patientName}}',
      body: '{{patientName}} has abnormal lab results requiring immediate review. Test: {{testName}}. Result: {{resultValue}}. Reference range: {{referenceRange}}. Please review within 2 hours.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
    {
      slug: 'breach-notification-required',
      category: 'alert',
      title: 'Potential PHI Breach Detected',
      body: 'A potential PHI breach has been detected involving {{recordsAffected}} patient records. Incident report #{{incidentId}} has been generated. Please initiate the breach response protocol immediately.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
  ],

  // ─── Business & Technology ─────────────────────────────────────────────
  'business-technology': [
    {
      slug: 'sla-breach-warning',
      category: 'alert',
      title:
        'SLA Breach Warning — {{ticketCount}} tickets approaching threshold',
      body: '{{ticketCount}} tickets are approaching SLA breach in the next {{hours}} hours. Please review and take action to prevent breach.',
      channels: ['in-app', 'email'],
      frequency: 'hourly',
    },
    {
      slug: 'deployment-ready',
      category: 'update',
      title: 'Deployment Ready for Review — {{projectName}} v{{version}}',
      body: 'Version {{version}} of {{projectName}} is ready for production deployment. Changelog: {{changelog}}. Please review and approve the deployment.',
      channels: ['in-app', 'email'],
      frequency: 'once',
    },
    {
      slug: 'security-vulnerability',
      category: 'alert',
      title: 'Security Vulnerability Detected — {{severity}} Severity',
      body: 'A {{severity}}-severity vulnerability ({{cve}}) has been detected in {{component}}. Impact: {{impact}}. Remediation steps: {{remediation}}. Please address within {{sla}} hours.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
    {
      slug: 'quarterly-business-review',
      category: 'deadline',
      title: 'Quarterly Business Review Due — {{customerName}}',
      body: 'The quarterly business review for {{customerName}} is due by {{deadline}}. Please prepare the engagement summary, performance metrics, and renewal proposal.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'proposal-expiring',
      category: 'deadline',
      title: 'Proposal Expiring — {{customerName}}',
      body: 'The proposal for {{customerName}} (value: {{value}}) expires on {{expiryDate}}. Please follow up with the client to close the deal.',
      channels: ['in-app', 'email'],
      frequency: 'daily',
    },
  ],

  // ─── Consumer & Commerce ───────────────────────────────────────────────
  'consumer-commerce': [
    {
      slug: 'low-inventory-alert',
      category: 'alert',
      title: 'Low Inventory Alert — {{productName}}',
      body: '{{productName}} inventory has dropped below the threshold (current: {{stockCount}}, threshold: {{threshold}}). Please restock to avoid stock-outs.',
      channels: ['in-app', 'email', 'push'],
      frequency: 'daily',
    },
    {
      slug: 'campaign-results-ready',
      category: 'update',
      title: 'Campaign Results Available — {{campaignName}}',
      body: 'Results for the {{campaignName}} campaign are now available. ROI: {{roi}}%. Revenue generated: {{revenue}}. Click-through rate: {{ctr}}%. View full report at {{reportLink}}.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'refund-exception-request',
      category: 'alert',
      title: 'Refund Exception Request — Order #{{orderId}}',
      body: 'A refund exception has been requested for order #{{orderId}} (customer: {{customerName}}, amount: {{amount}}). This exceeds the standard refund policy. Approval required.',
      channels: ['in-app', 'email'],
      frequency: 'once',
    },
    {
      slug: 'order-fulfillment-delay',
      category: 'alert',
      title: 'Order Fulfillment Delay — {{orderCount}} orders',
      body: '{{orderCount}} orders are experiencing fulfillment delays (avg delay: {{avgDelay}} hours). Affected products: {{products}}. Please investigate and resolve.',
      channels: ['in-app', 'email'],
      frequency: 'hourly',
    },
    {
      slug: 'weekly-sales-digest',
      category: 'update',
      title: 'Weekly Sales Digest — Week {{weekNumber}}',
      body: 'This week: {{totalRevenue}} in revenue, {{orderCount}} orders, {{newCustomers}} new customers. Top product: {{topProduct}}. Top channel: {{topChannel}}.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
  ],

  // ─── Industrial & Infrastructure ────────────────────────────────────────
  'industrial-infrastructure': [
    {
      slug: 'safety-incident-report',
      category: 'alert',
      title: 'Safety Incident Reported — {{location}}',
      body: 'A safety incident has been reported at {{location}}. Category: {{category}}. Severity: {{severity}}. Incident #{{incidentId}}. Investigation must begin within {{hours}} hours.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
    {
      slug: 'maintenance-due',
      category: 'deadline',
      title: 'Preventive Maintenance Due — {{equipmentName}}',
      body: 'Preventive maintenance is due for {{equipmentName}} (asset #{{assetId}}). Last serviced: {{lastServiceDate}}. Schedule maintenance by {{deadline}} to avoid downtime.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'safety-training-reminder',
      category: 'compliance',
      title: 'Safety Training Due — {{deadline}}',
      body: 'Mandatory safety training is due by {{deadline}}. Currently {{completionRate}}% complete. All site personnel must complete training to maintain site access.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'equipment-downtime',
      category: 'alert',
      title: 'Equipment Downtime — {{equipmentName}}',
      body: '{{equipmentName}} at {{location}} has experienced unplanned downtime. Duration: {{duration}}. Estimated impact: {{impact}}. Repair crew assigned: {{crewName}}.',
      channels: ['in-app', 'email', 'push'],
      frequency: 'once',
    },
    {
      slug: 'permit-expiry-warning',
      category: 'deadline',
      title: 'Permit Expiring — {{permitType}}',
      body: 'The {{permitType}} permit for {{location}} expires on {{expiryDate}} ({{daysRemaining}} days remaining). Please initiate renewal to avoid operational disruption.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
  ],

  // ─── Public & Social ───────────────────────────────────────────────────
  'public-social': [
    {
      slug: 'grant-deadline-approaching',
      category: 'deadline',
      title: 'Grant Deadline — {{grantName}}',
      body: 'The {{grantName}} grant application deadline is {{deadline}} ({{daysRemaining}} days remaining). Submission status: {{status}}. Ensure all required documents are uploaded.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'grant-report-due',
      category: 'deadline',
      title: 'Grant Progress Report Due — {{grantName}}',
      body: 'The progress report for {{grantName}} (grant #{{grantId}}) is due by {{deadline}}. Reporting period: {{period}}. Please submit the report to the {{funder}} portal.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'volunteer-clearance-expired',
      category: 'compliance',
      title: 'Volunteer Clearance Expired — {{volunteerName}}',
      body: '{{volunteerName}} background clearance has expired (expired: {{expiryDate}}). They cannot participate in programs until clearance is renewed.',
      channels: ['in-app', 'email'],
      frequency: 'weekly',
    },
    {
      slug: 'public-disclosure-review',
      category: 'update',
      title: 'Public Disclosure Pending Review — {{documentTitle}}',
      body: 'The public disclosure document "{{documentTitle}}" is pending review before publication. Please review and approve by {{deadline}}.',
      channels: ['in-app', 'email'],
      frequency: 'once',
    },
    {
      slug: 'foia-request-due',
      category: 'deadline',
      title: 'FOIA Request Due — Request #{{requestId}}',
      body: 'A FOIA request ({{requestId}}) is due for response by {{deadline}} ({{daysRemaining}} days remaining). Request summary: {{summary}}. Please review and prepare response.',
      channels: ['in-app', 'email'],
      frequency: 'daily',
    },
  ],

  // ─── Agriculture & Food ────────────────────────────────────────────────
  'agriculture-food': [
    {
      slug: 'food-safety-inspection-due',
      category: 'deadline',
      title: 'Food Safety Inspection Due — {{facilityName}}',
      body: 'The food safety inspection for {{facilityName}} is due by {{deadline}}. Last inspection: {{lastInspectionDate}}. Please prepare documentation and schedule the inspection.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'harvest-window-alert',
      category: 'update',
      title: 'Harvest Window Opening — {{cropType}}',
      body: 'The harvest window for {{cropType}} at {{location}} is opening ({{startDate}} — {{endDate}}). Estimated yield: {{estimatedYield}}. Equipment status: {{equipmentStatus}}.',
      channels: ['in-app', 'email', 'push'],
      frequency: 'weekly',
    },
    {
      slug: 'livestock-health-check',
      category: 'deadline',
      title: 'Livestock Health Check Due — {{herdId}}',
      body: 'Routine health check for {{herdId}} ({{animalCount}} animals) is due by {{deadline}}. Last check: {{lastCheckDate}}. Veterinarian assigned: {{vetName}}.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'certification-renewal',
      category: 'deadline',
      title: 'Certification Renewal Due — {{certificationType}}',
      body: 'Your {{certificationType}} certification expires on {{expiryDate}} ({{daysRemaining}} days remaining). Please initiate the renewal process to maintain compliance.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'weather-alert',
      category: 'alert',
      title: 'Severe Weather Alert — {{location}}',
      body: 'A {{alertType}} weather alert has been issued for {{location}}. Expected impact: {{impact}}. Timeframe: {{timeframe}}. Please activate the weather response plan.',
      channels: ['in-app', 'email', 'sms', 'push'],
      frequency: 'once',
    },
  ],

  // ─── Other ──────────────────────────────────────────────────────────────
  other: [
    {
      slug: 'board-meeting-reminder',
      category: 'deadline',
      title: 'Board Meeting — {{date}}',
      body: 'The quarterly board meeting is scheduled for {{date}} at {{time}}. Please review the board packet at {{packetLink}} and submit any agenda items by {{agendaDeadline}}.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'tax-filing-due',
      category: 'deadline',
      title: 'Tax Filing Due — {{entityName}}',
      body: 'The tax filing for {{entityName}} ({{filingType}}) is due by {{deadline}}. Please ensure all documents are submitted to {{accountantName}} by {{internalDeadline}}.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'insurance-renewal',
      category: 'deadline',
      title: 'Insurance Renewal Due — {{policyType}}',
      body: 'Your {{policyType}} insurance policy ({{policyNumber}}) expires on {{expiryDate}}. Please review coverage and initiate renewal with {{brokerName}}.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
    {
      slug: 'compliance-review-due',
      category: 'compliance',
      title: 'Quarterly Compliance Review Due',
      body: 'The quarterly compliance review is due by {{deadline}}. Please review the compliance checklist and address any outstanding items.',
      channels: ['in-app', 'email'],
      frequency: 'quarterly',
    },
    {
      slug: 'portfolio-update',
      category: 'update',
      title: 'Portfolio Performance Update — {{period}}',
      body: 'Portfolio performance for {{period}}: {{totalValue}} total value ({{changePercent}}% change). Top performer: {{topHolding}}. Bottom performer: {{bottomHolding}}.',
      channels: ['in-app', 'email'],
      frequency: 'monthly',
    },
  ],
};

export function getNotificationTemplates(
  industryGroup: string,
): NotificationTemplate[] {
  return (
    INDUSTRY_NOTIFICATION_TEMPLATES[industryGroup] ??
    INDUSTRY_NOTIFICATION_TEMPLATES['other'] ??
    []
  );
}

export function getNotificationTemplate(
  industryGroup: string,
  slug: string,
): NotificationTemplate | undefined {
  const templates = getNotificationTemplates(industryGroup);
  return templates.find((t) => t.slug === slug);
}

export function getTemplatesByCategory(
  industryGroup: string,
  category: NotificationTemplate['category'],
): NotificationTemplate[] {
  return getNotificationTemplates(industryGroup).filter(
    (t) => t.category === category,
  );
}
