import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * HubSpotConnector
 *
 * PRODUCTION-BLOCKED: PD-21 — OAuth2 flow is not yet implemented.
 * In production the adapter fails closed (throws). Outside production
 * (development, tests) it is a no-op so dev workflows are not broken.
 * Tracked in pending-tasks.md PD-21.
 */
export class HubSpotConnector implements ICRMConnector {
  name = 'hubspot';

  async connect(_config: Record<string, unknown>): Promise<void> {
    void JSON.stringify(_config);
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'HubSpotConnector: OAuth2 flow not implemented (PD-21). ' +
          'Do not enable in production.',
      );
    }
    // TODO: Exchange code for tokens via HubSpot OAuth2 endpoint
    // POST https://api.hubapi.com/oauth/v1/token
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'HubSpotConnector: not implemented in production (PD-21)',
      );
    }
    // GET https://api.hubapi.com/crm/v3/objects/contacts?limit=100
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'HubSpotConnector: not implemented in production (PD-21)',
      );
    }
    // GET https://api.hubapi.com/crm/v3/objects/deals
    return Promise.resolve();
  }
}
