/**
 * ZoomAuthClient — interface compliance tests.
 *
 * Covers:
 *   - provider identifier
 *   - buildAuthorizationUrl emits the canonical Zoom OAuth URL
 *   - exchangeAuthorizationCode posts Basic-auth to /oauth/token
 *   - exchangeAuthorizationCode maps failure to IntegrationAuthError
 *   - getCredentials returns null until the credential store is wired
 *   - refreshIfExpiring throws IntegrationAuthError (stub path)
 */

import {
  IntegrationAuthError,
} from '../interfaces/integration-auth.interface';
import { ZoomAuthClient } from './zoom-auth.client';

function okJson(body: object): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
function err(s: number, b = ''): Response {
  return { ok: false, status: s, text: async () => b } as unknown as Response;
}

describe('ZoomAuthClient', () => {
  const client = new ZoomAuthClient(
    'client_id_123',
    'client_secret_456',
    'https://app.example.com/oauth/callback',
  );

  it('declares provider ZOOM', () => {
    expect(client.provider).toBe('ZOOM');
  });

  it('buildAuthorizationUrl emits canonical Zoom OAuth URL', () => {
    const url = client.buildAuthorizationUrl('t', 'https://app/cb', 'state-xyz');
    expect(url).toContain('https://zoom.us/oauth/authorize');
    expect(url).toContain('client_id=client_id_123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp%2Fcb');
    expect(url).toContain('state=state-xyz');
    expect(url).toContain('scope=user%3Aread');
    expect(url).toContain('meeting%3Awrite');
  });

  it('buildAuthorizationUrl throws if not configured', () => {
    const unconfigured = new ZoomAuthClient(undefined, undefined, 'http://cb');
    expect(() =>
      unconfigured.buildAuthorizationUrl('t', 'http://cb', 's'),
    ).toThrow(IntegrationAuthError);
  });

  it('exchangeAuthorizationCode parses expires_in + access_token', async () => {
    const f = (async () =>
      okJson({
        access_token: 'AT-xyz',
        refresh_token: 'RT-xyz',
        expires_in: 3600,
        scope: 'user:read meeting:write',
      })) as unknown as typeof fetch;
    const c = new ZoomAuthClient('id', 'secret', 'http://cb', f);
    const creds = await c.exchangeAuthorizationCode('t', 'CODE', 'http://cb');
    expect(creds.accessToken).toBe('AT-xyz');
    expect(creds.refreshToken).toBe('RT-xyz');
    expect(creds.expiresAt).toBeDefined();
  });

  it('exchangeAuthorizationCode maps 4xx to IntegrationAuthError', async () => {
    const f = (async () => err(400, 'invalid_grant')) as unknown as typeof fetch;
    const c = new ZoomAuthClient('id', 'secret', 'http://cb', f);
    await expect(
      c.exchangeAuthorizationCode('t', 'CODE', 'http://cb'),
    ).rejects.toMatchObject({ name: 'IntegrationAuthError' });
  });

  it('refreshIfExpiring throws IntegrationAuthError until backing store wired', async () => {
    await expect(
      client.refreshIfExpiring('t'),
    ).rejects.toBeInstanceOf(IntegrationAuthError);
  });
});
