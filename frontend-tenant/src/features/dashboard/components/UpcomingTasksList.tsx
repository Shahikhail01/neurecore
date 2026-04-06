"use client";
// ─── UpcomingTasksList.tsx ────────────────────────────────────────────────────
// SRP: Renders a compact list of pending / upcoming tasks.
// OCP: Priority badge colors configured via PRIORITY_STYLE map — add variants
//      without modifying the render loop.
// DIP: Data injected via props — no fetching in this component.

import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/shared/types/domain.types";

interface UpcomingTasksListProps {
  tasks: Task[];
  loading: boolean;
}

// OCP: extend to add new priority levels
const PRIORITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-status-risk/15 text-status-risk",
  HIGH: "bg-status-warn/15 text-status-warn",
  MEDIUM: "bg-status-ops/15  text-status-ops",
  LOW: "bg-surface-muted  text-text-secondary",
};

function formatDue(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `in ${diff}d`;
}

function TaskRow({ task }: { task: Task }) {
  const priorityClass =
    PRIORITY_STYLE[task.priority?.toUpperCase()] ?? PRIORITY_STYLE.LOW;
  const due = formatDue(task.dueAt);
  const isOverdue = due === "Overdue";

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-start gap-3 py-2 px-3 -mx-3 rounded-input hover:bg-surface-overlay transition-colors duration-fast group"
    >
      <div className="flex-1 min-w-0 mt-0.5">
        <p className="text-caption text-text-primary truncate">{task.title}</p>
        {task.agentName && (
          <p className="text-micro text-text-secondary truncate">
            → {task.agentName}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className={cn("text-micro px-1.5 py-0.5 rounded-pill", priorityClass)}
        >
          {task.priority?.toLowerCase() ?? "normal"}
        </span>
        {due && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-micro",
              isOverdue ? "text-status-risk" : "text-text-secondary",
            )}
          >
            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
            {due}
          </span>
        )}
      </div>
    </Link>
  );
}

export function UpcomingTasksList({ tasks, loading }: UpcomingTasksListProps) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading tasks">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-input bg-surface-overlay animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="py-4 text-center text-caption text-text-secondary">
        No pending tasks.{" "}
        <Link href="/tasks/new" className="text-brand hover:underline">
          Create one →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tasks.slice(0, 6).map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
      <div className="pt-2 border-t border-surface-border mt-2">
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-micro text-brand hover:underline"
        >
          View all tasks <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
