'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function TaxPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'tax',
        title: 'Tax',
        description: 'Tax compliance engagements, federal/state filings, tax provisions, and audit support for the tenant.',
        projectTypeSlugs: ['tax-filing'],
      }}
    />
  );
}
