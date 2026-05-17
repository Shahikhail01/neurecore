// ─── AgentRepository.ts ──────────────────────────────────────────────────────
// DIP: depends on IApiClient, AgentAdapter, ICacheManager — all abstractions.
// SRP: Only manages Agent data access.
// LSP: Substitutable for any IRepository<Agent>.

import { BaseRepository, type QueryParams } from '@/core/repositories/interfaces/IRepository';
import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type { ICacheManager } from '@/core/services/api/interfaces/ICacheManager';
import { responseTransformer } from '@/core/services/api/transformers/ResponseTransformer';
import { type AgentAdapter, type RawAgent } from '@/core/services/api/adapters/AgentAdapter';
import type { Agent } from '@/shared/types/domain.types';
import { API_ENDPOINTS } from '@/shared/constants/api-endpoints';

export type CreateAgentDto = {
  name: string;
  type: string;
  model: string;
  description?: string;
  departmentId?: string;
};

export type UpdateAgentDto = Partial<CreateAgentDto> & {
  isActive?: boolean;
  status?: string;
};

export class AgentRepository extends BaseRepository<Agent, CreateAgentDto, UpdateAgentDto> {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly adapter: AgentAdapter,
    private readonly cache: ICacheManager,
  ) {
    super();
  }

  async findAll(query?: QueryParams): Promise<{ items: Agent[]; total: number }> {
    const key = this.cacheKey('agents', query);
    const cached = this.cache.get<{ items: Agent[]; total: number }>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<unknown>(API_ENDPOINTS.AGENTS.LIST, { params: query as Record<string, string | number | boolean | undefined> });
    const { items: raw, total } = responseTransformer.unwrapList<RawAgent>(res);
    const result = { items: this.adapter.adaptMany(raw), total };

    this.cache.set(key, result, { ttl: 60 });
    return result;
  }

  async findById(id: string): Promise<Agent | null> {
    const key = this.cacheKey('agents', id);
    const cached = this.cache.get<Agent>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<RawAgent>(`${API_ENDPOINTS.AGENTS.LIST}/${id}`);
    const raw = responseTransformer.unwrapItem(res);
    const agent = this.adapter.adapt(raw);

    this.cache.set(key, agent, { ttl: 60 });
    return agent;
  }

  async create(data: CreateAgentDto): Promise<Agent> {
    const res = await this.apiClient.post<RawAgent>(API_ENDPOINTS.AGENTS.LIST, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('agents');
    return this.adapter.adapt(raw);
  }

  async update(id: string, data: UpdateAgentDto): Promise<Agent> {
    const res = await this.apiClient.patch<RawAgent>(`${API_ENDPOINTS.AGENTS.LIST}/${id}`, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('agents');
    return this.adapter.adapt(raw);
  }

  async remove(id: string): Promise<void> {
    await this.apiClient.delete(`${API_ENDPOINTS.AGENTS.LIST}/${id}`);
    this.cache.invalidate('agents');
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
import { restClient } from '@/core/services/api/clients/RestClient';
import { agentAdapter } from '@/core/services/api/adapters/AgentAdapter';
import { cacheManager } from '@/core/infrastructure/cache/CacheManager';

export const agentRepository = new AgentRepository(restClient, agentAdapter, cacheManager);
