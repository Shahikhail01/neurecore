"use client";

/**
 * /project-types/[id] — Phase 2 ProjectType detail view.
 *
 * Shows the project type and its versions with the ability to add new versions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  projectTypesService,
  type ProjectType,
  type ProjectTypeVersion,
} from '@/services/projectTypes.service';

export default function ProjectTypeDetailPage() {
  const user = useAdminAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [pt, setPt] = useState<ProjectType | null>(null);
  const [versions, setVersions] = useState<ProjectTypeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [ptData, versionsData] = await Promise.all([
          projectTypesService.get(id),
          projectTypesService.listVersions(id),
        ]);
        if (!cancelled) {
          setPt(ptData);
          setVersions(versionsData);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        <Link
          href="/project-types"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to project types
        </Link>

        {loading ? (
          <div className="h-32 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
        ) : error ? (
          <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : pt ? (
          <>
            <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">{pt.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {pt.industry && (
                      <span className="text-xs text-zinc-400">{pt.industry}</span>
                    )}
                    {pt.isSystem && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-warning)]/40 text-[color:var(--state-warning)] border border-amber-800">
                        SYSTEM
                      </span>
                    )}
                    {pt.tenantId === null && !pt.isSystem && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        TENANT
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Link
                    href={`/project-types/${pt.id}/edit`}
                    className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-[color:var(--accent-500)] transition"
                  >
                    Edit Latest Version
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Versions ({versions.length})
                </h2>
                {canEdit && (
                  <Link
                    href={`/project-types/${pt.id}/edit`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white font-medium transition"
                  >
                    + New Version
                  </Link>
                )}
              </div>

              {versions.length === 0 ? (
                <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
                  <p className="text-sm text-zinc-500">No versions yet.</p>
                  {canEdit && (
                    <Link
                      href={`/project-types/${pt.id}/edit`}
                      className="mt-2 inline-block text-xs text-[color:var(--accent-400)] hover:underline"
                    >
                      Create the first version
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((v) => (
                    <VersionCard key={v.id} version={v} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function VersionCard({ version }: { version: ProjectTypeVersion }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-border bg-surface-raised p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">
              Version {version.version}
            </h3>
            {version.version === 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--state-success)]/40 text-[color:var(--state-success)] border border-emerald-800">
                LATEST
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Created {new Date(version.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Fields</p>
          <p className="text-xs text-zinc-300">
            {version.fieldSchema?.length ?? 0} defined
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Stages</p>
          <p className="text-xs text-zinc-300">
            {version.stageTemplate?.length ?? 0} stages
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Approvals</p>
          <p className="text-xs text-zinc-300">
            {version.approvalTemplate?.length ?? 0} steps
          </p>
        </div>
      </div>

      {version.fieldSchema && version.fieldSchema.length > 0 && (
        <div className="mt-3 border-t border-surface-border/50 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Field Schema</p>
          <div className="flex flex-wrap gap-1.5">
            {version.fieldSchema.map((f) => (
              <span
                key={f.key}
                className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-surface-border"
              >
                {f.label}
                {f.required && <span className="text-[color:var(--state-danger)] ml-0.5">*</span>}
                <span className="ml-1 text-zinc-600">({f.type})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {version.stageTemplate && version.stageTemplate.length > 0 && (
        <div className="mt-3 border-t border-surface-border/50 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Stage Template</p>
          <div className="space-y-1">
            {version.stageTemplate
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="text-zinc-600 w-4">{s.order + 1}.</span>
                  <span>{s.name}</span>
                  {s.defaultDurationDays && (
                    <span className="text-zinc-600">{s.defaultDurationDays}d</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
