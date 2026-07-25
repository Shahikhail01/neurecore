"use client";

/**
 * /project-types — Phase 2 ProjectType admin list.
 *
 * Lists all project types (system + tenant). Admin can create, edit, and archive.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import { PoolConfirmDeleteDialog } from '@/components/pool/PoolConfirmDeleteDialog';
import {
  projectTypesService,
  type ProjectType,
} from '@/services/projectTypes.service';
import { INDUSTRY_FILTERS, CLASSIFICATION_FILTERS } from '@/lib/industries';

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
];

export default function ProjectTypesPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [classification, setClassification] = useState('');
  const [items, setItems] = useState<ProjectType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<ProjectType | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const page = await projectTypesService.list({
          search,
          industry: industry || undefined,
          classification:
            (classification as ProjectType['classification']) || undefined,
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
  }, [search, industry, classification, refreshNonce]);

  const filtered = useMemo(() => items, [items]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Project Types</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Industry templates with field schemas, stage templates, and approval chains.
              Assign a type when creating a project.
            </p>
          </div>
          {canEdit && (
            <Link
              href="/project-types/new"
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Project Type
            </Link>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search project types…"
          filters={INDUSTRY_FILTERS}
          activeFilter={industry}
          onFilterChange={setIndustry}
          count={total}
          countLabel="project types"
        />
        <div className="flex flex-wrap gap-1.5" data-testid="classification-filter-row">
          {CLASSIFICATION_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setClassification(f.value)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                classification === f.value
                  ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-200'
                  : 'border-surface-border text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState
            title="No project types yet"
            hint={
              canEdit
                ? 'Define your first industry template with stages and custom fields.'
                : 'Ask an admin to create a project type.'
            }
            action={
              canEdit ? (
                <Link href="/project-types/new" className="text-[color:var(--accent-400)] hover:underline">
                  + New Project Type
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((pt) => (
                <motion.div
                  key={pt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex gap-4 items-start hover:border-[color:var(--accent-500)]/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/project-types/${pt.id}`}
                          className="text-sm font-semibold text-zinc-100 hover:text-indigo-300 transition"
                        >
                          {pt.name}
                        </Link>
                        {pt.industry && (
                          <span className="ml-2 text-xs text-zinc-500">{pt.industry}</span>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {pt.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-warning)]/40 text-[color:var(--state-warning)] border border-amber-800">
                              SYSTEM
                            </span>
                          )}
                          {pt.classification && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--accent-500)]/40 text-indigo-300 border border-indigo-800">
                              {pt.classification}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600">
                            v{pt._count?.versions ?? '?'} version{pt._count?.versions !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        href={`/project-types/${pt.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                      >
                        Manage
                      </Link>
                      {!pt.isSystem && (
                        <button
                          onClick={() => setDeleting(pt)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-[color:var(--state-danger)] hover:border-[color:var(--state-danger)] transition"
                        >
                          ✕
                        </button>
                      )}
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
        title="Delete project type?"
        description={
          deleting ? (
            <>
              &ldquo;<span className="text-zinc-200 font-medium">{deleting.name}</span>&rdquo;
              will be permanently removed. Existing projects using this type are unaffected.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await projectTypesService.remove(deleting.id);
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
