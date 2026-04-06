"use client";
// ─── OrgChartNode.tsx ─────────────────────────────────────────────────────────
// SRP: Renders a single org-chart node (department header or agent card).
// OCP: Status/mood configs are data-driven maps — extend without modifying this file.

import { useState } from "react";
import { motion } from "framer-motion";
import type { OrgNode } from "@/features/org-chart/hooks/useOrgChart";

// ─── Status → color map ───────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-status-profit",
  INACTIVE: "bg-text-muted",
  TRAINING: "bg-status-warn",
  ERROR: "bg-status-risk",
  PAUSED: "bg-status-ops",
};

const MOOD_EMOJI: Record<string, string> = {
  busy: "😤",
  idle: "😌",
  optimistic: "😊",
  stressed: "😰",
  offline: "😴",
};

// ─── Agent card ───────────────────────────────────────────────────────────────
interface AgentNodeProps {
  node: OrgNode;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export function AgentNode({
  node,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
}: AgentNodeProps) {
  const [showPreview, setShowPreview] = useState(false);
  const dotColor = STATUS_DOT[node.status ?? "INACTIVE"] ?? "bg-zinc-500";
  const moodEmoji = MOOD_EMOJI[node.mood ?? "idle"] ?? "😌";
  const workload = node.workloadGauge ?? 0;

  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => {
        (e as unknown as DragEvent).dataTransfer?.setData("agentId", node.id);
        onDragStart(node.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(node.id)}
      className={`group relative flex cursor-grab items-center gap-2.5 rounded-card border px-3 py-2 transition-all
        ${
          isSelected
            ? "border-brand/60 bg-brand/10"
            : "border-surface-border bg-surface-raised hover:border-brand/30 hover:bg-surface-overlay"
        }
        ${isDragging ? "opacity-40 scale-95" : ""}
      `}
      whileHover={{ x: 2 }}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {node.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.avatarUrl}
            alt={node.name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-caption font-bold text-brand">
            {node.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${dotColor}`}
        />
      </div>

      {/* Name + mood */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-medium text-text-primary">
          {node.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {/* Workload bar */}
          <div className="h-1 w-16 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                workload > 80
                  ? "bg-status-risk"
                  : workload > 60
                    ? "bg-status-warn"
                    : "bg-status-profit"
              }`}
              style={{ width: `${workload}%` }}
            />
          </div>
          <span className="text-micro text-text-muted">{workload}%</span>
        </div>
      </div>

      {/* Mood emoji */}
      <span className="text-sm" title={`Mood: ${node.mood}`}>
        {moodEmoji}
      </span>

      {/* Hover preview tooltip */}
      {showPreview && node._agent && (
        <div className="absolute left-full top-0 z-50 ml-2 w-52 rounded-card border border-surface-border bg-surface-raised p-3 text-caption shadow-xl">
          <p className="font-semibold text-text-primary mb-1">{node.name}</p>
          <p className="text-text-secondary">Role: {node._agent.type}</p>
          <p className="text-text-secondary">
            Tasks done: {node._agent.performance?.tasksCompleted ?? 0}
          </p>
          <p className="text-text-secondary">
            Success: {node._agent.performance?.successRate ?? 0}%
          </p>
        </div>
      )}

      {/* Show preview on long hover */}
      <button
        className="absolute inset-0 rounded-lg"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        aria-label={`Preview ${node.name}`}
        tabIndex={-1}
      />
    </motion.div>
  );
}

// ─── Department header ────────────────────────────────────────────────────────
interface DeptNodeProps {
  node: OrgNode;
  isExpanded: boolean;
  isDragOver: boolean;
  onToggle: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export function DeptNode({
  node,
  isExpanded,
  isDragOver,
  onToggle,
  onDragOver,
  onDragLeave,
  onDrop,
}: DeptNodeProps) {
  const agentCount = node.children?.length ?? 0;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-card border transition-colors ${
        isDragOver ? "border-brand/60 bg-brand/5" : "border-transparent"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-card px-2 py-1.5 hover:bg-surface-overlay transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-caption text-text-muted transition-transform duration-200"
            style={{
              display: "inline-block",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
          <span className="text-caption font-semibold text-text-primary">
            {node.name}
          </span>
        </div>
        <span className="rounded-pill bg-surface-overlay px-1.5 py-0.5 text-micro text-text-secondary">
          {agentCount}
        </span>
      </button>

      {isDragOver && (
        <p className="pb-2 text-center text-micro text-brand">
          Drop agent here
        </p>
      )}
    </div>
  );
}
