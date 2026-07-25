'use client';

/**
 * /question-packs/new — create a QuestionPack.
 *
 * Phase 2D. Reuses FieldEditor / FieldSchemaEditor shape from the project-types
 * admin for consistency.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { FieldSchemaEditor, type EditingField } from '@/components/project-types/FieldSchemaEditor';
import {
  questionPacksService,
  type QuestionPack,
  type InformationRequirement,
} from '@/services/questionPacks.service';

export default function NewQuestionPackPage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<InformationRequirement[]>([
    {
      id: 'questionId',
      label: 'Sample question',
      type: 'TEXT',
      required: true,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  async function save() {
    if (!key.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created: QuestionPack = await questionPacksService.create({
        key: key.trim(),
        name: name.trim(),
        description: description || undefined,
        questions,
      });
      router.push(`/question-packs/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

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
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">New Question Pack</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Capability-based question set. Use lowercase-hyphenated keys (e.g.{" "}
            <code>core</code>, <code>healthcare</code>, <code>compliance</code>).
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Key <span className="text-[color:var(--state-danger)]">*</span>
              </label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. compliance"
                data-testid="pack-key"
                className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Name <span className="text-[color:var(--state-danger)]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Compliance"
                data-testid="pack-name"
                className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>
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
              href="/question-packs"
              className="flex-1 text-center py-2.5 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={busy || !canEdit || !key.trim() || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
              data-testid="pack-save"
            >
              {busy ? 'Creating…' : 'Create Question Pack'}
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}