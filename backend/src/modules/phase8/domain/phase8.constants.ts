// src/modules/phase8/domain/phase8.constants.ts
// Phase 8 — Security, Observability, and Operations (NC-AWL-IMP-1 §10)
// Shared constants, role/permission matrix, and immutable type definitions.

/**
 * Phase 8 — Role × Action permission matrix.
 *
 * Phase 8 deliverables §10.5 require a "Role/permission matrix" doc
 * (verification: matrix doc). The matrix is implemented here so that:
 *   1. CI can fail if a code path bypasses the matrix.
 *   2. The same matrix is reusable for golden-path negative tests.
 *   3. Server-side evaluation is authoritative (client hints are not).
 *
 * `HUMAN` and `AI_AGENT` actor types are explicitly enumerated; the
 * golden path invariant is that AI_AGENT can never `APPROVE` its own
 * review (per §10.1 + G5 / G6 criteria).
 */
export type Phase8ActorType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

export type Phase8Action =
  | 'INITIATE'
  | 'APPROVE_INITIATION'
  | 'CREATE_PROJECT'
  | 'REQUEST_AUTOMATION'
  | 'CREATE_GOAL'
  | 'CREATE_TASK'
  | 'ASSIGN_TASK'
  | 'REASSIGN_TASK'
  | 'EXECUTE_TASK'
  | 'PRODUCE_EVIDENCE'
  | 'APPROVE_REVIEW'
  | 'REVISION_REQUEST'
  | 'CANCEL_EXECUTION'
  | 'RETRY_EXECUTION'
  | 'COMPLETE_PROJECT'
  | 'ADVANCE_STAGE'
  | 'TOGGLE_FEATURE_FLAG'
  | 'REPLAY_DEAD_LETTER'
  | 'READ_ARTIFACT'
  | 'CREATE_SIDE_EFFECT'
  | 'REDACT_SECRET'
  | 'RECONSTRUCT_TENANT';

export type Phase8Role =
  | 'OWNER'
  | 'ADMIN'
  | 'USER'
  | 'AUDITOR'
  | 'SECURITY_OFFICER'
  | 'PLATFORM_ADMIN'
  | 'SUPER_ADMIN'
  | 'AI_AGENT'
  | 'SYSTEM';

export const PHASE8_PERMISSIONS: Readonly<
  Record<Phase8Role, ReadonlySet<Phase8Action>>
> = Object.freeze({
  OWNER: new Set<Phase8Action>([
    'INITIATE',
    'APPROVE_INITIATION',
    'CREATE_PROJECT',
    'REQUEST_AUTOMATION',
    'CREATE_GOAL',
    'CREATE_TASK',
    'ASSIGN_TASK',
    'REASSIGN_TASK',
    'EXECUTE_TASK',
    'PRODUCE_EVIDENCE',
    'APPROVE_REVIEW',
    'REVISION_REQUEST',
    'CANCEL_EXECUTION',
    'RETRY_EXECUTION',
    'COMPLETE_PROJECT',
    'ADVANCE_STAGE',
    'TOGGLE_FEATURE_FLAG',
    'READ_ARTIFACT',
    'CREATE_SIDE_EFFECT',
    'RECONSTRUCT_TENANT',
  ]),
  ADMIN: new Set<Phase8Action>([
    'INITIATE',
    'APPROVE_INITIATION',
    'CREATE_PROJECT',
    'REQUEST_AUTOMATION',
    'CREATE_GOAL',
    'CREATE_TASK',
    'ASSIGN_TASK',
    'REASSIGN_TASK',
    'EXECUTE_TASK',
    'PRODUCE_EVIDENCE',
    'APPROVE_REVIEW',
    'REVISION_REQUEST',
    'CANCEL_EXECUTION',
    'RETRY_EXECUTION',
    'COMPLETE_PROJECT',
    'ADVANCE_STAGE',
    'TOGGLE_FEATURE_FLAG',
    'READ_ARTIFACT',
    'CREATE_SIDE_EFFECT',
    'RECONSTRUCT_TENANT',
  ]),
  USER: new Set<Phase8Action>([
    'INITIATE',
    'READ_ARTIFACT',
    'APPROVE_REVIEW',
    'REVISION_REQUEST',
  ]),
  AUDITOR: new Set<Phase8Action>(['READ_ARTIFACT']),
  SECURITY_OFFICER: new Set<Phase8Action>([
    'READ_ARTIFACT',
    'TOGGLE_FEATURE_FLAG',
    'REPLAY_DEAD_LETTER',
  ]),
  PLATFORM_ADMIN: new Set<Phase8Action>([
    'READ_ARTIFACT',
    'TOGGLE_FEATURE_FLAG',
    'REPLAY_DEAD_LETTER',
    'RECONSTRUCT_TENANT',
  ]),
  SUPER_ADMIN: new Set<Phase8Action>([
    'INITIATE',
    'APPROVE_INITIATION',
    'CREATE_PROJECT',
    'REQUEST_AUTOMATION',
    'CREATE_GOAL',
    'CREATE_TASK',
    'ASSIGN_TASK',
    'REASSIGN_TASK',
    'EXECUTE_TASK',
    'PRODUCE_EVIDENCE',
    'APPROVE_REVIEW',
    'REVISION_REQUEST',
    'CANCEL_EXECUTION',
    'RETRY_EXECUTION',
    'COMPLETE_PROJECT',
    'ADVANCE_STAGE',
    'TOGGLE_FEATURE_FLAG',
    'REPLAY_DEAD_LETTER',
    'READ_ARTIFACT',
    'CREATE_SIDE_EFFECT',
    'REDACT_SECRET',
    'RECONSTRUCT_TENANT',
  ]),
  AI_AGENT: new Set<Phase8Action>([
    'EXECUTE_TASK',
    'PRODUCE_EVIDENCE',
    'REVISION_REQUEST',
  ]),
  SYSTEM: new Set<Phase8Action>([
    'EXECUTE_TASK',
    'PRODUCE_EVIDENCE',
    'REPLAY_DEAD_LETTER',
    'CREATE_SIDE_EFFECT',
    'REDACT_SECRET',
  ]),
});

/**
 * Actor types that are NEVER allowed to perform approval-class actions
 * over their own work. Encoded as the G5 invariant: "No AI-controlled
 * path can approve its own work" and the matching G6 review rule.
 */
export const SELF_APPROVAL_FORBIDDEN: Readonly<
  Record<Phase8Action, ReadonlySet<Phase8ActorType>>
> = Object.freeze({
  INITIATE: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  APPROVE_INITIATION: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  CREATE_PROJECT: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  REQUEST_AUTOMATION: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  CREATE_GOAL: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  CREATE_TASK: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  ASSIGN_TASK: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  REASSIGN_TASK: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  EXECUTE_TASK: new Set<Phase8ActorType>([]),
  PRODUCE_EVIDENCE: new Set<Phase8ActorType>([]),
  APPROVE_REVIEW: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  REVISION_REQUEST: new Set<Phase8ActorType>([]),
  CANCEL_EXECUTION: new Set<Phase8ActorType>([]),
  RETRY_EXECUTION: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  COMPLETE_PROJECT: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  ADVANCE_STAGE: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  TOGGLE_FEATURE_FLAG: new Set<Phase8ActorType>(['AI_AGENT', 'SYSTEM']),
  REPLAY_DEAD_LETTER: new Set<Phase8ActorType>([]),
  READ_ARTIFACT: new Set<Phase8ActorType>([]),
  CREATE_SIDE_EFFECT: new Set<Phase8ActorType>([]),
  REDACT_SECRET: new Set<Phase8ActorType>([]),
  RECONSTRUCT_TENANT: new Set<Phase8ActorType>(['AI_AGENT']),
});

/**
 * Cross-tenant identifier policy (NC-AWL-IMP-1 §10.1 item 8).
 * A `403` is forbidden: any cross-tenant lookup must surface as a
 * "safe not-found" so that the existence of another tenant's
 * resource is never revealed.
 */
export const CROSS_TENANT_NOT_FOUND_MARKER = 'X_TENANT_NOT_FOUND';

export const PHASE8_REDACTION_FIELDS: readonly string[] = Object.freeze([
  'password',
  'apiKey',
  'api_key',
  'authorization',
  'Authorization',
  'token',
  'refreshToken',
  'accessToken',
  'cookie',
  'bearer',
]);
