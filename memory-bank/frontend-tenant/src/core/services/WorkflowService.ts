// ─── WorkflowService.ts ───────────────────────────────────────────────────────
// SRP: Workflow lifecycle management.
// DIP: Depends on abstractions; workout-repository specific methods accessed via cast.

import type {
  IWorkflowService,
  WorkflowFilters,
  WorkflowExecutionSummary,
} from '@/core/services/interfaces/IWorkflowService';
import type { Workflow } from '@/shared/types/domain.types';
import { workflowRepository, type CreateWorkflowDto, type UpdateWorkflowDto } from '@/core/repositories/WorkflowRepository';

export class WorkflowService implements IWorkflowService {
  constructor(private readonly repository: typeof workflowRepository) {}

  async listWorkflows(filters?: WorkflowFilters): Promise<{ workflows: Workflow[]; total: number }> {
    const { items, total } = await this.repository.findAll(
      filters as import('@/core/repositories/interfaces/IRepository').QueryParams,
    );
    return { workflows: items, total };
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const wf = await this.repository.findById(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);
    return wf;
  }

  async createWorkflow(data: CreateWorkflowDto): Promise<Workflow> {
    return this.repository.create(data);
  }

  async updateWorkflow(id: string, data: UpdateWorkflowDto): Promise<Workflow> {
    return this.repository.update(id, data);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  async activateWorkflow(id: string): Promise<Workflow> {
    return this.repository.activate(id);
  }

  async executeWorkflow(id: string): Promise<void> {
    await this.repository.execute(id);
  }

  async getExecutionSummary(workflowId: string): Promise<WorkflowExecutionSummary> {
    const wf = await this.getWorkflow(workflowId);
    return {
      workflowId,
      totalRuns: wf.executionCount,
      successRate: wf.successRate,
      avgDurationMs: 0,
      lastRunAt: wf.lastExecutedAt,
      status: wf.status,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const workflowService = new WorkflowService(workflowRepository);
