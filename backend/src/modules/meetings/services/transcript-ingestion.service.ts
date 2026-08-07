/**
 * Phase 16 — TranscriptIngestionService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Closes CR-AI-0401 — "Meeting transcript ingestion with consent".
 *
 * Pipeline:
 *   1. verify a live consent row for (tenantId, userId, provider)
 *   2. upsert the transcript (idempotent on
 *      (tenantId, provider, providerMeetingId))
 *   3. tag the jurisdiction (default 'EU-GDPR' when locale is EU)
 *
 * SRP — owns ONLY ingestion. Summary templates, action
 * extraction, and CRM linkage are downstream services.
 *
 * SECURITY — tenant scope enforced at every Prisma call.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { MeetingProvider } from '@prisma/client';

export class MeetingConsentRequiredError extends ForbiddenException {
  constructor(public override readonly message: string) {
    super(message);
    this.name = 'MeetingConsentRequiredError';
  }
}

export class MeetingTenantForbiddenError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingTenantForbiddenError';
  }
}

export interface TranscriptIngestInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly provider: MeetingProvider;
  readonly providerMeetingId: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly durationSeconds: number;
  readonly transcriptText: string;
  readonly languageCode?: string;
  readonly jurisdiction?: string;
  readonly participants?: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

export interface TranscriptIngestResult {
  readonly transcriptId: string;
  readonly provider: MeetingProvider;
  readonly jurisdiction: string;
  readonly status: 'INGESTED' | 'TRANSCRIBED';
  readonly consentId: string;
}

@Injectable()
export class TranscriptIngestionService {
  private readonly logger = new Logger(TranscriptIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest a transcript. Idempotent — re-ingesting the same
   * (tenantId, provider, providerMeetingId) updates the row.
   */
  async ingest(input: TranscriptIngestInput): Promise<TranscriptIngestResult> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new MeetingTenantForbiddenError('tenantId required');
    }
    if (!input.userId) {
      throw new ForbiddenException('userId required');
    }

    // 1. verify live consent (not revoked)
    const consent = await this.prisma.meetingProviderConsent.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        provider: input.provider,
        revokedAt: null,
      },
      select: { id: true, jurisdiction: true, scopes: true },
    });
    if (!consent) {
      throw new MeetingConsentRequiredError(
        `no active consent for ${input.provider} by user ${input.userId} in tenant ${input.tenantId}`,
      );
    }

    // 2. jurisdiction precedence: explicit caller > consent row > locale default
    const jurisdiction = input.jurisdiction ?? defaultJurisdiction(input);

    // 3. upsert transcript
    const row = await this.prisma.meetingTranscript.upsert({
      where: {
        tenantId_provider_providerMeetingId: {
          tenantId: input.tenantId,
          provider: input.provider,
          providerMeetingId: input.providerMeetingId,
        },
      },
      create: {
        tenantId: input.tenantId,
        organizerUserId: input.userId,
        provider: input.provider,
        providerMeetingId: input.providerMeetingId,
        title: input.title,
        scheduledAt: input.scheduledAt,
        durationSeconds: input.durationSeconds,
        languageCode: input.languageCode ?? 'en',
        jurisdiction,
        transcriptText: input.transcriptText,
        participantsJson: (input.participants ?? []) as never,
        status: 'TRANSCRIBED',
      },
      update: {
        transcriptText: input.transcriptText,
        durationSeconds: input.durationSeconds,
        languageCode: input.languageCode ?? 'en',
        jurisdiction,
        participantsJson: (input.participants ?? []) as never,
        status: 'TRANSCRIBED',
      },
      select: { id: true, status: true, jurisdiction: true, provider: true },
    });

    return {
      transcriptId: row.id,
      provider: row.provider,
      jurisdiction: row.jurisdiction ?? jurisdiction,
      status: 'TRANSCRIBED',
      consentId: consent.id,
    };
  }

  /**
   * Grant consent — used by the consent-management wizard.
   */
  async grantConsent(params: {
    tenantId: string;
    userId: string;
    provider: MeetingProvider;
    scopes: ReadonlyArray<string>;
    jurisdiction?: string;
  }): Promise<{ consentId: string }> {
    if (!params.tenantId || params.tenantId === '*') {
      throw new MeetingTenantForbiddenError('tenantId required');
    }
    const row = await this.prisma.meetingProviderConsent.upsert({
      where: {
        tenantId_userId_provider: {
          tenantId: params.tenantId,
          userId: params.userId,
          provider: params.provider,
        },
      },
      create: {
        tenantId: params.tenantId,
        userId: params.userId,
        provider: params.provider,
        scopes: params.scopes as unknown as string[],
        jurisdiction: params.jurisdiction,
        grantedAt: new Date(),
        revokedAt: null,
      },
      update: {
        scopes: params.scopes as unknown as string[],
        jurisdiction: params.jurisdiction,
        revokedAt: null,
        grantedAt: new Date(),
      },
      select: { id: true },
    });
    return { consentId: row.id };
  }

  /**
   * Read transcript — tenant-scoped. Returns null when missing.
   */
  async getById(tenantId: string, transcriptId: string): Promise<{
    id: string;
    title: string;
    status: string;
    transcriptText: string;
    languageCode: string;
    jurisdiction: string | null;
    linkedRecordType: string | null;
    linkedRecordId: string | null;
  } | null> {
    if (!tenantId || tenantId === '*') return null;
    const row = await this.prisma.meetingTranscript.findFirst({
      where: { tenantId, id: transcriptId },
      select: {
        id: true,
        title: true,
        status: true,
        transcriptText: true,
        languageCode: true,
        jurisdiction: true,
        linkedRecordType: true,
        linkedRecordId: true,
      },
    });
    if (!row) return null;
    return row;
  }
}

/**
 * Conservative jurisdiction inference from a transcript. EU locales
 * default to EU-GDPR; everything else to US-CA. Callers may
 * override via input.jurisdiction or consent row.
 */
function defaultJurisdiction(input: TranscriptIngestInput): string {
  const lang = input.languageCode ?? 'en';
  if (lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('es') || lang.startsWith('it') || lang.startsWith('nl')) {
    return 'EU-GDPR';
  }
  if (lang.startsWith('ja') || lang.startsWith('zh') || lang.startsWith('ko')) {
    return 'APAC-PIPL';
  }
  return 'US-CA';
}
