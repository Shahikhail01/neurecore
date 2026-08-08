'use client';
// ─── EmployeeCard.tsx ────────────────────────────────────────────────────────
// SRP: Renders a single employee card inside a DeptCard.
// Shows: avatar, name, designation, date joined, status, workload.

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { OrgNode } from '@/features/org-chart/hooks/useOrgChart';
import { useInspectorStore } from '@/stores/inspectorStore';

const STATUS_DOT: Record<string, string> = {
  ACTIVE:   'bg-emerald-400',
  INACTIVE: 'bg-zinc-500',
  TRAINING: 'bg-amber-400',
  ERROR:    'bg-red-400',
  PAUSED:   'bg-sky-400',
  RUNNING:  'bg-emerald-400',
  IDLE:     'bg-zinc-500',
  TERMINATED: 'bg-zinc-700',
  ARCHIVED: 'bg-zinc-700',
  DEPRECATED: 'bg-zinc-600',
};

const MOOD_EMOJI: Record<string, string> = {
  busy:       '😤',
  idle:       '😌',
  optimistic: '😊',
  stressed:   '😰',
  offline:    '😴',
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EmployeeCardProps {
  node:       OrgNode;
  isSelected:  boolean;
  isDragging: boolean;
  onSelect:   (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd:  () => void;
  /** Light variant of the parent department's color pair */
  deptColor:  { bg: string; border: string; text: string; accent: string };
}

export function EmployeeCard({
  node, isSelected, isDragging,
  onSelect, onDragStart, onDragEnd,
  deptColor,
}: EmployeeCardProps) {
  const { openInspector } = useInspectorStore();
  const [hovered, setHovered] = useState(false);

  const agent = node._agent;
  const dotColor = STATUS_DOT[node.status ?? 'INACTIVE'] ?? 'bg-zinc-500';
  const moodEmoji = MOOD_EMOJI[node.mood ?? 'idle'] ?? '😌';
  const workload = node.workloadGauge ?? 0;
  const designation = agent?.type ?? 'Agent';
  const joinedAt = agent?.createdAt ?? '';

  const tasksCompleted = agent?.performance?.tasksCompleted ?? 0;
  const successRate = agent?.performance?.successRate ?? 0;

  return (
    <motion.div
      layout
      draggable
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); openInspector('agent', node.id); } }}
      onDragStart={(e) => {
        (e as unknown as DragEvent).dataTransfer?.setData('agentId', node.id);
        onDragStart(node.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        onSelect(node.id);
        openInspector('agent', node.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex w-full min-w-0 cursor-grab items-center gap-3 rounded-xl border px-3 py-2.5 transition-all
        ${isSelected
          ? `border-[color:var(--accent-500)]/60 ${deptColor.bg} shadow-lg ${deptColor.border}`
          : `border-zinc-800/60 ${deptColor.bg} hover:border-zinc-700`
        }
        ${isDragging ? 'opacity-40 scale-95' : ''}
      `}
      whileHover={{ y: -1 }}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {node.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.avatarUrl}
            alt={node.name}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-zinc-800"
          />
        ) : (
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${deptColor.bg} ring-2 ring-zinc-800 text-sm font-bold ${deptColor.text}`}>
            {node.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${dotColor}`} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`min-w-0 truncate text-sm font-semibold ${deptColor.text}`}>{node.name}</p>
          <span className="shrink-0 text-sm" title={`Mood: ${node.mood}`}>{moodEmoji}</span>
        </div>
        <p className={`text-[11px] ${deptColor.text} opacity-70 truncate max-w-full`}>{designation}</p>
        <div className="flex items-center gap-2 mt-0.5 min-w-0 overflow-hidden">
          <span className="text-[10px] text-zinc-500 shrink-0">
            Joined {formatDate(joinedAt)}
          </span>
          {tasksCompleted > 0 && (
            <span className="text-[10px] text-zinc-500 shrink-0">
              · {tasksCompleted} tasks
            </span>
          )}
          {successRate > 0 && (
            <span className={`text-[10px] shrink-0 ${successRate >= 80 ? 'text-[color:var(--state-success)]' : successRate >= 50 ? 'text-[color:var(--state-warning)]' : 'text-[color:var(--state-danger)]'}`}>
              · {successRate}%
            </span>
          )}
        </div>
      </div>

      {/* Workload gauge */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div className="w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              workload > 80 ? 'bg-red-400' : workload > 60 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${workload}%` }}
          />
        </div>
        <span className="text-[10px] text-zinc-500">{workload}%</span>
      </div>

      {/* Hover card tooltip */}
      {hovered && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-56 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-xs">
          <div className="flex items-center gap-2 mb-2">
            {node.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.avatarUrl} alt={node.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-500)]/60 text-xs font-bold text-indigo-300">
                {node.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-zinc-200">{node.name}</p>
              <p className="text-zinc-500">{designation}</p>
            </div>
          </div>
          <div className="space-y-1 text-zinc-400">
            <p>Status: <span className="text-zinc-200">{node.status}</span></p>
            <p>Joined: <span className="text-zinc-200">{formatDate(joinedAt)}</span></p>
            <p>Tasks: <span className="text-zinc-200">{tasksCompleted} completed</span></p>
            <p>Success rate: <span className={`font-medium ${successRate >= 80 ? 'text-[color:var(--state-success)]' : 'text-zinc-200'}`}>{successRate}%</span></p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
