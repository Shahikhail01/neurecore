"use client";

/**
 * /packages — Phase 10 Packages Pool (composite root).
 *
 * Lists every composable offering. Each row links to its detail view where
 * the composition can be edited; "+ New Package" leads to the composer.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolStatusBadge } from '@/components/pool/PoolStatusBadge';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import { packagesService, type Package } from '@/services/packages.service';

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function PackagesPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [items, setItems] = useState<Package[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Package | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const canEdit = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const page = await packagesService.list({
          search,
          status: status === 'ALL' ? undefined : status,
          limit: 100,
        });
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, status, refreshNonce]);

  const filtered = useMemo(() => items, [items]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Packages</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Composable offerings — Industry × Tier × Departments × AI Employees × Features.
              A package is the unit customers actually buy.
            </p>
          </div>
          {canEdit && (
            <Link
              href="/packages/new"
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Package
            </Link>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search packages…"
          filters={STATUS_FILTERS}
          activeFilter={status}
          onFilterChange={setStatus}
          count={total}
          countLabel="packages"
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState
            title="No packages yet"
            hint={canEdit ? 'Compose your first offering.' : 'Ask a SUPER_ADMIN to seed this pool.'}
            action={canEdit ? (
              <Link href="/packages/new" className="text-[color:var(--accent-400)] hover:underline">
                + New Package
              </Link>
            ) : undefined}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((pkg) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex gap-4 items-start hover:border-[color:var(--accent-500)]/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/packages/${pkg.id}`}
                          className="text-sm font-semibold text-zinc-100 hover:text-indigo-300 transition"
                        >
                          {pkg.name}
                        </Link>
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {pkg.description ?? 'No description'}
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-1 font-mono">{pkg.slug}</div>
                      </div>
                      <PoolStatusBadge status={pkg.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-zinc-800 text-zinc-300 px-2 py-0.5">
                        {pkg.industry?.name ?? 'Industry?'}
                      </span>
                      <span className="rounded-full bg-zinc-800 text-zinc-300 px-2 py-0.5">
                        {pkg.tier?.name ?? 'Tier?'}
                      </span>
                      <span className="rounded-full bg-zinc-900 text-zinc-400 px-2 py-0.5">
                        {pkg.departments?.length ?? 0} departments
                      </span>
                      <span className="rounded-full bg-zinc-900 text-zinc-400 px-2 py-0.5">
                        {pkg.aiAgents?.length ?? 0} agents
                      </span>
                      <span className="rounded-full bg-zinc-900 text-zinc-400 px-2 py-0.5">
                        {pkg.features?.length ?? 0} features
                      </span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        href={`/packages/${pkg.id}/edit`}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleting(pkg)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-[color:var(--state-danger)] hover:border-[color:var(--state-danger)] transition"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <PoolConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Delete package?"
        description={
          deleting ? (
            <>
              "<span className="text-zinc-200 font-medium">{deleting.name}</span>" will be permanently removed.
              No tenant data is affected — packages are SKUs, not deployments.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await packagesService.remove(deleting.id);
          } catch {
            /* noop */
          }
          setDeleting(null);
          setRefreshNonce((n) => n + 1);
        }}
      />
    </AdminShell>
  );
}
