"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, ArrowLeft, Bot, Zap } from "lucide-react";
import api from "@/services/api";
import { hqEventBus } from "@/core/infrastructure/socket/EventBus";
import { getSocket } from "@/services/socket";

interface Agent {
  id: string;
  name: string;
  status?: string;
}

interface StreamEvent {
  type: string;
  message: string;
  ts: number;
}

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Agent dispatch state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [dispatchedTaskId, setDispatchedTaskId] = useState<string | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Load agents for the dropdown
  useEffect(() => {
    api
      .get("/agents")
      .then((res) => {
        const list: Agent[] =
          res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setAgents(list);
      })
      .catch(() => {});
  }, []);

  // Subscribe to task streaming events after dispatch
  const subscribeToTask = useCallback((taskId: string) => {
    const socket = getSocket();

    const addEvent = (type: string, msg: string) =>
      setStreamEvents((prev) => [
        ...prev,
        { type, message: msg, ts: Date.now() },
      ]);

    const onStepStart = (d: { taskId: string; description?: string }) => {
      if (d.taskId === taskId)
        addEvent("step", d.description ?? "Step started");
    };
    const onTool = (d: { taskId: string; toolName?: string }) => {
      if (d.taskId === taskId)
        addEvent("tool", `Tool: ${d.toolName ?? "unknown"}`);
    };
    const onComplete = (d: { taskId: string }) => {
      if (d.taskId === taskId) addEvent("done", "Task completed");
    };
    const onFailed = (d: { taskId: string }) => {
      if (d.taskId === taskId) addEvent("error", "Task failed");
    };

    socket.on("task:step:start", onStepStart as never);
    socket.on("task:tool:call", onTool as never);
    socket.on("task:completed", onComplete as never);
    socket.on("task:failed", onFailed as never);

    // Also subscribe via EventBus for status updates
    const unsub = hqEventBus.on("task:update", ({ taskId: tid, status }) => {
      if (tid === taskId) addEvent("status", `Status → ${status}`);
    });

    return () => {
      socket.off("task:step:start", onStepStart as never);
      socket.off("task:tool:call", onTool as never);
      socket.off("task:completed", onComplete as never);
      socket.off("task:failed", onFailed as never);
      unsub();
    };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [streamEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    setStreamEvents([]);
    try {
      const taskRes = await api.post("/tasks", {
        title: title.trim(),
        description: description || undefined,
        priority: priority.toUpperCase(),
        scheduledAt: dueDate || undefined,
        agentId: selectedAgentId || undefined,
      });

      // Unwrap API envelope (data may be nested)
      const created =
        taskRes.data?.data?.data ?? taskRes.data?.data ?? taskRes.data;
      const taskId: string = created?.id;

      if (selectedAgentId && taskId) {
        // Dispatch to agent — fire-and-forget; track via WebSocket
        await api.post(`/agents/${selectedAgentId}/dispatch`, { taskId });
        setDispatchedTaskId(taskId);
        // Start streaming subscription
        subscribeToTask(taskId);
      } else {
        router.push("/tasks");
      }
    } catch {
      setError("Failed to create task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (dispatchedTaskId) {
    return (
      <div className="h-full overflow-y-auto hide-scrollbar">
        <div className="max-w-xl mx-auto px-5 py-8">
          <div className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-violet-400 font-medium mb-1">
              Task dispatched to agent
            </p>
            <p className="text-sm font-mono text-[var(--text-primary)]">
              {dispatchedTaskId}
            </p>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Live Log
          </p>
          <div
            ref={logRef}
            className="h-64 overflow-y-auto rounded-xl bg-[var(--surface-overlay)] border border-[var(--surface-border)] p-3 space-y-1 font-mono text-[11px]"
          >
            {streamEvents.length === 0 ? (
              <p className="text-[var(--text-secondary)]">
                Waiting for events…
              </p>
            ) : (
              streamEvents.map((ev, i) => (
                <p
                  key={i}
                  className={
                    ev.type === "error"
                      ? "text-red-400"
                      : ev.type === "done"
                        ? "text-green-400"
                        : ev.type === "tool"
                          ? "text-amber-400"
                          : "text-[var(--text-primary)]"
                  }
                >
                  <span className="text-[var(--text-secondary)]">
                    {new Date(ev.ts).toLocaleTimeString()}
                  </span>{" "}
                  {ev.message}
                </p>
              ))
            )}
          </div>
          <button
            onClick={() => router.push("/tasks")}
            className="mt-4 w-full py-2 rounded-md bg-[var(--surface-raised)] border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            View all tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-xl mx-auto px-5 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-6">
          <CheckSquare className="w-5 h-5 text-blue-400" /> New Task
        </h1>
        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description / Goal
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Additional context for agents…"
              className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
          {/* Optional agent assignment */}
          {agents.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Assign to Agent (optional)
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
              >
                <option value="">— No agent (create task only) —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedAgentId && (
                <p className="text-[10px] text-amber-400 mt-1">
                  Task will be dispatched immediately after creation.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 rounded-md border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              {loading
                ? "Creating…"
                : selectedAgentId
                  ? "Create & Dispatch"
                  : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
