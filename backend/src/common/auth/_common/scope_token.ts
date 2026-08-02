/**
 * Shared HMAC-scoped token library — TypeScript port.
 *
 * Plan ref: NC-ACCT-IMP-1 Phase 0; replaces duplicate HMAC code in:
 *   - backend/src/modules/hermes-adapter/services/token.service.ts
 *   - (future) backend/src/modules/accounting/services/accounting-token.service.ts
 *
 * Token format (must match infra/_common/scope_token.py byte-for-byte):
 *     <base64url-claims-json>.<base64url-hmac-sha256>
 *
 * Wire format invariants:
 *   - base64url is UNPADDED (no '=' chars)
 *   - JSON is sorted by key (sort_keys=True on Python side)
 *   - HMAC is SHA-256
 *   - claims dict must include 'scope' (sign fails otherwise) and 'exp'
 */

import * as crypto from 'crypto';

export class ScopeTokenError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScopeTokenError';
  }
}

function b64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, '+').replace(/_/g, '/') + pad,
    'base64',
  );
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/**
 * Sign a claims object. Throws ScopeTokenError if 'scope' is missing.
 */
export function sign(claims: Record<string, unknown>, secret: string): string {
  if (!('scope' in claims)) {
    throw new ScopeTokenError('missing_scope',
      "claims dict must include 'scope' field");
  }
  // Sort keys recursively to match Python's json.dumps(sort_keys=True).
  const normalized = sortKeysDeep(claims) as Record<string, unknown>;
  const json = JSON.stringify(normalized);
  const payloadB64 = b64urlEncode(json);
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = b64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a scoped token. Returns claims dict if valid.
 *
 * @param expected_scope if given, claims['scope'] MUST match.
 */
export function verify(
  token: string,
  secret: string,
  expectedScope?: string,
): Record<string, unknown> {
  if (!token || !token.includes('.')) {
    throw new ScopeTokenError('malformed_token',
      "Token must be in 'payload.signature' format");
  }
  const [payloadB64, sigB64] = token.split('.', 2);
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  let actualSig: Buffer;
  try {
    actualSig = b64urlDecode(sigB64);
  } catch (e) {
    throw new ScopeTokenError('malformed_signature',
      `Signature decode failed: ${(e as Error).message}`);
  }
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new ScopeTokenError('bad_signature', 'Signature does not match');
  }
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch (e) {
    throw new ScopeTokenError('malformed_payload',
      `Payload decode failed: ${(e as Error).message}`);
  }
  if (typeof claims !== 'object' || claims === null) {
    throw new ScopeTokenError('malformed_payload',
      'Claims must decode to a JSON object');
  }
  const exp = claims.exp;
  if (exp === undefined || exp === null) {
    throw new ScopeTokenError('missing_exp', 'Token has no exp claim');
  }
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) {
    throw new ScopeTokenError('expired_token', `Token expired at ${exp}`);
  }
  if (expectedScope !== undefined) {
    if (claims.scope !== expectedScope) {
      throw new ScopeTokenError('wrong_scope',
        `Token scope is ${String(claims.scope)}, expected ${expectedScope}`);
    }
  }
  return claims;
}

/**
 * Convenience: add scope + exp and sign. For tests + dev.
 */
export function mintForTest(
  secret: string,
  claims: Record<string, unknown>,
  scope: string,
  ttlSeconds = 900,
): string {
  const full: Record<string, unknown> = { ...claims };
  full.scope = scope;
  full.exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return sign(full, secret);
}