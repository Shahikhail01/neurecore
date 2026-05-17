// ─── IAgentService.ts ────────────────────────────────────────────────────────
// ISP: Agent business operations only — settings/training live in Settings hub.
// DIP: Features depend on this abstraction, not on AgentRepository directly.

import type { Agent, AgentPerformance, ExecutionLog, TimeRange } from '@/shared/types/domain.types';
import type { UpdateAgentDto } from '@/core/repositories/AgentRepository';

export interface AgentFilters {
  status?: string;
  departmentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AgentPerformanceReport {
  agentId: string;
  agentName: string;
  period: TimeRange;
  performance: AgentPerformance;
  trend: 'improving' | 'declining' | 'stable';
  topTasks: string[];
}

export interface IAgentService {
  listAgents(filters?: AgentFilters): Promise<{ agents: Agent[]; total: number }>;
  getAgent(id: string): Promise<Agent>;
  updateAgent(id: string, data: UpdateAgentDto): Promise<Agent>;
  pauseAgent(id: string): Promise<Agent>;
  resumeAgent(id: string): Promise<Agent>;
  getPerformanceReport(agentId: string, range: TimeRange): Promise<AgentPerformanceReport>;
  getExecutionLogs(agentId: string, limit?: number): Promise<ExecutionLog[]>;
  searchAgents(query: string): Promise<Agent[]>;
}
