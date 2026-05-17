// ─── IAnalyticsService.ts ────────────────────────────────────────────────────
// ISP: Analytics / metrics queries only.

export interface OverviewMetrics {
  totalAgents: number;
  activeAgents: number;
  tasksCompleted24h: number;
  tasksPending: number;
  avgResponseTimeMs: number;
  successRate: number;           // 0–100
  teamHarmonyScore: number;      // 0–100
}

export interface TrendPoint {
  timestamp: string;
  value: number;
}

export interface AgentPerformanceTrend {
  agentId: string;
  agentName: string;
  points: TrendPoint[];
}

export interface DepartmentMetric {
  departmentId: string;
  departmentName: string;
  agentCount: number;
  tasksCompleted: number;
  avgSuccessRate: number;
  harmonyScore: number;
}

export interface IAnalyticsService {
  getOverviewMetrics(): Promise<OverviewMetrics>;
  getAgentPerformanceTrends(
    agentIds: string[],
    from: Date,
    to: Date,
    granularity?: 'hour' | 'day' | 'week'
  ): Promise<AgentPerformanceTrend[]>;
  getTaskCompletionTrends(
    from: Date,
    to: Date,
    granularity?: 'hour' | 'day' | 'week'
  ): Promise<TrendPoint[]>;
  getDepartmentMetrics(): Promise<DepartmentMetric[]>;
  calculateTeamHarmony(agentIds: string[]): Promise<number>;
  calculateAvgCompletionTime(agentId?: string): Promise<number>;
}
