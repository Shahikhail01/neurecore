"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Calendar, Users } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  teamSize?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/projects")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setProjects(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    ({
      active: "text-green-400 bg-green-500/10 border-green-500/20",
      planning: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      paused: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      completed: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    })[s] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-400" /> Projects
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {projects.length} projects total
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderOpen className="w-10 h-10 text-amber-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No projects yet
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Start tracking your projects here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4 hover:border-amber-500/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {p.name}
                  </h3>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border",
                      statusColor(p.status),
                    )}
                  >
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
                  {p.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.startDate).toLocaleDateString()}
                    </span>
                  )}
                  {p.teamSize !== undefined && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {p.teamSize} members
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
