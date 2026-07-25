'use client';

/**
 * /service-desk — Unified Service Desk (Phase 7)
 *
 * Creatio-style service hub with 4 tabs:
 *   1. Inbox       — notifications, mentions, alerts
 *   2. Approvals   — pending approval queue
 *   3. Audit       — tenant audit log
 *   4. Activity    — execution activity stream
 *
 * Replaces the standalone /inbox, /approvals, /activity pages.
 *
 * Layout (Creatio reference: 05-service-screen-01..07@1x.png):
 *   ┌─ Header ──────────────────────────────────────────┐
 *   │  [Headphones icon] Service Desk    [refresh]      │
 *   ├─ Tabs ─────────────────────────────────────────────┤
 *   │  Inbox │ Approvals │ Audit │ Activity             │
 *   ├─ Tab content ──────────────────────────────────────┤
 *   │  (active tab)                                     │
 *   └────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  Inbox,
  CheckSquare,
  ShieldCheck,
  Activity,
  Mail,
  MailOpen,
  Archive,
  Trash2,
  CheckCheck,
  RefreshCw,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Wallet,
  Bot,
  CircleDot,
  Hash,
} from 'lucide-react';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import ThreadInboxPanel from '@/components/threads/ThreadInboxPanel';

// ─── Types ────────────────────────────────────────────────────────────────
type ServiceDeskTab = 'inbox' | 'approvals' | 'audit' | 'activity' | 'threads';

interface InboxItem {
  id: string;
  kind: 'APPROVAL' | 'FAILED_TASK' | 'AGENT_ALERT' | 'BUDGET_ALERT' | 'MENTION' | 'SYSTEM';
  title: string;
  body?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  entityType: string;
  entityId: string;
  actionUrl?: string;
  createdAt: string;
  readAt?: string;
}

interface Approval {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requester?: { firstName?: string; lastName?: string; email?: string };
  agent?: { name?: string };
  amount?: number;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: { firstName?: string; lastName?: string };
  reviewComment?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor?: { firstName?: string; lastName?: string; email?: string };
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const TABS: { id: ServiceDeskTab; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox',     label: 'Inbox',     icon: Inbox },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'audit',     label: 'Audit Log', icon: ShieldCheck },
  { id: 'activity',  label: 'Activity',  icon: Activity },
  { id: 'threads',   label: 'Threads',   icon: MessageSquare },
];

const API_BASE = '/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  // Cookie-only auth: __Host-nc_at travels with credentials: 'include'.
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return null;
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const KIND_ICON: Record<InboxItem['kind'], typeof Bot> = {
  APPROVAL: CheckSquare,
  FAILED_TASK: AlertCircle,
  AGENT_ALERT: Bot,
  BUDGET_ALERT: Wallet,
  MENTION: MessageSquare,
  SYSTEM: CircleDot,
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-zinc-400',
  MEDIUM: 'text-state-info',
  HIGH: 'text-state-warning',
  URGENT: 'text-state-danger',
};

// ─── Page ─────────────────────────────────────────────────────────────────
export default function ServiceDeskPage() {
  const user = useTenantAuth();

  const [activeTab, setActiveTab] = useState<ServiceDeskTab>('inbox');

  // Read tab from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URL(window.location.href).searchParams.get('tab') as ServiceDeskTab | null;
    if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
  }, []);

  const setTab = (t: ServiceDeskTab) => {
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
          title="Service Desk"
          subtitle="Inbox, approvals, audit log, and live activity — everything that needs your attention."
        />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-4 hidden"
        >
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-status-ops/15 text-status-ops flex items-center justify-center">
                <Headphones className="w-5 h-5" />
              </div>
              Service Desk
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Inbox, approvals, audit log, and live activity — everything that needs your attention.
            </p>
          </div>
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
            {activeTab === 'inbox' && <InboxTab />}
            {activeTab === 'approvals' && <ApprovalsTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'threads' && <ThreadInboxPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
      </PageShell>
    </TenantShell>
  );
}

// ─── Tab 1: Inbox ─────────────────────────────────────────────────────────
function InboxTab() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ' | 'ARCHIVED'>('ALL');
  const [search, setSearch] = useState('');

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: InboxItem[] }>('/inbox?limit=100');
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInbox(); }, [fetchInbox]);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/inbox/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'READ' } : i)));
    } catch { /* silent */ }
  };

  const archive = async (id: string) => {
    try {
      await apiFetch(`/inbox/${id}/archive`, { method: 'PATCH' });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'ARCHIVED' } : i)));
    } catch { /* silent */ }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      await apiFetch(`/inbox/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/inbox/mark-all-read', { method: 'POST' });
      setItems((prev) => prev.map((i) => ({ ...i, status: 'READ' })));
    } catch { /* silent */ }
  };

  const visible = items.filter((i) => {
    const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;
    const matchSearch = !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.body ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const unreadCount = items.filter((i) => i.status === 'UNREAD').length;
  const urgentCount = items.filter((i) => i.priority === 'URGENT' && i.status !== 'ARCHIVED').length;
  const approvalCount = items.filter((i) => i.kind === 'APPROVAL' && i.status !== 'ARCHIVED').length;
  const failedCount = items.filter((i) => i.kind === 'FAILED_TASK' && i.status !== 'ARCHIVED').length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={items.length} color="ops" icon={<Inbox className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Unread" value={unreadCount} color="profit" icon={<Mail className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Urgent" value={urgentCount} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Approvals" value={approvalCount} color="warn" icon={<CheckSquare className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inbox…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'UNREAD', 'READ', 'ARCHIVED'] as const).map((s) => (
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
        <ActionButton variant="ghost" size="sm" icon={<CheckCheck className="w-3 h-3" />} onClick={markAllRead}>
          Mark all read
        </ActionButton>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchInbox()}>
          Refresh
        </ActionButton>
      </div>

      {/* Items */}
      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading inbox…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Inbox className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">Inbox empty</p>
          <p className="text-xs text-zinc-500 mt-1">
            {items.length === 0 ? 'No notifications yet. We\'ll let you know when something happens.' : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {visible.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? CircleDot;
            return (
              <div
                key={item.id}
                onClick={() => item.status === 'UNREAD' && markRead(item.id)}
                className={`flex items-start gap-3 p-4 hover:bg-surface-overlay cursor-pointer transition ${
                  item.status === 'UNREAD' ? 'bg-accent-500/[0.03]' : ''
                }`}
              >
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                  item.status === 'UNREAD' ? 'bg-accent-500/15 text-accent-500' : 'bg-surface-overlay text-zinc-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium truncate ${
                      item.status === 'UNREAD' ? 'text-zinc-100' : 'text-zinc-400'
                    }`}>
                      {item.title}
                    </p>
                    <StatusBadge status={item.kind} />
                    <span className={`text-[10px] font-medium ${PRIORITY_COLOR[item.priority]}`}>
                      {item.priority}
                    </span>
                  </div>
                  {item.body && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{item.body}</p>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  {item.actionUrl && (
                    <a
                      href={item.actionUrl}
                      className="text-xs px-2 py-1 rounded-md text-accent-500 hover:bg-accent-500/10 transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                  {item.status !== 'ARCHIVED' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); archive(item.id); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-surface-overlay transition"
                      title="Archive"
                      aria-label="Archive"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-state-danger hover:bg-state-danger/10 transition"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Approvals ──────────────────────────────────────────────────────
function ApprovalsTab() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      params.set('limit', '100');
      const data = await apiFetch<{ data: Approval[] }>(`/approvals?${params.toString()}`);
      setApprovals(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchApprovals(); }, [fetchApprovals]);

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const comment = decision === 'REJECTED' ? prompt('Reason for rejection?') ?? '' : '';
    try {
      await apiFetch(`/approvals/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, comment }),
      });
      void fetchApprovals();
    } catch { /* silent */ }
  };

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pending" value={pendingCount} color="warn" icon={<AlertCircle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Approved" value={approvals.filter((a) => a.status === 'APPROVED').length} color="profit" icon={<CheckCircle2 className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Rejected" value={approvals.filter((a) => a.status === 'REJECTED').length} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={loading} />
        <KpiCard label="Total" value={approvals.length} color="ops" icon={<CheckSquare className="w-4 h-4" />} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
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
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchApprovals()}>
          Refresh
        </ActionButton>
      </div>

      {/* Approvals list */}
      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading approvals…</div>
      ) : approvals.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <CheckSquare className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No approvals</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {statusFilter === 'PENDING' ? 'You\'re all caught up — no pending approvals.' : `No ${statusFilter.toLowerCase()} approvals.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-100">{a.title}</p>
                    <StatusBadge status={a.status} />
                    {a.priority && <StatusBadge status={a.priority} />}
                  </div>
                  {a.description && (
                    <p className="text-xs text-zinc-500 mt-1">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    {a.requester && (
                      <span>From: {a.requester.firstName} {a.requester.lastName}</span>
                    )}
                    {a.agent?.name && <span>Agent: {a.agent.name}</span>}
                    {a.amount != null && <span className="font-mono">${a.amount.toFixed(2)}</span>}
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.reviewComment && (
                    <div className="mt-2 p-2 rounded bg-surface-overlay text-xs text-zinc-400">
                      <span className="font-medium">Review:</span> {a.reviewComment}
                    </div>
                  )}
                </div>
                {a.status === 'PENDING' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <ActionButton
                      variant="danger"
                      size="sm"
                      onClick={() => review(a.id, 'REJECTED')}
                    >
                      Reject
                    </ActionButton>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 className="w-3 h-3" />}
                      onClick={() => review(a.id, 'APPROVED')}
                    >
                      Approve
                    </ActionButton>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Audit Log ─────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: AuditLog[] }>('/audit-logs/tenant?limit=200');
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAudit(); }, [fetchAudit]);

  const visible = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q) ||
      (l.description ?? '').toLowerCase().includes(q) ||
      (l.actor?.email ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit log by action, entity, or actor…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500"
          />
        </div>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAudit()}>
          Refresh
        </ActionButton>
      </div>

      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading audit log…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No audit entries</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {logs.length === 0 ? 'Tenant activity will be logged here.' : 'No entries match your search.'}
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {visible.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-overlay transition">
              <div className="w-8 h-8 rounded-lg bg-surface-overlay text-zinc-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status="ACTIVE" label={log.action} />
                  <span className="text-xs text-zinc-400">
                    <span className="font-mono">{log.entityType}</span>
                    {log.entityId && (
                      <span className="text-zinc-600"> · {log.entityId.slice(0, 8)}</span>
                    )}
                  </span>
                </div>
                {log.description && (
                  <p className="text-xs text-zinc-300 mt-1">{log.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                  {log.actor?.email && <span>by {log.actor.email}</span>}
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Activity (live execution stream) ───────────────────────────────
function ActivityTab() {
  const [logs, setLogs] = useState<{ id: string; status: string; agentId: string; agent?: { name: string }; taskId?: string; startedAt: string; costUsd?: number; tokensUsed?: number; evaluationScore?: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: typeof logs }>('/observability/logs?limit=50');
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchActivity(); }, [fetchActivity]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => void fetchActivity(), 10_000);
    return () => clearInterval(id);
  }, [fetchActivity]);

  const statusColors: Record<string, string> = {
    RUNNING: 'text-status-ops',
    COMPLETED: 'text-status-profit',
    FAILED: 'text-status-risk',
    CANCELLED: 'text-status-neutral',
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Live execution stream · auto-refreshes every 10s
        </p>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchActivity()}>
          Refresh
        </ActionButton>
      </div>

      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading activity…</div>
      ) : logs.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Activity className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">No activity yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            Agent executions will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                log.status === 'COMPLETED' ? 'bg-state-success' :
                log.status === 'FAILED' ? 'bg-state-danger' :
                log.status === 'RUNNING' ? 'bg-state-info animate-pulse' :
                'bg-zinc-500/50'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {log.agent?.name ?? log.agentId.slice(0, 8)}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {new Date(log.startedAt).toLocaleTimeString()} · {log.tokensUsed ?? 0} tokens
                  {log.costUsd != null && ` · $${Number(log.costUsd).toFixed(4)}`}
                </p>
              </div>
              <StatusBadge status={log.status} />
              {log.evaluationScore != null && (
                <span className="text-xs font-mono text-zinc-400 w-10 text-right">
                  {(log.evaluationScore * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}