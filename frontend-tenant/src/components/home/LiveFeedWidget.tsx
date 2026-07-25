'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { useActivityFeed } from '@/shared/hooks/useActivityFeed';
import { clsx } from 'clsx';

interface FeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  actorLabel: string;
  severity: string;
}

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-blue-400',
  warn: 'bg-yellow-400',
  error: 'bg-red-400',
  success: 'bg-green-400',
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveFeedWidget() {
  const { events, loading, error } = useActivityFeed({ limit: 20 });

  const items: FeedItem[] = useMemo(() => {
    return events.map((e) => {
      const created =
        e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
      return {
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description ?? '',
        timestamp: created,
        actorLabel:
          e.actorType === 'AI_AGENT'
            ? `Agent ${e.actorId.slice(0, 6)}`
            : e.actorType === 'USER'
              ? `User ${e.actorId.slice(0, 6)}`
              : 'System',
        severity: e.severity ?? 'info',
      };
    });
  }, [events]);

  return (
    <GlassPanel className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[color:var(--state-info)]" />
        <h3 className="text-lg font-semibold text-white">Live Feed</h3>
        {loading && (
          <span className="text-xs text-zinc-500 ml-2">loading…</span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-[color:var(--state-danger)] mb-2">
          Failed to load activity feed.
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-400">No recent activity.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.4) }}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full mt-2',
                    SEVERITY_DOT[item.severity] ?? 'bg-blue-400',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {item.title}
                  </p>
                  {item.description && item.description !== item.title && (
                    <p className="text-xs text-zinc-400 truncate">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-1">
                    {item.actorLabel} • {formatRelative(item.timestamp)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}