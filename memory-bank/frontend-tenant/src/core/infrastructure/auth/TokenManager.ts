// ─── TokenManager.ts ─────────────────────────────────────────────────────────
// SRP: Single class owns all token lifecycle operations.
// DIP: Depends on StorageManager abstraction, not localStorage directly.

import type { ITokenManager } from '@/core/services/api/interfaces/ITokenManager';

const ACCESS_KEY = 'hq_access_token';
const REFRESH_KEY = 'hq_refresh_token';

/** Decode the `exp` claim from a JWT without verifying the signature. */
function decodeExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

export class TokenManager implements ITokenManager {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  isTokenExpired(token: string): boolean {
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= exp * 1000;
  }

  /** Returns true when < 60 s remain before the access token expires. */
  shouldRefresh(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= (exp - 60) * 1000;
  }
}

/** Singleton — share across the app. */
export const tokenManager = new TokenManager();
