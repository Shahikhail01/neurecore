"use client";

import { useEffect, useState } from "react";
import { Zap, Plus, Play, Pause, Trash2, Clock } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  stepsCount?: number;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/workflows")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        const payload =
          res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setWorkflows(Array.isArray(payload) ? payload : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    ({
      active: "text-green-400 bg-green-500/10",
      paused: "text-amber-400 bg-amber-500/10",
      idle: "text-zinc-400 bg-zinc-500/10",
      error: "text-red-400 bg-red-500/10",
    })[s] ?? "text-zinc-400 bg-zinc-500/10";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" /> Workflows
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Automated sequences run by your agents
          </p>
        </div>
        <a
          href="/workflows/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </a>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-10 h-10 text-violet-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No workflows yet
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Build your first automated agent workflow
            </p>
            <a
              href="/workflows/new"
              className="mt-4 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
            >
              Create Workflow
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4 hover:border-violet-500/40 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {wf.name}
                  </h3>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      statusColor(wf.status),
                    )}
                  >
                    {wf.status}
                  </span>
                </div>
                {wf.description && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                    {wf.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(wf.createdAt).toLocaleDateString()}
                  </span>
                  {wf.stepsCount && <span>{wf.stepsCount} steps</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
