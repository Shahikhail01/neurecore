"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign,
  Zap,
  BarChart2,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  timestamp: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

interface CostSummary {
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
  byModel?: Record<string, number>;
  byProvider?: Record<string, number>;
  timeline?: TimelinePoint[];
}

interface AgentCostRow {
  agentId: string;
  agentName?: string;
  totalCostCents: number;
  recordCount: number;
}

interface BudgetPolicy {
  id: string;
  scope: string;
  scopeId?: string;
  limitCents: number;
  windowDays: number;
  isActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtK = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

function dateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

// ─── Cards component ──────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-surface-border bg-surface-overlay p-card">
      <div className="flex items-center justify-between">
        <span className="text-caption text-text-secondary">{label}</span>
        <span
          className={cn(
            "w-7 h-7 rounded-input flex items-center justify-center",
            accent ?? "bg-surface-muted",
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "text-2xl font-bold tracking-tight",
          accent ? "text-status-profit" : "text-text-primary",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-micro text-text-secondary">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [agentRows, setAgentRows] = useState<AgentCostRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);

      const { startDate, endDate } = dateRange(rangeDays);

      const [summaryRes, agentRes, budgetRes] = await Promise.allSettled([
        api.get("/costs/summary", { params: { startDate, endDate } }),
        api.get("/costs/records", {
          params: { startDate, endDate, limit: 200 },
        }),
        api.get("/costs/budgets"),
      ]);

      if (summaryRes.status === "fulfilled") {
        const d = summaryRes.value.data;
        setSummary(d?.data?.data ?? d?.data ?? d ?? null);
      }

      if (agentRes.status === "fulfilled") {
        const list: unknown[] = (() => {
          const d = agentRes.value.data;
          const raw = d?.data?.data ?? d?.data ?? d ?? [];
          return Array.isArray(raw) ? raw : [];
        })();

        // Aggregate by agentId client-side
        const map = new Map<string, AgentCostRow>();
        for (const r of list) {
          const rec = r as Record<string, unknown>;
          const id = String(rec.agentId ?? "unknown");
          const prev = map.get(id) ?? {
            agentId: id,
            agentName: rec.agentName as string | undefined,
            totalCostCents: 0,
            recordCount: 0,
          };
          map.set(id, {
            ...prev,
            totalCostCents: prev.totalCostCents + (Number(rec.costCents) || 0),
            recordCount: prev.recordCount + 1,
          });
        }
        setAgentRows(
          [...map.values()].sort((a, b) => b.totalCostCents - a.totalCostCents),
        );
      }

      if (budgetRes.status === "fulfilled") {
        const d = budgetRes.value.data;
        const raw = d?.data?.data ?? d?.data ?? d ?? [];
        setBudgets(Array.isArray(raw) ? (raw as BudgetPolicy[]) : []);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [rangeDays],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Build chart data from timeline
  const chartData = (summary?.timeline ?? []).map((p) => ({
    date: new Date(p.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    cost: +(p.costCents / 100).toFixed(4),
    tokens: p.inputTokens + p.outputTokens,
  }));

  const totalTokens =
    (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  const topModel = summary?.byModel
    ? (Object.entries(summary.byModel).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "—")
    : "—";

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Cost Dashboard"
        icon={<DollarSign className="w-4 h-4" />}
        subtitle="AI token usage & budget tracking"
        actions={
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="flex rounded-input overflow-hidden border border-surface-border text-caption">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setRangeDays(d)}
                  className={cn(
                    "px-2.5 py-1 transition-colors duration-fast",
                    rangeDays === d
                      ? "bg-brand text-brand-foreground"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="p-1.5 rounded-input border border-surface-border text-text-secondary hover:text-text-primary transition-colors duration-fast"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}
              />
            </button>
          </div>
        }
      />

      <PageContent className="space-y-5">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-card bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<DollarSign className="w-3.5 h-3.5 text-status-profit" />}
                label={`Total spend (${rangeDays}d)`}
                value={fmtUsd(summary?.totalCostCents ?? 0)}
                sub={`${summary?.recordCount ?? 0} runs`}
                accent="bg-status-profit/10"
              />
              <StatCard
                icon={<Zap className="w-3.5 h-3.5 text-status-warn" />}
                label="Total tokens"
                value={fmtK(totalTokens)}
                sub={`In: ${fmtK(summary?.totalInputTokens ?? 0)} · Out: ${fmtK(summary?.totalOutputTokens ?? 0)}`}
              />
              <StatCard
                icon={<BarChart2 className="w-3.5 h-3.5 text-status-ops" />}
                label="Top model"
                value={topModel}
                sub={
                  summary?.byModel?.[topModel]
                    ? fmtUsd(summary.byModel[topModel])
                    : undefined
                }
              />
              <StatCard
                icon={<ShieldAlert className="w-3.5 h-3.5 text-brand" />}
                label="Budget policies"
                value={String(budgets.length)}
                sub={`${budgets.filter((b) => b.isActive).length} active`}
              />
            </div>

            {/* ── Spend trend chart ── */}
            {chartData.length > 0 && (
              <div className="rounded-card border border-surface-border bg-surface-overlay p-card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-3.5 h-3.5 text-status-profit" />
                  <span className="text-caption font-medium text-text-primary">
                    Spend Trend
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="costGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#22c55e"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#22c55e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-overlay)",
                        border: "1px solid var(--surface-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [
                        `$${Number(v).toFixed(4)}`,
                        "Cost",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#costGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Per-agent cost table ── */}
            {agentRows.length > 0 && (
              <div className="rounded-card border border-surface-border bg-surface-overlay overflow-hidden">
                <div className="px-card py-3 border-b border-surface-border">
                  <span className="text-caption font-medium text-text-primary">
                    Cost by Agent
                  </span>
                </div>
                <table className="w-full text-caption">
                  <thead>
                    <tr className="border-b border-surface-border text-text-secondary">
                      <th className="text-left px-card py-2 font-medium">
                        Agent
                      </th>
                      <th className="text-right px-card py-2 font-medium">
                        Runs
                      </th>
                      <th className="text-right px-card py-2 font-medium">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((row) => (
                      <tr
                        key={row.agentId}
                        className="border-b border-surface-border/50 hover:bg-surface-border/20 transition-colors duration-fast"
                      >
                        <td className="px-card py-2.5 text-text-primary font-mono">
                          {row.agentName ?? row.agentId.slice(0, 12) + "…"}
                        </td>
                        <td className="px-card py-2.5 text-right text-text-secondary">
                          {row.recordCount}
                        </td>
                        <td className="px-card py-2.5 text-right font-semibold text-status-profit">
                          {fmtUsd(row.totalCostCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Budget policies ── */}
            {budgets.length > 0 && (
              <div className="rounded-card border border-surface-border bg-surface-overlay overflow-hidden">
                <div className="px-card py-3 border-b border-surface-border">
                  <span className="text-caption font-medium text-text-primary">
                    Budget Policies
                  </span>
                </div>
                <table className="w-full text-caption">
                  <thead>
                    <tr className="border-b border-surface-border text-text-secondary">
                      <th className="text-left px-card py-2 font-medium">
                        Scope
                      </th>
                      <th className="text-right px-card py-2 font-medium">
                        Limit
                      </th>
                      <th className="text-right px-card py-2 font-medium">
                        Window
                      </th>
                      <th className="text-right px-card py-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-surface-border/50"
                      >
                        <td className="px-card py-2.5 text-text-primary">
                          <span className="capitalize">
                            {b.scope.toLowerCase()}
                          </span>
                          {b.scopeId && (
                            <span className="ml-1 text-text-secondary font-mono">
                              {b.scopeId.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-card py-2.5 text-right text-text-primary">
                          {fmtUsd(b.limitCents)}
                        </td>
                        <td className="px-card py-2.5 text-right text-text-secondary">
                          {b.windowDays}d
                        </td>
                        <td className="px-card py-2.5 text-right">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-input text-micro font-semibold",
                              b.isActive
                                ? "bg-status-profit/10 text-status-profit"
                                : "bg-surface-muted text-text-secondary",
                            )}
                          >
                            {b.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Model breakdown ── */}
            {summary?.byModel && Object.keys(summary.byModel).length > 0 && (
              <div className="rounded-card border border-surface-border bg-surface-overlay p-card">
                <p className="text-caption font-medium text-text-primary mb-3">
                  Cost by Model
                </p>
                <div className="flex flex-col gap-2">
                  {Object.entries(summary.byModel)
                    .sort((a, b) => b[1] - a[1])
                    .map(([model, cents]) => {
                      const pct = summary.totalCostCents
                        ? Math.round((cents / summary.totalCostCents) * 100)
                        : 0;
                      return (
                        <div key={model}>
                          <div className="flex justify-between text-caption mb-1">
                            <span className="text-text-secondary">{model}</span>
                            <span className="text-text-primary font-medium">
                              {fmtUsd(cents)}{" "}
                              <span className="text-text-secondary font-normal">
                                ({pct}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-pill bg-surface-border">
                            <div
                              className="h-full rounded-pill bg-brand transition-all duration-normal"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {!summary && !loading && (
              <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                <DollarSign className="w-8 h-8 text-text-secondary" />
                <p className="text-body text-text-secondary">
                  No cost data yet
                </p>
              </div>
            )}
          </>
        )}
      </PageContent>
    </div>
  );
}
