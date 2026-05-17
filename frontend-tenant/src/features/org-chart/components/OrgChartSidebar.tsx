'use client';
// ─── OrgChartSidebar.tsx ──────────────────────────────────────────────────────
// SRP: Renders the org chart sidebar panel — delegates data to useOrgChart().
// OCP: Node rendering is delegated to OrgChartNode components.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOrgChart }   from '@/features/org-chart/hooks/useOrgChart';
import { AgentNode, DeptNode } from '@/features/org-chart/components/OrgChartNode';

interface OrgChartSidebarProps {
  /** Whether the sidebar is visible */
  isOpen:  boolean;
  onClose: () => void;
}

export function OrgChartSidebar({ isOpen, onClose }: OrgChartSidebarProps) {
  const {
    filteredTree,
    query,
    selectedId,
    draggingId,
    isLoading,
    setQuery,
    select,
    setDragging,
    moveAgent,
    expandedDepts,
    toggleDept,
  } = useOrgChart();

  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [confirmMove, setConfirmMove]       = useState<{ agentId: string; agentName: string; toDeptId: string; toDeptName: string } | null>(null);

  const handleDragOver = (e: React.DragEvent, deptId: string) => {
    e.preventDefault();
    setDragOverDeptId(deptId);
  };

  const handleDragLeave = () => setDragOverDeptId(null);

  const handleDrop = (e: React.DragEvent, deptId: string, deptName: string) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData('agentId');
    if (!agentId || agentId === deptId) {
      setDragOverDeptId(null);
      return;
    }

    // Find agent name for confirm popup
    const agentNode = filteredTree
      .flatMap((d) => d.children ?? [])
      .find((a) => a.id === agentId);

    if (agentNode) {
      setConfirmMove({
        agentId,
        agentName: agentNode.name,
        toDeptId:  deptId,
        toDeptName: deptName,
      });
    }
    setDragOverDeptId(null);
    setDragging(null);
  };

  const confirmMoveAction = () => {
    if (!confirmMove) return;
    moveAgent(confirmMove.agentId, confirmMove.toDeptId);
    setConfirmMove(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="flex h-full flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950"
          aria-label="Organization Chart"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
            <h2 className="text-xs font-semibold text-zinc-300">Organization</h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              aria-label="Close org chart"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pt-3">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">🔍</span>
              <input
                type="search"
                placeholder="Search agents or departments…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-7 pr-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Tree */}
          <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {isLoading && (
              <div className="space-y-2 px-1 pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-zinc-800/60 animate-pulse"/>
                ))}
              </div>
            )}

            {!isLoading && filteredTree.length === 0 && (
              <p className="px-2 pt-4 text-center text-xs text-zinc-600">
                {query ? 'No results found.' : 'No departments yet.'}
              </p>
            )}

            {filteredTree.map((dept) => {
              const isExpanded = expandedDepts.has(dept.id);

              return (
                <div key={dept.id}>
                  <DeptNode
                    node={dept}
                    isExpanded={isExpanded}
                    isDragOver={dragOverDeptId === dept.id}
                    onToggle={() => toggleDept(dept.id)}
                    onDragOver={(e) => handleDragOver(e, dept.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dept.id, dept.name)}
                  />

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden pl-4 pr-1 mt-1 space-y-1"
                      >
                        {(dept.children ?? []).length === 0 ? (
                          <p className="py-1 text-center text-[10px] text-zinc-600">No agents</p>
                        ) : (
                          dept.children!.map((agent) => (
                            <AgentNode
                              key={agent.id}
                              node={agent}
                              isSelected={selectedId === agent.id}
                              isDragging={draggingId === agent.id}
                              onSelect={select}
                              onDragStart={setDragging}
                              onDragEnd={() => setDragging(null)}
                            />
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Hint */}
          <p className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
            Drag agents between departments to reorganize
          </p>
        </motion.aside>
      )}

      {/* Confirm move dialog */}
      <AnimatePresence>
        {confirmMove && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmMove(null)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[60] w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-sm font-semibold text-zinc-100">Confirm Restructure</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Move <strong className="text-zinc-200">{confirmMove.agentName}</strong> to{' '}
                <strong className="text-zinc-200">{confirmMove.toDeptName}</strong>?
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmMove(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMoveAction}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-500 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
