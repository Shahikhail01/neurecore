/**
 * Phase 16 + Phase 25 — Meetings module.
 *
 * Source plan:
 *   - IMPLEMENTATION-PLAN-PHASE-15-18.md §2 (Phase 16)
 *   - IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (Phase 25)
 *
 * Closes CR-AI-0401..0404 by composing the four focused services:
 *   - TranscriptIngestionService       (manual transcript POST)
 *   - LiveTranscriptIngestionService    (Outlook / Teams call-graph)
 *   - SummaryTemplatesService          (per-meeting-type template)
 *   - ActionExtractorService           (owner/due/confidence)
 *   - CrmLinkerService                 (link + live write-back)
 *
 * Phase 25 adds:
 *   - MeetingConsentService            (extracted consent gate)
 *   - OwnerResolver                    (auto-resolve @name → user)
 *   - OutlookCallGraphProvider         (Microsoft Graph live)
 *   - TeamsCallGraphProvider           (Microsoft Graph live)
 *   - TranscriptProviderRegistry       (OCP seam for new providers)
 *
 * SOLID — SRP: each service owns exactly one slice of the meeting
 * pipeline. The MeetingsController composes them. DIP: every
 * service depends on injected interfaces only.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { FetchHttpClient } from '../connectors/adapters/live/fetch-http-client';
import { PrismaOAuthTokenStore } from '../connectors/services/oauth-token.service';
import { MeetingsController } from './controllers/meetings.controller';
import { TranscriptIngestionService } from './services/transcript-ingestion.service';
import { SummaryTemplatesService } from './services/summary-templates.service';
import { ActionExtractorService } from './services/action-extractor.service';
import { CrmLinkerService } from './services/crm-linker.service';
import { MeetingConsentService, MEETING_CONSENT_SERVICE } from './services/meeting-consent.service';
import { LiveTranscriptIngestionService } from './services/live-transcript-ingestion.service';
import { OwnerResolver } from './services/owner-resolver';
import { OutlookCallGraphProvider } from './providers/outlook-call-graph.provider';
import { TeamsCallGraphProvider } from './providers/teams-call-graph.provider';
import { OutlookCallGraphClient } from './providers/outlook-call-graph.client';
import { TeamsCallGraphClient } from './providers/teams-call-graph.client';
import { I_OUTLOOK_CALL_GRAPH_CLIENT } from './providers/outlook-call-graph.provider';
import { I_TEAMS_CALL_GRAPH_CLIENT } from './providers/teams-call-graph.provider';
import { TranscriptProviderRegistry } from './registry/transcript-provider.registry';
import { TRANSCRIPT_PROVIDER } from './interfaces/ITranscriptProvider';

@Module({
  imports: [DatabaseModule, ConnectorsModule],
  controllers: [MeetingsController],
  providers: [
    // Phase 16
    TranscriptIngestionService,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
    // Phase 25
    MeetingConsentService,
    { provide: MEETING_CONSENT_SERVICE, useExisting: MeetingConsentService },
    OwnerResolver,
    OutlookCallGraphProvider,
    TeamsCallGraphProvider,
    // Live Graph clients (P25) — bound only when the shared HTTP +
    // OAuth token store are available; otherwise the providers fail
    // closed. DIP: clients depend on IHTTPClient + IOAuthTokenStore.
    {
      provide: OutlookCallGraphClient,
      useFactory: (
        http: FetchHttpClient,
        tokenStore: PrismaOAuthTokenStore,
      ) => new OutlookCallGraphClient(http, tokenStore),
      inject: [FetchHttpClient, PrismaOAuthTokenStore],
    },
    {
      provide: TeamsCallGraphClient,
      useFactory: (
        http: FetchHttpClient,
        tokenStore: PrismaOAuthTokenStore,
      ) => new TeamsCallGraphClient(http, tokenStore),
      inject: [FetchHttpClient, PrismaOAuthTokenStore],
    },
    { provide: I_OUTLOOK_CALL_GRAPH_CLIENT, useExisting: OutlookCallGraphClient },
    { provide: I_TEAMS_CALL_GRAPH_CLIENT, useExisting: TeamsCallGraphClient },
    // Multi-binding: every ITranscriptProvider goes under one token.
    {
      provide: TRANSCRIPT_PROVIDER,
      useFactory: (
        outlook: OutlookCallGraphProvider,
        teams: TeamsCallGraphProvider,
      ) => [outlook, teams],
      inject: [OutlookCallGraphProvider, TeamsCallGraphProvider],
    },
    TranscriptProviderRegistry,
    LiveTranscriptIngestionService,
  ],
  exports: [
    TranscriptIngestionService,
    SummaryTemplatesService,
    ActionExtractorService,
    CrmLinkerService,
    MeetingConsentService,
    OwnerResolver,
    OutlookCallGraphProvider,
    TeamsCallGraphProvider,
    TranscriptProviderRegistry,
    LiveTranscriptIngestionService,
  ],
})
export class MeetingsModule {}
