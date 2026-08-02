'use client';

/**
 * /accounting — Unified Accounting workspace (NC-ACCT-IMP-1 §8).
 *
 * 5 tabs:
 *   1. Overview    — KPI strip (periods, accounts, recent postings) + last NPV
 *   2. Accounts    — Chart of accounts list (filter by type, by status)
 *   3. Compute     — NPV / IRR calculator using the sidecar
 *   4. Ledger      — Journal entries with postings (latest first)
 *   5. Reports     — Balance sheet / income statement / cash flow generators
 *
 * Mirrors the layout pattern of /finance so users learn one pattern.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  BookOpen,
  FileText,
  TrendingUp,
  Receipt,
  RefreshCw,
  Wallet,
  Download,
  PieChart,
  DollarSign,
  Activity,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { ActionButton, ActionToolbar } from '@/components/creatio/ActionToolbar';
import {
  accountingService,
  type ChartOfAccount, type AccountingPeriod, type JournalEntry,
  type AccountType,
} from '@/services/accounting/accounting.service';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'accounts' | 'compute' | 'ledger' | 'reports';

const TABS: { id: TabId; label: string; icon: typeof Wallet }[] = [
  { id: 'overview', label: 'Overview',   icon: TrendingUp },
  { id: 'accounts', label: 'Accounts',   icon: BookOpen },
  { id: 'compute',  label: 'Compute',    icon: Calculator },
  { id: 'ledger',   label: 'Ledger',     icon: Receipt },
  { id: 'reports',  label: 'Reports',    icon: FileText },
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET:     'Assets',
  LIABILITY: 'Liabilities',
  EQUITY:    'Equity',
  REVENUE:   'Revenue',
  EXPENSE:   'Expenses',
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const user = useTenantAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Honour ?tab= query string for deep-linking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URL(window.location.href).searchParams.get('tab') as TabId | null;
    if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
  }, []);

  const setTab = (t: TabId) => {
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
          title="Accounting"
          subtitle="Chart of accounts, journal entries, NPV/IRR compute, and financial reports."
        />
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Tab nav */}
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

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'accounts' && <AccountsTab />}
              {activeTab === 'compute'  && <ComputeTab />}
              {activeTab === 'ledger'   && <LedgerTab />}
              {activeTab === 'reports'  && <ReportsTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: Overview ───────────────────────────────────────────────────────

function OverviewTab() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accts, periods, entries] = await Promise.all([
        accountingService.listAccounts(),
        accountingService.listPeriods(),
        accountingService.listJournalEntries({ limit: 5 }),
      ]);
      setAccounts(accts);
      setPeriods(periods);
      setRecentEntries(entries);
    } catch {
      // ignore — empty state will render
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const openPeriodCount = useMemo(
    () => periods.filter((p) => p.status === 'OPEN' || p.status === 'CLOSING').length,
    [periods],
  );

  const totalDebits = useMemo(
    () => recentEntries.reduce((sum, e) => sum + Number(e.totalDebit), 0),
    [recentEntries],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-state-warning" />
          Accounting overview
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAll()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active accounts"
          value={accounts.filter((a) => a.isActive).length}
          color="ops"
          icon={<BookOpen className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Open periods"
          value={openPeriodCount}
          color="profit"
          icon={<Activity className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Recent postings"
          value={recentEntries.length}
          color="strategy"
          icon={<Receipt className="w-4 h-4" />}
          loading={loading}
        />
        <KpiCard
          label="Recent debits"
          value={`$${totalDebits.toLocaleString()}`}
          color="warn"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={loading}
        />
      </div>

      {/* Account type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-status-strategy" />
            Accounts by type
          </h3>
          {accounts.length === 0 && !loading ? (
            <div className="text-center text-zinc-500 text-xs py-8">
              No accounts yet. Create your first one in the Accounts tab.
            </div>
          ) : (
            <div className="space-y-2">
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => {
                const count = accounts.filter((a) => a.type === t).length;
                const max = Math.max(1, ...Object.values(ACCOUNT_TYPE_LABELS).map(() =>
                  accounts.filter((a) => a.type === t).length,
                ));
                const pct = (count / max) * 100;
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300">{ACCOUNT_TYPE_LABELS[t]}</span>
                      <span className="font-mono text-zinc-400">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                      <div
                        className="h-full bg-accent-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-surface p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-state-info" />
            Recent journal entries
          </h3>
          {recentEntries.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-8">
              No journal entries yet. Post one in the Ledger tab.
            </div>
          ) : (
            <div className="space-y-2">
              {recentEntries.slice(0, 5).map((je) => (
                <div key={je.id} className="flex items-center justify-between p-2 rounded bg-surface-overlay">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{je.narration}</p>
                    <p className="text-[10px] text-zinc-500">
                      {new Date(je.txnDate).toLocaleDateString()} · {je.source}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-300 shrink-0">
                    ${Number(je.totalDebit).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Accounts ────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<AccountType | 'ALL'>('ALL');
  const [showInactive, setShowInactive] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountingService.listAccounts({ isActive: showInactive });
      setAccounts(list);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { void fetch(); }, [fetch]);

  const visible = accounts.filter((a) =>
    filterType === 'ALL' ? true : a.type === filterType,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-state-info" />
          Chart of accounts
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetch()}>
          Refresh
        </ActionButton>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t as AccountType | 'ALL')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                filterType === t
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
              }`}
            >
              {t === 'ALL' ? 'All' : ACCOUNT_TYPE_LABELS[t as AccountType]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading accounts…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No accounts</p>
          <p className="text-xs text-zinc-500 mt-1">
            {accounts.length === 0
              ? 'Create your first chart of accounts entry.'
              : 'No accounts match your filter.'}
          </p>
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-overlay text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Normal</th>
                <th className="text-left px-4 py-2.5">Currency</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {visible.map((a) => (
                <tr key={a.id} className="hover:bg-surface-overlay transition">
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{a.code}</td>
                  <td className="px-4 py-2.5 text-zinc-100">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">{ACCOUNT_TYPE_LABELS[a.type]}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">{a.normalBalance}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">{a.currency}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.isActive
                          ? 'bg-state-success/15 text-state-success'
                          : 'bg-zinc-700/30 text-zinc-500'
                      }`}
                    >
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Compute (NPV / IRR) ────────────────────────────────────────────

function ComputeTab() {
  const [rate, setRate] = useState(0.10);
  const [cashflowsText, setCashflowsText] = useState('-1000, 300, 400, 500');
  const [npv, setNpv] = useState<number | null>(null);
  const [irr, setIrr] = useState<number | null>(null);
  const [irrConverged, setIrrConverged] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCashflows = (): number[] => {
    return cashflowsText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        const n = Number(s);
        if (Number.isNaN(n)) throw new Error(`Invalid number: ${s}`);
        return n;
      });
  };

  const computeNpv = async () => {
    setError(null);
    setBusy(true);
    try {
      const cfs = parseCashflows();
      const r = await accountingService.computeNpv(rate, cfs);
      setNpv(r.npv);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const computeIrr = async () => {
    setError(null);
    setBusy(true);
    try {
      const cfs = parseCashflows();
      const r = await accountingService.computeIrr(cfs);
      setIrr(r.irr);
      setIrrConverged(r.converged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-state-info" />
          NPV / IRR calculator
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Compute net present value and internal rate of return using the accounting-sidecar
          (numpy-financial).
        </p>
      </div>

      <div className="card-surface p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Discount rate (decimal, e.g. 0.10 for 10%)
          </label>
          <input
            type="number"
            step="0.001"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            className="w-full mt-1 px-3 py-2 bg-surface-overlay border border-surface-border rounded text-sm font-mono text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Cashflows (comma- or space-separated)
          </label>
          <textarea
            value={cashflowsText}
            onChange={(e) => setCashflowsText(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 bg-surface-overlay border border-surface-border rounded text-sm font-mono text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <ActionButton variant="primary" onClick={computeNpv} disabled={busy}>
            Compute NPV
          </ActionButton>
          <ActionButton variant="outline" onClick={computeIrr} disabled={busy}>
            Compute IRR
          </ActionButton>
        </div>
        {error && (
          <div className="text-xs text-state-danger bg-state-danger/10 px-3 py-2 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">NPV</p>
          <p className="text-3xl font-bold text-zinc-100 mt-2 font-mono">
            {npv === null ? '—' : npv.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {npv === null
              ? 'Press "Compute NPV" to run'
              : npv > 0
              ? 'Positive NPV → project adds value'
              : npv < 0
              ? 'Negative NPV → project destroys value'
              : 'Zero NPV → break-even'}
          </p>
        </div>
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">IRR</p>
          <p className="text-3xl font-bold text-zinc-100 mt-2 font-mono">
            {irr === null ? '—' :
             irrConverged === false ? 'no convergence' :
             `${(irr * 100).toFixed(2)}%`}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {irr === null
              ? 'Press "Compute IRR" to run'
              : irrConverged === false
              ? 'No sign change in cashflows; IRR is undefined.'
              : irr > rate
              ? 'IRR > discount rate → accept'
              : 'IRR < discount rate → reject'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Ledger ──────────────────────────────────────────────────────────

function LedgerTab() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountingService.listJournalEntries({ limit: 50 });
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  const downloadBeancount = async () => {
    setDownloading(true);
    try {
      const blob = await accountingService.exportBeancount();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${new Date().toISOString().slice(0, 10)}.beancount`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-state-info" />
          Journal entries
        </h2>
        <div className="flex gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            icon={<Download className="w-3 h-3" />}
            onClick={downloadBeancount}
            disabled={downloading}
          >
            Export Beancount
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-3 h-3" />}
            onClick={() => void fetch()}
          >
            Refresh
          </ActionButton>
        </div>
      </div>

      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">
          Loading journal entries…
        </div>
      ) : entries.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No journal entries</p>
          <p className="text-xs text-zinc-500 mt-1">
            Journal entries will appear here once journal postings are committed.
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {entries.map((je) => (
            <div key={je.id} className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{je.narration}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(je.txnDate).toLocaleDateString()} · {je.source} · txn {je.txnId.slice(-8)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs text-zinc-400 font-mono">
                    D {Number(je.totalDebit).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-400 font-mono">
                    C {Number(je.totalCredit).toLocaleString()}
                  </p>
                </div>
              </div>
              {je.postings && je.postings.length > 0 && (
                <div className="mt-2 pl-3 border-l border-surface-border text-xs text-zinc-500">
                  {je.postings.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 py-0.5">
                      <span className="font-mono text-zinc-400 w-16 shrink-0">
                        {p.postingType}
                      </span>
                      <span className="font-mono text-zinc-300 shrink-0">
                        {p.account?.code ?? p.accountId.slice(-8)}
                      </span>
                      <span className="flex-1 truncate">{p.narration ?? p.counterparty ?? ''}</span>
                      <span className="font-mono text-zinc-300 shrink-0">
                        {Number(p.amount).toLocaleString()} {p.currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Reports ─────────────────────────────────────────────────────────

type ReportType = 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW';

function ReportsTab() {
  const [reportType, setReportType] = useState<ReportType>('BALANCE_SHEET');
  const [asOf, setAsOf] = useState<string>(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await accountingService.generateReport(
        reportType,
        asOf ? new Date(asOf) : undefined,
      );
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-state-info" />
          Financial reports
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Generate balance sheet, income statement, or cash flow from the journal.
        </p>
      </div>

      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-3">
          {(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setReportType(t); setReport(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportType === t
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              As of
            </label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-surface-overlay border border-surface-border rounded text-sm font-mono text-zinc-100"
            />
          </div>
          <ActionButton variant="primary" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate report'}
          </ActionButton>
        </div>
        {error && (
          <div className="text-xs text-state-danger bg-state-danger/10 px-3 py-2 rounded">
            {error}
          </div>
        )}
      </div>

      {report && (
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">
            {reportType.replace('_', ' ')}
            {report.asOf && ` · as of ${new Date(report.asOf).toLocaleDateString()}`}
          </h3>
          <pre className="text-xs font-mono text-zinc-300 bg-surface-overlay p-3 rounded overflow-x-auto max-h-96">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}