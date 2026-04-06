"use client";
// ─── KPIMiniTile.tsx ──────────────────────────────────────────────────────────
// Compact KPI tile displayed inside AI response cards.
//
// SRP: renders a single KPI metric only.
// OCP: VALUE_COLOR map — add new color keys without modifying render logic.
// DIP: receives raw value/label/trend — no store access.

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type KPIColor = "profit" | "risk" | "ops" | "strategy" | "neutral";
export type KPITrend = "up" | "down" | "neutral";

export interface KPIMiniTileProps {
  value: string | number;
  label: string;
  trend?: KPITrend;
  color?: KPIColor;
  hint?: string;
  className?: string;
}

// OCP: extend this map to add new semantic colors
const VALUE_COLOR: Record<KPIColor, string> = {
  profit: "text-status-profit",
  risk: "text-status-risk",
  ops: "text-status-ops",
  strategy: "text-status-strategy",
  neutral: "text-text-secondary",
};

const TREND_ICON: Record<KPITrend, React.FC<{ className?: string }>> = {
  up: (p) => <TrendingUp className={p.className} aria-hidden="true" />,
  down: (p) => <TrendingDown className={p.className} aria-hidden="true" />,
  neutral: (p) => <Minus className={p.className} aria-hidden="true" />,
};

const TREND_COLOR: Record<KPITrend, string> = {
  up: "text-status-profit",
  down: "text-status-risk",
  neutral: "text-text-secondary",
};

export function KPIMiniTile({
  value,
  label,
  trend = "neutral",
  color = "neutral",
  hint,
  className,
}: KPIMiniTileProps) {
  const TrendIcon = TREND_ICON[trend];

  return (
    <div
      title={hint}
      className={cn(
        "rounded-input bg-surface-overlay px-3 py-2 flex flex-col gap-0.5 min-w-0",
        className,
      )}
    >
      {/* Value row */}
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-body font-semibold tabular-nums truncate",
            VALUE_COLOR[color],
          )}
        >
          {value}
        </span>
        <TrendIcon
          className={cn("w-3 h-3 flex-shrink-0", TREND_COLOR[trend])}
        />
      </div>

      {/* Label */}
      <span className="text-micro text-text-secondary truncate">{label}</span>
    </div>
  );
}
