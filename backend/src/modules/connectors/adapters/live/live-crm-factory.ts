/**
 * LiveCrmClients — factory for the live HubSpot + Salesforce clients.
 *
 * Phase 27 (P27) — Live connectors (CR-AI-1106).
 *
 * SRP — only assembles the live clients from environment variables.
 *       Returns null when credentials are missing so the registry can
 *       skip the adapter (never silently proxy to nothing).
 * OCP — new CRM clients = new factory methods, no edits to callers.
 * DIP — clients are typed as their I… interface; no direct imports.
 */
import type { IHTTPClient } from './http-client';
import { FetchHttpClient } from './fetch-http-client';
import {
  HubSpotClient,
  type IHubSpotClient,
  HUBSPOT_PROVIDER,
} from './hubspot-client';
import {
  SalesforceClient,
  type ISalesforceClient,
  SALESFORCE_PROVIDER,
} from './salesforce-client';
import type { IOAuthTokenStore } from '../../interfaces/IOAuthTokenStore';

export interface LiveCrmClients {
  readonly hubspot: IHubSpotClient | null;
  readonly salesforce: ISalesforceClient | null;
}

export function createLiveCrmClients(input: {
  tokenStore: IOAuthTokenStore;
  http?: IHTTPClient;
  env?: NodeJS.ProcessEnv;
}): LiveCrmClients {
  const env = input.env ?? process.env;
  const http = input.http ?? new FetchHttpClient();
  const hubspotId = env['HUBSPOT_CLIENT_ID'];
  const hubspotSecret = env['HUBSPOT_CLIENT_SECRET'];
  const sfId = env['SALESFORCE_CLIENT_ID'];
  const sfSecret = env['SALESFORCE_CLIENT_SECRET'];
  const sfLogin = env['SALESFORCE_LOGIN_URL'] ?? 'https://login.salesforce.com';

  return {
    hubspot:
      hubspotId && hubspotSecret
        ? new HubSpotClient(http, input.tokenStore, hubspotId, hubspotSecret)
        : null,
    salesforce:
      sfId && sfSecret
        ? new SalesforceClient(http, input.tokenStore, sfId, sfSecret, sfLogin)
        : null,
  };
}

export const LIVE_CRM_PROVIDER_NAMES = {
  [HUBSPOT_PROVIDER]: HUBSPOT_PROVIDER,
  [SALESFORCE_PROVIDER]: SALESFORCE_PROVIDER,
} as const;
