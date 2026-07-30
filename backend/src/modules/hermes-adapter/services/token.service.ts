/**
 * HermesTokenService — mints short-lived HMAC-scoped tokens for the sidecar.
 *
 * Plan ref: NC-AWL-IMP-2 §1.2 (scoped token claims), §1.3 (gateway-side mint)
 *
 * The HMAC secret is the OAuth-style handshake between the gateway and the
 * sidecar. The gateway mints; the sidecar verifies. The sidecar NEVER has
 * direct access to NeureCore's database. The token is the only source of
 * truth for tenantId, executionId, allowedTools, and approval threshold.
 *
 * The mint is a pure function — given the caller (NeureCore controller /
 * service), the desired execution parameters, and the configured secret,
 * it produces a string the sidecar can verify locally.
 *
 * **Security invariants:**
 *   1. The secret is read from env (`HERMES_SIDECAR_SECRET`) ONLY. It is
 *      never read from the database, never logged, never returned to the
 *      caller.
 *   2. The token is single-use scoped: it carries the `executionId` and
 *      the sidecar enforces that the URL's `executionId` matches the claim.
 *   3. Token TTL is `HERMES_SIDECAR_TOKEN_TTL_SECONDS` (default 900 = 15min).
 *   4. If the secret is missing in non-production environments, minting
 *      raises. In production, the secret is required at startup.
 *
 * **NOT a JWT.** We don't need a JWT library. The sidecar is an internal
 * service; HMAC + base64url is sufficient and avoids pulling in a JWT
 * dependency for a single use case.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface HermesScopedTokenClaims {
  sub: string;
  tenantId: string;
  executionId: string;
  workspacePath: string;
  allowedTools: string[];
  approvalThreshold: 'NONE' | 'STANDARD' | 'HIGH';
  exp: number;
  scope: 'hermes:execute';
}

export class HermesTokenError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HermesTokenError';
  }
}

@Injectable()
export class HermesTokenService {
  private readonly logger = new Logger(HermesTokenService.name);
  private readonly secret: string;
  private readonly defaultTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('HERMES_SIDECAR_SECRET');
    if (!secret) {
      throw new HermesTokenError(
        'secret_missing',
        'HERMES_SIDECAR_SECRET is not configured. Set it in .env before starting the gateway.',
      );
    }
    this.secret = secret;

    const ttlEnv = this.config.get<string>('HERMES_SIDECAR_TOKEN_TTL_SECONDS');
    const ttl = ttlEnv ? parseInt(ttlEnv, 10) : 900;
    if (Number.isNaN(ttl) || ttl <= 0 || ttl > 3600) {
      throw new HermesTokenError(
        'invalid_ttl',
        `HERMES_SIDECAR_TOKEN_TTL_SECONDS must be 1..3600, got ${ttlEnv}`,
      );
    }
    this.defaultTtlSeconds = ttl;
  }

  /**
   * Mint a scoped token. Caller is the auth layer (chat controller /
   * agent-executor / future SIM-04 entrypoint). The returned token is
   * sent as `Authorization: Bearer <token>` to the sidecar.
   */
  mint(claims: Omit<HermesScopedTokenClaims, 'exp' | 'scope'>): string {
    const fullClaims: HermesScopedTokenClaims = {
      ...claims,
      exp: Math.floor(Date.now() / 1000) + this.defaultTtlSeconds,
      scope: 'hermes:execute',
    };
    const payloadB64 = base64urlEncode(
      JSON.stringify(fullClaims),
    );
    const sig = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest();
    const sigB64 = base64urlEncode(sig);
    return `${payloadB64}.${sigB64}`;
  }

  /**
   * Verify a token. Primarily used in tests; the sidecar is the canonical
   * verifier. Returns the claims if valid, raises HermesTokenError otherwise.
   */
  verify(token: string): HermesScopedTokenClaims {
    if (!token || !token.includes('.')) {
      throw new HermesTokenError('malformed_token', 'Token must be payload.signature');
    }
    const [payloadB64, sigB64] = token.split('.', 2);
    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest();
    let actualSig: Buffer;
    try {
      actualSig = base64urlDecode(sigB64);
    } catch (e) {
      throw new HermesTokenError(
        'malformed_signature',
        `Signature decode failed: ${(e as Error).message}`,
      );
    }
    if (
      expectedSig.length !== actualSig.length ||
      !crypto.timingSafeEqual(expectedSig, actualSig)
    ) {
      throw new HermesTokenError('bad_signature', 'Signature does not match');
    }
    let claims: HermesScopedTokenClaims;
    try {
      claims = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
    } catch (e) {
      throw new HermesTokenError(
        'malformed_payload',
        `Payload decode failed: ${(e as Error).message}`,
      );
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      throw new HermesTokenError('expired_token', `Token expired at ${claims.exp}`);
    }
    if (claims.scope !== 'hermes:execute') {
      throw new HermesTokenError(
        'wrong_scope',
        `Token scope is ${claims.scope}, expected 'hermes:execute'`,
      );
    }
    return claims;
  }

  /**
   * For tests: mint a token without going through the env-validated
   * constructor. Allows the test to bypass the secret check so it can
   * use a known secret pair.
   */
  static mintForTest(
    secret: string,
    claims: Omit<HermesScopedTokenClaims, 'exp' | 'scope'>,
    ttlSeconds = 900,
  ): string {
    const fullClaims: HermesScopedTokenClaims = {
      ...claims,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      scope: 'hermes:execute',
    };
    const payloadB64 = base64urlEncode(JSON.stringify(fullClaims));
    const sig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest();
    const sigB64 = base64urlEncode(sig);
    return `${payloadB64}.${sigB64}`;
  }
}

// ─── base64url helpers ───────────────────────────────────────


function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, '+').replace(/_/g, '/') + pad,
    'base64',
  );
}
