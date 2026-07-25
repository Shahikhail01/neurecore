'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function EngagementsPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'engagements',
        title: 'Engagements',
        description: 'Active client engagements across all F&C project types — the master view of audit, tax, bookkeeping, payroll, and compliance work.',
        projectTypeSlugs: ['audit-engagement', 'tax-filing', 'compliance-review', 'bookkeeping-cycle', 'payroll-cycle'],
      }}
    />
  );
}
