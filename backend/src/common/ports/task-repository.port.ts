// src/common/ports/task-repository.port.ts
import type { TaskStatus } from '@prisma/client';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface TaskEntity {
  id: string;
  tenantId: string;
  status: TaskStatus;
  title: string;
  version: number;
  agentId: string | null;
}

export interface UpdateTaskStatusInput {
  id: string;
  expectedVersion: number;
  status: TaskStatus;
  agentId?: string;
}

export interface ITaskRepository {
  findById(tenantId: string, id: string): Promise<TaskEntity | null>;
  updateStatus(input: UpdateTaskStatusInput, tx?: any): Promise<TaskEntity>;
  countActiveByAgent(agentId: string, statuses: TaskStatus[]): Promise<number>;
}
