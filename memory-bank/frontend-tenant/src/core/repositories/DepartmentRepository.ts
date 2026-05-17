// ─── DepartmentRepository.ts ─────────────────────────────────────────────────
// DIP: depends on IApiClient, DepartmentAdapter, ICacheManager abstractions.
// SRP: Only manages Department data access.

import { BaseRepository, type QueryParams } from '@/core/repositories/interfaces/IRepository';
import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type { ICacheManager } from '@/core/services/api/interfaces/ICacheManager';
import { responseTransformer } from '@/core/services/api/transformers/ResponseTransformer';
import { type DepartmentAdapter, type RawDepartment } from '@/core/services/api/adapters/DepartmentAdapter';
import type { Department } from '@/shared/types/domain.types';
import { API_ENDPOINTS } from '@/shared/constants/api-endpoints';

export type CreateDepartmentDto = {
  name: string;
  description?: string;
};

export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export class DepartmentRepository extends BaseRepository<Department, CreateDepartmentDto, UpdateDepartmentDto> {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly adapter: DepartmentAdapter,
    private readonly cache: ICacheManager,
  ) {
    super();
  }

  async findAll(query?: QueryParams): Promise<{ items: Department[]; total: number }> {
    const key = this.cacheKey('departments', query);
    const cached = this.cache.get<{ items: Department[]; total: number }>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<unknown>(API_ENDPOINTS.DEPARTMENTS.LIST, { params: query as Record<string, string | number | boolean | undefined> });
    const { items: raw, total } = responseTransformer.unwrapList<RawDepartment>(res);
    const result = { items: this.adapter.adaptMany(raw), total };

    this.cache.set(key, result, { ttl: 120 }); // departments change infrequently
    return result;
  }

  async findById(id: string): Promise<Department | null> {
    const key = this.cacheKey('departments', id);
    const cached = this.cache.get<Department>(key);
    if (cached) return cached;

    const res = await this.apiClient.get<RawDepartment>(`${API_ENDPOINTS.DEPARTMENTS.LIST}/${id}`);
    const raw = responseTransformer.unwrapItem(res);
    const department = this.adapter.adapt(raw);

    this.cache.set(key, department, { ttl: 120 });
    return department;
  }

  async create(data: CreateDepartmentDto): Promise<Department> {
    const res = await this.apiClient.post<RawDepartment>(API_ENDPOINTS.DEPARTMENTS.LIST, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('departments');
    return this.adapter.adapt(raw);
  }

  async update(id: string, data: UpdateDepartmentDto): Promise<Department> {
    const res = await this.apiClient.patch<RawDepartment>(`${API_ENDPOINTS.DEPARTMENTS.LIST}/${id}`, data);
    const raw = responseTransformer.unwrapItem(res);
    this.cache.invalidate('departments');
    return this.adapter.adapt(raw);
  }

  async remove(id: string): Promise<void> {
    await this.apiClient.delete(`${API_ENDPOINTS.DEPARTMENTS.LIST}/${id}`);
    this.cache.invalidate('departments');
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
import { restClient } from '@/core/services/api/clients/RestClient';
import { departmentAdapter } from '@/core/services/api/adapters/DepartmentAdapter';
import { cacheManager } from '@/core/infrastructure/cache/CacheManager';

export const departmentRepository = new DepartmentRepository(restClient, departmentAdapter, cacheManager);
