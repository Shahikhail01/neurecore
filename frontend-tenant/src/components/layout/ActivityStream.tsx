'use client';
// ─── Activity Stream ──────────────────────────────────────────────────────────
// S — Single Responsibility: displays real-time event stream in a persistent bottom bar
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivityStore } from '@/stores/activityStore';

const SEVERITY_COLOR: Record<string, string> = {
  info:    'text-zinc-400',
  success: 'text-status-profit',
  warn:    'text-status-warn',
  error:   'text-status-risk',
};

const TYPE_ICON: Record<string, string> = {
  agent:    '🤖',
  task:     '⚡',
  workflow: '🔄',
  system:   '🖥',
  approval: '✅',
  tenant:   '🏢',
};

function timestamp(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

export function ActivityStream() {
  const { events, dismiss } = useActivityStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flex-shrink-0 border-t border-surface-border bg-surface-raised transition-all duration-200 ${expanded ? 'h-52' : 'h-11'}`}
    >
      {/* Header strip */}
      <div className="h-11 flex items-center px-4 gap-3">
        <button
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          onClick={() => setExpanded((p) => !p)}
        >
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▲</span>
          <span className="font-medium">Activity Stream</span>
          {events.length > 0 && (
            <span className="bg-surface-muted text-zinc-400 text-[10px] px-1.5 py-0.5 rounded-full">
              {events.length}
            </span>
          )}
        </button>

        {/* Latest event ticker */}
        {!expanded && events[0] && (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="text-xs">{TYPE_ICON[events[0].type] ?? '●'}</span>
            <span className={`text-xs truncate ${SEVERITY_COLOR[events[0].severity]}`}>
              {events[0].message}
            </span>
            <span className="text-[10px] text-zinc-600 flex-shrink-0">{timestamp(events[0].timestamp)}</span>
          </div>
        )}
      </div>

      {/* Expanded list */}
      {expanded && (
        <div className="overflow-y-auto h-[calc(100%-44px)] px-4 pb-2 flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 py-1 border-b border-surface-border/50"
              >
                <span className="text-xs">{TYPE_ICON[event.type] ?? '●'}</span>
                <span className={`text-xs flex-1 truncate ${SEVERITY_COLOR[event.severity]}`}>
                  {event.message}
                </span>
                <span className="text-[10px] text-zinc-600 flex-shrink-0">{timestamp(event.timestamp)}</span>
                <button
                  onClick={() => dismiss(event.id)}
                  className="text-[10px] text-zinc-700 hover:text-zinc-400 flex-shrink-0"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {events.length === 0 && (
            <p className="text-xs text-zinc-600 pt-2">No recent activity</p>
          )}
        </div>
      )}
    </div>
  );
}
