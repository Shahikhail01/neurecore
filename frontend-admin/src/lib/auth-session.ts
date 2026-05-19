export const AUTH_STORAGE_KEYS = {
  accessToken: 'admin_accessToken',
  refreshToken: 'admin_refreshToken',
  user: 'user',
} as const;

export const AUTH_SESSION_CLEARED_EVENT = 'admin-auth-session-cleared';

const LEGACY_ACCESS_TOKEN_KEYS = ['auth_token', 'accessToken'];
const LEGACY_REFRESH_TOKEN_KEYS = ['refreshToken'];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function getFirstStoredValue(keys: readonly string[]): string | null {
  if (!isBrowser()) {
    return null;
  }

  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) {
      return value;
    }
  }

  return null;
}

function removeStoredKeys(keys: readonly string[]) {
  if (!isBrowser()) {
    return;
  }

  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

function dispatchAuthSessionCleared() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
}

export function getStoredAccessToken(): string | null {
  return getFirstStoredValue([
    AUTH_STORAGE_KEYS.accessToken,
    ...LEGACY_ACCESS_TOKEN_KEYS,
  ]);
}

export function getStoredRefreshToken(): string | null {
  return getFirstStoredValue([
    AUTH_STORAGE_KEYS.refreshToken,
    ...LEGACY_REFRESH_TOKEN_KEYS,
  ]);
}

export function setStoredAccessToken(token: string | null) {
  if (!isBrowser()) {
    return;
  }

  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, token);
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  }

  removeStoredKeys(LEGACY_ACCESS_TOKEN_KEYS);
}

export function setStoredRefreshToken(token: string | null) {
  if (!isBrowser()) {
    return;
  }

  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, token);
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  }

  removeStoredKeys(LEGACY_REFRESH_TOKEN_KEYS);
}

export function setStoredAuthUser(user: unknown | null) {
  if (!isBrowser()) {
    return;
  }

  if (user == null) {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearStoredAuthSession(options: { includeUser?: boolean } = {}) {
  const { includeUser = false } = options;

  setStoredAccessToken(null);
  setStoredRefreshToken(null);

  if (includeUser && isBrowser()) {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
  }

  dispatchAuthSessionCleared();
}

export function setStoredAuthSession(session: {
  accessToken: string;
  refreshToken?: string | null;
  user?: unknown;
}) {
  setStoredAccessToken(session.accessToken);

  if ('refreshToken' in session) {
    setStoredRefreshToken(session.refreshToken ?? null);
  }

  if ('user' in session) {
    setStoredAuthUser(session.user ?? null);
  }
}

export function extractAuthSessionPayload(payload: any): {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: unknown;
} | null {
  const candidates = [payload?.data?.data, payload?.data, payload];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    if (candidate.tokens?.accessToken) {
      return {
        accessToken: candidate.tokens.accessToken,
        refreshToken: candidate.tokens.refreshToken,
        expiresIn: candidate.tokens.expiresIn,
        user: candidate.user,
      };
    }

    if (candidate.accessToken) {
      return {
        accessToken: candidate.accessToken,
        refreshToken: candidate.refreshToken,
        expiresIn: candidate.expiresIn,
        user: candidate.user,
      };
    }
  }

  return null;
}