// src/modules/timeline/timeline.types.ts
//
// Phase 7 (§9.2) — Authoritative timeline event contract.
//
// The stored representation is the existing `TimelineEvent` row (see
// `prisma/schema.prisma`). This file re-exports the public, type-safe
// shape that the gateway, controller, and frontend consume so the
// golden-path observers receive a uniform timeline regardless of which
// subsystem emitted the event.

export type SupportedEntityType =
  | 'Initiation'
  | 'Project'
  | 'Goal'
  | 'Task'
  | 'ExecutionAttempt'
  | 'Review';

export type ActorType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

export interface TimelineEvent {
  id: string;
  tenantId: string;
  entityType: SupportedEntityType;
  entityId: string;
  eventType: string;
  title: string;
  description: string;
  actorType: ActorType;
  actorId: string;
  actorName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  correlationId: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

// Whitelist of event types surfaced on the unified timeline. Mirrors
// the documented golden-path event catalog (Phase 7 §9.2).
export const GOLDEN_PATH_EVENTS = [
  'InitiationCreated',
  'InitiationRevised',
  'InitiationApproved',
  'ProjectCreated',
  'AutomationRequested',
  'AutomationStarted',
  'AutomationCompleted',
  'AutomationFailed',
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
  'OperatorCancel',
  'WaiverGranted',
] as const;

export type GoldenPathEventType = (typeof GOLDEN_PATH_EVENTS)[number];

export function isSupportedEntityType(
  value: string,
): value is SupportedEntityType {
  return (
    value === 'Initiation' ||
    value === 'Project' ||
    value === 'Goal' ||
    value === 'Task' ||
    value === 'ExecutionAttempt' ||
    value === 'Review'
  );
}
