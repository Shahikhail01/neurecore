"use client";

/**
 * /industries — Phase 10 Industry Pool page.
 *
 * Pure page. Single Responsibility: render the Industries pool.
 * No business logic in this file; everything goes through `industriesPoolService`
 * (which implements IPoolAdminService — DIP boundary).
 */

import React, { useEffect, useMemo, useState } from 'react';
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
  industriesPoolService,
  type Industry,
  type CreateIndustryPayload,
} from '@/services/industriesPool.service';

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function IndustriesPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const { items, total, page: currentPage, totalPages, loading, refresh, setOpts } = usePoolList<
    Industry,
    CreateIndustryPayload
  >(industriesPoolService);

  useEffect(() => {
    setOpts({ search, status: status === 'ALL' ? undefined : status, page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const [editing, setEditing] = useState<Industry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Industry | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchesSearch =
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.slug.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = status === 'ALL' || i.status === status;
        return matchesSearch && matchesStatus;
      }),
    [items, search, status],
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Industries</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Top-level business categorisation. Packages belong to one industry.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Industry
            </button>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search industries…"
          filters={STATUS_FILTERS}
          activeFilter={status}
          onFilterChange={setStatus}
          count={total}
          countLabel="industries"
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState
            title="No industries match your filters"
            hint={canEdit ? 'Add the first one.' : 'Ask a SUPER_ADMIN to seed this pool.'}
            action={
              canEdit && (
                <button
                  onClick={() => setCreating(true)}
                  className="text-[color:var(--accent-400)] hover:underline"
                >
                  + New Industry
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((ind) => (
                <motion.div
                  key={ind.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-[color:var(--accent-500)]/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{ind.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{ind.description ?? ''}</div>
                      <div className="text-[11px] text-zinc-600 mt-1 font-mono">{ind.slug}</div>
                    </div>
                    <PoolStatusBadge status={ind.status} />
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                      <button
                        onClick={() => setEditing(ind)}
                        className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(ind)}
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

      {(creating || editing) && (
        <IndustryFormModal
          target={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <PoolConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Delete industry?"
        description={
          deleting ? (
            <>
              "<span className="text-zinc-200 font-medium">{deleting.name}</span>" will be permanently removed.
              Packages that reference this industry will block the deletion.
            </>
          ) : (
            ''
          )
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await industriesPoolService.remove(deleting.id);
          } catch {
            /* swallow — refresh will reflect server-side failure */
          }
          setDeleting(null);
          refresh();
        }}
      />
    </AdminShell>
  );
}

// ─── Inline form modal (still part of this page — co-located) ─────────────

function IndustryFormModal({
  target,
  onClose,
  onSaved,
}: {
  target: Industry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [slug, setSlug] = useState(target?.slug ?? '');
  const [name, setName] = useState(target?.name ?? '');
  const [description, setDescription] = useState(target?.description ?? '');
  const [icon, setIcon] = useState(target?.icon ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>(target?.status ?? 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!slug.trim() || !name.trim()) {
      setError('Slug and name are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (target) {
        await industriesPoolService.update(target.id, { slug, name, description, icon, status });
      } else {
        await industriesPoolService.create({ slug, name, description, icon, status });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100 mb-5">
          {target ? `Edit: ${target.name}` : 'Create Industry'}
        </h2>
        <div className="space-y-3">
          <Field label="Slug *">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="healthcare"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Healthcare"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Icon (lucide name)">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="HeartPulse"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'ARCHIVED')}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          {error && (
            <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
            >
              {busy ? 'Saving…' : target ? 'Save Changes' : 'Create Industry'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div>
      <label htmlFor={fieldId} className="text-xs text-zinc-400 mb-1 block">{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactHTMLElement<HTMLElement>, { id: fieldId }) : child
      )}
    </div>
  );
}
