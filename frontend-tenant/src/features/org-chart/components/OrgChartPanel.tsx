'use client';
// ─── OrgChartPanel.tsx ───────────────────────────────────────────────────────
// SRP: Org chart tab panel — hosts search, the OrgChartView tree, and confirm dialog.
// DIP: All data from useOrgChart hook; OrgChartView handles rendering.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrgChart } from '@/features/org-chart/hooks/useOrgChart';
import { OrgChartView } from '@/features/org-chart/components/OrgChartView';
import { tenantsService } from '@/services/tenants.service';
import { GitBranch, Search, X } from 'lucide-react';
import { useEffect } from 'react';

export function OrgChartPanel() {
  const {
    tenantTree,
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

  const [tenantName, setTenantName] = useState('Organization');
  const [confirmMove, setConfirmMove] = useState<{
    agentId: string;
    agentName: string;
    toDeptId: string;
    toDeptName: string;
  } | null>(null);

  useEffect(() => {
    tenantsService.getCurrent()
      .then((t) => setTenantName(t.name))
      .catch(() => setTenantName('Organization'));
  }, []);

  const displayTree = { ...tenantTree, name: tenantName };

  // When searching, show flat filtered results with tenant root
  const activeTree = query.trim()
    ? { ...tenantTree, name: tenantName, children: filteredTree }
    : displayTree;

  const findAgentName = (agentId: string): string => {
    for (const dept of filteredTree) {
      const found = dept.children?.find((c) => c.id === agentId && c.type === 'agent');
      if (found) return found.name;
    }
    return agentId;
  };

  const handleDrop = (agentId: string, toDeptId: string, toDeptName: string) => {
    setConfirmMove({ agentId, agentName: findAgentName(agentId), toDeptId, toDeptName });
    setDragging(null);
  };

  const confirmMoveAction = async () => {
    if (!confirmMove) return;
    await moveAgent(confirmMove.agentId, confirmMove.toDeptId);
    setConfirmMove(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-status-strategy" />
          Organization Chart
        </h2>
        {query && (
          <span className="text-xs text-zinc-500">
            {filteredTree.length} matching {filteredTree.length === 1 ? 'department' : 'departments'}
          </span>
        )}
      </div>

      <div className="card-surface">
        {/* Search bar */}
        <div className="p-4 border-b border-surface-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="search"
              placeholder="Search employees or departments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay py-2 pl-10 pr-8 text-sm text-zinc-200 placeholder-zinc-600 focus:border-accent-500 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tree view */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Loading organization…</p>
            </div>
          ) : (
            <OrgChartView
              tree={activeTree}
              selectedId={selectedId}
              draggingId={draggingId}
              expandedDepts={expandedDepts}
              onSelectAgent={select}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onToggleDept={toggleDept}
              onDrop={handleDrop}
            />
          )}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-surface-border flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Training
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Error
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> Paused
          </div>
          <div className="ml-auto text-xs text-zinc-600">
            Drag employees to reassign
          </div>
        </div>
      </div>

      {/* Confirm move dialog */}
      <AnimatePresence>
        {confirmMove && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmMove(null)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[60] w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[color:var(--accent-500)]/20 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-[color:var(--accent-400)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Confirm Restructure</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Agent reassignment</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-1">
                Move <strong className="text-zinc-200">{confirmMove.agentName}</strong>
              </p>
              <p className="text-sm text-zinc-400 mb-4">
                to department <strong className="text-zinc-200">{confirmMove.toDeptName}</strong>?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmMove(null)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMoveAction}
                  className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 transition-colors"
                >
                  Confirm Move
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
