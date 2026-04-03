"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Approval {
  id: string;
  title: string;
  requestedBy: string;
  type: string;
  status: string;
  createdAt: string;
  details?: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/approvals")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setApprovals(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handle = async (id: string, action: "approve" | "deny") => {
    setProcessing(id);
    try {
      await api.post(`/approvals/${id}/${action}`, {});
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: action === "approve" ? "approved" : "denied" }
            : a,
        ),
      );
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)]">
        <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" /> Approvals
          {pending.length > 0 && (
            <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-bold">
              {pending.length}
            </span>
          )}
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Review and act on agent decisions requiring human approval
        </p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 mx-4 my-2 rounded-lg bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <CheckCircle2 className="w-10 h-10 text-green-500/30 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Nothing to approve
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Your agents are operating autonomously
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {pending.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Pending (
                  {pending.length})
                </p>
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="bg-[var(--surface-raised)] border border-amber-500/20 rounded-xl p-4 mb-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {a.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Requested by{" "}
                          <span className="font-medium text-violet-400">
                            {a.requestedBy}
                          </span>{" "}
                          · {a.type}
                        </p>
                        {a.details && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1.5 bg-[var(--surface-overlay)] rounded-md px-3 py-2">
                            {a.details}
                          </p>
                        )}
                        <p className="text-[10px] text-[var(--text-secondary)] mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handle(a.id, "deny")}
                          disabled={processing === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Deny
                        </button>
                        <button
                          onClick={() => handle(a.id, "approve")}
                          disabled={processing === a.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-xs text-white disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {resolved.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                  Resolved ({resolved.length})
                </p>
                {resolved.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--surface-border)] opacity-60"
                  >
                    {a.status === "approved" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {a.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] capitalize">
                        {a.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
