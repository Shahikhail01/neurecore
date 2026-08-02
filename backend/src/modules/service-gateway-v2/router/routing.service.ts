import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { RoutingDecisionsService } from '../../routing-decisions/routing-decisions.service';
import type { IntentDecision } from '../interfaces';
import { ClassifierService } from './classifier.service';

/**
 * RoutingService — Phase 2 service-gateway-v2 plan.
 *
 * Persists every classified prompt (READ, MUTATION, AMBIGUOUS,
 * UNSUPPORTED) to `RoutingDecisionLog` and exposes a typed wrapper that
 * chat orchestrators can call without knowing about the underlying
 * Prisma delegate. Mirrors `DecisionEvaluationsService` /
 * `TimelineEventsService` in spirit: append-only, tenant-scoped, never
 * destructive.
 *
 * Why this lives in service-gateway-v2 and not in
 * `routing-decisions`: the wrapping logic (hash the raw message, derive
 * ambiguous from `decision.candidates`, coerce ruleId to a string) is
 * coupling the classifier contract to the persistence contract. Keeping
 * that coupling here leaves the bare persistence service usable from
 * other surfaces (e.g. CLI replay) without forcing them to import the
 * classifier.
 */
export interface PersistRoutingDecisionInput {
  tenantId: string;
  actorId: string;
  message: string;
  decision: IntentDecision;
  ruleVersion: string;
  resolvedActionId?: string | null;
  sessionId?: string | null;
  correlationId?: string | null;
}

export interface PersistedRoutingDecision {
  id: string;
  tenantId: string;
  actorId: string;
  rawMessageHash: string;
  ruleVersion: string;
  ruleId: string;
  intent: string;
  canonicalCapability: string | null;
  confidence: number;
  ambiguous: boolean;
  createdAt: Date;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly store: RoutingDecisionsService,
    private readonly classifierService: ClassifierService,
  ) {}

  /**
   * Persist a single deterministic routing decision. Never throws —
   * persistence failures are logged and swallowed so chat replies do
   * not break on transient DB errors.
   */
  async recordDecision(input: PersistRoutingDecisionInput): Promise<void> {
    const rawMessageHash = hashMessage(input.message);
    const ambiguous = !!(
      input.decision.candidates && input.decision.candidates.length > 0
    );
    const ruleId = input.decision.ruleId ?? 'no_match';
    const capability = extractCapabilityFromDecision(input.decision);
    try {
      await this.store.record(input.tenantId, input.actorId, {
        ruleVersion: input.ruleVersion,
        ruleId,
        intent: input.decision.intent,
        canonicalCapability: capability ?? undefined,
        confidence: input.decision.confidence,
        rawMessageHash,
        resolvedActionId: input.resolvedActionId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        correlationId: input.correlationId ?? undefined,
        ambiguous,
      });
    } catch (err) {
      this.logger.warn(
        `Routing decision persistence failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async recordAndClassify(
    tenantId: string,
    actorId: string,
    message: string,
    overrides?: {
      resolvedActionId?: string | null;
      sessionId?: string | null;
      correlationId?: string | null;
    },
  ): Promise<IntentDecision> {
    const decision = await this.classifierService.classify({ message });
    await this.recordDecision({
      tenantId,
      actorId,
      message,
      decision,
      ruleVersion: this.classifierService.getRuleVersion(),
      ...overrides,
    });
    return decision;
  }
}

function hashMessage(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

function extractCapabilityFromDecision(
  decision: IntentDecision,
): string | undefined {
  if (
    decision.ruleId &&
    typeof decision.ruleId === 'string' &&
    decision.ruleId.startsWith('builtIn:')
  ) {
    return decision.ruleId.slice('builtIn:'.length);
  }
  if (decision.ruleId === 'explicit_context' && decision.entity) {
    return decision.entity;
  }
  return undefined;
}
