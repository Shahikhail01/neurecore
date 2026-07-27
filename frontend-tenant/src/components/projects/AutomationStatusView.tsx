// src/components/projects/AutomationStatusView.tsx
//
// Phase 7 (§9.1) — Automation status surface. Renders the canonical
// ProjectAutomationStatus returned by the /project-automation endpoint
// plus the goal / task / assignment progress counters. Self-contained
// so the project inspector can drop it next to the timeline.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Circle, RefreshCcw } from 'lucide-react';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export type AutomationCanonicalStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL';

export interface AutomationStatusView {
  projectId: string;
  tenantId: string;
  canonical: AutomationCanonicalStatus;
  lastLog: {
    id: string;
    event: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    error: string | null;
    triggeredBy: string | null;
    createdAt: string;
  } | null;
  progress: {
    goalsCreated: number;
    tasksCreated: number;
    assignmentsCreated: number;
  };
  history: Array<{
    id: string;
    event: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    triggeredBy: string | null;
    error: string | null;
    createdAt: string;
  }>;
}

export interface AutomationStatusViewProps {
  projectId: string;
  pollIntervalMs?: number;
  onComplete?: (view: AutomationStatusView) => void;
  className?: string;
}

const STATUS_LABELS: Record<AutomationCanonicalStatus, string> = {
  NOT_REQUESTED: 'Not requested',
  REQUESTED: 'Requested',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  PARTIAL: 'Partial',
  FAILED_RETRYABLE: 'Failed (retryable)',
  FAILED_FINAL: 'Failed (final)',
};

const STATUS_TONE: Record<
  AutomationCanonicalStatus,
  { icon: typeof CheckCircle2; ring: string; title: string; subtitle: string; bg: string }
> = {
  NOT_REQUESTED: {
    icon: Circle,
    ring: 'ring-slate-200',
    title: 'text-slate-600',
    subtitle: 'text-slate-500',
    bg: 'bg-slate-50',
  },
  REQUESTED: {
    icon: Loader2,
    ring: 'ring-sky-200',
    title: 'text-sky-700',
    subtitle: 'text-sky-600',
    bg: 'bg-sky-50',
  },
  PROCESSING: {
    icon: Loader2,
    ring: 'ring-indigo-200',
    title: 'text-indigo-700',
    subtitle: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  COMPLETED: {
    icon: CheckCircle2,
    ring: 'ring-emerald-300',
    title: 'text-emerald-700',
    subtitle: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  PARTIAL: {
    icon: AlertTriangle,
    ring: 'ring-amber-200',
    title: 'text-amber-700',
    subtitle: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  FAILED_RETRYABLE: {
    icon: AlertTriangle,
    ring: 'ring-rose-200',
    title: 'text-rose-700',
    subtitle: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  FAILED_FINAL: {
    icon: XCircle,
    ring: 'ring-rose-300',
    title: 'text-rose-700',
    subtitle: 'text-rose-600',
    bg: 'bg-rose-50',
  },
};

export function AutomationStatusView({
  projectId,
  pollIntervalMs = 4000,
  onComplete,
  className,
}: AutomationStatusViewProps) {
  const [view, setView] = useState<AutomationStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'socket' | 'polling' | 'idle'>('idle');

  const fetchOnce = useCallback(async () => {
    try {
      const res = await api.get(`/project-automation/${projectId}/status`);
      const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
      if (inner && typeof inner === 'object') {
        const next = inner as AutomationStatusView;
        setView(next);
        setError(null);
        if (next.canonical === 'COMPLETED') {
          onComplete?.(next);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'automation status failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, onComplete]);

  // Subscribe to per-project timeline events so we can react to
  // automationRequested / automationCompleted immediately.
  useEffect(() => {
    let active = true;
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
      if (!active) return;
      setTransport('socket');
      socket.emit('timeline:subscribe', { entityType: 'Project', entityId: projectId });
    };

    const onDisconnect = () => setTransport('polling');

    socket.on('timeline:event', onEvent);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.connect();
    return () => {
      active = false;
      socket.emit('timeline:unsubscribe', { entityType: 'Project', entityId: projectId });
      socket.off('timeline:event', onEvent);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [projectId, fetchOnce]);

  // Polling fallback (Phase 7 §9.3 / G7).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      await fetchOnce();
      if (cancelled) return;
      if (transport !== 'socket') setTransport('polling');
      // Stop polling once automation reaches a final state.
      if (
        view?.canonical === 'COMPLETED' ||
        view?.canonical === 'FAILED_FINAL' ||
        view?.canonical === 'NOT_REQUESTED'
      ) {
        return;
      }
      timer = setTimeout(tick, pollIntervalMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollIntervalMs, fetchOnce, transport, view?.canonical]);

  if (loading && !view) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600',
          className,
        )}
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading automation status…
      </div>
    );
  }

  if (error && !view) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700',
          className,
        )}
        role="alert"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          onClick={fetchOnce}
          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden />
        </button>
      </div>
    );
  }

  if (!view) return null;

  const tone = STATUS_TONE[view.canonical];
  const Icon = tone.icon;
  const isFinal =
    view.canonical === 'COMPLETED' ||
    view.canonical === 'FAILED_FINAL' ||
    view.canonical === 'NOT_REQUESTED';

  return (
    <section
      aria-label="Project automation status"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full ring-2',
              tone.bg,
              tone.ring,
            )}
            aria-hidden
          >
            <Icon
              className={cn(
                'h-4 w-4',
                tone.title,
                view.canonical === 'PROCESSING' || view.canonical === 'REQUESTED'
                  ? 'animate-spin'
                  : '',
              )}
            />
          </span>
          <div>
            <p className="text-xs uppercase text-slate-500">Automation</p>
            <h3 className={cn('text-base font-semibold', tone.title)}>
              {STATUS_LABELS[view.canonical]}
            </h3>
          </div>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] uppercase',
            transport === 'socket'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
          data-testid="automation-transport"
        >
          {isFinal ? 'idle' : transport}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <CounterTile
          label="Goals"
          value={view.progress.goalsCreated}
          tone="emerald"
        />
        <CounterTile label="Tasks" value={view.progress.tasksCreated} tone="indigo" />
        <CounterTile
          label="Assignments"
          value={view.progress.assignmentsCreated}
          tone="sky"
        />
      </dl>

      {view.lastLog?.error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {view.lastLog.error}
        </p>
      ) : null}

      {view.history.length > 0 ? (
        <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            History ({view.history.length})
          </summary>
          <ol className="mt-2 space-y-1">
            {view.history.slice().reverse().map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2"
              >
                <span>{entry.event}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] uppercase',
                    entry.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : entry.status === 'FAILED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-700',
                  )}
                >
                  {entry.status}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function CounterTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'indigo' | 'sky';
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-2',
        tone === 'emerald' && 'border-emerald-200 bg-emerald-50',
        tone === 'indigo' && 'border-indigo-200 bg-indigo-50',
        tone === 'sky' && 'border-sky-200 bg-sky-50',
      )}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold',
          tone === 'emerald' && 'text-emerald-700',
          tone === 'indigo' && 'text-indigo-700',
          tone === 'sky' && 'text-sky-700',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default AutomationStatusView;
