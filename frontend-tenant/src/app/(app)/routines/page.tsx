"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Plus, Clock, Play, Pause } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Routine {
  id: string;
  name: string;
  schedule: string;
  status: string;
  lastRun?: string;
  nextRun?: string;
}

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/routines")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setRoutines(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" /> Routines
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Scheduled recurring agent tasks
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Routine
        </button>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 mx-4 my-2 rounded-md bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <RefreshCw className="w-10 h-10 text-cyan-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No routines scheduled
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Automate recurring agent tasks
            </p>
          </div>
        ) : (
          routines.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--surface-border)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  r.status === "active" ? "bg-cyan-500/10" : "bg-zinc-500/10",
                )}
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4",
                    r.status === "active" ? "text-cyan-400" : "text-zinc-500",
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {r.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {r.schedule}
                </p>
              </div>
              {r.nextRun && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Next: {new Date(r.nextRun).toLocaleString()}
                </p>
              )}
              <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                {r.status === "active" ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
