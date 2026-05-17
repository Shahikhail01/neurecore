'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  completedAt?: string;
  evaluationScore?: number;
  agent?: { id: string; name: string };
}

type KanbanColumn = {
  id: Task['status'];
  label: string;
  color: string;
  dotColor: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: 'PENDING',   label: 'Pending',    color: 'border-zinc-700',   dotColor: 'bg-zinc-400' },
  { id: 'RUNNING',   label: 'In Progress', color: 'border-blue-700',   dotColor: 'bg-blue-400' },
  { id: 'COMPLETED', label: 'Completed',   color: 'border-emerald-700', dotColor: 'bg-emerald-400' },
  { id: 'FAILED',    label: 'Failed',      color: 'border-red-700',     dotColor: 'bg-red-400' },
];

const PRIORITY_BADGE: Record<string, string> = {
  LOW:      'bg-zinc-800 text-zinc-400',
  MEDIUM:   'bg-blue-900 text-blue-300',
  HIGH:     'bg-amber-900 text-amber-300',
  CRITICAL: 'bg-red-900 text-red-300',
};

const SCORE_COLOR = (score: number) =>
  score >= 0.8 ? 'text-status-profit' : score >= 0.5 ? 'text-status-warn' : 'text-status-risk';

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="rounded-xl border border-surface-border bg-surface-raised p-3.5 cursor-pointer hover:border-violet-600/60 transition-colors group"
    >
      {/* Priority + score */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
          {task.priority}
        </span>
        {task.evaluationScore != null && (
          <span className={`text-xs font-mono ${SCORE_COLOR(task.evaluationScore)}`}>
            {(task.evaluationScore * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm text-zinc-200 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
        {task.title}
      </p>

      {/* Agent + date */}
      <div className="mt-2.5 flex items-center justify-between">
        {task.agent ? (
          <span className="text-xs text-zinc-500 truncate max-w-28">{task.agent.name}</span>
        ) : (
          <span className="text-xs text-zinc-600 italic">Unassigned</span>
        )}
        <span className="text-xs text-zinc-600">
          {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks?limit=200');
      setTasks(unwrapArrayOrEmpty(res));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTasks(); }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.agent?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const byStatus = (status: Task['status']) => filtered.filter((t) => t.status === status);

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-[1400px] mx-auto space-y-5 h-full flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Tasks</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{tasks.length} tasks total</p>
          </div>
          <div className="flex gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-surface-border overflow-hidden">
              {(['kanban', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs transition ${view === v ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                >
                  {v === 'kanban' ? '⊟' : '≡'}
                </button>
              ))}
            </div>
            <button
              onClick={() => void fetchTasks()}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap gap-3 flex-shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or agents…"
            className="flex-1 min-w-48 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition"
          />
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                priorityFilter === p ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* ── Kanban / List view ── */}
        {loading ? (
          <div className="flex gap-4 flex-1">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-3 animate-pulse min-h-64" />
            ))}
          </div>
        ) : view === 'kanban' ? (
          /* ── Kanban board ── */
          <div className="flex gap-4 flex-1 overflow-x-auto pb-2 min-h-0">
            {COLUMNS.map((col) => {
              const colTasks = byStatus(col.id);
              return (
                <div
                  key={col.id}
                  className={`flex-shrink-0 w-68 min-w-64 flex flex-col rounded-xl border ${col.color} bg-surface-raised`}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 border-b border-surface-border flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-semibold text-zinc-300">{col.label}</span>
                    <span className="ml-auto text-xs text-zinc-500 bg-surface-overlay rounded px-1.5 py-0.5">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                    <AnimatePresence mode="popLayout">
                      {colTasks.length === 0 ? (
                        <p className="text-xs text-zinc-600 text-center py-6">Empty</p>
                      ) : (
                        colTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => openInspector('task', task.id)}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── List view ── */
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase border-b border-surface-border">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Agent</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((task) => (
                    <motion.tr
                      key={task.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => openInspector('task', task.id)}
                      className="border-t border-surface-border hover:bg-surface-overlay transition cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-200 max-w-xs truncate">{task.title}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          PRIORITY_BADGE[task.status] ?? 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{task.agent?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {task.evaluationScore != null ? (
                          <span className={SCORE_COLOR(task.evaluationScore)}>
                            {(task.evaluationScore * 100).toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center text-zinc-500 text-sm">No tasks found</div>
            )}
          </div>
        )}
      </div>
    </TenantShell>
  );
}
