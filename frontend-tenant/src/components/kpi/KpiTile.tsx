"use client";

import type { KpiTileProps } from "@/types/ui.types";
import { TrendingUp, TrendingDown } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  profit: "text-emerald-400",
  risk: "text-red-400",
  neutral: "text-zinc-400",
  warn: "text-amber-400",
  ops: "text-blue-400",
  strategy: "text-violet-400",
};

export function KpiTile({
  label,
  value,
  delta,
  deltaLabel,
  color,
  icon,
  loading,
  className = "",
}: KpiTileProps) {
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-4 ${className}`}
      >
        <div className="h-3 w-20 rounded bg-zinc-700 animate-pulse mb-2" />
        <div className="h-6 w-14 rounded bg-zinc-700 animate-pulse" />
      </div>
    );
  }

  const colorClass = COLOR_MAP[color] ?? "text-zinc-400";

  return (
    <div
      className={`rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-4 flex flex-col gap-1 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        {icon && <span className={colorClass}>{icon}</span>}
      </div>
      <span className={`text-2xl font-semibold ${colorClass}`}>{value}</span>
      {delta !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {delta >= 0 ? (
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
          {deltaLabel && (
            <span className="text-[var(--text-secondary)]">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
