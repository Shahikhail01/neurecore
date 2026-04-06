/**
 * Analytics Store - Phase 6
 *
 * Manages analytics dashboard state: KPI data, cost breakdowns, trends, and filters.
 * Provides real-time metrics and historical analytics for agents, departments, and approvals.
 *
 * Uses Zustand with immer middleware for immutable updates.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/**
 * Analytics state and actions interface
 */
export interface AnalyticsState {
  // KPI data
  totalAgents: number;
  activeTasks: number;
  pendingApprovals: number;
  avgExecutionCost: number;
  totalCostThisMonth: number;
  approvalTurnaroundSeconds: number;

  // Filtering state
  dateRange: { from: Date; to: Date };
  selectedDepartmentId?: string;
  selectedAgentId?: string;
  selectedApprovalStatus?: string;

  // Chart data
  costByAgentData: Array<{
    agentName: string;
    cost: number;
    taskCount: number;
  }>;
  costByDepartmentData: Array<{
    departmentName: string;
    cost: number;
    agentCount: number;
  }>;
  agentUtilizationData: Array<{ timestamp: string; utilization: number }>;
  approvalTurnaroundData: Array<{ timestamp: string; hours: number }>;
  taskCompletionRateData: Array<{ timestamp: string; completionRate: number }>;

  // Per-agent cost breakdown
  agentCostBreakdown: {
    [agentId: string]: {
      agentName: string;
      role: string;
      totalCost: number;
      tokensCost: number;
      apiCallsCost: number;
      executionTime: number;
      taskCount: number;
      costTrend: number;
    };
  };

  // Per-task cost summary
  taskCostSummary: Array<{
    taskId: string;
    taskName: string;
    agentId: string;
    agentName: string;
    cost: number;
    executionTime: number;
    status: "completed" | "pending" | "failed";
  }>;

  // Budget alerts
  budgetAlerts: Array<{
    id: string;
    type: "agent" | "department";
    entityId: string;
    entityName: string;
    percentageUsed: number;
    limit: number;
    current: number;
  }>;

  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

/**
 * Analytics actions interface
 */
export interface AnalyticsActions {
  // Data fetching
  fetchAnalytics(): Promise<void>;
  fetchCostAnalytics(agentId?: string, departmentId?: string): Promise<void>;
  fetchAgentCostBreakdown(agentId: string): Promise<void>;

  // Filtering
  setDateRange(from: Date, to: Date): void;
  setSelectedDepartment(departmentId?: string): void;
  setSelectedAgent(agentId?: string): void;
  setSelectedApprovalStatus(status?: string): void;
  resetFilters(): void;

  // UI state
  clearError(): void;
  reset(): void;
}

/**
 * Combined store interface
 */
export interface AnalyticsStore extends AnalyticsState, AnalyticsActions {}

/**
 * Mock KPI data generators
 */
const generateCostByAgentData = () => [
  { agentName: "Meeting Manager", cost: 145.32, taskCount: 87 },
  { agentName: "Email Composer", cost: 98.65, taskCount: 234 },
  { agentName: "Analytics Bot", cost: 267.43, taskCount: 45 },
  { agentName: "Sales Pipeline Bot", cost: 156.78, taskCount: 123 },
  { agentName: "Support Assistant", cost: 89.21, taskCount: 342 },
];

const generateCostByDepartmentData = () => [
  {
    departmentName: "Marketing",
    cost: 543.21,
    agentCount: 3,
  },
  {
    departmentName: "Sales",
    cost: 612.34,
    agentCount: 4,
  },
  {
    departmentName: "Support",
    cost: 287.45,
    agentCount: 2,
  },
  {
    departmentName: "Finance",
    cost: 156.78,
    agentCount: 1,
  },
];

const generateAgentUtilizationData = () => {
  const data = [];
  const now = new Date();
  for (let i = 24; i > 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      timestamp: timestamp.toISOString(),
      utilization: Math.floor(Math.random() * 100),
    });
  }
  return data;
};

const generateApprovalTurnaroundData = () => {
  const data = [];
  const now = new Date();
  for (let i = 30; i > 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: timestamp.toISOString(),
      hours: Math.random() * 24 + 2, // 2-26 hours
    });
  }
  return data;
};

const generateTaskCompletionRateData = () => {
  const data = [];
  const now = new Date();
  for (let i = 30; i > 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: timestamp.toISOString(),
      completionRate: Math.floor(Math.random() * 30 + 70), // 70-100%
    });
  }
  return data;
};

const generateAgentCostBreakdown = () => ({
  "agent-1": {
    agentName: "Meeting Manager",
    role: "Calendar Management",
    totalCost: 145.32,
    tokensCost: 89.2,
    apiCallsCost: 42.31,
    executionTime: 1243, // seconds
    taskCount: 87,
    costTrend: 8.5, // percent increase
  },
  "agent-2": {
    agentName: "Email Composer",
    role: "Communication",
    totalCost: 98.65,
    tokensCost: 61.43,
    apiCallsCost: 28.21,
    executionTime: 765,
    taskCount: 234,
    costTrend: -2.3,
  },
  "agent-3": {
    agentName: "Analytics Bot",
    role: "Data Analysis",
    totalCost: 267.43,
    tokensCost: 172.98,
    apiCallsCost: 78.45,
    executionTime: 2154,
    taskCount: 45,
    costTrend: 12.1,
  },
});

const generateTaskCostSummary = (): AnalyticsState["taskCostSummary"] => [
  {
    taskId: "task-001",
    taskName: "Weekly Status Meeting Schedule",
    agentId: "agent-1",
    agentName: "Meeting Manager",
    cost: 2.34,
    executionTime: 45,
    status: "completed",
  },
  {
    taskId: "task-002",
    taskName: "Send Weekly Newsletter",
    agentId: "agent-2",
    agentName: "Email Composer",
    cost: 1.23,
    executionTime: 120,
    status: "completed",
  },
  {
    taskId: "task-003",
    taskName: "Generate Monthly Analytics Report",
    agentId: "agent-3",
    agentName: "Analytics Bot",
    cost: 8.76,
    executionTime: 340,
    status: "completed",
  },
  {
    taskId: "task-004",
    taskName: "Update CRM with New Leads",
    agentId: "agent-4",
    agentName: "Sales Pipeline Bot",
    cost: 3.45,
    executionTime: 198,
    status: "completed",
  },
  {
    taskId: "task-005",
    taskName: "Process Support Tickets",
    agentId: "agent-5",
    agentName: "Support Assistant",
    cost: 2.1,
    executionTime: 287,
    status: "completed",
  },
];

const generateBudgetAlerts = (): AnalyticsState["budgetAlerts"] => [
  {
    id: "alert-1",
    type: "agent",
    entityId: "agent-3",
    entityName: "Analytics Bot",
    percentageUsed: 78,
    limit: 500,
    current: 267.43,
  },
  {
    id: "alert-2",
    type: "department",
    entityId: "dept-1",
    entityName: "Sales",
    percentageUsed: 65,
    limit: 1000,
    current: 612.34,
  },
];

/**
 * Create analytics store with Zustand and immer middleware
 */
export const useAnalyticsStore = create<AnalyticsStore>()(
  immer((set) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      // Initial state
      totalAgents: 5,
      activeTasks: 23,
      pendingApprovals: 7,
      avgExecutionCost: 4.23,
      totalCostThisMonth: 1599.78,
      approvalTurnaroundSeconds: 3600, // 1 hour

      dateRange: { from: thirtyDaysAgo, to: now },
      selectedDepartmentId: undefined,
      selectedAgentId: undefined,
      selectedApprovalStatus: undefined,

      costByAgentData: generateCostByAgentData(),
      costByDepartmentData: generateCostByDepartmentData(),
      agentUtilizationData: generateAgentUtilizationData(),
      approvalTurnaroundData: generateApprovalTurnaroundData(),
      taskCompletionRateData: generateTaskCompletionRateData(),

      agentCostBreakdown: generateAgentCostBreakdown(),
      taskCostSummary: generateTaskCostSummary(),
      budgetAlerts: generateBudgetAlerts(),

      isLoading: false,
      error: null,

      // Actions
      async fetchAnalytics() {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          set((state) => {
            state.costByAgentData = generateCostByAgentData();
            state.costByDepartmentData = generateCostByDepartmentData();
            state.agentUtilizationData = generateAgentUtilizationData();
            state.approvalTurnaroundData = generateApprovalTurnaroundData();
            state.taskCompletionRateData = generateTaskCompletionRateData();
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch analytics";
            state.isLoading = false;
          });
        }
      },

      async fetchCostAnalytics(agentId?: string, departmentId?: string) {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 400));

          set((state) => {
            state.taskCostSummary = generateTaskCostSummary();
            // Filter by agent/dept if provided
            if (agentId) {
              state.taskCostSummary = state.taskCostSummary.filter(
                (t) => t.agentId === agentId,
              );
            }
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch cost analytics";
            state.isLoading = false;
          });
        }
      },

      async fetchAgentCostBreakdown(agentId: string) {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 300));

          set((state) => {
            state.selectedAgentId = agentId;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch agent breakdown";
            state.isLoading = false;
          });
        }
      },

      setDateRange(from: Date, to: Date) {
        set((state) => {
          state.dateRange = { from, to };
        });
      },

      setSelectedDepartment(departmentId?: string) {
        set((state) => {
          state.selectedDepartmentId = departmentId;
        });
      },

      setSelectedAgent(agentId?: string) {
        set((state) => {
          state.selectedAgentId = agentId;
        });
      },

      setSelectedApprovalStatus(status?: string) {
        set((state) => {
          state.selectedApprovalStatus = status;
        });
      },

      resetFilters() {
        set((state) => {
          const now = new Date();
          const thirtyDaysAgo = new Date(
            now.getTime() - 30 * 24 * 60 * 60 * 1000,
          );
          state.dateRange = { from: thirtyDaysAgo, to: now };
          state.selectedDepartmentId = undefined;
          state.selectedAgentId = undefined;
          state.selectedApprovalStatus = undefined;
        });
      },

      clearError() {
        set((state) => {
          state.error = null;
        });
      },

      reset() {
        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );

        set((state) => {
          state.totalAgents = 5;
          state.activeTasks = 23;
          state.pendingApprovals = 7;
          state.avgExecutionCost = 4.23;
          state.totalCostThisMonth = 1599.78;
          state.approvalTurnaroundSeconds = 3600;
          state.dateRange = { from: thirtyDaysAgo, to: now };
          state.selectedDepartmentId = undefined;
          state.selectedAgentId = undefined;
          state.selectedApprovalStatus = undefined;
          state.costByAgentData = generateCostByAgentData();
          state.costByDepartmentData = generateCostByDepartmentData();
          state.agentUtilizationData = generateAgentUtilizationData();
          state.approvalTurnaroundData = generateApprovalTurnaroundData();
          state.taskCompletionRateData = generateTaskCompletionRateData();
          state.agentCostBreakdown = generateAgentCostBreakdown();
          state.taskCostSummary = generateTaskCostSummary();
          state.budgetAlerts = generateBudgetAlerts();
          state.isLoading = false;
          state.error = null;
        });
      },
    };
  }),
);
