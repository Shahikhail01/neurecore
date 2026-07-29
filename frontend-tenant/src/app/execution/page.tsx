'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, FileText, RefreshCw } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { executionService, type ExecutionAttemptSummary } from '@/services/execution.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function ExecutionOverviewPage() {
  const user = useTenantAuth()!;
  const [attempts, setAttempts] = useState<ExecutionAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAttempts(await executionService.listAttempts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution attempts');
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <TenantShell user={user}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Governed Runtime
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-100">
              Execution Attempts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Review AI attempt state, evidence production, retry status, and
              human review linkage from one tenant-scoped queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </header>

        {error && (
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/70">
          {loading && attempts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-400">
              <Activity className="h-4 w-4 animate-pulse" />
              Loading execution attempts
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-zinc-600" />
              <h2 className="mt-4 text-lg font-medium text-zinc-100">
                No execution attempts yet
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                New AI work will appear here once tasks are assigned and queued.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {attempts.map((attempt) => (
                <li key={attempt.id}>
                  <Link
                    href={`/execution/${encodeURIComponent(attempt.id)}`}
                    className="grid gap-3 p-4 hover:bg-zinc-900/70 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {attempt.task?.title ?? `Task ${attempt.taskId}`}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        Attempt {attempt.attemptNumber} · {attempt.agent?.name ?? attempt.agentId}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                        {attempt.status}
                      </span>
                      <span className="text-zinc-500">
                        {attempt.evidence?.length ?? 0} evidence
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </TenantShell>
  );
}
