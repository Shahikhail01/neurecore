// src/services/tasks.service.ts
//
// Phase 7 — Task service client. The backend currently exposes tasks
// via the project-automation status endpoint and the project detail
// endpoint. This service provides a single, focused surface around the
// task-level data the Phase 7 surfaces (task board, agent picker
// integration, execution detail) need.

import api from './api';

export type TaskStatus =
  | 'DRAFT'
  | 'READY'
  | 'ASSIGNED'
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'NEEDS_INPUT'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  templateKey?: string | null;
  requiredRole?: string | null;
  requiredCapabilities?: string[];
  agentId?: string | null;
  goalId?: string | null;
  projectId?: string | null;
  attemptCount?: number;
  version?: number;
  updatedAt: string;
  createdAt: string;
}

export const tasksService = {
  /**
   * Phase 7 — task board source. Wraps the project-automation status
   * endpoint which already returns the task list scoped to a project.
   */
  async listByProject(projectId: string): Promise<Task[]> {
    const res = await api.get(`/project-automation/${projectId}/status`);
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    const rawTasks = Array.isArray(inner?.tasks) ? inner.tasks : [];
    return rawTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: null,
      status: (t.status ?? 'DRAFT') as TaskStatus,
      priority: (t.priority ?? 'MEDIUM') as TaskPriority,
      templateKey: t.templateKey ?? null,
      agentId: t.agentId ?? null,
      projectId,
      updatedAt: t.updatedAt,
      createdAt: t.updatedAt,
    }));
  },

  /**
   * Returns a single task. Falls back to /tasks/:id if the project
   * status endpoint cannot resolve it.
   */
  async get(taskId: string): Promise<Task | null> {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
      if (inner && typeof inner === 'object') {
        return inner as Task;
      }
    } catch {
      // ignore — caller handles null
    }
    return null;
  },
};
