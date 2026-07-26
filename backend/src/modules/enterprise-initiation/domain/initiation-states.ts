// src/modules/enterprise-initiation/domain/initiation-states.ts
export enum InitiationStatus {
  DRAFT = 'DRAFT',
  DISCOVERING = 'DISCOVERING',
  READY_FOR_CONFIRMATION = 'READY_FOR_CONFIRMATION',
  APPROVED = 'APPROVED',
  MATERIALIZING = 'MATERIALIZING',
  COMPLETED = 'COMPLETED',
  NEEDS_INPUT = 'NEEDS_INPUT',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
  CANCELLED = 'CANCELLED',
}

export const INITIATION_TRANSITIONS: Record<InitiationStatus, InitiationStatus[]> = {
  [InitiationStatus.DRAFT]: [InitiationStatus.DISCOVERING],
  [InitiationStatus.DISCOVERING]: [
    InitiationStatus.READY_FOR_CONFIRMATION,
    InitiationStatus.NEEDS_INPUT,
  ],
  [InitiationStatus.READY_FOR_CONFIRMATION]: [
    InitiationStatus.APPROVED,
    InitiationStatus.DISCOVERING,
    InitiationStatus.CANCELLED,
  ],
  [InitiationStatus.APPROVED]: [InitiationStatus.MATERIALIZING],
  [InitiationStatus.MATERIALIZING]: [
    InitiationStatus.COMPLETED,
    InitiationStatus.FAILED_RETRYABLE,
  ],
  [InitiationStatus.COMPLETED]: [],
  [InitiationStatus.NEEDS_INPUT]: [InitiationStatus.DISCOVERING],
  [InitiationStatus.FAILED_RETRYABLE]: [
    InitiationStatus.MATERIALIZING,
    InitiationStatus.FAILED_FINAL,
  ],
  [InitiationStatus.FAILED_FINAL]: [InitiationStatus.CANCELLED],
  [InitiationStatus.CANCELLED]: [],
};

export interface InitiationTransition {
  from: InitiationStatus;
  to: InitiationStatus;
  command: string;
  authorizedActorTypes: ('HUMAN' | 'AI_AGENT' | 'SYSTEM')[];
  guardCondition?: string;
  emittedEvent: string;
  idempotencyKey: string;
}

export const INITIATION_TRANSITION_DEFINITIONS: InitiationTransition[] = [
  {
    from: InitiationStatus.DRAFT,
    to: InitiationStatus.DISCOVERING,
    command: 'StartDiscoveryCommand',
    authorizedActorTypes: ['HUMAN', 'AI_AGENT', 'SYSTEM'],
    emittedEvent: 'InitiationDiscoveryStarted',
    idempotencyKey: 'discovery',
  },
  {
    from: InitiationStatus.DISCOVERING,
    to: InitiationStatus.READY_FOR_CONFIRMATION,
    command: 'CompleteDiscoveryCommand',
    authorizedActorTypes: ['AI_AGENT', 'SYSTEM'],
    emittedEvent: 'InitiationDiscoveryCompleted',
    idempotencyKey: 'discovery-complete',
  },
  {
    from: InitiationStatus.READY_FOR_CONFIRMATION,
    to: InitiationStatus.APPROVED,
    command: 'ApproveEnterpriseInitiationCommand',
    authorizedActorTypes: ['HUMAN'],
    guardCondition: 'actor has TENANT_ADMIN role',
    emittedEvent: 'InitiationApproved',
    idempotencyKey: 'approve',
  },
];
