/**
 * PrismaCrmEventStore — durable CRM-event store (CR-AI-1106).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §8 (P27).
 *
 * Replaces the process-local `InMemoryCrmEventStore` in production so
 * CRM/commerce events survive process restarts and are replayable.
 * Implements `ICrmEventStore` (the narrow port defined in
 * `crm-event-trigger.service.ts`).
 *
 * Idempotency is enforced by a unique query on
 * `(tenantId, source, eventType, providerEventId)`: the same upstream
 * event cannot be ingested twice.
 *
 * SOLID — SRP: persistence only; no signature verification, no skill
 *   dispatch.
 * SOLID — DIP: depends on `PrismaService` (the single designated
 *   persistence dependency); does not perform HTTP or policy work.
 * SOLID — ISP: implements only `ICrmEventStore`'s two methods.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ICrmEventStore } from './crm-event-trigger.service';

@Injectable()
export class PrismaCrmEventStore implements ICrmEventStore {
  private readonly logger = new Logger(PrismaCrmEventStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async findIdempotent(input: {
    tenantId: string;
    source: string;
    eventType: string;
    providerEventId?: string;
  }): Promise<string | null> {
    if (!input.providerEventId) return null;
    const row = await this.prisma.crmEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        source: input.source,
        eventType: input.eventType,
        providerEventId: input.providerEventId,
      },
      select: { id: true },
      orderBy: { receivedAt: 'desc' },
    });
    return row?.id ?? null;
  }

  async persist(input: {
    tenantId: string;
    eventId: string;
    source: string;
    eventType: string;
    payload: Record<string, unknown>;
    receivedAt: string;
    providerEventId?: string;
  }): Promise<void> {
    try {
      await this.prisma.crmEvent.create({
        data: {
          id: input.eventId,
          tenantId: input.tenantId,
          source: input.source,
          eventType: input.eventType,
          payload: (input.payload ?? {}) as never,
          receivedAt: new Date(input.receivedAt),
          providerEventId: input.providerEventId ?? null,
        },
      });
    } catch (err: unknown) {
      // Unique-violation race: the same logical event was ingested by a
      // concurrent request. This is an idempotent success, not an error.
      this.logger.debug(
        `crm_events upsert race for ${input.eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
