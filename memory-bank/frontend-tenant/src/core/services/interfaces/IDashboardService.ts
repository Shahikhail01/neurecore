// ─── IDashboardService.ts ─────────────────────────────────────────────────────
// ISP: Only the methods the Dashboard feature needs — no fat contract.
// DIP: Dashboard page depends on this, not on concrete implementations.

import type { CompanyMetrics, ActivityEvent, TimeRange, Agent, Task, Workflow } from '@/shared/types/domain.types';

export interface DailyBriefing {
  headline: string;
  topWins: string[];
  topAlerts: string[];
  teamMood: string;
  autonomyRate: number;   // % handled without human intervention
  generatedAt: string;
}

export interface IDashboardService {
  getCompanyMetrics(timeRange: TimeRange): Promise<CompanyMetrics>;
  getActivityTimeline(limit?: number): Promise<ActivityEvent[]>;
  getDailyBriefing(): Promise<DailyBriefing>;
  getTopAgents(limit?: number): Promise<Agent[]>;
  getPendingWorkItems(): Promise<{ tasks: Task[]; workflows: Workflow[]; pendingApprovals: number }>;
}
