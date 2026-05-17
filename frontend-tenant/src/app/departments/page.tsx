'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { useInspectorStore } from '@/stores/inspectorStore';
import api from '@/services/api';
import { unwrapArrayOrEmpty } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentRaw {
  id: string;
  name: string;
  type: string;
  status: string;
  monthlyBudget?: number;
  budgetUsed?: number;
  updatedAt: string;
  model?: { name: string };
  _count?: { tasks: number };
}

interface Department {
  id: string;
  name: string;
  description?: string;
  headCount?: number;
  agents?: AgentRaw[];
  _count?: { agents: number; tasks?: number };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<AgentRaw[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, agentRes] = await Promise.all([
        api.get('/departments?limit=100'),
        api.get('/agents?limit=200'),
      ]);
      setDepartments(unwrapArrayOrEmpty(deptRes));
      setAgents(unwrapArrayOrEmpty(agentRes));
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const agentsByDept = (deptId: string) => agents.filter((a) => (a as any).departmentId === deptId);
  const unassigned = agents.filter((a) => !(a as any).departmentId);

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Departments</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{departments.length} departments · {agents.length} agents</p>
          </div>
          <button
            onClick={() => void fetchAll()}
            className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl border border-surface-border bg-surface-raised animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Departments */}
            {departments.map((dept) => {
              const deptAgents = agentsByDept(dept.id);
              const isExpanded = expanded.has(dept.id);
              const runningCount = deptAgents.filter((a) => a.status === 'RUNNING' || a.status === 'ACTIVE').length;

              return (
                <motion.div
                  key={dept.id}
                  layout
                  className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden"
                >
                  {/* Dept header — clickable */}
                  <button
                    onClick={() => toggleExpand(dept.id)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-surface-overlay transition text-left"
                  >
                    <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{dept.description}</p>
                      )}
                    </div>
                    {/* KPI chips */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-zinc-500">
                        <span className="text-zinc-300 font-medium">{deptAgents.length}</span> agents
                      </span>
                      {runningCount > 0 && (
                        <span className="text-xs text-status-profit">
                          {runningCount} active
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Agent cards — expandable */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-surface-border"
                      >
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {deptAgents.length === 0 ? (
                            <p className="text-xs text-zinc-600 py-3 col-span-2 text-center">No agents in this department</p>
                          ) : (
                            deptAgents.map((agent) => (
                              <AgentCard
                                key={agent.id}
                                agent={{
                                  id: agent.id,
                                  name: agent.name,
                                  type: agent.type as any,
                                  status: agent.status as any,
                                  department: dept.name,
                                  model: agent.model?.name ?? 'GPT-4o',
                                  workload: Math.min(100, (agent._count?.tasks ?? 0) * 10),
                                  taskCount: agent._count?.tasks ?? 0,
                                  successRate: 0,
                                  budgetUsed: agent.budgetUsed ?? 0,
                                  budgetTotal: agent.monthlyBudget ?? 100,
                                  lastActiveAt: agent.updatedAt,
                                }}
                                variant="compact"
                                onAction={(action, id) => {
                                  if (action === 'inspect') openInspector('agent', id);
                                }}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Unassigned bucket */}
            {unassigned.length > 0 && (
              <motion.div layout className="rounded-xl border border-zinc-700 border-dashed bg-surface-raised overflow-hidden">
                <button
                  onClick={() => toggleExpand('__unassigned__')}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-surface-overlay transition text-left"
                >
                  <span className={`text-xs transition-transform duration-200 ${expanded.has('__unassigned__') ? 'rotate-90' : ''}`}>▶</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-400">Unassigned Agents</p>
                  </div>
                  <span className="text-xs text-zinc-500">{unassigned.length} agents</span>
                </button>
                <AnimatePresence>
                  {expanded.has('__unassigned__') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-surface-border"
                    >
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {unassigned.map((agent) => (
                          <AgentCard
                            key={agent.id}
                            agent={{
                              id: agent.id,
                              name: agent.name,
                              type: agent.type as any,
                              status: agent.status as any,
                              model: agent.model?.name ?? 'GPT-4o',
                              workload: 0,
                              taskCount: agent._count?.tasks ?? 0,
                              successRate: 0,
                              budgetUsed: agent.budgetUsed ?? 0,
                              budgetTotal: agent.monthlyBudget ?? 100,
                              lastActiveAt: agent.updatedAt,
                            }}
                            variant="compact"
                            onAction={(action, id) => {
                              if (action === 'inspect') openInspector('agent', id);
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </TenantShell>
  );
}
