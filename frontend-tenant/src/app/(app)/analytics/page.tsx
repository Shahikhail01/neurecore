"use client";

import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { SectionCard } from "@/components/layout/SectionCard";
import { KPIMiniTile } from "@/components/ai/KPIMiniTile";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart, type DonutSlice } from "@/components/charts/DonutChart";
import { useDashboardKpis } from "@/hooks/useDashboardKpis";
import { useChartData } from "@/hooks/useChartData";
import { useAgentMetrics } from "@/hooks/useAgentMetrics";
import { useTimeRange } from "@/hooks/useTimeRange";
import type { BarDataPoint, ChartTimeRange } from "@/types/ui.types";

const TIME_RANGE_OPTIONS: { label: string; value: ChartTimeRange }[] = [
  { label: "1H", value: "1h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

export default function AnalyticsPage() {
  const { range, setRange } = useTimeRange("7d");
  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { data: chartData, loading: chartLoading } = useChartData(
    "tasks",
    range,
  );
  const { metrics: agentMetrics, loading: metricsLoading } = useAgentMetrics();

  // Agent success rate bar chart data
  const agentBarData: BarDataPoint[] = agentMetrics.slice(0, 8).map((m) => ({
    label: m.agentName,
    value: m.successRate,
    color:
      m.successRate >= 80
        ? "var(--status-profit)"
        : m.successRate >= 50
          ? "var(--status-warn)"
          : "var(--status-risk)",
  }));

  // Task status donut — only show slices with data
  const taskDonutData: DonutSlice[] = kpis
    ? [
        {
          label: "Completed",
          value: kpis.completedToday ?? 0,
          color: "var(--status-profit)",
        },
        {
          label: "Running",
          value: kpis.runningTasks ?? 0,
          color: "var(--status-ops)",
        },
        {
          label: "Failed",
          value: kpis.failedTasks ?? 0,
          color: "var(--status-risk)",
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Analytics"
        icon={<BarChart2 className="w-4 h-4" />}
        subtitle="Performance overview of your AI workforce"
        actions={
          <div className="flex rounded-input overflow-hidden border border-surface-border text-caption">
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={cn(
                  "px-2.5 py-1 transition-colors duration-fast",
                  range === opt.value
                    ? "bg-brand text-brand-foreground"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <PageContent className="space-y-5">
        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIMiniTile
            value={kpisLoading ? "—" : (kpis?.activeAgents ?? 0)}
            label="Active agents"
            color="profit"
            trend={
              kpis?.activeAgentsDelta !== undefined
                ? kpis.activeAgentsDelta >= 0
                  ? "up"
                  : "down"
                : undefined
            }
          />
          <KPIMiniTile
            value={kpisLoading ? "—" : (kpis?.runningTasks ?? 0)}
            label="Running tasks"
            color="ops"
            trend={
              kpis?.runningTasksDelta !== undefined
                ? kpis.runningTasksDelta >= 0
                  ? "up"
                  : "down"
                : undefined
            }
          />
          <KPIMiniTile
            value={kpisLoading ? "—" : (kpis?.completedToday ?? 0)}
            label="Completed today"
            color="profit"
            trend={
              kpis?.completedTodayDelta !== undefined
                ? kpis.completedTodayDelta >= 0
                  ? "up"
                  : "down"
                : undefined
            }
          />
          <KPIMiniTile
            value={kpisLoading ? "—" : `${kpis?.successRate ?? 0}%`}
            label="Success rate"
            color={!kpis || (kpis.successRate ?? 0) >= 80 ? "profit" : "risk"}
            trend={
              kpis?.successRateDelta !== undefined
                ? kpis.successRateDelta >= 0
                  ? "up"
                  : "down"
                : undefined
            }
          />
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="Task Activity Over Time">
            <AreaChart
              data={chartData}
              loading={chartLoading}
              height={180}
              color="var(--brand)"
              label="Tasks"
            />
          </SectionCard>

          <SectionCard title="Agent Success Rates">
            {metricsLoading || agentBarData.length === 0 ? (
              <div className="h-44 rounded-input bg-surface-overlay animate-pulse" />
            ) : (
              <BarChart
                data={agentBarData}
                loading={metricsLoading}
                height={180}
                color="var(--brand)"
                label="Success %"
                formatValue={(v) => `${v.toFixed(0)}%`}
              />
            )}
          </SectionCard>
        </div>

        {/* ── Donut: task distribution ─────────────────────────────────────── */}
        {taskDonutData.length > 0 && (
          <SectionCard title="Task Distribution">
            <DonutChart
              data={taskDonutData}
              loading={kpisLoading}
              height={200}
              nameKey="label"
            />
          </SectionCard>
        )}
      </PageContent>
    </div>
  );
}
