/**
 * Phase 25 — TeamsCallGraphProvider.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * Closes CR-AI-1104 — "Microsoft Teams (chat + meeting summary)" —
 * and CR-AI-0401 — "Meeting transcript ingestion with consent".
 *
 * Microsoft Teams reuses the same Microsoft Graph call-record surface
 * as Outlook (`communications/callRecords`). This provider mirrors
 * `OutlookCallGraphProvider` but maps to the `TEAMS` enum and the
 * Teams-specific resource shape (`chats/{id}/messages` is chat; the
 * transcript is under `onlineMeetings/{id}/transcripts`).
 *
 * SOLID: same SRP/OCP/LSP/ISP/DIP discipline as
 * `OutlookCallGraphProvider`. The two providers substitute
 * `ITranscriptProvider` uniformly; the registry keys them under
 * different `MeetingProvider` values.
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

export const I_TEAMS_CALL_GRAPH_CLIENT = Symbol('ITeamsCallGraphClient');

export interface ITeamsCallGraphClient {
  fetchTranscriptBlob(params: {
    tenantId: string;
    userId: string;
    onlineMeetingId: string;
  }): Promise<TeamsTranscriptPayload>;
}

export interface TeamsTranscriptPayload {
  readonly id: string;
  readonly subject?: string;
  readonly startDateTime?: string;
  readonly endDateTime?: string;
  readonly language?: string;
  readonly transcript: string;
  readonly attendees?: ReadonlyArray<{ readonly userId?: string; readonly displayName?: string; readonly upn?: string }>;
}

export interface TeamsCallGraphNotificationPayload {
  readonly value?: ReadonlyArray<TeamsCallGraphNotificationItem>;
  readonly validationToken?: string;
}

export interface TeamsCallGraphNotificationItem {
  readonly subscriptionId?: string;
  readonly changeType?: string;
  readonly resource?: string;
  readonly resourceData?: TeamsCallGraphResourceData;
}

export interface TeamsCallGraphResourceData {
  readonly odataType?: string;
  readonly id?: string;
  readonly chatId?: string;
  readonly meetingId?: string;
  readonly organizer?: { readonly upn?: string; readonly id?: string };
}

const CAPABILITIES: TranscriptProviderCapabilities = {
  supportsLiveCallGraph: true,
  supportsIncrementalTranscript: true,
  requiredScopes: [
    'OnlineMeetings.Read.All',
    'CallRecords.Read.All',
    'Transcript.Read.All',
    'Chat.Read.All',
  ],
} as const;

@Injectable()
export class TeamsCallGraphProvider implements ITranscriptProvider {
  readonly provider: MeetingProvider = 'TEAMS';
  readonly capabilities: TranscriptProviderCapabilities = CAPABILITIES;
  private readonly logger = new Logger(TeamsCallGraphProvider.name);

  constructor(
    @Optional() @Inject(I_TEAMS_CALL_GRAPH_CLIENT)
    private readonly client?: ITeamsCallGraphClient,
  ) {}

  async fetchTranscript(input: TranscriptFetchInput): Promise<TranscriptFetchResult> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new TranscriptProviderPayloadInvalidError(
        'tenantId required for Teams transcript fetch',
        'TEAMS',
        'fetchTranscript',
      );
    }
    if (!input.userId) {
      throw new TranscriptProviderPayloadInvalidError(
        'userId required for Teams transcript fetch',
        'TEAMS',
        'fetchTranscript',
      );
    }
    if (!input.providerMeetingId) {
      throw new TranscriptProviderPayloadInvalidError(
        'providerMeetingId required for Teams transcript fetch',
        'TEAMS',
        'fetchTranscript',
      );
    }
    if (!this.client) {
      throw new TranscriptProviderUnavailableError(
        'Teams Call Graph client not wired (credentials missing)',
        'TEAMS',
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
      title: payload.subject ?? 'Teams meeting',
      scheduledAt: start,
      durationSeconds,
      transcriptText: payload.transcript,
      languageCode: payload.language ?? 'en',
      participants: (payload.attendees ?? []).map((p) => ({
        userId: p.userId,
        name: p.displayName,
        email: p.upn,
      })),
    };
  }

  parseLiveEvent(payload: unknown): LiveTranscriptEvent | null {
    if (!isTeamsPayload(payload)) return null;
    if (payload.validationToken) return null;
    const items = payload.value ?? [];
    if (items.length === 0) return null;
    const first = items.find((it) =>
      Boolean(it.resourceData?.id || it.resourceData?.meetingId || it.resourceData?.chatId),
    );
    if (!first?.resourceData) return null;
    const resourceData = first.resourceData;
    const providerMeetingId =
      resourceData.id ?? resourceData.meetingId ?? resourceData.chatId ?? '';
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
      provider: 'TEAMS',
      providerMeetingId,
      tenantId: 'unknown',
      userId,
      eventType,
      occurredAt: new Date(),
    };
  }
}

function isTeamsPayload(p: unknown): p is TeamsCallGraphNotificationPayload {
  if (!p || typeof p !== 'object') return false;
  const candidate = p as { value?: unknown; validationToken?: unknown };
  if (candidate.validationToken !== undefined && typeof candidate.validationToken !== 'string') {
    return false;
  }
  if (candidate.value === undefined) return true;
  return Array.isArray(candidate.value);
}
