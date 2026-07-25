'use client';

/**
 * /question-packs/[id]/edit — update a QuestionPack's name, description, questions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { FieldSchemaEditor, type EditingField } from '@/components/project-types/FieldSchemaEditor';
import {
  questionPacksService,
  type QuestionPack,
  type InformationRequirement,
} from '@/services/questionPacks.service';

export default function EditQuestionPackPage() {
  const user = useAdminAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pack, setPack] = useState<QuestionPack | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<InformationRequirement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await questionPacksService.get(params.id);
        if (!cancelled) {
          setPack(p);
          setName(p.name);
          setDescription(p.description ?? '');
          setQuestions(p.questions);
        }
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

  async function save() {
    if (!pack) return;
    setBusy(true);
    setError(null);
    try {
      await questionPacksService.update(pack.id, {
        name: name.trim(),
        description: description || undefined,
        questions,
      });
      router.push(`/question-packs/${pack.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-3xl mx-auto space-y-5">
        <Link
          href={pack ? `/question-packs/${pack.id}` : '/question-packs'}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back
        </Link>
        {loading ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : pack ? (
          <>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                Edit <span className="font-mono text-indigo-300">{pack.key}</span>
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Updating bumps the pack's version on save.
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Name <span className="text-[color:var(--state-danger)]">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Questions</p>
                <FieldSchemaEditor
                  fields={questions.map(
                    (q): EditingField => ({
                      key: q.id,
                      label: q.label,
                      type:
                        q.type === 'BOOLEAN' || q.type === 'CURRENCY' ? 'TEXT' : q.type,
                      required: q.required,
                      options: q.options ?? [],
                    }),
                  )}
                  onChange={(next) =>
                    setQuestions(
                      next.map(
                        (f, i): InformationRequirement => ({
                          ...questions[i],
                          id: f.key,
                          label: f.label,
                          type: f.type as InformationRequirement['type'],
                          required: f.required,
                          options: f.options,
                        }),
                      ),
                    )
                  }
                />
              </div>
              {error ? (
                <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              <div className="flex gap-3 pt-2">
                <Link
                  href={pack ? `/question-packs/${pack.id}` : '/question-packs'}
                  className="flex-1 text-center py-2.5 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !canEdit || !name.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
                  data-testid="pack-edit-save"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}