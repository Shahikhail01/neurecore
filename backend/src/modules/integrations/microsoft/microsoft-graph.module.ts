import { Module } from '@nestjs/common';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import { OutlookEmailService } from './outlook-email.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { TeamsAdapterService } from './teams-adapter.service';
import { MicrosoftWebhookController } from './microsoft-webhook.controller';
import { IntegrationsModule } from '../integrations.module';
import { MeetingsModule } from '../../meetings/meetings.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

/**
 * MicrosoftGraphModule — P7 Channels.
 *
 * Wires together the auth, email, calendar and Teams adapters plus
 * the Graph webhook controller. Re-uses canonical owners:
 *   - PrismaIntegrationCredentialStore (from IntegrationsModule)
 *   - FileIngestionService (from KnowledgeModule, P2)
 *   - TranscriptIngestionService (from MeetingsModule, P3)
 *   - IdempotencyService (Global via EnterpriseEventsModule)
 *
 * KnowledgeModule is NOT imported directly here — file-ingestion is
 * already a global provider in many knowledge sub-modules; importing
 * it once at the IntegrationsModule boundary avoids duplicate
 * ingestion rules. The Microsoft module imports it explicitly to
 * make the dependency clear for the architecture spec test.
 */
@Module({
  imports: [IntegrationsModule, MeetingsModule, KnowledgeModule],
  controllers: [MicrosoftWebhookController],
  providers: [
    MicrosoftGraphAuthService,
    OutlookEmailService,
    OutlookCalendarService,
    TeamsAdapterService,
  ],
  exports: [
    MicrosoftGraphAuthService,
    OutlookEmailService,
    OutlookCalendarService,
    TeamsAdapterService,
  ],
})
export class MicrosoftGraphModule {}
