/**
 * Task Service - Business logic for task operations
 * SOLID: Single Responsibility - Only task management
 * SOLID: Dependency Inversion - Depends on repository abstraction
 * Location: src/core/services/task.service.ts
 */

import { Injectable } from '@nestjs/common';
import {
  Task,
  TaskStatus,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
} from '../domain/models';
import {
  ITaskRepository,
  IEventBus,
  ILogger,
  IAgentRepository,
} from '../domain/interfaces';

@Injectable()
export class TaskService {
  constructor(
    private taskRepository: ITaskRepository,
    private agentRepository: IAgentRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    this.logger.info('Creating task', { input });

    // Verify agent exists (referential integrity)
    const agent = await this.agentRepository.findById(input.agentId);
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    const task = await this.taskRepository.create(input);

    await this.eventBus.emit('task.created', {
      taskId: task.id,
      agentId: task.agentId,
      timestamp: new Date().toISOString(),
    });

    return task;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    this.logger.info('Updating task status', { taskId, status });

    const task = await this.taskRepository.update(taskId, { status });

    await this.eventBus.emit('task.status_changed', {
      taskId,
      newStatus: status,
      timestamp: new Date().toISOString(),
    });

    return task;
  }

  /**
   * Complete task
   */
  async completeTask(taskId: string): Promise<Task> {
    return this.updateTaskStatus(taskId, TaskStatus.COMPLETED);
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: string): Promise<Task | null> {
    return this.taskRepository.findById(id);
  }

  /**
   * Get all tasks for an agent
   */
  async getTasksByAgent(agentId: string): Promise<Task[]> {
    return this.taskRepository.findByAgentId(agentId);
  }

  /**
   * List tasks with filters
   */
  async listTasks(filters: TaskFilters): Promise<Task[]> {
    return this.taskRepository.findAll(filters);
  }

  /**
   * Delete task
   */
  async deleteTask(id: string): Promise<void> {
    await this.taskRepository.delete(id);

    await this.eventBus.emit('task.deleted', {
      taskId: id,
      timestamp: new Date().toISOString(),
    });
  }
}
