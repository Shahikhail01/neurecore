// ─── AgentService.ts ─────────────────────────────────────────────────────────
// SRP: Agent business operations only.
// DIP: Depends on IRepository<Agent>, not concrete AgentRepository.

import type { IAgentService, AgentFilters, AgentPerformanceReport } from '@/core/services/interfaces/IAgentService';
import type { IRepository } from '@/core/repositories/interfaces/IRepository';
import type { Agent, ExecutionLog, TimeRange } from '@/shared/types/domain.types';
import type { UpdateAgentDto } from '@/core/repositories/AgentRepository';
import { agentRepository } from '@/core/repositories/AgentRepository';
import { restClient } from '@/core/services/api/clients/RestClient';
import { responseTransformer } from '@/core/services/api/transformers/ResponseTransformer';
import { API_ENDPOINTS } from '@/shared/constants/api-endpoints';

export class AgentService implements IAgentService {
  constructor(private readonly repository: IRepository<Agent>) {}

  async listAgents(filters?: AgentFilters): Promise<{ agents: Agent[]; total: number }> {
    const { items, total } = await this.repository.findAll(
      filters as import('@/core/repositories/interfaces/IRepository').QueryParams,
    );
    return { agents: items, total };
  }

  async getAgent(id: string): Promise<Agent> {
    const agent = await this.repository.findById(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    return agent;
  }

  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent> {
    return this.repository.update(id, data as unknown as Partial<Agent>);
  }

  async pauseAgent(id: string): Promise<Agent> {
    return this.repository.update(id, { status: 'PAUSED' } as Partial<Agent>);
  }

  async resumeAgent(id: string): Promise<Agent> {
    return this.repository.update(id, { status: 'ACTIVE' } as Partial<Agent>);
  }

  async getPerformanceReport(agentId: string, range: TimeRange): Promise<AgentPerformanceReport> {
    const agent = await this.getAgent(agentId);
    // Without a timeseries endpoint, derive trend from current performance.
    const successRate = agent.performance?.successRate ?? 0;
    const trend: AgentPerformanceReport['trend'] =
      successRate >= 80 ? 'improving' : successRate >= 50 ? 'stable' : 'declining';

    return {
      agentId: agent.id,
      agentName: agent.name,
      period: range,
      performance: agent.performance,
      trend,
      topTasks: [],
    };
  }

  async getExecutionLogs(agentId: string, limit = 20): Promise<ExecutionLog[]> {
    const url = `${API_ENDPOINTS.AGENTS.LIST}/${agentId}/execution-logs`;
    const res = await restClient.get<unknown>(url, { params: { limit } });
    const { items } = responseTransformer.unwrapList<ExecutionLog>(res);
    return items;
  }

  async searchAgents(query: string): Promise<Agent[]> {
    const { agents } = await this.listAgents({ search: query, limit: 50 });
    return agents;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const agentService = new AgentService(agentRepository);
