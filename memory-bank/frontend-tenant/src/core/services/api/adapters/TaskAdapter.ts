// ─── TaskAdapter.ts ───────────────────────────────────────────────────────────
// SRP: Only responsible for Task raw → domain mapping.

import type { IBatchAdapter } from '@/core/services/api/interfaces/IDataAdapter';
import type { Task, TaskStatus, TaskPriority } from '@/shared/types/domain.types';

export interface RawTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  tenantId: string;
  agentId?: string;
  agent?: { name: string };
  workflowId?: string;
  dueAt?: string;
  completedAt?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class TaskAdapter implements IBatchAdapter<RawTask, Task> {
  adapt(raw: RawTask): Task {
    return {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      status: this.mapStatus(raw.status),
      priority: this.mapPriority(raw.priority),
      tenantId: raw.tenantId,
      agentId: raw.agentId,
      agentName: raw.agent?.name,
      workflowId: raw.workflowId,
      dueAt: raw.dueAt,
      completedAt: raw.completedAt,
      estimatedDuration: raw.estimatedDuration,
      actualDuration: raw.actualDuration,
      metadata: raw.metadata,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  adaptMany(raws: RawTask[]): Task[] {
    return raws.map((r) => this.adapt(r));
  }

  reverse(domain: Task): Partial<RawTask> {
    return {
      id: domain.id,
      title: domain.title,
      description: domain.description,
      status: domain.status,
      priority: domain.priority,
      agentId: domain.agentId,
      workflowId: domain.workflowId,
      dueAt: domain.dueAt,
    };
  }

  private mapStatus(raw: string): TaskStatus {
    const map: Record<string, TaskStatus> = {
      PENDING: 'PENDING',
      ASSIGNED: 'ASSIGNED',
      IN_PROGRESS: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
    };
    return map[raw] ?? 'PENDING';
  }

  private mapPriority(raw?: string): TaskPriority {
    const map: Record<string, TaskPriority> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    };
    return map[raw ?? ''] ?? 'MEDIUM';
  }
}

export const taskAdapter = new TaskAdapter();
