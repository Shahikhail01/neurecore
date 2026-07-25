'use client';

/**
 * /tenants/[id]/industry
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.2 G9 (Phase 1 G9) — Super-Admin-only page
 * that lets the platform admin change a tenant's industry. This is the
 * ONLY place in the platform where `Tenant.industry` can be mutated
 * post-onboarding per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7 (industry is
 * set at onboarding and never re-picked by the tenant).
 *
 * The backend route `PATCH /api/v1/tenants/:id { industry }` already
 * exists and auto-derives `industryGroup` via the
 * `IndustryGroupsService.resolveIndustryGroup()` helper wired in Phase 0
 * G1, so this page just sends the industry slug and the server handles
 * the cascade.
 *
 * UI: simple form with current industry displayed, a select of all 16
 * canonical industries grouped by their parent group, and a Save button.
 *
 * (Admin frontend doesn't ship lucide-react — we use inline SVG icons to
 * match the existing /tenants/new and /tenants/[id] style.)
 */

import { useEffect, useState, useCallback, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  INDUSTRY_GROUP_BY_INDUSTRY,
  INDUSTRY_GROUP_LABELS,
} from '@/lib/industries';

interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  industryGroup: string | null;
}

/** Inline SVG icons — admin shell doesn't ship lucide-react. */
function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TenantIndustryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const user = useAdminAuth();

  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');

  // Load tenant + initialise the select with the current value.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get(`/tenants/${tenantId}`);
        const t: TenantResponse =
          (res.data?.data as TenantResponse | undefined) ??
          (res.data as TenantResponse);
        if (cancelled) return;
        setTenant(t);
        setSelectedIndustry(t.industry ?? '');
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load tenant',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, user]);

  // Group industries by their industry-group slug for a cleaner picker.
  // Uses the canonical INDUSTRY_GROUP_BY_INDUSTRY map from src/lib/industries.ts
  // — DRY with the tenant frontend's `industryGroups.ts` definition.
  const groupedIndustries = useMemo(() => {
    const map = new Map<string, Array<{ slug: string; label: string }>>();
    for (const slug of INDUSTRIES) {
      const group = INDUSTRY_GROUP_BY_INDUSTRY[slug] ?? 'other';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ slug, label: INDUSTRY_LABELS[slug] });
    }
    return map;
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.patch(`/tenants/${tenantId}`, {
        industry: selectedIndustry || null,
      });
      setSuccess(true);
      // Re-fetch to surface the server-derived industryGroup.
      const res = await api.get(`/tenants/${tenantId}`);
      const t: TenantResponse =
        (res.data?.data as TenantResponse | undefined) ??
        (res.data as TenantResponse);
      setTenant(t);
      // Brief confirmation; auto-dismiss after 2s.
      window.setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save industry',
      );
    } finally {
      setSaving(false);
    }
  }, [tenantId, selectedIndustry]);

  const isDirty = tenant?.industry !== selectedIndustry;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (!user) return null;

  const labelOf = (slug: string | null | undefined): string => {
    if (!slug) return 'None';
    return (
      INDUSTRY_LABELS[slug as keyof typeof INDUSTRY_LABELS] ?? slug
    );
  };

  return (
    <AdminShell user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/tenants/${tenantId}`)}
            className="text-sm text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-1"
          >
            <IconArrowLeft className="w-3 h-3" /> Back to tenant
          </button>
          <h1 className="text-2xl font-bold">Change Industry</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tenant{' '}
            <strong className="text-gray-200">
              {tenant?.name ?? tenantId}
            </strong>
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="mb-4 rounded-lg bg-[color:var(--state-warning)] border border-amber-800 p-3 text-sm text-amber-300 flex items-start gap-2">
            <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Only SUPER_ADMIN can change a tenant&apos;s industry. Your role
              is <strong>{user.role}</strong>; changes will be rejected by
              the server.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-[color:var(--state-danger)] border border-red-800 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg bg-[color:var(--state-success)] border border-green-800 p-3 text-sm text-green-300 flex items-center gap-2"
          >
            <IconCheck className="w-4 h-4" /> Industry updated.
          </motion.div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading tenant…</div>
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Industry
              </label>
              <select
                id="industry"
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                disabled={!isSuperAdmin || saving}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">— None (industry unset) —</option>
                {Array.from(groupedIndustries.entries()).map(
                  ([groupSlug, items]) => (
                    <optgroup
                      key={groupSlug}
                      label={INDUSTRY_GROUP_LABELS[groupSlug] ?? groupSlug}
                    >
                      {items.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Changing this updates <code>Tenant.industry</code> and the
                server auto-derives <code>Tenant.industryGroup</code> (Phase 0
                G1). The icon rail, stub pages, and integrations filter will
                pick up the new group on next page load.
              </p>
            </div>

            {isDirty && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-md bg-[color:var(--state-warning)]/40 border border-amber-800/60 p-3 text-xs text-amber-300"
              >
                <strong>Pending change:</strong> {labelOf(tenant?.industry)}{' '}
                → {labelOf(selectedIndustry)}
              </motion.div>
            )}

            <div className="text-xs text-gray-500">
              Resolved group:{' '}
              <strong className="text-gray-300">
                {tenant?.industryGroup
                  ? INDUSTRY_GROUP_LABELS[tenant.industryGroup] ??
                    tenant.industryGroup
                  : '—'}
              </strong>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => void handleSave()}
                disabled={!isDirty || !isSuperAdmin || saving}
                className="px-6 py-2 rounded-lg bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition flex items-center gap-1.5"
              >
                <IconSave className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save Industry'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/tenants/${tenantId}`)}
                className="px-6 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
