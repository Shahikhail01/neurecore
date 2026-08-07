/**
 * TwilioAuthClient — interface compliance tests.
 *
 * Twilio uses HTTP Basic; the auth client is intentionally minimal.
 * `buildAuthorizationUrl` and `exchangeAuthorizationCode` MUST throw
 * a typed error so callers don't accidentally try OAuth with Twilio.
 */

import {
  IntegrationAuthError,
} from '../interfaces/integration-auth.interface';
import { TwilioAuthClient } from './twilio-auth.client';

describe('TwilioAuthClient', () => {
  const client = new TwilioAuthClient();

  it('declares provider TWILIO', () => {
    expect(client.provider).toBe('TWILIO');
  });

  it('buildAuthorizationUrl throws typed error (no OAuth for Twilio)', () => {
    try {
      client.buildAuthorizationUrl();
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrationAuthError);
      expect((err as IntegrationAuthError).reason).toBe('PROVIDER_ERROR');
      expect((err as IntegrationAuthError).provider).toBe('TWILIO');
      expect((err as IntegrationAuthError).retriable).toBe(false);
    }
  });

  it('exchangeAuthorizationCode throws typed error (Basic auth only)', async () => {
    await expect(client.exchangeAuthorizationCode()).rejects.toBeInstanceOf(
      IntegrationAuthError,
    );
  });

  it('getCredentials returns null (not implemented in this stub)', async () => {
    expect(await client.getCredentials('t')).toBeNull();
  });

  it('revoke does not throw', async () => {
    await expect(client.revoke('t')).resolves.toBeUndefined();
  });
});
