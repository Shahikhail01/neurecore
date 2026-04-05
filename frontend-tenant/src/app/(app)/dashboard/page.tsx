"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Plus,
  ChevronRight,
  Activity,
  Bot,
  Star,
  Link2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { WorkspaceProvisioningBanner } from "@/components/dashboard/WorkspaceProvisioningBanner";
import { workspaceProvisioningService } from "@/services/workspace-provisioning.service";
import type { ProvisioningStatusDto } from "@/types/onboarding.types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentItem {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "waiting" | "error";
  initials: string;
  color: string;
}
interface ActivityItem {
  id: string;
  agentName: string;
  agentInitials: string;
  agentColor: string;
  action: string;
  detail?: string;
  time: string;
  type: "info" | "success" | "warning" | "pending";
}
interface KpiItem {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  color?: string;
}
interface MaturityDimension {
  name: string;
  score: number;
  label: string;
}
interface MaturityReport {
  overallScore: number;
  tier: string;
  dimensions: MaturityDimension[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: AgentItem["status"] }) {
  return (
    <span
      className={cn("w-2 h-2 rounded-full flex-shrink-0", {
        "bg-green-500": status === "active",
        "bg-zinc-500": status === "idle",
        "bg-yellow-500 animate-pulse": status === "waiting",
        "bg-red-500": status === "error",
      })}
    />
  );
}

// ─── Autonomy Mode ────────────────────────────────────────────────────────────
const MODES = ["Full Auto", "Assist", "Manual"] as const;
type Mode = (typeof MODES)[number];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [mode, setMode] = useState<Mode>("Assist");
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [maturity, setMaturity] = useState<MaturityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [provStatus, setProvStatus] = useState<ProvisioningStatusDto | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      try {
        const [agentsRes, tasksRes, maturityRes] = await Promise.all([
          api.get("/agents").catch(() => ({ data: { data: [] } })),
          api.get("/tasks").catch(() => ({ data: { data: [] } })),
          api.get("/analytics/maturity").catch(() => ({ data: null })),
        ]);

        // Fetch provisioning status in parallel — never crashes dashboard on error
        workspaceProvisioningService
          .getStatus()
          .then(setProvStatus)
          .catch(() => null);

        // Unwrap TransformResponseInterceptor envelope: { status, data: <service return>, meta }
        // Agents findAll returns paginated: { data: [], total, page, ... }
        // Full path: agentsRes.data.data.data
        const agentsPayload =
          agentsRes.data?.data?.data ??
          agentsRes.data?.data ??
          agentsRes.data ??
          [];
        const rawAgents = (
          Array.isArray(agentsPayload) ? agentsPayload : []
        ).slice(0, 6);
        const COLORS = [
          "bg-violet-600",
          "bg-blue-600",
          "bg-emerald-600",
          "bg-amber-600",
          "bg-pink-600",
          "bg-cyan-600",
        ];
        setAgents(
          rawAgents.map(
            (
              a: { id: string; name?: string; role?: string; status?: string },
              i: number,
            ) => ({
              id: a.id,
              name: a.name ?? "Agent",
              role: a.role ?? "AI Employee",
              status: (a.status as AgentItem["status"]) ?? "idle",
              initials: (a.name ?? "A")
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              color: COLORS[i % COLORS.length],
            }),
          ),
        );

        const tasksPayload =
          tasksRes.data?.data?.data ??
          tasksRes.data?.data ??
          tasksRes.data ??
          [];
        const rawTasks = (
          Array.isArray(tasksPayload) ? tasksPayload : []
        ).slice(0, 6);
        setActivity(
          rawTasks.map(
            (
              t: {
                id: string;
                title?: string;
                status?: string;
                createdAt?: string;
              },
              i: number,
            ) => ({
              id: t.id ?? String(i),
              agentName: "System",
              agentInitials: "S",
              agentColor: "bg-zinc-600",
              action: t.title ?? "Task",
              detail: t.status,
              time: t.createdAt
                ? new Date(t.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "now",
              type:
                t.status === "completed"
                  ? "success"
                  : t.status === "failed"
                    ? "warning"
                    : "info",
            }),
          ),
        );

        setKpis([
          {
            label: "Tasks Completed",
            value: rawTasks
              .filter((t: { status?: string }) => t.status === "completed")
              .length.toString(),
            sub: "this week",
            trend: "up",
            color: "text-green-400",
          },
          {
            label: "Active Agents",
            value: rawAgents
              .filter((a: { status?: string }) => a.status === "active")
              .length.toString(),
            sub: `of ${rawAgents.length} deployed`,
            color: "text-violet-400",
          },
          {
            label: "Pending Approvals",
            value: "0",
            sub: "no action needed",
            color: "text-zinc-400",
          },
          {
            label: "Running Cost",
            value: "$0",
            sub: "this month",
            color: "text-blue-400",
          },
        ]);

        const maturityPayload =
          maturityRes.data?.data?.data ??
          maturityRes.data?.data ??
          maturityRes.data;
        if (maturityPayload?.overallScore !== undefined) {
          setMaturity(maturityPayload as MaturityReport);
        }
      } catch {
        // Non-critical: dashboard still renders with empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="h-full flex flex-col">
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">
            {greeting}, {user?.firstName ?? "there"} 👋
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {user?.tenant?.name ?? "AI Office"} · Project Dashboard
          </p>
        </div>

        {/* Autonomy control */}
        <div className="flex items-center gap-1 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-lg p-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                mode === m
                  ? "bg-violet-600 text-white shadow"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3-column layout ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Agent Team Roster */}
        <div className="w-52 flex-shrink-0 border-r border-[var(--surface-border)] flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--surface-border)] flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              Agent Team
            </span>
            <button
              onClick={() => (window.location.href = "/agents/new")}
              className="text-[var(--text-secondary)] hover:text-violet-400 transition-colors"
              title="Add agent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar py-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="mx-2 my-1 h-14 rounded-md bg-[var(--surface-overlay)] animate-pulse"
                />
              ))
            ) : agents.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                No agents deployed yet.
                <br />
                <a
                  href="/agents"
                  className="text-violet-400 hover:underline mt-1 inline-block"
                >
                  Hire your team →
                </a>
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    "mx-1.5 my-0.5 px-2 py-2 rounded-md cursor-pointer hover:bg-[var(--surface-overlay)] transition-colors",
                    {
                      "border border-yellow-500/30 bg-yellow-500/5":
                        agent.status === "waiting",
                    },
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full ${agent.color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
                    >
                      {agent.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] truncate">
                        {agent.role}
                      </p>
                    </div>
                    <StatusDot status={agent.status} />
                  </div>
                  {agent.status === "waiting" && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-yellow-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Needs approval</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-[var(--surface-border)]">
            <a
              href="/agents"
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-violet-500/50 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Manage Team
            </a>
          </div>
        </div>

        {/* CENTER: Activity Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Workspace provisioning banner */}
          <div className="flex-shrink-0 px-4 pt-3">
            <WorkspaceProvisioningBanner status={provStatus} />
          </div>
          {/* KPI bar */}
          <div className="flex-shrink-0 grid grid-cols-4 gap-0 border-b border-[var(--surface-border)]">
            {(loading
              ? Array.from({ length: 4 }).map((_, i) => ({
                  label: "…",
                  value: "–",
                  color: "text-zinc-500",
                  _loading: true,
                  id: i,
                }))
              : kpis
            ).map((kpi, i) => (
              <div
                key={i}
                className={cn(
                  "px-4 py-3",
                  i < 3 && "border-r border-[var(--surface-border)]",
                )}
              >
                <p
                  className={`text-lg font-bold ${"color" in kpi ? kpi.color : "text-zinc-400"} ${loading ? "animate-pulse" : ""}`}
                >
                  {kpi.value}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {kpi.label}
                </p>
                {!loading && "sub" in kpi && kpi.sub && (
                  <p className="text-[10px] text-[var(--text-secondary)] opacity-70">
                    {kpi.sub}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Activity feed header */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-[var(--surface-border)] flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Timeline & Activity Log
            </span>
            <a
              href="/activity"
              className="text-[10px] text-violet-400 hover:underline"
            >
              View all
            </a>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="px-4 py-3 border-b border-[var(--surface-border)] animate-pulse"
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-overlay)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded bg-[var(--surface-overlay)] w-1/3" />
                      <div className="h-2.5 rounded bg-[var(--surface-overlay)] w-2/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Zap className="w-8 h-8 text-violet-500/30 mb-3" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  No activity yet
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Dispatch your first task to get started
                </p>
                <a
                  href="/tasks/new"
                  className="mt-4 px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition-colors"
                >
                  Create a task
                </a>
              </div>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 border-b border-[var(--surface-border)] hover:bg-[var(--surface-raised)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${item.agentColor} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5`}
                    >
                      {item.agentInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {item.agentName}
                        </p>
                        <span className="text-[10px] text-[var(--text-secondary)] flex-shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        {item.action}
                      </p>
                      {item.detail && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] mt-1 px-1.5 py-0.5 rounded",
                            {
                              "bg-green-500/10 text-green-400":
                                item.type === "success",
                              "bg-yellow-500/10 text-yellow-400":
                                item.type === "warning" ||
                                item.type === "pending",
                              "bg-zinc-500/10 text-zinc-400":
                                item.type === "info",
                            },
                          )}
                        >
                          {item.type === "success" && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {item.type === "warning" && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {item.type === "pending" && (
                            <Clock className="w-3 h-3" />
                          )}
                          {item.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Context panel */}
        <div className="w-60 flex-shrink-0 border-l border-[var(--surface-border)] flex flex-col overflow-hidden">
          {/* Quick nav */}
          <div className="px-3 py-2.5 border-b border-[var(--surface-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
              Quick Actions
            </p>
            <div className="space-y-1">
              {[
                {
                  icon: CheckCircle2,
                  label: "New Task",
                  href: "/tasks/new",
                  color: "text-blue-400",
                },
                {
                  icon: Zap,
                  label: "New Workflow",
                  href: "/workflows/new",
                  color: "text-violet-400",
                },
                {
                  icon: Users,
                  label: "Delegate",
                  href: "/tasks/delegate",
                  color: "text-emerald-400",
                },
                {
                  icon: FileText,
                  label: "New Project",
                  href: "/projects",
                  color: "text-amber-400",
                },
              ].map(({ icon: Icon, label, href, color }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* System Alerts */}
          <div className="px-3 py-2.5 border-b border-[var(--surface-border)] flex-shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
              System Alerts
            </p>
            {agents.filter((a) => a.status === "waiting").length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All systems nominal
              </div>
            ) : (
              agents
                .filter((a) => a.status === "waiting")
                .map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-start gap-2 text-xs text-yellow-400 mb-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{agent.name}: Awaiting approval</span>
                  </div>
                ))
            )}
          </div>

          {/* ── Maturity Card ─────────────────────────────────── */}
          {maturity && (
            <div className="px-3 py-2.5 border-b border-[var(--surface-border)] flex-shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                {maturity.overallScore >= 70 ? (
                  <Star className="w-3 h-3 text-amber-400" />
                ) : maturity.overallScore >= 40 ? (
                  <Link2 className="w-3 h-3 text-violet-400" />
                ) : (
                  <Bot className="w-3 h-3 text-zinc-400" />
                )}
                AI Maturity
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {maturity.tier}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {maturity.overallScore}/100
                </span>
              </div>
              {/* Overall progress bar */}
              <div className="h-1.5 rounded-full bg-zinc-800 mb-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all"
                  style={{ width: `${maturity.overallScore}%` }}
                />
              </div>
              {/* Mini dimension bars */}
              <div className="space-y-1">
                {maturity.dimensions.slice(0, 3).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--text-secondary)] w-20 truncate">
                      {d.name}
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500/60"
                        style={{ width: `${d.score}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--text-secondary)] w-5 text-right">
                      {d.score}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="/analytics"
                className="mt-1.5 block text-[10px] text-violet-400 hover:underline"
              >
                Full report →
              </a>
            </div>
          )}

          {/* Navigation shortcuts */}
          <div className="flex-1 overflow-y-auto hide-scrollbar px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
              Navigate
            </p>
            {[
              { icon: TrendingUp, label: "Strategy", href: "/strategy" },
              { icon: DollarSign, label: "Costs", href: "/costs" },
              { icon: Activity, label: "Analytics", href: "/analytics" },
              { icon: CheckCircle2, label: "Approvals", href: "/approvals" },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
                <ChevronRight className="w-3 h-3 opacity-40" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
