/**
 * Phase 16 — MeetingsController.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Exposes the meetings surface under `/api/v1/meetings/*`. Routes
 * are tenant-scoped (JWT-derived) and routed through the four
 * services declared in the module.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TranscriptIngestionService } from '../services/transcript-ingestion.service';
import { SummaryTemplatesService } from '../services/summary-templates.service';
import { ActionExtractorService } from '../services/action-extractor.service';
import { CrmLinkerService } from '../services/crm-linker.service';
import type { MeetingProvider } from '@prisma/client';

interface AuthedRequest extends Request {
  user: { sub: string; tenantId?: string; role: string };
}

function actor(req: AuthedRequest): { sub: string; tenantId: string } {
  const u = req.user;
  if (!u?.tenantId) throw new Error('tenant context required');
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

@Controller({ path: 'meetings', version: '1' })
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly ingestion: TranscriptIngestionService,
    private readonly templates: SummaryTemplatesService,
    private readonly extractor: ActionExtractorService,
    private readonly linker: CrmLinkerService,
  ) {}

  /** CR-AI-0401 — ingest a transcript. */
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
    if (!out) throw new Error('transcript not found');
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

  /** CR-AI-0403 — extract action items from a transcript. */
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
    if (!transcript) throw new Error('transcript not found');
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
}
