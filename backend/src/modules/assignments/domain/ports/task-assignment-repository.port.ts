// src/modules/assignments/domain/ports/task-assignment-repository.port.ts
export { TASK_ASSIGNMENT_REPOSITORY };

import { TASK_ASSIGNMENT_REPOSITORY } from '../../../../common/ports/di-tokens';

export type TaskAssignmentStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED';

export interface TaskAssignmentEntity {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  status: TaskAssignmentStatus;
  version: number;
  releasedAt: Date | null;
  releasedByActorId: string | null;
  releaseReason: string | null;
  expiresAt: Date | null;
}

export interface CreateTaskAssignmentInput {
  tenantId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  status?: TaskAssignmentStatus;
  expiresAt?: Date | null;
}

export interface UpdateTaskAssignmentStatusInput {
  id: string;
  expectedVersion: number;
  status: TaskAssignmentStatus;
  releasedAt?: Date | null;
  releasedByActorId?: string | null;
  releaseReason?: string | null;
}

export interface TaskAssignmentOverrideAuditEntity {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  assignmentGeneration: number;
  previousAgentId: string | null;
  rationale: string;
  overrideByActorId: string;
  overrideByActorType: string;
  dataClassificationAtOverride: string | null;
  occurredAt: Date;
}

export interface CreateAssignmentOverrideAuditInput {
  tenantId: string;
  taskId: string;
  agentId: string;
  assignmentGeneration: number;
  previousAgentId: string | null;
  rationale: string;
  overrideByActorId: string;
  overrideByActorType: string;
  dataClassificationAtOverride?: string | null;
}

export interface ITaskAssignmentRepository {
  findByGeneration(
    tenantId: string,
    taskId: string,
    generation: number,
    tx?: any,
  ): Promise<TaskAssignmentEntity | null>;

  findLatestActive(
    tenantId: string,
    taskId: string,
    tx?: any,
  ): Promise<TaskAssignmentEntity | null>;

  create(
    input: CreateTaskAssignmentInput,
    tx?: any,
  ): Promise<TaskAssignmentEntity>;

  updateStatus(
    input: UpdateTaskAssignmentStatusInput,
    tx?: any,
  ): Promise<TaskAssignmentEntity>;

  releaseExpired(
    now: Date,
    tx?: any,
  ): Promise<number>;

  /**
   * Promote expired ACTIVE rows to EXPIRED in a single pass and return
   * the rows that were transitioned so the caller can emit per-row
   * TaskAssignmentReleased outbox events.
   */
  releaseExpiredWithContext(
    now: Date,
    tx?: any,
  ): Promise<TaskAssignmentEntity[]>;

  recordOverrideAudit(
    input: CreateAssignmentOverrideAuditInput,
    tx?: any,
  ): Promise<TaskAssignmentOverrideAuditEntity>;

  listOverrideAudits(
    tenantId: string,
    taskId: string,
    limit?: number,
  ): Promise<TaskAssignmentOverrideAuditEntity[]>;
}
