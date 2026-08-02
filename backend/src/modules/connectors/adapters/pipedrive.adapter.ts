import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * PipedriveConnector
 *
 * PRODUCTION-BLOCKED: PD-21 — API token storage is not yet implemented.
 * In production the adapter fails closed (throws). Outside production
 * (development, tests) it is a no-op so dev workflows are not broken.
 * Tracked in pending-tasks.md PD-21.
 */
export class PipedriveConnector implements ICRMConnector {
  name = 'pipedrive';

  async connect(_config: Record<string, unknown>): Promise<void> {
    void JSON.stringify(_config);
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'PipedriveConnector: API token storage not implemented (PD-21). ' +
          'Do not enable in production.',
      );
    }
    // TODO: Store encrypted API token from config
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'PipedriveConnector: not implemented in production (PD-21)',
      );
    }
    // GET https://api.pipedrive.com/v1/persons
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'PipedriveConnector: not implemented in production (PD-21)',
      );
    }
    // GET https://api.pipedrive.com/v1/deals
    return Promise.resolve();
  }
}
