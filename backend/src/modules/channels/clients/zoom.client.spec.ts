/**
 * ZoomClient — unit tests.
 */

import {
  ZoomAuthException,
  ZoomClient,
} from './zoom.client';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const VALID_CREDS = {
  accessToken: 'test-token',
  expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
};

function okJson(body: object, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errResponse(status: number, body = ''): Response {
  return { ok: false, status, text: async () => body } as unknown as Response;
}

describe('ZoomClient', () => {
  it('rejects construction without access token', () => {
    expect(() => new ZoomClient({ accessToken: '' } as never)).toThrow(BadRequestException);
  });

  it('createMeeting POSTs to /users/me/meetings with bearer + idempotency key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return okJson({ id: '12345', join_url: 'https://zoom.us/j/12345', start_url: 'https://zoom.us/s/12345', topic: 't', start_time: 's' });
    }) as unknown as typeof fetch;

    const client = new ZoomClient(VALID_CREDS, fetchImpl);
    const result = await client.createMeeting({
      tenantId: 't',
      topic: 'Sprint planning',
      startTime: '2026-09-01T10:00:00Z',
      durationMinutes: 30,
      idempotencyKey: 'k-1',
    });

    expect(result.id).toBe('12345');
    const [call] = calls;
    expect(call.url).toBe('https://api.zoom.us/v2/users/me/meetings');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${VALID_CREDS.accessToken}`);
    expect(headers['Idempotency-Key']).toBe('k-1');
  });

  it('maps 401 to ZoomAuthException', async () => {
    const fetchImpl = (async () => errResponse(401)) as unknown as typeof fetch;
    const client = new ZoomClient(VALID_CREDS, fetchImpl);
    await expect(
      client.createMeeting({
        tenantId: 't',
        topic: 'x',
        startTime: 'x',
        durationMinutes: 30,
        idempotencyKey: 'k',
      }),
    ).rejects.toBeInstanceOf(ZoomAuthException);
  });

  it('maps 5xx to ServiceUnavailableException', async () => {
    const fetchImpl = (async () => errResponse(502)) as unknown as typeof fetch;
    const client = new ZoomClient(VALID_CREDS, fetchImpl);
    await expect(
      client.createMeeting({
        tenantId: 't',
        topic: 'x',
        startTime: 'x',
        durationMinutes: 30,
        idempotencyKey: 'k',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps 4xx to BadRequestException', async () => {
    const fetchImpl = (async () => errResponse(400)) as unknown as typeof fetch;
    const client = new ZoomClient(VALID_CREDS, fetchImpl);
    await expect(
      client.createMeeting({
        tenantId: 't',
        topic: 'x',
        startTime: 'x',
        durationMinutes: 30,
        idempotencyKey: 'k',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
