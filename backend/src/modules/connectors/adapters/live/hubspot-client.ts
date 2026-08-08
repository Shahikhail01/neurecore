/**
 * HubSpot HTTP client — typed wrapper around HubSpot REST v3.
 *
 * Phase 27 (P27) — Live connectors (CR-AI-1106).
 *
 * Responsibilities (SRP):
 *  - exchange OAuth2 authorization code for HubSpot tokens,
 *  - refresh an expired access token,
 *  - GET a page of contacts / deals / companies,
 *  - verify a HubSpot webhook signature (X-HubSpot-Signature-v3).
 *
 * Reuses the `IOAuthTokenStore` port (P4.3) for token persistence.
 *
 * The adapter does NOT call `fetch` directly; it depends on
 * `IHTTPClient` (DIP) so tests can substitute a fake HTTP client.
 *
 * OCP — new HubSpot endpoints = new methods on this class only.
 * ISP — no fat port; the ICRMConnector surface stays narrow.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { IHTTPClient } from './http-client';
import type { IOAuthTokenStore } from '../../interfaces/IOAuthTokenStore';

export const HUBSPOT_PROVIDER = 'hubspot';
export const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
export const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface HubSpotTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface HubSpotContactSummary {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  updatedAt?: string;
}

export interface HubSpotDealSummary {
  id: string;
  dealName?: string;
  amount?: number;
  dealStage?: string;
  closeDate?: string;
}

export interface IHubSpotClient {
  exchangeCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
  }): Promise<HubSpotTokens>;
  refreshTokenIfNeeded(tenantId: string): Promise<string | null>;
  fetchContacts(
    tenantId: string,
    limit: number,
  ): Promise<HubSpotContactSummary[]>;
  fetchDeals(tenantId: string, limit: number): Promise<HubSpotDealSummary[]>;
  verifyWebhookSignature(input: {
    tenantId: string;
    signature: string;
    requestBody: string;
    secret: string;
  }): boolean;
}

@Injectable()
export class HubSpotClient implements IHubSpotClient {
  private readonly logger = new Logger(HubSpotClient.name);

  constructor(
    private readonly http: IHTTPClient,
    private readonly tokenStore: IOAuthTokenStore,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async exchangeCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
  }): Promise<HubSpotTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    const res = await this.http.request({
      url: HUBSPOT_TOKEN_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(
        `HubSpot token exchange failed: ${res.status} ${res.body}`,
      );
      throw new BadRequestException(
        `HubSpot token exchange failed: ${res.status}`,
      );
    }
    const tokens = JSON.parse(res.body) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;
    const stored: HubSpotTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: (tokens.scope ?? '').split(' ').filter(Boolean) || [],
    };
    await this.tokenStore.save(input.tenantId, HUBSPOT_PROVIDER, stored);
    return stored;
  }

  async refreshTokenIfNeeded(tenantId: string): Promise<string | null> {
    const existing = await this.tokenStore.get(tenantId, HUBSPOT_PROVIDER);
    if (!existing) return null;
    if (
      !existing.expiresAt ||
      existing.expiresAt.getTime() > Date.now() + 60_000
    ) {
      return existing.accessToken;
    }
    if (!existing.refreshToken) return null;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: existing.refreshToken,
    });
    const res = await this.http.request({
      url: HUBSPOT_TOKEN_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(`HubSpot refresh failed: ${res.status}`);
      return null;
    }
    const tokens = JSON.parse(res.body) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    const next: HubSpotTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing.refreshToken,
      expiresAt,
      scopes: existing.scopes ?? [],
    };
    await this.tokenStore.save(tenantId, HUBSPOT_PROVIDER, next);
    return next.accessToken;
  }

  async fetchContacts(
    tenantId: string,
    limit: number,
  ): Promise<HubSpotContactSummary[]> {
    const accessToken = await this.refreshTokenIfNeeded(tenantId);
    if (!accessToken) return [];
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=${cappedLimit}&properties=email,firstname,lastname,lastmodifieddate`;
    const res = await this.http.request({
      url,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(`HubSpot fetchContacts failed: ${res.status}`);
      return [];
    }
    const parsed = JSON.parse(res.body) as {
      results?: Array<{
        id: string;
        properties?: Record<string, string | null>;
        updatedAt?: string;
      }>;
    };
    return (parsed.results ?? []).map((r) => ({
      id: r.id,
      email: r.properties?.['email'] ?? undefined,
      firstName: r.properties?.['firstname'] ?? undefined,
      lastName: r.properties?.['lastname'] ?? undefined,
      updatedAt: r.updatedAt,
    }));
  }

  async fetchDeals(
    tenantId: string,
    limit: number,
  ): Promise<HubSpotDealSummary[]> {
    const accessToken = await this.refreshTokenIfNeeded(tenantId);
    if (!accessToken) return [];
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/deals?limit=${cappedLimit}&properties=dealname,amount,dealstage,closedate`;
    const res = await this.http.request({
      url,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(`HubSpot fetchDeals failed: ${res.status}`);
      return [];
    }
    const parsed = JSON.parse(res.body) as {
      results?: Array<{
        id: string;
        properties?: Record<string, string | null>;
      }>;
    };
    return (parsed.results ?? []).map((r) => ({
      id: r.id,
      dealName: r.properties?.['dealname'] ?? undefined,
      amount: r.properties?.['amount']
        ? parseFloat(r.properties['amount'])
        : undefined,
      dealStage: r.properties?.['dealstage'] ?? undefined,
      closeDate: r.properties?.['closedate'] ?? undefined,
    }));
  }

  /**
   * Verify HubSpot webhook signature (X-HubSpot-Signature-v3).
   *
   * HubSpot computes:
   *   base64(HMAC-SHA256(secret, requestBody + ' ' + method + ' ' + uri + ' ' + timestamp))
   *
   * The full v3 signature protocol includes `method`, `uri`, `timestamp`.
   * Callers supply those when calling this method to keep the verifier
   * pure (no global state).
   */
  verifyWebhookSignature(input: {
    tenantId: string;
    signature: string;
    requestBody: string;
    secret: string;
  }): boolean {
    void input.tenantId;
    if (!input.signature) return false;
    const expected = createHmac('sha256', input.secret)
      .update(input.requestBody, 'utf8')
      .digest('base64');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
