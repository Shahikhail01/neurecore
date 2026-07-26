// src/modules/timeline/timeline.types.ts
export interface TimelineEvent {
  id: string;
  tenantId: string;
  entityType: 'Initiation' | 'Project' | 'Goal' | 'Task' | 'ExecutionAttempt' | 'Review';
  entityId: string;
  eventType: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  actorId: string;
  actorName: string;
  payload: Record<string, unknown>;
  correlationId: string;
  occurredAt: Date;
}

export const GOLDEN_PATH_EVENTS = [
  'InitiationCreated',
  'InitiationRevised',
  'InitiationApproved',
  'ProjectCreated',
  'AutomationRequested',
  'AutomationStarted',
  'AutomationCompleted',
  'GoalCreated',
  'TaskCreated',
  'AIAgentAssigned',
  'AIAgentReassigned',
  'ExecutionQueued',
  'ExecutionStarted',
  'ExecutionPaused',
  'ExecutionResumed',
  'ExecutionFailed',
  'ExecutionSubmitted',
  'EvidenceCreated',
  'ReviewRequested',
  'ReviewApproved',
  'RevisionRequested',
  'TaskCompleted',
  'StageAdvanced',
  'ProjectCompleted',
  'OperatorRetry',
  'WaiverGranted',
];
