"use client";

/**
 * /project-types/[id]/edit — Phase 2 Version editor.
 *
 * Creates a new version of a project type with field schema + stage template.
 *
 * Composed of dedicated components (per plan §5.2):
 *  - FieldSchemaEditor + FieldEditor
 *  - StageTemplateEditor + StageEditor
 *  - ApprovalTemplateEditor
 *  - GoalTemplateEditor
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  projectTypesService,
  type ProjectType,
  type FieldSchemaItem,
  type StageTemplateItem,
  type ApprovalStep,
  type GoalTemplate,
  type InformationRequirement,
} from '@/services/projectTypes.service';
import { projectTypePacksService } from '@/services/questionPacks.service';
import { FieldSchemaEditor, type EditingField } from '@/components/project-types/FieldSchemaEditor';
import { StageTemplateEditor, type EditingStage } from '@/components/project-types/StageTemplateEditor';
import { ApprovalTemplateEditor } from '@/components/project-types/ApprovalTemplateEditor';
import { GoalTemplateEditor } from '@/components/project-types/GoalTemplateEditor';

export default function EditProjectTypePage() {
  const user = useAdminAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [pt, setPt] = useState<ProjectType | null>(null);
  const [fields, setFields] = useState<EditingField[]>([]);
  const [stages, setStages] = useState<EditingStage[]>([]);
  const [approvals, setApprovals] = useState<ApprovalStep[]>([]);
  const [goals, setGoals] = useState<GoalTemplate[]>([]);
  const [linkedPackCount, setLinkedPackCount] = useState(0);
  const [resolvedQCount, setResolvedQCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [ptData, currentVersion, linkedPacks] = await Promise.all([
          projectTypesService.get(id),
          projectTypesService.getCurrentVersion(id),
          projectTypePacksService.list(id).catch(() => []),
        ]);
        if (cancelled) return;
        setPt(ptData);
        setLinkedPackCount(linkedPacks.length);

        if (currentVersion) {
          setFields(
            (currentVersion.fieldSchema ?? []).map((f: FieldSchemaItem) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              required: f.required ?? false,
              options: f.options ?? [],
            })),
          );
          setStages(
            (currentVersion.stageTemplate ?? []).map((s: StageTemplateItem) => ({
              name: s.name,
              order: s.order,
              defaultDurationDays: s.defaultDurationDays ?? 0,
            })),
          );
          setApprovals(
            (currentVersion.approvalTemplate ?? []).map((a) => ({ ...a })),
          );
          setGoals(
            (currentVersion.goalTemplate ?? []).map((g) => ({ ...g })),
          );
          const inlineCount = (currentVersion.informationRequirements ?? []).length;
          const linkedCount = linkedPacks.reduce(
            (sum, l) => sum + (l.questionPack?.questions?.length ?? 0),
            0,
          );
          setResolvedQCount(inlineCount + linkedCount);
        } else {
          setFields([]);
          setStages([]);
          setApprovals([]);
          setGoals([]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    if (!pt) return;
    setBusy(true);
    setError(null);
    try {
      const fieldSchema: FieldSchemaItem[] = fields
        .filter((f) => f.key.trim() && f.label.trim())
        .map((f) => ({
          key: f.key.trim(),
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          options: f.options.filter(Boolean),
        }));

      const stageTemplate: StageTemplateItem[] = stages
        .filter((s) => s.name.trim())
        .map((s, idx) => ({
          name: s.name.trim(),
          order: idx,
          defaultDurationDays:
            s.defaultDurationDays > 0 ? s.defaultDurationDays : undefined,
        }));

      await projectTypesService.createVersion(pt.id, {
        fieldSchema,
        stageTemplate,
        approvalTemplate: approvals,
        goalTemplate: goals.filter((g) => g.title.trim()),
      });
      router.push(`/project-types/${pt.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <AdminShell user={user}>
        <div className="max-w-5xl mx-auto">
          <div className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        <Link
          href={`/project-types/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to {pt?.name ?? 'project type'}
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            New Version: {pt?.name}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Define the field schema, stage template, approval chain, and goal template.
            Versions are immutable once created.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Field Schema">
            <FieldSchemaEditor fields={fields} onChange={setFields} readOnly={!canEdit} />
          </Section>

          <Section title="Stage Template">
            <StageTemplateEditor stages={stages} onChange={setStages} readOnly={!canEdit} />
          </Section>

          <Section title="Approval Template">
            <ApprovalTemplateEditor
              steps={approvals}
              onChange={setApprovals}
              readOnly={!canEdit}
            />
          </Section>

          <Section title="Goal Template">
            <GoalTemplateEditor goals={goals} onChange={setGoals} readOnly={!canEdit} />
          </Section>
        </div>

        <Section title="Information Requirements (read-only summary)">
          <div className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-400">
                Linked capability packs
              </span>
              <Link
                href={`/project-types/${id}/packs`}
                className="text-indigo-300 hover:underline font-mono text-xs"
                data-testid="ir-pack-link"
              >
                {linkedPackCount} linked →
              </Link>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-400">Resolved questions (after merge)</span>
              <span className="text-zinc-100 font-mono text-xs">{resolvedQCount}</span>
            </div>
            <p className="text-[11px] text-zinc-500 pt-1">
              The Information Engine merges this type's{' '}
              <code>informationRequirements</code> with the linked packs to compute the
              flat question list shown to users during project creation. Editing the
              inline list lives in a separate future editor (out of scope for 2D).
            </p>
          </div>
        </Section>

        {error && (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-surface-border">
          <Link
            href={`/project-types/${id}`}
            className="flex-1 text-center py-2.5 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={busy || !canEdit}
            className="flex-1 py-2.5 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {busy ? 'Creating Version…' : 'Create Version'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      {children}
    </div>
  );
}
