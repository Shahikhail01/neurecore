"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Users, Bot } from "lucide-react";
import api from "@/services/api";

interface Department {
  id: string;
  name: string;
  description?: string;
  agentCount?: number;
  headCount?: number;
}

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/departments")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setDepts(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" /> Departments
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Organize your AI team by function
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Department
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : depts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Building2 className="w-10 h-10 text-emerald-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No departments yet
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Group agents by function (Sales, Finance, Marketing…)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {depts.map((d) => (
              <div
                key={d.id}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4 hover:border-emerald-500/30 transition-colors cursor-pointer"
              >
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                    {d.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                  {d.agentCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Bot className="w-3 h-3 text-violet-400" />
                      {d.agentCount} agents
                    </span>
                  )}
                  {d.headCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" />
                      {d.headCount} members
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
