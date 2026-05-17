"use client";
// ─── AIResponseCard.tsx ───────────────────────────────────────────────────────
// Flagship AI message card with agent attribution, safe markdown content,
// optional KPI grid, and action buttons.
//
// SRP: renders a single AI response — no chat state, no sending.
// OCP: action variants delegated to Button; KPI colors delegated to KPIMiniTile.
// DIP: all data injected through props — no store access.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/lib/markdown";
import { KPIMiniTile, type KPIMiniTileProps } from "./KPIMiniTile";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AIResponseAction {
  label: string;
  onClick: () => void;
  variant?: "outline" | "ghost";
}

export interface AIResponseCardProps {
  agentName: string;
  agentRole?: string;
  content: string;
  timestamp?: Date;
  /** Up to 4 KPI tiles shown in a 2-column grid */
  kpis?: Omit<KPIMiniTileProps, "className">[];
  actions?: AIResponseAction[];
  isStreaming?: boolean;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AIResponseCard({
  agentName,
  agentRole,
  content,
  timestamp,
  kpis,
  actions,
  isStreaming = false,
  className,
}: AIResponseCardProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex flex-col gap-2", className)}
    >
      {/* Agent attribution row */}
      <div className="flex items-center gap-2 text-micro text-text-secondary">
        <span className="text-brand-dim select-none" aria-hidden="true">
          ✦
        </span>
        <span className="font-medium text-text-primary">{agentName}</span>
        {agentRole && (
          <span className="text-text-secondary">· {agentRole}</span>
        )}
        {timestamp && (
          <span className="ml-auto tabular-nums">{formatTime(timestamp)}</span>
        )}
      </div>

      {/* Main card */}
      <div
        className={cn(
          "border-l-4 border-brand-dim bg-surface-raised rounded-r-card px-4 py-3 shadow-surface",
          "text-text-primary",
        )}
      >
        {/* Markdown content */}
        <div
          className="text-body leading-relaxed prose-sm max-w-none"
          // Content is XSS-safe: HTML-escaped then markdown-transformed in renderMarkdown()
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Streaming cursor */}
        {isStreaming && (
          <span
            aria-label="Typing…"
            className="inline-block w-0.5 h-4 bg-brand-dim align-text-bottom ml-0.5 animate-pulse"
          />
        )}

        {/* KPI grid — max 4 tiles, 2 columns */}
        {kpis && kpis.length > 0 && (
          <div
            className={cn(
              "mt-3 grid gap-2",
              kpis.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {kpis.slice(0, 4).map((kpi, i) => (
              <KPIMiniTile key={i} {...kpi} />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {actions && actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant ?? "outline"}
                size="sm"
                onClick={action.onClick}
                className="text-caption"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
