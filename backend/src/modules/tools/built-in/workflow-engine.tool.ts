/**
 * Workflow Engine Tool - P2-9 of remaining tools
 * Enables AI agents to orchestrate complex multi-step workflows
 * For Task Router, Orchestration agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for workflow orchestration
 * - OCP: Extensible via workflow provider interfaces
 * - DIP: Depends on abstractions for workflow providers
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

export const WorkflowEngineActionEnum = z.enum([
  'create_workflow',
  'execute_workflow',
  'pause_workflow',
  'resume_workflow',
  'get_workflow_status',
  'list_workflows',
  'get_workflow_history',
]);

export type WorkflowEngineAction = z.infer<typeof WorkflowEngineActionEnum>;

export const WorkflowEngineInputSchema = z.object({
  action: WorkflowEngineActionEnum.describe(
    'The workflow engine action to perform',
  ),
  workflowId: z.string().optional().describe('Workflow ID'),
  name: z.string().optional().describe('Workflow name'),
  description: z.string().optional().describe('Workflow description'),
  steps: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        action: z.string(),
        params: z.record(z.unknown()).optional(),
        retry: z
          .object({
            maxAttempts: z.number().int().positive().optional(),
            delayMs: z.number().int().positive().optional(),
          })
          .optional(),
        condition: z.string().optional(),
      }),
    )
    .optional()
    .describe('Workflow steps definition'),
  trigger: z
    .object({
      type: z.enum(['manual', 'scheduled', 'event']),
      cron: z.string().optional(),
      event: z.string().optional(),
    })
    .optional(),
  input: z.record(z.unknown()).optional().describe('Workflow input data'),
  executionId: z.string().optional().describe('Execution ID'),
  filters: z
    .object({
      status: z.enum(['running', 'completed', 'failed', 'paused']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type WorkflowEngineInput = z.infer<typeof WorkflowEngineInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type Workflow = {
  id: string;
  name: string;
  description?: string;
  steps: Array<{
    id: string;
    name: string;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  }>;
  trigger: { type: string; cron?: string; event?: string };
  status: 'active' | 'paused' | 'draft';
  createdAt: string;
  updatedAt: string;
};

type WorkflowExecution = {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

type WorkflowHistory = Array<{
  id: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IWorkflowEngineProvider {
  createWorkflow(workflow: {
    name: string;
    description?: string;
    steps: Array<{
      id: string;
      name: string;
      action: string;
      params?: Record<string, unknown>;
      retry?: { maxAttempts?: number; delayMs?: number };
      condition?: string;
    }>;
    trigger?: { type: string; cron?: string; event?: string };
  }): Promise<Workflow>;

  executeWorkflow(
    workflowId: string,
    input?: Record<string, unknown>,
  ): Promise<WorkflowExecution>;

  pauseWorkflow(workflowId: string): Promise<boolean>;

  resumeWorkflow(workflowId: string): Promise<boolean>;

  getWorkflowStatus(workflowId: string): Promise<Workflow>;

  listWorkflows(
    page: number,
    limit: number,
  ): Promise<{ workflows: Workflow[]; total: number }>;

  getWorkflowHistory(
    workflowId: string,
    page: number,
    limit: number,
  ): Promise<{ history: WorkflowHistory; total: number }>;
}

// ─────────────────────────────────────────────────────────────
// Mock Workflow Engine Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockWorkflowEngineProvider implements IWorkflowEngineProvider {
  private readonly logger = new Logger(MockWorkflowEngineProvider.name);
  private readonly workflows = new Map<string, Workflow>();
  private readonly executions = new Map<string, WorkflowExecution>();

  async createWorkflow(workflow: {
    name: string;
    description?: string;
    steps: Array<{
      id: string;
      name: string;
      action: string;
      params?: Record<string, unknown>;
      retry?: { maxAttempts?: number; delayMs?: number };
      condition?: string;
    }>;
    trigger?: { type: string; cron?: string; event?: string };
  }): Promise<Workflow> {
    this.logger.log('Creating workflow: ' + workflow.name);

    const id = 'wf-' + Date.now();
    const now = new Date().toISOString();

    const newWorkflow: Workflow = {
      id,
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps.map((s) => ({
        ...s,
        status: 'pending' as const,
      })),
      trigger: workflow.trigger || { type: 'manual' },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  async executeWorkflow(
    workflowId: string,
    input?: Record<string, unknown>,
  ): Promise<WorkflowExecution> {
    this.logger.log('Executing workflow: ' + workflowId);

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found: ' + workflowId);
    }

    const executionId = 'exec-' + Date.now();
    const now = new Date().toISOString();

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      currentStep: workflow.steps[0]?.id,
      input: input || {},
      startedAt: now,
    };

    this.executions.set(executionId, execution);

    // Simulate execution completion
    setTimeout(() => {
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = { result: 'Workflow completed successfully' };
    }, 1000);

    return execution;
  }

  async pauseWorkflow(workflowId: string): Promise<boolean> {
    this.logger.log('Pausing workflow: ' + workflowId);
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      return false;
    }

    workflow.status = 'paused';
    return true;
  }

  async resumeWorkflow(workflowId: string): Promise<boolean> {
    this.logger.log('Resuming workflow: ' + workflowId);
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      return false;
    }

    workflow.status = 'active';
    return true;
  }

  async getWorkflowStatus(workflowId: string): Promise<Workflow> {
    this.logger.log('Getting workflow status: ' + workflowId);
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error('Workflow not found: ' + workflowId);
    }

    return workflow;
  }

  async listWorkflows(
    page: number,
    limit: number,
  ): Promise<{ workflows: Workflow[]; total: number }> {
    this.logger.log('Listing workflows');
    const all = Array.from(this.workflows.values());
    const start = (page - 1) * limit;
    const workflows = all.slice(start, start + limit);

    return { workflows, total: all.length };
  }

  async getWorkflowHistory(
    workflowId: string,
    page: number,
    limit: number,
  ): Promise<{ history: WorkflowHistory; total: number }> {
    this.logger.log('Getting workflow history: ' + workflowId);

    const history: WorkflowHistory = [
      {
        id: 'exec-1',
        status: 'completed',
        startTime: new Date(Date.now() - 86400000).toISOString(),
        endTime: new Date(Date.now() - 86300000).toISOString(),
        duration: 1000,
      },
      {
        id: 'exec-2',
        status: 'failed',
        startTime: new Date(Date.now() - 172800000).toISOString(),
        endTime: new Date(Date.now() - 171800000).toISOString(),
        duration: 1000,
      },
    ];

    const start = (page - 1) * limit;
    const sliced = history.slice(start, start + limit);

    return { history: sliced, total: history.length };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowEngineTool extends BaseStructuredTool {
  readonly name = 'workflow_engine';
  readonly description =
    'Create, execute, and manage complex multi-step workflows and automation sequences';
  readonly category = ToolCategory.BUSINESS;
  readonly inputSchema = WorkflowEngineInputSchema;

  private readonly log = new Logger(WorkflowEngineTool.name);
  private readonly provider: IWorkflowEngineProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockWorkflowEngineProvider();
  }

  protected async executeImpl(
    input: WorkflowEngineInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Workflow Engine action: ' + input.action);

    try {
      switch (input.action) {
        case 'create_workflow':
          return await this.handleCreateWorkflow(input);
        case 'execute_workflow':
          return await this.handleExecuteWorkflow(input);
        case 'pause_workflow':
          return await this.handlePauseWorkflow(input);
        case 'resume_workflow':
          return await this.handleResumeWorkflow(input);
        case 'get_workflow_status':
          return await this.handleGetWorkflowStatus(input);
        case 'list_workflows':
          return await this.handleListWorkflows(input);
        case 'get_workflow_history':
          return await this.handleGetWorkflowHistory(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(
        'Workflow Engine action failed: ' + err.message,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  private async handleCreateWorkflow(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.name || !input.steps || input.steps.length === 0) {
      throw new Error('name and steps are required for create_workflow action');
    }

    const result = await this.provider.createWorkflow({
      name: input.name,
      description: input.description,
      steps: input.steps,
      trigger: input.trigger,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleExecuteWorkflow(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.workflowId) {
      throw new Error('workflowId is required for execute_workflow action');
    }

    const result = await this.provider.executeWorkflow(
      input.workflowId,
      input.input,
    );

    return {
      success: true,
      data: result,
    };
  }

  private async handlePauseWorkflow(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.workflowId) {
      throw new Error('workflowId is required for pause_workflow action');
    }

    const result = await this.provider.pauseWorkflow(input.workflowId);

    return {
      success: result,
      data: { paused: result },
    };
  }

  private async handleResumeWorkflow(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.workflowId) {
      throw new Error('workflowId is required for resume_workflow action');
    }

    const result = await this.provider.resumeWorkflow(input.workflowId);

    return {
      success: result,
      data: { resumed: result },
    };
  }

  private async handleGetWorkflowStatus(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.workflowId) {
      throw new Error('workflowId is required for get_workflow_status action');
    }

    const result = await this.provider.getWorkflowStatus(input.workflowId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListWorkflows(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.listWorkflows(page, limit);

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetWorkflowHistory(
    input: WorkflowEngineInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.workflowId) {
      throw new Error('workflowId is required for get_workflow_history action');
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.getWorkflowHistory(
      input.workflowId,
      page,
      limit,
    );

    return {
      success: true,
      data: result,
    };
  }
}
