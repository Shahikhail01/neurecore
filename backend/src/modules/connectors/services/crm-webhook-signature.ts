/**
 * HmacCrmWebhookSignatureVerifier — generic HMAC webhook verifier.
 *
 * Phase 27 (P27) — Live connectors (CR-AI-1106).
 *
 * SRP — only verifies an inbound webhook signature.
 * ISP — one method.
 * DIP — adapters depend on this interface, not on provider-specific
 *       crypto code.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export interface ICrmWebhookSignatureVerifier {
  verify(input: {
    signature: string | undefined;
    requestBody: string;
    secret: string;
  }): boolean;
}

export class HmacCrmWebhookSignatureVerifier implements ICrmWebhookSignatureVerifier {
  constructor(
    private readonly algorithm: 'sha256' = 'sha256',
    private readonly encoding: 'hex' | 'base64' = 'hex',
  ) {}

  verify(input: {
    signature: string | undefined;
    requestBody: string;
    secret: string;
  }): boolean {
    if (!input.signature || !input.secret) return false;
    const expected = createHmac(this.algorithm, input.secret)
      .update(input.requestBody, 'utf8')
      .digest(this.encoding);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
