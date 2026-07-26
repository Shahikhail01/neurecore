// src/common/ports/di-tokens.ts
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export const INITIATION_REPOSITORY = Symbol('INITIATION_REPOSITORY');
export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');
export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');
export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

// Phase 4 — agent & task-assignment ports
export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
export const TASK_ASSIGNMENT_REPOSITORY = Symbol('TASK_ASSIGNMENT_REPOSITORY');