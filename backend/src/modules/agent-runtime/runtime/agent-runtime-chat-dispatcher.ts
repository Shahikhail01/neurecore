/**
 * AgentRuntimeChatDispatcher — narrow bridge from chat to the runtime.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23) —
 * "runtime consumed by chat / agent-graph surfaces".
 *
 * The chat service must not depend on the full runtime surface. This
 * dispatcher exposes a single narrow method (`dispatch`) that routes a
 * message + explicit agentId to `IAgentRuntime.run()` and returns a
 * plain reply shape. The chat module imports this via the
 * `AGENT_CHAT_DISPATCHER` token; if the runtime is unavailable the
 * dispatcher returns null (chat falls through to its normal path).
 *
 * SOLID — ISP: `IAgentChatDispatcher` is a single-method contract.
 * SOLID — DIP: depends on injected `IAgentRuntime`; no direct Prisma.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { AGENT_RUNTIME } from '../agent-runtime.tokens';
import type { IAgentRuntime, AgentRunResult } from '../interfaces/agent-runtime.interface';

export interface AgentChatDispatchResult {
  readonly reply: string;
  readonly run: AgentRunResult;
}

export interface IAgentChatDispatcher {
  dispatch(args: {
    agentId: AgentId;
    intent: string;
    message: string;
    tenantId: string;
    actorUserId: string;
    actorRole: string;
  }): Promise<AgentChatDispatchResult | null>;
}

export const AGENT_CHAT_DISPATCHER = Symbol('AGENT_CHAT_DISPATCHER');

@Injectable()
export class AgentRuntimeChatDispatcher implements IAgentChatDispatcher {
  constructor(
    @Inject(AGENT_RUNTIME) private readonly runtime: IAgentRuntime,
  ) {}

  async dispatch(args: {
    agentId: AgentId;
    intent: string;
    message: string;
    tenantId: string;
    actorUserId: string;
    actorRole: string;
  }): Promise<AgentChatDispatchResult | null> {
    if (!args.tenantId || args.tenantId === '*') return null;
    const run = await this.runtime.run(
      {
        agentId: args.agentId,
        intent: args.intent,
        message: args.message,
      },
      {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole as never,
        isCrossTenant: false,
      },
    );
    if (run.status === 'CLARIFICATION_REQUIRED') {
      const c = run.clarification;
      const suggestions = c?.suggestions?.length
        ? `\n\nSuggestions:\n${c.suggestions.map((s) => `- ${s}`).join('\n')}`
        : '';
      return { reply: `I need clarification: ${c?.prompt ?? ''}${suggestions}`, run };
    }
    if (run.status === 'APPROVAL_REQUIRED') {
      return {
        reply:
          'This action requires human approval and will not be executed until approved.',
        run,
      };
    }
    return { reply: run.finalOutput ?? '', run };
  }
}
