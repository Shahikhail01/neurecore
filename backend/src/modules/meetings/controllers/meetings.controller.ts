/**
 * Meetings REST controller (P3).
 *
 * Endpoints:
 *   POST /meetings/transcripts        — ingest
 *   GET  /meetings/:id/summary        — typed summary
 *   GET  /meetings/:id/actions        — extracted action items
 *   POST /meetings/:id/link-crm       — queue WorkRun
 *   POST /meetings/:id/follow-up      — compose + queue WorkRun
 *   POST /meetings/:id/corrections    — record correction
 *
 * Auth: tenant id is read from the request context. Controllers
 * remain thin; all logic lives in the injected services.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TranscriptIngestionService } from '../services/transcript-ingestion.service';
import { MeetingService } from '../services/meeting.service';
import { MeetingAuditService } from '../services/meeting-audit.service';
import type {
  MeetingLink,
  MeetingProvider,
  SummaryTemplateKey,
} from '../schemas/meeting.types';

interface AuthenticatedRequest extends Request {
  user: { tenantId: string; id: string };
}

@Controller('meetings')
export class MeetingsController {
  private readonly logger = new Logger(MeetingsController.name);

  constructor(
    private readonly ingestion: TranscriptIngestionService,
    private readonly meeting: MeetingService,
    private readonly audit: MeetingAuditService,
  ) {}

  @Post('transcripts')
  @HttpCode(202)
  async ingestTranscript(
    @Req() req: AuthenticatedRequest,
    @Headers('x-provider') provider: MeetingProvider,
    @Headers('x-provider-signature') signature: string | undefined,
    @Body() body: { externalId: string; consent: unknown; rawBody?: string },
  ) {
    const { tenantId, id: actorId } = req.user;
    const transcript = await this.ingestion.ingest({
      tenantId,
      actorId,
      provider,
      externalId: body.externalId,
      consent: body.consent as never,
      rawBody: body.rawBody,
      signature,
    });
    await this.meeting.saveTranscript(transcript);
    return {
      meetingId: transcript.id,
      tenantId,
      provider: transcript.provider,
    };
  }

  @Get(':id/summary')
  async getSummary(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('template') template: SummaryTemplateKey = 'overview',
  ) {
    return this.meeting.getSummary(req.user.tenantId, id, template);
  }

  @Get(':id/actions')
  async getActions(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.meeting.getActions(req.user.tenantId, id);
  }

  @Post(':id/link-crm')
  async linkCrm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { links: MeetingLink[] },
  ) {
    return this.meeting.linkToCrm(
      req.user.tenantId,
      req.user.id,
      id,
      body.links,
    );
  }

  @Post(':id/follow-up')
  async followUp(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.meeting.requestFollowup(req.user.tenantId, req.user.id, id);
  }

  @Post(':id/corrections')
  async corrections(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      field: 'actionItem' | 'summarySection' | 'participant';
      targetId: string;
      before: unknown;
      after: unknown;
      reason: string;
    },
  ) {
    return this.audit.recordCorrection({
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      meetingId: id,
      field: body.field,
      targetId: body.targetId,
      before: body.before,
      after: body.after,
      reason: body.reason,
    });
  }
}
