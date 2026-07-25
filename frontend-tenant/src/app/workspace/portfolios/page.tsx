'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function PortfoliosPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'portfolios',
        title: 'Portfolios',
        description: 'Operational bookkeeping portfolios — monthly close cycles, recurring bookkeeping work, and trend tracking.',
        projectTypeSlugs: ['bookkeeping-cycle'],
      }}
    />
  );
}
