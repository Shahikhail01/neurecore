'use client';
// ─── ActivityTimeline.tsx ─────────────────────────────────────────────────────
// SRP: Renders an animated storytelling timeline of ActivityEvent items only.
// OCP: New event types handled by adding entries to EVENT_CONFIG — no logic change.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActivityEvent, ActivityEventType } from '@/shared/types/domain.types';
import { formatRelative } from '@/utils/formatters';

interface EventConfig {
  icon: string;
  color: string;
  bgColor: string;
}

const EVENT_CONFIG: Record<ActivityEventType | 'default', EventConfig> = {
  'task.completed':       { icon: '✅', color: 'text-status-profit',   bgColor: 'bg-status-profit/10' },
  'task.failed':          { icon: '❌', color: 'text-status-risk',     bgColor: 'bg-status-risk/10'   },
  'agent.activated':      { icon: '🤖', color: 'text-status-ops',      bgColor: 'bg-status-ops/10'    },
  'agent.error':          { icon: '⚠️', color: 'text-status-risk',     bgColor: 'bg-status-risk/10'   },
  'workflow.started':     { icon: '🔄', color: 'text-status-strategy', bgColor: 'bg-status-strategy/10' },
  'workflow.completed':   { icon: '🏁', color: 'text-status-profit',   bgColor: 'bg-status-profit/10' },
  'approval.requested':   { icon: '🔔', color: 'text-status-warn',     bgColor: 'bg-status-warn/10'   },
  'approval.approved':    { icon: '✔️', color: 'text-status-profit',   bgColor: 'bg-status-profit/10' },
  'approval.rejected':    { icon: '🚫', color: 'text-status-risk',     bgColor: 'bg-status-risk/10'   },
  'collaboration':        { icon: '🤝', color: 'text-zinc-400',        bgColor: 'bg-zinc-800'           },
  'alert':                { icon: '🚨', color: 'text-status-risk',     bgColor: 'bg-status-risk/10'   },
  'default':              { icon: '●',  color: 'text-zinc-500',        bgColor: 'bg-surface-muted'     },
};

interface TimelineEntryProps {
  event: ActivityEvent;
  isLast: boolean;
}

function TimelineEntry({ event, isLast }: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_CONFIG[event.type as ActivityEventType] ?? EVENT_CONFIG.default;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      {/* Connector line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${cfg.bgColor} border border-surface-border`}>
          {cfg.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-surface-border mt-1" />}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <button
          className="w-full text-left group"
          onClick={() => setExpanded((p) => !p)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${cfg.color} leading-snug`}>
              {event.title}
            </p>
            <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-0.5">
              {formatRelative(event.timestamp)}
            </span>
          </div>
          {event.agentName && (
            <p className="text-xs text-zinc-500 mt-0.5">by {event.agentName}</p>
          )}
        </button>

        {/* Expandable detail */}
        <AnimatePresence>
          {expanded && event.description && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed border-l-2 border-surface-border pl-3">
                {event.description}
              </p>
              {event.impact && (
                <span
                  className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded ${
                    event.impact === 'positive'
                      ? 'bg-status-profit/10 text-status-profit'
                      : event.impact === 'negative'
                      ? 'bg-status-risk/10 text-status-risk'
                      : 'bg-surface-muted text-zinc-500'
                  }`}
                >
                  {event.impact.toUpperCase()} impact
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
  loading?: boolean;
  maxItems?: number;
}

export function ActivityTimeline({ events, loading = false, maxItems = 20 }: ActivityTimelineProps) {
  const visible = events.slice(0, maxItems);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-muted flex-shrink-0" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 bg-surface-muted rounded w-3/4" />
              <div className="h-2 bg-surface-muted rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!visible.length) {
    return (
      <p className="text-sm text-zinc-600 italic text-center py-6">
        No activity yet — your agents are getting started.
      </p>
    );
  }

  return (
    <section aria-label="Activity Timeline">
      <AnimatePresence initial={false}>
        {visible.map((event, idx) => (
          <TimelineEntry key={event.id} event={event} isLast={idx === visible.length - 1} />
        ))}
      </AnimatePresence>
    </section>
  );
}
