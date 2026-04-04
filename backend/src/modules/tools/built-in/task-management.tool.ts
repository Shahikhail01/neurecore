/**
 * Task Management Tool
 *
 * Provides task operations including:
 * - Create new tasks
 * - List tasks with filtering
 * - Update task status/assignment
 * - Delete tasks
 * - Assign tasks to users
 *
 * SOLID Principles:
 * - SRP: Only handles task management operations
 * - OCP: Add new task providers without modifying existing code
 * - DIP: Depends on ITaskService interface, not concrete implementation
 * - LSP: Any task service can substitute for another
 * - ISP: Small, focused interfaces
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

/**
 * Task operation actions
 */
export const TaskActionEnum = z.enum([
  'create',
  'list',
  'update',
  'delete',
  'assign',
]);

export type TaskActionType = z.infer<typeof TaskActionEnum>;

/**
 * Task priority enum
 */
export const TaskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

export type TaskPriorityType = z.infer<typeof TaskPriorityEnum>;

/**
 * Task status enum
 */
export const TaskStatusEnum = z.enum([
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
]);

export type TaskStatusType = z.infer<typeof TaskStatusEnum>;

/**
 * Input schema for Task Management Tool
 */
export const TaskManagementInputSchema = z.object({
  action: TaskActionEnum.describe('Task operation'),
  title: z.string().optional().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: TaskPriorityEnum.optional().describe('Task priority'),
  status: TaskStatusEnum.optional().describe('Task status'),
  dueDate: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('Due date'),
  assigneeId: z.string().optional().describe('User ID to assign'),
  taskId: z.string().optional().describe('Task ID for update/delete'),
  projectId: z.string().optional().describe('Project ID'),
  tags: z.array(z.string()).optional().describe('Task tags'),
  limit: z.number().int().min(1).max(100).default(50).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

export type TaskManagementInputType = z.infer<typeof TaskManagementInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Task output schema
 */
const TaskOutputItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  dueDate: z.string().nullable(),
  assigneeId: z.string().nullable(),
  projectId: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Output schema for Task Management Tool
 */
export const TaskManagementOutputSchema = z.object({
  tasks: z.array(TaskOutputItemSchema).optional(),
  task: TaskOutputItemSchema.optional(),
  taskId: z.string().optional(),
  success: z.boolean(),
  message: z.string().optional(),
  totalCount: z.number().optional(),
});

export type TaskManagementOutputType = z.infer<
  typeof TaskManagementOutputSchema
>;

// ─────────────────────────────────────────────────────────────
// Task Tool
// ─────────────────────────────────────────────────────────────

/**
 * Task Management Tool
 *
 * Features:
 * - Uses internal Goal module via Prisma as task proxy
 * - Zod schema validation for inputs and outputs
 * - Structured output with proper error handling
 * - Tenant isolation enforced
 */
@Injectable()
export class TaskManagementTool extends BaseStructuredTool {
  readonly name = 'task_management';
  readonly description =
    'Manage tasks, create, update, delete, assign tasks, and track task status. Supports actions: create, list, update, delete, assign.';
  readonly category = ToolCategory.PRODUCTIVITY;
  readonly inputSchema = TaskManagementInputSchema;
  readonly outputSchema = TaskManagementOutputSchema;
  readonly version = '1.0.0';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  /**
   * Core execution logic - SRP: Only handles task operations
   */
  protected async executeImpl(
    input: TaskManagementInputType,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    const startTime = Date.now();
    const tenantId = context?.tenantId ?? 'unknown';

    this.logger.log(
      `[TaskManagementTool] Action: ${input.action} for tenant: ${tenantId}`,
    );

    try {
      switch (input.action) {
        case 'create':
          return await this.handleCreate(input, startTime, tenantId);
        case 'list':
          return await this.handleList(input, startTime, tenantId);
        case 'update':
          return await this.handleUpdate(input, startTime, tenantId);
        case 'delete':
          return await this.handleDelete(input, startTime, tenantId);
        case 'assign':
          return await this.handleAssign(input, startTime, tenantId);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(
        `[TaskManagementTool] Action ${input.action} failed`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Task operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Parse metrics from Goal JSON field
   */
  private parseMetrics(metrics: unknown): Record<string, unknown> {
    if (typeof metrics === 'string') {
      try {
        return JSON.parse(metrics);
      } catch {
        return {};
      }
    }
    if (typeof metrics === 'object' && metrics !== null) {
      return metrics as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Convert task output for response
   */
  private toTaskOutput(task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    targetDate: Date | null;
    ownerUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    metrics: unknown;
    departmentId: string | null;
  }): {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    assigneeId: string | null;
    projectId: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  } {
    const metrics = this.parseMetrics(task.metrics);
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: (metrics.priority as string) ?? 'medium',
      dueDate: task.targetDate?.toISOString() ?? null,
      assigneeId: task.ownerUserId,
      projectId: task.departmentId,
      tags: (metrics.tags as string[]) ?? [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * Map task status string to GoalStatus enum
   */
  private mapStatusToGoal(
    status: string,
  ): 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED' {
    const statusMap: Record<
      string,
      'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED'
    > = {
      todo: 'ACTIVE',
      in_progress: 'ACTIVE',
      review: 'ACTIVE',
      done: 'COMPLETED',
      cancelled: 'ARCHIVED',
    };
    return statusMap[status] ?? 'ACTIVE';
  }

  /**
   * Handle create task action
   */
  private async handleCreate(
    input: TaskManagementInputType,
    startTime: number,
    tenantId: string,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    if (!input.title) {
      return {
        success: false,
        error: 'title is required for create action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Create task using Prisma - using Goal as proxy for tasks
    const task = await this.prisma.goal.create({
      data: {
        tenantId,
        title: input.title,
        description: input.description,
        status: input.status ? this.mapStatusToGoal(input.status) : 'ACTIVE',
        targetDate: input.dueDate ? new Date(input.dueDate) : null,
        ownerUserId: input.assigneeId,
        departmentId: input.projectId,
        metrics: JSON.stringify({
          priority: input.priority ?? 'medium',
          tags: input.tags ?? [],
        }),
      },
    });

    return {
      success: true,
      data: {
        taskId: task.id,
        task: this.toTaskOutput(task),
        success: true,
        message: `Task created successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }

  /**
   * Handle list tasks action
   */
  private async handleList(
    input: TaskManagementInputType,
    startTime: number,
    tenantId: string,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    // Build where clause with tenant isolation
    const where: Record<string, unknown> = { tenantId };

    if (input.status) {
      where.status = this.mapStatusToGoal(input.status);
    }
    if (input.assigneeId) {
      where.ownerUserId = input.assigneeId;
    }
    if (input.projectId) {
      where.departmentId = input.projectId;
    }

    const [tasks, totalCount] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goal.count({ where }),
    ]);

    return {
      success: true,
      data: {
        tasks: tasks.map((task) => this.toTaskOutput(task)),
        success: true,
        totalCount,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }

  /**
   * Handle update task action
   */
  private async handleUpdate(
    input: TaskManagementInputType,
    startTime: number,
    tenantId: string,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    if (!input.taskId) {
      return {
        success: false,
        error: 'taskId is required for update action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status !== undefined)
      updateData.status = this.mapStatusToGoal(input.status);
    if (input.dueDate !== undefined) {
      updateData.targetDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.projectId !== undefined)
      updateData.departmentId = input.projectId;

    // Update metrics for priority and tags
    if (input.priority !== undefined || input.tags !== undefined) {
      const existingTask = await this.prisma.goal.findUnique({
        where: { id: input.taskId },
      });
      if (existingTask) {
        const existingMetrics = this.parseMetrics(existingTask.metrics);
        updateData.metrics = JSON.stringify({
          ...existingMetrics,
          priority: input.priority ?? existingMetrics.priority,
          tags: input.tags ?? existingMetrics.tags,
        });
      }
    }

    const task = await this.prisma.goal.update({
      where: { id: input.taskId, tenantId },
      data: updateData,
    });

    return {
      success: true,
      data: {
        taskId: task.id,
        task: this.toTaskOutput(task),
        success: true,
        message: `Task ${task.id} updated successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }

  /**
   * Handle delete task action
   */
  private async handleDelete(
    input: TaskManagementInputType,
    startTime: number,
    tenantId: string,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    if (!input.taskId) {
      return {
        success: false,
        error: 'taskId is required for delete action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    await this.prisma.goal.delete({
      where: { id: input.taskId, tenantId },
    });

    return {
      success: true,
      data: {
        taskId: input.taskId,
        success: true,
        message: `Task ${input.taskId} deleted successfully`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }

  /**
   * Handle assign task action
   */
  private async handleAssign(
    input: TaskManagementInputType,
    startTime: number,
    tenantId: string,
  ): Promise<StructuredToolResult<TaskManagementOutputType>> {
    if (!input.taskId) {
      return {
        success: false,
        error: 'taskId is required for assign action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    if (!input.assigneeId) {
      return {
        success: false,
        error: 'assigneeId is required for assign action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const task = await this.prisma.goal.update({
      where: { id: input.taskId, tenantId },
      data: { ownerUserId: input.assigneeId },
    });

    return {
      success: true,
      data: {
        taskId: task.id,
        task: this.toTaskOutput(task),
        success: true,
        message: `Task ${task.id} assigned to user ${input.assigneeId}`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }
}
