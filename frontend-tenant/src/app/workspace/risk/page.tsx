'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function RiskPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'risk',
        title: 'Risk',
        description: 'Risk-tiered projects across all F&C project types. Identifies high-risk engagements and overdue work.',
        projectTypeSlugs: ['audit-engagement', 'tax-filing', 'compliance-review', 'bookkeeping-cycle', 'payroll-cycle'],
        computeKpis: (projects) => {
          const high = projects.filter((p) => p.priority === 'HIGH' || p.priority === 'URGENT').length;
          const overdue = projects.filter(
            (p) => p.targetDate && new Date(p.targetDate) < new Date() && p.status !== 'COMPLETED' && p.status !== 'ARCHIVED',
          ).length;
          const active = projects.filter((p) => p.status === 'ACTIVE').length;
          return [
            { label: 'High Priority', value: high },
            { label: 'Overdue', value: overdue },
            { label: 'Active', value: active },
            { label: 'Total', value: projects.length },
          ];
        },
      }}
    />
  );
}
