'use client';
// ─── Workflow Inspector ───────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Play, Pause, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface WorkflowDetail {
  id: string;
  name: string;
  description?: string;
  status?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  definition?: Record<string, unknown>;
  config?: Record<string, unknown>;
  agent?: { id: string; name: string };
  executionCount?: number;
  successRate?: number;
  metrics?: { successRate?: number };
  _count?: { executions?: number };
  createdAt: string;
  updatedAt: string;
}

interface WorkflowExecutionHistoryItem {
  id: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  createdAt: string;
}

export function WorkflowInspector({ id }: { id: string }) {
  const [wf, setWf] = useState<WorkflowDetail | null>(null);
  const [history, setHistory] = useState<WorkflowExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyExecutionId, setBusyExecutionId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/workflows/${id}`),
      api.get(`/workflows/${id}/executions?limit=6`),
    ])
      .then(([workflowRes, historyRes]) => {
        setWf(unwrapItem(workflowRes));
        const historyData = historyRes?.data?.data ?? historyRes?.data ?? [];
        setHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch(() => {
        setWf(null);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setActiveState = async (active: boolean) => {
    await api.patch(`/workflows/${id}/${active ? 'activate' : 'pause'}`);
    load();
  };
  const execute = async () => {
    await api.post(`/workflows/${id}/execute`);
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this workflow?')) return;
    await api.delete(`/workflows/${id}`);
    load();
  };
  const updateExecution = async (
    executionId: string,
    status: 'COMPLETED' | 'FAILED',
  ) => {
    setBusyExecutionId(executionId);
    try {
      await api.patch(`/workflows/${id}/executions/${executionId}`, {
        status,
        detail:
          status === 'COMPLETED'
            ? 'Marked complete from tenant workflow inspector'
            : 'Marked failed from tenant workflow inspector',
      });
      load();
    } finally {
      setBusyExecutionId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${55 + i * 8}%` }} />
        ))}
      </div>
    );
  }
  if (!wf) return <div className="p-6 text-zinc-500 text-sm">Workflow not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{wf.name}</h2>
          <Link
            href={`/workflows/${wf.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={wf.isActive ? 'ACTIVE' : wf.status ?? 'DRAFT'} />
          {wf.isTemplate && <StatusBadge status="TEMPLATE" />}
          {wf.agent && <span className="text-xs text-zinc-500">Agent: {wf.agent.name}</span>}
        </div>
        {wf.description && <p className="text-xs text-zinc-400 mt-2">{wf.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Executions"
          value={String(wf.executionCount ?? wf._count?.executions ?? 0)}
        />
        <MetricCard
          label="Success Rate"
          value={`${wf.successRate ?? wf.metrics?.successRate ?? 0}%`}
        />
      </div>

      <Row label="Created" value={new Date(wf.createdAt).toLocaleString()} />
      <Row label="Updated" value={new Date(wf.updatedAt).toLocaleString()} />

      {wf.definition && Object.keys(wf.definition).length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Definition</p>
          <pre className="text-[10px] text-zinc-300 font-mono bg-surface p-3 rounded-lg border border-surface-border overflow-auto max-h-48">
            {JSON.stringify(wf.definition, null, 2)}
          </pre>
        </div>
      )}

      {wf.config && Object.keys(wf.config).length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Configuration</p>
          <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 space-y-1">
            {Object.entries(wf.config).slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-zinc-500">{key}</span>
                <span className="text-zinc-300 max-w-[60%] truncate">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Recent executions</p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {history.map((run) => (
              <div key={run.id} className="rounded bg-surface border border-surface-border px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {new Date(run.startedAt ?? run.createdAt).toLocaleString()}
                  </span>
                  <StatusBadge status={run.status} />
                </div>
                {run.durationMs != null && (
                  <div className="mt-1 text-[11px] text-zinc-500">Duration {run.durationMs}ms</div>
                )}
                {run.errorMessage && (
                  <div className="mt-1 text-[11px] text-red-300">{run.errorMessage}</div>
                )}
                {run.status === 'RUNNING' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyExecutionId === run.id}
                      onClick={() => void updateExecution(run.id, 'COMPLETED')}
                      className="rounded-md border border-emerald-800/40 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-50"
                    >
                      {busyExecutionId === run.id ? 'Updating…' : 'Mark complete'}
                    </button>
                    <button
                      type="button"
                      disabled={busyExecutionId === run.id}
                      onClick={() => void updateExecution(run.id, 'FAILED')}
                      className="rounded-md border border-red-800/40 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                    >
                      {busyExecutionId === run.id ? 'Updating…' : 'Mark failed'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        {wf.isActive ? (
          <ActionButton variant="secondary" size="md" icon={<Pause className="w-3.5 h-3.5" />} onClick={() => setActiveState(false)}>
            Pause
          </ActionButton>
        ) : (
          <ActionButton variant="primary" size="md" icon={<Play className="w-3.5 h-3.5" />} onClick={() => setActiveState(true)}>
            Activate
          </ActionButton>
        )}
        <ActionButton variant="secondary" size="md" onClick={execute}>
          Execute Now
        </ActionButton>
        <ActionButton
          variant="danger"
          size="md"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={remove}
        >
          Delete
        </ActionButton>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
