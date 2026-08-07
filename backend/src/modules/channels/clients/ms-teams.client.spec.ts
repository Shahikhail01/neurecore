/**
 * MsTeamsClient — unit tests.
 */

import {
  MsGraphAuthException,
  MsTeamsClient,
} from './ms-teams.client';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

function okJson(body: object): Response {
  return {
    ok: true,
    status: 201,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
function err(s: number, b = ''): Response {
  return { ok: false, status: s, text: async () => b } as unknown as Response;
}

const TOKEN_PROVIDER = { getAccessToken: async (_t: string) => 'T' };

describe('MsTeamsClient', () => {
  it('routes to /chats/{chatId}/messages when chatId is set', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return okJson({ id: 'm-1', createdDateTime: '2026-08-06T00:00:00Z' });
    }) as unknown as typeof fetch;
    const c = new MsTeamsClient(TOKEN_PROVIDER, f);
    await c.sendChatMessage({
      tenantId: 't',
      chatId: 'chat-xyz',
      message: 'hello',
      idempotencyKey: 'k-1',
    });
    expect(calls[0].url).toContain('/chats/chat-xyz/messages');
  });

  it('routes to /teams/{tid}/channels/{cid}/messages when team+channel set', async () => {
    const calls: Array<{ url: string }> = [];
    const f = (async (url: string) => {
      calls.push({ url });
      return okJson({ id: 'm-1', createdDateTime: 'x' });
    }) as unknown as typeof fetch;
    const c = new MsTeamsClient(TOKEN_PROVIDER, f);
    await c.sendChatMessage({
      tenantId: 't',
      teamId: 'tid',
      channelId: 'cid',
      message: 'hi',
      idempotencyKey: 'k',
    });
    expect(calls[0].url).toContain('/teams/tid/channels/cid/messages');
  });

  it('throws when neither chatId nor team/channel is set', async () => {
    const c = new MsTeamsClient(TOKEN_PROVIDER);
    await expect(
      c.sendChatMessage({ tenantId: 't', message: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps 401 to MsGraphAuthException', async () => {
    const f = (async () => err(401)) as unknown as typeof fetch;
    const c = new MsTeamsClient(TOKEN_PROVIDER, f);
    await expect(
      c.sendChatMessage({ tenantId: 't', chatId: 'c', message: 'm', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(MsGraphAuthException);
  });

  it('maps 5xx to ServiceUnavailableException', async () => {
    const f = (async () => err(503)) as unknown as typeof fetch;
    const c = new MsTeamsClient(TOKEN_PROVIDER, f);
    await expect(
      c.sendChatMessage({ tenantId: 't', chatId: 'c', message: 'm', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('passes Idempotency-Key + client-request-id headers', async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const f = (async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return okJson({ id: 'm', createdDateTime: 'x' });
    }) as unknown as typeof fetch;
    const c = new MsTeamsClient(TOKEN_PROVIDER, f);
    await c.sendChatMessage({
      tenantId: 't',
      chatId: 'c',
      message: 'm',
      idempotencyKey: 'idem-1',
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-1');
    expect(headers['client-request-id']).toBe('idem-1');
    expect(headers['Authorization']).toBe('Bearer T');
  });
});
