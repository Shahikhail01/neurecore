// ─── CacheManager.ts ─────────────────────────────────────────────────────────
// SRP: In-memory TTL cache — repositories delegate all caching here.
// OCP: New eviction strategies can be plugged in via CacheStrategies.ts.

import type { ICacheManager, CacheSetOptions } from '@/core/services/api/interfaces/ICacheManager';

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // unix ms
}

export class CacheManager implements ICacheManager {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtl = defaultTtlSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, options?: CacheSetOptions): void {
    const ttlMs = options?.ttl !== undefined ? options.ttl * 1000 : this.defaultTtl;
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /** Periodically evict expired entries to avoid unbounded memory growth. */
  startGarbageCollection(intervalMs = 60_000): () => void {
    const id = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.expiresAt) this.store.delete(key);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }
}

/** App-wide singleton cache. */
export const cacheManager = new CacheManager();
