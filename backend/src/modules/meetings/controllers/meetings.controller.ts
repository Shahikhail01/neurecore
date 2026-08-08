/**
 * Phase 16 + Phase 25 — MeetingsController.
 *
 * Source plan:
 *   - IMPLEMENTATION-PLAN-PHASE-15-18.md §2 (Phase 16)
 *   - IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (Phase 25)
 *
 * Phase 25 surface additions:
 *   - POST /meetings/consents        grant consent for a provider
 *   - DELETE /meetings/consents      revoke consent
 *   - POST /meetings/live-events     ingest a live call-graph event
 *                                    (called from the webhook handler)
 *   - PATCH /meetings/summary-templates/:id  live editor
 *   - DELETE /meetings/summary-templates/:id retire a template
 *   - POST /meetings/transcripts/:id/actions-extract-resolved
 *                                    run the extractor with owner
 *                                    auto-resolution against real
 *                                    user records
 *   - POST /meetings/transcripts/:id/write-back
 *                                    write the meeting to live CRM
 *                                    (customer_touchpoint_events)
 *
 * All routes are tenant-scoped (JWT-derived) and routed through
 * the four services declared in the module.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MeetingProvider } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TranscriptIngestionService } from '../services/transcript-ingestion.service';
import { SummaryTemplatesService } from '../services/summary-templates.service';
import { ActionExtractorService } from '../services/action-extractor.service';
import { CrmLinkerService } from '../services/crm-linker.service';
import { MeetingConsentService } from '../services/meeting-consent.service';
import { LiveTranscriptIngestionService } from '../services/live-transcript-ingestion.service';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  user: { sub: string; tenantId?: string; role: string };
}

function actor(req: AuthedRequest): { sub: string; tenantId: string } {
  const u = req.user;
  if (!u?.tenantId) throw new BadRequestException('tenant context required');
  return { sub: u.sub, tenantId: u.tenantId };
}

interface IngestDto {
  provider: MeetingProvider;
  providerMeetingId: string;
  title: string;
  scheduledAt: string;
  durationSeconds: number;
  transcriptText: string;
  languageCode?: string;
  jurisdiction?: string;
  participants?: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

interface TemplateDto {
  name: string;
  meetingType: string;
  sections: { decisions: string; actions: string; risks: string; sentiment: string };
  isDefault?: boolean;
}

interface LinkDto {
  recordType: 'account' | 'contact' | 'lead' | 'opportunity' | 'case';
  recordId: string;
}

interface PersistActionsDto {
  items: ReadonlyArray<{
    description: string;
    ownerUserId?: string | null;
    ownerHint?: string | null;
    dueDate?: string | null;
    confidencePercent?: number;
    ambiguousOwner?: boolean;
  }>;
}

interface ConsentDto {
  provider: MeetingProvider;
  scopes: ReadonlyArray<string>;
  jurisdiction?: string;
}

interface LiveEventDto {
  provider: MeetingProvider;
  providerMeetingId: string;
  transcriptText?: string;
  title?: string;
  scheduledAt?: string;
  durationSeconds?: number;
  languageCode?: string;
  participants?: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

interface WriteBackDto {
  channelKind: string;
  subject: string;
  body?: string;
  occurredAt: string;
  tags?: ReadonlyArray<string>;
}

@Controller({ path: 'meetings', version: '1' })
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly ingestion: TranscriptIngestionService,
    private readonly templates: SummaryTemplatesService,
    private readonly extractor: ActionExtractorService,
    private readonly linker: CrmLinkerService,
    private readonly consent: MeetingConsentService,
    private readonly liveIngestion: LiveTranscriptIngestionService,
  ) {}

  /** CR-AI-0401 — ingest a transcript manually. */
  @Post('transcripts')
  @HttpCode(HttpStatus.CREATED)
  async ingest(@Req() req: AuthedRequest, @Body() body: IngestDto) {
    const { tenantId, sub } = actor(req);
    return this.ingestion.ingest({
      tenantId,
      userId: sub,
      provider: body.provider,
      providerMeetingId: body.providerMeetingId,
      title: body.title,
      scheduledAt: new Date(body.scheduledAt),
      durationSeconds: body.durationSeconds,
      transcriptText: body.transcriptText,
      languageCode: body.languageCode,
      jurisdiction: body.jurisdiction,
      participants: body.participants,
    });
  }

  @Get('transcripts/:id')
  @HttpCode(HttpStatus.OK)
  async getTranscript(@Req() req: AuthedRequest, @Param('id') id: string) {
    const { tenantId } = actor(req);
    const out = await this.ingestion.getById(tenantId, id);
    if (!out) throw new BadRequestException('transcript not found');
    return out;
  }

  /** CR-AI-0402 — summary templates. */
  @Get('summary-templates')
  @HttpCode(HttpStatus.OK)
  async listTemplates(@Req() req: AuthedRequest) {
    const { tenantId } = actor(req);
    return this.templates.list(tenantId);
  }

  @Post('summary-templates')
  @HttpCode(HttpStatus.OK)
  async createTemplate(@Req() req: AuthedRequest, @Body() body: TemplateDto) {
    const { tenantId } = actor(req);
    return this.templates.create(
      tenantId,
      body.name,
      body.meetingType,
      body.sections,
      body.isDefault ?? false,
    );
  }

  @Post('summary-templates/ensure-defaults')
  @HttpCode(HttpStatus.OK)
  async ensureDefaults(@Req() req: AuthedRequest) {
    const { tenantId } = actor(req);
    return this.templates.ensureDefaults(tenantId);
  }

  @Get('summary-templates/pick')
  @HttpCode(HttpStatus.OK)
  async pickTemplate(
    @Req() req: AuthedRequest,
    @Query('meetingType') meetingType: string,
  ) {
    const { tenantId } = actor(req);
    return this.templates.pickFor(tenantId, meetingType);
  }

  /** Phase 25 — live editor: update an existing template. */
  @Patch('summary-templates/:id')
  @HttpCode(HttpStatus.OK)
  async updateTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: Partial<TemplateDto>,
  ) {
    const { tenantId } = actor(req);
    return this.templates.update(tenantId, id, {
      name: body.name,
      meetingType: body.meetingType,
      sections: body.sections,
      isDefault: body.isDefault,
    });
  }

  /** Phase 25 — delete a template (refuses last default). */
  @Delete('summary-templates/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(@Req() req: AuthedRequest, @Param('id') id: string) {
    const { tenantId } = actor(req);
    return this.templates.delete(tenantId, id);
  }

  /** CR-AI-0403 — extract action items (sync, no owner resolution). */
  @Post('transcripts/:id/extract-actions')
  @HttpCode(HttpStatus.OK)
  async extractActions(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('persist') persist: string | undefined,
    @Body() body: PersistActionsDto | undefined,
  ) {
    const { tenantId } = actor(req);
    const transcript = await this.ingestion.getById(tenantId, id);
    if (!transcript) throw new BadRequestException('transcript not found');
    const items = this.extractor.extract({
      tenantId,
      transcriptId: id,
      transcriptText: transcript.transcriptText,
    });
    if (persist === 'true') {
      return this.linker.persistActionItems({
        tenantId,
        transcriptId: id,
        items: body?.items ?? items,
      });
    }
    return { items };
  }

  /**
   * Phase 25 — owner auto-resolution. Resolves `@name` tokens
   * against the tenant's `User` table and returns items with
   * `ownerUserId` populated.
   */
  @Post('transcripts/:id/actions-extract-resolved')
  @HttpCode(HttpStatus.OK)
  async extractActionsResolved(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('persist') persist: string | undefined,
    @Body() body: PersistActionsDto | undefined,
  ) {
    const { tenantId } = actor(req);
    const transcript = await this.ingestion.getById(tenantId, id);
    if (!transcript) throw new BadRequestException('transcript not found');
    const items = await this.extractor.extractWithOwnerResolution({
      tenantId,
      transcriptId: id,
      transcriptText: transcript.transcriptText,
    });
    if (persist === 'true') {
      return this.linker.persistActionItems({
        tenantId,
        transcriptId: id,
        items: body?.items ?? items,
      });
    }
    return { items };
  }

  /** CR-AI-0404 — link a transcript to a CRM record. */
  @Post('transcripts/:id/link')
  @HttpCode(HttpStatus.OK)
  async link(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: LinkDto,
  ) {
    const { tenantId } = actor(req);
    return this.linker.link({
      tenantId,
      transcriptId: id,
      recordType: body.recordType,
      recordId: body.recordId,
    });
  }

  /** Phase 25 — write-back: meeting → live CRM touchpoint event. */
  @Post('transcripts/:id/write-back')
  @HttpCode(HttpStatus.OK)
  async writeBack(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: WriteBackDto,
  ) {
    const { tenantId } = actor(req);
    return this.linker.writeBack({
      tenantId,
      transcriptId: id,
      channelKind: body.channelKind,
      subject: body.subject,
      body: body.body,
      occurredAt: new Date(body.occurredAt),
      tags: body.tags,
    });
  }

  /** Phase 25 — grant consent for a provider. */
  @Post('consents')
  @HttpCode(HttpStatus.OK)
  async grantConsent(@Req() req: AuthedRequest, @Body() body: ConsentDto) {
    const { tenantId, sub } = actor(req);
    return this.consent.grant({
      tenantId,
      userId: sub,
      provider: body.provider,
      scopes: body.scopes,
      jurisdiction: body.jurisdiction,
    });
  }

  /** Phase 25 — revoke consent. */
  @Delete('consents')
  @HttpCode(HttpStatus.OK)
  async revokeConsent(
    @Req() req: AuthedRequest,
    @Query('provider') provider: MeetingProvider,
  ) {
    const { tenantId, sub } = actor(req);
    return this.consent.revoke({ tenantId, userId: sub, provider });
  }

  /** Phase 25 — live event ingestion (Outlook / Teams call-graph). */
  @Post('live-events')
  @HttpCode(HttpStatus.OK)
  async ingestLive(@Req() req: AuthedRequest, @Body() body: LiveEventDto) {
    const { tenantId, sub } = actor(req);
    return this.liveIngestion.ingestLive({
      tenantId,
      userId: sub,
      provider: body.provider,
      providerMeetingId: body.providerMeetingId,
      transcriptText: body.transcriptText,
      title: body.title,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      durationSeconds: body.durationSeconds,
      languageCode: body.languageCode,
      participants: body.participants,
    });
  }
}
