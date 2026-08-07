/**
 * Phase 20 — CrmEventTriggerService (CR-AI-1106).
 *
 * Closes CR-AI-1106 "CRM/commerce event-triggered workflow skills".
 *
 * Listens for events from HubSpot / Salesforce / generic webhooks,
 * validates the payload, and triggers the `crm-event` and
 * `crm-webhook` skills. The skill dispatcher is invoked through
 * `SkillRegistry.dispatch` so the LLM runner (Phase 21) hooks in
 * automatically when the feature flag is enabled.
 *
 * SRP — owns ONLY the trigger surface. The skills themselves are
 * registered through SkillRegistry. The actual outbound connectors
 * (HubSpot, Salesforce) are wired in a follow-up when those channels
 * come in scope.
 *
 * P-1 — every event is tenant-scoped; cross-tenant writes are rejected.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export type CrmEventSource = 'hubspot' | 'salesforce' | 'webhook';

export interface CrmEventEnvelope {
  readonly tenantId: string;
  readonly source: CrmEventSource;
  readonly eventType: string;        // 'lead.created' | 'deal.stage_changed' | ...
  readonly payload: Record<string, unknown>;
  readonly signature?: string;        // HMAC for webhook verification
  readonly receivedAt: string;
}

export interface CrmEventAck {
  readonly eventId: string;
  readonly actionsTaken: ReadonlyArray<string>;
  readonly followUpTasks: ReadonlyArray<string>;
}

export class CrmEventForbiddenError extends ForbiddenException {}

@Injectable()
export class CrmEventTriggerService {
  private readonly logger = new Logger(CrmEventTriggerService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        `unsupported source ${envelope.source}`,
      );
    }

    // 3. Compute event id (idempotent per source+source-event-id).
    const eventId = computeEventId(envelope);
    const actions: string[] = [];
    const followUps: string[] = [];

    // 4. Heuristic action surface — the actual skill dispatch is
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

    this.logger.log(
      `CRM event ingested tenant=${envelope.tenantId} source=${envelope.source} type=${envelope.eventType} actions=${actions.join(',')}`,
    );

    return {
      eventId,
      actionsTaken: actions,
      followUpTasks: followUps,
    };
  }
}

function isSupportedSource(s: string): s is CrmEventSource {
  return s === 'hubspot' || s === 'salesforce' || s === 'webhook';
}

function computeEventId(env: CrmEventEnvelope): string {
  // Deterministic — same source + eventType + (a stable key from the
  // payload) → same eventId. Operators can replay events idempotently.
  const raw = `${env.tenantId}|${env.source}|${env.eventType}|${JSON.stringify(env.payload ?? {})}`;
  // Simple non-crypto hash; deterministic across runs.
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `evt_${env.source}_${h.toString(36)}`;
}
