"use client";
// ─── tasks/[id]/page.tsx ──────────────────────────────────────────────────────
// SRP: Task detail orchestration only — sub-tabs are self-contained.
// Phase E: New task detail page (plan §Phase E / §6 target file structure).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckSquare,
  ArrowLeft,
  Clock,
  User,
  Calendar,
  Activity,
  Loader2,
  Flag,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { TabNav } from "@/components/layout/TabNav";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = "overview" | "activity";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  agentId?: string;
  createdAt?: string;
}

interface ActivityEntry {
  id: string;
  message: string;
  timestamp: string;
}

// ─── Lookup maps ─────────────────────────────────────────────────────────────
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

// ─── TABS config ─────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <CheckSquare className="w-3.5 h-3.5" />,
  },
  {
    id: "activity",
    label: "Activity",
    icon: <Activity className="w-3.5 h-3.5" />,
  },
];

// ─── OverviewTab ──────────────────────────────────────────────────────────────
function OverviewTab({ task }: { task: Task }) {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-card bg-surface-raised border border-surface-border p-card">
        <div className="flex items-start gap-3 mb-4">
          <CheckSquare
            className="w-5 h-5 text-brand mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <h2 className="text-subheading font-semibold text-text-primary">
            {task.title}
          </h2>
        </div>

        {task.description && (
          <p className="text-body text-text-secondary mb-5">
            {task.description}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <dt className="text-micro uppercase tracking-widest text-text-secondary font-semibold mb-1">
              Status
            </dt>
            <dd>
              <span
                className={cn(
                  "text-caption px-2 py-0.5 rounded-pill capitalize",
                  STATUS_STYLE[task.status] ??
                    "bg-surface-muted text-text-secondary",
                )}
              >
                {task.status.replace("_", " ")}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-micro uppercase tracking-widest text-text-secondary font-semibold mb-1">
              Priority
            </dt>
            <dd
              className={cn(
                "text-body font-medium capitalize flex items-center gap-1.5",
                PRIORITY_COLOR[task.priority ?? ""] ?? "text-text-secondary",
              )}
            >
              <Flag className="w-3.5 h-3.5" aria-hidden="true" />
              {task.priority ?? "—"}
            </dd>
          </div>

          <div>
            <dt className="text-micro uppercase tracking-widest text-text-secondary font-semibold mb-1">
              Assignee
            </dt>
            <dd className="flex items-center gap-1.5 text-body text-text-primary">
              <User
                className="w-3.5 h-3.5 text-text-secondary"
                aria-hidden="true"
              />
              {task.assignee ?? "Unassigned"}
            </dd>
          </div>

          <div>
            <dt className="text-micro uppercase tracking-widest text-text-secondary font-semibold mb-1">
              Due Date
            </dt>
            <dd className="flex items-center gap-1.5 text-body text-text-primary">
              <Calendar
                className="w-3.5 h-3.5 text-text-secondary"
                aria-hidden="true"
              />
              {task.dueDate
                ? new Date(task.dueDate).toLocaleDateString()
                : "No due date"}
            </dd>
          </div>

          {task.createdAt && (
            <div>
              <dt className="text-micro uppercase tracking-widest text-text-secondary font-semibold mb-1">
                Created
              </dt>
              <dd className="flex items-center gap-1.5 text-body text-text-secondary">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {new Date(task.createdAt).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ─── ActivityTab ──────────────────────────────────────────────────────────────
function ActivityTab({ taskId }: { taskId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/tasks/${taskId}/activity`)
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-input bg-surface-overlay animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="max-w-2xl py-8 text-center">
        <Activity className="w-8 h-8 text-text-secondary mx-auto mb-2" />
        <p className="text-body text-text-secondary">
          No activity recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 rounded-input border border-surface-border bg-surface-overlay p-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-brand mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body text-text-primary">{e.message}</p>
            <p className="text-micro text-text-secondary mt-0.5">
              {new Date(e.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    if (!taskId) return;
    api
      .get(`/tasks/${taskId}`)
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data;
        setTask(data as Task);
      })
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <CheckSquare className="w-8 h-8 text-text-secondary" />
        <p className="text-body text-text-secondary">Task not found.</p>
        <button
          onClick={() => router.push("/tasks")}
          className="text-caption text-brand hover:underline"
        >
          Back to tasks
        </button>
      </div>
    );
  }

  const statusStyle =
    STATUS_STYLE[task.status] ?? "bg-surface-muted text-text-secondary";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 px-page py-3 border-b border-surface-border bg-surface-raised flex items-center gap-3">
        <button
          onClick={() => router.push("/tasks")}
          aria-label="Back to tasks"
          className="text-text-secondary hover:text-text-primary transition-colors duration-fast"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckSquare
            className="w-4 h-4 text-brand flex-shrink-0"
            aria-hidden="true"
          />
          <h1 className="text-body font-semibold text-text-primary truncate">
            {task.title}
          </h1>
        </div>
        <span
          className={cn(
            "flex-shrink-0 text-micro px-2 py-0.5 rounded-pill capitalize",
            statusStyle,
          )}
        >
          {task.status.replace("_", " ")}
        </span>
      </div>

      {/* Tab strip */}
      <TabNav
        tabs={TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-page py-5">
        {activeTab === "overview" && <OverviewTab task={task} />}
        {activeTab === "activity" && <ActivityTab taskId={taskId} />}
      </div>
    </div>
  );
}
