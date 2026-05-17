"use client";

import type { AgentCardProps } from "@/types/ui.types";
import { Bot } from "lucide-react";

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE: "text-emerald-400",
  IDLE: "text-zinc-400",
  PAUSED: "text-amber-400",
  ERROR: "text-red-400",
};

export function AgentCard({
  agent,
  variant = "full",
  selected,
  onAction,
}: AgentCardProps) {
  const statusClass =
    STATUS_COLOUR[agent.status?.toUpperCase()] ?? "text-zinc-400";

  return (
    <div
      className={`rounded-xl border p-4 bg-[var(--surface-overlay)] flex flex-col gap-2 transition-colors ${
        selected ? "border-violet-500/50" : "border-[var(--surface-border)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {agent.name}
          </span>
        </div>
        <span
          className={`text-[10px] uppercase font-semibold flex-shrink-0 ${statusClass}`}
        >
          {agent.status}
        </span>
      </div>

      {/* Meta */}
      {variant !== "compact" && (
        <>
          <div className="flex gap-3 text-xs text-[var(--text-secondary)]">
            {agent.department && <span>{agent.department}</span>}
            {agent.type && (
              <span className="capitalize">{agent.type.toLowerCase()}</span>
            )}
          </div>

          {agent.workloadPct !== undefined && (
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div
                className="bg-violet-500 h-1 rounded-full"
                style={{ width: `${Math.min(agent.workloadPct, 100)}%` }}
              />
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {onAction && variant === "full" && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {agent.status === "PAUSED" ? (
            <button
              onClick={() => onAction("resume", agent.id)}
              className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={() => onAction("pause", agent.id)}
              className="text-[10px] px-2 py-0.5 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => onAction("inspect", agent.id)}
            className="text-[10px] px-2 py-0.5 rounded bg-zinc-600/20 text-zinc-400 hover:bg-zinc-600/30"
          >
            Inspect
          </button>
        </div>
      )}
    </div>
  );
}
