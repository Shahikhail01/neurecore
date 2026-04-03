"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import api from "@/services/api";

interface Agent {
  id: string;
  name: string;
  role: string;
}

export default function DelegateTaskPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/agents")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => setAgents(res.data?.data ?? res.data ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !instruction.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/tasks", {
        title: instruction.trim(),
        assigneeId: agentId,
        priority: "medium",
      });
      router.push("/tasks");
    } catch {
      setError("Failed to delegate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-xl mx-auto px-5 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-emerald-400" /> Delegate to Agent
        </h1>
        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Select Agent *
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
            >
              <option value="">Choose an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>
            {agents.length === 0 && (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                No agents yet.{" "}
                <a href="/agents" className="text-violet-400 hover:underline">
                  Hire your team first.
                </a>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Instruction *
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={5}
              placeholder="Tell the agent what to do in plain language…"
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 rounded-md border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !agentId || !instruction.trim()}
              className="flex-1 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              {loading ? "Delegating…" : "Delegate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
