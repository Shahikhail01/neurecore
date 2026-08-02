import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaIntegrationCredentialStore } from './services/integration-credential.store';
import { BrevoEmailService } from './brevo/brevo-email.service';
import { BrevoUsageService } from './brevo/brevo-usage.service';
import { BrevoWebhookService } from './brevo/brevo-webhook.service';
import { BrevoSuppressionService } from './brevo/brevo-suppression.service';
import { AdminBrevoService } from './brevo/admin-brevo.service';
import { CryptoService } from '../connectors/services/crypto.service';
import { GoogleAuthClient } from './google/google-auth.client';
import { GoogleGmailService } from './google/google-gmail.service';
import { GoogleCalendarService } from './google/google-calendar.service';
import { GoogleDriveService } from './google/google-drive.service';
import { GoogleSheetsService } from './google/google-sheets.service';
import { GoogleDocsService } from './google/google-docs.service';
import { GoogleSlidesService } from './google/google-slides.service';
import { DriveCleanupService } from './google/drive-cleanup.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { BrevoEmailProvider } from './email/brevo-email.provider';
import { EmailProviderFactory } from './email/email-provider.factory';

@Module({
  imports: [NotificationsModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    PrismaIntegrationCredentialStore,
    BrevoEmailService,
    BrevoUsageService,
    BrevoWebhookService,
    BrevoSuppressionService,
    AdminBrevoService,
    CryptoService,
    GoogleAuthClient,
    GoogleGmailService,
    GoogleCalendarService,
    GoogleDriveService,
    GoogleSheetsService,
    GoogleDocsService,
    GoogleSlidesService,
    DriveCleanupService,
    GmailEmailProvider,
    BrevoEmailProvider,
    EmailProviderFactory,
  ],
  exports: [
    IntegrationsService,
    BrevoEmailService,
    BrevoUsageService,
    BrevoWebhookService,
    BrevoSuppressionService,
    AdminBrevoService,
    GoogleAuthClient,
    GoogleGmailService,
    GoogleCalendarService,
    GoogleDriveService,
    GoogleSheetsService,
    GoogleDocsService,
    GoogleSlidesService,
    DriveCleanupService,
    EmailProviderFactory,
    PrismaIntegrationCredentialStore,
  ],
})
export class IntegrationsModule {}
