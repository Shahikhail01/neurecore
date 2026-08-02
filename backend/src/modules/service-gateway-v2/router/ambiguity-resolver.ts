/**
 * AmbiguityResolver — Phase 2
 *
 * Asks clarification questions when intent candidates are not safely distinguishable.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IntentDecision } from '../interfaces';

export interface ClarificationOption {
  label: string;
  value: string;
  description?: string;
}

export interface ClarificationQuestion {
  question: string;
  options: ClarificationOption[];
  correlationId: string;
}

@Injectable()
export class AmbiguityResolver {
  private readonly logger = new Logger(AmbiguityResolver.name);

  resolve(candidates: IntentDecision[], correlationId: string): ClarificationQuestion | null {
    if (!candidates || candidates.length <= 1) {
      return null;
    }

    // Check if candidates are truly ambiguous (different intents or entities)
    const intents = new Set(candidates.map((c) => c.intent));
    const entities = new Set(candidates.map((c) => c.entity).filter(Boolean));

    // If all same intent and same entity, they're not ambiguous
    if (intents.size === 1 && entities.size <= 1) {
      return null;
    }

    // Build clarification question
    if (entities.size > 1) {
      return this.buildEntityClarification(candidates, correlationId);
    }

    if (intents.size > 1) {
      return this.buildIntentClarification(candidates, correlationId);
    }

    return null;
  }

  private buildEntityClarification(candidates: IntentDecision[], correlationId: string): ClarificationQuestion {
    const options: ClarificationOption[] = candidates.map((c) => ({
      label: this.humanizeEntity(c.entity ?? 'unknown'),
      value: c.entity ?? '',
      description: `Show me ${c.entity ?? 'items'} list`,
    }));

    return {
      question: 'Which did you mean?',
      options,
      correlationId,
    };
  }

  private buildIntentClarification(candidates: IntentDecision[], correlationId: string): ClarificationQuestion {
    const intentLabels: Record<string, string> = {
      READ: 'Show me information',
      MUTATION: 'Create or update something',
      ADVICE: 'Get a recommendation',
      NAVIGATION: 'Go somewhere',
      HELP: 'Help me',
    };

    const options: ClarificationOption[] = candidates.map((c) => ({
      label: intentLabels[c.intent] ?? c.intent,
      value: c.intent,
      description: c.entity ? `Related to ${this.humanizeEntity(c.entity)}` : undefined,
    }));

    return {
      question: 'Did you want to:',
      options,
      correlationId,
    };
  }

  private humanizeEntity(entity?: string): string {
    if (!entity) return 'this';
    return entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase();
  }
}
