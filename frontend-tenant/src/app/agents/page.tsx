'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentRaw {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  isActive: boolean;
  monthlyBudget?: number;
  budgetUsed?: number;
  createdAt: string;
  updatedAt: string;
  department?: { name: string };
  model?: { name: string };
  _count?: { tasks: number };
}

type ViewMode = 'grid' | 'list';
type FilterStatus = 'ALL' | 'ACTIVE' | 'RUNNING' | 'PAUSED' | 'IDLE' | 'ERROR';

const STATUS_FILTERS: FilterStatus[] = ['ALL', 'ACTIVE', 'RUNNING', 'IDLE', 'PAUSED', 'ERROR'];

const STATUS_COUNT_COLOR: Record<string, string> = {
  ACTIVE: 'text-status-profit',
  RUNNING: 'text-status-ops',
  IDLE: 'text-zinc-400',
  PAUSED: 'text-status-warn',
  ERROR: 'text-status-risk',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [agents, setAgents] = useState<AgentRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/agents?page=${page}&limit=24`);
      setAgents(unwrapArrayOrEmpty(res));
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  // Pause / Resume / Audit via API
  async function handleAction(action: string, agentId: string) {
    if (action === 'inspect') { openInspector('agent', agentId); return; }
    if (action === 'audit') { openInspector('agent', agentId); return; }
    const nextStatus = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : null;
    if (!nextStatus) return;
    try {
      await api.patch(`/agents/${agentId}`, { status: nextStatus });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: nextStatus } : a)),
      );
    } catch { /* silent */ }
  }

  // Filtered + searched agents
  const visible = agents.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Status counts for filter bar
  const counts: Record<string, number> = {};
  for (const a of agents) counts[a.status] = (counts[a.status] ?? 0) + 1;

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Agent Fleet</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{total} agents total</p>
          </div>
          <Link
            href="/agents/new"
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition font-medium"
          >
            + Deploy Agent
          </Link>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="flex-1 min-w-48 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
          />

          {/* Status filters */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay'
                }`}
              >
                {s}
                {s !== 'ALL' && counts[s] ? (
                  <span className={`ml-1 ${STATUS_COUNT_COLOR[s] ?? 'text-zinc-400'}`}>
                    {counts[s]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            {(['grid', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs transition ${
                  viewMode === mode
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {mode === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Agent grid / list ── */}
        {loading ? (
          <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            {search || statusFilter !== 'ALL' ? 'No agents match your filters.' : (
              <>No agents yet. <Link href="/agents/new" className="text-violet-400 underline">Deploy one</Link>.</>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 max-w-3xl'}`}>
              {visible.map((agent) => (
                <motion.div
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <AgentCard
                    agent={{
                      id: agent.id,
                      name: agent.name,
                      type: agent.type as any,
                      status: agent.status as any,
                      department: agent.department?.name,
                      model: agent.model?.name ?? 'GPT-4o',
                      workload: Math.min(100, Math.round(((agent._count?.tasks ?? 0) / 10) * 100)),
                      taskCount: agent._count?.tasks ?? 0,
                      successRate: 0,
                      budgetUsed: agent.budgetUsed ?? 0,
                      budgetTotal: agent.monthlyBudget ?? 100,
                      lastActiveAt: agent.updatedAt,
                    }}
                    variant={viewMode === 'grid' ? 'full' : 'compact'}
                    onAction={handleAction}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Pagination ── */}
        {total > 24 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              Showing {(page - 1) * 24 + 1}–{Math.min(page * 24, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 24 >= total}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
