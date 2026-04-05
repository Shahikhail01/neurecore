"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  History,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Tag,
  User,
  FileText,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface AgentVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  changedBy: string;
  changeNote: string | null;
  isActive: boolean;
  createdAt: string;
  configSnapshot: Record<string, unknown>;
}

interface RollbackModal {
  open: boolean;
  version: AgentVersion | null;
}

export default function AgentVersionsPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;

  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackModal, setRollbackModal] = useState<RollbackModal>({
    open: false,
    version: null,
  });
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/agents/${agentId}/versions`)
      .then((res) => {
        const data: unknown =
          res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setVersions(Array.isArray(data) ? (data as AgentVersion[]) : []);
      })
      .catch(() => setError("Failed to load version history."))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRollback = async () => {
    if (!rollbackModal.version) return;
    setRolling(true);
    setError(null);
    try {
      await api.post(`/agents/${agentId}/rollback`, {
        versionNumber: rollbackModal.version.versionNumber,
        changeNote: `Manual rollback to v${rollbackModal.version.versionNumber}`,
      });
      setRollbackModal({ open: false, version: null });
      loadVersions();
    } catch {
      setError("Rollback failed. Please try again.");
    } finally {
      setRolling(false);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href={`/agents`}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <History className="w-4 h-4 text-violet-400" />
              Version History
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {versions.length} snapshot{versions.length !== 1 ? "s" : ""} ·
              Agent {agentId.slice(0, 8)}
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-red-950/40 border border-red-800/50 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <History className="w-8 h-8 text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              No versions yet
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Versions are created automatically when you update the agent.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {versions.map((v) => (
              <div
                key={v.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  v.isActive
                    ? "border-violet-500/40 bg-violet-950/20"
                    : "border-[var(--surface-border)] bg-[var(--surface-overlay)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left column */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Version badge */}
                    <div
                      className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold",
                        v.isActive
                          ? "bg-violet-600 text-white"
                          : "bg-[var(--surface-border)] text-[var(--text-secondary)]",
                      )}
                    >
                      v{v.versionNumber}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {v.isActive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-900/60 text-green-300 border border-green-700/40">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {v.label && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-border)] text-[var(--text-secondary)]">
                            <Tag className="w-3 h-3" />
                            {v.label}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-secondary)] flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {v.changedBy === "system" ? "Auto-save" : v.changedBy}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(v.createdAt)}
                        </span>
                      </div>

                      {v.changeNote && (
                        <p className="mt-1.5 text-xs text-[var(--text-secondary)] flex items-start gap-1">
                          <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {v.changeNote}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rollback button */}
                  {!v.isActive && (
                    <button
                      onClick={() =>
                        setRollbackModal({ open: true, version: v })
                      }
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:border-violet-500/60 hover:text-violet-300 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rollback confirmation modal */}
      {rollbackModal.open && rollbackModal.version && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Restore to version {rollbackModal.version.versionNumber}?
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              The agent&apos;s current configuration will be replaced with the
              snapshot from{" "}
              <strong className="text-[var(--text-primary)]">
                v{rollbackModal.version.versionNumber}
              </strong>
              {rollbackModal.version.label
                ? ` (${rollbackModal.version.label})`
                : ""}
              . This action creates a new automatic snapshot first so you can
              roll back again if needed.
            </p>

            {error && (
              <p className="mb-3 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded px-2 py-1">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRollbackModal({ open: false, version: null })}
                disabled={rolling}
                className="px-3 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rolling}
                className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs text-white font-medium transition-colors flex items-center gap-1.5"
              >
                {rolling ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Restoring…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
