/**
 * Analytics Dashboard - Phase 6
 *
 * Main analytics page showing KPI cards, charts, and trends.
 * Features filterable data by date range, department, agent, and approval status.
 *
 * Components:
 * - KPI cards (total agents, active tasks, pending approvals, avg cost)
 * - Agent utilization chart (24-hour trend)
 * - Cost breakdown by agent and department
 * - Approval turnaround time trend
 * - Task completion rate trend
 * - Budget alerts
 *
 * @fileoverview Main analytics dashboard for Phase 6
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  DollarSign,
  Zap,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { DateRangeFilter } from "./DateRangeFilter";
import { AnalyticsChartsGrid, AnalyticsChartItem } from "./AnalyticsChartsGrid";
import { KpiTile } from "@/components/kpi/KpiTile";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart as BarChartComponent } from "@/components/charts/BarChart";

/**
 * Analytics Dashboard Component
 *
 * Comprehensive analytics view with:
 * - KPI summary cards
 * - Interactive charts with drill-down capability
 * - Date range filtering
 * - Department and agent filtering
 * - Budget alerts and warnings
 *
 * @example
 * <AnalyticsDashboard />
 */
export function AnalyticsDashboard() {
  const {
    totalAgents,
    activeTasks,
    pendingApprovals,
    avgExecutionCost,
    totalCostThisMonth,
    approvalTurnaroundSeconds,
    dateRange,
    costByAgentData,
    costByDepartmentData,
    agentUtilizationData,
    approvalTurnaroundData,
    taskCompletionRateData,
    budgetAlerts,
    isLoading,
    error,
    setDateRange,
    fetchAnalytics,
    clearError,
  } = useAnalyticsStore();

  const [showAlerts, setShowAlerts] = React.useState(true);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const kpiCards = [
    {
      label: "Total Agents",
      value: totalAgents.toString(),
      icon: <Zap className="w-5 h-5" />,
      color: "strategy" as const,
    },
    {
      label: "Active Tasks",
      value: activeTasks.toString(),
      icon: <BarChart3 className="w-5 h-5" />,
      color: "ops" as const,
    },
    {
      label: "Pending Approvals",
      value: pendingApprovals.toString(),
      icon: <Clock className="w-5 h-5" />,
      color: "warn" as const,
    },
    {
      label: "Avg Execution Cost",
      value: `$${avgExecutionCost.toFixed(2)}`,
      icon: <DollarSign className="w-5 h-5" />,
      color: "profit" as const,
    },
  ];

  // Convert approval turnaround from seconds to hours for display
  const turnaroundHours = (approvalTurnaroundSeconds / 3600).toFixed(1);

  // Transform data for charts to match expected types
  const agentUtilizationChartData = agentUtilizationData.map((d) => ({
    ts: d.timestamp,
    value: d.utilization,
  }));

  const costByAgentChartData = costByAgentData.map((d) => ({
    label: d.agentName,
    value: d.cost,
  }));

  const approvalTurnaroundChartData = approvalTurnaroundData.map((d) => ({
    ts: d.timestamp,
    value: d.hours,
  }));

  const costByDepartmentChartData = costByDepartmentData.map((d) => ({
    label: d.departmentName,
    value: d.cost,
  }));

  const taskCompletionRateChartData = taskCompletionRateData.map((d) => ({
    ts: d.timestamp,
    value: d.completionRate,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-muted mt-1">
          Monitor agent performance, costs, and system metrics
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-status-danger/10 border border-status-danger/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-status-danger">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-status-danger hover:bg-status-danger/10 p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Budget Alerts */}
      {showAlerts && budgetAlerts.length > 0 && (
        <div className="p-4 rounded-lg bg-warning-light border border-warning">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-warning mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Budget Alerts
              </h3>
              <div className="space-y-1 text-sm text-text-primary">
                {budgetAlerts.map((alert) => (
                  <p key={alert.id}>
                    <span className="font-medium">{alert.entityName}</span> is{" "}
                    {alert.percentageUsed}% of monthly budget
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-warning hover:bg-warning/10 p-1 rounded transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div
        className={cn(
          "p-4 rounded-lg border border-surface-border bg-surface-base",
          "space-y-4",
        )}
      >
        <h3 className="font-semibold text-text-primary">Filters</h3>
        <DateRangeFilter
          onDateRangeChange={setDateRange}
          currentFrom={dateRange.from}
          currentTo={dateRange.to}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <KpiTile
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Additional KPI: Total Cost This Month */}
      <div className="p-4 rounded-lg border border-surface-border bg-surface-raised">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted">Total Cost This Month</p>
            <p className="text-3xl font-bold text-accent-primary mt-1">
              ${totalCostThisMonth.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">Avg Turnaround</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {turnaroundHours}h
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <AnalyticsChartsGrid>
        {/* Agent Utilization */}
        <AnalyticsChartItem
          title="Agent Utilization"
          subtitle="Last 24 hours"
          isLoading={isLoading}
          span={2}
        >
          <LineChart
            data={agentUtilizationChartData}
            color="#7c3aed"
            label="Utilization %"
            height={250}
          />
        </AnalyticsChartItem>

        {/* Budget Alerts Count */}
        <AnalyticsChartItem
          title="Status"
          subtitle={`${budgetAlerts.length} alerts`}
        >
          <div className="flex flex-col justify-center items-center h-[250px] gap-4">
            <div
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center",
                budgetAlerts.length > 0
                  ? "bg-warning-light text-warning"
                  : "bg-status-success/10 text-status-success",
              )}
            >
              {budgetAlerts.length > 0 ? (
                <AlertTriangle className="w-10 h-10" />
              ) : (
                <TrendingUp className="w-10 h-10" />
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">
                {budgetAlerts.length}
              </p>
              <p className="text-xs text-text-muted">
                {budgetAlerts.length === 1 ? "Alert" : "Alerts"}
              </p>
            </div>
          </div>
        </AnalyticsChartItem>

        {/* Cost by Agent */}
        <AnalyticsChartItem
          title="Cost by Agent"
          subtitle="Current period"
          isLoading={isLoading}
          span={2}
        >
          <BarChartComponent
            data={costByAgentChartData}
            xKey="label"
            color="#ef4444"
            height={250}
          />
        </AnalyticsChartItem>

        {/* Approval Turnaround */}
        <AnalyticsChartItem
          title="Approval Turnaround"
          subtitle="Last 30 days"
          isLoading={isLoading}
        >
          <LineChart
            data={approvalTurnaroundChartData}
            color="#f59e0b"
            label="Hours"
            height={250}
          />
        </AnalyticsChartItem>

        {/* Cost by Department */}
        <AnalyticsChartItem
          title="Cost by Department"
          subtitle="Current period"
          isLoading={isLoading}
        >
          <BarChartComponent
            data={costByDepartmentChartData}
            xKey="label"
            color="#06b6d4"
            height={250}
          />
        </AnalyticsChartItem>

        {/* Task Completion Rate */}
        <AnalyticsChartItem
          title="Task Completion Rate"
          subtitle="Last 30 days"
          isLoading={isLoading}
        >
          <LineChart
            data={taskCompletionRateChartData}
            color="#16a34a"
            label="Completion %"
            height={250}
          />
        </AnalyticsChartItem>
      </AnalyticsChartsGrid>

      {/* Summary Footer */}
      <div
        className={cn(
          "p-4 rounded-lg border border-surface-border bg-surface-overlay",
          "flex items-center justify-between",
        )}
      >
        <div>
          <p className="text-sm text-text-muted">Period Summary</p>
          <p className="text-text-primary font-medium mt-1">
            {dateRange.from.toLocaleDateString()} -{" "}
            {dateRange.to.toLocaleDateString()}
          </p>
        </div>
        <button
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "text-accent-primary hover:bg-accent-primary/10",
            "transition-colors flex items-center gap-2",
          )}
        >
          Export Report
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export type {};
