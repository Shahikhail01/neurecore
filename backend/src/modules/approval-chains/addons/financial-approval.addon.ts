/**
 * Financial & Compliance Approval Addon
 *
 * Stage 2 Phase 2A: Financial-specific approval escalation chains.
 * Applies to financial-services and accounting-audit-services.
 *
 * SOLID: SRP — handles ONLY financial & compliance industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';
import { INDUSTRY_GROUP } from '../../industry/tier-industry-matrix';

@Injectable()
export class FinancialApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = ['financial-services', 'accounting-audit-services'];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'client-onboarding-kyc',
        label: 'Client Onboarding KYC Approval',
        description:
          'Multi-stage approval for new client onboarding requiring KYC verification.',
        stages: [
          { role: 'ComplianceOfficer', order: 1, action: 'verify' },
          { role: 'RiskManager', order: 2, action: 'assess' },
          { role: 'Director', order: 3, action: 'approve' },
        ],
        triggers: [
          {
            event: 'customer.created',
            conditions: { industryGroup: INDUSTRY_GROUP.FINANCIAL_COMPLIANCE },
          },
        ],
      },
      {
        slug: 'expense-override',
        label: 'Expense Override (>$5,000)',
        description: 'Escalation chain for expenses exceeding $5,000.',
        stages: [
          { role: 'Manager', order: 1, action: 'approve' },
          { role: 'FinanceDirector', order: 2, action: 'review' },
          { role: 'CFO', order: 3, action: 'sign-off' },
        ],
        triggers: [
          { event: 'expense.created', conditions: { amount: { gt: 5000 } } },
        ],
      },
      {
        slug: 'high-risk-client',
        label: 'High-Risk Client Approval',
        description:
          'Enhanced due diligence for high-risk client classification.',
        stages: [
          { role: 'ComplianceOfficer', order: 1, action: 'verify' },
          { role: 'RiskManager', order: 2, action: 'assess' },
          { role: 'ComplianceDirector', order: 3, action: 'approve' },
          { role: 'AuditCommittee', order: 4, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'customer.riskTier.updated',
            conditions: { riskTier: 'high' },
          },
        ],
      },
      {
        slug: 'regulatory-report',
        label: 'Regulatory Report Submission',
        description: 'Approval chain for regulatory report submissions.',
        stages: [
          { role: 'ComplianceOfficer', order: 1, action: 'review' },
          { role: 'ComplianceDirector', order: 2, action: 'approve' },
          { role: 'CFO', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'regulatory.report.due' }],
      },
    ];
  }

  async getRoutesForEvent(
    _tenantId: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const routes = await this.getRoutes(_tenantId);
    return routes.filter((r) => r.triggers.some((t) => t.event === event));
  }
}
