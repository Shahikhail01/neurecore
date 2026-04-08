/**
 * Data Cache Service
 * Client-side caching layer for API responses and collection data
 * Pattern adapted from NocoBase's useRequest caching via service registry
 */

"use client";

import { useCallback, useRef, useMemo } from "react";

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheConfig {
  maxSize?: number; // Maximum number of entries
  defaultTTL?: number; // Default time-to-live in ms
  persistKeys?: string[]; // Keys to persist to localStorage
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Cache key generator
 */
export function generateCacheKey(namespace: string, ...args: any[]): string {
  const key = [
    namespace,
    ...args.map((arg) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg);
      }
      return String(arg);
    }),
  ].join(":");

  return key;
}

/**
 * Data cache service
 */
export class DataCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats = { hits: 0, misses: 0 };
  private config: Required<CacheConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 500,
      defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5 minutes
      persistKeys: config.persistKeys || [],
    };

    // Start cleanup interval
    this.startCleanup();

    // Load persisted cache from localStorage
    this.loadPersistedCache();
  }

  /**
   * Get cached value
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.data as T;
  }

  /**
   * Set cached value
   */
  set<T = any>(key: string, data: T, ttl?: number): void {
    // Check size before adding
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      // Remove least recently accessed item
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.config.defaultTTL,
      hits: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);

    // Persist if key is in persistKeys
    if (this.config.persistKeys.includes(key)) {
      this.persistKey(key, entry);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Start cleanup interval for expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Persist cache entry to localStorage
   */
  private persistKey(key: string, entry: CacheEntry): void {
    try {
      const serialized = JSON.stringify({
        data: entry.data,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
      });
      localStorage.setItem(`cache:${key}`, serialized);
    } catch (error) {
      console.error("Failed to persist cache:", error);
    }
  }

  /**
   * Load persisted cache from localStorage
   */
  private loadPersistedCache(): void {
    for (const persistKey of this.config.persistKeys) {
      try {
        const stored = localStorage.getItem(`cache:${persistKey}`);
        if (stored) {
          const { data, expiresAt } = JSON.parse(stored);
          // Check if not expired
          if (!expiresAt || expiresAt > Date.now()) {
            this.cache.set(persistKey, {
              data,
              timestamp: Date.now(),
              expiresAt,
              hits: 0,
              lastAccessed: Date.now(),
            });
          } else {
            localStorage.removeItem(`cache:${persistKey}`);
          }
        }
      } catch (error) {
        console.error("Failed to load persisted cache:", error);
      }
    }
  }

  /**
   * Export cache state
   */
  export(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, entry] of this.cache.entries()) {
      result[key] = entry.data;
    }
    return result;
  }

  /**
   * Import cache state
   */
  import(data: Record<string, any>): void {
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }
}

// Global cache instance
let globalCache: DataCache;

/**
 * Get or create global cache instance
 */
export function getGlobalCache(config?: CacheConfig): DataCache {
  if (!globalCache) {
    globalCache = new DataCache(config);
  }
  return globalCache;
}

/**
 * React hook for using cache
 */
export function useDataCache(config?: CacheConfig) {
  const cache = useMemo(() => {
    return getGlobalCache(config);
  }, [config]);

  const get = useCallback(
    <T = any>(key: string): T | null => {
      return cache.get<T>(key);
    },
    [cache],
  );

  const set = useCallback(
    <T = any>(key: string, data: T, ttl?: number): void => {
      cache.set(key, data, ttl);
    },
    [cache],
  );

  const has = useCallback(
    (key: string): boolean => {
      return cache.has(key);
    },
    [cache],
  );

  const del = useCallback(
    (key: string): void => {
      cache.delete(key);
    },
    [cache],
  );

  const clear = useCallback((): void => {
    cache.clear();
  }, [cache]);

  const stats = useCallback((): CacheStats => {
    return cache.getStats();
  }, [cache]);

  return {
    get,
    set,
    has,
    delete: del,
    clear,
    getStats: stats,
  };
}

export default DataCache;
