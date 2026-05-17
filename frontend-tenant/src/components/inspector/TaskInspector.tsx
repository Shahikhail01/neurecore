'use client';
// ─── Task Inspector ───────────────────────────────────────────────────────────
// S — Single Responsibility: renders task execution trace in inspector panel
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_BADGE_CLASS, STATUS_COLOR_MAP } from '@/types/ui.types';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  completedAt?: string;
  agent?: { name: string };
  executionLog?: { step: string; status: string; durationMs?: number; output?: string }[];
  evaluationScore?: number;
  cost?: number;
}

export function TaskInspector({ id }: { id: string }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/tasks/${id}`)
      .then((r) => setTask(unwrapItem(r)))
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-6 flex flex-col gap-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${55 + i * 8}%` }} />
      ))}
    </div>
  );

  if (!task) return <div className="p-6 text-zinc-500 text-sm">Task not found.</div>;

  const statusColor = STATUS_COLOR_MAP[task.status] ?? 'neutral';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-100 leading-tight">{task.title}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[statusColor]}`}>
            {task.status}
          </span>
          <span className="text-xs text-zinc-500">Priority: {task.priority}</span>
          {task.agent && <span className="text-xs text-zinc-600">👤 {task.agent.name}</span>}
        </div>
      </div>

      {task.evaluationScore !== undefined && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Eval Score</span>
          <span className={`text-sm font-bold ${task.evaluationScore >= 0.8 ? 'text-status-profit' : task.evaluationScore >= 0.5 ? 'text-status-warn' : 'text-status-risk'}`}>
            {(task.evaluationScore * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {task.cost !== undefined && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Cost</span>
          <span className="text-sm font-bold text-status-strategy">${task.cost.toFixed(4)}</span>
        </div>
      )}

      {/* Execution trace */}
      {task.executionLog && task.executionLog.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">Execution Trace</p>
          <div className="flex flex-col gap-2">
            {task.executionLog.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  step.status === 'success' ? 'bg-status-profit/20 text-status-profit' :
                  step.status === 'failed' ? 'bg-status-risk/20 text-status-risk' :
                  'bg-surface-muted text-zinc-400'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 font-medium">{step.step}</p>
                  {step.durationMs && <p className="text-zinc-600">{step.durationMs}ms</p>}
                  {step.output && (
                    <p className="text-zinc-500 font-mono mt-0.5 truncate">{step.output}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-zinc-600">Created: {new Date(task.createdAt).toLocaleString()}</div>
    </motion.div>
  );
}
