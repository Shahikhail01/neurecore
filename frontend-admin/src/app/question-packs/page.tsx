'use client';

/**
 * /question-packs — admin pool for capability QuestionPacks.
 *
 * Phase 2D. Mirrors /project-types page conventions.
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
  questionPacksService,
  type QuestionPack,
} from '@/services/questionPacks.service';

export default function QuestionPacksPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<QuestionPack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<QuestionPack | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const page = await questionPacksService.list({
          search: search || undefined,
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
  }, [search, refreshNonce]);

  const filtered = useMemo(() => items, [items]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Question Packs</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Capability-based question sets the Information Engine loads when a
              ProjectType references them. Never industry-keyed.
            </p>
          </div>
          {canEdit && (
            <Link
              href="/question-packs/new"
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Question Pack
            </Link>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search question packs…"
          filters={[]}
          activeFilter=""
          onFilterChange={() => undefined}
          count={total}
          countLabel="question packs"
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-raised border border-surface-border animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState
            title="No question packs yet"
            hint={
              canEdit
                ? 'Create a capability pack (e.g. "Core", "Compliance") and link it to a ProjectType.'
                : 'Ask an admin to create a question pack.'
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((pack) => (
                <motion.div
                  key={pack.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex gap-4 items-start"
                  data-testid={`question-pack-row-${pack.key}`}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/question-packs/${pack.id}`}
                      className="text-sm font-semibold text-zinc-100 hover:text-indigo-300 transition"
                    >
                      {pack.name}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">{pack.key}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {pack.isSystem ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-warning)]/40 text-[color:var(--state-warning)] border border-amber-800">
                          SYSTEM
                        </span>
                      ) : null}
                      <span className="text-[10px] text-zinc-600">
                        v{pack.version} · {pack.questions.length} question
                        {pack.questions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {pack.description ? (
                      <p className="text-xs text-zinc-500 mt-1">{pack.description}</p>
                    ) : null}
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        href={`/question-packs/${pack.id}/edit`}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                      >
                        Edit
                      </Link>
                      {!pack.isSystem && (
                        <button
                          type="button"
                          onClick={() => setDeleting(pack)}
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
        title="Delete question pack?"
        description={
          deleting ? (
            <>
              &ldquo;<span className="text-zinc-200 font-medium">{deleting.name}</span>
              &rdquo; will be permanently removed. Linked ProjectTypes lose these questions.
            </>
          ) : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await questionPacksService.remove(deleting.id);
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