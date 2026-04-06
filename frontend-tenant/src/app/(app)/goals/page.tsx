"use client";

import { useEffect, useState } from "react";
import { Target, Plus, CheckCircle2, Circle } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  status: string;
  dueDate?: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/goals")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setGoals(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Goals & OKRs"
        icon={<Target className="w-4 h-4" />}
        subtitle="Track what your business is working toward"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand hover:bg-brand-dim text-brand-foreground text-caption font-medium transition-colors duration-fast">
            <Plus className="w-3.5 h-3.5" /> New Goal
          </button>
        }
      />
      <PageContent className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-card bg-surface-overlay animate-pulse"
            />
          ))
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Target className="w-10 h-10 text-status-profit/20 mb-3" />
            <p className="text-body font-medium text-text-secondary">
              No goals set
            </p>
            <p className="text-caption text-text-secondary mt-1">
              Define your objectives and let agents help achieve them
            </p>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-surface-raised border border-surface-border rounded-card p-card hover:border-status-profit/20 transition-colors duration-fast cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2">
                  {goal.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-status-profit mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-text-secondary mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-body font-semibold text-text-primary">
                      {goal.title}
                    </p>
                    {goal.description && (
                      <p className="text-caption text-text-secondary mt-0.5">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-caption font-bold text-status-profit">
                  {goal.progress}%
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-pill bg-surface-overlay overflow-hidden">
                <div
                  className="h-full rounded-pill bg-status-profit transition-all duration-normal"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              {goal.dueDate && (
                <p className="text-micro text-text-secondary mt-2">
                  Due: {new Date(goal.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ))
        )}
      </PageContent>
    </div>
  );
}
