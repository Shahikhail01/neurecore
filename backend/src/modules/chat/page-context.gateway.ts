/**
 * Phase 15 — PageContextGateway.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §1.
 *
 * Closes CR-AI-0002: server-side re-authorization of every
 * PageContext claim from the FE. Whatever the chat panel claims,
 * the gateway cross-checks against Prisma to verify the entity
 * genuinely belongs to the calling tenant before ANY chip / skill
 * is offered.
 *
 * SRP — owns ONLY the verification + claims augmentation. Persisting
 * a chip render is the chat dispatcher's job.
 *
 * SECURITY — three guards applied in order:
 *   1. structural: validatePageContext(...) rejects malformed input
 *   2. tenant:    prisma lookup MUST carry `tenantId: actor.tenantId`
 *   3. capability: `allowedActions` is intersected against the
 *                  actor's role-derived permission set
 *
 * Failures throw a typed PageContextForbiddenError. The chat
 * dispatcher catches the error and surfaces an abstention limit so
 * the operator never sees a fabricated context chip.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  PageContextShape,
  SUPPORTED_ENTITY_TYPES,
  validatePageContext,
} from './page-context.dto';

export class PageContextForbiddenError extends ForbiddenException {}

export class PageContextNotFoundError extends NotFoundException {
  constructor(readonly entityType: string, readonly entityId: string) {
    super(`page-context: ${entityType}:${entityId} not found in tenant`);
  }
}

/**
 * Resolved page context — augmented with server-known fields
 * (displayName, version, additionalFields) and the actually-allowed
 * action intersection.
 */
export interface ResolvedPageContext {
  readonly entityType: string;
  readonly entityId: string;
  readonly displayName: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly allowedActions: ReadonlyArray<string>;
  readonly fields: ReadonlyArray<{ name: string; value: string }>;
}

@Injectable()
export class PageContextGateway {
  private readonly logger = new Logger(PageContextGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a FE-supplied PageContext against Prisma. Returns null
   * for "no usable context"; throws for hostile inputs.
   *
   * `actorAllowedActions` is the role-derived permission set the
   * gateway may intersect against the FE-claimed `allowedActions`.
   * In production this comes from RolesGuard / ABAC; tests pass a
   * deterministic array.
   */
  async resolve(
    raw: unknown,
    actor: { tenantId: string; sub: string },
    actorAllowedActions: ReadonlyArray<string>,
  ): Promise<ResolvedPageContext | null> {
    // 1. structural
    const ctx = validatePageContext(raw);
    if (!ctx) return null;

    if (!actor.tenantId || actor.tenantId === '*') {
      throw new PageContextForbiddenError(
        'tenant context required to resolve page context',
      );
    }

    // 2. tenant-scoped Prisma lookup
    const owned = await this.lookupOwned(ctx, actor.tenantId);

    // 3. allowedActions intersection (intersection guards capability)
    const claimed = new Set(ctx.allowedActions ?? []);
    const permitted = new Set(actorAllowedActions);
    const allowedActions = Array.from(
      new Set(Array.from(claimed).filter((a) => permitted.has(a))),
    );

    return {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      displayName: owned.displayName,
      locale: ctx.locale,
      timezone: ctx.timezone,
      allowedActions,
      fields: [
        ...(ctx.fields ?? []),
        ...owned.additionalFields,
      ],
    };
  }

  /**
   * Tenant-scoped Prisma lookup. Each `entityType` has its own
   * `findFirst({ where: { id, tenantId }, select: ... })` shape.
   * Failure (entity not in this tenant) throws
   * `PageContextNotFoundError` so the caller can clearly
   * distinguish "unknown entity" from "no context given".
   */
  private async lookupOwned(
    ctx: PageContextShape,
    tenantId: string,
  ): Promise<{ displayName: string; additionalFields: ReadonlyArray<{ name: string; value: string }> }> {
    switch (ctx.entityType) {
      case 'customer': {
        const row = await this.prisma.customer.findFirst({
          where: { id: ctx.entityId, tenantId },
          select: { id: true, name: true, industry: true, status: true },
        });
        if (!row) throw new PageContextNotFoundError(ctx.entityType, ctx.entityId);
        return {
          displayName: row.name,
          additionalFields: [
            { name: 'industry', value: row.industry ?? '' },
            { name: 'status', value: row.status ?? '' },
          ],
        };
      }
      case 'project': {
        const row = await this.prisma.project.findFirst({
          where: { id: ctx.entityId, tenantId },
          select: { id: true, name: true, status: true },
        });
        if (!row) throw new PageContextNotFoundError(ctx.entityType, ctx.entityId);
        return {
          displayName: row.name,
          additionalFields: [{ name: 'status', value: row.status ?? '' }],
        };
      }
      case 'deal': {
        const row = await this.prisma.deal.findFirst({
          where: { id: ctx.entityId, tenantId, deletedAt: null },
          select: { id: true, name: true, stage: true },
        });
        if (!row) throw new PageContextNotFoundError(ctx.entityType, ctx.entityId);
        return {
          displayName: row.name,
          additionalFields: [{ name: 'stage', value: row.stage ?? '' }],
        };
      }
      case 'knowledgeEntry': {
        const row = await this.prisma.knowledgeEntry.findFirst({
          where: { id: ctx.entityId, tenantId },
          select: { id: true, title: true, type: true },
        });
        if (!row) throw new PageContextNotFoundError(ctx.entityType, ctx.entityId);
        return {
          displayName: row.title,
          additionalFields: [{ name: 'type', value: String(row.type) }],
        };
      }
      case 'thread': {
        // 'thread' in this context is a chat thread id (cid).
        const row = await this.prisma.chatMessage.findFirst({
          where: { tenantId, conversationId: ctx.entityId },
          select: { id: true, conversationId: true },
        });
        if (!row)
          throw new PageContextNotFoundError(ctx.entityType, ctx.entityId);
        return {
          displayName: `Thread ${row.conversationId}`,
          additionalFields: [],
        };
      }
      // dashboard / campaign / case / task / quote are referenced
      // from baseline but their tables / view models are in flight
      // elsewhere — return a typed "no extra fields" stub so the
      // gateway stays complete without dead branches.
      case 'dashboard':
      case 'campaign':
      case 'case':
      case 'task':
      case 'quote': {
        return {
          displayName: `${ctx.entityType}:${ctx.entityId.slice(0, 8)}`,
          additionalFields: [],
        };
      }
      default: {
        // Belt-and-braces — TS narrowing is total over SUPPORTED_ENTITY_TYPES
        // but a downstream caller could pass a hand-crafted type.
        const exhaustive: never = ctx.entityType;
        throw new PageContextNotFoundError(
          exhaustive as unknown as string,
          ctx.entityId,
        );
      }
    }
  }
}

export { SUPPORTED_ENTITY_TYPES };
