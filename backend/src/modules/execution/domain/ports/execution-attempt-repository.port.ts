// src/modules/execution/domain/ports/execution-attempt-repository.port.ts
import type {
  ExecutionAttemptStatus,
  ExecutionEngine,
} from '@prisma/client';

export const EXECUTION_ATTEMPT_REPOSITORY = Symbol('EXECUTION_ATTEMPT_REPOSITORY');

export interface ExecutionAttemptEntity {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  executionRequestId: string;
  attemptNumber: number;
  status: ExecutionAttemptStatus;
  policy: any;
  version: number;
}

export interface CreateExecutionAttemptInput {
  tenantId: string;
  taskId: string;
  agentId: string;
  executionRequestId: string;
  attemptNumber: number;
  status: ExecutionAttemptStatus;
  policy: any;
}

export interface UpdateExecutionAttemptInput {
  id: string;
  status: ExecutionAttemptStatus;
  outputSummary?: string;
  submittedAt?: Date;
  lastError?: string;
  lastErrorClassification?: string;
}

export interface IExecutionAttemptRepository {
  findById(tenantId: string, id: string): Promise<ExecutionAttemptEntity | null>;
  findByRequestId(
    tenantId: string,
    taskId: string,
    executionRequestId: string,
  ): Promise<ExecutionAttemptEntity | null>;
  findLastAttemptNumber(taskId: string): Promise<number>;
  create(input: CreateExecutionAttemptInput, tx?: any): Promise<ExecutionAttemptEntity>;
  update(input: UpdateExecutionAttemptInput, tx?: any): Promise<ExecutionAttemptEntity>;
}
