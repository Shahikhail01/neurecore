/**
 * Phase 23 — AgentRouter implementation.
 *
 * Deterministic intent classifier. Maps natural-language messages
 * to the matching OOB agent, or returns a typed clarification.
 *
 * Rules (P23 §4, runtime contract):
 *   - When the caller names an agent explicitly, the router honors it
 *     and refuses unsupported intents with a typed clarification.
 *   - When the caller does not name an agent, the router infers from
 *     the message prefix using the supported-intent catalog. The
 *     `UNIVERSAL` agent is the default entry-point.
 *
 * SOLID — SRP: resolves only; doesn't run, doesn't persist.
 * SOLID — OCP: adding a new agent = one entry in INTENT_PREFIXES.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AgentRegistry,
  type AgentId,
} from '../../agent-templates/agents.registry';
import {
  AgentClarificationRequiredError,
  AgentUnsupportedIntentError,
} from '../errors';
import type {
  AgentRouteResolution,
  IAgentRouter,
} from '../interfaces/agent-runtime.interface';
import { AGENT_REGISTRY } from '../agent-runtime.tokens';

interface IntentPattern {
  readonly agentId: AgentId;
  readonly prefixes: ReadonlyArray<string>;
}

const INTENT_PATTERNS: ReadonlyArray<IntentPattern> = [
  {
    agentId: 'CR-AI-0501' as AgentId, // UNIVERSAL
    prefixes: ['help', '?', 'what can', 'route', 'universal'],
  },
  {
    agentId: 'CR-AI-0502' as AgentId, // PRODUCTIVITY
    prefixes: [
      'summarize',
      'summary',
      'rewrite',
      'rephrase',
      'meeting notes',
      'productivity',
    ],
  },
  {
    agentId: 'CR-AI-0503' as AgentId, // SALES
    prefixes: [
      'sales',
      'lead',
      'lead score',
      'pipeline',
      'deal',
      'forecast',
      'win probability',
    ],
  },
  {
    agentId: 'CR-AI-0504' as AgentId, // MARKETING
    prefixes: [
      'marketing',
      'campaign',
      'segment',
      'audience',
      'drip',
      'send email',
    ],
  },
  {
    agentId: 'CR-AI-0505' as AgentId, // SERVICE
    prefixes: [
      'case',
      'support',
      'service',
      'ticket',
      'categorize case',
      'resolve case',
    ],
  },
  {
    agentId: 'CR-AI-0506' as AgentId, // KNOWLEDGE
    prefixes: [
      'knowledge',
      'article',
      'document',
      'kb',
      'knowledge base',
      'find article',
    ],
  },
];

@Injectable()
export class AgentRouter implements IAgentRouter {
  private readonly logger = new Logger(AgentRouter.name);

  constructor(
    @Inject(AGENT_REGISTRY) private readonly registry: AgentRegistry,
  ) {}

  resolve(
    intent: string,
    explicitAgentId: AgentId | undefined,
  ): AgentRouteResolution {
    if (explicitAgentId) {
      if (!this.registry.has(explicitAgentId)) {
        throw new AgentUnsupportedIntentError(explicitAgentId, intent);
      }
      const def = this.registry.get(explicitAgentId);
      if (
        def.supportedIntents.length > 0 &&
        !this.matchesSupported(intent, def.supportedIntents)
      ) {
        // Explicit agent + unsupported intent → typed clarification.
        throw new AgentClarificationRequiredError(
          explicitAgentId,
          `Agent ${def.displayName} (${def.id}) cannot handle intent '${intent}'. Supported intents: ${def.supportedIntents.slice(0, 5).join(', ')}…`,
          def.skillKeys.slice(0, 5) as ReadonlyArray<string>,
        );
      }
      return { agentId: explicitAgentId };
    }

    const routed = this.classify(intent);
    if (!routed) {
      // No classifier match → default to UNIVERSAL with a clarification.
      throw new AgentClarificationRequiredError(
        'CR-AI-0501' as AgentId,
        `Unable to route intent '${intent}' — falling back to the universal entry-point.`,
        [
          'Summarize text',
          'Draft an email',
          'Score a lead',
          'Categorize a case',
          'Find a knowledge article',
        ],
      );
    }
    return { agentId: routed };
  }

  classify(message: string, explicitAgentId?: AgentId): AgentId | null {
    if (explicitAgentId) return explicitAgentId;
    const lowered = (message ?? '').toLowerCase().trim();
    if (lowered.length === 0) return null;

    // First match wins — order is intentional (specialist agents
    // before universal fallthrough).
    for (const pattern of INTENT_PATTERNS) {
      if (pattern.prefixes.some((p) => lowered.startsWith(p))) {
        return pattern.agentId;
      }
    }
    // Default to universal.
    return 'CR-AI-0501' as AgentId;
  }

  private matchesSupported(
    intent: string,
    supported: ReadonlyArray<string>,
  ): boolean {
    const lowered = intent.toLowerCase().trim();
    if (supported.length === 0) return true; // permissive when catalog is empty
    return supported.some((s) => lowered.includes(s.toLowerCase()));
  }
}
