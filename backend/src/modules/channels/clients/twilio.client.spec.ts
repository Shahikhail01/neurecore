/**
 * TwilioClient — unit tests.
 *
 * No real network. The fetch impl is stubbed so each test can craft
 * HTTP responses and assert exact request shape + idempotency key.
 */

import {
  TwilioAuthException,
  TwilioClient,
} from './twilio.client';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const VALID_CREDS = {
  accountSid: 'AC0123456789abcdef',
  apiKey: 'SK0123456789abcdef',
  apiSecret: 'auth-secret',
  fromNumber: '+15555550100',
};

function okJsonResponse(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe('TwilioClient', () => {
  it('rejects construction with incomplete credentials', () => {
    expect(() => new TwilioClient({ accountSid: '', apiKey: 'x', apiSecret: 'y' } as never)).toThrow(BadRequestException);
  });

  it('sendSms issues POST /Messages.json with Basic auth + Idempotency-Key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return okJsonResponse({ sid: 'SM-xyz', status: 'queued', to: '+15555550199', from: '+15555550100' });
    }) as unknown as typeof fetch;

    const client = new TwilioClient(VALID_CREDS, fetchImpl);
    const result = await client.sendSms({
      tenantId: 'tenant-A',
      to: '+15555550199',
      body: 'Hello',
      idempotencyKey: 'idem-1',
    });

    expect(result.sid).toBe('SM-xyz');
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${VALID_CREDS.accountSid}/Messages.json`,
    );
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
    expect(headers['Idempotency-Key']).toBe('idem-1');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(String(call.init.body)).toContain('To=%2B15555550199');
    expect(String(call.init.body)).toContain('Body=Hello');
  });

  it('sendSms falls back to credential fromNumber when caller does not pass from', async () => {
    let lastInit: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      lastInit = init;
      return okJsonResponse({ sid: 'SM-xyz', status: 'queued', to: '+1', from: '+2' });
    }) as unknown as typeof fetch;

    const client = new TwilioClient(VALID_CREDS, fetchImpl);
    await client.sendSms({
      tenantId: 'tenant-A',
      to: '+15555550199',
      body: 'hi',
      idempotencyKey: 'k',
    });
    expect(String(lastInit?.body)).toContain(`From=${encodeURIComponent(VALID_CREDS.fromNumber)}`);
  });

  it('sendSms throws BadRequestException when no from is available', async () => {
    const client = new TwilioClient({ ...VALID_CREDS, fromNumber: undefined });
    await expect(
      client.sendSms({ tenantId: 't', to: '+1', body: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendSms maps 5xx to ServiceUnavailableException (retriable)', async () => {
    const fetchImpl = (async () => errorResponse(503, 'overloaded')) as unknown as typeof fetch;
    const client = new TwilioClient(VALID_CREDS, fetchImpl);
    await expect(
      client.sendSms({ tenantId: 't', to: '+1', body: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sendSms maps 4xx to BadRequestException', async () => {
    const fetchImpl = (async () => errorResponse(400, 'bad')) as unknown as typeof fetch;
    const client = new TwilioClient(VALID_CREDS, fetchImpl);
    await expect(
      client.sendSms({ tenantId: 't', to: '+1', body: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendSms maps 401/403 to TwilioAuthException', async () => {
    const fetchImpl = (async () => errorResponse(401, 'auth')) as unknown as typeof fetch;
    const client = new TwilioClient(VALID_CREDS, fetchImpl);
    await expect(
      client.sendSms({ tenantId: 't', to: '+1', body: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(TwilioAuthException);
  });
});
