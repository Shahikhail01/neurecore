"use client";

/**
 * /packages/new — Phase 10 Package Composer.
 *
 * 4-step wizard:
 *   1. Identity      — slug, name, description
 *   2. Categorize    — industry + tier
 *   3. Compose       — departments + AI agents + features (pickers)
 *   4. Review        — preview + submit
 *
 * Live preview on the right rail (PackagePreview) updates with each step.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { packagesService, type CreatePackagePayload, type PackageComposition } from '@/services/packages.service';
import type { PackageRecommendationHistoryEntry } from '@/services/packages.service';
import { industriesPoolService, type Industry } from '@/services/industriesPool.service';
import { tiersPoolService, type Tier } from '@/services/tiersPool.service';
import { featuresPoolService, type Feature, type FeatureCategory } from '@/services/featuresPool.service';
import { departmentsPoolService, type DepartmentPoolEntry } from '@/services/departmentsPool.service';
import { agentsPoolService, type AgentsPoolEntry } from '@/services/agentsPool.service';
import { PackagePreview } from '@/components/package/PackagePreview';

const STEPS = ['Identity', 'Categorize', 'Compose', 'Review'] as const;
type Step = (typeof STEPS)[number];

export default function NewPackagePage() {
  const user = useAdminAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('Identity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [industryId, setIndustryId] = useState<string>('');
  const [tierId, setTierId] = useState<string>('');

  // Step 3
  const [allDepartments, setAllDepartments] = useState<DepartmentPoolEntry[]>([]);
  const [allAgents, setAllAgents] = useState<AgentsPoolEntry[]>([]);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [aiAgentIds, setAiAgentIds] = useState<string[]>([]);
  const [featureIds, setFeatureIds] = useState<string[]>([]);

  // Preview (live totals)
  const [preview, setPreview] = useState({
    readiness: { score: 0, label: 'NEEDS_REVIEW' as 'NEEDS_REVIEW' | 'READY' | 'AT_RISK' },
    totals: { departments: 0, agents: 0, features: 0 },
    missing: { departments: [] as string[], agents: [] as string[], features: [] as string[] },
    categories: {} as Record<string, number>,
    rules: {
      conflicts: [] as string[],
      dependencies: [] as string[],
      recommendations: [] as string[],
      recommendationDetails: [] as Array<{ message: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }>,
      suggestedFeatureKeys: [] as string[],
      suggestedBundles: [] as Array<{ key: string; label: string; reason: string; featureKeys: string[]; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>,
    },
  });
  const [recommendationHistory, setRecommendationHistory] = useState<PackageRecommendationHistoryEntry[]>([]);

  useEffect(() => {
    void (async () => {
      const [indPage, tierPage, deptPage, agPage, featPage] = await Promise.all([
        industriesPoolService.list({ limit: 100 }),
        tiersPoolService.list({ limit: 100 }),
        departmentsPoolService.list({ limit: 200 }),
        agentsPoolService.list({ limit: 200 }),
        featuresPoolService.list({ limit: 200 }),
      ]);
      setIndustries(indPage.items);
      setTiers(tierPage.items);
      setAllDepartments(deptPage.items);
      setAllAgents(agPage.items);
      setAllFeatures(featPage.items);
    })().catch(() => {
      /* noop */
    });
  }, []);

  // Refresh preview whenever composition changes.
  useEffect(() => {
    if (!industryId || !tierId) {
      setPreview({
        readiness: { score: 0, label: 'NEEDS_REVIEW' },
        totals: { departments: 0, agents: 0, features: 0 },
        missing: { departments: [], agents: [], features: [] },
        categories: {},
        rules: { conflicts: [], dependencies: [], recommendations: [], recommendationDetails: [], suggestedFeatureKeys: [], suggestedBundles: [] },
      });
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

  useEffect(() => {
    if (!industryId || !tierId) {
      setRecommendationHistory([]);
      return;
    }
    void packagesService
      .recommendationHistory({ industryId, tierId, limit: 6 })
      .then(setRecommendationHistory)
      .catch(() => setRecommendationHistory([]));
  }, [industryId, tierId]);

  const selectedIndustry = useMemo(
    () => industries.find((i) => i.id === industryId),
    [industries, industryId],
  );
  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === tierId),
    [tiers, tierId],
  );

  const featuresByCategory = useMemo(() => {
    const map: Record<FeatureCategory, Feature[]> = {
      INTEGRATION: [],
      API: [],
      COMMUNICATION: [],
      BRANDING: [],
      ANALYTICS: [],
      AUTOMATION: [],
      SECURITY: [],
      PLATFORM: [],
    };
    for (const f of allFeatures) map[f.category].push(f);
    return map;
  }, [allFeatures]);

  const selectedAgents = useMemo(
    () => allAgents.filter((agent) => aiAgentIds.includes(agent.id)),
    [allAgents, aiAgentIds],
  );
  const selectedDepartments = useMemo(
    () => allDepartments.filter((department) => departmentIds.includes(department.id)),
    [allDepartments, departmentIds],
  );
  const governanceSummary = useMemo(() => {
    let approvalBound = 0;
    let citationsRequired = 0;
    let tenantEditable = 0;
    const channels = new Set<string>();

    for (const agent of selectedAgents) {
      const config = (agent.config ?? {}) as Record<string, unknown>;
      if (config.authorityLevel === 'APPROVAL') approvalBound += 1;
      if (config.requiresCitations === true) citationsRequired += 1;
      if (config.allowTenantEditing !== false) tenantEditable += 1;
      if (Array.isArray(config.channels)) {
        for (const channel of config.channels) {
          if (typeof channel === 'string' && channel.trim()) channels.add(channel);
        }
      }
    }

    return {
      approvalBound,
      citationsRequired,
      tenantEditable,
      channels: Array.from(channels),
    };
  }, [selectedAgents]);

  function applySuggestedFeatures() {
    if (preview.rules.suggestedFeatureKeys.length === 0) return;
    void packagesService.acceptRecommendations({
      industryId,
      tierId,
      suggestedFeatureKeys: preview.rules.suggestedFeatureKeys,
      currentFeatureIds: featureIds,
      currentDepartmentIds: departmentIds,
      currentAiAgentIds: aiAgentIds,
    }).then(() => packagesService.recommendationHistory({ industryId, tierId, limit: 6 }))
      .then(setRecommendationHistory)
      .catch(() => {
      /* noop */
    });
    const suggestedIds = allFeatures
      .filter((feature) => preview.rules.suggestedFeatureKeys.includes(feature.key))
      .map((feature) => feature.id);
    setFeatureIds((current) => Array.from(new Set([...current, ...suggestedIds])));
  }

  function dismissSuggestedFeatures(reason: string) {
    if (preview.rules.suggestedFeatureKeys.length === 0) return;
    void packagesService.dismissRecommendations({
      industryId,
      tierId,
      suggestedFeatureKeys: preview.rules.suggestedFeatureKeys,
      reason,
      currentFeatureIds: featureIds,
      currentDepartmentIds: departmentIds,
      currentAiAgentIds: aiAgentIds,
    }).then(() => packagesService.recommendationHistory({ industryId, tierId, limit: 6 }))
      .then(setRecommendationHistory)
      .catch(() => {
        /* noop */
      });
  }

  function snoozeSuggestedFeatures(reason: string, snoozeUntil: string) {
    if (preview.rules.suggestedFeatureKeys.length === 0) return;
    void packagesService.snoozeRecommendations({
      industryId,
      tierId,
      suggestedFeatureKeys: preview.rules.suggestedFeatureKeys,
      reason,
      snoozeUntil,
      currentFeatureIds: featureIds,
      currentDepartmentIds: departmentIds,
      currentAiAgentIds: aiAgentIds,
    }).then(() => packagesService.recommendationHistory({ industryId, tierId, limit: 6 }))
      .then(setRecommendationHistory)
      .catch(() => {
        /* noop */
      });
  }

  function toggle<T extends string>(setter: (v: T[]) => void, current: T[], id: T) {
    setter(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function nextStep() {
    if (step === 'Identity') {
      if (!slug.trim() || !name.trim()) {
        setError('Slug and name are required');
        return;
      }
      setError(null);
      setStep('Categorize');
    } else if (step === 'Categorize') {
      if (!industryId || !tierId) {
        setError('Industry and Tier are required');
        return;
      }
      setError(null);
      setStep('Compose');
    } else if (step === 'Compose') {
      setError(null);
      setStep('Review');
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload: CreatePackagePayload = {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        status: 'DRAFT',
        industryId,
        tierId,
      };
      const created = await packagesService.create(payload);

      const composition: PackageComposition = {
        departmentIds,
        aiAgentIds,
        featureIds,
      };
      await packagesService.updateComposition(created.id, composition);

      router.push(`/packages/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const stepIdx = STEPS.indexOf(step);

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">New Package</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Compose an offering: pick an Industry and Tier, then choose which
            Departments, AI Employees and Features this Package should include.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i <= stepIdx ? 'bg-[color:var(--accent-500)] text-white' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs ${
                  i === stepIdx ? 'text-zinc-100 font-medium' : 'text-zinc-500'
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="text-zinc-700 mx-2">→</span>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
            {step === 'Identity' && (
              <>
                <h2 className="text-sm font-semibold text-zinc-100">Identity</h2>
                <Field label="Slug *">
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="healthcare-hospital-ops"
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm font-mono focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </Field>
                <Field label="Name *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Hospital Operations Package"
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm resize-none focus:outline-none focus:border-[color:var(--accent-500)]"
                  />
                </Field>
              </>
            )}

            {step === 'Categorize' && (
              <>
                <h2 className="text-sm font-semibold text-zinc-100">Categorize</h2>
                <Field label="Industry *">
                  <select
                    value={industryId}
                    onChange={(e) => setIndustryId(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    <option value="">— choose industry —</option>
                    {industries.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tier *">
                  <select
                    value={tierId}
                    onChange={(e) => setTierId(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--accent-500)]"
                  >
                    <option value="">— choose tier —</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {step === 'Compose' && (
              <>
                <h2 className="text-sm font-semibold text-zinc-100">Compose</h2>
                <p className="text-xs text-zinc-500">
                  Select which building blocks belong to this package.
                </p>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    ['Departments', String(selectedDepartments.length)],
                    ['Agents', String(selectedAgents.length)],
                    ['Approval-bound', String(governanceSummary.approvalBound)],
                    ['Channels', governanceSummary.channels.length > 0 ? governanceSummary.channels.join(', ') : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-surface-border bg-surface-overlay/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
                      <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
                    </div>
                  ))}
                </div>
                {preview.rules.suggestedFeatureKeys.length > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-200">Suggested feature bundle available</p>
                      <p className="text-xs text-emerald-300/80">
                        {preview.rules.suggestedFeatureKeys.join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={applySuggestedFeatures}
                      className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-sm text-emerald-100"
                    >
                      Apply suggested
                    </button>
                  </div>
                )}

                <PickerGroup
                  title="Departments"
                  items={allDepartments.map((d) => ({ id: d.id, label: d.name, sub: d.slug }))}
                  selected={departmentIds}
                  onToggle={(id) => toggle(setDepartmentIds, departmentIds, id)}
                />

                <PickerGroup
                  title="AI Employees"
                  items={allAgents.map((a) => ({ id: a.id, label: a.name, sub: `${a.type} · ${a.model}` }))}
                  selected={aiAgentIds}
                  onToggle={(id) => toggle(setAiAgentIds, aiAgentIds, id)}
                />

                <div>
                  <div className="text-xs text-zinc-400 mb-2">Features (grouped by category)</div>
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
              </>
            )}

            {step === 'Review' && (
              <>
                <h2 className="text-sm font-semibold text-zinc-100">Review</h2>
                <ReviewRow label="Slug" value={slug} />
                <ReviewRow label="Name" value={name} />
                <ReviewRow label="Description" value={description || '—'} />
                <ReviewRow label="Industry" value={selectedIndustry?.name ?? '—'} />
                <ReviewRow label="Tier" value={selectedTier?.name ?? '—'} />
                <ReviewRow label="Departments" value={`${departmentIds.length}`} />
                <ReviewRow label="AI Employees" value={`${aiAgentIds.length}`} />
                <ReviewRow label="Features" value={`${featureIds.length}`} />
                <ReviewRow label="Approval-bound agents" value={`${governanceSummary.approvalBound}`} />
                <ReviewRow label="Citations required" value={`${governanceSummary.citationsRequired}`} />
                <ReviewRow label="Tenant-editable agents" value={`${governanceSummary.tenantEditable}`} />
                <ReviewRow label="Channels" value={governanceSummary.channels.join(', ') || '—'} />
                <ReviewRow label="Conflicts" value={`${preview.rules.conflicts.length}`} />
                <ReviewRow label="Dependencies" value={`${preview.rules.dependencies.length}`} />
                <ReviewRow label="Recommendations" value={`${preview.rules.recommendations.length}`} />
                <p className="text-xs text-zinc-500 pt-2">
                  Submitting will create the package as DRAFT. You can publish it from the detail view.
                </p>
              </>
            )}

            {error && (
              <div className="rounded-lg bg-[color:var(--state-danger)] border border-red-800 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
                  else router.push('/packages');
                }}
                className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                {stepIdx === 0 ? 'Cancel' : '← Back'}
              </button>
              {step !== 'Review' ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-[color:var(--state-success)] hover:bg-[color:var(--state-success)] text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {busy ? 'Creating…' : 'Create Package'}
                </button>
              )}
            </div>
          </div>

          <PackagePreview
            industryName={selectedIndustry?.name}
            tierName={selectedTier?.name}
            readiness={preview.readiness}
            totals={preview.totals}
            missing={preview.missing}
            categories={preview.categories}
            rules={preview.rules}
            onApplySuggested={preview.rules.suggestedFeatureKeys.length > 0 ? applySuggestedFeatures : undefined}
            onDismissSuggested={preview.rules.suggestedFeatureKeys.length > 0 ? dismissSuggestedFeatures : undefined}
            onSnoozeSuggested={preview.rules.suggestedFeatureKeys.length > 0 ? snoozeSuggestedFeatures : undefined}
            recommendationHistory={recommendationHistory}
          />
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div>
      <label htmlFor={fieldId} className="text-xs text-zinc-400 mb-1 block">{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactHTMLElement<HTMLElement>, { id: fieldId }) : child
      )}
    </div>
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
  const [selectedOnly, setSelectedOnly] = useState(false);
  const visible = items.filter(
    (i) =>
      (!selectedOnly || selected.includes(i.id)) &&
      (i.label.toLowerCase().includes(filter.toLowerCase()) || (i.sub ?? '').includes(filter)),
  );
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs text-zinc-400">{title}</label>
        <span className="text-[10px] text-zinc-600">{selected.length} selected</span>
      </div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setSelectedOnly((value) => !value)}
          className={`rounded-full px-2 py-1 text-[10px] border ${
            selectedOnly
              ? 'border-[color:var(--accent-500)] text-indigo-200'
              : 'border-surface-border text-zinc-500'
          }`}
        >
          Selected only
        </button>
        <button
          type="button"
          onClick={() => visible.forEach((item) => !selected.includes(item.id) && onToggle(item.id))}
          className="rounded-full px-2 py-1 text-[10px] border border-surface-border text-zinc-500"
        >
          Select visible
        </button>
        <button
          type="button"
          onClick={() => selected.slice().forEach((id) => onToggle(id))}
          className="rounded-full px-2 py-1 text-[10px] border border-surface-border text-zinc-500"
        >
          Clear selected
        </button>
      </div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${title.toLowerCase()}…`}
        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)] transition mb-2"
        aria-label={`Filter ${title.toLowerCase()}`}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items
            .filter((item) => selected.includes(item.id))
            .slice(0, 8)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className="rounded-full border border-[color:var(--accent-500)]/40 bg-[color:var(--accent-500)]/10 px-2 py-0.5 text-[10px] text-indigo-200"
              >
                {item.label} ×
              </button>
            ))}
        </div>
      )}
      <div className="rounded-lg border border-surface-border bg-surface-overlay p-2 max-h-44 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-2">No matches</div>
        ) : (
          visible.map((i) => {
            const isSelected = selected.includes(i.id);
            return (
              <label
                key={i.id}
                htmlFor={`picker-${i.id}`}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-surface transition cursor-pointer"
              >
                <input
                  id={`picker-${i.id}`}
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b border-surface-border/40 py-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-100 truncate max-w-md">{value}</span>
    </div>
  );
}

// Mark motion as used to keep tree-shaking friendly import warning happy.
void motion;
