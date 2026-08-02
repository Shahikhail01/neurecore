// ─── IDepartmentTemplateService ────────────────────────────────────────────
// Interface-segregation: only the methods this service must honour.
// Consumers depend on this interface, never on the concrete service.

import type { DepartmentTemplateCategory } from '@prisma/client';

export interface DeptTemplateStructureItem {
  /** Display name of the department */
  name: string;
  /** Optional description */
  description?: string;
  /** Which agent-type should lead this dept — informational hint for deployment */
  headAgentType?: string;
  /** References another item's name in the same structure array */
  parentName?: string;
}

export interface IDepartmentTemplateService {
  findAll(opts?: {
    category?: DepartmentTemplateCategory;
    page?: number;
    limit?: number;
  }): Promise<unknown>;
  findOne(id: string): Promise<unknown>;
  create(dto: CreateDeptTemplateInput): Promise<unknown>;
  update(id: string, dto: Partial<CreateDeptTemplateInput>): Promise<unknown>;
  remove(id: string): Promise<void>;
}

export interface CreateDeptTemplateInput {
  name: string;
  slug: string;
  description?: string;
  structure: DeptTemplateStructureItem[];
  category?: DepartmentTemplateCategory;
  tags?: string[];
  isPublic?: boolean;
}
