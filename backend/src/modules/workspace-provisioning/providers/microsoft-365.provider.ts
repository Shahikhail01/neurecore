/**
 * Microsoft365Provider
 * Implements IProvisioningProvider for Microsoft Graph API.
 *
 * Required Microsoft Graph permissions (Application type):
 *   User.ReadWrite.All, Directory.ReadWrite.All, Files.ReadWrite.All
 *
 * TODO: fill in actual API calls once Azure App Registration credentials
 * are configured in env (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IProvisioningProvider,
  OAuthTokens,
  ProvisionedResources,
} from '../interfaces/provisioning-provider.interface';

@Injectable()
export class Microsoft365Provider implements IProvisioningProvider {
  readonly providerId = 'MICROSOFT_365';

  private readonly logger = new Logger(Microsoft365Provider.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly msTenantId: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('MICROSOFT_CLIENT_ID') ?? '';
    this.clientSecret =
      this.config.get<string>('MICROSOFT_CLIENT_SECRET') ?? '';
    this.msTenantId =
      this.config.get<string>('MICROSOFT_TENANT_ID') ?? 'common';
  }

  generateAuthUrl(tenantId: string, redirectUri: string): string {
    // TODO: replace with actual MSAL OAuth2 URL once credentials are configured.
    const scopes = [
      'https://graph.microsoft.com/User.ReadWrite.All',
      'https://graph.microsoft.com/Directory.ReadWrite.All',
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      response_mode: 'query',
      state: tenantId,
    });

    return `https://login.microsoftonline.com/${this.msTenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    // TODO: POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
    // once credentials are configured. Stub returns a placeholder response.
    this.logger.log(`[STUB] Exchanging Microsoft auth code for tokens`);
    void code;
    void redirectUri;

    return {
      accessToken: 'ms365_stub_access_token',
      refreshToken: 'ms365_stub_refresh_token',
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

    // TODO: POST https://graph.microsoft.com/v1.0/users
    // Body: { accountEnabled, displayName, mailNickname, userPrincipalName, passwordProfile }
    this.logger.log(
      `[STUB] Would provision Microsoft 365 user: ${corporateEmail}`,
    );
    void tokens;

    // TODO: POST https://graph.microsoft.com/v1.0/users/{id}/drive/root/children
    // to create a personal OneDrive folder or shared SharePoint folder.
    const folderId = `stub_onedrive_folder_${Date.now()}`;

    this.logger.log(
      `[STUB] Would create OneDrive folder for: ${corporateEmail}, folderId: ${folderId}`,
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
