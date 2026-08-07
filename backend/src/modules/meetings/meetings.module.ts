/**
 * Phase 16 — Meetings module.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Closes CR-AI-0401..0404 by composing four focused services:
 *   - TranscriptIngestionService   (CR-AI-0401 jurisdiction-aware consent)
 *   - SummaryTemplatesService      (CR-AI-0402 per-meeting-type template)
 *   - ActionExtractorService       (CR-AI-0403 owner/due/confidence)
 *   - CrmLinkerService             (CR-AI-0404 link + follow-up writes)
 *
 * SOLID — SRP: each service owns exactly one slice of the meeting
 * pipeline. The MeetingsController composes them.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MeetingsController } from './controllers/meetings.controller';
import { TranscriptIngestionService } from './services/transcript-ingestion.service';
import { SummaryTemplatesService } from './services/summary-templates.service';
import { ActionExtractorService } from './services/action-extractor.service';
import { CrmLinkerService } from './services/crm-linker.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MeetingsController],
  providers: [
    TranscriptIngestionService,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
  ],
  exports: [
    TranscriptIngestionService,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
  ],
})
export class MeetingsModule {}
