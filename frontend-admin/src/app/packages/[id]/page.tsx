"use client";

/**
 * /packages/[id] — Phase 10 Package detail view.
 *
 * Shows the full composition (industry, tier, departments, agents, features)
 * and offers Edit / Publish / Archive actions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { packagesService, type Package, type PackageStatus } from '@/services/packages.service';
import { PoolStatusBadge } from '@/components/pool/PoolStatusBadge';

export default function PackageDetailPage() {
  const user = useAdminAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await packagesService.get(id);
        if (!cancelled) setPkg(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function setStatus(status: PackageStatus) {
    if (!pkg) return;
    setBusy(true);
    try {
      const updated = await packagesService.update(pkg.id, { status });
      setPkg(updated);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        <Link
          href="/packages"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to packages
        </Link>
        {loading ? (
          <div className="h-32 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
        ) : error ? (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : pkg ? (
          <>
            <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">{pkg.name}</h1>
                  <div className="text-[11px] text-zinc-600 mt-1 font-mono">{pkg.slug}</div>
                  <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                    {pkg.description ?? 'No description'}
                  </p>
                </div>
                <PoolStatusBadge status={pkg.status} />
              </div>

              {canEdit && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-surface-border/50">
                  <Link
                    href={`/packages/${pkg.id}/edit`}
                    className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                  >
                    Edit Composition
                  </Link>
                  {pkg.status !== 'PUBLISHED' && (
                    <button
                      onClick={() => setStatus('PUBLISHED')}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs bg-emerald-700 hover:bg-[color:var(--state-success)] text-white font-medium transition disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  {pkg.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => setStatus('ARCHIVED')}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-amber-300 transition disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Industry & Tier">
                <Row label="Industry" value={pkg.industry?.name ?? '—'} />
                <Row label="Tier" value={pkg.tier?.name ?? '—'} />
              </Section>

              <Section title={`Departments (${pkg.departments?.length ?? 0})`}>
                {(pkg.departments ?? []).length === 0 ? (
                  <Empty label="No departments attached." />
                ) : (
                  <ul className="space-y-1">
                    {pkg.departments!.map((d) => (
                      <li key={d.id} className="text-xs text-zinc-300">
                        ◆ {d.name}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

               <Section title={`AI Employees (${pkg.aiAgents?.length ?? 0})`}>
                {(pkg.aiAgents ?? []).length === 0 ? (
                   <Empty label="No employees attached." />
                ) : (
                  <ul className="space-y-1">
                    {pkg.aiAgents!.map((a) => (
                      <li key={a.id} className="text-xs text-zinc-300">
                        ◆ {a.name} <span className="text-zinc-600">({a.type})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={`Features (${pkg.features?.length ?? 0})`}>
                {(pkg.features ?? []).length === 0 ? (
                  <Empty label="No features attached." />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.features!.map((f) => (
                      <span
                        key={f.id}
                        className="text-xs rounded-full bg-zinc-800 text-zinc-300 px-2 py-0.5"
                      >
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-border bg-surface-raised p-4"
    >
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      {children}
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-100">{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-xs text-zinc-600 italic">{label}</div>;
}
