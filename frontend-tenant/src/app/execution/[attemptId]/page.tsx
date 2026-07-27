// src/app/execution/[attemptId]/page.tsx
//
// Phase 7 — Execution attempt detail screen. Wraps ExecutionDetailView
// with the tenant shell + breadcrumb navigation.

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { ExecutionDetailView } from '@/components/execution/ExecutionDetailView';

export default function ExecutionDetailPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;

  return (
    <TenantShell user={user}>
      <div className="px-4 py-6 sm:px-6 flex flex-col gap-4 max-w-5xl mx-auto w-full">
        <header>
          <Link
            href="/reviews"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Reviews
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">
            Execution attempt
          </h1>
        </header>
        <ExecutionDetailView attemptId={attemptId} />
      </div>
    </TenantShell>
  );
}
