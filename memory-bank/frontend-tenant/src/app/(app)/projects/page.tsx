"use client";
"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Calendar, Users } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

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

  const STATUS_STYLE: Record<string, string> = {
    active: "bg-status-profit/15 text-status-profit border-status-profit/20",
    planning: "bg-status-ops/15 text-status-ops border-status-ops/20",
    paused: "bg-status-warn/15 text-status-warn border-status-warn/20",
    completed: "bg-surface-muted text-text-secondary border-surface-border",
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Projects"
        icon={<FolderOpen className="w-4 h-4" />}
        subtitle={`${projects.length} projects total`}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand hover:bg-brand-dim text-brand-foreground text-caption font-medium transition-colors duration-fast">
            <Plus className="w-3.5 h-3.5" /> New Project
          </button>
        }
      />
      <PageContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-card bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderOpen className="w-10 h-10 text-status-warn/20 mb-3" />
            <p className="text-body font-medium text-text-secondary">
              No projects yet
            </p>
            <p className="text-caption text-text-secondary mt-1">
              Start tracking your projects here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-surface-raised border border-surface-border rounded-card p-card hover:border-status-warn/30 transition-colors duration-fast cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-body font-semibold text-text-primary">
                    {p.name}
                  </h3>
                  <span
                    className={cn(
                      "text-micro px-2 py-0.5 rounded-pill border capitalize",
                      STATUS_STYLE[p.status] ??
                        "bg-surface-muted text-text-secondary border-surface-border",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-caption text-text-secondary mb-3 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-micro text-text-secondary">
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
      </PageContent>
    </div>
  );
}
