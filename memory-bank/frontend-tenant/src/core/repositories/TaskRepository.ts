// ─── TaskRepository.ts ───────────────────────────────────────────────────────
// DIP: depends on IApiClient, TaskAdapter, ICacheManager abstractions.
// SRP: Only manages Task data access.

import { BaseRepository, type QueryParams } from '@/core/repositories/interfaces/IRepository';
import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type { ICacheManager } from '@/core/services/api/interfaces/ICacheManager';
import { responseTransformer } from '@/core/services/api/transformers/ResponseTransformer';
import { type TaskAdapter, type RawTask } from '@/core/services/api/adapters/TaskAdapter';
import type { Task } from '@/shared/types/domain.types';
import { API_ENDPOINTS } from '@/shared/constants/api-endpoints';

export type CreateTaskDto = {
  title: string;
  description?: string;
  agentId?: string;
  workflowId?: string;
  priority?: string;
  dueAt?: string;
};

export type UpdateTaskDto = Partial<CreateTaskDto> & {
  status?: string;
};

export class TaskRepository extends BaseRepository<Task, CreateTaskDto, UpdateTaskDto> {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly adapter: TaskAdapter,
    private readonly cache: ICacheManager,
  ) {
    super();
  }

  async findAll(query?: QueryParams): Promise<{ items: Task[]; total: number }> {
    const key = this.cacheKey('tasks', query);
    const cached = this.cache.get<{ items: Task[]; total: number }>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<unknown>(API_ENDPOINTS.TASKS.LIST, { params: query as Record<string, string | number | boolean | undefined> });
    const { items: raw, total } = responseTransformer.unwrapList<RawTask>(res);
    const result = { items: this.adapter.adaptMany(raw), total };

    this.cache.set(key, result, { ttl: 30 }); // shorter TTL — tasks change more often
    return result;
  }

  async findById(id: string): Promise<Task | null> {
    const key = this.cacheKey('tasks', id);
    const cached = this.cache.get<Task>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<RawTask>(`${API_ENDPOINTS.TASKS.LIST}/${id}`);
    const raw = responseTransformer.unwrapItem(res);
    const task = this.adapter.adapt(raw);

    this.cache.set(key, task, { ttl: 30 });
    return task;
  }

  async create(data: CreateTaskDto): Promise<Task> {
    const res = await this.apiClient.post<RawTask>(API_ENDPOINTS.TASKS.LIST, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('tasks');
    return this.adapter.adapt(raw);
  }

  async update(id: string, data: UpdateTaskDto): Promise<Task> {
    const res = await this.apiClient.patch<RawTask>(`${API_ENDPOINTS.TASKS.LIST}/${id}`, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('tasks');
    return this.adapter.adapt(raw);
  }

  async remove(id: string): Promise<void> {
    await this.apiClient.delete(`${API_ENDPOINTS.TASKS.LIST}/${id}`);
    this.cache.invalidate('tasks');
  }

  /** Delegate a task to a specific agent */
  async delegate(taskId: string, agentId: string): Promise<Task> {
    const res = await this.apiClient.patch<RawTask>(`${API_ENDPOINTS.TASKS.LIST}/${taskId}/delegate`, { agentId });
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('tasks');
    return this.adapter.adapt(raw);
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
import { restClient } from '@/core/services/api/clients/RestClient';
import { taskAdapter } from '@/core/services/api/adapters/TaskAdapter';
import { cacheManager } from '@/core/infrastructure/cache/CacheManager';

export const taskRepository = new TaskRepository(restClient, taskAdapter, cacheManager);
