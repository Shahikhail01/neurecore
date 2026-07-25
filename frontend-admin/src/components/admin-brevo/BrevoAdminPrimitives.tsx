"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  icon?: string;
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "border-zinc-700/50 text-zinc-100",
  good: "border-[color:var(--state-success)]/30 text-emerald-300",
  warn: "border-[color:var(--state-warning)]/30 text-amber-300",
  bad: "border-rose-500/30 text-rose-300",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg border bg-zinc-900/40 p-4 ${TONE_CLASSES[tone]}`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        {icon && <span aria-hidden>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </motion.div>
  );
}

interface StatusBadgeProps {
  status: "CONNECTED" | "MASTER" | "NOT_CONNECTED";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<StatusBadgeProps["status"], { cls: string; label: string }> =
    {
      CONNECTED: {
        cls: "bg-[color:var(--state-success)]/10 text-emerald-300 border-[color:var(--state-success)]/20",
        label: "Connected",
      },
      MASTER: {
        cls: "bg-[color:var(--accent-500)]/10 text-indigo-300 border-[color:var(--accent-500)]/20",
        label: "Master key",
      },
      NOT_CONNECTED: {
        cls: "bg-zinc-700/50 text-zinc-400 border-zinc-700/50",
        label: "Not connected",
      },
    };
  const v = map[status];
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border ${v.cls}`}
      title={v.label}
    >
      {v.label}
    </span>
  );
}

interface EventTypeBadgeProps {
  type: string;
}

export function EventTypeBadge({ type }: EventTypeBadgeProps) {
  const colors: Record<string, string> = {
    DELIVERED: "bg-[color:var(--state-success)]/10 text-emerald-300",
    OPEN: "bg-[color:var(--visual-accent-cyan-500)]/10 text-cyan-300",
    CLICK: "bg-[color:var(--accent-500)]/10 text-violet-300",
    BOUNCE_HARD: "bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300",
    BOUNCE_SOFT: "bg-[color:var(--state-warning)]/10 text-amber-300",
    SPAM: "bg-rose-700/10 text-rose-200",
    UNSUBSCRIBE: "bg-zinc-700/50 text-zinc-300",
    BLOCKED: "bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300",
    ERROR: "bg-[color:var(--visual-accent-rose-500)]/10 text-rose-300",
    REQUEST: "bg-[color:var(--accent-500)]/10 text-indigo-300",
  };
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
        colors[type] ?? "bg-zinc-700/40 text-zinc-300"
      }`}
    >
      {type}
    </span>
  );
}

interface QuotaBarProps {
  used: number;
  limit: number;
  warningAt?: number;
}

export function QuotaBar({ used, limit, warningAt = 240 }: QuotaBarProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone =
    used >= limit
      ? "bg-[color:var(--visual-accent-rose-500)]"
      : used >= warningAt
        ? "bg-[color:var(--state-warning)]"
        : "bg-[color:var(--state-success)]";
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
          className={`h-full ${tone}`}
        />
      </div>
      <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
        <span>{used}</span>
        <span>{Math.round(pct)}%</span>
        <span>{limit}</span>
      </div>
    </div>
  );
}
