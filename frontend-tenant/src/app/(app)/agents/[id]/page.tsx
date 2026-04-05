"use client";

/**
 * Agent Detail Page — Phase 2.1
 * Tabs: Config | Versions | Staging & Evaluation | Team
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bot,
  ArrowLeft,
  Settings,
  History,
  FlaskConical,
  Users,
  Save,
  Play,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "config" | "versions" | "staging" | "team";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string;
  systemPrompt?: string;
  instructions?: string;
  deploymentMode?: string;
}

interface EvalRun {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  averageScore: number | null;
  passRate: number | null;
  createdAt: string;
  testCases: unknown[];
  results: Array<{
    input: string;
    actualOutput: string;
    score: number;
    passed: boolean;
    latencyMs: number;
  }>;
}

interface Worker {
  id: string;
  name: string;
  type: string;
  status: string;
}

// ─── Tab components ───────────────────────────────────────────────────────────

function ConfigTab({
  agent,
  onSave,
}: {
  agent: Agent;
  onSave: (patch: Partial<Agent>) => Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? "");
  const [instructions, setInstructions] = useState(agent.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, systemPrompt, instructions });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

function VersionsLink({ agentId }: { agentId: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-[var(--text-secondary)]">
        View the complete version history for this agent, including config
        snapshots and rollback options.
      </p>
      <a
        href={`/agents/${agentId}/versions`}
        className="flex items-center gap-2 px-4 py-2 rounded-md border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-violet-500/50 transition-colors"
      >
        <History className="w-4 h-4" />
        Open Version History <ChevronRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function StagingTab({ agentId }: { agentId: string }) {
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [testInput, setTestInput] = useState("");
  const [running, setRunning] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/agents/${agentId}/evaluation-runs`);
      const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
      setEvalRuns(Array.isArray(data) ? data : []);
    } catch {
      setEvalRuns([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCloneToStaging = async () => {
    setCloning(true);
    setError("");
    try {
      await api.post(`/agents/${agentId}/clone-to-staging`);
    } catch {
      setError("Failed to clone to staging.");
    } finally {
      setCloning(false);
    }
  };

  const handleRunEval = async () => {
    if (!testInput.trim()) return;
    const lines = testInput.split("\n").filter(Boolean);
    const testCases = lines.map((line) => {
      const [input, expectedOutput] = line.split(">>").map((s) => s.trim());
      return { input, expectedOutput };
    });

    setRunning(true);
    setError("");
    try {
      await api.post(`/agents/${agentId}/evaluation-runs`, { testCases });
      await load();
      setTestInput("");
    } catch {
      setError("Failed to start evaluation run.");
    } finally {
      setRunning(false);
    }
  };

  const handlePromote = async (runId: string) => {
    try {
      await api.post(`/agents/${agentId}/promote`, { evaluationRunId: runId });
    } catch {
      setError("Promotion failed.");
    }
  };

  const statusIcon = (status: EvalRun["status"]) => {
    if (status === "COMPLETED")
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === "FAILED")
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (status === "RUNNING")
      return <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />;
    return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Clone to staging */}
      <div className="rounded-xl border border-[var(--surface-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
          Staging Environment
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Clone this agent to a staging copy to safely test changes before
          promoting to production.
        </p>
        <button
          onClick={handleCloneToStaging}
          disabled={cloning}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30 transition-colors disabled:opacity-50"
        >
          {cloning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FlaskConical className="w-3.5 h-3.5" />
          )}
          Clone to Staging
        </button>
      </div>

      {/* New eval run */}
      <div className="rounded-xl border border-[var(--surface-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
          New Evaluation Run
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Enter test cases — one per line. Format:{" "}
          <code className="bg-zinc-800 px-1 rounded">
            Input &gt;&gt; Expected Output
          </code>
        </p>
        <textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder={
            "What is the capital of France? >> Paris\nSummarise this text >> ..."
          }
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-md bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-violet-500 resize-none mb-2 font-mono"
        />
        <button
          onClick={handleRunEval}
          disabled={running || !testInput.trim()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run Evaluation
        </button>
      </div>

      {/* Eval run history */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Evaluation Runs
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-[var(--surface-overlay)] animate-pulse"
              />
            ))}
          </div>
        ) : evalRuns.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            No evaluation runs yet.
          </p>
        ) : (
          <div className="space-y-2">
            {evalRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(run.status)}
                    <span className="text-xs font-medium text-[var(--text-primary)] capitalize">
                      {run.status.toLowerCase()}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {run.passRate !== null && (
                      <span
                        className={cn(
                          "font-semibold",
                          (run.passRate ?? 0) >= 0.8
                            ? "text-emerald-400"
                            : "text-amber-400",
                        )}
                      >
                        {Math.round((run.passRate ?? 0) * 100)}% pass
                      </span>
                    )}
                    {run.status === "COMPLETED" &&
                      (run.passRate ?? 0) >= 0.8 && (
                        <button
                          onClick={() => handlePromote(run.id)}
                          className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-[10px]"
                        >
                          Promote to Production
                        </button>
                      )}
                  </div>
                </div>
                {run.results?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {run.results.slice(0, 3).map((r, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-[10px]"
                      >
                        {r.passed ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                        )}
                        <span className="text-[var(--text-secondary)] truncate">
                          {r.input}
                        </span>
                        <span className="text-zinc-500 ml-auto flex-shrink-0">
                          {r.latencyMs}ms
                        </span>
                      </div>
                    ))}
                    {run.results.length > 3 && (
                      <p className="text-[10px] text-[var(--text-secondary)] pl-5">
                        +{run.results.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamTab({ agentId }: { agentId: string }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/workflows/supervisors/${agentId}/workers`)
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setWorkers(Array.isArray(data) ? data : []);
      })
      .catch(() => setWorkers([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Workers assigned to this supervisor agent. Assign this agent as a
        supervisor via workflows.
      </p>
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-[var(--surface-overlay)] animate-pulse"
            />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-6 text-center">
          <Users className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">
            No workers assigned yet.
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Use{" "}
            <a
              href="/workflows/new"
              className="text-violet-400 hover:underline"
            >
              Create Workflow
            </a>{" "}
            to set up supervisor-worker relationships.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {workers.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-overlay)] p-3"
            >
              <Bot className="w-4 h-4 text-violet-400" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {w.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)] capitalize">
                  {w.type?.toLowerCase()}
                </p>
              </div>
              <span
                className={cn(
                  "ml-auto text-[10px] px-1.5 py-0.5 rounded capitalize",
                  w.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-zinc-500/10 text-zinc-400",
                )}
              >
                {w.status?.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "config", label: "Config", icon: <Settings className="w-3.5 h-3.5" /> },
  {
    id: "versions",
    label: "Versions",
    icon: <History className="w-3.5 h-3.5" />,
  },
  {
    id: "staging",
    label: "Staging & Eval",
    icon: <FlaskConical className="w-3.5 h-3.5" />,
  },
  { id: "team", label: "Team", icon: <Users className="w-3.5 h-3.5" /> },
];

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;
  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;
    api
      .get(`/agents/${agentId}`)
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data;
        setAgent(data as Agent);
      })
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleSave = async (patch: Partial<Agent>) => {
    await api.patch(`/agents/${agentId}`, patch);
    // Auto-snapshot after save
    await api
      .post(`/agents/${agentId}/versions`, {
        label: `Auto-save: ${new Date().toISOString()}`,
      })
      .catch(() => null); // non-critical
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Bot className="w-8 h-8 text-[var(--text-secondary)]" />
        <p className="text-sm text-[var(--text-secondary)]">Agent not found.</p>
        <button
          onClick={() => router.push("/agents")}
          className="text-xs text-violet-400 hover:underline"
        >
          Back to agents
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[var(--surface-border)] flex items-center gap-3">
        <button
          onClick={() => router.push("/agents")}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">
              {agent.name}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] capitalize">
              {agent.type?.toLowerCase()} · {agent.model}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded capitalize",
            agent.status === "ACTIVE"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-zinc-500/10 text-zinc-400",
          )}
        >
          {agent.status?.toLowerCase()}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[var(--surface-border)] px-5 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-violet-500 text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-5">
        {activeTab === "config" && (
          <ConfigTab agent={agent} onSave={handleSave} />
        )}
        {activeTab === "versions" && <VersionsLink agentId={agentId} />}
        {activeTab === "staging" && <StagingTab agentId={agentId} />}
        {activeTab === "team" && <TeamTab agentId={agentId} />}
      </div>
    </div>
  );
}
