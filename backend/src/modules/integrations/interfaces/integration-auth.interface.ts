/**
 * Integration Authentication Interface — R4.
 *
 * Splits the auth contract into:
 *   - IIntegrationAuthProvider (mandatory for every provider)
 *   - IIntegrationTokenRefresher (optional — only OAuth providers)
 *
 * Twilio uses Basic auth (Account SID + Auth Token) and does NOT
 * implement IIntegrationTokenRefresher. Microsoft, Google, Zoom
 * implement both.
 *
 * Per SOLID/ISP, consumers (channel adapters, controllers) should
 * depend on the narrowest interface their flow needs.
 */

import { IntegrationProvider } from '@prisma/client';

/** Opaque credential shape — concrete type lives in the auth client. */
export type CredentialEnvelope = unknown;

/** Reasons an auth operation can fail — typed for callers. */
export type AuthFailureReason =
  | 'NOT_CONNECTED'
  | 'EXPIRED_TOKEN'
  | 'INVALID_REFRESH'
  | 'INVALID_STATE'
  | 'PROVIDER_ERROR'
  | 'TENANT_CONTEXT_REQUIRED';

export class IntegrationAuthError extends Error {
  constructor(
    message: string,
    readonly reason: AuthFailureReason,
    readonly provider: IntegrationProvider,
    readonly retriable: boolean = false,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IntegrationAuthError';
  }
}

export interface IIntegrationAuthProvider<C = CredentialEnvelope> {
  readonly provider: IntegrationProvider;

  /** Build the auth-code OAuth URL the tenant admin visits. */
  buildAuthorizationUrl(
    tenantId: string,
    redirectUri: string,
    state: string,
  ): string;

  /** Exchange the auth code for credentials. */
  exchangeAuthorizationCode(
    tenantId: string,
    code: string,
    redirectUri: string,
  ): Promise<C>;

  /** Read credentials — null when not connected. */
  getCredentials(tenantId: string): Promise<C | null>;

  /** Revoke credentials + remove from store. */
  revoke(tenantId: string): Promise<void>;
}

/**
 * OAuth tokens expire. Adapters should call `refreshIfExpiring` before
 * dispatching outbound messages. The optional `skewSeconds` controls
 * how early a refresh triggers (default 60s).
 *
 * Providers using Basic auth (Twilio) do not implement this — the
 * auth client for those providers returns null or throws a typed
 * error if a refresh is requested.
 */
export interface IIntegrationTokenRefresher<C = CredentialEnvelope> {
  refreshIfExpiring(tenantId: string, skewSeconds?: number): Promise<C>;
}

/** Status payload for the tenant integration card. */
export interface IntegrationStatus {
  readonly provider: IntegrationProvider;
  readonly connected: boolean;
  readonly source: 'master' | 'tenant' | null;
  readonly accountEmail?: string | null;
  readonly expiresAt?: string | null;
}
