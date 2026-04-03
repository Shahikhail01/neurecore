"use client";

import { useEffect, useState } from "react";
import {
  CheckSquare,
  Plus,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    api
      .get("/tasks")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        setTasks(res.data?.data ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible =
    statusFilter === "all"
      ? tasks
      : tasks.filter((t) => t.status === statusFilter);

  const statusColor = (s: string) =>
    ({
      completed: "text-green-400 bg-green-500/10",
      in_progress: "text-blue-400 bg-blue-500/10",
      pending: "text-zinc-400 bg-zinc-500/10",
      failed: "text-red-400 bg-red-500/10",
    })[s] ?? "text-zinc-400 bg-zinc-500/10";

  const priorityColor = (p?: string) =>
    ({
      high: "text-red-400",
      medium: "text-amber-400",
      low: "text-green-400",
    })[p ?? ""] ?? "text-zinc-400";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            Tasks
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {tasks.length} tasks total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-lg p-0.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium transition-all capitalize",
                  statusFilter === s
                    ? "bg-violet-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <a
            href="/tasks/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 mx-4 my-2 rounded-md bg-[var(--surface-overlay)] animate-pulse"
            />
          ))
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <CheckSquare className="w-10 h-10 text-blue-500/20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              No tasks found
            </p>
            <a
              href="/tasks/new"
              className="mt-4 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
            >
              Create first task
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--surface)] border-b border-[var(--surface-border)]">
              <tr>
                {["Title", "Status", "Priority", "Assignee", "Due"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]"
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
                  className="border-b border-[var(--surface-border)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">
                    {task.title}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        statusColor(task.status),
                      )}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-xs capitalize",
                      priorityColor(task.priority),
                    )}
                  >
                    {task.priority ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {task.assignee ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
