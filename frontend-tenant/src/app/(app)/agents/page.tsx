"use client";

import { useEffect, useState } from "react";
import { Bot, Plus, Power, Settings, MessageSquare } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  department?: string;
  tasksCompleted?: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/agents")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        // Unwrap envelope: { status, data: { data: [], total, ... }, meta }
        const payload =
          res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setAgents(Array.isArray(payload) ? payload : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    ({
      active: "bg-green-500",
      idle: "bg-zinc-500",
      waiting: "bg-yellow-500",
      error: "bg-red-500",
    })[s] ?? "bg-zinc-500";

  const COLORS = [
    "bg-violet-600",
    "bg-blue-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-pink-600",
    "bg-cyan-600",
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" /> Agent Team
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {agents.length} deployed ·{" "}
            {agents.filter((a) => a.status === "active").length} active
          </p>
        </div>
        <a
          href="/agents/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Hire Agent
        </a>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-violet-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No agents deployed
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Hire your first AI employees from the marketplace
            </p>
            <a
              href="/agents/new"
              className="mt-4 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
            >
              Hire Agent
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <div
                key={agent.id}
                className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-xl p-4 hover:border-violet-500/30 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-full ${COLORS[i % COLORS.length]} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
                  >
                    {agent.name
                      .split(" ")
                      .map((w: string) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {agent.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {agent.role}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0 mt-1",
                      statusColor(agent.status),
                    )}
                  />
                </div>
                {agent.department && (
                  <p className="text-[11px] text-[var(--text-secondary)] mb-3 bg-[var(--surface-overlay)] rounded px-2 py-1 truncate">
                    {agent.department}
                  </p>
                )}
                {agent.tasksCompleted !== undefined && (
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    {agent.tasksCompleted} tasks completed
                  </p>
                )}
                <div className="flex gap-2 mt-auto">
                  <a
                    href={`/tasks/new?agentId=${agent.id}`}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" /> Task
                  </a>
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <Settings className="w-3 h-3" /> Config
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
