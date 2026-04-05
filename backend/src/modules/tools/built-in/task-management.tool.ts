/**
 * Task Management Tool
 *
 * Provides task operations including:
 * - Create new tasks
 * - List tasks with filtering
 * - Update task status/assignment
 * - Delete tasks
 * - Assign tasks to users
 */

import { Injectable } from '@nestjs/common';
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
 * Task priority enum — matches TaskPriority in Prisma schema
 */
export const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export type TaskPriorityType = z.infer<typeof TaskPriorityEnum>;

/**
 * Task status enum — matches TaskStatus in Prisma schema
 */
export const TaskStatusEnum = z.enum([
  'PENDING',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export type TaskStatusType = z.infer<typeof TaskStatusEnum>;

/**
 * Input schema for Task Management Tool
 */
export const TaskManagementInputSchema = z.object({
  action: TaskActionEnum.describe('Task operation'),
  title: z.string().optional().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: TaskPriorityEnum.optional().describe(
    'Task priority: LOW, MEDIUM, HIGH, CRITICAL',
  ),
  status: TaskStatusEnum.optional().describe(
    'Task status: PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED',
  ),
  scheduledAt: z
    .string()
    .datetime({ message: 'Invalid ISO 8601 datetime format' })
    .optional()
    .describe('Scheduled date/time'),
  agentId: z.string().optional().describe('Agent ID to assign the task to'),
  taskId: z.string().optional().describe('Task ID for update/delete'),
  workflowId: z.string().optional().describe('Workflow ID to associate'),
  limit: z.number().int().min(1).max(100).default(50).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

export type TaskManagementInputType = z.infer<typeof TaskManagementInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

/**
 * Task output schema — matches fields in the Task model
 */
const TaskOutputItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  scheduledAt: z.string().nullable(),
  agentId: z.string().nullable(),
  workflowId: z.string().nullable(),
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
    'Manage tasks: create, list, update, delete, assign. Priority values: LOW, MEDIUM, HIGH, CRITICAL. Status values: PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED.';
  readonly category = ToolCategory.PRODUCTIVITY;
  readonly inputSchema = TaskManagementInputSchema;
  readonly outputSchema = TaskManagementOutputSchema;
  readonly version = '1.0.0';

  constructor(private readonly prisma: PrismaService) {
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
   * Convert a Prisma Task record to the tool output shape
   */
  private toTaskOutput(task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    scheduledAt: Date | null;
    agentId: string | null;
    workflowId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    scheduledAt: string | null;
    agentId: string | null;
    workflowId: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      scheduledAt: task.scheduledAt?.toISOString() ?? null,
      agentId: task.agentId,
      workflowId: task.workflowId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
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

    const task = await this.prisma.task.create({
      data: {
        tenantId,
        title: input.title,
        description: input.description,
        status: (input.status as any) ?? 'PENDING',
        priority: (input.priority as any) ?? 'MEDIUM',
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        agentId: input.agentId ?? null,
        workflowId: input.workflowId ?? null,
        input: {},
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

    const where: Record<string, unknown> = { tenantId };

    if (input.status) {
      where.status = input.status;
    }
    if (input.agentId) {
      where.agentId = input.agentId;
    }
    if (input.workflowId) {
      where.workflowId = input.workflowId;
    }

    const [tasks, totalCount] = await Promise.all([
      this.prisma.task.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
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

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt
        ? new Date(input.scheduledAt)
        : null;
    }
    if (input.workflowId !== undefined)
      updateData.workflowId = input.workflowId;

    const task = await this.prisma.task.update({
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

    await this.prisma.task.delete({
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
   * Handle assign task action — sets agentId on the task
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

    if (!input.agentId) {
      return {
        success: false,
        error: 'agentId is required for assign action',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const task = await this.prisma.task.update({
      where: { id: input.taskId, tenantId },
      data: { agentId: input.agentId },
    });

    return {
      success: true,
      data: {
        taskId: task.id,
        task: this.toTaskOutput(task),
        success: true,
        message: `Task ${task.id} assigned to agent ${input.agentId}`,
      },
      metadata: {
        durationMs: Date.now() - startTime,
        model: 'task-management-v1',
      },
    };
  }
}
