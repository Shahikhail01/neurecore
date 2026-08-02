"use client";

/**
 * /packages/[id]/edit — Phase 10 Package edit view.
 *
 * Loads the existing package, lets the admin modify the composition via the
 * PackageComposition patch endpoint (atomic).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { packagesService, type Package, type PackageComposition } from '@/services/packages.service';
import { featuresPoolService, type Feature, type FeatureCategory } from '@/services/featuresPool.service';
import { departmentsPoolService, type DepartmentPoolEntry } from '@/services/departmentsPool.service';
import { agentsPoolService, type AgentsPoolEntry } from '@/services/agentsPool.service';
import { PackagePreview } from '@/components/package/PackagePreview';
import { PackageInheritanceBanner } from '@/components/packages/PackageInheritanceBanner';

const EMPTY_PREVIEW = {
  totals: { departments: 0, agents: 0, features: 0 },
  missing: { departments: [] as string[], agents: [] as string[], features: [] as string[] },
  categories: {} as Record<string, number>,
};

export default function EditPackagePage() {
  const user = useAdminAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allDepartments, setAllDepartments] = useState<DepartmentPoolEntry[]>([]);
  const [allAgents, setAllAgents] = useState<AgentsPoolEntry[]>([]);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);

  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [aiAgentIds, setAiAgentIds] = useState<string[]>([]);
  const [featureIds, setFeatureIds] = useState<string[]>([]);

  const [industryId, setIndustryId] = useState('');
  const [tierId, setTierId] = useState('');

  const [preview, setPreview] = useState(EMPTY_PREVIEW);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [pkgData, deptPage, agPage, featPage] = await Promise.all([
          packagesService.get(id),
          departmentsPoolService.list({ limit: 200 }),
          agentsPoolService.list({ limit: 200 }),
          featuresPoolService.list({ limit: 200 }),
        ]);
        if (cancelled) return;
        setPkg(pkgData);
        setIndustryId(pkgData.industryId ?? '');
        setTierId(pkgData.tierId ?? '');
        setAllDepartments(deptPage.items);
        setAllAgents(agPage.items);
        setAllFeatures(featPage.items);
        setDepartmentIds((pkgData.departments ?? []).map((d) => d.id));
        setAiAgentIds((pkgData.aiAgents ?? []).map((a) => a.id));
        setFeatureIds((pkgData.features ?? []).map((f) => f.id));
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

  useEffect(() => {
    if (!industryId || !tierId) {
      setPreview(EMPTY_PREVIEW);
      return;
    }
    void packagesService
      .preview(industryId, tierId, {
        departmentIds,
        aiAgentIds,
        featureIds,
      })
      .then((p) => {
        if (p) setPreview(p);
      })
      .catch((err: unknown) => {
        console.error('Package preview failed:', err);
      });
  }, [industryId, tierId, departmentIds, aiAgentIds, featureIds]);

  const featuresByCategory = useMemo(() => {
    const map: Record<FeatureCategory, Feature[]> = {
      INTEGRATION: [], API: [], COMMUNICATION: [], BRANDING: [],
      ANALYTICS: [], AUTOMATION: [], SECURITY: [], PLATFORM: [],
    };
    for (const f of allFeatures) map[f.category].push(f);
    return map;
  }, [allFeatures]);

  function toggle<T extends string>(setter: (v: T[]) => void, current: T[], id: T) {
    setter(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function save() {
    if (!pkg) return;
    setBusy(true);
    setError(null);
    try {
      const composition: PackageComposition = {
        departmentIds,
        aiAgentIds,
        featureIds,
      };
      const updated = await packagesService.updateComposition(pkg.id, composition);
      setPkg(updated);
      router.push(`/packages/${pkg.id}`);
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
      <div className="max-w-7xl mx-auto space-y-5">
        <Link
          href={`/packages/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to package
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Edit: {pkg?.name}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Composition changes apply atomically.
          </p>
        </div>

        {/* PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §5.8.1 (P9) — cross-group
            inheritance banner. Only renders when this package inherits from
            another via T8 (Phase 5.B). */}
        <PackageInheritanceBanner
          packageSlug={pkg?.slug ?? ''}
          industrySlug={pkg?.industry?.slug}
          tierSlug={pkg?.tier?.slug}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <PickerGroup
              title="Departments"
              items={allDepartments.map((d) => ({ id: d.id, label: d.name, sub: d.slug }))}
              selected={departmentIds}
              onToggle={(x) => toggle(setDepartmentIds, departmentIds, x)}
            />

            <PickerGroup
              title="AI Employees"
              items={allAgents.map((a) => ({ id: a.id, label: a.name, sub: `${a.type} · ${a.model}` }))}
              selected={aiAgentIds}
              onToggle={(x) => toggle(setAiAgentIds, aiAgentIds, x)}
            />

            <div>
              <div className="text-xs text-zinc-400 mb-2">Features</div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {(Object.keys(featuresByCategory) as FeatureCategory[]).map((cat) => {
                  const items = featuresByCategory[cat];
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="rounded-lg bg-surface-overlay border border-surface-border p-2">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{cat}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((f) => {
                          const selected = featureIds.includes(f.id);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => toggle(setFeatureIds, featureIds, f.id)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition ${
                                selected
                                  ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20 text-indigo-200'
                                  : 'border-surface-border text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {f.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link
                href={`/packages/${id}`}
                className="flex-1 text-center py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save Composition'}
              </button>
            </div>
          </div>

          <PackagePreview
            industryName={pkg?.industry?.name}
            tierName={pkg?.tier?.name}
            totals={preview.totals}
            missing={preview.missing}
            categories={preview.categories}
          />
        </div>
      </div>
    </AdminShell>
  );
}

function PickerGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const visible = items.filter(
    (i) => i.label.toLowerCase().includes(filter.toLowerCase()) || (i.sub ?? '').includes(filter),
  );
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs text-zinc-400">{title}</label>
        <span className="text-[10px] text-zinc-600">{selected.length} selected</span>
      </div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${title.toLowerCase()}…`}
        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)] transition mb-2"
      />
      <div className="rounded-lg border border-surface-border bg-surface-overlay p-2 max-h-44 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-2">No matches</div>
        ) : (
          visible.map((i) => {
            const isSelected = selected.includes(i.id);
            return (
              <label
                key={i.id}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-surface transition cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(i.id)}
                  className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                />
                <span className="text-xs text-zinc-200 truncate">{i.label}</span>
                {i.sub && <span className="text-[10px] text-zinc-600 truncate">{i.sub}</span>}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
