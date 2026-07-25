'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function LoansPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'loans',
        title: 'Loans',
        description: 'Loan portfolio projects — debt-covenant audits, lender compliance, and interest expense reviews.',
        projectTypeSlugs: ['audit-engagement', 'compliance-review'],
        computeKpis: (projects) => {
          const active = projects.filter((p) => p.status === 'ACTIVE').length;
          const completed = projects.filter((p) => p.status === 'COMPLETED').length;
          return [
            { label: 'Active', value: active },
            { label: 'Completed', value: completed },
            { label: 'Total', value: projects.length },
          ];
        },
      }}
    />
  );
}
