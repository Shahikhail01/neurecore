"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import TenantShell from "@/components/TenantShell";
import { AgentCard } from "@/components/agent-card/AgentCard";
import { useInspectorStore } from "@/stores/inspectorStore";
import api from "@/services/api";
import { unwrapArrayOrEmpty } from "@/services/unwrap";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentRaw {
  id: string;
  name: string;
  type: string;
  status: string;
  templateId?: string | null;
  tierAgentPoolId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
  departmentId?: string | null;
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
  templateId?: string | null;
  tierDepartmentPoolId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
  headAgent?: { id: string; name: string } | null;
  headCount?: number;
  agents?: AgentRaw[];
  _count?: { agents: number; tasks?: number };
}

interface DepartmentEditFormState {
  id: string;
  name: string;
  description: string;
}

function getResourceBadges(resource: {
  templateId?: string | null;
  deployedFromTierId?: string | null;
  isFixed?: boolean;
  isSelected?: boolean;
}) {
  if (resource.deployedFromTierId) {
    if (resource.isFixed) {
      return [{ label: "Tier Fixed", className: "bg-sky-950/70 text-sky-300" }];
    }

    return [
      {
        label: resource.isSelected ? "Tier Selected" : "Tier Optional",
        className: resource.isSelected
          ? "bg-indigo-950/70 text-indigo-300"
          : "bg-zinc-800 text-zinc-300",
      },
    ];
  }

  if (resource.templateId) {
    return [
      {
        label: "Template Deploy",
        className: "bg-emerald-950/70 text-emerald-300",
      },
    ];
  }

  return [
    { label: "Tenant Custom", className: "bg-amber-950/70 text-amber-300" },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const user = useTenantAuth();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<AgentRaw[]>([]);
  const [editingDepartment, setEditingDepartment] =
    useState<DepartmentEditFormState | null>(null);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, agentRes] = await Promise.all([
        api.get("/departments?limit=100"),
        api.get("/agents?limit=200"),
      ]);
      setDepartments(unwrapArrayOrEmpty(deptRes));
      setAgents(unwrapArrayOrEmpty(agentRes));
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const agentsByDept = (deptId: string) =>
    agents.filter((a) => a.departmentId === deptId);
  const unassigned = agents.filter((a) => !a.departmentId);

  async function handleSaveDepartmentEdit() {
    if (!editingDepartment) return;

    setSavingDepartment(true);
    setEditError(null);

    try {
      await api.patch(`/departments/${editingDepartment.id}`, {
        name: editingDepartment.name.trim(),
        description: editingDepartment.description.trim() || undefined,
      });
      setEditingDepartment(null);
      await fetchAll();
    } catch (error: any) {
      setEditError(
        error?.response?.data?.message ?? "Unable to save department changes.",
      );
    } finally {
      setSavingDepartment(false);
    }
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Departments</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {departments.length} departments · {agents.length} agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/departments/new"
              className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition font-medium"
            >
              + Provision Department
            </Link>
            <button
              onClick={() => void fetchAll()}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl border border-surface-border bg-surface-raised animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Departments */}
            {departments.map((dept) => {
              const deptAgents = agentsByDept(dept.id);
              const isExpanded = expanded.has(dept.id);
              const runningCount = deptAgents.filter(
                (a) => a.status === "RUNNING" || a.status === "ACTIVE",
              ).length;

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
                    <span
                      className={`text-xs transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">
                        {dept.name}
                      </p>
                      {dept.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                          {dept.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {getResourceBadges(dept).map((badge) => (
                          <span
                            key={badge.label}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* KPI chips */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditError(null);
                          setEditingDepartment({
                            id: dept.id,
                            name: dept.name,
                            description: dept.description ?? "",
                          });
                        }}
                        className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-zinc-300 hover:bg-surface-overlay transition"
                      >
                        Edit
                      </button>
                      <span className="text-xs text-zinc-500">
                        <span className="text-zinc-300 font-medium">
                          {deptAgents.length}
                        </span>{" "}
                        agents
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
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-surface-border"
                      >
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {deptAgents.length === 0 ? (
                            <p className="text-xs text-zinc-600 py-3 col-span-2 text-center">
                              No agents in this department
                            </p>
                          ) : (
                            deptAgents.map((agent) => (
                              <AgentCard
                                key={agent.id}
                                agent={{
                                  id: agent.id,
                                  name: agent.name,
                                  type: agent.type as any,
                                  status: agent.status as any,
                                  badges: getResourceBadges(agent).map(
                                    (badge) => ({
                                      label: badge.label,
                                    }),
                                  ),
                                  department: dept.name,
                                  model: agent.model?.name ?? "GPT-4o",
                                  workload: Math.min(
                                    100,
                                    (agent._count?.tasks ?? 0) * 10,
                                  ),
                                  taskCount: agent._count?.tasks ?? 0,
                                  successRate: 0,
                                  budgetUsed: agent.budgetUsed ?? 0,
                                  budgetTotal: agent.monthlyBudget ?? 100,
                                  lastActiveAt: agent.updatedAt,
                                }}
                                variant="compact"
                                onAction={(action, id) => {
                                  if (action === "inspect")
                                    openInspector("agent", id);
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
              <motion.div
                layout
                className="rounded-xl border border-zinc-700 border-dashed bg-surface-raised overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand("__unassigned__")}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-surface-overlay transition text-left"
                >
                  <span
                    className={`text-xs transition-transform duration-200 ${expanded.has("__unassigned__") ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-400">
                      Unassigned Agents
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {unassigned.length} agents
                  </span>
                </button>
                <AnimatePresence>
                  {expanded.has("__unassigned__") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
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
                              badges: getResourceBadges(agent).map((badge) => ({
                                label: badge.label,
                              })),
                              model: agent.model?.name ?? "GPT-4o",
                              workload: 0,
                              taskCount: agent._count?.tasks ?? 0,
                              successRate: 0,
                              budgetUsed: agent.budgetUsed ?? 0,
                              budgetTotal: agent.monthlyBudget ?? 100,
                              lastActiveAt: agent.updatedAt,
                            }}
                            variant="compact"
                            onAction={(action, id) => {
                              if (action === "inspect")
                                openInspector("agent", id);
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

        {editingDepartment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4">
            <div className="w-full max-w-xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Edit Department
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Update tenant-owned operational fields without changing tier
                    lineage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (savingDepartment) return;
                    setEditingDepartment(null);
                    setEditError(null);
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-200 transition"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block space-y-2 text-sm text-zinc-300">
                  <span>Name</span>
                  <input
                    value={editingDepartment.name}
                    onChange={(e) =>
                      setEditingDepartment((current) =>
                        current
                          ? { ...current, name: e.target.value }
                          : current,
                      )
                    }
                    className="w-full rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                  />
                </label>

                <label className="block space-y-2 text-sm text-zinc-300">
                  <span>Description</span>
                  <textarea
                    value={editingDepartment.description}
                    onChange={(e) =>
                      setEditingDepartment((current) =>
                        current
                          ? { ...current, description: e.target.value }
                          : current,
                      )
                    }
                    rows={4}
                    className="w-full rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                  />
                </label>

                {editError && (
                  <p className="rounded-xl border border-status-risk/30 bg-status-risk/10 px-3 py-2 text-sm text-status-risk">
                    {editError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (savingDepartment) return;
                      setEditingDepartment(null);
                      setEditError(null);
                    }}
                    className="rounded-xl border border-surface-border px-4 py-2 text-sm text-zinc-300 hover:bg-surface-overlay transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      savingDepartment || !editingDepartment.name.trim()
                    }
                    onClick={() => void handleSaveDepartmentEdit()}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
                  >
                    {savingDepartment ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TenantShell>
  );
}
