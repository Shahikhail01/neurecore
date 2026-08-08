'use client';

/**
 * /routines — Routine Management Workspace
 *
 * Creatio-style workspace for scheduled and event-driven automation.
 * Uses the existing backend routine CRUD + execute + pause endpoints.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Pause, Trash2, RefreshCw, Repeat, ArrowLeft, Clock3, Webhook, Calendar, Zap } from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { CreateRoutineForm } from '@/components/forms/CreateRoutineForm';
import { RoutineInspector } from '@/components/inspector/RoutineInspector';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapList } from '@/services/unwrap';
import { useAgentStore } from '@/stores/agentStore';

interface Routine {
  id: string;
  name: string;
  description?: string;
  status: string;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerAgentId?: string | null;
  triggers?: Array<{
    id: string;
    type: string;
    name?: string;
  }>;
}

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PAUSED', 'DISABLED', 'ERROR'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function RoutinesPage() {
  const user = useTenantAuth();
  const agentsRaw = useAgentStore((s) => s.agents);
  const agents = Array.isArray(agentsRaw) ? agentsRaw : [];
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRoutines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/routines?limit=100');
      const data = unwrapList(res);
      setRoutines(Array.isArray(data?.items) ? (data.items as Routine[]) : unwrapArrayOrEmpty(res) as Routine[]);
    } catch {
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoutines();
  }, [fetchRoutines]);

  const visible = useMemo(
    () =>
      routines.filter((r) => {
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q);
        return matchStatus && matchSearch;
      }),
    [routines, search, statusFilter],
  );

  const activeCount = routines.filter((r) => r.status === 'ACTIVE').length;
  const pausedCount = routines.filter((r) => r.status === 'PAUSED').length;
  const disabledCount = routines.filter((r) => r.status === 'DISABLED').length;
  const webhookCount = routines.filter((r) =>
    Array.isArray(r.triggers) && r.triggers.some((t) => t.type === 'WEBHOOK')).length;

  const setStatus = async (id: string, status: 'ACTIVE' | 'PAUSED' | 'DISABLED') => {
    setBusyId(id);
    try {
      await api.put(`/routines/${id}`, { status });
      await fetchRoutines();
    } finally {
      setBusyId(null);
    }
  };

  const execute = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/routines/${id}/execute`, {});
      await fetchRoutines();
      setSelected(id);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this routine?')) return;
    setBusyId(id);
    try {
      await api.delete(`/routines/${id}`);
      if (selected === id) setSelected(null);
      await fetchRoutines();
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Automation"
          title="Routines"
          subtitle="Create, schedule, pause, and run recurring automation for your tenant."
        />

        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link href="/departments" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to departments
            </Link>
            <div className="flex items-center gap-2">
              <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchRoutines()}>
                Refresh
              </ActionButton>
              <ActionButton variant="primary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={() => setCreating(true)}>
                New Routine
              </ActionButton>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total" value={routines.length} color="ops" icon={<Repeat className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Active" value={activeCount} color="profit" icon={<Play className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Paused" value={pausedCount} color="warn" icon={<Pause className="w-4 h-4" />} loading={loading} />
            <KpiCard label="Webhooks" value={webhookCount} color="strategy" icon={<Webhook className="w-4 h-4" />} loading={loading} />
          </div>

          <GlassPanel padding="lg">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-60">
                <input
                  aria-label="Search routines"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search routines…"
                  className="w-full pl-3 pr-3 py-2 rounded-lg border border-surface-border bg-surface-overlay text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent-500"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map((s) => (
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-4">
              <div className="space-y-3">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-xl bg-surface-overlay border border-surface-border animate-pulse" />
                    ))}
                  </div>
                ) : visible.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-surface-border p-8 text-center text-sm text-zinc-500">
                    No routines match your filters.
                  </div>
                ) : (
                  visible.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border bg-surface-raised p-4 ${selected === r.id ? 'border-accent-500/50' : 'border-surface-border'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button className="text-left min-w-0 flex-1" onClick={() => setSelected(r.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-zinc-100 truncate">{r.name}</p>
                            <StatusBadge status={r.status} />
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.description ?? 'No description provided.'}</p>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.triggers?.some((t) => t.type === 'WEBHOOK') && <StatusBadge status="ACTIVE" label="Webhook" />}
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : 'Never run'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        {r.status === 'ACTIVE' ? (
                          <ActionButton variant="secondary" size="sm" icon={<Pause className="w-3 h-3" />} disabled={busyId === r.id} onClick={() => void setStatus(r.id, 'PAUSED')}>
                            Pause
                          </ActionButton>
                        ) : (
                          <ActionButton variant="primary" size="sm" icon={<Play className="w-3 h-3" />} disabled={busyId === r.id} onClick={() => void setStatus(r.id, 'ACTIVE')}>
                            Activate
                          </ActionButton>
                        )}
                        <ActionButton variant="ghost" size="sm" icon={<Zap className="w-3 h-3" />} disabled={busyId === r.id} onClick={() => void execute(r.id)}>
                          Run now
                        </ActionButton>
                        <ActionButton variant="ghost" size="sm" icon={<Trash2 className="w-3 h-3" />} disabled={busyId === r.id} onClick={() => void remove(r.id)}>
                          Delete
                        </ActionButton>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="space-y-4">
                {selected ? (
                  <GlassPanel padding="none">
                    <RoutineInspector id={selected} />
                  </GlassPanel>
                ) : (
                  <div className="rounded-2xl border border-dashed border-surface-border p-6 text-sm text-zinc-500">
                    Select a routine to inspect triggers, graph, and controls.
                  </div>
                )}

                <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-accent-500" />
                    Quick create
                  </h3>
                  <p className="text-xs text-zinc-500 mb-3">
                    Create a scheduled routine with one owner agent and a cron trigger.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Available agents: {agents.length}
                  </p>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        <AnimatePresence>
          {creating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="w-full max-w-2xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-zinc-100">New Routine</h2>
                  <button onClick={() => setCreating(false)} className="text-zinc-500 hover:text-zinc-100">
                    ×
                  </button>
                </div>
                <CreateRoutineForm
                  agents={agents.map((a) => ({ id: a.id, name: a.name }))}
                  onClose={() => setCreating(false)}
                  onCreated={async (id) => {
                    setCreating(false);
                    await fetchRoutines();
                    if (id) setSelected(id);
                  }}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </PageShell>
    </TenantShell>
  );
}
