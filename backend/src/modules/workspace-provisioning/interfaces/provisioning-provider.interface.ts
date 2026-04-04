/**
 * IProvisioningProvider — Interface Segregation + Dependency Inversion.
 * Any cloud workspace provider (Google, Microsoft, future) implements this.
 * The orchestrator depends only on this abstraction, never on concrete classes.
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ProvisionedResources {
  corporateEmail: string;
  folderId: string;
}

export interface IProvisioningProvider {
  /** Unique identifier for this provider, matches ProvisioningProvider enum value */
  readonly providerId: string;

  /**
   * Build the OAuth authorisation URL the admin must visit to grant access.
   * @param tenantId - used to build the state parameter for CSRF protection
   * @param redirectUri - the callback URL registered with the OAuth app
   */
  generateAuthUrl(tenantId: string, redirectUri: string): string;

  /**
   * Exchange an OAuth authorisation code for access + refresh tokens.
   */
  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens>;

  /**
   * Provision a corporate email address and cloud storage folder for one invitee.
   * Returns the provisioned resources or throws on failure.
   */
  provisionUser(
    tokens: OAuthTokens,
    user: {
      firstName: string;
      lastName: string;
      emailDomain: string;
      emailPattern: string;
      folderStructure: string;
      departmentName?: string;
    },
  ): Promise<ProvisionedResources>;
}
