// ─── DepartmentAdapter.ts ─────────────────────────────────────────────────────
// SRP: Only responsible for Department raw → domain mapping.

import type { IBatchAdapter } from '@/core/services/api/interfaces/IDataAdapter';
import type { Department } from '@/shared/types/domain.types';

export interface RawDepartment {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  _count?: { agents?: number };
  agents?: Array<{ status: string }>;
  metrics?: {
    completedTasksToday?: number;
    harmonyScore?: number;
  };
}

export class DepartmentAdapter implements IBatchAdapter<RawDepartment, Department> {
  adapt(raw: RawDepartment): Department {
    const totalAgents = raw._count?.agents ?? raw.agents?.length ?? 0;
    const activeAgents = raw.agents?.filter((a) => a.status === 'ACTIVE').length ?? 0;

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      tenantId: raw.tenantId,
      agentCount: totalAgents,
      activeAgentCount: activeAgents,
      completedTasksToday: raw.metrics?.completedTasksToday ?? 0,
      harmonyScore: raw.metrics?.harmonyScore ?? Math.round((activeAgents / Math.max(totalAgents, 1)) * 100),
      createdAt: raw.createdAt,
    };
  }

  adaptMany(raws: RawDepartment[]): Department[] {
    return raws.map((r) => this.adapt(r));
  }

  reverse(domain: Department): Partial<RawDepartment> {
    return {
      id: domain.id,
      name: domain.name,
      description: domain.description,
      tenantId: domain.tenantId,
    };
  }
}

export const departmentAdapter = new DepartmentAdapter();
