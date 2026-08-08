/**
 * Phase 25 — OutlookCallGraphProvider.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * Closes CR-AI-0401 — "Meeting transcript ingestion with consent"
 * for the Outlook / Microsoft Graph call-graph channel.
 *
 * Microsoft Graph exposes call records under
 * `communications/callRecords/{id}/transcript_v2` (incremental
 * transcript) and `communications/onlineMeetings/{id}/transcripts`
 * (legacy final blob). This provider translates both shapes into
 * the platform's typed `LiveTranscriptEvent`.
 *
 * SOLID:
 *   - SRP — owns ONLY the Graph-API shape translation. No Prisma,
 *     no consent, no idempotency.
 *   - OCP — registered under `OUTLOOK` key. A future provider
 *     (e.g. third-party dialler) is added by registering a new
 *     implementation; the registry and ingestion service are
 *     untouched.
 *   - LSP — substitutes `ITranscriptProvider`; the ingestion
 *     service consumes it through the interface.
 *   - ISP — narrow surface (`fetchTranscript`, `parseLiveEvent`,
 *     `capabilities`, `provider`).
 *   - DIP — depends on injected `IOutlookCallGraphClient` (typed
 *     HTTP) and `IIntegrationCredentialStore`. No direct `fetch`,
 *     no env reads.
 *
 * Webhook verification: the controller validates the Microsoft Graph
 * subscription `validationToken` before the payload reaches
 * `parseLiveEvent()`. This keeps `parseLiveEvent` pure.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MeetingProvider } from '@prisma/client';
import {
  type ITranscriptProvider,
  type LiveTranscriptEvent,
  type TranscriptFetchInput,
  type TranscriptFetchResult,
  type TranscriptProviderCapabilities,
} from '../interfaces/ITranscriptProvider';
import {
  TranscriptProviderPayloadInvalidError,
  TranscriptProviderUnavailableError,
} from './transcript-provider.errors';

export const I_OUTLOOK_CALL_GRAPH_CLIENT = Symbol('IOutlookCallGraphClient');

export interface IOutlookCallGraphClient {
  /** Fetch a finalized transcript blob for a known online meeting id. */
  fetchTranscriptBlob(params: {
    tenantId: string;
    userId: string;
    onlineMeetingId: string;
  }): Promise<OutlookTranscriptPayload>;
}

export interface OutlookTranscriptParticipant {
  readonly userId?: string;
  readonly displayName?: string;
  readonly upn?: string;
}

export interface OutlookTranscriptPayload {
  readonly id: string;
  readonly meetingTitle?: string;
  readonly startDateTime?: string;
  readonly endDateTime?: string;
  readonly languageCode?: string;
  readonly content: string;
  readonly participants?: ReadonlyArray<OutlookTranscriptParticipant>;
}

/**
 * Microsoft Graph change-notification payload (the shape that arrives
 * on the call-graph subscription webhook). We narrow the structure to
 * what `communications/callRecords` actually emits.
 */
export interface OutlookCallGraphNotificationPayload {
  readonly value?: ReadonlyArray<OutlookCallGraphNotificationItem>;
  readonly validationToken?: string;
}

export interface OutlookCallGraphNotificationItem {
  readonly subscriptionId?: string;
  readonly changeType?: string;
  readonly resource?: string;
  readonly encryptedContent?: unknown;
  readonly resourceData?: OutlookCallGraphResourceData;
}

export interface OutlookCallGraphResourceData {
  readonly odataType?: string;
  readonly id?: string;
  readonly meetingId?: string;
  readonly organizer?: { readonly upn?: string; readonly id?: string };
  readonly participants?: ReadonlyArray<OutlookTranscriptParticipant>;
}

const REQUIRED_SCOPES: ReadonlyArray<string> = [
  'OnlineMeetings.Read.All',
  'CallRecords.Read.All',
  'Transcript.Read.All',
];

const CAPABILITIES: TranscriptProviderCapabilities = {
  supportsLiveCallGraph: true,
  supportsIncrementalTranscript: true,
  requiredScopes: REQUIRED_SCOPES,
} as const;

@Injectable()
export class OutlookCallGraphProvider implements ITranscriptProvider {
  readonly provider: MeetingProvider = 'OUTLOOK';
  readonly capabilities: TranscriptProviderCapabilities = CAPABILITIES;
  private readonly logger = new Logger(OutlookCallGraphProvider.name);

  constructor(
    @Optional() @Inject(I_OUTLOOK_CALL_GRAPH_CLIENT)
    private readonly client?: IOutlookCallGraphClient,
  ) {}

  async fetchTranscript(input: TranscriptFetchInput): Promise<TranscriptFetchResult> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new TranscriptProviderPayloadInvalidError(
        'tenantId required for Outlook transcript fetch',
        'OUTLOOK',
        'fetchTranscript',
      );
    }
    if (!input.userId) {
      throw new TranscriptProviderPayloadInvalidError(
        'userId required for Outlook transcript fetch',
        'OUTLOOK',
        'fetchTranscript',
      );
    }
    if (!input.providerMeetingId) {
      throw new TranscriptProviderPayloadInvalidError(
        'providerMeetingId required for Outlook transcript fetch',
        'OUTLOOK',
        'fetchTranscript',
      );
    }
    if (!this.client) {
      throw new TranscriptProviderUnavailableError(
        'Outlook Call Graph client not wired (credentials missing)',
        'OUTLOOK',
        'fetchTranscript',
      );
    }
    const payload = await this.client.fetchTranscriptBlob({
      tenantId: input.tenantId,
      userId: input.userId,
      onlineMeetingId: input.providerMeetingId,
    });
    const start = payload.startDateTime ? new Date(payload.startDateTime) : new Date();
    const end = payload.endDateTime ? new Date(payload.endDateTime) : start;
    const durationSeconds = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 1000),
    );
    return {
      providerMeetingId: payload.id,
      title: payload.meetingTitle ?? 'Outlook meeting',
      scheduledAt: start,
      durationSeconds,
      transcriptText: payload.content,
      languageCode: payload.languageCode ?? 'en',
      participants: (payload.participants ?? []).map((p) => ({
        userId: p.userId,
        name: p.displayName,
        email: p.upn,
      })),
    };
  }

  parseLiveEvent(payload: unknown): LiveTranscriptEvent | null {
    if (!isOutlookPayload(payload)) return null;
    if (payload.validationToken) {
      // Validation handshake — caller answers the challenge; we
      // return null so no event is ingested.
      return null;
    }
    const items = payload.value ?? [];
    if (items.length === 0) return null;
    // First event with a meeting id wins; subsequent ones are ignored
    // for the same providerMeetingId in the same webhook batch.
    const first = items.find((it) => Boolean(it.resourceData?.id || it.resourceData?.meetingId));
    if (!first?.resourceData) return null;
    const resourceData = first.resourceData;
    const providerMeetingId = resourceData.id ?? resourceData.meetingId ?? '';
    if (!providerMeetingId) return null;
    const changeType = (first.changeType ?? '').toLowerCase();
    let eventType: LiveTranscriptEvent['eventType'] = 'transcript.partial';
    if (changeType === 'created') eventType = 'call.started';
    else if (changeType === 'updated') eventType = 'transcript.partial';
    else if (changeType === 'deleted') eventType = 'call.ended';
    else if (changeType === 'transcriptfinal') eventType = 'transcript.final';
    const organizer = resourceData.organizer;
    const userId = organizer?.id ?? organizer?.upn ?? 'unknown';
    return {
      provider: 'OUTLOOK',
      providerMeetingId,
      tenantId: 'unknown',
      userId,
      eventType,
      occurredAt: new Date(),
      participants: (resourceData.participants ?? []).map((p) => ({
        userId: p.userId,
        name: p.displayName,
        email: p.upn,
      })),
    };
  }
}

function isOutlookPayload(p: unknown): p is OutlookCallGraphNotificationPayload {
  if (!p || typeof p !== 'object') return false;
  const candidate = p as { value?: unknown; validationToken?: unknown };
  if (candidate.validationToken !== undefined && typeof candidate.validationToken !== 'string') {
    return false;
  }
  if (candidate.value === undefined) return true;
  return Array.isArray(candidate.value);
}
