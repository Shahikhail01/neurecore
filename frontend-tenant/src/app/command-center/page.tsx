'use client';

/**
 * /command-center — Phase 14 thin command-center page (tenant FE).
 *
 * Single responsibility: present three summary cards backed by parallel
 * GETs against the P8 intelligence surface (CR-AI-1201, 1203, 1207).
 * No mutation, no chart logic, no drill-down — those live in the dedicated
 * intelligence tab at `/intelligence?tab=command-center`.
 *
 * Cards:
 *   1. Inventory  — agent / skill / knowledge counts (typed empty state when
 *                   every bucket is empty so we never report a fake green light)
 *   2. Cost       — month-to-date cents + aggregate utilisation %
 *   3. Kill switches — count of enabled vs disabled entries
 *
 * Conventions:
 *   - `Promise.all` for parallel fetch (no waterfall).
 *   - Strict typed wrapper (`commandCenterApi`) — no `any` in this file.
 *   - "No silent success" — every card surfaces an explicit empty state.
 *   - Heading per card, label per list item (a11y).
 */

import { useEffect, useState } from 'react';
import {
  Boxes,
  Brain,
  GraduationCap,
  Library,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import {
  commandCenterApi,
  type InventoryResponse,
  type CostResponse,
  type KillSwitchListResponse,
} from '@/services/command-center.service';

interface CardState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

const INITIAL: CardState<never> = { loading: true, data: null, error: null };

export default function CommandCenterPage() {
  const user = useTenantAuth();

  const [inventory, setInventory] = useState<CardState<InventoryResponse>>(INITIAL);
  const [cost, setCost] = useState<CardState<CostResponse>>(INITIAL);
  const [killSwitches, setKillSwitches] = useState<CardState<KillSwitchListResponse>>(INITIAL);

  useEffect(() => {
    if (!user) return;
    const tenantId = user.tenantId ?? '';

    let cancelled = false;

    void (async () => {
      const [inv, cst, ks] = await Promise.all([
        commandCenterApi.getInventory(tenantId).catch((err: unknown) => {
          throw { which: 'inventory' as const, err };
        }),
        commandCenterApi.getCost(tenantId).catch((err: unknown) => {
          throw { which: 'cost' as const, err };
        }),
        commandCenterApi.getKillSwitches(tenantId).catch((err: unknown) => {
          throw { which: 'killSwitches' as const, err };
        }),
      ]);

      if (cancelled) return;
      setInventory({ loading: false, data: inv, error: null });
      setCost({ loading: false, data: cst, error: null });
      setKillSwitches({ loading: false, data: ks, error: null });
    })().catch((failure: unknown) => {
      if (cancelled) return;
      const message = failure instanceof Error ? failure.message : 'Failed to load command center';
      const which = isObjectWithStringKey(failure, 'which') ? failure.which : null;
      const errorState: CardState<never> = { loading: false, data: null, error: message };
      if (which === 'inventory') setInventory(errorState);
      else if (which === 'cost') setCost(errorState);
      else if (which === 'killSwitches') setKillSwitches(errorState);
      else {
        setInventory(errorState);
        setCost(errorState);
        setKillSwitches(errorState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const tenantId = user.tenantId ?? '';

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Operations"
          title="Command Center"
          subtitle="Live inventory, cost, and kill-switch posture for this tenant."
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <InventoryCard state={inventory} />
            <CostCard state={cost} />
            <KillSwitchesCard state={killSwitches} tenantId={tenantId} />
          </div>
        </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Inventory card ────────────────────────────────────────────────────────

function InventoryCard({ state }: { state: CardState<InventoryResponse> }) {
  const agents = state.data?.agents ?? [];
  const skills = state.data?.skills ?? [];
  const knowledge = state.data?.knowledge ?? [];
  const channels = state.data?.channels ?? [];
  const models = state.data?.models ?? [];

  const isEmpty =
    !state.loading && !state.error &&
    agents.length === 0 && skills.length === 0 &&
    knowledge.length === 0 && channels.length === 0 && models.length === 0;

  return (
    <GlassPanel className="p-5" aria-labelledby="cc-inventory-heading">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-status-strategy/15 text-status-strategy flex items-center justify-center">
          <Boxes className="w-5 h-5" />
        </div>
        <h2 id="cc-inventory-heading" className="text-base font-semibold text-zinc-100">
          Inventory
        </h2>
      </header>

      {state.loading && <CardLoading label="Loading inventory…" />}
      {state.error && (
        <p className="text-sm text-state-danger" role="status">{state.error}</p>
      )}

      {!state.loading && !state.error && (
        isEmpty ? (
          <EmptyState
            icon={<Library className="w-5 h-5" />}
            title="No inventory yet"
            description="Agents, skills, knowledge, and channels will appear here once provisioned."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            <InventoryRow icon={<Brain className="w-4 h-4" />} label="Agents" count={agents.length} />
            <InventoryRow icon={<GraduationCap className="w-4 h-4" />} label="Skills" count={skills.length} />
            <InventoryRow icon={<Library className="w-4 h-4" />} label="Knowledge" count={knowledge.length} />
            <InventoryRow icon={<Boxes className="w-4 h-4" />} label="Channels" count={channels.length} />
            <InventoryRow icon={<Wallet className="w-4 h-4" />} label="Models" count={models.length} />
          </ul>
        )
      )}
    </GlassPanel>
  );
}

function InventoryRow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-zinc-300">
        {icon}
        <span>{label}</span>
      </span>
      <span className="font-mono text-zinc-100" aria-label={`${label} count: ${count}`}>
        {count}
      </span>
    </li>
  );
}

// ─── Cost card ─────────────────────────────────────────────────────────────

function CostCard({ state }: { state: CardState<CostResponse> }) {
  const c = state.data;
  const utilization = typeof c?.utilizationPercent === 'number' ? c.utilizationPercent : null;
  const monthCents = typeof c?.monthToDateCents === 'number' ? c.monthToDateCents : null;
  const budgetCents = typeof c?.totalBudgetCents === 'number' ? c.totalBudgetCents : null;
  const budgets = c?.budgets ?? [];
  const byModel = c?.byModel ?? [];

  const isEmpty =
    !state.loading && !state.error &&
    monthCents === null && budgetCents === null &&
    budgets.length === 0 && byModel.length === 0;

  return (
    <GlassPanel className="p-5" aria-labelledby="cc-cost-heading">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-state-warning/15 text-state-warning flex items-center justify-center">
          <Wallet className="w-5 h-5" />
        </div>
        <h2 id="cc-cost-heading" className="text-base font-semibold text-zinc-100">
          Cost
        </h2>
      </header>

      {state.loading && <CardLoading label="Loading cost…" />}
      {state.error && (
        <p className="text-sm text-state-danger" role="status">{state.error}</p>
      )}

      {!state.loading && !state.error && (
        isEmpty ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="No cost activity yet"
            description="Month-to-date spend and budget utilisation will appear here once recorded."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            <CostRow
              label="Month-to-date"
              value={monthCents !== null ? `${(monthCents / 100).toFixed(2)} credits` : '—'}
            />
            <CostRow
              label="Total budget"
              value={budgetCents !== null ? `${(budgetCents / 100).toFixed(2)} credits` : '—'}
            />
            <CostRow
              label="Aggregate utilisation"
              value={utilization !== null ? `${utilization.toFixed(1)}%` : '—'}
            />
            <CostRow label="Active budgets" value={String(budgets.length)} />
            <CostRow label="Models tracked" value={String(byModel.length)} />
          </ul>
        )
      )}
    </GlassPanel>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-zinc-300">{label}</span>
      <span className="font-mono text-zinc-100" aria-label={`${label}: ${value}`}>
        {value}
      </span>
    </li>
  );
}

// ─── Kill-switches card ────────────────────────────────────────────────────

function KillSwitchesCard({
  state,
  tenantId,
}: {
  state: CardState<KillSwitchListResponse>;
  tenantId: string;
}) {
  const entries = state.data?.entries ?? [];
  const enabledCount = entries.filter((e) => e.enabled).length;
  const disabledCount = entries.length - enabledCount;

  const isEmpty =
    !state.loading && !state.error && entries.length === 0;

  return (
    <GlassPanel className="p-5" aria-labelledby="cc-killswitch-heading">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-state-danger/15 text-state-danger flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h2 id="cc-killswitch-heading" className="text-base font-semibold text-zinc-100">
          Kill switches
        </h2>
      </header>

      {state.loading && <CardLoading label="Loading kill switches…" />}
      {state.error && (
        <p className="text-sm text-state-danger" role="status">{state.error}</p>
      )}

      {!state.loading && !state.error && (
        isEmpty ? (
          <EmptyState
            icon={<ShieldCheck className="w-5 h-5" />}
            title="No kill switches configured"
            description={`Phase / channel / feature flags for tenant ${tenantId} will appear here once registered.`}
          />
        ) : (
          <ul className="space-y-2 text-sm">
            <KillSwitchRow
              icon={<ShieldAlert className="w-4 h-4 text-state-danger" />}
              label="Enabled"
              count={enabledCount}
            />
            <KillSwitchRow
              icon={<ShieldCheck className="w-4 h-4 text-state-success" />}
              label="Disabled"
              count={disabledCount}
            />
            <KillSwitchRow
              icon={<Boxes className="w-4 h-4" />}
              label="Total entries"
              count={entries.length}
            />
          </ul>
        )
      )}
    </GlassPanel>
  );
}

function KillSwitchRow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-zinc-300">
        {icon}
        <span>{label}</span>
      </span>
      <span className="font-mono text-zinc-100" aria-label={`${label} count: ${count}`}>
        {count}
      </span>
    </li>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function CardLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500" role="status">
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-3" role="status">
      <div className="flex items-center gap-2 text-zinc-300">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function isObjectWithStringKey(
  v: unknown,
  key: string,
): v is { [k: string]: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>)[key] === 'string'
  );
}
