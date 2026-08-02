/**
 * Compliance Checklist Definitions
 *
 * Stage 2 Phase 2A: Per-industry compliance checklists.
 * Each industry group gets its own set of compliance items with
 * evaluatable conditions. The engine evaluates these against runtime
 * data (tenant/customer metrics, audit logs, etc.).
 *
 * SOLID: OCP — add a new industry group by adding an entry to this
 * registry. Zero changes to the compliance engine.
 */

import type {
  ComplianceChecklistDef,
  ChecklistConditionData,
} from './interfaces/compliance.interface';
import { INDUSTRY_GROUP } from '../industry/tier-industry-matrix';

export const COMPLIANCE_CHECKLISTS: Record<string, ComplianceChecklistDef> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: {
    industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
    items: [
      {
        id: 'kyc-current',
        label: 'KYC documents current for 90%+ active clients',
        description:
          'Ensure Know-Your-Customer documentation is up-to-date for at least 90% of active client relationships.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.kycCurrentRate ?? 0) >= 0.9,
        remediation:
          'Initiate KYC refresh campaign for clients with expiring documents.',
      },
      {
        id: 'aml-training',
        label: '90%+ staff completed AML training',
        description:
          'Anti-Money Laundering training must be completed by at least 90% of staff.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.amlTrainingRate ?? 0) >= 0.9,
        remediation:
          'Schedule mandatory AML training sessions for non-compliant staff.',
      },
      {
        id: 'reg-filings',
        label: 'All regulatory filings submitted on time',
        description: 'No overdue regulatory submissions to governing bodies.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation:
          'Review filing calendar and submit outstanding regulatory reports.',
      },
      {
        id: 'risk-assessment',
        label: 'Quarterly risk assessment completed',
        description:
          'Comprehensive risk assessment review conducted for the current quarter.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.riskAssessmentCompleted ?? false,
        remediation:
          'Schedule and complete the quarterly risk assessment review.',
      },
      {
        id: 'audit-readiness',
        label: 'Audit readiness score above 85%',
        description:
          'Internal controls and documentation sufficient for external audit.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.auditReadinessScore ?? 0) >= 85,
        remediation:
          'Address audit preparation gaps identified in the readiness assessment.',
      },
      {
        id: 'insurance-current',
        label: 'Professional indemnity insurance current',
        description:
          'All required professional liability insurance policies are active.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation:
          'Renew or update professional indemnity insurance coverage.',
      },
      {
        id: 'license-current',
        label: 'Operating licenses current',
        description:
          'All required business and professional licenses are valid.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.licenseRenewalUpToDate ?? false,
        remediation:
          'Review and renew all operating and professional licenses.',
      },
    ],
  },

  // ─── Accounting & Audit Services ───────────────────────────────────────
  'accounting-audit-services': {
    industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE,
    items: [
      {
        id: 'cpe-compliance',
        label: 'CPE credit requirements met for all CPAs',
        description:
          'Continuing Professional Education credits current for all certified staff.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation:
          'Track and complete CPE credits for all certified accountants.',
      },
      {
        id: 'independence-check',
        label: 'Auditor independence verified for all engagements',
        description: 'No conflicts of interest in active audit engagements.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.riskAssessmentCompleted ?? false,
        remediation:
          'Conduct independence assessment for all active audit engagements.',
      },
      {
        id: 'tax-filings',
        label: 'All client tax filings submitted on time',
        description:
          'No overdue tax returns or extensions for managed clients.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.taxFilingsCurrent ?? false,
        remediation:
          'Review tax filing calendar and submit outstanding returns.',
      },
      {
        id: 'quality-review',
        label: 'Peer review / quality control completed',
        description:
          'Internal quality review conducted for audit and assurance engagements.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.qualityControlPassRate ?? 0) >= 0.9,
        remediation:
          'Schedule peer review for engagements below quality threshold.',
      },
      {
        id: 'insurance-current',
        label: 'Professional indemnity insurance current',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation: 'Renew professional indemnity insurance.',
      },
      {
        id: 'license-current',
        label: 'Firm registration current with regulatory body',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.licenseRenewalUpToDate ?? false,
        remediation:
          'Renew firm registration with the relevant accounting regulatory body.',
      },
    ],
  },

  // ─── Technology & Digital Services ─────────────────────────────────────
  'business-technology': {
    industryGroup: 'business-technology',
    items: [
      {
        id: 'sla-compliance',
        label: 'SLA compliance at 95%+',
        description:
          'Service Level Agreements met for at least 95% of active contracts.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? false,
        remediation: 'Review SLA breaches and implement corrective measures.',
      },
      {
        id: 'soc2-compliance',
        label: 'SOC 2 Type II report current',
        description:
          'SOC 2 audit completed and report is within validity period.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.soc2Compliant ?? false,
        remediation: 'Schedule and complete SOC 2 Type II audit.',
      },
      {
        id: 'iso27001',
        label: 'ISO 27001 certification maintained',
        description: 'Information security management certification is active.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.iso27001Certified ?? false,
        remediation:
          'Renew ISO 27001 certification through accredited auditor.',
      },
      {
        id: 'gdpr',
        label: 'GDPR compliance verified',
        description:
          'Data protection measures meet GDPR requirements for EU customers.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation: 'Conduct GDPR compliance audit and address findings.',
      },
      {
        id: 'security-training',
        label: 'Security awareness training completed by all staff',
        description:
          'All employees have completed annual security awareness training.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation:
          'Assign security awareness training to non-compliant staff.',
      },
      {
        id: 'incident-response',
        label: 'Security incidents resolved within SLA',
        description: 'No unresolved security incidents exceeding response SLA.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.incidentResponseTime ?? 0) <= 48,
        remediation:
          'Review incident queue and allocate resources to overdue items.',
      },
      {
        id: 'third-party-risk',
        label: 'Third-party vendor risk assessments current',
        description:
          'All critical vendors have been assessed for security risk.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.thirdPartyRiskAssessed ?? false,
        remediation:
          'Complete risk assessments for outstanding third-party vendors.',
      },
    ],
  },

  // ─── Professional & Business Services ──────────────────────────────────
  'professional-business-services': {
    industryGroup: 'business-technology',
    items: [
      {
        id: 'engagement-letters',
        label: 'Engagement letters current for all active clients',
        description:
          'Signed engagement letters on file for all active client engagements.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Update and obtain signatures for outstanding engagement letters.',
      },
      {
        id: 'insurance-current',
        label: 'Professional liability insurance current',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation: 'Renew professional liability insurance.',
      },
      {
        id: 'data-privacy',
        label: 'Client data privacy controls verified',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation: 'Audit client data access controls and privacy measures.',
      },
      {
        id: 'staff-certifications',
        label: 'Professional certifications current for staff',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 0.9,
        remediation: 'Track and renew expiring professional certifications.',
      },
      {
        id: 'conflict-check',
        label: 'Conflict of interest checks current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.riskAssessmentCompleted ?? false,
        remediation:
          'Run conflict of interest checks for all active engagements.',
      },
    ],
  },

  // ─── Healthcare & Life Sciences ────────────────────────────────────────
  healthcare: {
    industryGroup: 'healthcare',
    items: [
      {
        id: 'hipaa-training',
        label: 'All staff completed HIPAA training',
        description:
          'HIPAA compliance training completed by 100% of staff handling PHI.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.hipaaTrainingRate ?? 0) >= 1.0,
        remediation:
          'Schedule mandatory HIPAA training for non-compliant staff.',
      },
      {
        id: 'breach-log',
        label: 'No unreported breaches in last 60 days',
        description:
          'All data breaches must be reported within required timeline.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => (d.openBreaches ?? 0) === 0,
        remediation: 'Review breach log and report any outstanding incidents.',
      },
      {
        id: 'access-audit',
        label: 'Patient record access audit completed',
        description: 'Quarterly audit of who accessed patient records and why.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.lastAccessAuditDays ?? 999) <= 90,
        remediation:
          'Complete the patient record access audit for this quarter.',
      },
      {
        id: 'clinical-compliance',
        label: 'Clinical trial protocols compliant',
        description:
          'All active clinical trials follow approved protocols and regulatory requirements.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          d.clinicalTrialCompliance ?? true,
        remediation:
          'Review clinical trial protocols against regulatory requirements.',
      },
      {
        id: 'license-current',
        label: 'Medical licenses and certifications current',
        description: 'All practicing clinicians have valid licenses.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.licenseRenewalUpToDate ?? false,
        remediation:
          'Verify and renew all clinical staff licenses and certifications.',
      },
      {
        id: 'patient-satisfaction',
        label: 'Patient satisfaction score above 85%',
        description:
          'Patient experience surveys show satisfaction above threshold.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.patientSatisfactionScore ?? 0) >= 85,
        remediation:
          'Analyze low satisfaction responses and implement improvements.',
      },
      {
        id: 'equipment-calibration',
        label: 'Medical equipment calibration current',
        description:
          'All clinical equipment has current calibration certificates.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Schedule calibration for equipment with expired certificates.',
      },
    ],
  },

  // ─── Consumer & Commerce ───────────────────────────────────────────────
  'consumer-commerce': {
    industryGroup: 'consumer-commerce',
    items: [
      {
        id: 'pci-dss',
        label: 'PCI DSS compliance maintained',
        description:
          'Payment Card Industry Data Security Standard compliance verified.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.pciDssCompliant ?? false,
        remediation:
          'Complete PCI DSS self-assessment questionnaire and remediation.',
      },
      {
        id: 'inventory-accuracy',
        label: 'Inventory accuracy above 95%',
        description:
          'Physical inventory matches system records within 5% tolerance.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.inventoryAccuracy ?? 0) >= 0.95,
        remediation:
          'Conduct physical inventory count and reconcile discrepancies.',
      },
      {
        id: 'return-compliance',
        label: 'Return/refund policy compliance',
        description:
          'All returns and refunds processed within stated policy timeframe.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? true,
        remediation: 'Review overdue returns and update processing workflows.',
      },
      {
        id: 'consumer-data',
        label: 'Consumer data privacy compliant',
        description: 'Customer data handling meets CCPA/GDPR requirements.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation:
          'Audit customer data collection, storage, and processing practices.',
      },
      {
        id: 'safety-compliance',
        label: 'Product safety compliance verified',
        description:
          'All products meet applicable safety standards and regulations.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation: 'Review product safety certifications and address gaps.',
      },
      {
        id: 'labor-compliance',
        label: 'Labor law compliance for retail staff',
        description:
          'Working hours, breaks, and conditions comply with labor regulations.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.payrollCompliance ?? false,
        remediation:
          'Audit staff schedules and working conditions against labor laws.',
      },
    ],
  },

  // ─── Media & Communications ────────────────────────────────────────────
  'media-communications-creative': {
    industryGroup: 'consumer-commerce',
    items: [
      {
        id: 'copyright-compliance',
        label: 'Copyright and IP licensing current',
        description:
          'All creative assets have valid licenses or are original works.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Audit asset library for unlicensed content and obtain licenses.',
      },
      {
        id: 'advertising-standards',
        label: 'Advertising standards compliance',
        description: 'All published advertisements meet regulatory standards.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? true,
        remediation:
          'Review recent campaigns against advertising standards guidelines.',
      },
      {
        id: 'data-privacy',
        label: 'Audience data privacy compliance',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation: 'Verify consent mechanisms for audience data collection.',
      },
      {
        id: 'content-standards',
        label: 'Content moderation standards enforced',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? true,
        remediation: 'Review content moderation queue and policy adherence.',
      },
    ],
  },

  // ─── Industrial & Infrastructure ────────────────────────────────────────
  'industrial-infrastructure': {
    industryGroup: 'industrial-infrastructure',
    items: [
      {
        id: 'safety-training',
        label: 'Safety training completed by all workers',
        description:
          'OSHA or equivalent safety training current for all on-site personnel.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation:
          'Schedule mandatory safety training sessions for non-compliant workers.',
      },
      {
        id: 'safety-inspections',
        label: 'Workplace safety inspections completed',
        description: 'Regular safety inspections conducted and documented.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          d.safetyInspectionsCompleted ?? false,
        remediation:
          'Complete and document outstanding workplace safety inspections.',
      },
      {
        id: 'environmental-permits',
        label: 'Environmental permits current',
        description:
          'All environmental permits, emissions certificates, and waste disposal licenses are valid.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.environmentalPermitsCurrent ?? false,
        remediation:
          'Renew expiring environmental permits and submit required reports.',
      },
      {
        id: 'equipment-certification',
        label: 'Equipment certifications current',
        description:
          'Heavy machinery, cranes, and critical equipment certifications valid.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Schedule inspection and certification for uncertified equipment.',
      },
      {
        id: 'incident-reporting',
        label: 'Safety incidents reported and resolved',
        description: 'No open safety incidents exceeding resolution timeframe.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => (d.openBreaches ?? 0) === 0,
        remediation: 'Review and close outstanding safety incident reports.',
      },
      {
        id: 'workers-comp',
        label: 'Workers compensation insurance current',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.workersCompInsured ?? false,
        remediation: 'Renew workers compensation insurance coverage.',
      },
      {
        id: 'quality-control',
        label: 'Quality control pass rate above 95%',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.qualityControlPassRate ?? 0) >= 0.95,
        remediation:
          'Investigate quality failures and implement corrective actions.',
      },
    ],
  },

  // ─── Manufacturing & Industrial ────────────────────────────────────────
  'manufacturing-industrial': {
    industryGroup: 'industrial-infrastructure',
    items: [
      {
        id: 'iso9001',
        label: 'ISO 9001 quality management maintained',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.iso27001Certified ?? false,
        remediation: 'Schedule ISO 9001 surveillance audit.',
      },
      {
        id: 'safety-osha',
        label: 'OSHA compliance verified',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.safetyInspectionsCompleted ?? false,
        remediation:
          'Conduct OSHA compliance walkthrough and address findings.',
      },
      {
        id: 'equipment-maintenance',
        label: 'Preventive maintenance schedule on track',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation: 'Review and update preventive maintenance schedule.',
      },
      {
        id: 'supply-chain',
        label: 'Supply chain risk assessment current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.thirdPartyRiskAssessed ?? false,
        remediation:
          'Complete supply chain risk assessment for critical suppliers.',
      },
      {
        id: 'environmental',
        label: 'Environmental compliance reporting current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.environmentalPermitsCurrent ?? false,
        remediation: 'Submit outstanding environmental compliance reports.',
      },
    ],
  },

  // ─── Energy & Utilities ────────────────────────────────────────────────
  'energy-utilities-natural-resources': {
    industryGroup: 'industrial-infrastructure',
    items: [
      {
        id: 'safety-compliance',
        label: 'Safety compliance training completed',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation: 'Schedule safety training for non-compliant staff.',
      },
      {
        id: 'regulatory-filings',
        label: 'Energy regulatory filings current',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation: 'Submit overdue regulatory filings to energy commission.',
      },
      {
        id: 'environmental',
        label: 'Environmental impact assessments current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.environmentalPermitsCurrent ?? false,
        remediation: 'Update environmental impact assessments.',
      },
      {
        id: 'incident-response',
        label: 'Emergency response plan tested',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.riskAssessmentCompleted ?? false,
        remediation: 'Conduct emergency response drill and update plan.',
      },
      {
        id: 'asset-integrity',
        label: 'Asset integrity inspections current',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Complete pipeline and infrastructure integrity inspections.',
      },
    ],
  },

  // ─── Construction & Engineering ────────────────────────────────────────
  'construction-engineering-infrastructure': {
    industryGroup: 'industrial-infrastructure',
    items: [
      {
        id: 'safety-training',
        label: 'Site safety training completed',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation: 'Schedule site safety orientation and training.',
      },
      {
        id: 'permits',
        label: 'Building permits current',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation:
          'Verify and renew all active building and construction permits.',
      },
      {
        id: 'inspections',
        label: 'Site inspections passed',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          d.safetyInspectionsCompleted ?? false,
        remediation:
          'Schedule outstanding building code and safety inspections.',
      },
      {
        id: 'insurance',
        label: 'Construction liability insurance current',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation: 'Renew construction liability and bonding insurance.',
      },
      {
        id: 'environmental',
        label: 'Environmental mitigation plan active',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.environmentalPermitsCurrent ?? false,
        remediation: 'Update and implement environmental mitigation measures.',
      },
    ],
  },

  // ─── Logistics & Transportation ────────────────────────────────────────
  'logistics-transportation-supply-chain': {
    industryGroup: 'industrial-infrastructure',
    items: [
      {
        id: 'fleet-compliance',
        label: 'Fleet vehicle inspections current',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation: 'Complete outstanding fleet vehicle safety inspections.',
      },
      {
        id: 'driver-certifications',
        label: 'Driver certifications and licenses current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation:
          'Verify and renew driver certifications and commercial licenses.',
      },
      {
        id: 'customs-compliance',
        label: 'Customs and trade compliance current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? true,
        remediation:
          'Review customs documentation and trade compliance filings.',
      },
      {
        id: 'safety-incidents',
        label: 'Transport safety incidents below threshold',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => (d.openBreaches ?? 0) === 0,
        remediation: 'Investigate and close transport safety incident reports.',
      },
      {
        id: 'insurance',
        label: 'Cargo and liability insurance current',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation: 'Renew cargo and liability insurance policies.',
      },
    ],
  },

  // ─── Public & Social ───────────────────────────────────────────────────
  'public-social': {
    industryGroup: 'public-social',
    items: [
      {
        id: 'ethics-training',
        label: 'Ethics and conduct training completed',
        description:
          'All staff completed mandatory ethics and code of conduct training.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation: 'Assign ethics training to non-compliant staff.',
      },
      {
        id: 'transparency-reporting',
        label: 'Public transparency reports current',
        description:
          'Required public disclosures and transparency reports published.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation:
          'Publish outstanding transparency and public disclosure reports.',
      },
      {
        id: 'audit',
        label: 'External audit completed',
        description: 'Annual external audit conducted and findings addressed.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.auditReadinessScore ?? 0) >= 90,
        remediation:
          'Schedule external audit and prepare supporting documentation.',
      },
      {
        id: 'data-protection',
        label: 'Citizen data protection compliant',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation:
          'Audit data protection measures for citizen personal information.',
      },
      {
        id: 'procurement',
        label: 'Procurement policy compliance',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.thirdPartyRiskAssessed ?? false,
        remediation:
          'Review procurement processes against policy requirements.',
      },
      {
        id: 'accessibility',
        label: 'Digital accessibility standards met',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? true,
        remediation: 'Conduct accessibility audit and implement improvements.',
      },
    ],
  },

  // ─── Government & Public Sector ────────────────────────────────────────
  'government-public-sector': {
    industryGroup: 'public-social',
    items: [
      {
        id: 'foia-compliance',
        label: 'FOIA/RTI request compliance',
        description:
          'Freedom of Information requests responded to within statutory timeframe.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? false,
        remediation:
          'Process overdue FOIA requests and update tracking system.',
      },
      {
        id: 'security-clearance',
        label: 'Security clearances current for classified staff',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation: 'Initiate renewal for expiring security clearances.',
      },
      {
        id: 'budget-compliance',
        label: 'Budget and spending compliance',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation:
          'Reconcile budget variances and file required spending reports.',
      },
      {
        id: 'records-management',
        label: 'Records retention schedule current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.policyReviewCurrent ?? false,
        remediation:
          'Update records retention schedule and archive expired records.',
      },
      {
        id: 'continuity-plan',
        label: 'Continuity of operations plan tested',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.riskAssessmentCompleted ?? false,
        remediation:
          'Conduct continuity of operations exercise and update plan.',
      },
    ],
  },

  // ─── Education & Research ──────────────────────────────────────────────
  'education-research': {
    industryGroup: 'public-social',
    items: [
      {
        id: 'accreditation',
        label: 'Accreditation status current',
        description:
          'Program and institutional accreditations are valid and current.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.curriculumAccreditationCurrent ?? false,
        remediation:
          'Prepare accreditation renewal documentation and schedule review.',
      },
      {
        id: 'ferpa-compliance',
        label: 'FERPA / student data privacy training completed',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.hipaaTrainingRate ?? 0) >= 1.0,
        remediation:
          'Assign FERPA training to non-compliant faculty and staff.',
      },
      {
        id: 'research-ethics',
        label: 'IRB / research ethics approvals current',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.clinicalTrialCompliance ?? true,
        remediation: 'Submit outstanding IRB applications and renewals.',
      },
      {
        id: 'safety',
        label: 'Campus safety compliance',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.safetyInspectionsCompleted ?? false,
        remediation: 'Complete campus safety inspections and drills.',
      },
      {
        id: 'title-compliance',
        label: 'Title IX / equal opportunity compliance',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation:
          'Assign Title IX training and review compliance reporting.',
      },
    ],
  },

  // ─── Nonprofit & International ─────────────────────────────────────────
  'nonprofit-international': {
    industryGroup: 'public-social',
    items: [
      {
        id: 'tax-exempt',
        label: 'Tax-exempt status maintained',
        description:
          '501(c) or equivalent charitable status is active and compliant.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation:
          'File annual tax-exempt reports and maintain compliance with regulations.',
      },
      {
        id: 'grant-compliance',
        label: 'Grant reporting requirements current',
        description:
          'All active grants have required reports submitted on time.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.grantReportingCurrent ?? false,
        remediation:
          'Review grant calendar and submit outstanding reports to funders.',
      },
      {
        id: 'volunteer-screening',
        label: 'Volunteer background checks current',
        description:
          'All active volunteers have current background screenings.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.volunteerClearanceRate ?? 0) >= 1.0,
        remediation: 'Process background checks for unscreened volunteers.',
      },
      {
        id: 'financial-audit',
        label: 'Annual financial audit completed',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          (d.auditReadinessScore ?? 0) >= 85,
        remediation: 'Schedule annual independent financial audit.',
      },
      {
        id: 'donor-privacy',
        label: 'Donor data privacy compliant',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation: 'Audit donor data handling practices.',
      },
      {
        id: 'board-governance',
        label: 'Board governance requirements met',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.policyReviewCurrent ?? false,
        remediation:
          'Schedule board meetings and update governance documentation.',
      },
    ],
  },

  // ─── Agriculture & Food ────────────────────────────────────────────────
  'agriculture-food': {
    industryGroup: 'agriculture-food',
    items: [
      {
        id: 'food-safety',
        label: 'Food safety inspections passed',
        description: 'All facilities passed recent food safety inspections.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          d.foodSafetyInspections ?? false,
        remediation:
          'Schedule and pass food safety inspection for all facilities.',
      },
      {
        id: 'organic-certification',
        label: 'Organic certification current',
        description:
          'USDA Organic or equivalent certification is active and compliant.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.organicCertificationCurrent ?? false,
        remediation:
          'Renew organic certification and submit required documentation.',
      },
      {
        id: 'livestock-health',
        label: 'Livestock health inspections current',
        description:
          'All livestock have current health certificates and vaccinations.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.livestockHealthChecks ?? false,
        remediation: 'Schedule veterinary inspections for overdue livestock.',
      },
      {
        id: 'pesticide-compliance',
        label: 'Pesticide and chemical use compliance',
        description:
          'All chemical applications follow regulatory guidelines and are documented.',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) => d.documentsUpToDate ?? false,
        remediation: 'Review and update pesticide application records.',
      },
      {
        id: 'worker-safety',
        label: 'Agricultural worker safety training completed',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          (d.staffComplianceTrainingRate ?? 0) >= 1.0,
        remediation: 'Schedule worker safety training sessions.',
      },
      {
        id: 'water-quality',
        label: 'Water quality testing current',
        frequency: 'monthly',
        condition: (d: ChecklistConditionData) =>
          d.safetyInspectionsCompleted ?? false,
        remediation: 'Conduct water quality testing and submit results.',
      },
      {
        id: 'traceability',
        label: 'Product traceability systems active',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.slasMet ?? true,
        remediation: 'Review and test product traceability systems.',
      },
    ],
  },

  // ─── Other / Special Purpose ───────────────────────────────────────────
  other: {
    industryGroup: 'other',
    items: [
      {
        id: 'entity-compliance',
        label: 'Entity registration and filings current',
        description:
          'All corporate registrations and annual filings are up to date.',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) => d.regFilingsOnTime ?? false,
        remediation:
          'File outstanding annual reports and maintain good standing.',
      },
      {
        id: 'tax-compliance',
        label: 'Tax compliance verified',
        description:
          'All tax obligations are current with no outstanding notices.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) => d.taxFilingsCurrent ?? false,
        remediation:
          'Address outstanding tax notices and file missing returns.',
      },
      {
        id: 'insurance',
        label: 'Insurance coverage adequate',
        frequency: 'annual',
        condition: (d: ChecklistConditionData) =>
          d.insurancePoliciesCurrent ?? false,
        remediation: 'Review and renew insurance policies.',
      },
      {
        id: 'governance',
        label: 'Governance documentation current',
        description:
          'Board minutes, resolutions, and governance documents are maintained.',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.policyReviewCurrent ?? false,
        remediation: 'Update governance documentation and board records.',
      },
      {
        id: 'data-protection',
        label: 'Data protection measures in place',
        frequency: 'quarterly',
        condition: (d: ChecklistConditionData) =>
          d.gdprComplianceVerified ?? false,
        remediation: 'Implement and verify data protection measures.',
      },
    ],
  },
};

export function getChecklist(
  groupSlug: string,
): ComplianceChecklistDef | undefined {
  return COMPLIANCE_CHECKLISTS[groupSlug];
}

export function getDefaultChecklist(): ComplianceChecklistDef {
  return COMPLIANCE_CHECKLISTS['other'];
}

export function getAllChecklistGroupSlugs(): string[] {
  return Object.keys(COMPLIANCE_CHECKLISTS);
}
