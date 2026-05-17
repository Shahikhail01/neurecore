// ─── ICacheManager.ts ────────────────────────────────────────────────────────
// SRP: All in-memory caching concerns live here.
// OCP: Different strategies (LRU, TTL, memory) are pluggable.

export interface CacheSetOptions {
  /** Time-to-live in seconds. Defaults to 300 (5 min). */
  ttl?: number;
}

export interface ICacheManager {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, options?: CacheSetOptions): void;
  del(key: string): void;
  /** Delete all entries whose key starts with prefix */
  invalidate(prefix: string): void;
  clear(): void;
  has(key: string): boolean;
}
