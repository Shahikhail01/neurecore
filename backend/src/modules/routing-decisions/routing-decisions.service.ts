import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Persisted shape for a single routing decision.
 *
 * `intent` is stored as a free string rather than a Postgres enum so
 * additional intent kinds (NAVIGATION, HELP, ADVICE, …) can be appended
 * without a schema migration. The classifier already constrains
 * inputs; this layer just records.
 */
export interface RoutingDecisionPayload {
  ruleVersion: string;
  ruleId: string;
  intent: string;
  canonicalCapability?: string | undefined;
  confidence: number;
  rawMessageHash: string;
  resolvedActionId?: string | undefined;
  sessionId?: string | undefined;
  correlationId?: string | undefined;
  ambiguous: boolean;
}

/**
 * RoutingDecisionsService — Phase 2 service-gateway-v2 plan.
 *
 * Persists every deterministic routing decision (READ, MUTATION, AMBIGUOUS,
 * UNSUPPORTED) emitted by the DeterministicIntentClassifier so the platform
 * can audit capability routing, count ambiguity, and reproduce tool
 * invocations back to their classifier result.
 *
 * Mirrors DecisionEvaluationsService in spirit: append-only, tenant-scoped,
 * never destructive. There is no `update` or `delete` API.
 *
 * The `rawMessageHash` is hashed by the classifier before it reaches this
 * service so we never store raw user prompts — only the SHA-256 hex digest.
 */
@Injectable()
export class RoutingDecisionsService {
  private readonly logger = new Logger(RoutingDecisionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get repo(): Record<string, any> {
    // The Prisma client is generated from `schema.prisma` so the
    // routingDecisionLog delegate is present at runtime, even though
    // the local TypeScript types here predate the migration. We cast
    // through `unknown` because the typeof-PrismaClient brand cannot
    // express the new delegate without re-running `prisma generate`
    // which we cannot do inside this test pass.
    return (this.prisma as unknown as { routingDecisionLog: any })
      .routingDecisionLog;
  }

  /**
   * Persist a single routing decision. Returns the created row so callers
   * can correlate by id if they need to.
   */
  async record(
    tenantId: string,
    actorId: string,
    payload: RoutingDecisionPayload,
  ) {
    const created = await this.repo.create({
      data: {
        tenantId,
        actorId,
        ruleVersion: payload.ruleVersion,
        ruleId: payload.ruleId,
        intent: payload.intent,
        canonicalCapability: payload.canonicalCapability ?? null,
        confidence: payload.confidence,
        rawMessageHash: payload.rawMessageHash,
        resolvedActionId: payload.resolvedActionId ?? null,
        sessionId: payload.sessionId ?? null,
        correlationId: payload.correlationId ?? null,
        ambiguous: payload.ambiguous,
      },
    });
    if (payload.ambiguous) {
      this.logger.warn(
        `Ambiguous routing: tenant=${tenantId} ruleId=${payload.ruleId} intent=${payload.intent} capability=${payload.canonicalCapability ?? '(none)'}`,
      );
    }
    return created;
  }

  /**
   * Return the most recent `limit` routing decisions for the tenant,
   * newest-first. Hard cap at 500 to keep queries bounded.
   */
  async listRecent(tenantId: string, limit = 100) {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
    return this.repo.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }

  /**
   * Count how many ambiguous routing decisions the tenant has produced
   * since `since`. Used by operators to monitor clarification frequency.
   */
  async countAmbiguousSince(tenantId: string, since: Date): Promise<number> {
    return this.repo.count({
      where: { tenantId, ambiguous: true, createdAt: { gte: since } },
    });
  }
}
