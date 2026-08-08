/**
 * Phase 23 — Agent Runtime errors.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23).
 *
 * Every runtime failure is a typed error so callers, certification
 * gates, and audit sinks can react with structural specificity —
 * never a bare `new Error('...')`.
 */

export class AgentUnsupportedIntentError extends Error {
  constructor(
    readonly agentId: string,
    readonly intent: string,
  ) {
    super(`agent ${agentId} does not support intent '${intent}'`);
    this.name = 'AgentUnsupportedIntentError';
  }
}

export class AgentClarificationRequiredError extends Error {
  constructor(
    readonly agentId: string,
    readonly prompt: string,
    readonly suggestions: ReadonlyArray<string>,
  ) {
    super(`agent ${agentId} requires clarification: ${prompt}`);
    this.name = 'AgentClarificationRequiredError';
  }
}

export class AgentNotRegisteredError extends Error {
  constructor(readonly id: string) {
    super(`agent runtime: executor for ${id} is not registered`);
    this.name = 'AgentNotRegisteredError';
  }
}

export class AgentRunNotFoundError extends Error {
  constructor(readonly runId: string) {
    super(`agent run ${runId} not found`);
    this.name = 'AgentRunNotFoundError';
  }
}

export class AgentRunTenantMismatchError extends Error {
  constructor(
    readonly runId: string,
    readonly tenantId: string,
  ) {
    super(`agent run ${runId} is not accessible to tenant ${tenantId}`);
    this.name = 'AgentRunTenantMismatchError';
  }
}

export class AgentApprovalRequiredError extends Error {
  constructor(
    readonly agentId: string,
    readonly skillKey: string,
  ) {
    super(`agent ${agentId} requires human approval to invoke ${skillKey}`);
    this.name = 'AgentApprovalRequiredError';
  }
}

export class AgentSkillAuthorizationError extends Error {
  constructor(
    readonly skillKey: string,
    readonly reason: 'CROSS_TENANT' | 'MISSING_TENANT' | 'AUTH_REJECTED',
  ) {
    super(`skill ${skillKey} authorization rejected: ${reason}`);
    this.name = 'AgentSkillAuthorizationError';
  }
}
