// src/modules/assignments/domain/ports/task-assignment-repository.port.ts
export const TASK_ASSIGNMENT_REPOSITORY = Symbol('TASK_ASSIGNMENT_REPOSITORY');

export interface TaskAssignmentEntity {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  status: string;
}

export interface CreateTaskAssignmentInput {
  tenantId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  status?: string;
}

export interface ITaskAssignmentRepository {
  findByGeneration(
    tenantId: string,
    taskId: string,
    generation: number,
  ): Promise<TaskAssignmentEntity | null>;

  create(input: CreateTaskAssignmentInput, tx?: any): Promise<TaskAssignmentEntity>;
}
