'use client';

/**
 * /finance — Unified Finance page (Phase 9)
 *
 * 5 tabs:
 *   1. Overview    — KPI strip + cost trend + budget bars + top spenders
 *   2. Invoices    — invoice list with status, amount, due date
 *   3. Expenses    — expense list with category, vendor, amount
 *   4. Budgets     — budget policies + incidents
 *   5. Billing     — current plan + payment method + invoice history
 *
 * Replaces /costs, /billing routes. Uses Phase 1 Gap 6/6a endpoints.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Wallet,
  Receipt,
  CreditCard,
  FileText,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
  Calendar,
  DollarSign,
  PieChart,
  Activity,
  ExternalLink,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton, ActionToolbar } from '@/components/creatio/ActionToolbar';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { financeService, type Invoice, type Expense } from '@/services/finance.service';

// ─── Types ────────────────────────────────────────────────────────────────
type FinanceTab = 'overview' | 'invoices' | 'expenses' | 'budgets' | 'billing';

interface BudgetPolicy {
  id: string;
  name: string;
  scope: 'TENANT' | 'DEPARTMENT' | 'AGENT';
  scopeRef?: string;
  limitCents: number;
  spentCents: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  enabled: boolean;
}

interface BudgetIncident {
  id: string;
  policyName: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

const TABS: { id: FinanceTab; label: string; icon: typeof Wallet }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'budgets',  label: 'Budgets',  icon: Wallet },
  { id: 'billing',  label: 'Billing',  icon: CreditCard },
];

// ─── Page ─────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const user = useTenantAuth();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URL(window.location.href).searchParams.get('tab') as FinanceTab | null;
    if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
  }, []);

  const setTab = (t: FinanceTab) => {
    setActiveTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Operations"
          title="Finance"
          subtitle="Cost tracking, invoices, expenses, budgets, and billing — all in one place."
        />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
                    className="hidden"
        >
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-state-warning/15 text-state-warning flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            Finance
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Cost tracking, invoices, expenses, budgets, and billing — all in one place.
          </p>
        </motion.div>

        {/* ── Tab Navigation ──────────────────────────────────── */}
        <div className="border-b border-surface-border">
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    active
                      ? 'border-accent-500 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-surface-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'invoices' && <InvoicesTab />}
            {activeTab === 'expenses' && <ExpensesTab />}
            {activeTab === 'budgets' && <BudgetsTab />}
            {activeTab === 'billing' && <BillingTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────
function OverviewTab() {
  const [costs, setCosts] = useState<{ totalCostCents: number; totalInputTokens: number; totalOutputTokens: number; byModel: Record<string, number>; recordCount: number } | null>(null);
  const [budgets, setBudgets] = useState<BudgetPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [costRes, budgetRes] = await Promise.all([
        fetch('/api/v1/costs/summary', { credentials: 'include' }),
        fetch('/api/v1/costs/budgets', { credentials: 'include' }),
      ]);
      if (costRes.ok) {
        const data = await costRes.json();
        setCosts(data?.data ?? null);
      }
      if (budgetRes.ok) {
        const data = await budgetRes.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setBudgets(list);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Build by-model donut data
  const modelDonut = useMemo(() => {
    if (!costs?.byModel) return [];
    return Object.entries(costs.byModel).map(([name, cents]) => ({
      name,
      value: Math.round(cents),
      color: nameColor(name),
    })).slice(0, 6);
  }, [costs]);

  // Compute top spenders
  const topBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => b.spentCents - a.spentCents).slice(0, 5);
  }, [budgets]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-state-warning" />
          Cost overview
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAll()}>
          Refresh
        </ActionButton>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="MTD Cost"
          value={costs ? `$${(costs.totalCostCents / 100).toFixed(2)}` : '—'}
          color="warn"
          icon={<Wallet className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Records"
          value={costs?.recordCount ?? 0}
          color="ops"
          icon={<Activity className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Input Tokens"
          value={costs?.totalInputTokens.toLocaleString() ?? '—'}
          color="profit"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Output Tokens"
          value={costs?.totalOutputTokens.toLocaleString() ?? '—'}
          color="strategy"
          icon={<TrendingDown className="w-4 h-4" />}
          loading={loading}
        />
      </div>

      {/* Cost trend chart + breakdown donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost trend (last 30d)" icon={<TrendingUp className="w-4 h-4 text-state-warning" />}>
          <AreaChart
            data={[]}
            dataKey="value"
            xKey="timestamp"
            color="var(--state-warning)"
            loading={loading}
            height={200}
          />
          <p className="text-xs text-zinc-500 text-center mt-2">
            Cost time-series from execution logs (per-day aggregation coming soon)
          </p>
        </ChartCard>
        <ChartCard title="Cost by model" icon={<PieChart className="w-4 h-4 text-status-strategy" />}>
          {modelDonut.length > 0 ? (
            <DonutChart data={modelDonut} nameKey="name" valueKey="value" loading={false} height={200} />
          ) : (
            <div className="text-center text-zinc-500 text-xs py-12">
              {loading ? 'Loading…' : 'No model data yet'}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Top spending budgets */}
      <ChartCard title="Top spending budgets" icon={<Wallet className="w-4 h-4 text-state-danger" />}>
        {topBudgets.length === 0 ? (
          <div className="text-center text-zinc-500 text-xs py-8">
            No budget policies configured. <Link href="/finance?tab=budgets" className="text-accent-500 underline">Create one</Link>.
          </div>
        ) : (
          <div className="space-y-3">
            {topBudgets.map((b) => {
              const pct = (b.spentCents / b.limitCents) * 100;
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-300">{b.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase">{b.scope}</span>
                      <span className="text-[10px] text-zinc-500">{b.period.toLowerCase()}</span>
                    </div>
                    <span className="font-mono text-zinc-400">
                      ${(b.spentCents / 100).toFixed(2)} / ${(b.limitCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pct > 80 ? 'bg-state-danger' : pct > 50 ? 'bg-state-warning' : 'bg-accent-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ─── Tab 2: Invoices ──────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.listInvoices({ page: 1, limit: 50 });
      setInvoices(result?.items ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  const visible = invoices.filter((i) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PAID') return i.status === 'PAID';
    if (statusFilter === 'PENDING') return i.status === 'PENDING' || i.status === 'ISSUED';
    if (statusFilter === 'OVERDUE') return i.status === 'OVERDUE';
    return true;
  });

  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + (i.amountCents ?? 0), 0);
  const totalPending = invoices.filter((i) => i.status === 'PENDING' || i.status === 'ISSUED').reduce((sum, i) => sum + (i.amountCents ?? 0), 0);
  const totalOverdue = invoices.filter((i) => i.status === 'OVERDUE').reduce((sum, i) => sum + (i.amountCents ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-state-info" />
          Invoices
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchInvoices()}>
          Refresh
        </ActionButton>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total" value={invoices.length} color="ops" loading={loading} />
        <KpiCard label="Paid" value={`$${(totalPaid / 100).toFixed(2)}`} color="profit" icon={<CheckCircle2 className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Pending" value={`$${(totalPending / 100).toFixed(2)}`} color="warn" icon={<Calendar className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Overdue" value={`$${(totalOverdue / 100).toFixed(2)}`} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              statusFilter === s
                ? 'bg-accent-500 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Invoices list */}
      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading invoices…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No invoices</p>
          <p className="text-xs text-zinc-500 mt-1">
            {invoices.length === 0 ? 'Invoices will appear here once billing is set up.' : 'No invoices match your filter.'}
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {visible.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-overlay transition">
              <div className="w-10 h-10 rounded-lg bg-state-info/15 text-state-info flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  Invoice {inv.number ?? inv.id.slice(0, 8)}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {inv.issuedAt ? `Issued ${new Date(inv.issuedAt).toLocaleDateString()}` : 'Issued —'}
                  {inv.dueDate && ` · Due ${new Date(inv.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-semibold text-zinc-100">
                  ${((inv.amountCents ?? 0) / 100).toFixed(2)}
                </p>
                <StatusBadge status={inv.status} />
              </div>
              <ActionButton
                variant="ghost"
                size="sm"
                icon={<Download className="w-3 h-3" />}
                aria-label="Download"
              >
                PDF
              </ActionButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Expenses ─────────────────────────────────────────────────────
function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeService.listExpenses({ page: 1, limit: 50 });
      setExpenses(result?.items ?? []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchExpenses(); }, [fetchExpenses]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => { if (e.category) set.add(e.category); });
    return ['ALL', ...Array.from(set).sort()];
  }, [expenses]);

  const visible = expenses.filter((e) => categoryFilter === 'ALL' || e.category === categoryFilter);

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amountCents ?? 0), 0);

  // Group by category for donut
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category ?? 'Uncategorized';
      map[cat] = (map[cat] ?? 0) + (e.amountCents ?? 0);
    }
    return Object.entries(map).map(([name, cents], i) => ({
      name,
      value: Math.round(cents),
      color: nameColor(name, i),
    }));
  }, [expenses]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-state-warning" />
          Expenses
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchExpenses()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total" value={expenses.length} color="ops" loading={loading} />
        <KpiCard label="Amount" value={`$${(totalAmount / 100).toFixed(2)}`} color="warn" loading={loading} />
        <KpiCard label="Categories" value={categories.length - 1} color="profit" loading={loading} />
        <KpiCard label="Vendors" value={new Set(expenses.map((e) => e.vendor).filter(Boolean)).size} color="strategy" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-surface">
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="px-5 py-3 border-b border-surface-border flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500">Filter:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    categoryFilter === cat
                      ? 'bg-accent-500 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-300 font-medium">No expenses</p>
              <p className="text-xs text-zinc-500 mt-1">
                {expenses.length === 0 ? 'Expenses will appear here.' : 'No expenses match your filter.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
              {visible.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-overlay text-zinc-400 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{e.description ?? 'Expense'}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {e.vendor && `${e.vendor} · `}
                      {e.category && `${e.category} · `}
                      {e.date ? new Date(e.date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-zinc-100">
                    ${((e.amountCents ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <ChartCard title="By category" icon={<PieChart className="w-4 h-4 text-status-strategy" />}>
          {byCategory.length > 0 ? (
            <DonutChart data={byCategory} nameKey="name" valueKey="value" loading={false} height={200} />
          ) : (
            <div className="text-center text-zinc-500 text-xs py-12">
              {loading ? 'Loading…' : 'No data'}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Tab 4: Budgets ───────────────────────────────────────────────────────
function BudgetsTab() {
  const [budgets, setBudgets] = useState<BudgetPolicy[]>([]);
  const [incidents, setIncidents] = useState<BudgetIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = null;
      const headers: Record<string, string> = { 'X-Requested-With': 'fetch' };

      const [budgetRes, incidentRes] = await Promise.all([
        fetch('/api/v1/costs/budgets', { headers }),
        fetch('/api/v1/costs/incidents', { headers }),
      ]);

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgets(Array.isArray(data?.data) ? data.data : []);
      }
      if (incidentRes.ok) {
        const data = await incidentRes.json();
        setIncidents(Array.isArray(data?.data) ? data.data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const unackIncidents = incidents.filter((i) => !i.acknowledged);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-state-warning" />
          Budget policies
        </h2>
        <ActionButton variant="primary" size="sm" icon={<Plus className="w-3 h-3" />}>
          New Budget
        </ActionButton>
      </div>

      {/* Active incidents banner */}
      {unackIncidents.length > 0 && (
        <div className="card-surface p-4 border-state-danger/40 bg-state-danger/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-state-danger shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100">
                {unackIncidents.length} unacknowledged budget {unackIncidents.length === 1 ? 'incident' : 'incidents'}
              </p>
              <p className="text-xs text-zinc-500">
                {unackIncidents[0]?.message}
                {unackIncidents.length > 1 && ` (+${unackIncidents.length - 1} more)`}
              </p>
            </div>
            <ActionButton variant="danger" size="sm">
              View
            </ActionButton>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Policies" value={budgets.length} color="ops" loading={loading} />
        <KpiCard label="Active" value={budgets.filter((b) => b.enabled).length} color="profit" loading={loading} />
        <KpiCard label="Incidents" value={incidents.length} color="warn" loading={loading} />
        <KpiCard label="Unacknowledged" value={unackIncidents.length} color="risk" loading={loading} />
      </div>

      {/* Budgets list */}
      <ChartCard title="All budget policies" icon={<Wallet className="w-4 h-4 text-state-warning" />}>
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading…</div>
        ) : budgets.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 font-medium">No budget policies</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Create budget policies to enforce spending limits on tenants, departments, or individual agents.
            </p>
            <ActionButton variant="primary" size="md" icon={<Plus className="w-3.5 h-3.5" />} className="mt-4">
              Create First Budget
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => {
              const pct = b.limitCents > 0 ? (b.spentCents / b.limitCents) * 100 : 0;
              return (
                <div key={b.id} className="p-3 rounded-lg bg-surface-overlay">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200">{b.name}</p>
                      <StatusBadge status={b.scope} label={b.scope} />
                      <span className="text-[10px] text-zinc-500 uppercase">{b.period.toLowerCase()}</span>
                      {!b.enabled && <StatusBadge status="PAUSED" />}
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      ${(b.spentCents / 100).toFixed(2)} / ${(b.limitCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pct > 80 ? 'bg-state-danger' : pct > 50 ? 'bg-state-warning' : 'bg-accent-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Incidents */}
      {incidents.length > 0 && (
        <ChartCard title="Recent incidents" icon={<AlertCircle className="w-4 h-4 text-state-danger" />}>
          <div className="space-y-2">
            {incidents.slice(0, 10).map((i) => (
              <div key={i.id} className="flex items-start gap-3 px-3 py-2.5 rounded bg-surface-overlay">
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                  i.severity === 'CRITICAL' ? 'text-state-danger' : 'text-state-warning'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-200">{i.policyName}</p>
                    <StatusBadge status={i.severity === 'CRITICAL' ? 'FAILED' : 'WARNING'} label={i.severity} />
                    {i.acknowledged && <StatusBadge status="ACTIVE" label="Ack'd" />}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{i.message}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {new Date(i.createdAt).toLocaleString()}
                  </p>
                </div>
                {!i.acknowledged && (
                  <ActionButton variant="ghost" size="sm">
                    Ack
                  </ActionButton>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ─── Tab 5: Billing ───────────────────────────────────────────────────────
function BillingTab() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-state-info" />
        Billing
      </h2>

      {/* Current plan card */}
      <div className="card-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Current plan</p>
            <h3 className="text-2xl font-bold text-zinc-100 mt-1">Growth</h3>
            <p className="text-xs text-zinc-500 mt-1">For teams scaling their AI operations</p>
            <div className="flex items-center gap-3 mt-3 text-xs">
              <span className="text-zinc-300">$99/month</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400">Renews Nov 25, 2026</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status="ACTIVE" label="Active" />
            <ActionButton variant="outline" size="sm">
              Manage Plan
            </ActionButton>
          </div>
        </div>

        {/* Usage */}
        <div className="mt-5 pt-5 border-t border-surface-border space-y-3">
          <p className="text-xs font-medium text-zinc-300 uppercase tracking-wider">This month</p>
          <div className="grid grid-cols-3 gap-3">
            <UsageCell label="Agent runs"   used={12450} limit={50000} unit="" />
            <UsageCell label="Storage"     used={2.4}    limit={10}    unit="GB" />
            <UsageCell label="Team seats"  used={8}      limit={25}    unit="" />
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-state-info" />
            Payment method
          </h3>
          <ActionButton variant="outline" size="sm">
            Update
          </ActionButton>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-overlay">
          <div className="w-10 h-7 rounded bg-gradient-to-r from-state-info to-accent-500 flex items-center justify-center text-white text-[10px] font-bold">
            VISA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200">Visa ending in 4242</p>
            <p className="text-xs text-zinc-500">Expires 12/2027</p>
          </div>
          <span className="text-xs text-zinc-500">Default</span>
        </div>
      </div>

      {/* Billing history link */}
      <div className="card-surface p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Billing history</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            All past invoices and receipts in one place.
          </p>
        </div>
        <ActionButton
          variant="ghost"
          size="sm"
          icon={<ExternalLink className="w-3 h-3" />}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'invoices');
            window.history.replaceState(null, '', url.toString());
            window.location.href = url.pathname + '?tab=invoices';
          }}
        >
          View invoices
        </ActionButton>
      </div>

      {/* Billing portal link */}
      <div className="card-surface p-5 flex items-center justify-between bg-accent-500/5 border-accent-500/30">
        <div>
          <p className="text-sm font-medium text-zinc-100">Need to make changes?</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Upgrade, downgrade, or cancel from the billing portal.
          </p>
        </div>
        <ActionButton variant="primary" size="md">
          Open billing portal
        </ActionButton>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function UsageCell({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="p-3 rounded-lg bg-surface-overlay">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-100 mt-0.5">
        {used.toLocaleString()}{unit ? ` ${unit}` : ''} <span className="text-zinc-500 font-normal">/ {limit.toLocaleString()}{unit ? ` ${unit}` : ''}</span>
      </p>
      <div className="h-1 mt-2 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full transition-all ${
            pct > 80 ? 'bg-state-danger' : pct > 50 ? 'bg-state-warning' : 'bg-accent-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function nameColor(name: string, index = 0): string {
  const palette = ['var(--visual-glow-violet)', 'var(--state-info)', 'var(--state-success)', 'var(--state-warning)', 'var(--state-danger)', 'var(--visual-glow-cyan)', 'var(--visual-glow-violet)', 'var(--visual-glow-emerald)'];
  if (!name) return palette[index % palette.length];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}