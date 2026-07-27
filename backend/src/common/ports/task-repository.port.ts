// src/common/ports/task-repository.port.ts
import type { TaskStatus } from '@prisma/client';
export { TASK_REPOSITORY };

import { TASK_REPOSITORY } from './di-tokens';

export interface TaskEntity {
  id: string;
  tenantId: string;
  status: TaskStatus;
  title: string;
  version: number;
  agentId: string | null;
  requiredRole: string | null;
  requiredCapabilities: string[];
  dataClassification: string | null;
  departmentId: string | null;
}

export interface UpdateTaskStatusInput {
  id: string;
  tenantId?: string;
  expectedVersion: number;
  status: TaskStatus;
  agentId?: string | null;
  /** When present, the update is gated by version equality. */
  requireVersionMatch?: boolean;
}

export interface UpdateTaskAssignmentInput {
  id: string;
  expectedVersion: number;
  agentId: string | null;
  status: TaskStatus;
}

export interface ITaskRepository {
  findById(tenantId: string, id: string, tx?: any): Promise<TaskEntity | null>;
  findByProjectAndStatuses(
    tenantId: string,
    projectId: string,
    statuses: TaskStatus[],
    tx?: any,
  ): Promise<Array<Pick<TaskEntity, 'id' | 'title' | 'status'>>>;
  updateStatus(input: UpdateTaskStatusInput, tx?: any): Promise<TaskEntity>;
  /**
   * Count tasks currently in any of the supplied statuses for the
   * given agent. Used both for eligibility checks (active workload)
   * and for "does the agent have a free slot" claims.
   */
  countActiveByAgent(agentId: string, statuses: TaskStatus[]): Promise<number>;
  /**
   * Optimistic update for task ↔ agent linkage during the AssignTask
   * transaction. Returns the updated entity; throws
   * `OPTIMISTIC_LOCK_FAILED` if expectedVersion ≠ currentVersion.
   */
  updateAssignment(
    input: UpdateTaskAssignmentInput,
    tx?: any,
  ): Promise<TaskEntity>;
}
