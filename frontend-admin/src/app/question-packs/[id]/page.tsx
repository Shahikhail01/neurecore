'use client';

/**
 * /question-packs/[id] — read-only view.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  questionPacksService,
  type QuestionPack,
} from '@/services/questionPacks.service';

export default function QuestionPackDetailPage() {
  const user = useAdminAuth();
  const params = useParams<{ id: string }>();
  const [pack, setPack] = useState<QuestionPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await questionPacksService.get(params.id);
        if (!cancelled) setPack(p);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-3xl mx-auto space-y-5">
        <Link
          href="/question-packs"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to question packs
        </Link>
        {loading ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : error ? (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : pack ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-zinc-100">{pack.name}</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  <span className="font-mono">{pack.key}</span>
                  {' · '}v{pack.version} · {pack.questions.length} question
                  {pack.questions.length !== 1 ? 's' : ''}
                </p>
              </div>
              {canEdit && !pack.isSystem && (
                <Link
                  href={`/question-packs/${pack.id}/edit`}
                  className="px-3 py-1.5 rounded border border-surface-border text-zinc-300 hover:text-zinc-100 text-sm"
                >
                  Edit
                </Link>
              )}
            </div>
            {pack.description ? (
              <p className="text-sm text-zinc-400">{pack.description}</p>
            ) : null}
            <div className="space-y-2">
              {pack.questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-surface-border bg-surface-raised p-3"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-zinc-100 font-medium">
                      {q.label}
                      {q.required ? <span className="text-[color:var(--visual-accent-rose-400)] ml-0.5">*</span> : null}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {q.id} · {q.type}
                    </span>
                  </div>
                  {q.helpText ? (
                    <p className="text-xs text-zinc-500 mt-0.5">{q.helpText}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}