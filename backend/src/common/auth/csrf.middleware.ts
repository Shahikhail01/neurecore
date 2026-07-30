/**
 * CSRF Protection Middleware — Phase 9 (Auth Hardening)
 *
 * Per `EAOS-api-contract.md` §7.6 + `EAOS-implementation-roadmap.md` §13 task 9.3.
 *
 * Implements the **double-submit cookie** pattern (the standard, CSPA-recommended
 * defense for cookie-authenticated SPAs since the SPA cannot read httpOnly cookies).
 *
 * Flow:
 *   1. Server issues `__Host-nc_csrf` cookie (NOT httpOnly — JS can read it).
 *   2. SPA reads `cookieManager.getCsrfToken()` on app load.
 *   3. SPA sends `X-CSRF-Token: <token>` header on every mutating request.
 *   4. Server compares cookie value vs header value (constant-time).
 *
 * Safe methods (GET, HEAD, OPTIONS) are NOT protected — same-origin SOP already
 * blocks cross-site reads of response data, so CSRF only matters for state-changing
 * requests.
 *
 * Exempt paths:
 *   - `/api/v1/auth/login` — pre-auth; can't have a CSRF cookie yet.
 *   - `/api/v1/auth/register` — same.
 *   - `/api/v1/auth/google` — same.
 *   - `/api/v1/auth/refresh` — uses the httpOnly refresh cookie directly,
 *       which the browser auto-attaches; CSRF protection at this level is
 *       redundant (the cookie IS the proof of possession).
 *
 * SRP: this middleware ONLY validates CSRF. It does not modify the request.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CookieAuthService } from './cookie-auth.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PATHS = new Set<string>([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/google',
  '/api/v1/auth/refresh',
  '/api/v1/chat/messages',
  '/api/v1/chat/stream',
  '/api/v1/chat/history',
  '/api/v1/chat/suggestions',
]);

const HMAC_SERVICE_PATHS = [
  /^\/api\/v1\/hermes-adapter\/executions\/[^/]+\/events$/,
  /^\/api\/v1\/hermes-adapter\/executions\/[^/]+\/tools\/[^/]+$/,
];

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfProtectionMiddleware.name);

  constructor(private readonly cookieAuth: CookieAuthService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    // Skip safe methods
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // Skip pre-auth endpoints
    if (
      EXEMPT_PATHS.has(req.path) ||
      HMAC_SERVICE_PATHS.some((pattern) => pattern.test(req.path))
    ) {
      next();
      return;
    }

    // Skip when feature flag is off
    if (!this.cookieAuth.isEnabled()) {
      next();
      return;
    }

    const { csrfToken: cookieToken } = this.cookieAuth.parseCookies(req);
    const headerTokenRaw = req.headers['x-csrf-token'];
    const headerToken = Array.isArray(headerTokenRaw)
      ? headerTokenRaw[0]
      : headerTokenRaw;

    if (!cookieToken || !headerToken) {
      this.logger.warn(
        `CSRF token missing (cookie=${!!cookieToken} header=${!!headerToken}) on ${req.method} ${req.path}`,
      );
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_MISSING',
        message:
          'CSRF token missing. Include X-CSRF-Token header matching the __Host-nc_csrf cookie.',
      });
    }

    if (!this.cookieAuth.safeEquals(cookieToken, headerToken)) {
      this.logger.warn(`CSRF token mismatch on ${req.method} ${req.path}`);
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token mismatch.',
      });
    }

    next();
  }
}
