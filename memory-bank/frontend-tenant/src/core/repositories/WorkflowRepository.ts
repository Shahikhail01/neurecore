// ─── WorkflowRepository.ts ────────────────────────────────────────────────────
// DIP: depends on IApiClient, WorkflowAdapter, ICacheManager abstractions.
// SRP: Only manages Workflow data access.

import { BaseRepository, type QueryParams } from '@/core/repositories/interfaces/IRepository';
import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type { ICacheManager } from '@/core/services/api/interfaces/ICacheManager';
import { responseTransformer } from '@/core/services/api/transformers/ResponseTransformer';
import { type WorkflowAdapter, type RawWorkflow } from '@/core/services/api/adapters/WorkflowAdapter';
import type { Workflow } from '@/shared/types/domain.types';
import { API_ENDPOINTS } from '@/shared/constants/api-endpoints';

export type CreateWorkflowDto = {
  name: string;
  description?: string;
  definition?: Record<string, unknown>;
};

export type UpdateWorkflowDto = Partial<CreateWorkflowDto> & {
  isActive?: boolean;
  status?: string;
};

export class WorkflowRepository extends BaseRepository<Workflow, CreateWorkflowDto, UpdateWorkflowDto> {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly adapter: WorkflowAdapter,
    private readonly cache: ICacheManager,
  ) {
    super();
  }

  async findAll(query?: QueryParams): Promise<{ items: Workflow[]; total: number }> {
    const key = this.cacheKey('workflows', query);
    const cached = this.cache.get<{ items: Workflow[]; total: number }>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<unknown>(API_ENDPOINTS.WORKFLOWS.LIST, { params: query as Record<string, string | number | boolean | undefined> });
    const { items: raw, total } = responseTransformer.unwrapList<RawWorkflow>(res);
    const result = { items: this.adapter.adaptMany(raw), total };

    this.cache.set(key, result, { ttl: 60 });
    return result;
  }

  async findById(id: string): Promise<Workflow | null> {
    const key = this.cacheKey('workflows', id);
    const cached = this.cache.get<Workflow>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<RawWorkflow>(`${API_ENDPOINTS.WORKFLOWS.LIST}/${id}`);
    const raw = responseTransformer.unwrapItem(res);
    const workflow = this.adapter.adapt(raw);

    this.cache.set(key, workflow, { ttl: 60 });
    return workflow;
  }

  async create(data: CreateWorkflowDto): Promise<Workflow> {
    const res = await this.apiClient.post<RawWorkflow>(API_ENDPOINTS.WORKFLOWS.LIST, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('workflows');
    return this.adapter.adapt(raw);
  }

  async update(id: string, data: UpdateWorkflowDto): Promise<Workflow> {
    const res = await this.apiClient.patch<RawWorkflow>(`${API_ENDPOINTS.WORKFLOWS.LIST}/${id}`, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('workflows');
    return this.adapter.adapt(raw);
  }

  async remove(id: string): Promise<void> {
    await this.apiClient.delete(`${API_ENDPOINTS.WORKFLOWS.LIST}/${id}`);
    this.cache.invalidate('workflows');
  }

  async activate(id: string): Promise<Workflow> {
    const res = await this.apiClient.patch<RawWorkflow>(`${API_ENDPOINTS.WORKFLOWS.LIST}/${id}/activate`, {});
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('workflows');
    return this.adapter.adapt(raw);
  }

  async execute(id: string): Promise<void> {
    await this.apiClient.post(`${API_ENDPOINTS.WORKFLOWS.LIST}/${id}/execute`, {});
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
import { restClient } from '@/core/services/api/clients/RestClient';
import { workflowAdapter } from '@/core/services/api/adapters/WorkflowAdapter';
import { cacheManager } from '@/core/infrastructure/cache/CacheManager';

export const workflowRepository = new WorkflowRepository(restClient, workflowAdapter, cacheManager);
