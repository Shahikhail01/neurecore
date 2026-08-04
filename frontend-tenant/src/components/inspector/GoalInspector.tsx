'use client';
// ─── Goal Inspector ───────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Trash2, Plus, Minus } from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface GoalDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  level: string;
  progress: number;
  parentId?: string | null;
  ownerAgentId?: string | null;
  ownerAgent?: { name: string };
  departmentId?: string;
  targetDate?: string;
  completedAt?: string | null;
  createdAt: string;
}

export function GoalInspector({ id }: { id: string }) {
  const [g, setG] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/goals/${id}`)
      .then((r) => setG(unwrapItem(r)))
      .catch(() => setG(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const adjustProgress = async (delta: number) => {
    if (!g) return;
    const next = Math.max(0, Math.min(100, g.progress + delta));
    await api.patch(`/goals/${id}/progress`, { progress: next });
    load();
  };
  const setStatus = async (status: string) => {
    await api.patch(`/goals/${id}`, { status });
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this goal?')) return;
    await api.delete(`/goals/${id}`);
    load();
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
  if (!g) return <div className="p-6 text-zinc-500 text-sm">Goal not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{g.title}</h2>
          <Link
            href={`/goals/${g.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={g.status} />
          <StatusBadge status={g.level} />
          {g.ownerAgent?.name && (
            <span className="text-xs text-zinc-500">Owner: {g.ownerAgent.name}</span>
          )}
        </div>
        {g.description && <p className="text-xs text-zinc-400 mt-2">{g.description}</p>}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Progress</span>
          <span className="font-mono text-zinc-300">{g.progress}%</span>
        </div>
        <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full transition-all"
            style={{ width: `${g.progress}%` }}
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <ActionButton
            variant="secondary"
            size="sm"
            icon={<Minus className="w-3 h-3" />}
            onClick={() => adjustProgress(-10)}
          >
            -10
          </ActionButton>
          <ActionButton
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3 h-3" />}
            onClick={() => adjustProgress(10)}
          >
            +10
          </ActionButton>
        </div>
      </div>

      {g.targetDate && (
        <Row label="Target" value={new Date(g.targetDate).toLocaleDateString()} />
      )}
      <Row label="Created" value={new Date(g.createdAt).toLocaleDateString()} />
      {g.completedAt && (
        <Row label="Completed" value={new Date(g.completedAt).toLocaleDateString()} />
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        {g.status !== 'COMPLETED' && (
          <ActionButton variant="primary" size="md" onClick={() => setStatus('COMPLETED')}>
            Mark Complete
          </ActionButton>
        )}
        {g.status === 'COMPLETED' && (
          <ActionButton variant="secondary" size="md" onClick={() => setStatus('ACTIVE')}>
            Reopen
          </ActionButton>
        )}
        {g.status === 'ACTIVE' && (
          <ActionButton variant="secondary" size="md" onClick={() => setStatus('PAUSED')}>
            Pause Goal
          </ActionButton>
        )}
        {g.status === 'PAUSED' && (
          <ActionButton variant="secondary" size="md" onClick={() => setStatus('ACTIVE')}>
            Resume Goal
          </ActionButton>
        )}
        {g.status !== 'ARCHIVED' && (
          <ActionButton variant="ghost" size="md" onClick={() => setStatus('ARCHIVED')}>
            Archive Goal
          </ActionButton>
        )}
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
