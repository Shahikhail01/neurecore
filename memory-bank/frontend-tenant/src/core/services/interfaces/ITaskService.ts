// ─── ITaskService.ts ─────────────────────────────────────────────────────────
// ISP: Task operational methods only.

import type { Task, TaskStatus, TaskPriority } from '@/shared/types/domain.types';
import type { CreateTaskDto, UpdateTaskDto } from '@/core/repositories/TaskRepository';

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  agentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DelegationResult {
  task: Task;
  assignedAgent: { id: string; name: string };
  estimatedCompletion?: string;
}

export interface ITaskService {
  listTasks(filters?: TaskFilters): Promise<{ tasks: Task[]; total: number }>;
  getTask(id: string): Promise<Task>;
  createTask(data: CreateTaskDto): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDto): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  delegateTask(taskId: string, agentId: string): Promise<DelegationResult>;
  bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void>;
}
