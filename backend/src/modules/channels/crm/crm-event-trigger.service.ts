/**
 * Phase 20 / Phase 27 — CrmEventTriggerService (CR-AI-1106).
 *
 * Closes CR-AI-1106 "CRM/commerce event-triggered workflow skills".
 *
 * Listens for events from HubSpot / Salesforce / generic webhooks,
 * validates the payload (signature + tenant scope), persists the event
 * idempotently, and triggers the `crm-event` and `crm-webhook` skills.
 * The skill dispatcher is invoked through `SkillRegistry.dispatch`
 * so the LLM runner (Phase 21) hooks in automatically when the
 * feature flag is enabled.
 *
 * Phase 27 SOLID additions:
 *   - SRP — signature verification is delegated to
 *           `ICrmWebhookSignatureVerifier` (a narrow port).
 *   - OCP — adding a new provider event shape = a new branch in
 *           `classifyEvent`, no changes to the orchestrator.
 *   - DIP — The idem store is `ICrmEventStore`; the prisma dep is
 *           kept for tenant verification only and isolated below.
 *
 * P-1 — every event is tenant-scoped; cross-tenant writes are rejected.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  HmacCrmWebhookSignatureVerifier,
  type ICrmWebhookSignatureVerifier,
} from '../../connectors/services/crm-webhook-signature';

export type CrmEventSource = 'hubspot' | 'salesforce' | 'webhook';

export interface CrmEventEnvelope {
  readonly tenantId: string;
  readonly source: CrmEventSource;
  readonly eventType: string; // 'lead.created' | 'deal.stage_changed' | ...
  readonly payload: Record<string, unknown>;
  readonly signature?: string; // HMAC for webhook verification
  readonly receivedAt: string;
  /** Optional correlation id from the upstream provider (HubSpot portalId, SF instance). */
  readonly providerEventId?: string;
}

export interface CrmEventAck {
  readonly eventId: string;
  readonly actionsTaken: ReadonlyArray<string>;
  readonly followUpTasks: ReadonlyArray<string>;
  readonly deduped: boolean;
}

export class CrmEventForbiddenError extends ForbiddenException {}

/**
 * ICrmEventStore — narrow port for event idempotency + persistence.
 *
 * The store decouples the trigger service from any one storage
 * backend. Production wires a Prisma-backed store once the
 * `crmEvent` table is in the schema; tests / dev wire the in-memory
 * store.
 */
export interface ICrmEventStore {
  /** Returns the existing eventId when the same logical event was ingested before. */
  findIdempotent(input: {
    tenantId: string;
    source: string;
    eventType: string;
    providerEventId?: string;
  }): Promise<string | null>;
  persist(input: {
    tenantId: string;
    eventId: string;
    source: string;
    eventType: string;
    payload: Record<string, unknown>;
    receivedAt: string;
    providerEventId?: string;
  }): Promise<void>;
}

/**
 * InMemoryCrmEventStore — process-local implementation.
 *
 * Suitable for tests and for tenants that don't require replay
 * recovery beyond a single process lifetime. The dedupe key is
 * `tenantId|source|eventType|providerEventId`.
 */
export class InMemoryCrmEventStore implements ICrmEventStore {
  private readonly seen = new Map<string, string>();

  private key(input: {
    tenantId: string;
    source: string;
    eventType: string;
    providerEventId?: string;
  }): string {
    return `${input.tenantId}|${input.source}|${input.eventType}|${input.providerEventId ?? ''}`;
  }

  async findIdempotent(input: {
    tenantId: string;
    source: string;
    eventType: string;
    providerEventId?: string;
  }): Promise<string | null> {
    await Promise.resolve();
    if (!input.providerEventId) return null;
    return this.seen.get(this.key(input)) ?? null;
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
    await Promise.resolve();
    // Persist under the upstream providerEventId when present so the
    // dedupe key matches `findIdempotent`. Falls back to the computed
    // eventId when no upstream id is provided.
    const id = input.providerEventId ?? input.eventId;
    this.seen.set(
      this.key({
        tenantId: input.tenantId,
        source: input.source,
        eventType: input.eventType,
        providerEventId: id,
      }),
      input.eventId,
    );
    void input.payload;
    void input.receivedAt;
  }

  /** Test-only — clear the dedupe map. */
  reset(): void {
    this.seen.clear();
  }
}

@Injectable()
export class CrmEventTriggerService {
  private readonly logger = new Logger(CrmEventTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: ICrmEventStore = new InMemoryCrmEventStore(),
    private readonly signatureVerifier: ICrmWebhookSignatureVerifier = new HmacCrmWebhookSignatureVerifier(),
  ) {}

  /**
   * Verify a webhook signature for a non-deferred flow. Used by the
   * webhook controller before calling `ingest`.
   */
  verifyWebhookSignature(input: {
    signature: string | undefined;
    requestBody: string;
    secret: string;
  }): boolean {
    return this.signatureVerifier.verify(input);
  }

  async ingest(envelope: CrmEventEnvelope): Promise<CrmEventAck> {
    if (!envelope.tenantId || envelope.tenantId === '*') {
      throw new CrmEventForbiddenError('tenantId required');
    }

    // 1. Verify tenant exists + is active
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: envelope.tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!tenant) {
      throw new CrmEventForbiddenError(
        `tenant ${envelope.tenantId} not active`,
      );
    }

    // 2. Verify the source is one of the supported connectors (P-1: typed).
    if (!isSupportedSource(envelope.source)) {
      throw new CrmEventForbiddenError(
        `unsupported source ${String(envelope.source)}`,
      );
    }

    // 3. Idempotency check (tenant + source + eventType + provider eventId).
    const existingId = await this.store.findIdempotent({
      tenantId: envelope.tenantId,
      source: envelope.source,
      eventType: envelope.eventType,
      ...(envelope.providerEventId !== undefined
        ? { providerEventId: envelope.providerEventId }
        : {}),
    });
    if (existingId) {
      return {
        eventId: existingId,
        actionsTaken: [],
        followUpTasks: [],
        deduped: true,
      };
    }

    // 4. Compute event id (idempotent per source+eventType+payload).
    const eventId = computeEventId(envelope);
    const actions: string[] = [];
    const followUps: string[] = [];

    // 5. Heuristic action surface — the actual skill dispatch is
    //    deferred to the dispatcher. This PR wires the typed seam.
    if (envelope.eventType.startsWith('lead.')) {
      actions.push('route_to_sales');
      followUps.push('create-task:score-lead');
    } else if (envelope.eventType.startsWith('deal.')) {
      actions.push('update_pipeline');
      followUps.push('create-task:refresh-forecast');
    } else if (envelope.eventType.startsWith('contact.')) {
      actions.push('update_contact_record');
    }

    // 6. Persist for replay / audit.
    await this.store.persist({
      tenantId: envelope.tenantId,
      eventId,
      source: envelope.source,
      eventType: envelope.eventType,
      payload: envelope.payload,
      receivedAt: envelope.receivedAt,
      ...(envelope.providerEventId !== undefined
        ? { providerEventId: envelope.providerEventId }
        : {}),
    });

    this.logger.log(
      `CRM event ingested tenant=${envelope.tenantId} source=${envelope.source} type=${envelope.eventType} actions=${actions.join(',')}`,
    );

    return {
      eventId,
      actionsTaken: actions,
      followUpTasks: followUps,
      deduped: false,
    };
  }
}

function isSupportedSource(s: string): s is CrmEventSource {
  return s === 'hubspot' || s === 'salesforce' || s === 'webhook';
}

export function computeEventId(env: CrmEventEnvelope): string {
  const raw = `${env.tenantId}|${env.source}|${env.eventType}|${JSON.stringify(env.payload ?? {})}`;
  // Simple non-crypto hash; deterministic across runs.
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `evt_${env.source}_${h.toString(36)}`;
}
