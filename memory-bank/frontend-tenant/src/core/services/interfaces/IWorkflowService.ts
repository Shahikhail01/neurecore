// ─── IWorkflowService.ts ─────────────────────────────────────────────────────
// ISP: Workflow runtime operations. Builder logic is separate.

import type { Workflow, WorkflowStatus } from '@/shared/types/domain.types';
import type { CreateWorkflowDto, UpdateWorkflowDto } from '@/core/repositories/WorkflowRepository';

export interface WorkflowFilters {
  status?: WorkflowStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface WorkflowExecutionSummary {
  workflowId: string;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  lastRunAt?: string;
  status: string;
}

export interface IWorkflowService {
  listWorkflows(filters?: WorkflowFilters): Promise<{ workflows: Workflow[]; total: number }>;
  getWorkflow(id: string): Promise<Workflow>;
  createWorkflow(data: CreateWorkflowDto): Promise<Workflow>;
  updateWorkflow(id: string, data: UpdateWorkflowDto): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  activateWorkflow(id: string): Promise<Workflow>;
  executeWorkflow(id: string): Promise<void>;
  getExecutionSummary(id: string): Promise<WorkflowExecutionSummary>;
}
