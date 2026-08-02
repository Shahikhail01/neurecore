"use client";

/**
 * /tiers — Tier Management page (TIER-SYSTEM-CONCEPT.md Phase 3).
 *
 * Tier is the canonical billing tier (single source of truth).
 * The legacy TierTemplate pool was removed in Phase 3.
 */

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePoolList } from '@/hooks/usePoolList';
import { PoolToolbar } from '@/components/pool/PoolToolbar';
import { PoolPagination } from '@/components/pool/PoolPagination';
import { PoolEmptyState } from '@/components/pool/PoolEmptyState';
import {
  tiersPoolService,
  type Tier,
  type CreateTierPayload,
} from '@/services/tiersPool.service';

export default function TiersPage() {
  const user = useAdminAuth();
  const [search, setSearch] = useState('');
  const { items, total, page: currentPage, totalPages, limit, loading, refresh, setOpts } = usePoolList<
    Tier,
    CreateTierPayload
  >(tiersPoolService);

  useEffect(() => {
    setOpts({ search, sortBy: 'sortOrder', sortDir: 'asc', page: 1, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [editing, setEditing] = useState<Tier | null>(null);
  const [creating, setCreating] = useState(false);

  const canEdit = user?.role === 'SUPER_ADMIN';

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        const matchesSearch =
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      }),
    [items, search],
  );

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Tiers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Canonical billing tiers (Basic / Business / Professional / Enterprise). Controls pricing,
              limits, and feature flags for tenant subscriptions.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-sm font-medium transition"
            >
              + New Tier
            </button>
          )}
        </div>

        <PoolToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tiers…"
          count={total}
          countLabel="tiers"
        />

        {loading ? (
          <div className="text-center py-12 text-sm text-zinc-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <PoolEmptyState title="No tiers match your filters" hint="Try clearing the search." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                canEdit={canEdit}
                onEdit={() => setEditing(tier)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <PoolPagination
            page={currentPage}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={(p) => setOpts({ page: p })}
          />
        )}

        {(creating || editing) && (
          <TierEditModal
            tier={editing}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSaved={() => {
              setEditing(null);
              setCreating(false);
              refresh();
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}

function TierCard({ tier, canEdit, onEdit }: { tier: Tier; canEdit: boolean; onEdit: () => void }) {
  return (
    <div
      onClick={canEdit ? onEdit : undefined}
      className={`relative p-5 rounded-xl border border-surface-border bg-surface-raised ${
        canEdit ? 'cursor-pointer hover:border-accent-500/40' : ''
      } transition`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">{tier.name}</h3>
            {tier.isDefault && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]">
                Default
              </span>
            )}
            {!tier.isActive && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-700 text-zinc-400">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{tier.slug}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-zinc-100">
            ${typeof tier.monthlyPrice === 'string' ? parseFloat(tier.monthlyPrice).toFixed(0) : tier.monthlyPrice}
            <span className="text-xs text-zinc-500 font-normal">/mo</span>
          </div>
          {tier.trialDays && (
            <p className="text-[10px] text-[color:var(--state-success)]">{tier.trialDays}-day trial</p>
          )}
        </div>
      </div>

      {tier.tagline && (
        <p className="text-sm text-zinc-400 mt-3">{tier.tagline}</p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        <LimitRow label="Users" value={tier.maxUsers >= 9999 ? '∞' : tier.maxUsers} />
        <LimitRow label="Agents" value={tier.maxAgents >= 9999 ? '∞' : tier.maxAgents} />
        <LimitRow label="Storage" value={`${tier.maxStorageGB >= 1000 ? '∞' : `${tier.maxStorageGB} GB`}`} />
        <LimitRow label="API calls" value={tier.maxApiCalls >= 999999 ? '∞' : tier.maxApiCalls.toLocaleString()} />
      </div>

      <div className="flex flex-wrap gap-1 mt-4">
        {tier.allowApiAccess && <FeatureChip>API</FeatureChip>}
        {tier.allowSso && <FeatureChip>SSO</FeatureChip>}
        {tier.allowAuditExport && <FeatureChip>Audit Export</FeatureChip>}
        {tier.allowPredictiveAnalytics && <FeatureChip>Predictive</FeatureChip>}
        {tier.allowWhiteLabel && <FeatureChip>White Label</FeatureChip>}
        {tier.allowMultiOffice && <FeatureChip>Multi-Office</FeatureChip>}
      </div>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-surface-overlay px-2.5 py-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium">{value}</span>
    </div>
  );
}

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[color:var(--accent-500)]/15 text-indigo-300">
      {children}
    </span>
  );
}

function TierEditModal({
  tier,
  onClose,
  onSaved,
}: {
  tier: Tier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !tier;
  const [form, setForm] = useState<Partial<CreateTierPayload>>(() => {
    if (!tier) return { slug: '', name: '', monthlyPrice: 0, yearlyPrice: 0 };
    // Map Tier → CreateTierPayload (drop server-managed fields like id/createdAt).
    return {
      slug: tier.slug,
      name: tier.name,
      tagline: tier.tagline ?? undefined,
      description: tier.description ?? undefined,
      icon: tier.icon ?? undefined,
      isActive: tier.isActive,
      isDefault: tier.isDefault,
      sortOrder: tier.sortOrder,
      monthlyPrice: typeof tier.monthlyPrice === 'string' ? Number(tier.monthlyPrice) : tier.monthlyPrice,
      yearlyPrice: typeof tier.yearlyPrice === 'string' ? Number(tier.yearlyPrice) : tier.yearlyPrice,
      currency: tier.currency,
      billingCycle: tier.billingCycle,
      trialDays: tier.trialDays ?? undefined,
      maxUsers: tier.maxUsers,
      maxAgents: tier.maxAgents,
      maxDepartments: tier.maxDepartments,
      maxStorageGB: tier.maxStorageGB,
      maxApiCalls: tier.maxApiCalls,
      maxConversationMessages: tier.maxConversationMessages,
      maxFileSizeMB: tier.maxFileSizeMB,
      maxApprovalStages: tier.maxApprovalStages,
      allowCustomBranding: tier.allowCustomBranding,
      allowApiAccess: tier.allowApiAccess,
      allowSso: tier.allowSso,
      allowAuditExport: tier.allowAuditExport,
      allowWhiteLabel: tier.allowWhiteLabel,
      allowPredictiveAnalytics: tier.allowPredictiveAnalytics,
      allowCustomDashboards: tier.allowCustomDashboards,
      allowMultiOffice: tier.allowMultiOffice,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await tiersPoolService.create(form as CreateTierPayload);
      } else if (tier) {
        await tiersPoolService.update(tier.id, form);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-raised p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {isNew ? 'New Tier' : `Edit ${tier!.name}`}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              All changes are logged to tier_audit_logs for traceability.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-[color:var(--state-danger)]/15 border border-[color:var(--state-danger)]/30 text-red-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <Section title="Identity">
          <Grid2>
            <Field label="Slug" value={form.slug ?? ''} onChange={(v) => setForm({ ...form, slug: v })} disabled={!isNew} />
            <Field label="Name" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Tagline" value={form.tagline ?? ''} onChange={(v) => setForm({ ...form, tagline: v })} wide />
            <Field label="Icon (lucide name)" value={form.icon ?? ''} onChange={(v) => setForm({ ...form, icon: v })} />
          </Grid2>
        </Section>

        <Section title="Pricing">
          <Grid2>
            <NumField label="Monthly Price ($)" value={form.monthlyPrice ?? 0} onChange={(v) => setForm({ ...form, monthlyPrice: v })} />
            <NumField label="Yearly Price ($)" value={form.yearlyPrice ?? 0} onChange={(v) => setForm({ ...form, yearlyPrice: v })} />
            <SelectField
              label="Billing Cycle"
              value={form.billingCycle ?? 'monthly'}
              options={[{ label: 'Monthly', value: 'monthly' }, { label: 'Yearly', value: 'yearly' }]}
              onChange={(v) => setForm({ ...form, billingCycle: v as 'monthly' | 'yearly' })}
            />
            <NumField label="Trial Days" value={form.trialDays ?? 0} onChange={(v) => setForm({ ...form, trialDays: v })} />
          </Grid2>
        </Section>

        <Section title="Limits">
          <Grid2>
            <NumField label="Max Users" value={form.maxUsers ?? 0} onChange={(v) => setForm({ ...form, maxUsers: v })} />
            <NumField label="Max Agents" value={form.maxAgents ?? 0} onChange={(v) => setForm({ ...form, maxAgents: v })} />
            <NumField label="Max Departments" value={form.maxDepartments ?? 0} onChange={(v) => setForm({ ...form, maxDepartments: v })} />
            <NumField label="Max Storage (GB)" value={form.maxStorageGB ?? 0} onChange={(v) => setForm({ ...form, maxStorageGB: v })} />
            <NumField label="Max API Calls" value={form.maxApiCalls ?? 0} onChange={(v) => setForm({ ...form, maxApiCalls: v })} />
            <NumField label="Max Approval Stages" value={form.maxApprovalStages ?? 1} onChange={(v) => setForm({ ...form, maxApprovalStages: v })} />
          </Grid2>
        </Section>

        <Section title="Feature Flags">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['allowCustomBranding', 'Custom Branding'],
              ['allowApiAccess', 'API Access'],
              ['allowSso', 'SSO'],
              ['allowAuditExport', 'Audit Export'],
              ['allowWhiteLabel', 'White Label'],
              ['allowPredictiveAnalytics', 'Predictive Analytics'],
              ['allowCustomDashboards', 'Custom Dashboards'],
              ['allowMultiOffice', 'Multi-Office'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md bg-surface-overlay px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean((form as Record<string, unknown>)[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="rounded border-surface-border"
                />
                <span className="text-zinc-200">{label}</span>
              </label>
            ))}
          </div>
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white text-sm font-medium transition"
          >
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  disabled,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={`space-y-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-md bg-surface-overlay border border-surface-border text-zinc-100 text-sm focus:outline-none focus:border-accent-500 disabled:opacity-50"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-md bg-surface-overlay border border-surface-border text-zinc-100 text-sm focus:outline-none focus:border-accent-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md bg-surface-overlay border border-surface-border text-zinc-100 text-sm focus:outline-none focus:border-accent-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
