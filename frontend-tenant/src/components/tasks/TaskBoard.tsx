// src/components/tasks/TaskBoard.tsx
//
// Phase 7 (§9.1) — Kanban-style task board. Pulls tasks from the
// project-automation status endpoint and renders columns for the
// canonical TaskStatus state machine. The component is keyboard-
// navigable (arrow keys move the focused task row) and re-fetches on
// the unified timeline stream so newly created tasks appear without a
// page refresh.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { tasksService, Task, TaskStatus } from '@/services/tasks.service';
import { cn } from '@/lib/utils';

const COLUMNS: { status: TaskStatus; label: string; tone: string }[] = [
  { status: 'READY', label: 'Ready', tone: 'border-slate-200 bg-slate-50' },
  { status: 'ASSIGNED', label: 'Assigned', tone: 'border-sky-200 bg-sky-50' },
  { status: 'QUEUED', label: 'Queued', tone: 'border-indigo-200 bg-indigo-50' },
  { status: 'IN_PROGRESS', label: 'In progress', tone: 'border-blue-200 bg-blue-50' },
  { status: 'NEEDS_INPUT', label: 'Needs input', tone: 'border-amber-300 bg-amber-50' },
  { status: 'NEEDS_REVIEW', label: 'Needs review', tone: 'border-indigo-300 bg-indigo-50' },
  { status: 'COMPLETED', label: 'Completed', tone: 'border-emerald-200 bg-emerald-50' },
  { status: 'BLOCKED', label: 'Blocked', tone: 'border-rose-200 bg-rose-50' },
  { status: 'FAILED_RETRYABLE', label: 'Failed (retryable)', tone: 'border-rose-300 bg-rose-50' },
  { status: 'CANCELLED', label: 'Cancelled', tone: 'border-slate-300 bg-slate-50' },
];

export interface TaskBoardProps {
  projectId: string;
  onTaskSelect?: (task: Task) => void;
  className?: string;
  pollIntervalMs?: number;
}

export function TaskBoard({
  projectId,
  onTaskSelect,
  className,
  pollIntervalMs = 6000,
}: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'socket' | 'polling' | 'idle'>('idle');
  const [focusColumn, setFocusColumn] = useState<number>(0);

  const fetchOnce = useCallback(async () => {
    try {
      const list = await tasksService.listByProject(projectId);
      setTasks(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'task list failed');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Real-time refresh via the unified timeline socket.
  useEffect(() => {
    let mounted = true;
    const socket: Socket = io({
      withCredentials: true,
      transports: ['polling'],
      upgrade: false,
      autoConnect: false,
    });

    const onEvent = (payload: { entityType?: string; entityId?: string }) => {
      if (
        payload?.entityType === 'Project' &&
        payload?.entityId === projectId
      ) {
        void fetchOnce();
      }
    };

    const onConnect = () => {
      if (!mounted) return;
      setTransport('socket');
      socket.emit('timeline:subscribe', {
        entityType: 'Project',
        entityId: projectId,
      });
    };

    const onDisconnect = () => setTransport('polling');

    socket.on('timeline:event', onEvent);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.connect();
    return () => {
      mounted = false;
      socket.emit('timeline:unsubscribe', {
        entityType: 'Project',
        entityId: projectId,
      });
      socket.off('timeline:event', onEvent);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [projectId, fetchOnce]);

  // Polling fallback.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      await fetchOnce();
      if (cancelled) return;
      if (transport !== 'socket') setTransport('polling');
      timer = setTimeout(tick, pollIntervalMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollIntervalMs, fetchOnce, transport]);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(COLUMNS.map((c) => [c.status, []]));
    for (const t of tasks) {
      const arr = map.get(t.status);
      if (arr) arr.push(t);
      else {
        // hidden bucket — keep statuses missing from the column list
        const fallback = map.get('READY') as Task[];
        fallback.push(t);
      }
    }
    return map;
  }, [tasks]);

  const handleKey = (e: React.KeyboardEvent<HTMLOListElement>) => {
    if (e.key === 'ArrowRight') {
      setFocusColumn((c) => Math.min(COLUMNS.length - 1, c + 1));
    } else if (e.key === 'ArrowLeft') {
      setFocusColumn((c) => Math.max(0, c - 1));
    }
  };

  const boardRef = useRef<HTMLOListElement | null>(null);

  return (
    <section
      aria-label="Task board"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Task board</h2>
          <p className="text-xs text-slate-500">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} · transport: {transport}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOnce}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-label="Refresh task board"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden />
        </button>
      </header>

      {error && tasks.length === 0 ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <ol
        ref={boardRef}
        tabIndex={0}
        onKeyDown={handleKey}
        className="grid grid-cols-1 gap-3 focus:outline-none md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-label="Task columns. Use arrow keys to navigate between columns."
      >
        {COLUMNS.map((col, idx) => {
          const colTasks = grouped.get(col.status) ?? [];
          const focused = idx === focusColumn;
          return (
            <li
              key={col.status}
              className={cn(
                'flex flex-col gap-2 rounded-md border p-2',
                col.tone,
                focused ? 'ring-2 ring-indigo-300' : '',
              )}
              aria-label={`${col.label} (${colTasks.length})`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase text-slate-700">
                  {col.label}
                </span>
                <span className="text-xs text-slate-500">{colTasks.length}</span>
              </div>
              <ul className="flex flex-col gap-1" role="list">
                {colTasks.length === 0 ? (
                  <li className="rounded border border-dashed border-slate-200 bg-white/60 p-2 text-center text-xs text-slate-400">
                    Empty
                  </li>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={onTaskSelect}
                    />
                  ))
                )}
              </ul>
            </li>
          );
        })}
      </ol>

      {loading && tasks.length === 0 ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading tasks…
        </div>
      ) : null}
    </section>
  );
}

function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick?: (task: Task) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick?.(task)}
        className={cn(
          'flex w-full flex-col items-start gap-1 rounded border border-slate-200 bg-white p-2 text-left text-xs shadow-sm transition hover:border-slate-300 hover:bg-slate-50',
        )}
        data-testid={`task-card-${task.id}`}
        aria-label={`Task ${task.title}`}
      >
        <span className="text-sm font-semibold text-slate-900">
          {task.title}
        </span>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
          {task.templateKey ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5">
              {task.templateKey}
            </span>
          ) : null}
          <span className="rounded bg-slate-100 px-1.5 py-0.5">
            {task.priority}
          </span>
          {task.agentId ? (
            <span className="font-mono text-slate-500">
              ag:{task.agentId.slice(0, 6)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-amber-600">
              <ArrowRight className="h-3 w-3" aria-hidden /> unassigned
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

export default TaskBoard;
