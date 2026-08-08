'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHero, GlassPanel } from '@neurecore/ui-visual';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentRaw {
  id: string;
  name: string;
  type: string;
  status: string;
  monthlyBudget?: number;
  budgetUsed?: number;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string };
  department?: { name: string };
  model?: { name: string };
  _count?: { tasks: number };
}

type FilterStatus = 'ALL' | 'ACTIVE' | 'RUNNING' | 'PAUSED' | 'IDLE' | 'ERROR';
const STATUS_FILTERS: FilterStatus[] = ['ALL', 'ACTIVE', 'RUNNING', 'IDLE', 'PAUSED', 'ERROR'];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminAgentFleetPage() {
  const user = useAdminAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [agents, setAgents] = useState<AgentRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { data: AgentRaw[]; total: number } }>(
        `/agents?page=${page}&limit=24`,
      );
      const unwrapped = unwrapList(res);
      setAgents(unwrapped.items as AgentRaw[]);
      setTotal(unwrapped.total ?? 0);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const visible = agents.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.tenant?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts: Record<string, number> = {};
  for (const a of agents) counts[a.status] = (counts[a.status] ?? 0) + 1;

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <PageHero
        title="Employee Fleet"
        subtitle={`${total} employees across all tenants`}
      />
      <div className="max-w-7xl mx-auto space-y-5">
          <button
            onClick={() => void fetchAgents()}
            className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Refresh
          </button>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Search agents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees or tenants…"
            className="flex-1 min-w-48 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[color:var(--accent-500)] transition"
          />
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  statusFilter === s ? 'bg-[color:var(--accent-500)] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay'
                }`}
              >
                {s}
                {s !== 'ALL' && counts[s] ? <span className="ml-1 opacity-70">{counts[s]}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs transition ${viewMode === mode ? 'bg-[color:var(--accent-500)] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                {mode === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid / List ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-raised border border-surface-border animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">No employees match your filters.</div>
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
                      department: agent.tenant?.name ?? agent.department?.name,
                      model: agent.model?.name ?? 'GPT-4o',
                      workload: Math.min(100, (agent._count?.tasks ?? 0) * 10),
                      taskCount: agent._count?.tasks ?? 0,
                      successRate: 0,
                      budgetUsed: agent.budgetUsed ?? 0,
                      budgetTotal: agent.monthlyBudget ?? 100,
                      lastActiveAt: agent.updatedAt,
                    }}
                    variant={viewMode === 'grid' ? 'full' : 'compact'}
                    onAction={(action, id) => {
                      if (action === 'inspect' || action === 'audit') openInspector('agent', id);
                    }}
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 24 >= total} className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition">Next</button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
