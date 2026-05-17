// ─── TaskService.ts ───────────────────────────────────────────────────────────
// SRP: Task lifecycle and delegation business logic.
// DIP: Depends on TaskRepository via its concrete type for delegate() access.

import type { ITaskService, TaskFilters, DelegationResult } from '@/core/services/interfaces/ITaskService';
import type { Task, TaskStatus } from '@/shared/types/domain.types';
import { taskRepository, type CreateTaskDto, type UpdateTaskDto } from '@/core/repositories/TaskRepository';

export class TaskService implements ITaskService {
  constructor(private readonly repository: typeof taskRepository) {}

  async listTasks(filters?: TaskFilters): Promise<{ tasks: Task[]; total: number }> {
    const { items, total } = await this.repository.findAll(
      filters as import('@/core/repositories/interfaces/IRepository').QueryParams,
    );
    return { tasks: items, total };
  }

  async getTask(id: string): Promise<Task> {
    const task = await this.repository.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);
    return task;
  }

  async createTask(data: CreateTaskDto): Promise<Task> {
    return this.repository.create(data);
  }

  async updateTask(id: string, data: UpdateTaskDto): Promise<Task> {
    return this.repository.update(id, data);
  }

  async deleteTask(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  async delegateTask(taskId: string, agentId: string): Promise<DelegationResult> {
    const task = await this.repository.delegate(taskId, agentId);
    return {
      task,
      assignedAgent: {
        id: agentId,
        name: task.agentName ?? agentId,
      },
    };
  }

  async bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void> {
    await Promise.all(ids.map((id) => this.repository.update(id, { status })));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const taskService = new TaskService(taskRepository);
