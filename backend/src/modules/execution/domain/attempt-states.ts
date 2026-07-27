// src/modules/execution/domain/attempt-states.ts
import { ExecutionAttemptStatus as PrismaExecutionAttemptStatus } from '@prisma/client';

export type ExecutionAttemptStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_TOOL'
  | 'PRODUCING_EVIDENCE'
  | 'SUBMITTED_FOR_REVIEW'
  | 'PAUSED'
  | 'NEEDS_INPUT'
  | 'TIMED_OUT'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export const ATTEMPT_TRANSITIONS: Record<
  ExecutionAttemptStatus,
  ExecutionAttemptStatus[]
> = {
  CREATED: ['QUEUED'],
  QUEUED: ['RUNNING'],
  RUNNING: [
    'WAITING_FOR_TOOL',
    'PRODUCING_EVIDENCE',
    'PAUSED',
    'NEEDS_INPUT',
    'TIMED_OUT',
    'FAILED_RETRYABLE',
  ],
  WAITING_FOR_TOOL: ['RUNNING', 'FAILED_RETRYABLE'],
  PRODUCING_EVIDENCE: ['SUBMITTED_FOR_REVIEW', 'FAILED_RETRYABLE'],
  SUBMITTED_FOR_REVIEW: [],
  PAUSED: ['RUNNING', 'CANCELLED'],
  NEEDS_INPUT: ['RUNNING'],
  TIMED_OUT: ['FAILED_RETRYABLE'],
  FAILED_RETRYABLE: ['QUEUED', 'FAILED_FINAL'],
  FAILED_FINAL: [],
  CANCELLED: [],
};

export class AttemptStateMachine {
  static canTransition(
    from: ExecutionAttemptStatus,
    to: ExecutionAttemptStatus,
  ): boolean {
    return ATTEMPT_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: string, to: string): void {
    if (
      !ATTEMPT_TRANSITIONS[from as ExecutionAttemptStatus]?.includes(
        to as ExecutionAttemptStatus,
      )
    ) {
      throw new Error(`Invalid attempt transition from ${from} to ${to}`);
    }
  }
}

export { PrismaExecutionAttemptStatus };
