/**
 * Routine Automation Tool - P2-10 of remaining tools
 * Enables AI agents to create and manage automated routines and triggers
 * For various agents requiring automation capabilities
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for routine automation
 * - OCP: Extensible via automation provider interfaces
 * - DIP: Depends on abstractions for automation providers
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const RoutineAutomationActionEnum = z.enum([
  'create_routine',
  'update_routine',
  'delete_routine',
  'trigger_routine',
  'list_routines',
  'get_routine_status',
  'get_execution_logs',
]);

export type RoutineAutomationAction = z.infer<
  typeof RoutineAutomationActionEnum
>;

export const RoutineAutomationInputSchema = z.object({
  action: RoutineAutomationActionEnum.describe(
    'The routine automation action to perform',
  ),
  routineId: z.string().optional().describe('Routine ID'),
  name: z.string().optional().describe('Routine name'),
  description: z.string().optional().describe('Routine description'),
  trigger: z
    .object({
      type: z.enum(['scheduled', 'event', 'manual', 'webhook']),
      schedule: z.string().optional().describe('Cron expression'),
      eventType: z.string().optional().describe('Event type to trigger'),
      webhookUrl: z.string().url().optional().describe('Webhook URL'),
    })
    .optional(),
  actions: z
    .array(
      z.object({
        type: z.string(),
        params: z.record(z.unknown()).optional(),
        delay: z.number().int().positive().optional(),
      }),
    )
    .optional()
    .describe('Actions to execute'),
  enabled: z.boolean().optional().describe('Enable/disable routine'),
  filters: z
    .object({
      status: z.enum(['active', 'paused', 'disabled']).optional(),
      triggerType: z.string().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type RoutineAutomationInput = z.infer<
  typeof RoutineAutomationInputSchema
>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Routine = {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: string;
    schedule?: string;
    eventType?: string;
    webhookUrl?: string;
  };
  actions: Array<{
    type: string;
    params?: Record<string, unknown>;
    delay?: number;
  }>;
  status: 'active' | 'paused' | 'disabled';
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
};

type RoutineExecution = {
  id: string;
  routineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: Array<{
    action: string;
    status: string;
    output?: unknown;
    error?: string;
  }>;
};

type RoutineLog = {
  id: string;
  routineId: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  error?: string;
};

type RoutineList = Array<Routine>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IRoutineAutomationProvider {
  createRoutine(routine: {
    name: string;
    description?: string;
    trigger: {
      type: string;
      schedule?: string;
      eventType?: string;
      webhookUrl?: string;
    };
    actions: Array<{
      type: string;
      params?: Record<string, unknown>;
      delay?: number;
    }>;
  }): Promise<Routine>;

  updateRoutine(
    routineId: string,
    updates: Partial<{
      name: string;
      description: string;
      trigger: {
        type: string;
        schedule?: string;
        eventType?: string;
        webhookUrl?: string;
      };
      actions: Array<{
        type: string;
        params?: Record<string, unknown>;
        delay?: number;
      }>;
      status: string;
    }>,
  ): Promise<Routine>;

  deleteRoutine(routineId: string): Promise<boolean>;

  triggerRoutine(routineId: string): Promise<RoutineExecution>;

  listRoutines(
    page: number,
    limit: number,
    filters?: { status?: string; triggerType?: string },
  ): Promise<{ routines: RoutineList; total: number }>;

  getRoutineStatus(routineId: string): Promise<Routine>;

  getExecutionLogs(
    routineId: string,
    page: number,
    limit: number,
  ): Promise<{ logs: RoutineLog[]; total: number }>;
}

// ─────────────────────────────────────────────────────────────
// Mock Routine Automation Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockRoutineAutomationProvider implements IRoutineAutomationProvider {
  private readonly logger = new Logger(MockRoutineAutomationProvider.name);
  private readonly routines = new Map<string, Routine>();

  async createRoutine(routine: {
    name: string;
    description?: string;
    trigger: {
      type: string;
      schedule?: string;
      eventType?: string;
      webhookUrl?: string;
    };
    actions: Array<{
      type: string;
      params?: Record<string, unknown>;
      delay?: number;
    }>;
  }): Promise<Routine> {
    this.logger.log('Creating routine: ' + routine.name);

    const id = 'rtn-' + Date.now();
    const now = new Date().toISOString();

    let nextRun: string | undefined;
    if (routine.trigger.type === 'scheduled' && routine.trigger.schedule) {
      // Calculate next run from cron
      nextRun = new Date(Date.now() + 3600000).toISOString();
    }

    const newRoutine: Routine = {
      id,
      name: routine.name,
      description: routine.description,
      trigger: routine.trigger,
      actions: routine.actions,
      status: 'active',
      nextRun,
      createdAt: now,
      updatedAt: now,
    };

    this.routines.set(id, newRoutine);
    return newRoutine;
  }

  async updateRoutine(
    routineId: string,
    updates: Partial<{
      name: string;
      description: string;
      trigger: {
        type: string;
        schedule?: string;
        eventType?: string;
        webhookUrl?: string;
      };
      actions: Array<{
        type: string;
        params?: Record<string, unknown>;
        delay?: number;
      }>;
      status: string;
    }>,
  ): Promise<Routine> {
    this.logger.log('Updating routine: ' + routineId);
    const routine = this.routines.get(routineId);

    if (!routine) {
      throw new Error('Routine not found: ' + routineId);
    }

    const updated: Routine = {
      ...routine,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Routine;

    this.routines.set(routineId, updated);
    return updated;
  }

  async deleteRoutine(routineId: string): Promise<boolean> {
    this.logger.log('Deleting routine: ' + routineId);
    return this.routines.delete(routineId);
  }

  async triggerRoutine(routineId: string): Promise<RoutineExecution> {
    this.logger.log('Triggering routine: ' + routineId);
    const routine = this.routines.get(routineId);

    if (!routine) {
      throw new Error('Routine not found: ' + routineId);
    }

    const executionId = 'rtnexec-' + Date.now();
    const now = new Date().toISOString();

    const execution: RoutineExecution = {
      id: executionId,
      routineId,
      status: 'running',
      startedAt: now,
      results: [],
    };

    // Simulate execution
    for (const action of routine.actions) {
      execution.results.push({
        action: action.type,
        status: 'completed',
        output: 'Action executed successfully',
      });
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();

    // Update routine last run
    routine.lastRun = now;

    return execution;
  }

  async listRoutines(
    page: number,
    limit: number,
    filters?: { status?: string; triggerType?: string },
  ): Promise<{ routines: RoutineList; total: number }> {
    this.logger.log('Listing routines');
    let all = Array.from(this.routines.values());

    if (filters?.status) {
      all = all.filter((r) => r.status === filters.status);
    }
    if (filters?.triggerType) {
      all = all.filter((r) => r.trigger.type === filters.triggerType);
    }

    const start = (page - 1) * limit;
    const routines = all.slice(start, start + limit);

    return { routines, total: all.length };
  }

  async getRoutineStatus(routineId: string): Promise<Routine> {
    this.logger.log('Getting routine status: ' + routineId);
    const routine = this.routines.get(routineId);

    if (!routine) {
      throw new Error('Routine not found: ' + routineId);
    }

    return routine;
  }

  async getExecutionLogs(
    routineId: string,
    page: number,
    limit: number,
  ): Promise<{ logs: RoutineLog[]; total: number }> {
    this.logger.log('Getting execution logs: ' + routineId);

    const logs: RoutineLog[] = [
      {
        id: 'log-1',
        routineId,
        status: 'completed',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3500000).toISOString(),
        duration: 100,
      },
      {
        id: 'log-2',
        routineId,
        status: 'completed',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 7100000).toISOString(),
        duration: 100,
      },
    ];

    const start = (page - 1) * limit;
    const sliced = logs.slice(start, start + limit);

    return { logs: sliced, total: logs.length };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class RoutineAutomationTool extends BaseStructuredTool {
  readonly name = 'routine_automation';
  readonly description =
    'Create, manage, and trigger automated routines and scheduled tasks';
  readonly category = ToolCategory.BUSINESS;
  readonly inputSchema = RoutineAutomationInputSchema;

  private readonly log = new Logger(RoutineAutomationTool.name);
  private readonly provider: IRoutineAutomationProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockRoutineAutomationProvider();
  }

  protected async executeImpl(
    input: RoutineAutomationInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Routine Automation action: ' + input.action);

    try {
      switch (input.action) {
        case 'create_routine':
          return await this.handleCreateRoutine(input);
        case 'update_routine':
          return await this.handleUpdateRoutine(input);
        case 'delete_routine':
          return await this.handleDeleteRoutine(input);
        case 'trigger_routine':
          return await this.handleTriggerRoutine(input);
        case 'list_routines':
          return await this.handleListRoutines(input);
        case 'get_routine_status':
          return await this.handleGetRoutineStatus(input);
        case 'get_execution_logs':
          return await this.handleGetExecutionLogs(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Routine Automation action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleCreateRoutine(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (
      !input.name ||
      !input.trigger ||
      !input.actions ||
      input.actions.length === 0
    ) {
      throw new Error(
        'name, trigger, and actions are required for create_routine action',
      );
    }

    const result = await this.provider.createRoutine({
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      actions: input.actions,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleUpdateRoutine(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.routineId) {
      throw new Error('routineId is required for update_routine action');
    }

    const result = await this.provider.updateRoutine(input.routineId, {
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      actions: input.actions,
      status:
        input.enabled === true
          ? 'active'
          : input.enabled === false
            ? 'disabled'
            : undefined,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleDeleteRoutine(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.routineId) {
      throw new Error('routineId is required for delete_routine action');
    }

    const result = await this.provider.deleteRoutine(input.routineId);

    return {
      success: result,
      data: { deleted: result },
    };
  }

  private async handleTriggerRoutine(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.routineId) {
      throw new Error('routineId is required for trigger_routine action');
    }

    const result = await this.provider.triggerRoutine(input.routineId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListRoutines(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listRoutines(page, limit, {
      status: input.filters?.status,
      triggerType: input.filters?.triggerType,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetRoutineStatus(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.routineId) {
      throw new Error('routineId is required for get_routine_status action');
    }

    const result = await this.provider.getRoutineStatus(input.routineId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetExecutionLogs(
    input: RoutineAutomationInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.routineId) {
      throw new Error('routineId is required for get_execution_logs action');
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.getExecutionLogs(
      input.routineId,
      page,
      limit,
    );

    return {
      success: true,
      data: result,
    };
  }
}
