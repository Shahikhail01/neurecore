'use client';
// ─── Agent Card ───────────────────────────────────────────────────────────────
// O — Open/Closed: three variants via props, new variants add without changing core logic
// S — Single Responsibility: card rendering + emitting actions up only

import { motion } from 'framer-motion';
import { useInspectorStore } from '@/stores/inspectorStore';
import { STATUS_BADGE_CLASS, STATUS_COLOR_MAP } from '@/types/ui.types';
import type { AgentCardProps, AgentCardAction } from '@/types/ui.types';

const STATUS_DOT: Record<string, string> = {
  RUNNING:  'bg-status-ops animate-pulse-slow',
  ACTIVE:   'bg-status-profit animate-pulse-slow',
  IDLE:     'bg-status-neutral',
  PAUSED:   'bg-status-warn',
  FAILED:   'bg-status-risk',
  ERROR:    'bg-status-risk',
  STOPPED:  'bg-surface-muted',
};

function WorkloadBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

// L — Liskov: compact/full/inspector all satisfy AgentCardProps contract
export function AgentCard({ agent, variant = 'full', onAction, selected = false, className = '' }: AgentCardProps) {
  const { openInspector } = useInspectorStore();
  const statusColor = STATUS_COLOR_MAP[agent.status] ?? 'neutral';
  const dotClass = STATUS_DOT[agent.status] ?? 'bg-surface-muted';

  const workloadColor =
    (agent.workloadPct ?? 0) > 80 ? 'bg-status-risk' :
    (agent.workloadPct ?? 0) > 50 ? 'bg-status-warn' : 'bg-status-ops';

  const handleAction = (action: AgentCardAction) => {
    if (action === 'inspect') {
      openInspector('agent', agent.id);
      return;
    }
    onAction?.(action, agent.id);
  };

  // ─── Compact variant ─────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-surface-raised hover:bg-surface-overlay cursor-pointer transition-colors ${selected ? 'ring-1 ring-status-ops' : ''} ${className}`}
        onClick={() => handleAction('inspect')}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="text-sm font-medium text-zinc-200 truncate flex-1">{agent.name}</span>
        {agent.workloadPct !== undefined && (
          <span className="text-xs text-zinc-500">{agent.workloadPct}%</span>
        )}
      </motion.div>
    );
  }

  // ─── Full variant (grid card) ─────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border border-surface-border bg-surface-raised p-5 flex flex-col gap-3 hover:border-surface-muted transition-colors ${selected ? 'ring-1 ring-status-ops' : ''} ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{agent.name}</p>
            {agent.role && <p className="text-xs text-zinc-500 truncate">{agent.role}</p>}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE_CLASS[statusColor]}`}>
          {agent.status}
        </span>
      </div>

      {/* Type badge + tenant */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded bg-surface-muted text-zinc-400">{agent.type}</span>
        {agent.tenantName && (
          <span className="text-xs text-zinc-600 truncate">{agent.tenantName}</span>
        )}
      </div>

      {/* Workload */}
      {agent.workloadPct !== undefined && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Workload</span>
            <span>{agent.workloadPct}%</span>
          </div>
          <WorkloadBar pct={agent.workloadPct} color={workloadColor} />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {agent.successRate !== undefined && (
          <div>
            <p className="text-xs text-zinc-500">Success</p>
            <p className={`text-sm font-bold ${agent.successRate >= 80 ? 'text-status-profit' : agent.successRate >= 50 ? 'text-status-warn' : 'text-status-risk'}`}>
              {agent.successRate}%
            </p>
          </div>
        )}
        {agent.tasksToday !== undefined && (
          <div>
            <p className="text-xs text-zinc-500">Tasks</p>
            <p className="text-sm font-bold text-zinc-200">{agent.tasksToday}</p>
          </div>
        )}
        {agent.costToday !== undefined && (
          <div>
            <p className="text-xs text-zinc-500">Cost</p>
            <p className="text-sm font-bold text-status-strategy">${agent.costToday.toFixed(3)}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-surface-border">
        <button
          className="flex-1 text-xs py-1.5 rounded-lg bg-surface-muted hover:bg-surface-overlay text-zinc-300 transition-colors"
          onClick={() => handleAction('inspect')}
        >
          Inspect
        </button>
        {agent.status === 'RUNNING' ? (
          <button
            className="flex-1 text-xs py-1.5 rounded-lg bg-status-warn/10 hover:bg-status-warn/20 text-status-warn transition-colors"
            onClick={() => handleAction('pause')}
          >
            Pause
          </button>
        ) : (
          <button
            className="flex-1 text-xs py-1.5 rounded-lg bg-status-ops/10 hover:bg-status-ops/20 text-status-ops transition-colors"
            onClick={() => handleAction('resume')}
          >
            Resume
          </button>
        )}
        <button
          className="flex-1 text-xs py-1.5 rounded-lg bg-surface-muted hover:bg-surface-overlay text-zinc-400 transition-colors"
          onClick={() => handleAction('audit')}
        >
          Audit
        </button>
      </div>
    </motion.div>
  );
}
