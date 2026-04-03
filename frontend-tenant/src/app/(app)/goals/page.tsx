"use client";

import { useEffect, useState } from "react";
import { Target, Plus, TrendingUp, CheckCircle2, Circle } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

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
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" /> Goals & OKRs
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Track what your business is working toward
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Goal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Target className="w-10 h-10 text-emerald-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No goals set
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Define your objectives and let agents help achieve them
            </p>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4 hover:border-emerald-500/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2">
                  {goal.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {goal.title}
                    </p>
                    {goal.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {goal.progress}%
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-overlay)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              {goal.dueDate && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                  Due: {new Date(goal.dueDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
