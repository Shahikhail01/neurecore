/**
 * Transcript ingestion service — the P3 entry point for raw transcripts
 * (P3 §Meeting Intelligence).
 *
 * Acceptance requires:
 *   1. A valid consent record (jurisdiction-aware policy gate).
 *   2. A working provider (typed unavailable → 503, not silent success).
 *   3. Tenant isolation — `tenantId` must match the consent's tenant.
 *
 * The service is intentionally small: it delegates actual transcript
 * fetch to the {@link ITranscriptProvider} port and the persisted
 * meeting record is constructed in {@link MeetingService}.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type {
  MeetingConsent,
  MeetingTranscript,
  MeetingProvider,
} from '../schemas/meeting.types';
import type { ITranscriptProvider } from './transcript-provider.interface';
import { OutlookTranscriptProvider } from './outlook-transcript.provider';
import { TeamsTranscriptProvider } from './teams-transcript.provider';
import { ZoomTranscriptProvider } from './zoom-transcript.provider';
import { StandaloneTranscriptProvider } from './standalone-transcript.provider';

export interface IngestTranscriptInput {
  tenantId: string;
  actorId: string;
  provider: MeetingProvider;
  externalId: string;
  consent: MeetingConsent;
  /** Raw body for signature verification (webhooks) or JSON payload (standalone). */
  rawBody?: string;
  signature?: string;
}

@Injectable()
export class TranscriptIngestionService {
  private readonly logger = new Logger(TranscriptIngestionService.name);
  private readonly providers: Map<MeetingProvider, ITranscriptProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    outlook: OutlookTranscriptProvider,
    teams: TeamsTranscriptProvider,
    zoom: ZoomTranscriptProvider,
    standalone: StandaloneTranscriptProvider,
  ) {
    this.providers = new Map<MeetingProvider, ITranscriptProvider>([
      ['OUTLOOK', outlook],
      ['TEAMS', teams],
      ['ZOOM', zoom],
      ['STANDALONE', standalone],
    ]);
  }

  /**
   * Ingest a transcript. Returns the normalized transcript ready for
   * the downstream summary / action / link / follow-up services.
   */
  async ingest(input: IngestTranscriptInput): Promise<MeetingTranscript> {
    this.assertConsent(input.consent, input.tenantId);
    if (
      input.consent.expiresAt &&
      new Date(input.consent.expiresAt).getTime() < Date.now()
    ) {
      throw new ForbiddenException('consent_expired');
    }
    const provider = this.providers.get(input.provider);
    if (!provider) {
      throw new NotFoundException(`provider ${input.provider} not registered`);
    }
    if (!provider.isAvailable()) {
      // Fail closed — plan rule 3.13.
      throw new ForbiddenException(`provider ${input.provider} unavailable`);
    }
    if (input.signature) {
      try {
        provider.verifySignature(input.rawBody ?? '', input.signature);
      } catch (err) {
        await this.audit.log({
          actor: input.actorId,
          action: 'meetings.transcript.signature_invalid',
          resource: 'meeting_transcript',
          resourceId: input.externalId,
          tenantId: input.tenantId,
          result: 'failure',
          details: { provider: input.provider, reason: (err as Error).message },
        });
        throw new BadRequestException('signature_invalid');
      }
    }
    const transcript = await provider.fetch({
      tenantId: input.tenantId,
      externalId: input.externalId,
      rawBody: input.rawBody,
      signature: input.signature,
    });
    const safeTranscript: MeetingTranscript = transcript;
    await this.audit.log({
      actor: input.actorId,
      action: 'meetings.transcript.ingested',
      resource: 'meeting_transcript',
      resourceId: safeTranscript.id,
      tenantId: input.tenantId,
      details: {
        provider: safeTranscript.provider,
        externalId: safeTranscript.externalId,
        participants: safeTranscript.participants.length,
        utterances: safeTranscript.utterances.length,
        jurisdiction: input.consent.jurisdiction,
      },
    });
    return safeTranscript;
  }

  /** Provider health surface — for the Command Center P8 view. */
  listProviderStatus(): Array<{
    provider: MeetingProvider;
    available: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([provider, p]) => ({
      provider,
      available: p.isAvailable(),
    }));
  }

  private assertConsent(consent: MeetingConsent, tenantId: string): void {
    if (!consent) throw new BadRequestException('consent required');
    if (consent.tenantId !== tenantId) {
      throw new ForbiddenException('consent_tenant_mismatch');
    }
    if (!consent.scope) throw new BadRequestException('consent.scope required');
    if (!consent.jurisdiction)
      throw new BadRequestException('consent.jurisdiction required');
  }
}
