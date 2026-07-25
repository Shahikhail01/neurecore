import api from './api';

export interface DepartmentTemplateStructureItem {
  name: string;
  description?: string;
  headAgentType?: string;
  parentName?: string;
}

export interface DepartmentTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  structure: DepartmentTemplateStructureItem[];
  category?: string;
  tags?: string[];
}

export const departmentTemplatesService = {
  async list(opts?: { industryGroup?: string; category?: string }): Promise<DepartmentTemplate[]> {
    const params: Record<string, string> = {};
    if (opts?.industryGroup) params.industryGroup = opts.industryGroup;
    if (opts?.category) params.category = opts.category;
    const res = await api.get('/department-templates', { params });
    const outer = res.data?.data ?? res.data;
    if (Array.isArray(outer)) return outer;
    if (Array.isArray(outer?.data)) return outer.data;
    if (Array.isArray(outer?.items)) return outer.items;
    return [];
  },
};