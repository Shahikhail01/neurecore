/**
 * Compliance Posture Center — Standards Registry.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.4.6-5.4.10, §5.18.
 *
 * Single canonical owner of the 5 compliance standards NeureCore documents:
 *   • AICPA SOC 2
 *   • HIPAA
 *   • GDPR
 *   • ISO 27001
 *   • EU AI Act
 *
 * Solid:
 *   • SRP — only the registry of standards. Posture scoring lives in
 *     CompliancePostureService.
 *   • OCP — adding a new standard is a new entry; no other file changes.
 *   • OCP — control mapping is data, not branching.
 */

export type StandardId =
  | 'AICPA_SOC2'
  | 'HIPAA'
  | 'GDPR'
  | 'ISO_27001'
  | 'EU_AI_ACT';

export interface StandardScope {
  /** Tenant data categories this standard covers. */
  dataCategories: string[];
  /** Domains NeureCore commits to in-scope. */
  inScopeDomains: string[];
  /** Domains explicitly out-of-scope (documented limitations). */
  outOfScopeDomains: string[];
}

export interface ComplianceStandard {
  id: StandardId;
  displayName: string;
  shortName: string;
  /** Public docs URL on creatio.com — used as the canonical reference. */
  referenceUrl: string;
  /** Internal posture section id in v2 plan. */
  planSection: string;
  /** Coarse scope: what this standard covers in our system. */
  scope: StandardScope;
  /** Evidence types we maintain. Each maps to a real DB table / log. */
  evidenceTypes: string[];
  /** Default posture when no evaluation has been run yet. */
  defaultPosture: 'UNKNOWN' | 'PARTIAL' | 'COMPLIANT' | 'NON_COMPLIANT';
}

export const COMPLIANCE_STANDARDS: ReadonlyArray<ComplianceStandard> = [
  {
    id: 'AICPA_SOC2',
    displayName: 'AICPA SOC 2',
    shortName: 'SOC 2',
    referenceUrl: 'https://www.creatio.com/ai/ai-trust-and-governance',
    planSection: '5.4.6',
    scope: {
      dataCategories: ['customer-data', 'audit-logs', 'configuration'],
      inScopeDomains: ['security', 'availability', 'confidentiality'],
      outOfScopeDomains: ['processing-integrity', 'privacy'],
    },
    evidenceTypes: [
      'AuditLog',
      'feature-flag-change-events',
      'admin-role-events',
      'session-expiry-events',
    ],
    defaultPosture: 'UNKNOWN',
  },
  {
    id: 'HIPAA',
    displayName: 'HIPAA',
    shortName: 'HIPAA',
    referenceUrl: 'https://www.creatio.com/ai/ai-trust-and-governance',
    planSection: '5.4.7',
    scope: {
      dataCategories: ['phi', 'patient-records', 'audit-logs'],
      inScopeDomains: ['security', 'access-controls', 'audit-controls'],
      outOfScopeDomains: ['business-associate-agreements'],
    },
    evidenceTypes: [
      'AuditLog',
      'role-assignment-events',
      'data-export-events',
    ],
    defaultPosture: 'UNKNOWN',
  },
  {
    id: 'GDPR',
    displayName: 'GDPR',
    shortName: 'GDPR',
    referenceUrl: 'https://www.creatio.com/ai/ai-trust-and-governance',
    planSection: '5.4.8',
    scope: {
      dataCategories: ['personal-data', 'special-category-data'],
      inScopeDomains: [
        'data-export',
        'data-deletion',
        'data-restriction',
        'audit-logs',
      ],
      outOfScopeDomains: [],
    },
    evidenceTypes: [
      'DsrRequest',
      'data-export-events',
      'data-deletion-events',
      'AuditLog',
    ],
    defaultPosture: 'PARTIAL',
  },
  {
    id: 'ISO_27001',
    displayName: 'ISO 27001',
    shortName: 'ISO 27001',
    referenceUrl: 'https://www.creatio.com/ai/ai-trust-and-governance',
    planSection: '5.4.9',
    scope: {
      dataCategories: ['all'],
      inScopeDomains: [
        'information-security-policies',
        'access-control',
        'cryptography',
        'physical-security',
        'operations-security',
      ],
      outOfScopeDomains: ['statement-of-applicability'],
    },
    evidenceTypes: [
      'AuditLog',
      'EncryptionConfig',
      'access-review-events',
    ],
    defaultPosture: 'UNKNOWN',
  },
  {
    id: 'EU_AI_ACT',
    displayName: 'EU AI Act',
    shortName: 'EU AI Act',
    referenceUrl: 'https://www.creatio.com/ai/ai-trust-and-governance',
    planSection: '5.4.10',
    scope: {
      dataCategories: ['all'],
      inScopeDomains: [
        'risk-classification',
        'transparency',
        'human-oversight',
        'accuracy',
      ],
      outOfScopeDomains: [],
    },
    evidenceTypes: [
      'agent-template-risk-tier',
      'ai-twin-audit-logs',
      'llm-binding-audit',
      'approval-events',
    ],
    defaultPosture: 'PARTIAL',
  },
];

export function findStandard(id: StandardId): ComplianceStandard | null {
  return COMPLIANCE_STANDARDS.find((s) => s.id === id) ?? null;
}
