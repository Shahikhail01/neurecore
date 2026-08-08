/**
 * Salesforce REST client — typed wrapper around Salesforce REST API.
 *
 * Phase 27 (P27) — Live connectors (CR-AI-1106).
 *
 * Responsibilities (SRP):
 *  - exchange OAuth2 authorization code for Salesforce tokens,
 *  - refresh an expired access token,
 *  - query Salesforce Contacts / Leads via SOQL,
 *  - verify a Salesforce webhook signature (HMAC-SHA256 over body).
 *
 * DIP — depends on `IHTTPClient` (no direct `fetch`).
 * OCP — new SOQL queries = new methods on this class only.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { IHTTPClient } from './http-client';
import type { IOAuthTokenStore } from '../../interfaces/IOAuthTokenStore';

export const SALESFORCE_PROVIDER = 'salesforce';

export interface SalesforceTokens {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface SalesforceContactRow extends Record<string, unknown> {
  Id: string;
  Email?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  AccountId?: string | null;
}

export interface SalesforceLeadRow extends Record<string, unknown> {
  Id: string;
  Email?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Company?: string | null;
  Status?: string | null;
}

export interface SalesforceContactSummary {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  accountId?: string;
}

export interface SalesforceLeadSummary {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  status?: string;
}

export interface ISalesforceClient {
  exchangeCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
  }): Promise<SalesforceTokens>;
  refreshTokenIfNeeded(tenantId: string): Promise<string | null>;
  queryContacts(
    tenantId: string,
    limit: number,
  ): Promise<SalesforceContactSummary[]>;
  queryLeads(tenantId: string, limit: number): Promise<SalesforceLeadSummary[]>;
  verifyWebhookSignature(input: {
    tenantId: string;
    signature: string;
    requestBody: string;
    secret: string;
  }): boolean;
}

@Injectable()
export class SalesforceClient implements ISalesforceClient {
  private readonly logger = new Logger(SalesforceClient.name);

  constructor(
    private readonly http: IHTTPClient,
    private readonly tokenStore: IOAuthTokenStore,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly loginUrl: string = 'https://login.salesforce.com',
  ) {}

  async exchangeCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
  }): Promise<SalesforceTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    const res = await this.http.request({
      url: `${this.loginUrl}/services/oauth2/token`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(
        `Salesforce token exchange failed: ${res.status} ${res.body}`,
      );
      throw new BadRequestException(
        `Salesforce token exchange failed: ${res.status}`,
      );
    }
    const tokens = JSON.parse(res.body) as {
      access_token: string;
      refresh_token?: string;
      instance_url: string;
      scope?: string;
      issued_at?: string;
    };
    const stored: SalesforceTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      instanceUrl: tokens.instance_url,
      scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
    };
    await this.tokenStore.save(input.tenantId, SALESFORCE_PROVIDER, {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      scopes: stored.scopes,
      metadata: { instanceUrl: stored.instanceUrl },
    });
    return stored;
  }

  async refreshTokenIfNeeded(tenantId: string): Promise<string | null> {
    const existing = await this.tokenStore.get(tenantId, SALESFORCE_PROVIDER);
    if (!existing) return null;
    // Salesforce access tokens are typically session-bounded; refresh
    // when we have a refresh token AND the access token is missing.
    if (
      existing.accessToken &&
      (!existing.expiresAt ||
        existing.expiresAt.getTime() > Date.now() + 60_000)
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
      url: `${this.loginUrl}/services/oauth2/token`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(`Salesforce refresh failed: ${res.status}`);
      return null;
    }
    const tokens = JSON.parse(res.body) as {
      access_token: string;
      refresh_token?: string;
      instance_url?: string;
    };
    const instanceUrl =
      tokens.instance_url ??
      (existing.metadata?.['instanceUrl'] as string | undefined) ??
      this.loginUrl;
    await this.tokenStore.save(tenantId, SALESFORCE_PROVIDER, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing.refreshToken,
      scopes: existing.scopes,
      metadata: { instanceUrl },
    });
    return tokens.access_token;
  }

  async queryContacts(
    tenantId: string,
    limit: number,
  ): Promise<SalesforceContactSummary[]> {
    const accessToken = await this.refreshTokenIfNeeded(tenantId);
    if (!accessToken) return [];
    const instanceUrl = await this.getInstanceUrl(tenantId);
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    const soql = `SELECT Id, Email, FirstName, LastName, AccountId FROM Contact LIMIT ${cappedLimit}`;
    return this.query<SalesforceContactRow, SalesforceContactSummary>(
      instanceUrl,
      accessToken,
      soql,
      (r) => ({
        id: r.Id,
        email: r.Email ?? undefined,
        firstName: r.FirstName ?? undefined,
        lastName: r.LastName ?? undefined,
        accountId: r.AccountId ?? undefined,
      }),
    );
  }

  async queryLeads(
    tenantId: string,
    limit: number,
  ): Promise<SalesforceLeadSummary[]> {
    const accessToken = await this.refreshTokenIfNeeded(tenantId);
    if (!accessToken) return [];
    const instanceUrl = await this.getInstanceUrl(tenantId);
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    const soql = `SELECT Id, Email, FirstName, LastName, Company, Status FROM Lead LIMIT ${cappedLimit}`;
    return this.query<SalesforceLeadRow, SalesforceLeadSummary>(
      instanceUrl,
      accessToken,
      soql,
      (r) => ({
        id: r.Id,
        email: r.Email ?? undefined,
        firstName: r.FirstName ?? undefined,
        lastName: r.LastName ?? undefined,
        company: r.Company ?? undefined,
        status: r.Status ?? undefined,
      }),
    );
  }

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
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private async query<TIn extends Record<string, unknown>, TOut>(
    instanceUrl: string,
    accessToken: string,
    soql: string,
    mapRow: (r: TIn) => TOut,
  ): Promise<TOut[]> {
    const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
    const res = await this.http.request({
      url,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status < 200 || res.status >= 300) {
      this.logger.warn(`Salesforce query failed: ${res.status}`);
      return [];
    }
    const parsed = JSON.parse(res.body) as { records?: TIn[] };
    return (parsed.records ?? []).map((r) => mapRow(r));
  }

  private async getInstanceUrl(tenantId: string): Promise<string> {
    const stored = await this.tokenStore.get(tenantId, SALESFORCE_PROVIDER);
    const url = stored?.metadata?.['instanceUrl'] as string | undefined;
    return url ?? this.loginUrl;
  }
}
