'use client';
// ─── OrgChartView.tsx ────────────────────────────────────────────────────────
// SRP: Renders the full org chart tree — tenant root → department cards → agent cards.
// DIP: Uses useOrgChart hook; all data from there (no direct API calls).
// OCP: DeptCard and EmployeeCard handle their own rendering.

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Briefcase } from 'lucide-react';
import type { OrgNode } from '@/features/org-chart/hooks/useOrgChart';
import { DeptCard } from './DeptCard';
import { getDeptColors, type DeptColorPair } from '../utils/dept-colors';

interface OrgChartViewProps {
  tree:           OrgNode;
  selectedId:     string | null;
  draggingId:     string | null;
  expandedDepts:  Set<string>;
  onSelectAgent:  (id: string) => void;
  onDragStart:    (id: string) => void;
  onDragEnd:      () => void;
  onToggleDept:   (id: string) => void;
  onDrop:         (agentId: string, toDeptId: string, toDeptName: string) => void;
}

function TenantCard({ node }: { node: OrgNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center"
    >
      <div className="w-72 rounded-2xl border-2 border-[color:var(--state-warning)]/40 bg-gradient-to-b from-amber-950/60 to-zinc-900/80 px-6 py-4 text-center shadow-xl shadow-amber-900/20">
        {/* Avatar/logo area */}
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--state-warning)]/20 ring-2 ring-amber-500/40">
          <Briefcase className="w-7 h-7 text-[color:var(--state-warning)]" />
        </div>
        <h2 className="text-base font-bold text-zinc-100">{node.name}</h2>
        <p className="mt-0.5 text-xs text-[color:var(--state-warning)]/80 font-medium">Chairman / Organization</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Building2 className="w-3.5 h-3.5 text-zinc-600" />
            <span>{node.departmentCount ?? 0} depts</span>
          </div>
          <div className="h-3 w-px bg-zinc-700" />
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Users className="w-3.5 h-3.5 text-zinc-600" />
            <span>{node.agentCount ?? 0} agents</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function OrgChartView({
  tree,
  selectedId,
  draggingId,
  expandedDepts,
  onSelectAgent,
  onDragStart,
  onDragEnd,
  onToggleDept,
  onDrop,
}: OrgChartViewProps) {
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent, deptId: string) => {
    e.preventDefault();
    setDragOverDeptId(deptId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDeptId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, deptId: string, deptName: string) => {
    e.preventDefault();
    setDragOverDeptId(null);
    const agentId = e.dataTransfer.getData('agentId');
    if (agentId && agentId !== deptId) {
      onDrop(agentId, deptId, deptName);
    }
  }, [onDrop]);

  const renderDeptCard = useCallback((node: OrgNode, color: DeptColorPair): React.ReactNode => {
    const isExpanded = expandedDepts.has(node.id);
    const isDragOver = dragOverDeptId === node.id;

    return (
      <DeptCard
        key={node.id}
        node={node}
        isExpanded={isExpanded}
        isDragOver={isDragOver}
        color={color}
        onToggle={() => onToggleDept(node.id)}
        onDragOver={(e) => handleDragOver(e, node.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, node.id, node.name)}
        selectedId={selectedId}
        draggingId={draggingId}
        onSelectAgent={onSelectAgent}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onToggleChild={onToggleDept}
        expandedDepts={expandedDepts}
        renderChild={renderDeptCard}
      />
    );
  }, [expandedDepts, dragOverDeptId, selectedId, draggingId, onToggleDept, handleDragOver, handleDragLeave, handleDrop, onSelectAgent, onDragStart, onDragEnd]);

  const rootDepts = tree.children ?? [];

  return (
    <div className="flex flex-col items-start overflow-x-auto py-6 px-2">
      {/* Tenant root — centered independently */}
      <div className="w-full flex justify-center">
        <TenantCard node={tree} />
      </div>

      {/* Connector lines */}
      {rootDepts.length > 0 && (
        <>
          <div className="w-full flex justify-center">
            <div className="flex items-end gap-0 mt-4">
              <div className="w-px h-6 bg-zinc-700" />
              <div
                className="h-px bg-zinc-700"
                style={{ width: `${Math.min(rootDepts.length, 4) * 288}px` }}
              />
              {rootDepts.slice(0, 4).map((_, i) => (
                <div key={i} className="w-px h-6 bg-zinc-700" />
              ))}
            </div>
          </div>

          {/* Department cards row */}
          <div className="w-full flex flex-wrap gap-4 mt-2 px-2">
            {rootDepts.map((dept) => (
              <div key={dept.id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-zinc-700" />
                {renderDeptCard(dept, getDeptColors(dept.id, dept.name))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {rootDepts.length === 0 && (
        <div className="mt-8 text-center w-full">
          <Building2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No departments yet</p>
          <p className="text-xs text-zinc-600 mt-1">Deploy a department template to build your org chart</p>
        </div>
      )}
    </div>
  );
}
