'use client';
// ─── AgentGrid.tsx ────────────────────────────────────────────────────────────
// SRP: Grid layout + empty/loading states only — no data fetching, no filtering.
// Delegates individual card rendering to existing <AgentCard />.

import { motion, AnimatePresence } from 'framer-motion';
import { AgentCard } from '@/components/agent-card/AgentCard';
import type { Agent } from '@/shared/types/domain.types';
import type { AgentCardAction } from '@/types/ui.types';

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-4"
      role="status"
      aria-label="No agents found"
    >
      <span className="text-5xl select-none" aria-hidden="true">🤖</span>
      <p className="text-zinc-500 text-sm">No agents match your filters.</p>
      <p className="text-zinc-600 text-xs">Try adjusting the search or status filter.</p>
    </motion.div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function AgentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      aria-busy="true"
      aria-label="Loading agents"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-raised rounded-xl border border-surface-border p-4 animate-pulse space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-surface-muted rounded w-2/3" />
              <div className="h-2 bg-surface-muted rounded w-1/2" />
            </div>
          </div>
          <div className="h-2 bg-surface-muted rounded w-full" />
          <div className="h-2 bg-surface-muted rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

interface AgentGridProps {
  agents: Agent[];
  loading?: boolean;
  selectedId?: string;
  onAction?: (action: AgentCardAction, agentId: string) => void;
}

export function AgentGrid({ agents, loading = false, selectedId, onAction }: AgentGridProps) {
  if (loading) {
    return <AgentGridSkeleton />;
  }

  if (!agents.length) {
    return <EmptyState />;
  }

  return (
    <motion.div
      layout
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      role="list"
      aria-label={`${agents.length} agent${agents.length !== 1 ? 's' : ''}`}
    >
      <AnimatePresence mode="popLayout">
        {agents.map((agent, idx) => (
          <motion.div
            key={agent.id}
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, delay: idx < 12 ? idx * 0.03 : 0 }}
            role="listitem"
          >
            <AgentCard
              agent={agent}
              variant="full"
              selected={agent.id === selectedId}
              onAction={onAction}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
