// src/modules/tasks/domain/task-states.ts
import { TaskStatus as PrismaTaskStatus } from '@prisma/client';

export type TaskStatus =
  | 'DRAFT'
  | 'READY'
  | 'PENDING'
  | 'ASSIGNED'
  | 'QUEUED'
  | 'RUNNING'
  | 'IN_PROGRESS'
  | 'NEEDS_INPUT'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'FAILED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ['READY'],
  READY: ['ASSIGNED', 'BLOCKED', 'CANCELLED'],
  PENDING: ['READY', 'QUEUED', 'CANCELLED'],
  ASSIGNED: ['QUEUED', 'READY'],
  QUEUED: ['IN_PROGRESS', 'READY'],
  RUNNING: ['IN_PROGRESS', 'NEEDS_INPUT', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED_RETRYABLE'],
  IN_PROGRESS: ['NEEDS_INPUT', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED_RETRYABLE'],
  NEEDS_INPUT: ['QUEUED', 'CANCELLED'],
  NEEDS_REVIEW: ['APPROVED', 'QUEUED', 'CANCELLED'],
  APPROVED: ['COMPLETED'],
  COMPLETED: [],
  BLOCKED: ['READY'],
  FAILED: ['FAILED_RETRYABLE', 'CANCELLED', 'QUEUED'],
  FAILED_RETRYABLE: ['QUEUED', 'FAILED_FINAL', 'CANCELLED'],
  FAILED_FINAL: [],
  CANCELLED: [],
};

export class TaskStateMachine {
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TASK_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: string, to: string): void {
    if (!TASK_TRANSITIONS[from as TaskStatus]?.includes(to as TaskStatus)) {
      throw new Error(`Invalid task transition from ${from} to ${to}`);
    }
  }
}

export { PrismaTaskStatus };
