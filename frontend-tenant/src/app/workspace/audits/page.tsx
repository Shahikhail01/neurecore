'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function AuditsPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'audits',
        title: 'Audits',
        description: 'Active audit engagements, financial statement audits, internal audits, and compliance audits for the tenant.',
        projectTypeSlugs: ['audit-engagement'],
      }}
    />
  );
}
