/**
 * AccountingTokenService — mints HMAC-scoped tokens for the accounting sidecar.
 *
 * Plan ref: NC-ACCT-IMP-1 §1a (shared auth), §5 (NestJS module).
 *
 * This is the accounting-flavored sibling of `HermesTokenService`. The wire
 * format is identical (`<base64url-json>.<base64url-hmac>`); the only
 * difference is the `scope` claim value (`accounting:execute` vs
 * `hermes:execute`).
 *
 * The actual sign/verify primitives live in
 * `neurecore/infra/_common/scope_token.ts` — this service is just the
 * NestJS-flavoured factory that loads the secret from env, picks the
 * scope, and forwards the call.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as scopeToken from '../../../common/auth/_common/scope_token';

export type AccountingApprovalThreshold = 'NONE' | 'STANDARD' | 'HIGH';

export interface AccountingScopedTokenClaims {
  sub: string;
  tenantId: string;
  executionId: string;
  workspacePath: string;
  allowedTools: string[];
  approvalThreshold: AccountingApprovalThreshold;
  exp: number;
  scope: 'accounting:execute';
}

export const ACCOUNTING_TOKEN_SCOPE = 'accounting:execute' as const;

export class AccountingTokenError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AccountingTokenError';
  }
}

@Injectable()
export class AccountingTokenService {
  private readonly logger = new Logger(AccountingTokenService.name);
  private secret: string | null = null;
  private defaultTtlSeconds = 900;

  constructor(private readonly config: ConfigService) {
    // Lazy: do NOT throw at construction. Validate on first use.
    // This lets the backend boot even when ACCOUNTING_SIDECAR_SECRET is
    // missing (e.g. in dev/test environments where the sidecar is off).
    // The first call to mint() / verify() will throw AccountingTokenError.
    this.reloadConfig();
  }

  /**
   * Re-read config (used by tests, or after a config hot-reload).
   */
  reloadConfig(): void {
    const secret = this.config.get<string>('ACCOUNTING_SIDECAR_SECRET');
    if (secret) {
      this.secret = secret;
    }
    const ttlEnv = this.config.get<string>('ACCOUNTING_SIDECAR_TOKEN_TTL_SECONDS');
    if (ttlEnv) {
      const ttl = parseInt(ttlEnv, 10);
      if (Number.isFinite(ttl) && ttl > 0 && ttl <= 3600) {
        this.defaultTtlSeconds = ttl;
      } else {
        this.logger.warn(
          `ACCOUNTING_SIDECAR_TOKEN_TTL_SECONDS invalid (${ttlEnv}); keeping default 900s`,
        );
      }
    }
  }

  /**
   * Throw if the secret is not configured. Called on first use.
   */
  private requireSecret(): string {
    if (!this.secret) {
      throw new AccountingTokenError(
        'secret_missing',
        'ACCOUNTING_SIDECAR_SECRET is not configured. Set it in .env before using the accounting capability.',
      );
    }
    return this.secret;
  }

  /**
   * Mint a scoped token. Returns `payload.signature` (base64url).
   * The caller passes the full claims except `exp` and `scope` — both
   * are set here so the wire format is unambiguous.
   */
  mint(
    claims: Omit<AccountingScopedTokenClaims, 'exp' | 'scope'>,
  ): string {
    const fullClaims = {
      ...claims,
      scope: ACCOUNTING_TOKEN_SCOPE,
      exp: Math.floor(Date.now() / 1000) + this.defaultTtlSeconds,
    };
    return scopeToken.sign(fullClaims as unknown as Record<string, unknown>, this.requireSecret());
  }

  /**
   * Verify a token. Primarily used in tests; the sidecar is the canonical
   * verifier. Returns the claims dict if valid, throws AccountingTokenError
   * otherwise.
   */
  verify(token: string): AccountingScopedTokenClaims {
    try {
      const claims = scopeToken.verify(token, this.requireSecret(), ACCOUNTING_TOKEN_SCOPE);
      return claims as unknown as AccountingScopedTokenClaims;
    } catch (e) {
      if (e instanceof scopeToken.ScopeTokenError) {
        throw new AccountingTokenError(e.code, e.message);
      }
      throw e;
    }
  }

  /**
   * For tests only: mint without env-validated secret.
   */
  static mintForTest(
    secret: string,
    claims: Omit<AccountingScopedTokenClaims, 'exp' | 'scope'>,
    ttlSeconds = 900,
  ): string {
    return scopeToken.mintForTest(
      secret,
      claims as unknown as Record<string, unknown>,
      ACCOUNTING_TOKEN_SCOPE,
      ttlSeconds,
    );
  }
}