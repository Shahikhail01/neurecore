import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CsrfProtectionMiddleware,
} from '../../src/common/auth/csrf.middleware';
import {
  CookieAuthService,
  CSRF_COOKIE,
} from '../../src/common/auth/cookie-auth.service';
import type { NextFunction, Request, Response } from 'express';

/**
 * Unit tests for CsrfProtectionMiddleware — Phase 9 (Auth Hardening).
 *
 * Per `EAOS-api-contract.md` §7.6 — double-submit cookie pattern.
 */

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const data: Record<string, string | undefined> = {
    NODE_ENV: 'production',
    USE_HTTPONLY_AUTH: 'true',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => data[key] ?? fallback),
  } as unknown as ConfigService;
}

function buildMiddleware(opts: {
  featureFlag?: boolean;
  method?: string;
  path?: string;
  cookieToken?: string | null;
  headerToken?: string | null;
}) {
  const config = makeConfig(
    opts.featureFlag === false
      ? { USE_HTTPONLY_AUTH: 'false' }
      : { USE_HTTPONLY_AUTH: 'true' },
  );
  const cookieAuth = new CookieAuthService(config);
  const middleware = new CsrfProtectionMiddleware(cookieAuth);

  const req = {
    method: opts.method ?? 'POST',
    path: opts.path ?? '/api/v1/agents',
    headers: {
      ...(opts.cookieToken != null
        ? { cookie: `${CSRF_COOKIE}=${opts.cookieToken}` }
        : {}),
      ...(opts.headerToken != null
        ? { 'x-csrf-token': opts.headerToken }
        : {}),
    },
    cookies:
      opts.cookieToken != null
        ? { [CSRF_COOKIE]: opts.cookieToken }
        : {},
  } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as NextFunction;

  return { middleware, req, res, next };
}

describe('CsrfProtectionMiddleware', () => {
  describe('safe methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])(
      '%s passes without CSRF check',
      (method) => {
        const { middleware, req, res, next } = buildMiddleware({
          method,
          cookieToken: null,
          headerToken: null,
        });
        middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
      },
    );
  });

  describe('exempt paths', () => {
    it.each([
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/google',
      '/api/v1/auth/refresh',
    ])('exempts %s even when CSRF tokens are missing', (path) => {
      const { middleware, req, res, next } = buildMiddleware({
        method: 'POST',
        path,
        cookieToken: null,
        headerToken: null,
      });
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('exempts the HMAC-authenticated Hermes event callback only', () => {
      const event = buildMiddleware({
        path: '/api/v1/hermes-adapter/executions/e-123/events',
        cookieToken: null,
        headerToken: null,
      });
      event.middleware.use(event.req, event.res, event.next);
      expect(event.next).toHaveBeenCalled();

      const adjacentRoute = buildMiddleware({
        path: '/api/v1/hermes-adapter/executions/e-123/resume',
        cookieToken: null,
        headerToken: null,
      });
      expect(() =>
        adjacentRoute.middleware.use(
          adjacentRoute.req,
          adjacentRoute.res,
          adjacentRoute.next,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('feature flag', () => {
    it('passes through when USE_HTTPONLY_AUTH=false', () => {
      const { middleware, req, res, next } = buildMiddleware({
        featureFlag: false,
        method: 'POST',
        path: '/api/v1/agents',
        cookieToken: null,
        headerToken: null,
      });
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('mutating requests with feature flag ON', () => {
    it('rejects when CSRF cookie missing', () => {
      const { middleware, req, res, next } = buildMiddleware({
        method: 'POST',
        path: '/api/v1/agents',
        cookieToken: null,
        headerToken: 'some-token',
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when X-CSRF-Token header missing', () => {
      const { middleware, req, res, next } = buildMiddleware({
        method: 'POST',
        path: '/api/v1/agents',
        cookieToken: 'csrf-cookie-value',
        headerToken: null,
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when cookie and header values do not match', () => {
      const { middleware, req, res, next } = buildMiddleware({
        method: 'POST',
        path: '/api/v1/agents',
        cookieToken: 'cookie-value',
        headerToken: 'different-header-value',
      });
      expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes when cookie and header values match', () => {
      const { middleware, req, res, next } = buildMiddleware({
        method: 'POST',
        path: '/api/v1/agents',
        cookieToken: 'same-token',
        headerToken: 'same-token',
      });
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
