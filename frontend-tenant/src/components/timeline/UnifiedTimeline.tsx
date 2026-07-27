// src/components/timeline/UnifiedTimeline.tsx
//
// Phase 7 (§9.1, §9.2) — Unified timeline component.
//
// Renders the chronological event stream for a single entity scope
// (project, task, attempt, etc.). Uses the canonical TimelineEvent
// shape from `@/services/timeline.service` and the useTimeline hook
// for transport (Socket.IO + polling fallback).
//
// SOLID:
//   - SRP: Render-and-navigate only; data fetching is delegated to
//     the hook.
//   - OCP: New event visuals are added via the EVENT_VISUAL map.
//   - ISP: Narrow props for the host screen.
//   - DIP: Depends on the hook + types, not on Prisma or axios.

'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  RefreshCcw,
  ShieldAlert,
  User,
  Bot,
  Cog,
} from 'lucide-react';
import { timelineService, TimelineEvent, SupportedEntityType } from '@/services/timeline.service';
import { useTimeline } from '@/hooks/useTimeline';
import { cn } from '@/lib/utils';

export interface UnifiedTimelineProps {
  entityType: SupportedEntityType;
  entityId: string;
  className?: string;
  emptyMessage?: string;
  showFilters?: boolean;
  initialLimit?: number;
  pollIntervalMs?: number;
  onEventClick?: (event: TimelineEvent) => void;
  ariaLabel?: string;
}

type FilterKey = 'all' | 'human' | 'ai' | 'failed' | 'review';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  human: 'Human',
  ai: 'AI',
  failed: 'Failures',
  review: 'Review',
};

const EVENT_VISUAL: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    tone: 'info' | 'warning' | 'critical' | 'success' | 'review';
  }
> = {
  ProjectCreated: { icon: CheckCircle2, tone: 'success' },
  InitiationCreated: { icon: Circle, tone: 'info' },
  InitiationApproved: { icon: CheckCircle2, tone: 'success' },
  InitiationRevised: { icon: Clock, tone: 'info' },
  AutomationRequested: { icon: Cog, tone: 'info' },
  AutomationStarted: { icon: Cog, tone: 'info' },
  AutomationCompleted: { icon: CheckCircle2, tone: 'success' },
  AutomationFailed: { icon: AlertOctagon, tone: 'critical' },
  GoalCreated: { icon: Circle, tone: 'info' },
  TaskCreated: { icon: Circle, tone: 'info' },
  AIAgentAssigned: { icon: Bot, tone: 'info' },
  AIAgentReassigned: { icon: Bot, tone: 'info' },
  ExecutionQueued: { icon: Clock, tone: 'info' },
  ExecutionStarted: { icon: Bot, tone: 'info' },
  ExecutionPaused: { icon: Clock, tone: 'warning' },
  ExecutionResumed: { icon: Bot, tone: 'info' },
  ExecutionFailed: { icon: AlertOctagon, tone: 'critical' },
  ExecutionSubmitted: { icon: CheckCircle2, tone: 'review' },
  EvidenceCreated: { icon: ShieldAlert, tone: 'info' },
  ReviewRequested: { icon: ShieldAlert, tone: 'review' },
  ReviewApproved: { icon: CheckCircle2, tone: 'success' },
  RevisionRequested: { icon: AlertTriangle, tone: 'warning' },
  TaskCompleted: { icon: CheckCircle2, tone: 'success' },
  StageAdvanced: { icon: CheckCircle2, tone: 'success' },
  ProjectCompleted: { icon: CheckCircle2, tone: 'success' },
  OperatorRetry: { icon: RefreshCcw, tone: 'warning' },
  OperatorCancel: { icon: AlertOctagon, tone: 'critical' },
  WaiverGranted: { icon: ShieldAlert, tone: 'warning' },
};

const TONE_CLASS: Record<string, { dot: string; icon: string; pill: string }> = {
  info: {
    dot: 'bg-sky-500',
    icon: 'text-sky-500',
    pill: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  warning: {
    dot: 'bg-amber-500',
    icon: 'text-amber-500',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  critical: {
    dot: 'bg-rose-500',
    icon: 'text-rose-500',
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  success: {
    dot: 'bg-emerald-500',
    icon: 'text-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  review: {
    dot: 'bg-indigo-500',
    icon: 'text-indigo-500',
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function UnifiedTimeline({
  entityType,
  entityId,
  className,
  emptyMessage = 'No events yet — actions on this entity will appear here.',
  showFilters = true,
  initialLimit,
  pollIntervalMs,
  onEventClick,
  ariaLabel = 'Unified timeline',
}: UnifiedTimelineProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const { events, loading, error, transport, retry } = useTimeline({
    entityType,
    entityId,
    initialLimit,
    pollIntervalMs,
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'human')
      return events.filter((e) => e.actorType === 'HUMAN');
    if (filter === 'ai')
      return events.filter((e) => e.actorType === 'AI_AGENT');
    if (filter === 'failed')
      return events.filter(
        (e) =>
          e.eventType === 'ExecutionFailed' ||
          e.eventType === 'AutomationFailed' ||
          e.eventType === 'OperatorCancel' ||
          e.severity === 'CRITICAL',
      );
    if (filter === 'review')
      return events.filter(
        (e) =>
          e.eventType === 'ReviewRequested' ||
          e.eventType === 'ReviewApproved' ||
          e.eventType === 'RevisionRequested',
      );
    return events;
  }, [events, filter]);

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col rounded-lg border border-slate-200 bg-white',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4" aria-hidden />
          Timeline
          <span
            className={cn(
              'ml-1 rounded-full border px-2 py-0.5 text-xs',
              transport === 'socket'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : transport === 'polling'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
            data-testid="timeline-transport"
          >
            {transport}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showFilters ? (
            <FilterSelect
              value={filter}
              onChange={setFilter}
              id="timeline-filter"
            />
          ) : null}
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            data-testid="timeline-refresh"
            aria-label="Refresh timeline"
          >
            <RefreshCcw className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </header>

      <div className="max-h-[600px] overflow-y-auto">
        {loading && events.length === 0 ? (
          <TimelineSkeleton />
        ) : error && events.length === 0 ? (
          <ErrorState message={error} onRetry={retry} />
        ) : filtered.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ol
            className="divide-y divide-slate-100"
            aria-label="Timeline events"
            role="list"
          >
            <AnimatePresence initial={false}>
              {filtered.map((event) => (
                <TimelineRow
                  key={event.id}
                  event={event}
                  onClick={onEventClick}
                />
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>

      {error && events.length > 0 ? (
        <p
          role="status"
          className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700"
        >
          Showing cached events. Live updates paused: {error}
        </p>
      ) : null}
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  id,
}: {
  value: FilterKey;
  onChange: (value: FilterKey) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <Filter className="h-3 w-3 text-slate-400" aria-hidden />
      <select
        id={id}
        aria-label="Timeline filter"
        value={value}
        onChange={(e) => onChange(e.target.value as FilterKey)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        data-testid={id}
      >
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
          <option key={key} value={key}>
            {FILTER_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );
}

function TimelineRow({
  event,
  onClick,
}: {
  event: TimelineEvent;
  onClick?: (event: TimelineEvent) => void;
}) {
  const visual = EVENT_VISUAL[event.eventType] ?? {
    icon: Circle,
    tone: 'info' as const,
  };
  const tone = TONE_CLASS[visual.tone];
  const Icon = visual.icon;
  const ActorIcon =
    event.actorType === 'HUMAN' ? User : event.actorType === 'AI_AGENT' ? Bot : Cog;

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-3 px-4 py-3 focus-within:bg-slate-50 hover:bg-slate-50"
      data-testid="timeline-event"
      data-event-type={event.eventType}
    >
      <span
        className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', tone.dot)}
        aria-hidden
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={cn('h-4 w-4', tone.icon)} aria-hidden />
          <span className="text-sm font-semibold text-slate-900">
            {event.title}
          </span>
          <span
            className={cn(
              'rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase',
              tone.pill,
            )}
          >
            {event.eventType}
          </span>
        </div>
        {event.description ? (
          <p className="mt-1 text-sm text-slate-600">{event.description}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ActorIcon className="h-3 w-3" aria-hidden /> {event.actorName}
          </span>
          <span>{formatTime(event.occurredAt)}</span>
          {event.correlationId ? (
            <span className="font-mono" title={event.correlationId}>
              corr: {event.correlationId.slice(0, 8)}
            </span>
          ) : null}
        </div>
      </div>
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(event)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-white"
          aria-label={`View details for ${event.title}`}
        >
          View
        </button>
      ) : null}
    </motion.li>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 animate-pulse rounded-md bg-slate-100"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
      <Clock className="h-8 w-8 text-slate-300" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 p-4 text-sm text-rose-700"
    >
      <AlertOctagon className="h-4 w-4" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">Could not load timeline</p>
        <p className="text-xs text-rose-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
      >
        Retry
      </button>
    </div>
  );
}

export default UnifiedTimeline;

// Re-export the underlying type so screens that compose the timeline
// import it from a single place.
export type { TimelineEvent } from '@/services/timeline.service';
export { timelineService };
export type { SupportedEntityType };
