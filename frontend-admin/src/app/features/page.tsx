"use client";

/**
 * /features — Phase 10 Feature Pool page.
 *
 * Features are atomic flags grouped by category (Integration/API/...). The
 * page groups them visually while keeping a single flat search.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePoolList } from '@/hooks/usePoolList';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolPagination } from '@/components/pool/PoolPagination';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import {
  featuresPoolService,
  type Feature,
  type FeatureCategory,
  type CreateFeaturePayload,
} from '@/services/featuresPool.service';

const CATEGORIES: { label: string; value: FeatureCategory | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Integration', value: 'INTEGRATION' },
  { label: 'API', value: 'API' },
  { label: 'Communication', value: 'COMMUNICATION' },
  { label: 'Branding', value: 'BRANDING' },
  { label: 'Analytics', value: 'ANALYTICS' },
  { label: 'Automation', value: 'AUTOMATION' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Platform', value: 'PLATFORM' },
];

const CATEGORY_COLOR: Record<FeatureCategory, string> = {
  INTEGRATION: 'bg-[color:var(--state-info)] text-blue-300',
  API: 'bg-[color:var(--accent-500)] text-violet-300',
  COMMUNICATION: 'bg-[color:var(--state-success)] text-emerald-300',
  BRANDING: 'bg-[color:var(--state-warning)] text-amber-300',
  ANALYTICS: 'bg-[color:var(--visual-accent-rose-500)] text-rose-300',
  AUTOMATION: 'bg-orange-900 text-orange-300',
  SECURITY: 'bg-[color:var(--state-danger)] text-red-300',
  PLATFORM: 'bg-zinc-800 text-zinc-300',
};

export default function FeaturesPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FeatureCategory | 'ALL'>('ALL');
  const { items, total, page: currentPage, totalPages, loading, refresh, setOpts } = usePoolList<
    Feature,
    CreateFeaturePayload
  >(featuresPoolService);

  useEffect(() => {
    setOpts({ search, status: category === 'ALL' ? undefined : category, page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const [editing, setEditing] = useState<Feature | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Feature | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN';

  const filtered = useMemo(
    () =>
      items.filter((f) => {
        const matchesSearch =
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.key.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'ALL' || f.category === category;
        return matchesSearch && matchesCategory;
      }),
    [items, search, category],
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Features</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Atomic platform capabilities. Included or excluded per package tier.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Feature
            </button>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search features…"
          filters={CATEGORIES}
          activeFilter={category}
          onFilterChange={(v) => setCategory(v as FeatureCategory | 'ALL')}
          count={total}
          countLabel="features"
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState title="No features match your filters" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-[color:var(--accent-500)]/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{f.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                        {f.description ?? 'No description'}
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1 font-mono">{f.key}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[f.category]}`}
                    >
                      {f.category.toLowerCase()}
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                      <button
                        onClick={() => setEditing(f)}
                        className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(f)}
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
        <FeatureFormModal
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
        title="Delete feature?"
        description={
          deleting ? (
            <>
              "<span className="text-zinc-200 font-medium">{deleting.name}</span>" will be permanently removed.
              Packages that reference this feature will block the deletion.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await featuresPoolService.remove(deleting.id);
          } catch {
            /* noop */
          }
          setDeleting(null);
          refresh();
        }}
      />
    </AdminShell>
  );
}

function FeatureFormModal({
  target,
  onClose,
  onSaved,
}: {
  target: Feature | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(target?.key ?? '');
  const [name, setName] = useState(target?.name ?? '');
  const [description, setDescription] = useState(target?.description ?? '');
  const [category, setCategory] = useState<FeatureCategory>(target?.category ?? 'INTEGRATION');
  const [integrationKey, setIntegrationKey] = useState(target?.integrationKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!key.trim() || !name.trim()) {
      setError('Key and name are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (target) {
        await featuresPoolService.update(target.id, {
          key,
          name,
          description,
          category,
          integrationKey: integrationKey || undefined,
        });
      } else {
        await featuresPoolService.create({
          key,
          name,
          description,
          category,
          integrationKey: integrationKey || undefined,
        });
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100 mb-5">
          {target ? `Edit: ${target.name}` : 'Create Feature'}
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Key *">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="ms365_integration"
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </Field>
            <Field label="Category *">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeatureCategory)}
                className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
              >
                {CATEGORIES.filter((c) => c.value !== 'ALL').map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Microsoft 365 Integration"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </Field>
          <Field label="Integration Key (optional)">
            <input
              value={integrationKey}
              onChange={(e) => setIntegrationKey(e.target.value)}
              placeholder="ms365"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
            />
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
              {busy ? 'Saving…' : target ? 'Save Changes' : 'Create Feature'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
