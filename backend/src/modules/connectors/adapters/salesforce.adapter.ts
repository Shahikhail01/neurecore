/**
 * LiveSalesforceConnector — Phase 27 (P27) live connector (CR-AI-1106).
 *
 * Replaces the prior stub with a real Salesforce
 * connector that exchanges OAuth tokens and queries Contacts/Leads
 * via SOQL through the live `ISalesforceClient`.
 *
 * SOLID design mirrors `LiveHubSpotConnector` (SRP / OCP / LSP / DIP).
 * Tenant isolation: rejects wildcard `*` tenantId on every call.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ICRMConnector } from '../interfaces/ICRMConnector';
import type { ISalesforceClient } from './live/salesforce-client';

@Injectable()
export class LiveSalesforceConnector implements ICRMConnector {
  readonly name = 'salesforce';

  private readonly logger = new Logger(LiveSalesforceConnector.name);

  constructor(private readonly client: ISalesforceClient) {}

  async connect(config: Record<string, unknown>): Promise<void> {
    const tenantId =
      typeof config['tenantId'] === 'string' ? config['tenantId'] : '';
    const code = typeof config['code'] === 'string' ? config['code'] : '';
    const redirectUri =
      typeof config['redirectUri'] === 'string' ? config['redirectUri'] : '';
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('Salesforce connect requires tenantId');
    }
    if (!code || !redirectUri) {
      throw new ForbiddenException(
        'Salesforce connect requires code and redirectUri',
      );
    }
    await this.client.exchangeCode({ tenantId, code, redirectUri });
    this.logger.log(`Salesforce connected tenant=${tenantId}`);
  }

  async disconnect(): Promise<void> {
    // Token deletion is the caller's responsibility.
  }

  async syncContacts(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId required');
    }
    const contacts = await this.client.queryContacts(tenantId, 200);
    this.logger.log(
      `Salesforce syncContacts tenant=${tenantId} count=${contacts.length}`,
    );
  }

  async syncLeads(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId required');
    }
    const leads = await this.client.queryLeads(tenantId, 200);
    this.logger.log(
      `Salesforce syncLeads tenant=${tenantId} count=${leads.length}`,
    );
  }
}
