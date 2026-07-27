import type { ExecutionAttemptStatus } from '@prisma/client';

export const EXECUTION_ATTEMPT_REPOSITORY = Symbol(
  'EXECUTION_ATTEMPT_REPOSITORY',
);

export interface ExecutionAttemptEntity {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  executionRequestId: string;
  attemptNumber: number;
  status: ExecutionAttemptStatus;
  policy: any;
  taskInstructionsSnapshot: string | null;
  inputSnapshot: any;
  projectContextSnapshot: any;
  promptVersion: string | null;
  graphVersion: string | null;
  modelVersion: string | null;
  toolVersion: string | null;
  outputSummary: string | null;
  submittedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  heartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
  ownerToken: string | null;
  fencingToken: number;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  tokensUsed: number;
  costCents: number;
  toolCallCount: number;
  lastError: string | null;
  lastErrorClassification: string | null;
  parentAttemptId: string | null;
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
  taskInstructionsSnapshot?: string;
  inputSnapshot?: any;
  projectContextSnapshot?: any;
  parentAttemptId?: string;
}

export interface UpdateExecutionAttemptInput {
  id: string;
  tenantId?: string;
  expectedVersion?: number;
  ownerToken?: string;
  status: ExecutionAttemptStatus;
  outputSummary?: string;
  submittedAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  lastError?: string;
  lastErrorClassification?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  tokensUsed?: number;
  costCents?: number;
  toolCallCount?: number;
}

export interface ExecutionClaim {
  attempt: ExecutionAttemptEntity;
  ownerToken: string;
}

export interface IExecutionAttemptRepository {
  findById(
    tenantId: string,
    id: string,
  ): Promise<ExecutionAttemptEntity | null>;
  findByRequestId(
    tenantId: string,
    taskId: string,
    executionRequestId: string,
  ): Promise<ExecutionAttemptEntity | null>;
  findLastAttemptNumber(taskId: string): Promise<number>;
  create(
    input: CreateExecutionAttemptInput,
    tx?: any,
  ): Promise<ExecutionAttemptEntity>;
  update(
    input: UpdateExecutionAttemptInput,
    tx?: any,
  ): Promise<ExecutionAttemptEntity>;
  claimForExecution(
    tenantId: string,
    attemptId: string,
    leaseMs: number,
  ): Promise<ExecutionClaim | null>;
  updateHeartbeat(
    tenantId: string,
    attemptId: string,
    ownerToken: string,
    leaseMs: number,
  ): Promise<void>;
  findStaleAttempts(now: Date): Promise<ExecutionAttemptEntity[]>;
  cancelAtomic(
    tenantId: string,
    attemptId: string,
    reason: string,
  ): Promise<boolean>;
  reclaimOrphan(
    tenantId: string,
    attemptId: string,
    expectedFencingToken: number,
    targetStatus: 'FAILED_FINAL' | 'FAILED_RETRYABLE',
    lastError: string,
  ): Promise<boolean>;
  claimFromStale(
    tenantId: string,
    attemptId: string,
    expectedFencingToken: number,
    leaseMs: number,
  ): Promise<ExecutionClaim | null>;
}
