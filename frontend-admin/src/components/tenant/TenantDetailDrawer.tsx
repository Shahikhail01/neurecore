'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Tenant } from '@/types/api.types';
import {
  tenantsService,
  type TenantUsageSummary,
  type PasswordResetResult,
} from '@/services/tenants.service';

interface TenantDetailDrawerProps {
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  canManage: boolean;
}

type Section = 'overview' | 'usage' | 'billing' | 'limits' | 'links';

export function TenantDetailDrawer({
  tenantId,
  open,
  onClose,
  onChanged,
  canManage,
}: TenantDetailDrawerProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [usage, setUsage] = useState<TenantUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');

  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<PasswordResetResult | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load tenant');
      const json = await res.json();
      const payload = (json?.data ?? json) as Tenant;
      setTenant(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadUsage = useCallback(async () => {
    if (!tenantId) return;
    setUsageLoading(true);
    try {
      const summary = await tenantsService.getUsage(tenantId);
      setUsage(summary);
    } catch {
      // Non-fatal — usage section just shows "—" counters.
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open && tenantId) {
      void load();
      void loadUsage();
    }
    if (!open) {
      setTenant(null);
      setUsage(null);
      setResetResult(null);
      setResetError(null);
      setSection('overview');
    }
  }, [open, tenantId, load, loadUsage]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleResetPassword() {
    if (!tenantId) return;
    setResetBusy(true);
    setResetError(null);
    try {
      const result = await tenantsService.resetOwnerPassword(tenantId);
      setResetResult(result);
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Failed to reset password',
      );
    } finally {
      setResetBusy(false);
    }
  }

  async function handleDelete() {
    if (!tenantId) return;
    setDeleteBusy(true);
    try {
      await tenantsService.deleteTenant(tenantId);
      setDeleteOpen(false);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete tenant',
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && tenantId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-surface-raised border-l border-[color:var(--accent-500)]/30 shadow-2xl flex flex-col"
              role="dialog"
              aria-label="Tenant details"
            >
              <DrawerHeader
                tenant={tenant}
                loading={loading}
                error={error}
                onClose={onClose}
                canManage={canManage}
                onResetPassword={() => setResetOpen(true)}
                onDelete={() => setDeleteOpen(true)}
              />
              <SectionTabs section={section} onChange={setSection} />
              <div className="flex-1 overflow-y-auto p-5">
                {section === 'overview' && (
                  <OverviewSection tenant={tenant} loading={loading} />
                )}
                {section === 'usage' && (
                  <UsageSection usage={usage} loading={usageLoading} />
                )}
                {section === 'billing' && tenantId && (
                  <BillingSection tenantId={tenantId} tenant={tenant} />
                )}
                {section === 'limits' && (
                  <LimitsSection tenant={tenant} usage={usage} />
                )}
                {section === 'links' && tenantId && (
                  <LinksSection tenantId={tenantId} />
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={resetOpen}
        title="Reset tenant owner password?"
        description={
          <div className="space-y-3">
            <p>
              A new temporary password will be generated for this tenant's
              OWNER. You will see it once and must share it with the owner
              through a secure channel.
            </p>
            {resetError && (
              <p className="text-[color:var(--state-danger)] text-xs">
                {resetError}
              </p>
            )}
            {resetResult && (
              <div className="rounded-lg border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 p-3 text-xs space-y-2">
                <p className="text-[color:var(--state-success)] font-medium">
                  Password reset for {resetResult.email}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-zinc-100 bg-black/30 rounded px-2 py-1 break-all">
                    {resetResult.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        resetResult.temporaryPassword,
                      );
                    }}
                    className="rounded border border-[color:var(--accent-500)]/40 px-2 py-1 text-xs hover:bg-white/5"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-zinc-400">
                  Reset at {new Date(resetResult.resetAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        }
        confirmLabel={resetResult ? 'Done' : 'Generate password'}
        busy={resetBusy}
        variant="warning"
        onCancel={() => {
          setResetOpen(false);
          setResetResult(null);
          setResetError(null);
        }}
        onConfirm={() => {
          if (resetResult) {
            setResetOpen(false);
            setResetResult(null);
          } else {
            void handleResetPassword();
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete tenant?"
        description={
          <p>
            This will permanently delete{' '}
            <strong>{tenant?.name ?? 'this tenant'}</strong> and{' '}
            <strong>all</strong> associated data — users, agents,
            departments, conversations, settings, and history. This action{' '}
            <strong>cannot be undone</strong>.
          </p>
        }
        confirmLabel="Delete Everything"
        busy={deleteBusy}
        variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DrawerHeader({
  tenant,
  loading,
  error,
  onClose,
  canManage,
  onResetPassword,
  onDelete,
}: {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  canManage: boolean;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-b border-[color:var(--accent-500)]/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {loading && (
            <p className="text-sm text-zinc-500">Loading tenant…</p>
          )}
          {error && (
            <p className="text-sm text-[color:var(--state-danger)]">
              {error}
            </p>
          )}
          {tenant && (
            <>
              <div className="flex items-center gap-3">
                {tenant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.name}
                    className="h-9 w-9 rounded-md object-cover border border-[color:var(--accent-500)]/30"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-md bg-[color:var(--accent-500)]/20 flex items-center justify-center text-sm font-semibold text-[color:var(--accent-300)]">
                    {tenant.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-zinc-100 truncate">
                    {tenant.name}
                  </h2>
                  <p className="text-xs text-zinc-400 truncate">
                    {tenant.slug} · {tenant.tier?.name ?? tenant.plan ?? '—'}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <TenantStatusBadge status={tenant.status} />
                <span className="text-xs text-zinc-500">
                  Created {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
        >
          ✕
        </button>
      </div>

      {canManage && tenant && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/tenants/${tenant.id}`}
            className="rounded-lg border border-[color:var(--accent-500)]/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition"
          >
            Open full page
          </Link>
          <button
            type="button"
            onClick={onResetPassword}
            className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-900/30 transition"
          >
            Reset Password
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/30 transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function TenantStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]',
    TRIAL: 'border-[color:var(--state-info)]/40 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]',
    SUSPENDED: 'border-amber-700/40 bg-amber-900/20 text-amber-300',
    CANCELLED: 'border-red-800/40 bg-red-900/20 text-red-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'border-[color:var(--accent-500)]/30 bg-white/5 text-zinc-300'}`}
    >
      {status}
    </span>
  );
}

// ─── Section tabs ─────────────────────────────────────────────────────────────

const SECTION_TABS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'usage', label: 'Usage' },
  { id: 'billing', label: 'Billing' },
  { id: 'limits', label: 'Limits' },
  { id: 'links', label: 'Quick Links' },
];

function SectionTabs({
  section,
  onChange,
}: {
  section: Section;
  onChange: (s: Section) => void;
}) {
  return (
    <div className="border-b border-[color:var(--accent-500)]/30 px-5">
      <div className="flex gap-1 overflow-x-auto">
        {SECTION_TABS.map((tab) => {
          const active = tab.id === section;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium transition whitespace-nowrap ${
                active
                  ? 'text-[color:var(--accent-300)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-px bg-[color:var(--accent-500)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview section ─────────────────────────────────────────────────────────

function OverviewSection({
  tenant,
  loading,
}: {
  tenant: Tenant | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (!tenant) {
    return <p className="text-sm text-zinc-500">No tenant data.</p>;
  }
  return (
    <div className="space-y-5 text-sm">
      <Block title="Identity">
        <KeyVal label="Tenant ID" value={<MonoValue value={tenant.id} />} />
        <KeyVal label="Slug" value={tenant.slug} />
        <KeyVal label="Status" value={<TenantStatusBadge status={tenant.status} />} />
        <KeyVal
          label="Created"
          value={new Date(tenant.createdAt).toLocaleString()}
        />
        <KeyVal
          label="Updated"
          value={new Date(tenant.updatedAt).toLocaleString()}
        />
      </Block>

      <Block title="Branding & Contact">
        <KeyVal
          label="Website"
          value={
            tenant.website ? (
              <a
                href={tenant.website}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--accent-300)] hover:underline break-all"
              >
                {tenant.website}
              </a>
            ) : (
              <Dash />
            )
          }
        />
        <KeyVal label="Industry" value={tenant.industry ?? <Dash />} />
        <KeyVal label="Phone" value={tenant.phone ?? <Dash />} />
        <KeyVal
          label="Support Email"
          value={
            tenant.supportEmail ? (
              <a
                href={`mailto:${tenant.supportEmail}`}
                className="text-[color:var(--accent-300)] hover:underline"
              >
                {tenant.supportEmail}
              </a>
            ) : (
              <Dash />
            )
          }
        />
      </Block>

      <Block title="Localization">
        <KeyVal label="Locale" value={tenant.locale ?? <Dash />} />
        <KeyVal label="Timezone" value={tenant.timezone ?? <Dash />} />
        <KeyVal label="Currency" value={tenant.currency ?? <Dash />} />
        <KeyVal
          label="Date format"
          value={tenant.dateFormat ?? <Dash />}
        />
        <KeyVal
          label="Time format"
          value={tenant.timeFormat ?? <Dash />}
        />
        <KeyVal
          label="Fiscal year start"
          value={tenant.fiscalYearStart ?? <Dash />}
        />
      </Block>

      <Block title="Company Profile">
        <KeyVal label="Size" value={tenant.sizeBucket ?? <Dash />} />
        <KeyVal
          label="Founded"
          value={tenant.foundedYear ?? <Dash />}
        />
        <KeyVal
          label="Business type"
          value={tenant.businessType ?? <Dash />}
        />
        <KeyVal
          label="Retention"
          value={tenant.retentionDays ? `${tenant.retentionDays} days` : <Dash />}
        />
      </Block>

      {tenant.addressJson && (
        <Block title="Address">
          <KeyVal
            label="Street"
            value={tenant.addressJson.street ?? <Dash />}
          />
          <KeyVal
            label="City"
            value={tenant.addressJson.city ?? <Dash />}
          />
          <KeyVal
            label="Region"
            value={tenant.addressJson.region ?? <Dash />}
          />
          <KeyVal
            label="Postal"
            value={tenant.addressJson.postal ?? <Dash />}
          />
          <KeyVal
            label="Country"
            value={tenant.addressJson.country ?? <Dash />}
          />
        </Block>
      )}
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs uppercase tracking-wider text-zinc-500 min-w-[110px]">
        {label}
      </span>
      <span className="text-sm text-zinc-200 text-right break-words min-w-0">
        {value ?? <Dash />}
      </span>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--accent-500)]/20 bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
        {title}
      </h3>
      <div className="divide-y divide-[color:var(--accent-500)]/10">
        {children}
      </div>
    </div>
  );
}

function Dash() {
  return <span className="text-zinc-500">—</span>;
}

function MonoValue({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-zinc-300 break-all">{value}</span>
  );
}

// ─── Usage section ────────────────────────────────────────────────────────────

function UsageSection({
  usage,
  loading,
}: {
  usage: TenantUsageSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading usage…</p>;
  }
  if (!usage) {
    return <p className="text-sm text-zinc-500">No usage data available.</p>;
  }

  const cards = [
    { label: 'Users', used: usage.counts.users, limit: usage.tierLimits.maxUsers, pct: usage.utilization.users },
    { label: 'Active users', used: usage.counts.activeUsers, limit: null, pct: null },
    { label: 'Agents', used: usage.counts.agents, limit: usage.tierLimits.maxAgents, pct: usage.utilization.agents },
    { label: 'Departments', used: usage.counts.departments, limit: usage.tierLimits.maxDepartments, pct: usage.utilization.departments },
    { label: 'Projects', used: usage.counts.projects, limit: null, pct: null },
    { label: 'Conversations', used: usage.counts.conversations, limit: null, pct: null },
    { label: 'Invoices', used: usage.counts.invoices, limit: null, pct: null },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[color:var(--accent-500)]/20 bg-white/[0.02] p-3"
          >
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {c.used}
              {c.limit != null && (
                <span className="text-sm text-zinc-500"> / {c.limit}</span>
              )}
            </p>
            {c.pct != null && (
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full ${
                    c.pct >= 90
                      ? 'bg-red-500'
                      : c.pct >= 70
                      ? 'bg-amber-500'
                      : 'bg-[color:var(--accent-500)]'
                  }`}
                  style={{
                    width: `${Math.min(100, c.pct)}%`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Snapshot taken {new Date(usage.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Billing section ──────────────────────────────────────────────────────────

function BillingSection({
  tenantId,
  tenant,
}: {
  tenantId: string;
  tenant: Tenant | null;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-[color:var(--accent-500)]/20 bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Plan
        </h3>
        <p className="text-sm text-zinc-200">
          {tenant?.tier?.name ?? tenant?.plan ?? '—'}
        </p>
        {tenant?.tier && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <KeyVal
              label="Monthly"
              value={
                tenant.tier.monthlyPrice != null
                  ? `${tenant.tier.currency ?? 'USD'} ${tenant.tier.monthlyPrice}`
                  : <Dash />
              }
            />
            <KeyVal
              label="Yearly"
              value={
                tenant.tier.yearlyPrice != null
                  ? `${tenant.tier.currency ?? 'USD'} ${tenant.tier.yearlyPrice}`
                  : <Dash />
              }
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[color:var(--accent-500)]/20 bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Billing actions
        </h3>
        <div className="space-y-2">
          <Link
            href="/billing"
            className="block rounded-lg border border-[color:var(--accent-500)]/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 transition"
          >
            Open Billing console →
          </Link>
          <Link
            href={`/tenants/${tenantId}`}
            className="block rounded-lg border border-[color:var(--accent-500)]/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 transition"
          >
            Tier settings on tenant page →
          </Link>
          <Link
            href="/connectors"
            className="block rounded-lg border border-[color:var(--accent-500)]/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 transition"
          >
            Payment connectors →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Limits section ───────────────────────────────────────────────────────────

function LimitsSection({
  tenant,
  usage,
}: {
  tenant: Tenant | null;
  usage: TenantUsageSummary | null;
}) {
  const limits = usage?.tierLimits ?? tenant?.tier;
  if (!limits) {
    return <p className="text-sm text-zinc-500">No tier limits on file.</p>;
  }
  const items: Array<[string, unknown]> = [
    ['Max users', (limits as Record<string, unknown>).maxUsers],
    ['Max agents', (limits as Record<string, unknown>).maxAgents],
    ['Max departments', (limits as Record<string, unknown>).maxDepartments],
    ['Max storage (GB)', (limits as Record<string, unknown>).maxStorageGB],
    ['Max API calls', (limits as Record<string, unknown>).maxApiCalls],
    ['Max conversation messages', (limits as Record<string, unknown>).maxConversationMessages],
    ['Max file size (MB)', (limits as Record<string, unknown>).maxFileSizeMB],
    [
      'Custom branding',
      (limits as Record<string, unknown>).allowCustomBranding,
    ],
    ['API access', (limits as Record<string, unknown>).allowApiAccess],
    ['SSO', (limits as Record<string, unknown>).allowSso],
    ['Audit export', (limits as Record<string, unknown>).allowAuditExport],
  ];
  return (
    <div className="rounded-xl border border-[color:var(--accent-500)]/20 bg-white/[0.02] p-4 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
        Tier limits
      </h3>
      <div className="divide-y divide-[color:var(--accent-500)]/10">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between py-1.5">
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              {label}
            </span>
            <span className="text-sm text-zinc-200">
              {value == null || value === '' ? <Dash /> : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick links ──────────────────────────────────────────────────────────────

function LinksSection({ tenantId }: { tenantId: string }) {
  const links = [
    { href: `/tenants/${tenantId}`, label: 'Full tenant detail page' },
    { href: `/users?tenantId=${tenantId}`, label: 'Tenant users' },
    { href: `/audit?tenantId=${tenantId}`, label: 'Audit logs' },
    { href: `/monitoring?tenantId=${tenantId}`, label: 'Monitoring' },
    { href: `/billing?tenantId=${tenantId}`, label: 'Billing' },
    { href: `/security?tenantId=${tenantId}`, label: 'Security' },
    { href: `/connectors?tenantId=${tenantId}`, label: 'Connectors' },
    { href: `/infrastructure?tenantId=${tenantId}`, label: 'Infrastructure' },
    { href: `/settings?tenantId=${tenantId}`, label: 'Settings' },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Deep-link to the admin pages with this tenant pre-selected.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-[color:var(--accent-500)]/30 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 transition"
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
