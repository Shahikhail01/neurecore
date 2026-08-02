/**
 * Shared timestamped webhook signature library — TypeScript port.
 * Mirrors infra/_common/webhook_sig.py.
 */

import * as crypto from 'crypto';

export class WebhookSigError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookSigError';
  }
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function sign(
  body: Buffer | string,
  secret: string,
  timestamp?: number,
): { t: string; v1: string } {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const signedPayload = Buffer.concat([Buffer.from(`${ts}.`, 'ascii'), buf]);
  const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest();
  return { t: String(ts), v1: b64urlEncode(sig) };
}

export function verify(
  body: Buffer | string,
  headers: { t?: string; v1?: string },
  secret: string,
  maxSkewSeconds = 300,
): number {
  const tStr = headers.t;
  const sig = headers.v1;
  if (!tStr || !sig) {
    throw new WebhookSigError('missing_header',
      'Webhook requires t and v1 headers');
  }
  const ts = parseInt(tStr, 10);
  if (isNaN(ts)) {
    throw new WebhookSigError('missing_header', `t header must be integer`);
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > maxSkewSeconds) {
    throw new WebhookSigError('expired',
      `Timestamp skew ${skew}s exceeds max ${maxSkewSeconds}s`);
  }
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const signedPayload = Buffer.concat([Buffer.from(`${ts}.`, 'ascii'), buf]);
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest();
  let actualSig: Buffer;
  try {
    actualSig = b64urlDecode(sig);
  } catch (e) {
    throw new WebhookSigError('bad_signature', `v1 decode failed: ${(e as Error).message}`);
  }
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new WebhookSigError('bad_signature', 'Webhook signature does not match');
  }
  return ts;
}