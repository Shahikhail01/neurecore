'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { InitiationStatusCard } from '@/components/initiation/InitiationStatusCard';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function InitiationDetailPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ id: string }>();

  return (
    <TenantShell user={user}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header>
          <Link
            href="/projects"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Pipeline
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">
            Enterprise Initiation
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review the initiation state machine and its live history before or
            after project materialization.
          </p>
        </header>

        <GlassPanel>
          <InitiationStatusCard initiationId={params.id} />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}
