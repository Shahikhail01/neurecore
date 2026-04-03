"use client";

import { useEffect, useState } from "react";
import { Activity, Filter } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  agentName?: string;
  action: string;
  detail?: string;
  createdAt: string;
  type?: string;
}
const FILTERS = ["all", "agent", "system", "user"] as const;
type FilterType = (typeof FILTERS)[number];

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    api
      .get("/activity")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setLogs(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible =
    filter === "all" ? logs : logs.filter((l) => l.type === filter);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Activity Log
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            All agent and system events in reverse-chronological order
          </p>
        </div>
        <div className="flex gap-1 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all capitalize",
                filter === f
                  ? "bg-violet-600 text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar relative">
        {/* vertical timeline line */}
        <div className="absolute left-[2.125rem] top-0 bottom-0 w-px bg-[var(--surface-border)]" />

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 mx-4 my-2 rounded-md bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Activity className="w-10 h-10 text-blue-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No activity recorded
            </p>
          </div>
        ) : (
          visible.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-4 px-5 py-3 hover:bg-[var(--surface-raised)] transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-[var(--surface-overlay)] border border-[var(--surface-border)] flex-shrink-0 mt-0.5 z-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 justify-between">
                  <p className="text-sm text-[var(--text-primary)]">
                    {log.agentName && (
                      <span className="font-medium text-violet-400">
                        {log.agentName}
                      </span>
                    )}
                    {log.agentName && " — "}
                    {log.action}
                  </p>
                  <span className="text-[10px] text-[var(--text-secondary)] flex-shrink-0">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                {log.detail && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {log.detail}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
