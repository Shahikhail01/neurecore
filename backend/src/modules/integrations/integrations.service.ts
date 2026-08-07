import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  PrismaIntegrationCredentialStore,
  GoogleCredentials,
  BrevoCredentials,
  ZoomOAuthCredentials,
  TwilioBasicCredentials,
} from './services/integration-credential.store';
import { GoogleAuthClient } from './google/google-auth.client';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
];

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authClient: GoogleAuthClient,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async initiateGoogleOAuth(
    tenantId: string,
    redirectUri?: string,
    audience: 'tenant' | 'admin' = 'tenant',
    origin: 'settings' | 'onboarding' = 'settings',
  ): Promise<{ url: string; state: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured on this server',
      );
    }

    const finalRedirectUri =
      redirectUri ??
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      `${process.env.FRONTEND_BASE_URL ?? 'https://hq.neurecore.com'}/settings/integrations/callback/google`;

    const state = Buffer.from(
      JSON.stringify({
        tenantId,
        provider: 'google',
        redirectUri: finalRedirectUri,
        audience,
        origin,
      }),
    ).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: finalRedirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      state,
      prompt: 'consent',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{ connected: boolean; email?: string }> {
    let parsed: { tenantId: string; provider: string; redirectUri: string };
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (parsed.provider !== 'google') {
      throw new BadRequestException('OAuth state provider mismatch');
    }

    const { tenantId, redirectUri } = parsed;

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => 'unknown');
      this.logger.warn(
        `Google token exchange failed: ${tokenRes.status} ${err}`,
      );
      throw new BadRequestException('Google token exchange failed');
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const credentials: GoogleCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope.split(' ').filter(Boolean),
    };

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.GOOGLE,
      credentials,
      'Google Workspace',
    );

    let email: string | undefined;
    try {
      const userInfoRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      if (userInfoRes.ok) {
        const userInfo = (await userInfoRes.json()) as { email?: string };
        email = userInfo.email;
      }
    } catch {
      // Non-fatal — email lookup failed
    }

    // Persist the resolved email on the Tenant so the Manage page can
    // surface "Connected as xxx@gmail.com" without re-fetching userinfo
    // (the Google OAuth scopes we request don't include `openid`, so
    // /oauth2/v2/userinfo only returns email for the freshly-issued token).
    if (email) {
      await this.prisma.tenant
        .update({
          where: { id: tenantId },
          data: { googleAccountEmail: email },
        })
        .catch(() => undefined);
    }

    this.logger.log(`Google OAuth connected for tenant ${tenantId}`);
    return { connected: true, email };
  }

  async disconnectGoogle(tenantId: string): Promise<void> {
    await this.credentialStore.delete(tenantId, IntegrationProvider.GOOGLE);
    // Clear cached Google identifiers on tenant
    await this.prisma.tenant
      .update({
        where: { id: tenantId },
        data: {
          googleDriveRootFolderId: null,
          googleCalendarId: null,
          googleAccountEmail: null,
        },
      })
      .catch(() => {
        // Tenant update is best-effort cleanup
      });
    this.logger.log(`Google OAuth disconnected for tenant ${tenantId}`);
  }

  /**
   * G7 — Admin-initiated revoke of a tenant's Google connection.
   *
   * Throws NotFoundException when the tenant has no Google connection so
   * admins get clear feedback. Safe to call regardless of whether
   * `googleCalendarId` was set on the tenant record.
   *
   * Audit logging is the responsibility of the caller (controller). It
   * writes resource='integration_credential' / action='google.admin_revoke'
   * so the super admin audit log at /settings/audit picks it up.
   */
  async adminDisconnectGoogle(tenantId: string): Promise<{
    tenantId: string;
    revoked: true;
    hadCalendar: boolean;
  }> {
    const exists = await this.credentialStore.exists(
      tenantId,
      IntegrationProvider.GOOGLE,
    );
    if (!exists) {
      throw new NotFoundException(
        `No Google connection for tenant ${tenantId}`,
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { googleCalendarId: true, name: true },
    });

    await this.disconnectGoogle(tenantId);

    return {
      tenantId,
      revoked: true,
      hadCalendar: !!tenant?.googleCalendarId,
    };
  }

  async getGoogleConnectionStatus(tenantId: string): Promise<{
    connected: boolean;
    email?: string;
    scopes?: string[];
    expiresAt?: Date;
  }> {
    const creds = await this.credentialStore.get(
      tenantId,
      IntegrationProvider.GOOGLE,
    );
    if (!creds) return { connected: false };

    const googleCreds = creds as GoogleCredentials;
    const status: {
      connected: boolean;
      scopes?: string[];
      expiresAt?: Date;
      email?: string;
    } = {
      connected: true,
      scopes: googleCreds.scopes,
      expiresAt: googleCreds.expiryDate
        ? new Date(googleCreds.expiryDate)
        : undefined,
    };

    // 1) Prefer the persisted email (saved at OAuth time) so we don't
    //    depend on userinfo scope after refresh.
    const tenant = await this.prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: { googleAccountEmail: true },
      })
      .catch(() => null);
    if (tenant?.googleAccountEmail) {
      status.email = tenant.googleAccountEmail;
      return status;
    }

    // 2) Fallback: best-effort userinfo (requires `openid` in granted scopes)
    try {
      const accessToken = await this.authClient.getAccessToken(tenantId);
      if (accessToken) {
        const res = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (res.ok) {
          const data = (await res.json()) as { email?: string };
          if (data.email) {
            status.email = data.email;
            // Persist for next time
            await this.prisma.tenant
              .update({
                where: { id: tenantId },
                data: { googleAccountEmail: data.email },
              })
              .catch(() => undefined);
          }
        }
      }
    } catch {
      // Email lookup is best-effort; don't fail the status call
    }

    return status;
  }

  async connectBrevo(
    tenantId: string,
    apiKey: string,
  ): Promise<{ connected: boolean }> {
    const validateRes = await fetch('https://api.brevo.com/v3/account', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!validateRes.ok) {
      throw new BadRequestException('Invalid Brevo API key');
    }

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.BREVO,
      { apiKey },
      'Brevo Email Relay',
    );

    this.logger.log(`Brevo connected for tenant ${tenantId}`);
    return { connected: true };
  }

  async disconnectBrevo(tenantId: string): Promise<void> {
    await this.credentialStore.delete(tenantId, IntegrationProvider.BREVO);
    this.logger.log(`Brevo disconnected for tenant ${tenantId}`);
  }

  async getBrevoConnectionStatus(
    tenantId: string,
  ): Promise<{ connected: boolean; source?: 'tenant' | 'master' }> {
    const tenantHas = await this.credentialStore.exists(
      tenantId,
      IntegrationProvider.BREVO,
    );
    if (tenantHas) return { connected: true, source: 'tenant' };
    const masterKey = this.config.get<string>('BREVO_MASTER_API_KEY');
    if (masterKey && masterKey.length > 0) {
      return { connected: true, source: 'master' };
    }
    return { connected: false };
  }

  async listIntegrations(tenantId: string): Promise<Record<string, unknown>> {
    const [google, brevo] = await Promise.all([
      this.getGoogleConnectionStatus(tenantId),
      this.getBrevoConnectionStatus(tenantId),
    ]);

    return {
      google: {
        provider: 'google',
        label: 'Google Workspace',
        description: 'Gmail, Drive, Calendar, Sheets',
        ...google,
      },
      brevo: {
        provider: 'brevo',
        label: 'Brevo (Email Relay)',
        description: 'Agent email aliases (300 emails/day free)',
        ...brevo,
      },
    };
  }

  async getDecryptedCredentials(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<GoogleCredentials | BrevoCredentials | ZoomOAuthCredentials | TwilioBasicCredentials | null> {
    return this.credentialStore.get(tenantId, provider);
  }
}
