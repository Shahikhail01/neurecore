/**
 * GoogleWorkspaceProvider
 * Implements IProvisioningProvider for Google Workspace Admin SDK.
 *
 * Required Google OAuth 2.0 scopes (Domain-Wide Delegation):
 *   https://www.googleapis.com/auth/admin.directory.user
 *   https://www.googleapis.com/auth/drive
 *
 * TODO: fill in actual API calls once OAuth credentials are configured in env.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IProvisioningProvider,
  OAuthTokens,
  ProvisionedResources,
} from '../interfaces/provisioning-provider.interface';

@Injectable()
export class GoogleWorkspaceProvider implements IProvisioningProvider {
  readonly providerId = 'GOOGLE_WORKSPACE';

  private readonly logger = new Logger(GoogleWorkspaceProvider.name);

  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
  }

  generateAuthUrl(tenantId: string, redirectUri: string): string {
    // TODO: replace with actual google-auth-library OAuth2 URL once
    // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars are configured.
    const scopes = [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/drive',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: tenantId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    // TODO: call https://oauth2.googleapis.com/token with the auth code once
    // credentials are configured. Stub returns a placeholder response.
    this.logger.log(`[STUB] Exchanging Google auth code for tokens`);
    void code;
    void redirectUri;

    return {
      accessToken: 'google_stub_access_token',
      refreshToken: 'google_stub_refresh_token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async provisionUser(
    tokens: OAuthTokens,
    user: {
      firstName: string;
      lastName: string;
      emailDomain: string;
      emailPattern: string;
      folderStructure: string;
      departmentName?: string;
    },
  ): Promise<ProvisionedResources> {
    const corporateEmail = this.buildEmail(
      user.firstName,
      user.lastName,
      user.emailDomain,
      user.emailPattern,
    );

    // TODO: POST https://admin.googleapis.com/admin/directory/v1/users
    // with Authorization: Bearer tokens.accessToken
    // Body: { primaryEmail, name: { givenName, familyName }, password }
    this.logger.log(
      `[STUB] Would provision Google Workspace user: ${corporateEmail}`,
    );
    void tokens;

    // TODO: POST https://www.googleapis.com/drive/v3/files to create folder
    // under the shared drive or My Drive root, optionally under a dept sub-folder.
    const folderId = `stub_gdrive_folder_${Date.now()}`;

    this.logger.log(
      `[STUB] Would create Drive folder for: ${corporateEmail}, folderId: ${folderId}`,
    );

    return { corporateEmail, folderId };
  }

  private buildEmail(
    firstName: string,
    lastName: string,
    domain: string,
    pattern: string,
  ): string {
    const f = firstName.toLowerCase().replace(/\s+/g, '');
    const l = lastName.toLowerCase().replace(/\s+/g, '');
    switch (pattern) {
      case 'FIRSTLAST':
        return `${f}${l}@${domain}`;
      case 'F_DOT_LAST':
        return `${f.charAt(0)}.${l}@${domain}`;
      case 'FIRST_DOT_LAST':
      default:
        return `${f}.${l}@${domain}`;
    }
  }
}
