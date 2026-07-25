"use client";

/**
 * /customers-pool — Admin Customers Pool page.
 *
 * Lists ALL customers across ALL tenants (admin view, no tenant scoping).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePoolList } from '@/hooks/usePoolList';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolPagination } from '@/components/pool/PoolPagination';
import { PoolStatusBadge } from '@/components/pool/PoolStatusBadge';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import {
  customersService,
  type AdminCustomer,
} from '@/services/customers.service';
import { useRouter } from 'next/navigation';

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function CustomersPoolPage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const { items, total, page: currentPage, totalPages, loading, refresh, setOpts } = usePoolList<
    AdminCustomer,
    unknown
  >(customersService as unknown as Parameters<typeof usePoolList<AdminCustomer, unknown>>[0]);

  useEffect(() => {
    setOpts({ search, status: status === 'ALL' ? undefined : status, page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const [deleting, setDeleting] = useState<AdminCustomer | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.industry ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (c.primaryEmail ?? '').toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      }),
    [items, search],
  );

  const canEdit = user?.role === 'SUPER_ADMIN';

  async function handleArchive(item: AdminCustomer) {
    setDeleting(item);
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Customers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              All customers across every tenant. Search by name, industry, or
              contact email.
            </p>
          </div>
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search customers…"
          filters={FILTERS}
          activeFilter={status}
          onFilterChange={setStatus}
          count={total}
          countLabel="customers"
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState title="No customers match your filters" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {filtered.map((customer, idx) => (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-[color:var(--accent-500)]/50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-100 truncate">
                          {customer.name}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {customer.industry ?? 'No industry'}
                        </div>
                      </div>
                      <PoolStatusBadge status={customer.status} />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {customer.primaryEmail && (
                        <span className="truncate max-w-[200px]">
                          {customer.primaryEmail}
                        </span>
                      )}
                      <span>
                        {customer._count?.projects ?? 0} projects
                      </span>
                      <span>
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {canEdit && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                        <button
                          onClick={() =>
                            router.push(`/customers/${customer.id}`)
                          }
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleArchive(customer)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-[color:var(--state-danger)] hover:border-[color:var(--state-danger)] transition"
                          disabled={customer.status === 'ARCHIVED'}
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <PoolPagination
              page={currentPage}
              totalPages={totalPages}
              total={total}
              limit={20}
              onPageChange={(p) => setOpts((o) => ({ ...o, page: p }))}
            />
          </>
        )}
      </div>

      <PoolConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Archive customer?"
        description={
          deleting ? (
            <>
              <span className="text-zinc-200 font-medium">{deleting.name}</span>{' '}
              will be archived and hidden from active lists.
            </>
          ) : ''
        }
        confirmLabel="Archive"
        busy={archiveBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setArchiveBusy(true);
          try {
            await customersService.archive(deleting.id);
          } catch {
            /* noop */
          }
          setArchiveBusy(false);
          setDeleting(null);
          refresh();
        }}
      />
    </AdminShell>
  );
}
