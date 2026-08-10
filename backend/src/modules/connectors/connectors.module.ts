import { Module, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectorRegistry } from './connector.registry';
import { ConnectorService } from './services/connector.service';
import { PrismaOAuthTokenStore } from './services/oauth-token.service';
import { CryptoService } from './services/crypto.service';
import { SyncSchedulerService } from './services/sync-scheduler.service';
import { OAuthService } from './services/oauth.service';
import { ConnectorsController } from './controllers/connectors.controller';
import { CrmWebhookController } from './controllers/crm-webhook.controller';
import { PipedriveConnector } from './adapters/pipedrive.adapter';
import { LiveHubSpotConnector } from './adapters/hubspot.adapter';
import { LiveSalesforceConnector } from './adapters/salesforce.adapter';
import { FetchHttpClient } from './adapters/live/fetch-http-client';
import { HubSpotClient } from './adapters/live/hubspot-client';
import { SalesforceClient } from './adapters/live/salesforce-client';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';

/**
 * ConnectorsModule — Phase 4.2 / 4.3 / Phase 27.
 *
 * Phase 27 (P27) replaces the PRODUCTION-BLOCKED HubSpot + Salesforce
 * stubs with real OAuth + HTTP clients. Live providers are wired
 * conditionally: when the upstream credentials are present in the
 * environment, the live client is registered in the connector
 * registry; otherwise the registry omits the provider so callers see
 * a `NotFoundException` (fail closed — never fake-success).
 *
 * OCP:  Add new adapters in onModuleInit without touching ConnectorService.
 * DIP:  All services receive dependencies via NestJS DI.
 * SRP:  PrismaOAuthTokenStore handles token persistence;
 *       SyncSchedulerService handles background scheduling only.
 */
@Module({
  imports: [AuditModule, ChannelsModule],
  controllers: [ConnectorsController, CrmWebhookController],
  providers: [
    ConnectorRegistry,
    ConnectorService,
    CryptoService,
    PrismaOAuthTokenStore,
    SyncSchedulerService,
    OAuthService,
    FetchHttpClient,
    {
      provide: HubSpotClient,
      useFactory: (
        http: FetchHttpClient,
        tokenStore: PrismaOAuthTokenStore,
        config: ConfigService,
      ) => {
        const id = config.get<string>('HUBSPOT_CLIENT_ID');
        const secret = config.get<string>('HUBSPOT_CLIENT_SECRET');
        if (!id || !secret) return null;
        return new HubSpotClient(http, tokenStore, id, secret);
      },
      inject: [FetchHttpClient, PrismaOAuthTokenStore, ConfigService],
    },
    {
      provide: SalesforceClient,
      useFactory: (
        http: FetchHttpClient,
        tokenStore: PrismaOAuthTokenStore,
        config: ConfigService,
      ) => {
        const id = config.get<string>('SALESFORCE_CLIENT_ID');
        const secret = config.get<string>('SALESFORCE_CLIENT_SECRET');
        const login =
          config.get<string>('SALESFORCE_LOGIN_URL') ??
          'https://login.salesforce.com';
        if (!id || !secret) return null;
        return new SalesforceClient(http, tokenStore, id, secret, login);
      },
      inject: [FetchHttpClient, PrismaOAuthTokenStore, ConfigService],
    },
  ],
  exports: [
    ConnectorService,
    ConnectorRegistry,
    CryptoService,
    PrismaOAuthTokenStore,
    SyncSchedulerService,
    OAuthService,
    FetchHttpClient,
    HubSpotClient,
    SalesforceClient,
  ],
})
export class ConnectorsModule implements OnModuleInit {
  private readonly logger = new Logger(ConnectorsModule.name);

  constructor(
    private readonly registry: ConnectorRegistry,
    @Optional() private readonly hubspotClient: HubSpotClient | null,
    @Optional() private readonly salesforceClient: SalesforceClient | null,
    private readonly tokenStore: PrismaOAuthTokenStore,
    private readonly http: FetchHttpClient,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.registry || typeof this.registry.register !== 'function') {
      this.logger.warn(
        'ConnectorRegistry unavailable during onModuleInit — skipping adapter registration',
      );
      return;
    }

    // Register live providers only when their credentials are present.
    // The provider tokens return null when env is missing; we only
    // register then-builder-with-non-null clients.
    if (this.hubspotClient) {
      this.registry.register(new LiveHubSpotConnector(this.hubspotClient));
    }
    if (this.salesforceClient) {
      this.registry.register(
        new LiveSalesforceConnector(this.salesforceClient),
      );
    }
    this.registry.register(new PipedriveConnector());
  }
}
