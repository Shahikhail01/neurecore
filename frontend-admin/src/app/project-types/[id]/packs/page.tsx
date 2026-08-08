'use client';

/**
 * /project-types/[id]/packs — Wire capability packs to a ProjectType.
 *
 * Phase 2D post-create step. Per §5.2.2 of project-creation-imp-plan.md.
 * Reuses PoolToolbar + PoolConfirmDeleteDialog conventions.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { projectTypesService } from '@/services/projectTypes.service';
import {
  questionPacksService,
  projectTypePacksService,
  type QuestionPack,
  type ProjectTypePackLink,
} from '@/services/questionPacks.service';

export default function ProjectTypePacksPage() {
  const user = useAdminAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectTypeId = params?.id;

  const [ptName, setPtName] = useState<string>('');
  const [allPacks, setAllPacks] = useState<QuestionPack[]>([]);
  const [linked, setLinked] = useState<ProjectTypePackLink[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  async function refresh() {
    if (!projectTypeId) return;
    setLoading(true);
    try {
      const [pt, all, linkedNow] = await Promise.all([
        projectTypesService.get(projectTypeId),
        questionPacksService.list({ limit: 100 }),
        projectTypePacksService.list(projectTypeId),
      ]);
      setPtName(pt.name);
      setAllPacks(all.items);
      setLinked(linkedNow);
      setSelected(new Set(linkedNow.map((l) => l.questionPackId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectTypeId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return allPacks;
    return allPacks.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q),
    );
  }, [allPacks, search]);

  function toggle(packId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }

  async function save() {
    if (!projectTypeId) return;
    setSaving(true);
    setError(null);
    try {
      await projectTypePacksService.replace(projectTypeId, Array.from(selected));
      router.push(`/project-types/${projectTypeId}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-4xl mx-auto space-y-5">
        <Link
          href="/project-types"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to project types
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Wire Packs
            <span className="ml-2 text-sm font-normal text-zinc-400">— {ptName || '…'}</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Pick the capability packs this project type loads. Order = click order.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <input
          type="search"
          aria-label="Search packs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packs…"
          className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
          data-testid="pack-search"
        />

        {loading ? (
          <div className="text-sm text-zinc-500">Loading packs…</div>
        ) : (
          <div className="space-y-2" data-testid="pack-list">
            <AnimatePresence>
              {filtered.map((pack) => {
                const isSelected = selected.has(pack.id);
                const order = Array.from(selected).indexOf(pack.id);
                return (
                  <motion.button
                    key={pack.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    disabled={!canEdit}
                    onClick={() => toggle(pack.id)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(pack.id); } }}
                    className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition ${
                      isSelected
                        ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10'
                        : 'border-surface-border bg-surface-raised hover:border-[color:var(--accent-500)]/40'
                    } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    data-testid={`pack-row-${pack.key}`}
                  >
                    <span className="mt-0.5 text-[10px] font-mono text-zinc-500 w-6 text-right">
                      {isSelected ? `#${order + 1}` : '·'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">{pack.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{pack.key}</span>
                        {pack.isSystem ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-warning)]/40 text-[color:var(--state-warning)] border border-amber-800">
                            SYSTEM
                          </span>
                        ) : null}
                      </div>
                      {pack.description ? (
                        <p className="text-xs text-zinc-500 mt-0.5">{pack.description}</p>
                      ) : null}
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {pack.questions.length} question{pack.questions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/30 text-indigo-100'
                          : 'border-surface-border text-zinc-500'
                      }`}
                    >
                      {isSelected ? 'Linked' : 'Link'}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-surface-border">
          <span className="text-xs text-zinc-500">
            {selected.size} pack{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Link
              href={projectTypeId ? `/project-types/${projectTypeId}` : '/project-types'}
              className="px-3 py-1.5 rounded border border-surface-border text-zinc-400 hover:text-zinc-200 text-sm"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving || !canEdit}
              data-testid="save-packs"
              className="px-4 py-2 rounded bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}