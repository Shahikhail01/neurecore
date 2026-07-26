// src/common/idempotency/idempotency-matrix.ts
export interface IdempotencySpec {
  aggregateType: string;
  operation: string;
  uniquenessConstraint: string;
  replayBehavior: 'RETURN_CACHE' | 'REPLAY' | 'REJECT';
}

export const IDEMPOTENCY_MATRIX: IdempotencySpec[] = [
  {
    aggregateType: 'EnterpriseInitiation',
    operation: 'ApproveEnterpriseInitiation',
    uniquenessConstraint: 'initiationId',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Project',
    operation: 'CreateProjectFromInitiation',
    uniquenessConstraint: 'initiationId + commandType',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'ProjectAutomation',
    operation: 'RequestAutomation',
    uniquenessConstraint: 'projectId + commandType',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Goal',
    operation: 'CreateGoal',
    uniquenessConstraint: 'tenantId + projectId + automationVersion + templateGoalKey',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'Task',
    operation: 'CreateTask',
    uniquenessConstraint: 'tenantId + projectId + automationVersion + templateTaskKey',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'TaskAssignment',
    operation: 'AssignTask',
    uniquenessConstraint: 'tenantId + taskId + assignmentGeneration',
    replayBehavior: 'RETURN_CACHE',
  },
  {
    aggregateType: 'ExecutionAttempt',
    operation: 'RequestExecution',
    uniquenessConstraint: 'tenantId + taskId + executionRequestId',
    replayBehavior: 'RETURN_CACHE',
  },
];
