'use client';

/**
 * /tasks/delegate — Task Delegation page
 *
 * S: page layout only; form logic in DelegationForm
 */

import Link               from 'next/link';
import { DelegationForm } from '@/components/delegation/DelegationForm';

export default function DelegatePage() {
  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-5">
        <Link href="/tasks" className="hover:text-zinc-300 transition">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-zinc-300">Delegate</span>
      </div>

      <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto">
        <DelegationForm />
      </div>
    </div>
  );
}
