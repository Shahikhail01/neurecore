/**
 * Task Service
 * CRUD operations for tasks
 * Calls Phase 1 endpoints: /api/v1/tenants/:tenantId/tasks
 */

import { apiClient } from "@/lib/axiosInterceptor";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "completed" | "blocked";
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: string;
  assignee?: string;
  dueDate?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  assignee?: string;
  dueDate?: string;
}

class TaskService {
  /**
   * Get all tasks for a tenant
   */
  async getTasks(
    tenantId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Task[]> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/tasks`,
        {
          params: { limit, offset },
        },
      );
      return response.data.tasks || response.data;
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      throw error;
    }
  }

  /**
   * Get single task
   */
  async getTask(tenantId: string, taskId: string): Promise<Task> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/tasks/${taskId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to fetch task:", error);
      throw error;
    }
  }

  /**
   * Create new task
   */
  async createTask(
    tenantId: string,
    request: CreateTaskRequest,
  ): Promise<Task> {
    try {
      const response = await apiClient.post(
        `/api/v1/tenants/${tenantId}/tasks`,
        request,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(
    tenantId: string,
    taskId: string,
    request: UpdateTaskRequest,
  ): Promise<Task> {
    try {
      const response = await apiClient.patch(
        `/api/v1/tenants/${tenantId}/tasks/${taskId}`,
        request,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to update task:", error);
      throw error;
    }
  }

  /**
   * Delete task
   */
  async deleteTask(tenantId: string, taskId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/tenants/${tenantId}/tasks/${taskId}`);
    } catch (error) {
      console.error("Failed to delete task:", error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    tenantId: string,
    taskId: string,
    status: string,
  ): Promise<Task> {
    return this.updateTask(tenantId, taskId, { status });
  }

  /**
   * Assign task to agent
   */
  async assignTask(
    tenantId: string,
    taskId: string,
    assignee: string,
  ): Promise<Task> {
    return this.updateTask(tenantId, taskId, { assignee });
  }
}

export default new TaskService();
