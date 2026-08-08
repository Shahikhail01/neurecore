/**
 * Phase 23 — DI tokens for the AgentRuntime module.
 *
 * SOLID — DIP: every dependency the runtime or its executors need is
 * addressed by symbol, so tests can substitute narrow fakes and the
 * module wiring stays decoupled.
 */

export const AGENT_REGISTRY = Symbol('AGENT_REGISTRY_RUNTIME');
export const SKILL_REGISTRY = Symbol('SKILL_REGISTRY_RUNTIME');
export const TENANT_SCOPE = Symbol('TENANT_SCOPE_RUNTIME');
export const AUDIT_SINK = Symbol('AUDIT_SINK_RUNTIME');
export const AGENT_EXECUTORS = Symbol('AGENT_EXECUTORS');
export const AGENT_ROUTER = Symbol('AGENT_ROUTER');
export const AGENT_RUN_STORE = Symbol('AGENT_RUN_STORE');
export const AGENT_RUNTIME = Symbol('AGENT_RUNTIME');
export const CLARIFY_STEP = Symbol('CLARIFY_STEP');
export const SKILL_STEP = Symbol('SKILL_STEP');
export const WRITE_STEP = Symbol('WRITE_STEP');
