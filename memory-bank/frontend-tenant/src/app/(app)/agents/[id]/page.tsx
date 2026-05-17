"use client";
// ─── agents/[id]/page.tsx ─────────────────────────────────────────────────────
// SRP: Tab orchestration and agent loading only. Each tab is a self-contained
//      sub-component.
// OCP: New tabs are added by appending to TABS and adding a case to the render —
//      no existing tab component changes.

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
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { useAgentMetrics } from "@/hooks/useAgentMetrics";
import { TabNav } from "@/components/layout/TabNav";
import { KPIMiniTile } from "@/components/ai/KPIMiniTile";
import type { AgentMetrics } from "@/services/analytics.service";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId =
  | "overview"
  | "config"
  | "versions"
  | "staging"
  | "team"
  | "conversations";

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string;
  systemPrompt?: string;
  instructions?: string;
  deploymentMode?: string;
  departmentName?: string;
  description?: string;
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

// ─── TABS config ─────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
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
  {
    id: "conversations",
    label: "Conversations",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
];

// ─── OverviewTab ──────────────────────────────────────────────────────────────
function OverviewTab({
  agent,
  metrics,
}: {
  agent: Agent;
  metrics: AgentMetrics | null;
}) {
  const statusStyle =
    agent.status === "ACTIVE"
      ? "bg-status-profit/15 text-status-profit"
      : agent.status === "ERROR"
        ? "bg-status-risk/15 text-status-risk"
        : agent.status === "PAUSED"
          ? "bg-status-warn/15 text-status-warn"
          : "bg-surface-muted text-text-secondary";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identity card */}
      <div className="rounded-card bg-surface-raised border border-surface-border p-card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-brand-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-subheading font-semibold text-text-primary">
                {agent.name}
              </h2>
              <span
                className={cn(
                  "text-micro px-2 py-0.5 rounded-pill capitalize",
                  statusStyle,
                )}
              >
                {agent.status?.toLowerCase()}
              </span>
            </div>
            <p className="text-caption text-text-secondary mb-0.5 capitalize">
              {agent.type?.toLowerCase()} &middot; {agent.model}
              {agent.departmentName && ` · ${agent.departmentName}`}
            </p>
            {agent.description && (
              <p className="text-body text-text-secondary mt-2">
                {agent.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics KPI grid */}
      {metrics ? (
        <div>
          <h3 className="text-caption font-semibold uppercase tracking-widest text-text-secondary mb-3">
            Performance
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <KPIMiniTile
              value={`${metrics.successRate.toFixed(0)}%`}
              label="Success rate"
              color={
                metrics.successRate >= 80
                  ? "profit"
                  : metrics.successRate >= 50
                    ? "ops"
                    : "risk"
              }
              trend={metrics.successRate >= 80 ? "up" : "down"}
            />
            <KPIMiniTile
              value={metrics.tasksCompleted}
              label="Tasks completed"
              color="ops"
            />
            <KPIMiniTile
              value={`${metrics.workloadPct}%`}
              label="Workload"
              color={metrics.workloadPct > 80 ? "risk" : "neutral"}
            />
            <KPIMiniTile
              value={`$${metrics.costToday.toFixed(2)}`}
              label="Cost today"
              color="neutral"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-input bg-surface-overlay animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ConfigTab ────────────────────────────────────────────────────────────────
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

  const inputClass =
    "w-full px-3 py-2 text-body rounded-input bg-surface-overlay border border-surface-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand";

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="block text-caption font-medium text-text-secondary mb-1">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-caption font-medium text-text-secondary mb-1">
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className={cn(inputClass, "resize-none")}
        />
      </div>
      <div>
        <label className="block text-caption font-medium text-text-secondary mb-1">
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className={cn(inputClass, "resize-none")}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-foreground rounded-input text-body font-medium disabled:opacity-50 transition-colors duration-fast"
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

// ─── VersionsLink ─────────────────────────────────────────────────────────────
function VersionsLink({ agentId }: { agentId: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-body text-text-secondary">
        View complete version history for this agent, including config snapshots
        and rollback options.
      </p>
      <a
        href={`/agents/${agentId}/versions`}
        className="flex items-center gap-2 px-4 py-2 rounded-input border border-surface-border text-body text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors duration-fast"
      >
        <History className="w-4 h-4" />
        Open Version History
      </a>
    </div>
  );
}

// ─── StagingTab ───────────────────────────────────────────────────────────────
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
    void load();
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
    const testCases = testInput
      .split("\n")
      .filter(Boolean)
      .map((line) => {
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
      return <CheckCircle2 className="w-3.5 h-3.5 text-status-profit" />;
    if (status === "FAILED")
      return <XCircle className="w-3.5 h-3.5 text-status-risk" />;
    if (status === "RUNNING")
      return <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />;
    return <Clock className="w-3.5 h-3.5 text-text-secondary" />;
  };

  const inputClass =
    "w-full px-3 py-2 text-body rounded-input bg-surface-overlay border border-surface-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand";

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <p
          role="alert"
          className="text-body text-status-risk bg-status-risk/10 border border-status-risk/20 rounded-input px-3 py-2"
        >
          {error}
        </p>
      )}

      <div className="rounded-card border border-surface-border p-card">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Staging Environment
        </h3>
        <p className="text-caption text-text-secondary mb-3">
          Clone this agent to a staging copy to safely test changes before
          promoting to production.
        </p>
        <button
          onClick={handleCloneToStaging}
          disabled={cloning}
          className="flex items-center gap-2 px-3 py-1.5 text-body rounded-input bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition-colors duration-fast disabled:opacity-50"
        >
          {cloning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FlaskConical className="w-3.5 h-3.5" />
          )}
          Clone to Staging
        </button>
      </div>

      <div className="rounded-card border border-surface-border p-card">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          New Evaluation Run
        </h3>
        <p className="text-caption text-text-secondary mb-3">
          Enter test cases — one per line. Format:{" "}
          <code className="bg-surface-overlay px-1 rounded text-micro font-mono text-brand-dim">
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
          className={cn(inputClass, "resize-none mb-2 font-mono")}
        />
        <button
          onClick={handleRunEval}
          disabled={running || !testInput.trim()}
          className="flex items-center gap-2 px-3 py-1.5 text-body rounded-input bg-brand hover:bg-brand-dim text-brand-foreground disabled:opacity-50 transition-colors duration-fast"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run Evaluation
        </button>
      </div>

      <div>
        <h3 className="text-body font-semibold text-text-primary mb-3">
          Evaluation Runs
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-input bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : evalRuns.length === 0 ? (
          <p className="text-caption text-text-secondary">
            No evaluation runs yet.
          </p>
        ) : (
          <div className="space-y-2">
            {evalRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-input border border-surface-border bg-surface-overlay p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(run.status)}
                    <span className="text-caption font-medium text-text-primary capitalize">
                      {run.status.toLowerCase()}
                    </span>
                    <span className="text-micro text-text-secondary">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-caption">
                    {run.passRate !== null && (
                      <span
                        className={cn(
                          "font-semibold",
                          (run.passRate ?? 0) >= 0.8
                            ? "text-status-profit"
                            : "text-status-warn",
                        )}
                      >
                        {Math.round((run.passRate ?? 0) * 100)}% pass
                      </span>
                    )}
                    {run.status === "COMPLETED" &&
                      (run.passRate ?? 0) >= 0.8 && (
                        <button
                          onClick={() => handlePromote(run.id)}
                          className="px-2 py-0.5 rounded-pill bg-status-profit/10 text-status-profit border border-status-profit/20 hover:bg-status-profit/20 text-micro"
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
                        className="flex items-start gap-2 text-micro"
                      >
                        {r.passed ? (
                          <CheckCircle2 className="w-3 h-3 text-status-profit mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-status-risk mt-0.5 flex-shrink-0" />
                        )}
                        <span className="text-text-secondary truncate">
                          {r.input}
                        </span>
                        <span className="text-text-muted ml-auto flex-shrink-0">
                          {r.latencyMs}ms
                        </span>
                      </div>
                    ))}
                    {run.results.length > 3 && (
                      <p className="text-micro text-text-secondary pl-5">
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

// ─── TeamTab ──────────────────────────────────────────────────────────────────
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
      <p className="text-body text-text-secondary">
        Workers assigned to this supervisor agent.
      </p>
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-input bg-surface-overlay animate-pulse"
            />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-card border border-dashed border-surface-border p-6 text-center">
          <Users className="w-8 h-8 text-text-secondary mx-auto mb-2" />
          <p className="text-body text-text-secondary">
            No workers assigned yet.
          </p>
          <p className="text-caption text-text-secondary mt-1">
            Use{" "}
            <a href="/workflows/new" className="text-brand hover:underline">
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
              className="flex items-center gap-3 rounded-input border border-surface-border bg-surface-overlay p-3"
            >
              <Bot className="w-4 h-4 text-brand" />
              <div>
                <p className="text-body font-medium text-text-primary">
                  {w.name}
                </p>
                <p className="text-caption text-text-secondary capitalize">
                  {w.type?.toLowerCase()}
                </p>
              </div>
              <span
                className={cn(
                  "ml-auto text-micro px-2 py-0.5 rounded-pill capitalize",
                  w.status === "ACTIVE"
                    ? "bg-status-profit/10 text-status-profit"
                    : "bg-surface-muted text-text-secondary",
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

// ─── ConversationsTab ─────────────────────────────────────────────────────────
function ConversationsTab({ agentId }: { agentId: string }) {
  const [convs, setConvs] = useState<
    { id: string; summary: string; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/agents/${agentId}/conversations`)
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setConvs(Array.isArray(data) ? data : []);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="space-y-2 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-input bg-surface-overlay animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!convs.length) {
    return (
      <div className="max-w-2xl py-8 text-center">
        <MessageSquare className="w-8 h-8 text-text-secondary mx-auto mb-2" />
        <p className="text-body text-text-secondary">No conversations yet.</p>
        <p className="text-caption text-text-secondary mt-1">
          Ask this agent something using the AI panel (
          <kbd className="px-1 font-mono bg-surface-overlay rounded text-micro">
            ⌘/
          </kbd>
          ).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {convs.map((c) => (
        <div
          key={c.id}
          className="rounded-input border border-surface-border bg-surface-overlay p-3"
        >
          <p className="text-body text-text-primary truncate">
            {c.summary ?? "Conversation"}
          </p>
          <p className="text-micro text-text-secondary mt-0.5">
            {new Date(c.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.id as string;
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const { metrics: allMetrics } = useAgentMetrics();
  const agentMetrics = allMetrics.find((m) => m.agentId === agentId) ?? null;

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
    await api
      .post(`/agents/${agentId}/versions`, {
        label: `Auto-save: ${new Date().toISOString()}`,
      })
      .catch(() => null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Bot className="w-8 h-8 text-text-secondary" />
        <p className="text-body text-text-secondary">Agent not found.</p>
        <button
          onClick={() => router.push("/agents")}
          className="text-caption text-brand hover:underline"
        >
          Back to agents
        </button>
      </div>
    );
  }

  const statusStyle =
    agent.status === "ACTIVE"
      ? "bg-status-profit/15 text-status-profit"
      : agent.status === "ERROR"
        ? "bg-status-risk/15 text-status-risk"
        : "bg-surface-muted text-text-secondary";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-page py-3 border-b border-surface-border flex items-center gap-3">
        <button
          onClick={() => router.push("/agents")}
          aria-label="Back to agents"
          className="text-text-secondary hover:text-text-primary transition-colors duration-fast"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-brand-foreground" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-body font-semibold text-text-primary">
              {agent.name}
            </h1>
            <p className="text-micro text-text-secondary capitalize">
              {agent.type?.toLowerCase()} &middot; {agent.model}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "ml-auto text-micro px-2 py-0.5 rounded-pill capitalize",
            statusStyle,
          )}
        >
          {agent.status?.toLowerCase()}
        </span>
        {agentMetrics && (
          <span className="flex items-center gap-1 text-micro text-text-secondary">
            <TrendingUp
              className="w-3 h-3 text-status-profit"
              aria-hidden="true"
            />
            {agentMetrics.successRate.toFixed(0)}% success
          </span>
        )}
      </div>

      {/* Tab strip */}
      <TabNav
        tabs={TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-page py-5">
        {activeTab === "overview" && (
          <OverviewTab agent={agent} metrics={agentMetrics} />
        )}
        {activeTab === "config" && (
          <ConfigTab agent={agent} onSave={handleSave} />
        )}
        {activeTab === "versions" && <VersionsLink agentId={agentId} />}
        {activeTab === "staging" && <StagingTab agentId={agentId} />}
        {activeTab === "team" && <TeamTab agentId={agentId} />}
        {activeTab === "conversations" && (
          <ConversationsTab agentId={agentId} />
        )}
      </div>
    </div>
  );
}
