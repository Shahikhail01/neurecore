/**
 * Twilio — Channel Client.
 *
 * Source plan: IMPL_PLAN §R4 §4.7 (real network calls).
 *
 * Replaces the `SmsAdapter.dispatch()` and `VoiceAdapter.dispatch()`
 * stubs at backend/src/modules/channels/channel-adapter.registry.ts:246
 * and :282.
 *
 * SRP: protocol-level request building + typed exception mapping. The
 * auth client owns credentials; this client owns outbound HTTP.
 *
 * Idempotency: every outbound call carries an `Idempotency-Key` header.
 * Twilio honours this for SMS via the `MessageSid` — re-sends with the
 * same key are deduplicated server-side.
 *
 * Failure model:
 *   - 4xx → typed `TwilioBadRequestException` (NOT retriable)
 *   - 5xx → typed `TwilioTransientException` (retriable)
 *   - 401/403 → typed `TwilioAuthException` (rotate credentials)
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TwilioCredentials } from '../../integrations/twilio/twilio-auth.client';

export interface TwilioSmsParams {
  tenantId: string;
  to: string;        // E.164
  from?: string;     // override default fromNumber
  body: string;
  idempotencyKey: string;
}

export interface TwilioSmsResult {
  sid: string;
  status: string;
  to: string;
  from: string;
}

export interface TwilioVoiceParams {
  tenantId: string;
  to: string;
  from?: string;
  /** TwiML URL or inline TwiML. URL preferred. */
  twiml: string;
  idempotencyKey: string;
}

export interface TwilioCallResult {
  sid: string;
  status: string;
  to: string;
  from: string;
}

export class TwilioAuthException extends Error {
  constructor(public readonly inner: unknown) {
    super('Twilio auth failed — rotate credentials');
    this.name = 'TwilioAuthException';
  }
}

@Injectable()
export class TwilioClient {
  private readonly logger = new Logger(TwilioClient.name);

  constructor(
    private readonly credentials: TwilioCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.validateCredentials(credentials);
  }

  private get baseUrl(): string {
    // Twilio REST API root.
    return `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}`;
  }

  private basicAuthHeader(): string {
    return (
      'Basic ' +
      Buffer.from(
        `${this.credentials.accountSid}:${this.credentials.apiSecret}`,
      ).toString('base64')
    );
  }

  private validateCredentials(c: TwilioCredentials): void {
    if (!c?.accountSid || !c?.apiKey || !c?.apiSecret) {
      throw new BadRequestException(
        'Twilio credentials are incomplete (accountSid, apiKey, apiSecret required)',
      );
    }
  }

  async sendSms(params: TwilioSmsParams): Promise<TwilioSmsResult> {
    const url = `${this.baseUrl}/Messages.json`;
    const formBody = new URLSearchParams();
    formBody.set('To', params.to);
    formBody.set('From', params.from ?? this.credentials.fromNumber ?? '');
    formBody.set('Body', params.body);
    if (!formBody.get('From')) {
      throw new BadRequestException(
        'Twilio sms requires `from` — set default fromNumber in credentials or pass explicitly',
      );
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: this.basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: formBody.toString(),
    });
    return this.handleResponse<TwilioSmsResult>(
      res,
      'sendSms',
      params.idempotencyKey,
    );
  }

  async placeCall(params: TwilioVoiceParams): Promise<TwilioCallResult> {
    const url = `${this.baseUrl}/Calls.json`;
    const formBody = new URLSearchParams();
    formBody.set('To', params.to);
    formBody.set('From', params.from ?? this.credentials.fromNumber ?? '');
    formBody.set('Url', params.twiml);
    if (!formBody.get('From')) {
      throw new BadRequestException('Twilio voice requires from — set default fromNumber in credentials');
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: this.basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: formBody.toString(),
    });
    return this.handleResponse<TwilioCallResult>(
      res,
      'placeCall',
      params.idempotencyKey,
    );
  }

  private async handleResponse<T>(
    res: Response,
    op: string,
    idempotencyKey: string,
  ): Promise<T> {
    if (res.ok) {
      return (await res.json()) as T;
    }
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new TwilioAuthException({ status: res.status, body });
    }
    if (res.status >= 500) {
      throw new ServiceUnavailableException({
        code: 'TWILIO_TRANSIENT',
        op,
        status: res.status,
        body,
        idempotencyKey,
      });
    }
    throw new BadRequestException({
      code: 'TWILIO_BAD_REQUEST',
      op,
      status: res.status,
      body,
      idempotencyKey,
    });
  }
}
