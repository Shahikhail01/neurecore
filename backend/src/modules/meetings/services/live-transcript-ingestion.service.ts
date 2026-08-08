/**
 * Phase 25 — LiveTranscriptIngestionService.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * SOLID — SRP: owns ONLY the live-event ingestion pipeline
 * (provider lookup → consent verify → upsert transcript). The
 * pre-existing `TranscriptIngestionService` keeps the manual POST
 * path; this service consumes the registry for live providers
 * (Outlook / Teams).
 *
 * OCP — adding a 4th live provider: register it under the
 * `MeetingProvider` key in `TranscriptProviderRegistry`. This
 * service is unchanged.
 *
 * DIP — depends on `MeetingConsentService`,
 * `TranscriptProviderRegistry`, and `PrismaService` only. The
 * provider HTTP calls happen behind the registry seam.
 *
 * Idempotency: upserts on
 * `(tenantId, provider, providerMeetingId)`. Replaying the same
 * webhook batch does not create duplicate transcripts.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  TRANSCRIPT_PROVIDER_REGISTRY,
  type LiveTranscriptEvent,
} from '../interfaces/ITranscriptProvider';
import { TranscriptProviderRegistry } from '../registry/transcript-provider.registry';
import {
  MeetingConsentRequiredError,
  MeetingTenantForbiddenError,
  type MeetingConsentService,
  MEETING_CONSENT_SERVICE,
} from './meeting-consent.service';

export interface IngestLiveEventInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly provider: LiveTranscriptEvent['provider'];
  readonly providerMeetingId: string;
  readonly transcriptText?: string;
  readonly title?: string;
  readonly scheduledAt?: Date;
  readonly durationSeconds?: number;
  readonly languageCode?: string;
  readonly participants?: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

export interface IngestLiveEventResult {
  readonly transcriptId: string;
  readonly provider: LiveTranscriptEvent['provider'];
  readonly idempotent: boolean;
}

@Injectable()
export class LiveTranscriptIngestionService {
  private readonly logger = new Logger(LiveTranscriptIngestionService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TRANSCRIPT_PROVIDER_REGISTRY)
    private readonly registry: TranscriptProviderRegistry,
    @Inject(MEETING_CONSENT_SERVICE)
    private readonly consent: MeetingConsentService,
  ) {}

  /**
   * Ingest a live transcript event. Idempotent on
   * `(tenantId, provider, providerMeetingId)`. Rejects events
   * without an active consent.
   */
  async ingestLive(input: IngestLiveEventInput): Promise<IngestLiveEventResult> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new MeetingTenantForbiddenError('tenantId required');
    }
    if (!input.userId) {
      throw new MeetingTenantForbiddenError('userId required');
    }
    if (!this.registry.has(input.provider)) {
      // Manual ingestion path is the pre-existing service's
      // responsibility; this service only handles registered
      // live providers. Returning a typed error keeps the
      // boundary explicit.
      throw new MeetingTenantForbiddenError(
        `provider ${input.provider} not registered as live; use POST /meetings/transcripts`,
      );
    }
    const granted = await this.consent.isGranted(
      input.tenantId,
      input.userId,
      input.provider,
    );
    if (!granted) {
      throw new MeetingConsentRequiredError(
        `no active consent for ${input.provider} by user ${input.userId} in tenant ${input.tenantId}`,
      );
    }
    const transcriptText = input.transcriptText ?? '';
    const scheduledAt = input.scheduledAt ?? new Date();
    const durationSeconds = input.durationSeconds ?? 0;
    const languageCode = input.languageCode ?? 'en';
    const title = input.title ?? `${input.provider} meeting`;

    const existing = await this.prisma.meetingTranscript.findFirst({
      where: {
        tenantId: input.tenantId,
        provider: input.provider,
        providerMeetingId: input.providerMeetingId,
      },
      select: { id: true },
    });

    if (existing) {
      // Idempotent update — extend the transcript with new content.
      await this.prisma.meetingTranscript.update({
        where: { id: existing.id },
        data: {
          transcriptText,
          durationSeconds,
          languageCode,
          participantsJson: (input.participants ?? []) as never,
          status: 'TRANSCRIBED',
        },
      });
      return {
        transcriptId: existing.id,
        provider: input.provider,
        idempotent: true,
      };
    }

    const row = await this.prisma.meetingTranscript.create({
      data: {
        tenantId: input.tenantId,
        organizerUserId: input.userId,
        provider: input.provider,
        providerMeetingId: input.providerMeetingId,
        title,
        scheduledAt,
        durationSeconds,
        languageCode,
        transcriptText,
        participantsJson: (input.participants ?? []) as never,
        status: 'TRANSCRIBED',
      },
      select: { id: true },
    });
    return {
      transcriptId: row.id,
      provider: input.provider,
      idempotent: false,
    };
  }
}
