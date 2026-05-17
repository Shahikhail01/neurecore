"use client";

/**
 * Routines Page — Phase 3.3 enhanced frontend
 * - List routines from GET /v1/routines
 * - Create routine via POST /v1/routines
 * - Toggle pause/resume via POST /v1/routines/:id/pause | /resume
 * - Trigger immediate run via POST /v1/routines/:id/run
 * - Show last run status badge
 */

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Plus,
  Clock,
  Play,
  Pause,
  Loader2,
  Zap,
  X,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Routine {
  id: string;
  name: string;
  description?: string;
  schedule?: string; // cron string
  status: string; // DRAFT | ACTIVE | PAUSED | DISABLED
  lastRunStatus?: string; // COMPLETED | FAILED | RUNNING | null
  lastRunAt?: string;
  nextRunAt?: string;
  isActive?: boolean;
}

interface CreateRoutineForm {
  name: string;
  description: string;
  schedule: string;
}

const CRON_PRESETS = [
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9 AM", value: "0 9 * * *" },
  { label: "Every Monday 8 AM", value: "0 8 * * 1" },
  { label: "Every month 1st", value: "0 0 1 * *" },
];

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRoutineForm>({
    name: "",
    description: "",
    schedule: "0 9 * * *",
  });

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/routines")
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setRoutines(Array.isArray(data) ? data : []);
      })
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.post("/routines", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        schedule: form.schedule,
      });
      setShowCreate(false);
      setForm({ name: "", description: "", schedule: "0 9 * * *" });
      load();
    } catch {
      // keep modal open on error
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (r: Routine) => {
    const endpoint =
      r.status === "ACTIVE"
        ? `/routines/${r.id}/pause`
        : `/routines/${r.id}/resume`;
    try {
      await api.post(endpoint);
      load();
    } catch {}
  };

  const handleRun = async (id: string) => {
    if (runningId) return;
    setRunningId(id);
    try {
      await api.post(`/routines/${id}/run`);
      setTimeout(load, 1500);
    } catch {
    } finally {
      setRunningId(null);
    }
  };

  const statusBadge = (r: Routine) => {
    const map: Record<string, string> = {
      ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      PAUSED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      DRAFT: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
      DISABLED: "text-red-400 bg-red-500/10 border-red-500/20",
    };
    return map[r.status] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" /> Routines
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Scheduled recurring agent tasks
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Routine
        </button>
      </div>

      {/* List */}
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
                  r.status === "ACTIVE" ? "bg-cyan-500/10" : "bg-zinc-500/10",
                )}
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4",
                    r.status === "ACTIVE" ? "text-cyan-400" : "text-zinc-500",
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {r.name}
                  </p>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border",
                      statusBadge(r),
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                {r.schedule && (
                  <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {r.schedule}
                  </p>
                )}
              </div>
              {r.lastRunAt && (
                <p className="text-xs text-[var(--text-secondary)] hidden sm:block">
                  Last: {new Date(r.lastRunAt).toLocaleString()}
                </p>
              )}
              {r.nextRunAt && (
                <p className="text-xs text-[var(--text-secondary)] hidden lg:block">
                  Next: {new Date(r.nextRunAt).toLocaleString()}
                </p>
              )}
              {/* Trigger now */}
              <button
                onClick={() => handleRun(r.id)}
                disabled={!!runningId}
                title="Run now"
                className="text-[var(--text-secondary)] hover:text-cyan-400 transition-colors disabled:opacity-40"
              >
                {runningId === r.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
              </button>
              {/* Pause / resume */}
              <button
                onClick={() => handleToggle(r)}
                title={r.status === "ACTIVE" ? "Pause" : "Resume"}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {r.status === "ACTIVE" ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                New Routine
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Daily Report Generation"
                  className="w-full px-3 py-2 rounded-md bg-[#0d0d14] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  placeholder="What does this routine do?"
                  className="w-full px-3 py-2 rounded-md bg-[#0d0d14] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Schedule (cron)
                </label>
                <select
                  value={form.schedule}
                  onChange={(e) =>
                    setForm({ ...form, schedule: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md bg-[#0d0d14] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.value})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
                className="flex-1 py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs text-white font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                {creating ? "Creating…" : "Create Routine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
