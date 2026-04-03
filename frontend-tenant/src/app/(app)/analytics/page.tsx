"use client";

import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import api from "@/services/api";

interface KpiStat {
  label: string;
  value: string | number;
  change?: number;
  color: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<KpiStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/summary").catch(() => ({ data: null })),
      api.get("/tasks").catch(() => ({ data: { data: [] } })),
      api.get("/agents").catch(() => ({ data: { data: [] } })),
    ])
      .then(([summary, tasks, agents]) => {
        const taskList = tasks.data?.data ?? tasks.data ?? [];
        const agentList = agents.data?.data ?? agents.data ?? [];
        const s = summary.data;
        setStats([
          {
            label: "Total Tasks",
            value: s?.totalTasks ?? taskList.length,
            color: "text-blue-400",
          },
          {
            label: "Completed",
            value:
              s?.completed ??
              taskList.filter(
                (t: { status: string }) => t.status === "completed",
              ).length,
            change: s?.completedChange,
            color: "text-green-400",
          },
          {
            label: "Active Agents",
            value:
              s?.activeAgents ??
              agentList.filter((a: { status: string }) => a.status === "active")
                .length,
            color: "text-violet-400",
          },
          {
            label: "Avg Response Time",
            value: s?.avgResponseTime ?? "—",
            color: "text-amber-400",
          },
          {
            label: "Pending Approvals",
            value: s?.pendingApprovals ?? "—",
            color: "text-yellow-400",
          },
          {
            label: "Success Rate",
            value:
              s?.successRate ??
              (taskList.length > 0
                ? `${Math.round((taskList.filter((t: { status: string }) => t.status === "completed").length / taskList.length) * 100)}%`
                : "—"),
            color: "text-emerald-400",
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const TrendIcon = ({ change }: { change?: number }) => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-zinc-400" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-400" /> Analytics
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Performance overview of your AI workforce
        </p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(loading ? Array.from({ length: 6 }) : stats).map((stat, i) => (
            <div
              key={i}
              className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4"
            >
              {loading ? (
                <div className="space-y-2">
                  <div className="h-7 rounded bg-[var(--surface-overlay)] animate-pulse w-1/2" />
                  <div className="h-3 rounded bg-[var(--surface-overlay)] animate-pulse w-3/4" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-2xl font-bold ${(stat as KpiStat).color}`}
                    >
                      {(stat as KpiStat).value}
                    </p>
                    <TrendIcon change={(stat as KpiStat).change} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {(stat as KpiStat).label}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Placeholder charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["Task Completion Over Time", "Agent Activity Distribution"].map(
            (title) => (
              <div
                key={title}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                  {title}
                </p>
                <div className="h-32 rounded-lg bg-[var(--surface-overlay)] flex items-center justify-center">
                  <BarChart2 className="w-8 h-8 text-zinc-600" />
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
