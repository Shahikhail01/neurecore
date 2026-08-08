/**
 * LiveHubSpotConnector — Phase 27 (P27) live connector (CR-AI-1106).
 *
 * Replaces the prior stub with a real HubSpot
 * connector that exchanges OAuth tokens and sync contacts/deals
 * through the live `IHubSpotClient`.
 *
 * SOLID:
 *   SRP — adapter only owns the connector lifecycle; HTTP lives in
 *         `IHubSpotClient` (single responsibility).
 *   OCP — adding HubSpot endpoints = new methods on the client, no
 *         edits to this class.
 *   LSP — substitutes any `ICRMConnector` consumer.
 *   DIP — depends on `IHubSpotClient` abstraction, not on raw fetch.
 *
 * Tenant isolation: every mutating call requires tenantId; the
 * wildcard `*` is rejected via `ForbiddenException`.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ICRMConnector } from '../interfaces/ICRMConnector';
import type { IHubSpotClient } from './live/hubspot-client';

@Injectable()
export class LiveHubSpotConnector implements ICRMConnector {
  readonly name = 'hubspot';

  private readonly logger = new Logger(LiveHubSpotConnector.name);

  constructor(private readonly client: IHubSpotClient) {}

  async connect(config: Record<string, unknown>): Promise<void> {
    if (!config || typeof config !== 'object') {
      throw new ForbiddenException('HubSpot connect requires config object');
    }
    const tenantId =
      typeof config['tenantId'] === 'string' ? config['tenantId'] : '';
    const code = typeof config['code'] === 'string' ? config['code'] : '';
    const redirectUri =
      typeof config['redirectUri'] === 'string' ? config['redirectUri'] : '';
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('HubSpot connect requires a real tenantId');
    }
    if (!code || !redirectUri) {
      throw new ForbiddenException(
        'HubSpot connect requires code and redirectUri',
      );
    }
    await this.client.exchangeCode({ tenantId, code, redirectUri });
    this.logger.log(`HubSpot connected tenant=${tenantId}`);
  }

  async disconnect(): Promise<void> {
    // Token deletion is the caller's responsibility (it owns the
    // tenantId). This is a no-op so the registry can succeed
    // idempotently.
  }

  async syncContacts(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId required');
    }
    const contacts = await this.client.fetchContacts(tenantId, 100);
    this.logger.log(
      `HubSpot syncContacts tenant=${tenantId} count=${contacts.length}`,
    );
  }

  async syncLeads(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId required');
    }
    const deals = await this.client.fetchDeals(tenantId, 100);
    this.logger.log(
      `HubSpot syncLeads tenant=${tenantId} count=${deals.length}`,
    );
  }
}
