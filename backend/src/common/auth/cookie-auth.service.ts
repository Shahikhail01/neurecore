/**
 * Cookie Auth Service — Phase 9 (Auth Hardening)
 *
 * Per `EAOS-implementation-roadmap.md` §13 + `EAOS-api-contract.md` §4.1 + §7.6
 * + `EAOS-rbac-model.md` §10 + `EAOS-frontend-data-layer.md` §4.1.
 *
 * Backend ships httpOnly + Secure + SameSite=Strict cookies as the **sole**
 * auth path for `frontend-eaos/` (no Authorization: Bearer fallback required
 * per D-023 — `frontend-tenant/` is deleted, no legacy clients to support).
 *
 * Cookie names (per D-020):
 *   - `__Host-nc_at` — access JWT (15 min)
 *   - `__Host-nc_rt` — refresh JWT (7 days)
 *   - `__Host-nc_csrf` — CSRF token (NOT httpOnly, readable by JS)
 *
 * `__Host-` prefix requires `Secure`, `Path=/`, and forbids `Domain=`.
 * This prevents subdomain cookie theft (a vuln for plain `nc_at`).
 *
 * SRP: this service only serializes cookies onto a Response and parses them
 * from a Request. It does NOT do JWT verification (that's JwtStrategy).
 * It does NOT generate tokens (that's TokenService).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';

export const ACCESS_TOKEN_COOKIE = '__Host-nc_at';
export const REFRESH_TOKEN_COOKIE = '__Host-nc_rt';
export const CSRF_COOKIE = '__Host-nc_csrf';

export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 min
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ParsedCookies {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
}

@Injectable()
export class CookieAuthService {
  private readonly isProduction: boolean;
  private readonly cookieDomain: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.isProduction =
      config.get<string>('NODE_ENV') === 'production' ||
      process.env.NODE_ENV === 'production';
    // Allow override via env. Empty/undefined = omit Domain attribute (default for __Host-).
    const domain = config.get<string>('COOKIE_DOMAIN');
    this.cookieDomain = domain && domain.length > 0 ? domain : undefined;
  }

  /** True if the httpOnly cookie auth feature flag is enabled. */
  isEnabled(): boolean {
    // Default ON in production, OFF in dev (so devs aren't locked out if their
    // browser doesn't accept __Host- cookies on http://localhost).
    // Override with USE_HTTPONLY_AUTH=true|false.
    const override = this.config.get<string>('USE_HTTPONLY_AUTH');
    if (override === 'true') return true;
    if (override === 'false') return false;
    return this.isProduction;
  }

  /**
   * Attach access + refresh + CSRF cookies to the response.
   * Called from /auth/login + /auth/refresh after a successful token issuance.
   */
  setAuthCookies(
    res: Response,
    opts: { accessToken: string; refreshToken: string; csrfToken?: string },
  ): void {
    const common = {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    };

    // NOTE: accessToken and refreshToken are httpOnly:false so the frontend
    // can read them and set the Authorization: Bearer header on API requests.
    // The __Host- prefix prevents subdomain cookie injection.
    // CSRF protection (X-CSRF-Token header) guards against CSRF on state-changing ops.
    res.cookie(ACCESS_TOKEN_COOKIE, opts.accessToken, {
      ...common,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, opts.refreshToken, {
      ...common,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    // CSRF cookie MUST be readable by JS so the SPA can echo it as a header.
    // It is a random token, not a secret — defense-in-depth vs cookie-based CSRF.
    const csrf = opts.csrfToken ?? this.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }

  /**
   * Clear all auth cookies. Called from /auth/logout.
   */
  clearAuthCookies(res: Response): void {
    const clearOpts = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'none' as const,
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    };
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearOpts);
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearOpts);

    res.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
  }

  /**
   * Parse auth cookies from an incoming request.
   */
  parseCookies(req: Request): ParsedCookies {
    // Express parses cookies into req.cookies when cookie-parser is mounted.
    // For Socket.IO + EventSource, the raw Cookie header is also accepted.
    const fromReq = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    if (fromReq) {
      return {
        accessToken: fromReq[ACCESS_TOKEN_COOKIE] ?? null,
        refreshToken: fromReq[REFRESH_TOKEN_COOKIE] ?? null,
        csrfToken: fromReq[CSRF_COOKIE] ?? null,
      };
    }
    // Fallback: parse the Cookie header manually (for raw HTTP / SSE).
    const header = req.headers?.cookie;
    if (!header) {
      return { accessToken: null, refreshToken: null, csrfToken: null };
    }
    const jar: Record<string, string> = {};
    for (const piece of header.split(';')) {
      const eq = piece.indexOf('=');
      if (eq < 0) continue;
      const name = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();
      if (name) jar[name] = decodeURIComponent(value);
    }
    return {
      accessToken: jar[ACCESS_TOKEN_COOKIE] ?? null,
      refreshToken: jar[REFRESH_TOKEN_COOKIE] ?? null,
      csrfToken: jar[CSRF_COOKIE] ?? null,
    };
  }

  /**
   * Generate a cryptographically-random CSRF token (base64url).
   */
  generateCsrfToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  /**
   * Constant-time compare of two strings. Used for CSRF validation.
   */
  safeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}