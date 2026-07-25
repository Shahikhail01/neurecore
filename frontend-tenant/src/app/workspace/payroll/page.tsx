'use client';

import { IndustryWorkspacePage } from '@/components/industry/IndustryWorkspacePage';

export default function PayrollPage() {
  return (
    <IndustryWorkspacePage
      config={{
        featureId: 'payroll',
        title: 'Payroll',
        description: 'Payroll cycles, payroll accounting, tax withholding, benefit accruals, and payroll journal entries.',
        projectTypeSlugs: ['payroll-cycle'],
      }}
    />
  );
}
