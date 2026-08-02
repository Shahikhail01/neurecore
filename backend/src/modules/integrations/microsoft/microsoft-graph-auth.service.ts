import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { IntegrationProvider } from '@prisma/client';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';

/**
 * IAuthProvider — narrow port implemented by MicrosoftGraphAuthService.
 *
 * Channel adapters and integration consumers depend on this interface
 * (not on the concrete class) so Microsoft auth can be swapped for a
 * mock in tests and so additional providers can implement the same
 * contract later. Lives next to the implementation because no canonical
 * auth-provider abstraction exists yet; if one is created in
 * integrations/services this file can re-export it without breaking
 * callers.
 */
export interface IAuthProvider {
  /** Begin the authorization-code flow and return the URL the user should be sent to. */
  buildAuthorizationUrl(input: {
    tenantId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    prompt?: 'login' | 'consent' | 'select_account';
  }): string;

  /** Exchange an authorization code for tokens and persist them. */
  exchangeAuthorizationCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
    scopes: string[];
  }): Promise<MicrosoftCredentials>;

  /** Acquire an access token using the client_credentials flow (app-only). */
  acquireClientCredentialsToken(input: {
    tenantId: string;
    scopes: string[];
  }): Promise<MicrosoftCredentials>;

  /** Return a non-expired access token for the tenant, refreshing if needed. */
  getAccessToken(tenantId: string): Promise<string | null>;

  /** Return the full credentials record (decrypted) or null if not connected. */
  getCredentials(tenantId: string): Promise<MicrosoftCredentials | null>;

  /** Verify a Microsoft Graph change-notification clientState. */
  verifyClientState(tenantId: string, clientState: string): boolean;

  /** Validate a Graph webhook validationToken handshake. */
  validateWebhookHandshake(query: {
    validationToken?: string;
    tenantId: string;
  }): { ok: true; validationToken: string } | { ok: false; reason: string };
}

export interface MicrosoftCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scopes: string[];
  tokenType: 'Bearer';
  /** Account principal type — 'user' for delegated, 'application' for app-only. */
  principalType: 'user' | 'application';
  /** Upn / user object id when principalType === 'user'. */
  userPrincipalName?: string;
}

export const MICROSOFT_DEFAULT_SCOPES: ReadonlyArray<string> = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Chat.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'ChannelMessage.Send',
  'Files.ReadWrite',
];

const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class MicrosoftGraphAuthService implements IAuthProvider {
  private readonly logger = new Logger(MicrosoftGraphAuthService.name);
  private readonly tenantEndpoint =
    'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';
  private readonly authorizeEndpoint =
    'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly config: ConfigService,
  ) {}

  private get clientId(): string | undefined {
    return this.config.get<string>('MICROSOFT_CLIENT_ID');
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('MICROSOFT_CLIENT_SECRET');
  }

  private get tenantGuid(): string {
    return this.config.get<string>('MICROSOFT_TENANT_ID') ?? 'common';
  }

  private get webhookClientState(): string {
    return (
      this.config.get<string>('MICROSOFT_WEBHOOK_CLIENT_STATE') ??
      'neurecore-microsoft-default-state'
    );
  }

  private endpoint(template: string): string {
    return template.replace('{tenant}', this.tenantGuid);
  }

  buildAuthorizationUrl(input: {
    tenantId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    prompt?: 'login' | 'consent' | 'select_account';
  }): string {
    const clientId = this.clientId;
    if (!clientId) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID missing)',
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: input.redirectUri,
      response_mode: 'query',
      scope: input.scopes.join(' '),
      state: input.state,
      prompt: input.prompt ?? 'consent',
    });
    return `${this.endpoint(this.authorizeEndpoint)}?${params.toString()}`;
  }

  async exchangeAuthorizationCode(input: {
    tenantId: string;
    code: string;
    redirectUri: string;
    scopes: string[];
  }): Promise<MicrosoftCredentials> {
    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET missing)',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      scope: input.scopes.join(' '),
    });

    const res = await fetch(this.endpoint(this.tenantEndpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.warn(
        `Microsoft token exchange failed for tenant ${input.tenantId}: ${res.status} ${text}`,
      );
      throw new BadRequestException(
        `Microsoft token exchange failed: ${text.slice(0, 200)}`,
      );
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      id_token?: string;
      token_type?: string;
    };

    const credentials: MicrosoftCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: (tokens.scope ?? input.scopes.join(' '))
        .split(' ')
        .filter(Boolean),
      tokenType: 'Bearer',
      principalType: 'user',
      userPrincipalName: extractUpnFromIdToken(tokens.id_token),
    };

    await this.credentialStore.save(
      input.tenantId,
      IntegrationProvider.MICROSOFT,
      credentials as never,
      'Microsoft 365 / Outlook / Teams',
    );

    this.logger.log(
      `Microsoft OAuth connected for tenant ${input.tenantId} (UPN=${credentials.userPrincipalName ?? 'unknown'})`,
    );
    return credentials;
  }

  async acquireClientCredentialsToken(input: {
    tenantId: string;
    scopes: string[];
  }): Promise<MicrosoftCredentials> {
    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET missing)',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: input.scopes.join(' '),
    });

    const res = await fetch(this.endpoint(this.tenantEndpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.warn(
        `Microsoft client_credentials exchange failed for tenant ${input.tenantId}: ${res.status} ${text}`,
      );
      throw new BadRequestException(
        `Microsoft client_credentials failed: ${text.slice(0, 200)}`,
      );
    }

    const tokens = (await res.json()) as {
      access_token: string;
      expires_in: number;
      scope?: string;
      token_type?: string;
    };

    const credentials: MicrosoftCredentials = {
      accessToken: tokens.access_token,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: (tokens.scope ?? input.scopes.join(' '))
        .split(' ')
        .filter(Boolean),
      tokenType: 'Bearer',
      principalType: 'application',
    };

    await this.credentialStore.save(
      input.tenantId,
      IntegrationProvider.MICROSOFT,
      credentials as never,
      'Microsoft 365 (app-only)',
    );
    return credentials;
  }

  async getCredentials(tenantId: string): Promise<MicrosoftCredentials | null> {
    const raw = await this.credentialStore.get(
      tenantId,
      IntegrationProvider.MICROSOFT,
    );
    if (!raw) return null;
    return raw as unknown as MicrosoftCredentials;
  }

  async getAccessToken(tenantId: string): Promise<string | null> {
    const creds = await this.getCredentials(tenantId);
    if (!creds) return null;
    if (!creds.expiryDate || creds.expiryDate > Date.now() + REFRESH_SKEW_MS) {
      return creds.accessToken;
    }
    if (!creds.refreshToken) {
      this.logger.warn(
        `Microsoft token expired for tenant ${tenantId} and no refresh token available`,
      );
      return null;
    }
    const refreshed = await this.refreshAccessToken(tenantId, creds);
    return refreshed.accessToken;
  }

  private async refreshAccessToken(
    tenantId: string,
    creds: MicrosoftCredentials,
  ): Promise<MicrosoftCredentials> {
    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET missing)',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken ?? '',
      scope: creds.scopes.join(' '),
    });

    const res = await fetch(this.endpoint(this.tenantEndpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      this.logger.error(
        `Microsoft refresh failed for tenant ${tenantId}: ${res.status} ${text}`,
      );
      throw new BadRequestException(
        `Microsoft refresh failed: ${text.slice(0, 200)}`,
      );
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    const next: MicrosoftCredentials = {
      ...creds,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? creds.refreshToken,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: (tokens.scope ?? creds.scopes.join(' '))
        .split(' ')
        .filter(Boolean),
    };

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.MICROSOFT,
      next as never,
    );
    return next;
  }

  /**
   * Microsoft Graph change-notifications are signed with a `clientState`
   * opaque value the subscription creator chooses at subscription time.
   * We use a per-tenant HMAC over the tenantId so that a stolen
   * clientState from one tenant cannot replay notifications into
   * another.
   */
  verifyClientState(tenantId: string, clientState: string): boolean {
    if (!clientState || typeof clientState !== 'string') return false;
    const secret = this.webhookClientState;
    const expected = createHmac('sha256', secret)
      .update(tenantId, 'utf8')
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(clientState, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Graph webhook handshake: when a new subscription is created Graph
   * sends a POST with `validationToken` in the query string. The
   * endpoint must echo the token back with 200 OK within 10 seconds.
   * We additionally validate that the validationToken is well-formed
   * (ASCII, ≤ 500 chars) so an attacker cannot poison our cache with
   * arbitrary content.
   */
  validateWebhookHandshake(query: {
    validationToken?: string;
    tenantId: string;
  }): { ok: true; validationToken: string } | { ok: false; reason: string } {
    const token = query.validationToken;
    if (!token || token.length === 0) {
      return { ok: false, reason: 'missing validationToken' };
    }
    if (token.length > 500) {
      return { ok: false, reason: 'validationToken too long' };
    }
    if (!/^[A-Za-z0-9_\-=.]+$/.test(token)) {
      return { ok: false, reason: 'validationToken contains illegal chars' };
    }
    // Optionally ensure the tenant provided a credential before
    // accepting subscriptions; we still echo so the subscription is
    // created, but reject later notifications.
    void query.tenantId;
    return { ok: true, validationToken: token };
  }

  /**
   * Compute a deterministic per-tenant clientState to use when
   * subscribing for change notifications. Stored only as the HMAC
   * output above; never persisted in plaintext alongside the
   * credentials so it cannot be exfiltrated together with the access
   * token.
   */
  computeClientState(tenantId: string): string {
    return createHmac('sha256', this.webhookClientState)
      .update(tenantId, 'utf8')
      .digest('hex');
  }

  /** Internal — exposed for tests / diagnostics. */
  get graphApiBase(): string {
    return this.graphBase;
  }
}

/** Best-effort UPN extraction from a JWT id_token payload (no signature check). */
function extractUpnFromIdToken(
  idToken: string | undefined,
): string | undefined {
  if (!idToken) return undefined;
  const parts = idToken.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { upn?: string; preferred_username?: string; email?: string };
    return payload.upn ?? payload.preferred_username ?? payload.email;
  } catch {
    return undefined;
  }
}

/** Helper exposed for tests / certificate-pinning diagnostics. */
export function tenantHash(tenantId: string): string {
  return createHash('sha256').update(tenantId, 'utf8').digest('hex');
}
