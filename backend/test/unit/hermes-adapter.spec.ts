/**
 * HermesAdapterModule unit tests.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3 (Phase 1 exit gate extension)
 *
 * These tests verify:
 *   1. Token mint/verify round-trip (HMAC-SHA256 signed)
 *   2. Adapter service correctly builds scoped tokens before calling
 *      the sidecar (verify by spying on the HTTP client)
 *   3. Adapter service translates sidecar errors into proper HTTP errors
 *   4. Events ingest verifies the webhook signature
 *
 * Pure unit tests — no live HTTP, no live sidecar. The adapter tests
 * assert that the outbound request carries the right bearer token +
 * correct path + correct body shape.
 */

import { HermesTokenService, HermesTokenError } from '../../src/modules/hermes-adapter/services/token.service';
import {
  HermesAdapterService,
  SidecarHttpClient,
} from '../../src/modules/hermes-adapter/services/hermes-adapter.service';
import { HermeEventsIngestService } from '../../src/modules/hermes-adapter/services/events-ingest.service';
import { HermesAdapterController } from '../../src/modules/hermes-adapter/controllers/hermes-adapter.controller';
import { HermeSidecarEventsController } from '../../src/modules/hermes-adapter/controllers/hermes-sidecar-events.controller';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/roles.decorator';
import * as crypto from 'crypto';

// ─── Config mock factory ──────────────────────────────────


function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

// ─── HermesTokenService tests ──────────────────────────────


describe('HermesTokenService', () => {
  const SECRET = 'unit-test-secret-32-chars-min-yes';

  function makeService(
    overrides: Record<string, string | undefined> = {},
  ): HermesTokenService {
    return new HermesTokenService(
      makeConfig({ HERMES_SIDECAR_SECRET: SECRET, ...overrides }),
    );
  }

  it('requires HERMES_SIDECAR_SECRET to be set', () => {
    expect(() => makeService({ HERMES_SIDECAR_SECRET: undefined })).toThrow(
      HermesTokenError,
    );
  });

  it('mints a token in `payload.signature` format', () => {
    const svc = makeService();
    const token = svc.mint({
      sub: 'user-1',
      tenantId: 't1',
      executionId: 'exec-1',
      workspacePath: '/var/lib/neurecore/hermes/tenants/t1/',
      allowedTools: ['stub.echo'],
      approvalThreshold: 'STANDARD',
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('round-trips mint → verify', () => {
    const svc = makeService();
    const claims = {
      sub: 'user-1',
      tenantId: 't1',
      executionId: 'exec-1',
      workspacePath: '/var/lib/neurecore/hermes/tenants/t1/',
      allowedTools: ['stub.echo'],
      approvalThreshold: 'STANDARD' as const,
    };
    const token = svc.mint(claims);
    const verified = svc.verify(token);
    expect(verified.sub).toBe(claims.sub);
    expect(verified.tenantId).toBe(claims.tenantId);
    expect(verified.executionId).toBe(claims.executionId);
    expect(verified.allowedTools).toEqual(claims.allowedTools);
    expect(verified.scope).toBe('hermes:execute');
  });

  it('rejects a token signed with a different secret', () => {
    const svc = makeService();
    const badToken = HermesTokenService.mintForTest(
      'wrong-secret',
      {
        sub: 'user-1',
        tenantId: 't1',
        executionId: 'exec-1',
        workspacePath: '/x',
        allowedTools: [],
        approvalThreshold: 'NONE',
      },
    );
    expect(() => svc.verify(badToken)).toThrow(HermesTokenError);
  });

  it('rejects an expired token', () => {
    const svc = makeService();
    const expired = HermesTokenService.mintForTest(
      SECRET,
      {
        sub: 'user-1',
        tenantId: 't1',
        executionId: 'exec-1',
        workspacePath: '/x',
        allowedTools: [],
        approvalThreshold: 'NONE',
      },
      -10,
    );
    expect(() => svc.verify(expired)).toThrow(/expired/i);
  });

  it('rejects a malformed token', () => {
    const svc = makeService();
    expect(() => svc.verify('not-a-token')).toThrow(HermesTokenError);
    expect(() => svc.verify('')).toThrow(HermesTokenError);
  });

  it('rejects TTL > 3600 seconds', () => {
    expect(() =>
      makeService({ HERMES_SIDECAR_TOKEN_TTL_SECONDS: '7200' }),
    ).toThrow(/TTL/i);
  });

  it('uses the sidecar-side HMAC format (payload.signature)', () => {
    // The sidecar's auth.py uses the same format. Verify our format
    // is byte-for-byte compatible with Python base64url + HMAC-SHA256.
    const svc = makeService();
    const token = svc.mint({
      sub: 'u',
      tenantId: 't',
      executionId: 'e',
      workspacePath: '/x',
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    const [payloadB64, sigB64] = token.split('.');
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payloadB64)
      .digest();
    const actualSig = Buffer.from(
      sigB64.replace(/-/g, '+').replace(/_/g, '/') +
        '='.repeat((4 - (sigB64.length % 4)) % 4),
      'base64',
    );
    expect(expectedSig.equals(actualSig)).toBe(true);
  });
});

// ─── HermesAdapterService tests ────────────────────────────


describe('HermesAdapterService', () => {
  const SECRET = 'unit-test-secret-32-chars-min-yes';
  const BASE_URL = 'http://sidecar.local:8080';

  function makeHttpClient(overrides: {
    get?: jest.Mock;
    post?: jest.Mock;
  }): SidecarHttpClient & { get: jest.Mock; post: jest.Mock } {
    return {
      get: overrides.get ?? jest.fn(async () => ({ status: 200, data: {} })),
      post: overrides.post ?? jest.fn(async () => ({ status: 200, data: {} })),
    };
  }

  function makeAdapter(httpOverrides: { get?: jest.Mock; post?: jest.Mock } = {}) {
    const httpClient = makeHttpClient(httpOverrides);
    const config = makeConfig({
      HERMES_SIDECAR_SECRET: SECRET,
      HERMES_SIDECAR_URL: BASE_URL,
    });
    const tokenSvc = new HermesTokenService(config);
    const svc = new HermesAdapterService(config, tokenSvc, httpClient);
    return { svc, httpClient, tokenSvc };
  }

  it('requires HERMES_SIDECAR_URL', () => {
    const config = makeConfig({ HERMES_SIDECAR_SECRET: SECRET });
    expect(
      () =>
        new HermesAdapterService(
          config,
          new HermesTokenService(config),
          makeHttpClient({}),
        ),
    ).toThrow(/HERMES_SIDECAR_URL/);
  });

  it('startExecution mints a token and POSTs to the sidecar', async () => {
    const post = jest.fn(async () => ({
      status: 201,
      data: { executionId: 'exec-1', status: 'RUNNING', startedAt: 1 },
    }));
    const { svc } = makeAdapter({ post });
    await svc.startExecution({
      executionId: 'exec-1',
      tenantId: 't1',
      userId: 'user-1',
      workspacePath: '/var/lib/neurecore/hermes/tenants/t1/',
      allowedTools: ['stub.echo'],
      initialMessage: 'hello',
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, headers] = post.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/executions`);
    expect(body.executionId).toBe('exec-1');
    expect(body.tenantId).toBe('t1');
    expect(body.allowedTools).toEqual(['stub.echo']);
    expect(headers.Authorization).toMatch(/^Bearer /);
    const token = headers.Authorization.replace('Bearer ', '');
    const claims = new HermesTokenService(
      makeConfig({ HERMES_SIDECAR_SECRET: SECRET }),
    ).verify(token);
    expect(claims.tenantId).toBe('t1');
    expect(claims.executionId).toBe('exec-1');
    expect(claims.allowedTools).toEqual(['stub.echo']);
  });

  it('getExecutionStatus mints a token bound to the executionId', async () => {
    const get = jest.fn(async () => ({
      status: 200,
      data: { executionId: 'exec-1', status: 'RUNNING' },
    }));
    const { svc } = makeAdapter({ get });
    await svc.getExecutionStatus('exec-1', 't1', 'user-1');
    expect(get).toHaveBeenCalledTimes(1);
    const [url, headers] = get.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/executions/exec-1`);
    const token = headers.Authorization.replace('Bearer ', '');
    const claims = new HermesTokenService(
      makeConfig({ HERMES_SIDECAR_SECRET: SECRET }),
    ).verify(token);
    expect(claims.executionId).toBe('exec-1');
  });

  it('rejects invalid executionId format', async () => {
    const { svc } = makeAdapter({});
    await expect(
      svc.startExecution({
        executionId: '../etc/passwd',
        tenantId: 't1',
        userId: 'user-1',
        workspacePath: '/x',
        allowedTools: [],
        initialMessage: 'x',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'invalid_execution_id', code: 'bad_request' },
    });
  });

  it('translates a 401 sidecar response into HttpException 401', async () => {
    const post = jest.fn(async () => ({
      status: 401,
      data: { error: 'bad_signature', code: 'unauthorized' },
    }));
    const { svc } = makeAdapter({ post });
    await expect(
      svc.startExecution({
        executionId: 'exec-1',
        tenantId: 't1',
        userId: 'user-1',
        workspacePath: '/x',
        allowedTools: [],
        initialMessage: 'x',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('translates a transport error into 503', async () => {
    const post = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const { svc } = makeAdapter({ post });
    await expect(
      svc.startExecution({
        executionId: 'exec-1',
        tenantId: 't1',
        userId: 'user-1',
        workspacePath: '/x',
        allowedTools: [],
        initialMessage: 'x',
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('cancelExecution posts to the cancel endpoint', async () => {
    const post = jest.fn(async () => ({ status: 200, data: { status: 'CANCELLED' } }));
    const { svc } = makeAdapter({ post });
    await svc.cancelExecution('exec-1', 't1', 'user-1');
    const [url] = post.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/executions/exec-1/cancel`);
  });

  it('submitApprovalDecision posts to the approvals endpoint', async () => {
    const post = jest.fn(async () => ({ status: 200, data: { status: 'COMPLETED' } }));
    const { svc } = makeAdapter({ post });
    await svc.submitApprovalDecision({
      executionId: 'exec-1',
      tenantId: 't1',
      userId: 'user-1',
      approvalId: 'apr-1',
      decision: 'approve',
      reason: 'looks good',
    });
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/executions/exec-1/approvals/apr-1`);
    expect(body.decision).toBe('approve');
    expect(body.reason).toBe('looks good');
  });
});

// ─── HermeEventsIngestService tests ────────────────────────


describe('HermeEventsIngestService', () => {
  const SECRET = 'unit-test-secret-32-chars-min-yes';

  function makeService(): HermeEventsIngestService {
    const config = makeConfig({ HERMES_SIDECAR_SECRET: SECRET });
    const tokenSvc = new HermesTokenService(config);
    return new HermeEventsIngestService(config, tokenSvc);
  }

  function sign(rawBody: string, ts: number, secret = SECRET): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody}`)
      .digest('hex');
  }

  it('accepts a valid webhook event', async () => {
    const svc = makeService();
    const ts = Math.floor(Date.now() / 1000);
    const event = {
      type: 'tool.start',
      executionId: 'exec-1',
      ts,
      payload: { toolName: 'stub.echo' },
    };
    const rawBody = JSON.stringify(event);
    const sig = sign(rawBody, ts);
    const result = await svc.ingest(rawBody, sig, String(ts));
    expect(result.type).toBe('tool.start');
    expect(result.executionId).toBe('exec-1');
  });

  it('rejects a missing signature', async () => {
    const svc = makeService();
    const ts = Math.floor(Date.now() / 1000);
    await expect(svc.ingest('{}', undefined, String(ts))).rejects.toThrow();
  });

  it('rejects a stale timestamp', async () => {
    const svc = makeService();
    const ts = Math.floor(Date.now() / 1000) - 9999;
    const rawBody = '{}';
    const sig = sign(rawBody, ts);
    await expect(svc.ingest(rawBody, sig, String(ts))).rejects.toThrow(/tolerance/i);
  });

  it('rejects a bad signature', async () => {
    const svc = makeService();
    const ts = Math.floor(Date.now() / 1000);
    const event = { type: 'x', executionId: 'y', ts, payload: {} };
    const rawBody = JSON.stringify(event);
    const sig = sign(rawBody, ts, 'wrong-secret');
    await expect(svc.ingest(rawBody, sig, String(ts))).rejects.toThrow(/signature/i);
  });

  it('rejects malformed JSON', async () => {
    const svc = makeService();
    const ts = Math.floor(Date.now() / 1000);
    const rawBody = 'not json';
    const sig = sign(rawBody, ts);
    await expect(svc.ingest(rawBody, sig, String(ts))).rejects.toThrow(/JSON/i);
  });
});

describe('Hermes adapter HTTP surface', () => {
  it('uses Nest URI version metadata without duplicating /v1', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HermesAdapterController)).toBe(
      'hermes-adapter',
    );
    expect(Reflect.getMetadata(VERSION_METADATA, HermesAdapterController)).toBe(
      '1',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, HermeSidecarEventsController),
    ).toBe('hermes-adapter/executions/:executionId/events');
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, HermeSidecarEventsController),
    ).toBe(true);
  });

  it('passes the exact raw webhook bytes to signature verification', async () => {
    const ingest = {
      ingest: jest.fn(() => ({ type: 'tool.start' })),
    };
    const controller = new HermeSidecarEventsController(ingest as never);
    const body = { executionId: 'e1', type: 'tool.start', ts: 1 };
    const raw = Buffer.from(
      '{ "ts": 1, "type": "tool.start", "executionId": "e1" }',
    );
    await controller.receive(
      { rawBody: raw } as never,
      'e1',
      'signature',
      '123',
      body,
    );
    expect(ingest.ingest).toHaveBeenCalledWith(
      raw.toString('utf8'),
      'signature',
      '123',
    );
  });

  it('rejects an event whose URL and body execution IDs differ', async () => {
    const controller = new HermeSidecarEventsController({ ingest: jest.fn() } as never);
    await expect(
      controller.receive(
        { rawBody: Buffer.from('{}') } as never,
        'url-execution',
        'signature',
        '123',
        { executionId: 'body-execution', type: 'x', ts: 1 },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
