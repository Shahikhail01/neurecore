"use client";
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Plus, User } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
}

const STATUSES = [
  "all",
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-status-profit/15 text-status-profit",
  in_progress: "bg-status-ops/15 text-status-ops",
  pending: "bg-surface-muted text-text-secondary",
  failed: "bg-status-risk/15 text-status-risk",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "text-status-risk",
  high: "text-status-warn",
  medium: "text-status-ops",
  low: "text-status-profit",
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(() => {
    api
      .get("/tasks")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setTasks(res.data?.data?.data ?? res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible =
    statusFilter === "all"
      ? tasks
      : tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Tasks"
        icon={<CheckSquare className="w-4 h-4" />}
        subtitle={`${tasks.length} task${tasks.length !== 1 ? "s" : ""} total`}
        actions={
          <a
            href="/tasks/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-brand hover:bg-brand-dim text-brand-foreground text-caption font-medium transition-colors duration-fast"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </a>
        }
      />

      {/* Filter bar */}
      <div className="flex-shrink-0 px-page py-2 border-b border-surface-border">
        <div className="flex gap-0.5 w-fit bg-surface-overlay border border-surface-border rounded-input p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-input text-micro font-medium transition-colors duration-fast capitalize",
                statusFilter === s
                  ? "bg-brand text-brand-foreground"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <PageContent noPadding>
        {loading ? (
          <div className="p-page space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-input bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <CheckSquare className="w-10 h-10 text-brand/20 mb-3" />
            <p className="text-body font-medium text-text-secondary">
              No tasks found
            </p>
            <a
              href="/tasks/new"
              className="mt-4 px-4 py-2 rounded-input bg-brand hover:bg-brand-dim text-caption text-brand-foreground font-medium transition-colors duration-fast"
            >
              Create first task
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-surface border-b border-surface-border">
              <tr>
                {["Title", "Status", "Priority", "Assignee", "Due"].map((h) => (
                  <th
                    key={h}
                    className="px-page py-2 text-left text-micro font-semibold uppercase tracking-widest text-text-secondary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && router.push(`/tasks/${task.id}`)
                  }
                  role="link"
                  className="border-b border-surface-border hover:bg-surface-raised transition-colors duration-fast cursor-pointer"
                >
                  <td className="px-page py-3 text-body text-text-primary font-medium">
                    {task.title}
                  </td>
                  <td className="px-page py-3">
                    <span
                      className={cn(
                        "text-caption px-2 py-0.5 rounded-pill capitalize",
                        STATUS_STYLE[task.status] ??
                          "bg-surface-muted text-text-secondary",
                      )}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-page py-3 text-caption capitalize",
                      PRIORITY_COLOR[task.priority ?? ""] ??
                        "text-text-secondary",
                    )}
                  >
                    {task.priority ?? "—"}
                  </td>
                  <td className="px-page py-3 text-caption text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      {task.assignee ?? "—"}
                    </span>
                  </td>
                  <td className="px-page py-3 text-caption text-text-secondary">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PageContent>
    </div>
  );
}
