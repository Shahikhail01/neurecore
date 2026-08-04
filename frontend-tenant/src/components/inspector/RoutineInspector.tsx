'use client';
// ─── Routine Inspector ────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Play, Pause, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface RoutineDetail {
  id: string;
  name: string;
  description?: string;
  status: string;
  graphDefinition?: {
    nodes?: Array<{ id: string; name: string; type: string }>;
    edges?: Array<{ source: string; target: string; label?: string }>;
  };
  config?: Record<string, unknown>;
  triggers?: Array<{
    id: string;
    type: string;
    name?: string;
    config?: Record<string, unknown>;
    webhookPath?: string | null;
    lastFiredAt?: string | null;
    nextFireAt?: string | null;
  }>;
  runs?: Array<{
    id: string;
    status: string;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    durationMs?: number | null;
    triggerType?: string;
    error?: string;
  }>;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function RoutineInspector({ id }: { id: string }) {
  const [r, setR] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get(`/routines/${id}`)
      .then((res) => setR(unwrapItem(res)))
      .catch(() => setR(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setStatus = async (status: 'ACTIVE' | 'PAUSED' | 'DISABLED') => {
    await api.put(`/routines/${id}`, { status });
    load();
  };
  const execute = async () => {
    await api.post(`/routines/${id}/execute`, {});
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this routine?')) return;
    await api.delete(`/routines/${id}`);
    load();
  };
  const resumeRun = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await api.post(`/routines/runs/${runId}/resume`, {});
      load();
    } finally {
      setBusyRunId(null);
    }
  };
  const cancelRun = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await api.post(`/routines/runs/${runId}/cancel`, {});
      load();
    } finally {
      setBusyRunId(null);
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
  if (!r) return <div className="p-6 text-zinc-500 text-sm">Routine not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{r.name}</h2>
          <Link
            href={`/routines/${r.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={r.status} />
          {r.lastRunAt && (
            <span className="text-xs text-zinc-500">
              Last run: {new Date(r.lastRunAt).toLocaleString()}
            </span>
          )}
        </div>
        {r.description && <p className="text-xs text-zinc-400 mt-2">{r.description}</p>}
      </div>

      {/* Graph summary */}
      {r.graphDefinition?.nodes && r.graphDefinition.nodes.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            Graph ({r.graphDefinition.nodes.length} nodes, {r.graphDefinition.edges?.length ?? 0} edges)
          </p>
          <div className="space-y-1.5">
            {r.graphDefinition.nodes.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-surface border border-surface-border"
              >
                <span className="text-zinc-200">{n.name}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{n.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggers */}
      {r.triggers && r.triggers.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Triggers</p>
          <div className="space-y-1.5">
            {r.triggers.map((t) => (
              <div
                key={t.id}
                className="text-xs px-2 py-2 rounded bg-surface border border-surface-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-200">{t.name ?? t.type}</span>
                  <span className="text-[10px] text-zinc-500 uppercase">{t.type}</span>
                </div>
                <div className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
                  {t.webhookPath && <div className="font-mono break-all">{t.webhookPath}</div>}
                  {t.lastFiredAt && <div>Last fired: {new Date(t.lastFiredAt).toLocaleString()}</div>}
                  {t.nextFireAt && <div>Next fire: {new Date(t.nextFireAt).toLocaleString()}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.runs && r.runs.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Recent runs</p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {r.runs.slice(0, 6).map((run) => (
              <div key={run.id} className="rounded bg-surface border border-surface-border px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-200">{run.triggerType ?? 'MANUAL'}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  Started {new Date(run.startedAt ?? run.createdAt).toLocaleString()}
                </div>
                {run.durationMs != null && (
                  <div className="text-[11px] text-zinc-500">Duration {run.durationMs}ms</div>
                )}
                {run.error && (
                  <div className="mt-1 text-[11px] text-red-300">{run.error}</div>
                )}
                <div className="mt-2 flex gap-2">
                  {(run.status === 'PAUSED' || run.status === 'CANCELLED') && (
                    <button
                      type="button"
                      disabled={busyRunId === run.id}
                      onClick={() => void resumeRun(run.id)}
                      className="rounded-md border border-surface-border px-2 py-1 text-[11px] text-zinc-200 hover:bg-surface-overlay disabled:opacity-50"
                    >
                      {busyRunId === run.id ? 'Resuming…' : 'Resume'}
                    </button>
                  )}
                  {run.status === 'RUNNING' && (
                    <button
                      type="button"
                      disabled={busyRunId === run.id}
                      onClick={() => void cancelRun(run.id)}
                      className="rounded-md border border-red-800/40 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                    >
                      {busyRunId === run.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Row label="Created" value={new Date(r.createdAt).toLocaleString()} />
      <Row label="Updated" value={new Date(r.updatedAt).toLocaleString()} />

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        {r.status === 'ACTIVE' ? (
          <ActionButton variant="secondary" size="md" icon={<Pause className="w-3.5 h-3.5" />} onClick={() => setStatus('PAUSED')}>
            Pause
          </ActionButton>
        ) : (
          <ActionButton variant="primary" size="md" icon={<Play className="w-3.5 h-3.5" />} onClick={() => setStatus('ACTIVE')}>
            Activate
          </ActionButton>
        )}
        <ActionButton variant="secondary" size="md" onClick={execute}>
          Run Now
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
