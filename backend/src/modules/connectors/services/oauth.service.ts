import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaOAuthTokenStore } from './oauth-token.service';
import { CryptoService } from './crypto.service';

/**
 * IPv4-safe HTTP POST using Node.js native https module.
 * Native fetch (undici) tries IPv6 first and times out on many machines.
 */
function httpsPost(
  url: string,
  body: URLSearchParams,
): Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}> {
  return new Promise((resolve, reject) => {
    const bodyStr = body.toString();
    const u = new URL(url);
    const options: https.RequestOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      family: 4, // force IPv4
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

export type OAuthProvider = 'hubspot' | 'salesforce' | 'pipedrive' | 'google';

export interface OAuthAuthorizeResult {
  url: string;
  provider: OAuthProvider;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenStore: PrismaOAuthTokenStore,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  buildState(payload: Record<string, unknown>): string {
    return this.crypto.encrypt(JSON.stringify(payload));
  }

  parseState(state: string): Record<string, unknown> {
    try {
      return JSON.parse(this.crypto.decrypt(state)) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  authorizeHubSpot(input: {
    tenantId: string;
    redirectUri: string;
    scopes: string[];
  }): OAuthAuthorizeResult {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    if (!clientId)
      throw new BadRequestException('HUBSPOT_CLIENT_ID is not set');

    const state = this.buildState({
      tenantId: input.tenantId,
      provider: 'hubspot',
    });
    const scope = encodeURIComponent(input.scopes.join(' '));
    const redirect = encodeURIComponent(input.redirectUri);

    const url = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${redirect}&scope=${scope}&state=${encodeURIComponent(state)}`;

    return { url, provider: 'hubspot' };
  }

  async callbackHubSpot(input: {
    code: string;
    redirectUri: string;
    state: string;
  }) {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException('HubSpot OAuth is not configured');
    }

    const parsed = this.parseState(input.state);
    const tenantIdRaw = parsed.tenantId;
    if (typeof tenantIdRaw !== 'string' || tenantIdRaw.length === 0) {
      throw new BadRequestException('Missing tenantId in OAuth state');
    }
    const tenantId = tenantIdRaw;

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('redirect_uri', input.redirectUri);
    body.set('code', input.code);

    const resp = await httpsPost('https://api.hubapi.com/oauth/v1/token', body);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      this.logger.warn(`HubSpot token exchange failed: ${resp.status} ${text}`);
      throw new BadRequestException('HubSpot token exchange failed');
    }

    const token = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined;

    await this.tokenStore.save(tenantId, 'hubspot', {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scopes: token.scope ? token.scope.split(' ') : [],
      metadata: { obtainedAt: new Date().toISOString() },
    });

    // Ensure a connector record exists
    const crmConnector = (this.prisma as any).crmConnector;
    const existing = await crmConnector.findFirst({
      where: { tenantId, provider: 'hubspot' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await crmConnector.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    } else {
      await crmConnector.create({
        data: {
          tenantId,
          provider: 'hubspot',
          name: 'HubSpot',
          config: {},
          isActive: true,
        },
      });
    }

    return { ok: true, tenantId, provider: 'hubspot', expiresAt };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Google OAuth - Per-Tenant Authorization
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate Google OAuth authorization URL for a tenant
   * Each tenant gets their own OAuth flow - ensuring complete data isolation
   */
  authorizeGoogle(input: {
    tenantId: string;
    redirectUri: string;
  }): OAuthAuthorizeResult {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured');
    }

    // Required scopes for Google Workspace operations
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    const state = this.buildState({
      tenantId: input.tenantId,
      provider: 'google',
    });

    const scope = encodeURIComponent(scopes.join(' '));
    const redirect = encodeURIComponent(input.redirectUri);

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    return { url, provider: 'google' };
  }

  /**
   * Handle Google OAuth callback - exchange code for tokens
   * Tokens are stored per-tenant, ensuring data isolation
   */
  async callbackGoogle(input: {
    code: string;
    redirectUri: string;
    state: string;
  }) {
    const clientId =
      (this.config.get('GOOGLE_CLIENT_ID') as string) ||
      process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
      (this.config.get('GOOGLE_CLIENT_SECRET') as string) ||
      process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const parsed = this.parseState(input.state);
    const tenantIdRaw = parsed.tenantId;
    if (typeof tenantIdRaw !== 'string' || tenantIdRaw.length === 0) {
      throw new BadRequestException('Missing tenantId in OAuth state');
    }
    const tenantId = tenantIdRaw;

    // Exchange authorization code for tokens
    const body = new URLSearchParams();
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('redirect_uri', input.redirectUri);
    body.set('grant_type', 'authorization_code');
    body.set('code', input.code);

    const resp = await httpsPost('https://oauth2.googleapis.com/token', body);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      this.logger.warn(`Google token exchange failed: ${resp.status} ${text}`);
      throw new BadRequestException('Google token exchange failed');
    }

    const token = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    // Store tokens for this tenant (per-tenant isolation)
    await this.tokenStore.save(tenantId, 'google', {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scopes: token.scope
        ? token.scope.split(' ')
        : scopesFromGoogle(token.scope || ''),
      metadata: {
        obtainedAt: new Date().toISOString(),
        connectedAt: new Date().toISOString(),
      },
    });

    // Create or update connector record
    const connector = (this.prisma as any).crmConnector;
    const existing = await connector.findFirst({
      where: { tenantId, provider: 'google' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await connector.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          config: JSON.stringify({
            connected: true,
            connectedAt: new Date().toISOString(),
          }),
        },
      });
    } else {
      await connector.create({
        data: {
          tenantId,
          provider: 'google',
          name: 'Google Workspace',
          config: JSON.stringify({
            connected: true,
            connectedAt: new Date().toISOString(),
          }),
          isActive: true,
        },
      });
    }

    this.logger.log(`Google OAuth connected for tenant ${tenantId}`);

    return {
      ok: true,
      tenantId,
      provider: 'google',
      expiresAt,
      message:
        'Google Workspace connected successfully! Each tenant now has their own isolated Google connection.',
    };
  }

  /**
   * Refresh Google OAuth token
   */
  async refreshGoogleToken(tenantId: string): Promise<boolean> {
    const tokens = await this.tokenStore.get(tenantId, 'google');
    if (!tokens?.refreshToken) {
      return false;
    }

    const clientId =
      (this.config.get('GOOGLE_CLIENT_ID') as string) ||
      process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
      (this.config.get('GOOGLE_CLIENT_SECRET') as string) ||
      process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return false;
    }

    const body = new URLSearchParams();
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', tokens.refreshToken);

    const resp = await httpsPost('https://oauth2.googleapis.com/token', body);

    if (!resp.ok) {
      this.logger.warn(`Google token refresh failed for tenant ${tenantId}`);
      return false;
    }

    const token = (await resp.json()) as {
      access_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    await this.tokenStore.save(tenantId, 'google', {
      accessToken: token.access_token,
      refreshToken: tokens.refreshToken, // Refresh token doesn't change
      expiresAt,
      scopes: tokens.scopes,
      metadata: tokens.metadata,
    });

    return true;
  }

  /**
   * Check if a tenant has Google OAuth connected
   */
  async isGoogleConnected(tenantId: string): Promise<boolean> {
    const tokens = await this.tokenStore.get(tenantId, 'google');
    return !!tokens?.accessToken;
  }

  /**
   * Get a valid (non-expired) Google access token for the tenant,
   * auto-refreshing if necessary.
   */
  async getValidGoogleToken(tenantId: string): Promise<string | null> {
    const expired = await this.tokenStore.isExpired(tenantId, 'google');
    if (expired) {
      const refreshed = await this.refreshGoogleToken(tenantId);
      if (!refreshed) return null;
    }
    const tokens = await this.tokenStore.get(tenantId, 'google');
    return tokens?.accessToken ?? null;
  }
}

// Helper to parse Google scope string
function scopesFromGoogle(scopeString: string): string[] {
  return scopeString
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
}
