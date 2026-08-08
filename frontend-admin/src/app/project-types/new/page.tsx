"use client";

/**
 * /project-types/new — Phase 2 Create project type.
 *
 * Simple form to create a new project type. Versions are created separately
 * from the type detail page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  projectTypesService,
  type ProjectTypeClassification,
} from '@/services/projectTypes.service';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/industries';

const CLASSIFICATIONS: ProjectTypeClassification[] = [
  'CLIENT_ENGAGEMENT',
  'INTERNAL_INITIATIVE',
  'OPERATIONAL_PROGRAM',
];

export default function NewProjectTypePage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [classification, setClassification] = useState<ProjectTypeClassification | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await projectTypesService.create({
        name: name.trim(),
        industry: industry || undefined,
        classification: classification || undefined,
      });
      // Per §5.2.3: after create, route to /packs so the admin wires packs
      // before editing fields/stages.
      router.push(`/project-types/${created.id}/packs`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link
          href="/project-types"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to project types
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-zinc-100">New Project Type</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Create a project type, then wire its capability packs (Phase 2D flow).
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
          <div>
            <label htmlFor="pt-new-name" className="block text-xs text-zinc-400 mb-1.5">
              Name <span className="text-[color:var(--state-danger)]">*</span>
            </label>
            <input
              id="pt-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tax Return (US 1040)"
              className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
            />
          </div>

          <div>
            <label htmlFor="pt-new-industry" className="block text-xs text-zinc-400 mb-1.5">Industry</label>
            <select
              id="pt-new-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
            >
              <option value="">— None —</option>
              {INDUSTRIES.map((slug) => (
                <option key={slug} value={slug}>
                  {INDUSTRY_LABELS[slug]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pt-new-classification" className="block text-xs text-zinc-400 mb-1.5">
              Classification
              <span className="ml-1 text-[10px] text-zinc-500">(3-class taxonomy)</span>
            </label>
            <select
              id="pt-new-classification"
              value={classification}
              onChange={(e) =>
                setClassification(e.target.value as ProjectTypeClassification | '')
              }
              className="w-full px-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-[color:var(--accent-500)]"
            >
              <option value="">— None —</option>
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Link
              href="/project-types"
              className="flex-1 text-center py-2.5 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={busy || !canEdit || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Next: Wire Packs →'}
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
