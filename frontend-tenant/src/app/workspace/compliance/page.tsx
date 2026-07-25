'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function CompliancePage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'compliance',
        title: 'Compliance',
        description: 'Compliance reviews, regulatory checks, risk assessments, and licence/insurance status for the tenant.',
        projectTypeSlugs: ['compliance-review'],
      }}
    />
  );
}
