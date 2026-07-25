'use client';
// ─── DeptCard.tsx ────────────────────────────────────────────────────────────
// SRP: Renders a department card with employee sub-cards inside.
// OCP: Per-department color pairs are data-driven — each dept gets a unique hue.

import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import type { OrgNode } from '@/features/org-chart/hooks/useOrgChart';
import type { DeptColorPair } from '../utils/dept-colors';
import { EmployeeCard } from './EmployeeCard';
import { useInspectorStore } from '@/stores/inspectorStore';
import Link from 'next/link';

interface DeptCardProps {
  node:           OrgNode;
  isExpanded:     boolean;
  isDragOver:     boolean;
  color:          DeptColorPair;
  onToggle:       () => void;
  onDragOver:     (e: React.DragEvent) => void;
  onDragLeave:    () => void;
  onDrop:         (e: React.DragEvent) => void;
  selectedId:     string | null;
  draggingId:     string | null;
  onSelectAgent:  (id: string) => void;
  onDragStart:    (id: string) => void;
  onDragEnd:      () => void;
  onToggleChild:  (id: string) => void;
  expandedDepts:   Set<string>;
  renderChild:    (child: OrgNode, childColor: DeptColorPair) => React.ReactNode;
}

export function DeptCard({
  node, isExpanded, isDragOver, color,
  onToggle, onDragOver, onDragLeave, onDrop,
  selectedId, draggingId,
  onSelectAgent, onDragStart, onDragEnd,
  onToggleChild, expandedDepts, renderChild,
}: DeptCardProps) {
  const dept = node._dept;
  const agentCount = node.children?.filter((c) => c.type === 'agent').length ?? 0;
  const subDeptCount = node.children?.filter((c) => c.type === 'department').length ?? 0;
  const status = dept?.status ?? 'ACTIVE';

  return (
    <div className="flex flex-col items-center">
      {/* Department card */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`w-64 shrink-0 rounded-2xl border-2 transition-all duration-200 ${color.dark.bg} ${
          isDragOver
            ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/30 shadow-lg shadow-indigo-900/30'
            : `${color.dark.border}`
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 p-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color.dark.bg} border ${color.dark.border}`}>
            <Building2 className={`w-4 h-4 ${color.dark.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${color.dark.text}`}>{node.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                status === 'ACTIVE'
                  ? 'bg-[color:var(--state-success)]/10 text-[color:var(--state-success)] border-[color:var(--state-success)]/30'
                  : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                {status}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`shrink-0 p-1 rounded-md ${color.dark.text} opacity-60 hover:opacity-100 hover:${color.dark.bg} transition-colors`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-3 pb-2.5 ${color.dark.text} opacity-60`}>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
            </span>
            {subDeptCount > 0 && (
              <span className="flex items-center gap-1 opacity-60">
                <Building2 className="w-3 h-3" />
                {subDeptCount} sub
              </span>
            )}
          </div>
          <Link
            href={`/departments/${encodeURIComponent(node.id)}/workspace`}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] ${color.dark.text} opacity-70 hover:opacity-100 transition-opacity`}
          >
            Open →
          </Link>
        </div>

        {/* Drop hint */}
        {isDragOver && (
          <div className="px-3 pb-2.5">
            <div className={`rounded-lg border border-dashed ${color.dark.border} ${color.dark.bg} py-2 text-center text-xs ${color.dark.text} opacity-70`}>
              Drop to assign
            </div>
          </div>
        )}
      </div>

      {/* Sub-departments (recursive) */}
      <AnimatePresence>
        {isExpanded && subDeptCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-6 mt-4 overflow-hidden"
          >
            {node.children
              ?.filter((c) => c.type === 'department')
              .map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-zinc-700" />
                  <div className="h-px w-6 bg-zinc-700 -mt-px" />
                  {renderChild(child, color)}
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent cards */}
      <AnimatePresence>
        {isExpanded && agentCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap justify-center gap-2 mt-3 w-full overflow-hidden px-1"
          >
            {node.children
              ?.filter((c) => c.type === 'agent')
              .map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-[220px]"
                >
                  <EmployeeCard
                    node={agent}
                    isSelected={selectedId === agent.id}
                    isDragging={draggingId === agent.id}
                    onSelect={onSelectAgent}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    deptColor={color.light}
                  />
                </motion.div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connector line from card to agents */}
      {isExpanded && agentCount > 0 && (
        <div className="w-px h-4 bg-zinc-700 mt-2" />
      )}
    </div>
  );
}
