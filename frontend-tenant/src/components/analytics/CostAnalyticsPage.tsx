/**
 * Cost Analytics Detail Page - Phase 6
 *
 * Detailed cost breakdown page showing per-agent and per-task costs.
 * Features cost trends, budget alerts, and detailed analysis.
 *
 * Components:
 * - Per-agent cost breakdown table
 * - Cost trend graph
 * - Per-task cost summary
 * - Budget allocation cards
 * - Cost forecast
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Download,
  Filter,
} from "lucide-react";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { AnalyticsChartsGrid, AnalyticsChartItem } from "./AnalyticsChartsGrid";
import { LineChart } from "@/components/charts/LineChart";
import { format } from "date-fns";

/**
 * Cost Analytics Page Component
 *
 * Detailed cost analysis showing:
 * - Per-agent cost breakdown
 * - Per-task cost summary
 * - Cost trends and forecasting
 * - Budget alerts and limits
 * - Agent and department comparisons
 *
 * @example
 * <CostAnalyticsPage />
 */
export function CostAnalyticsPage() {
  const {
    agentCostBreakdown,
    taskCostSummary,
    budgetAlerts,
    costByAgentData,
    totalCostThisMonth,
    isLoading,
    fetchCostAnalytics,
  } = useAnalyticsStore();

  const [sortField, setSortField] = React.useState<"cost" | "taskCount">(
    "cost",
  );
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc",
  );

  React.useEffect(() => {
    fetchCostAnalytics();
  }, [fetchCostAnalytics]);

  // Convert breakdown object to sorted array
  const agentBreakdownArray = React.useMemo(() => {
    return Object.values(agentCostBreakdown).sort((a, b) => {
      const aVal = sortField === "cost" ? a.totalCost : a.taskCount;
      const bVal = sortField === "cost" ? b.totalCost : b.taskCount;
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [agentCostBreakdown, sortField, sortDirection]);

  const handleSort = (field: "cost" | "taskCount") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const avgCostPerTask = (
    totalCostThisMonth / (taskCostSummary.length || 1)
  ).toFixed(2);
  const highestCostAgent = agentBreakdownArray[0];
  const costTrendAvg =
    agentBreakdownArray.reduce((sum, a) => sum + a.costTrend, 0) /
    (agentBreakdownArray.length || 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Cost Analytics
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Detailed cost breakdown by agent and task
          </p>
        </div>
        <button
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "text-white bg-accent-primary hover:bg-accent-primary/90",
            "transition-colors flex items-center gap-2",
          )}
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-surface-border bg-surface-raised">
          <p className="text-xs text-text-muted">Total Cost This Month</p>
          <p className="text-2xl font-bold text-accent-primary mt-2">
            ${totalCostThisMonth.toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-lg border border-surface-border bg-surface-raised">
          <p className="text-xs text-text-muted">Avg Cost per Task</p>
          <p className="text-2xl font-bold text-text-primary mt-2">
            ${avgCostPerTask}
          </p>
        </div>

        <div className="p-4 rounded-lg border border-surface-border bg-surface-raised">
          <p className="text-xs text-text-muted">Highest Cost Agent</p>
          <p className="text-lg font-bold text-text-primary mt-2">
            {highestCostAgent?.agentName || "N/A"}
          </p>
          <p className="text-xs text-text-muted mt-1">
            ${highestCostAgent?.totalCost.toFixed(2)}
          </p>
        </div>

        <div
          className={cn(
            "p-4 rounded-lg border",
            costTrendAvg > 0
              ? "border-status-danger bg-status-danger/10"
              : "border-status-success bg-status-success/10",
          )}
        >
          <p className="text-xs text-text-muted">Avg Cost Trend</p>
          <div className="flex items-center gap-2 mt-2">
            {costTrendAvg > 0 ? (
              <TrendingUp className="w-5 h-5 text-status-danger" />
            ) : (
              <TrendingDown className="w-5 h-5 text-status-success" />
            )}
            <p
              className={cn(
                "text-2xl font-bold",
                costTrendAvg > 0 ? "text-status-danger" : "text-status-success",
              )}
            >
              {costTrendAvg > 0 ? "+" : ""}
              {costTrendAvg.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <div className="p-4 rounded-lg bg-status-danger/10 border border-status-danger/30">
          <h3 className="font-semibold text-status-danger mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Budget Alerts ({budgetAlerts.length})
          </h3>
          <div className="space-y-2">
            {budgetAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-lg bg-surface-base border border-status-danger/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">
                      {alert.entityName}
                    </p>
                    <p className="text-xs text-text-muted">
                      ${alert.current.toFixed(2)} / ${alert.limit.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-status-danger">
                      {alert.percentageUsed}%
                    </p>
                    <div className="w-24 h-2 rounded-full bg-surface-overlay mt-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          alert.percentageUsed > 80
                            ? "bg-status-danger"
                            : alert.percentageUsed > 60
                              ? "bg-status-warning"
                              : "bg-status-success",
                        )}
                        style={{
                          width: `${Math.min(alert.percentageUsed, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <AnalyticsChartsGrid>
        {/* Cost Trend */}
        <AnalyticsChartItem title="Cost Trend" subtitle="Last 30 days" span={2}>
          <LineChart
            data={costByAgentData.map((item) => ({
              ts: new Date().toISOString(),
              value: item.cost,
            }))}
            color="#ef4444"
            label="Cost ($)"
            height={250}
          />
        </AnalyticsChartItem>

        {/* Tasks Overview */}
        <AnalyticsChartItem title="Tasks Summary" subtitle="Current period">
          <div className="flex flex-col justify-center h-[250px] gap-4">
            <div>
              <p className="text-xs text-text-muted">Total Tasks</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {taskCostSummary.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Completed</p>
              <p className="text-lg font-semibold text-status-success">
                {taskCostSummary.filter((t) => t.status === "completed").length}
              </p>
            </div>
          </div>
        </AnalyticsChartItem>
      </AnalyticsChartsGrid>

      {/* Per-Agent Breakdown Table */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Per-Agent Cost Breakdown
        </h2>
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-overlay">
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Agent
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Role
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold text-text-primary cursor-pointer hover:bg-surface-base"
                  onClick={() => handleSort("cost")}
                >
                  Total Cost{" "}
                  {sortField === "cost" &&
                    (sortDirection === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Tokens
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  API Calls
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Exec Time
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold text-text-primary cursor-pointer hover:bg-surface-base"
                  onClick={() => handleSort("taskCount")}
                >
                  Tasks{" "}
                  {sortField === "taskCount" &&
                    (sortDirection === "desc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {agentBreakdownArray.map((agent, idx) => (
                <tr
                  key={agent.agentName}
                  className={cn(
                    "border-b border-surface-border last:border-0",
                    idx % 2 === 0 ? "bg-surface-base" : "bg-surface-overlay/50",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {agent.agentName}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{agent.role}</td>
                  <td className="px-4 py-3 text-right font-semibold text-accent-primary">
                    ${agent.totalCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    ${agent.tokensCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    ${agent.apiCallsCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {(agent.executionTime / 60).toFixed(1)}m
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {agent.taskCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "font-semibold",
                        agent.costTrend > 0
                          ? "text-status-danger flex items-center justify-end gap-1"
                          : "text-status-success flex items-center justify-end gap-1",
                      )}
                    >
                      {agent.costTrend > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {agent.costTrend > 0 ? "+" : ""}
                      {agent.costTrend.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Task Cost Summary Table */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Recent Task Costs
        </h2>
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-overlay">
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Task
                </th>
                <th className="px-4 py-3 text-left font-semibold text-text-primary">
                  Agent
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Cost
                </th>
                <th className="px-4 py-3 text-right font-semibold text-text-primary">
                  Execution Time
                </th>
                <th className="px-4 py-3 text-center font-semibold text-text-primary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {taskCostSummary.slice(0, 10).map((task, idx) => (
                <tr
                  key={task.taskId}
                  className={cn(
                    "border-b border-surface-border last:border-0",
                    idx % 2 === 0 ? "bg-surface-base" : "bg-surface-overlay/50",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {task.taskName}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {task.agentName}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-accent-primary">
                    ${task.cost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {(task.executionTime / 1000).toFixed(2)}s
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-semibold",
                        task.status === "completed"
                          ? "bg-status-success/20 text-status-success"
                          : task.status === "pending"
                            ? "bg-status-warning/20 text-status-warning"
                            : "bg-status-danger/20 text-status-danger",
                      )}
                    >
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export type {};
