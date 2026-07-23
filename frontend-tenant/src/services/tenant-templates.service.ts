import api from './api';

export type TemplateType =
  | 'CUSTOMER_LIFECYCLE'
  | 'AGENT_ROLE'
  | 'ROUTINE'
  | 'REPORT'
  | 'TASK_TEMPLATE'
  | 'DEPARTMENT_DEFAULT';

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  CUSTOMER_LIFECYCLE: 'Customer Lifecycles',
  AGENT_ROLE: 'Agent Roles',
  ROUTINE: 'Routines',
  REPORT: 'Reports',
  TASK_TEMPLATE: 'Tasks',
  DEPARTMENT_DEFAULT: 'Departments',
};

export interface TenantTemplate {
  id: string;
  tenantId: string | null;
  slug: string;
  name: string;
  description: string | null;
  templateType: TemplateType;
  industrySlug: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  sourceSeedId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantTemplatePayload {
  slug: string;
  name: string;
  description?: string;
  templateType: TemplateType;
  industrySlug?: string;
  config: Record<string, unknown>;
}

export interface UpdateTenantTemplatePayload {
  name?: string;
  description?: string;
  industrySlug?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export const tenantTemplatesService = {
  async list(templateType?: TemplateType): Promise<TenantTemplate[]> {
    const params = templateType ? `?type=${templateType}` : '';
    const res = await api.get(`/tenant-templates${params}`);
    return res.data?.data ?? res.data;
  },

  async get(id: string): Promise<TenantTemplate> {
    const res = await api.get(`/tenant-templates/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(payload: CreateTenantTemplatePayload): Promise<TenantTemplate> {
    const res = await api.post('/tenant-templates', payload);
    return res.data?.data ?? res.data;
  },

  async update(id: string, payload: UpdateTenantTemplatePayload): Promise<TenantTemplate> {
    const res = await api.patch(`/tenant-templates/${id}`, payload);
    return res.data?.data ?? res.data;
  },

  async archive(id: string): Promise<void> {
    await api.delete(`/tenant-templates/${id}`);
  },

  async clone(id: string): Promise<TenantTemplate> {
    const res = await api.post(`/tenant-templates/${id}/clone`);
    return res.data?.data ?? res.data;
  },

  async listSystemSeeds(industrySlug?: string): Promise<TenantTemplate[]> {
    const params = industrySlug ? `?industrySlug=${encodeURIComponent(industrySlug)}` : '';
    const res = await api.get(`/tenant-templates/system-seeds${params}`);
    return res.data?.data ?? res.data;
  },

  async cloneSystemSeed(seedId: string): Promise<TenantTemplate> {
    const res = await api.post(`/tenant-templates/system-seeds/${seedId}/clone`);
    return res.data?.data ?? res.data;
  },

  async reseed(industrySlug: string): Promise<{ count: number }> {
    const res = await api.post('/tenant-templates/reseed', { industrySlug });
    return res.data?.data ?? res.data;
  },

  /**
   * applyBaseline — copy the universal baseline (`industrySlug = null`)
   * seeds into the tenant. Useful when a tenant has no industry set and
   * the `/settings/templates` page would otherwise be empty.
   * Idempotent: skips if a tenant-owned clone already exists.
   */
  async applyBaseline(): Promise<{ count: number }> {
    const res = await api.post('/tenant-templates/apply-baseline', {});
    return res.data?.data ?? res.data;
  },

  async restoreFromSeed(id: string): Promise<TenantTemplate> {
    const res = await api.post(`/tenant-templates/${id}/restore-from-seed`);
    return res.data?.data ?? res.data;
  },
};
