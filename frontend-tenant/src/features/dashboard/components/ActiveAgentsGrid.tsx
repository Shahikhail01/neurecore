"use client";
// ─── ActiveAgentsGrid.tsx ─────────────────────────────────────────────────────
// SRP: Renders a compact list of the top active agents.
// OCP: Agent item sub-component is closed — add data fields without modifying
//      the outer grid.
// DIP: Data injected via props; no fetching inside this component.

import Link from "next/link";
import { getAvatarColors, getInitials } from "@/lib/agent-colors";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/shared/types/domain.types";

interface ActiveAgentsGridProps {
  agents: Agent[];
  loading: boolean;
}

// Status dot colors — aligned with design token status colors
const STATUS_DOT: Record<string, string> = {
  RUNNING: "bg-status-profit",
  IDLE: "bg-emerald-500/60",
  PAUSED: "bg-status-warn",
  ERROR: "bg-status-risk",
  TERMINATED: "bg-surface-muted",
};

function AgentRow({ agent }: { agent: Agent }) {
  const { bg, text } = getAvatarColors(agent.departmentName ?? "", 0);
  const initials = getInitials(agent.name);
  const dotClass =
    STATUS_DOT[agent.status?.toUpperCase()] ?? "bg-surface-muted";

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-input hover:bg-surface-overlay transition-colors duration-fast group"
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold flex-shrink-0",
          bg,
          text,
        )}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-caption font-medium text-text-primary truncate">
          {agent.name}
        </p>
        <p className="text-micro text-text-secondary truncate">
          {agent.departmentName ?? agent.type}
        </p>
      </div>

      {/* Status dot */}
      <span
        className={cn("w-2 h-2 rounded-full flex-shrink-0", dotClass)}
        title={agent.status}
        aria-label={`Status: ${agent.status}`}
      />

      <ChevronRight
        className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
        aria-hidden="true"
      />
    </Link>
  );
}

export function ActiveAgentsGrid({ agents, loading }: ActiveAgentsGridProps) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading agents">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-input bg-surface-overlay animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="py-4 text-center text-caption text-text-secondary">
        No agents deployed yet.{" "}
        <Link href="/agents/new" className="text-brand hover:underline">
          Hire your first agent →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {agents.slice(0, 6).map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
      <div className="pt-2 border-t border-surface-border mt-2">
        <Link
          href="/agents"
          className="flex items-center gap-1 text-micro text-brand hover:underline"
        >
          View all agents{" "}
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
