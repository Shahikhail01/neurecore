/**
 * MeetingsModule — P3 (Meeting intelligence).
 *
 * Imports `WorkRuntimeModule` so the linker + follow-up services can
 * dispatch governed mutations, and the existing audit log via
 * `AuditModule` (global). KnowledgeModule is NOT imported — meeting
 * transcripts flow into the meetings store directly; downstream
 * ingestion into the knowledge index is a separate feature.
 */
import { Module } from '@nestjs/common';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
import { MeetingsController } from './controllers/meetings.controller';
import { TranscriptIngestionService } from './services/transcript-ingestion.service';
import { OutlookTranscriptProvider } from './services/outlook-transcript.provider';
import { TeamsTranscriptProvider } from './services/teams-transcript.provider';
import { ZoomTranscriptProvider } from './services/zoom-transcript.provider';
import { StandaloneTranscriptProvider } from './services/standalone-transcript.provider';
import { SummaryTemplatesService } from './services/summary-templates.service';
import { ActionExtractorService } from './services/action-extractor.service';
import { CrmLinkerService } from './services/crm-linker.service';
import { FollowupService } from './services/followup.service';
import { MeetingAuditService } from './services/meeting-audit.service';
import { MeetingService } from './services/meeting.service';

@Module({
  imports: [WorkRuntimeModule],
  controllers: [MeetingsController],
  providers: [
    TranscriptIngestionService,
    OutlookTranscriptProvider,
    TeamsTranscriptProvider,
    ZoomTranscriptProvider,
    StandaloneTranscriptProvider,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
    FollowupService,
    MeetingAuditService,
    MeetingService,
  ],
  exports: [
    MeetingService,
    TranscriptIngestionService,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
    FollowupService,
    MeetingAuditService,
  ],
})
export class MeetingsModule {}
