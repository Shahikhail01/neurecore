/**
 * Microsoft Outlook Mail — Channel Client.
 *
 * Source plan: IMPL_PLAN §R4 §4.7 — replaces MsOutlookAdapter.dispatch() stub.
 *
 * SRP: protocol-level request building for Microsoft Graph `/sendMail`
 * endpoint. Token provided by the existing MicrosoftGraphAuthService.
 *
 * Endpoint:
 *   POST https://graph.microsoft.com/v1.0/me/sendMail
 *   POST https://graph.microsoft.com/v1.0/users/{userId}/sendMail
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { IMicrosoftGraphTokenProvider } from './ms-teams.client';

export interface MsOutlookMailParams {
  tenantId: string;
  /** Required: where to send. Resolved by the caller (channel service) from the connection. */
  userId?: string;
  subject: string;
  body: { contentType: 'Text' | 'HTML'; content: string };
  toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
  idempotencyKey: string;
}

export interface MsOutlookSendResult {
  /** Graph does not return the message id on /sendMail; we synthesise a delivery id. */
  deliveryId: string;
  acceptedAt: string;
}

export class MsOutlookAuthException extends Error {
  constructor(public readonly inner: unknown) {
    super('MS Graph access token invalid — refresh and retry');
    this.name = 'MsOutlookAuthException';
  }
}

@Injectable()
export class MsOutlookClient {
  private readonly logger = new Logger(MsOutlookClient.name);

  constructor(
    private readonly tokenProvider: IMicrosoftGraphTokenProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendMail(params: MsOutlookMailParams): Promise<MsOutlookSendResult> {
    const token = await this.tokenProvider.getAccessToken(params.tenantId);
    const url = params.userId
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(params.userId)}/sendMail`
      : 'https://graph.microsoft.com/v1.0/me/sendMail';
    const body = {
      message: {
        subject: params.subject,
        body: params.body,
        toRecipients: params.toRecipients,
      },
      saveToSentItems: false,
    };
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
        'client-request-id': params.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 202 || res.ok) {
      return {
        deliveryId: params.idempotencyKey,
        acceptedAt: new Date().toISOString(),
      };
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new MsOutlookAuthException({ status: 401, body: text });
    }
    if (res.status >= 500) {
      throw new ServiceUnavailableException({
        code: 'MS_GRAPH_TRANSIENT',
        status: res.status,
        body: text,
        idempotencyKey: params.idempotencyKey,
      });
    }
    throw new BadRequestException({
      code: 'MS_GRAPH_BAD_REQUEST',
      status: res.status,
      body: text,
      idempotencyKey: params.idempotencyKey,
    });
  }
}
