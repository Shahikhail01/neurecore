// ─── WorkflowAdapter.ts ───────────────────────────────────────────────────────
// SRP: Only responsible for Workflow raw → domain mapping.

import type { IBatchAdapter } from '@/core/services/api/interfaces/IDataAdapter';
import type { Workflow, WorkflowStatus } from '@/shared/types/domain.types';

export interface RawWorkflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  isActive: boolean;
  tenantId: string;
  definition?: {
    nodes?: unknown[];
    edges?: unknown[];
  };
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { executions?: number };
  metrics?: {
    successRate?: number;
  };
}

export class WorkflowAdapter implements IBatchAdapter<RawWorkflow, Workflow> {
  adapt(raw: RawWorkflow): Workflow {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      status: this.mapStatus(raw.status),
      isActive: raw.isActive,
      tenantId: raw.tenantId,
      nodes: (raw.definition?.nodes as Workflow['nodes']) ?? [],
      edges: (raw.definition?.edges as Workflow['edges']) ?? [],
      lastExecutedAt: raw.lastExecutedAt,
      executionCount: raw._count?.executions ?? 0,
      successRate: raw.metrics?.successRate ?? 0,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  adaptMany(raws: RawWorkflow[]): Workflow[] {
    return raws.map((r) => this.adapt(r));
  }

  reverse(domain: Workflow): Partial<RawWorkflow> {
    return {
      id: domain.id,
      name: domain.name,
      description: domain.description,
      status: domain.status,
      isActive: domain.isActive,
    };
  }

  private mapStatus(raw: string): WorkflowStatus {
    const map: Record<string, WorkflowStatus> = {
      DRAFT: 'DRAFT',
      ACTIVE: 'ACTIVE',
      PAUSED: 'PAUSED',
      ARCHIVED: 'ARCHIVED',
      ERROR: 'ERROR',
    };
    return map[raw] ?? 'DRAFT';
  }
}

export const workflowAdapter = new WorkflowAdapter();
