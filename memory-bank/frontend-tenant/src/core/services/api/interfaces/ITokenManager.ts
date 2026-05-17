// ─── ITokenManager.ts ────────────────────────────────────────────────────────
// SRP: Single class owns token lifecycle (read / write / refresh / clear).
// DIP: Infrastructure depends on this interface, not localStorage directly.

export interface ITokenManager {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
  isTokenExpired(token: string): boolean;
  shouldRefresh(): boolean;
}
