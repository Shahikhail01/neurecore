/**
 * Phase 23 — Agent Runtime narrow contracts.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23).
 *
 * SOLID — ISP / DIP:
 *   - `IAgentExecutor` is the single narrow contract every runtime
 *     executor implements. No `fat-base` methods.
 *   - `IAgentRunStore` is persistence-only. It does not know about
 *     routing, LLM calls, or skill dispatch.
 *   - `IAgentRouter` is intent → agent id. It does not run anything.
 *   - `IAgentRuntime` orchestrates executors via the store; it does
 *     not persist by itself.
 *
 * Every contract is ≤ 5 public methods (ISP). Every collaborator is
 * injected (DIP).
 */

import type { AgentId } from '../../agent-templates/agents.registry';
import type { TenantContext } from '../../../common/context/tenant-context';
import type { UserRole } from '@prisma/client';

// ──────────────────────────────────────────────────────────────
// Request / result types — domain-only, never Prisma-shaped.
// ──────────────────────────────────────────────────────────────

export type AgentRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CLARIFICATION_REQUIRED'
  | 'APPROVAL_REQUIRED';

export interface AgentRunRequest {
  readonly agentId: AgentId;
  readonly intent: string;
  readonly message: string;
  readonly conversationId?: string;
  readonly skillInputs?: Readonly<Record<string, unknown>>;
  readonly explicitSkillKey?: string;
}

export interface AgentRunClarification {
  readonly prompt: string;
  readonly suggestions: ReadonlyArray<string>;
}

export interface AgentRunEvidence {
  readonly skillKey: string;
  readonly confidence: number;
  readonly citationsCount: number;
  readonly durationMs: number;
}

export interface AgentRunResult {
  readonly runId: string;
  readonly agentId: AgentId;
  readonly status: AgentRunStatus;
  readonly finalOutput?: string;
  readonly clarification?: AgentRunClarification;
  readonly evidence: ReadonlyArray<AgentRunEvidence>;
  readonly startedAt: string;
  readonly finishedAt: string;
}

export interface AgentRunRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly agentId: AgentId;
  readonly intent: string;
  readonly status: AgentRunStatus;
  readonly finalOutput: string | null;
  readonly clarificationPrompt: string | null;
  readonly clarificationSuggestions: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<AgentRunEvidence>;
  readonly actorUserId: string;
  readonly conversationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// IAgentRouter — intent → agentId (+ optional clarification).
// ──────────────────────────────────────────────────────────────

export interface AgentRouteResolution {
  readonly agentId: AgentId;
  readonly clarification?: AgentRunClarification;
}

export interface IAgentRouter {
  resolve(
    intent: string,
    explicitAgentId: AgentId | undefined,
  ): AgentRouteResolution;
  /**
   * Pure deterministic classification for known intent prefixes. Used
   * to gate the typed-clarification path. Returns `null` when no
   * match.
   */
  classify(message: string, explicitAgentId?: AgentId): AgentId | null;
}

export const AGENT_ROUTER = Symbol('AGENT_ROUTER');

// ──────────────────────────────────────────────────────────────
// IAgentExecutor — one per agent type. ≤ 3 methods.
// ──────────────────────────────────────────────────────────────

export interface AgentExecuteContext {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly actorRole: UserRole;
  readonly intent: string;
  readonly message: string;
  readonly conversationId?: string;
  readonly skillInputs?: Readonly<Record<string, unknown>>;
  readonly explicitSkillKey?: string;
}

export interface AgentSkillOutcome {
  readonly skillKey: string;
  readonly output: string;
  readonly confidence: number;
  readonly citationsCount: number;
  readonly durationMs: number;
  readonly requiresApproval: boolean;
}

export interface IAgentExecutor {
  readonly agentId: AgentId;
  readonly supportedIntents: ReadonlyArray<string>;
  readonly skillKeys: ReadonlyArray<string>;
  /**
   * Execute one request end-to-end. The runtime invokes exactly
   * ONE executor per run. Implementations must:
   *   - validate intent against supportedIntents
   *   - route to the right SkillRegistry skill(s)
   *   - emit at least one AgentSkillOutcome (success or
   *     AgentApprovalRequiredError)
   */
  execute(ctx: AgentExecuteContext): Promise<AgentSkillOutcome>;
}

export const AGENT_EXECUTOR = Symbol('AGENT_EXECUTOR');

// ──────────────────────────────────────────────────────────────
// IAgentRunStore — persistence only.
// ──────────────────────────────────────────────────────────────

export interface AgentRunCreateInput {
  readonly tenantId: string;
  readonly agentId: AgentId;
  readonly intent: string;
  readonly actorUserId: string;
  readonly conversationId: string | undefined;
  readonly status: AgentRunStatus;
  readonly finalOutput: string | undefined;
  readonly clarificationPrompt: string | undefined;
  readonly clarificationSuggestions: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<AgentRunEvidence>;
}

export interface IAgentRunStore {
  create(input: AgentRunCreateInput): Promise<AgentRunRecord>;
  update(
    runId: string,
    patch: Partial<
      Pick<
        AgentRunCreateInput,
        | 'status'
        | 'finalOutput'
        | 'clarificationPrompt'
        | 'clarificationSuggestions'
        | 'evidence'
      >
    >,
    tenantId: string,
  ): Promise<AgentRunRecord>;
  get(runId: string, tenantId: string): Promise<AgentRunRecord>;
  list(
    tenantId: string,
    opts?: { agentId?: AgentId; limit?: number },
  ): Promise<ReadonlyArray<AgentRunRecord>>;
}

export const AGENT_RUN_STORE = Symbol('AGENT_RUN_STORE');

// ──────────────────────────────────────────────────────────────
// IAgentRuntime — orchestrator (≤ 3 public methods).
// ──────────────────────────────────────────────────────────────

export interface IAgentRuntime {
  run(req: AgentRunRequest, tenantCtx: TenantContext): Promise<AgentRunResult>;
  get(runId: string, tenantCtx: TenantContext): Promise<AgentRunResult>;
  list(
    tenantCtx: TenantContext,
    opts?: { agentId?: AgentId; limit?: number },
  ): Promise<ReadonlyArray<AgentRunResult>>;
}

export const AGENT_RUNTIME = Symbol('AGENT_RUNTIME');
