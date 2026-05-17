"use client";
"use client";

import { useEffect, useState } from "react";
import { Zap, Plus, Clock } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

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

  const STATUS_STYLE: Record<string, string> = {
    active: "bg-status-profit/15 text-status-profit",
    paused: "bg-status-warn/15 text-status-warn",
    idle: "bg-surface-muted text-text-secondary",
    error: "bg-status-risk/15 text-status-risk",
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Workflows"
        icon={<Zap className="w-4 h-4" />}
        subtitle="Automated sequences run by your agents"
        actions={
          <a
            href="/workflows/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand hover:bg-brand-dim text-brand-foreground text-caption font-medium transition-colors duration-fast"
          >
            <Plus className="w-3.5 h-3.5" /> New Workflow
          </a>
        }
      />
      <PageContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-card bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-10 h-10 text-brand/20 mb-3" />
            <p className="text-body font-medium text-text-secondary">
              No workflows yet
            </p>
            <p className="text-caption text-text-secondary mt-1">
              Build your first automated agent workflow
            </p>
            <a
              href="/workflows/new"
              className="mt-4 px-4 py-2 rounded-input bg-brand hover:bg-brand-dim text-caption text-brand-foreground font-medium transition-colors duration-fast"
            >
              Create Workflow
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-surface-raised border border-surface-border rounded-card p-card hover:border-brand/40 transition-colors duration-fast cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-body font-semibold text-text-primary">
                    {wf.name}
                  </h3>
                  <span
                    className={cn(
                      "text-micro px-2 py-0.5 rounded-pill capitalize",
                      STATUS_STYLE[wf.status] ??
                        "bg-surface-muted text-text-secondary",
                    )}
                  >
                    {wf.status}
                  </span>
                </div>
                {wf.description && (
                  <p className="text-caption text-text-secondary mb-3 line-clamp-2">
                    {wf.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-micro text-text-secondary">
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
      </PageContent>
    </div>
  );
}
