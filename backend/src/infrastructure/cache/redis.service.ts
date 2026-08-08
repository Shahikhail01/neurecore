import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
// @upstash/redis is an optional dependency. The class is loaded dynamically
// so projects without the package can still build.
type UpstashRedisClass = new (opts: { url: string; token: string }) => unknown;
let UpstashRedis: UpstashRedisClass | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  UpstashRedis = require('@upstash/redis').Redis;
} catch (e) {
  UpstashRedis = null;
}

// Single Responsibility: manages Redis connection and common operations.
// Optimized for Upstash Redis compatibility
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  // If using Upstash REST client, this will hold the client instance
  // use `any` to avoid complex typing for the dynamically-required client
  private upstashClient: any = null;
  private isConnected = false;

  // PERF-FIX: in-process LRU cache for token-blacklist checks.
  // On Contabo (DE) → Upstash (US) the network round-trip alone is
  // ~150-300ms. JwtStrategy.validate() runs on EVERY authenticated
  // request, so caching the "not blacklisted" verdict for 30s collapses
  // dozens of round-trips per page load into one.
  // Positive verdicts (blacklisted) are also cached, with a shorter TTL
  // matching the remaining token lifetime so we don't accidentally
  // resurrect a revoked token after the TTL.
  private readonly blacklistCache = new LRUCache<string, boolean>({
    max: 50_000,
    ttl: 30_000, // 30s for the "not blacklisted" verdict
  });

  // Part 9 N11 — log dedupe: when Redis is down, the methods below would
  // log a warning on every request (hundreds per second under load).
  // We track which messages we've already fired in this Redis-down
  // window so the operator gets one clean notice instead of a flood.
  // Set is cleared whenever isConnected flips back to true.
  private readonly warnedKeys = new Set<string>();

  private warnOnce(key: string, message: string): void {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    this.logger.warn(message);
  }

  constructor(private readonly config?: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config
      ? this.config.get<string>('REDIS_URL', 'redis://localhost:6379/0')
      : process.env.REDIS_URL || 'redis://localhost:6379/0';

    const upstashRestUrl = this.config
      ? this.config.get<string | undefined>('UPSTASH_REDIS_REST_URL')
      : process.env.UPSTASH_REDIS_REST_URL;
    const upstashRestToken = this.config
      ? this.config.get<string | undefined>('UPSTASH_REDIS_REST_TOKEN')
      : process.env.UPSTASH_REDIS_REST_TOKEN;

    // Check if using Upstash (either via REDIS_URL or REST integration)
    const isUpstash =
      Boolean(upstashRestUrl && upstashRestToken) ||
      redisUrl.includes('upstash.io');

    const options: any = {
      // Upstash-specific configuration
      maxRetriesPerRequest: isUpstash ? 3 : 1,
      retryStrategy: (times: number) => {
        if (times > 2) return null; // Stop retrying after 2 attempts
        const delay = isUpstash
          ? Math.min(times * 200, 2000)
          : Math.min(times * 50, 500);
        this.logger.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      lazyConnect: false,
      // Fast timeouts for local Redis; slightly longer for Upstash
      connectTimeout: isUpstash ? 3000 : 1000,
      commandTimeout: isUpstash ? 2000 : 500,
      // Disable some commands that Upstash doesn't support well
      skipCommandSet: isUpstash
        ? ['CLIENT', 'CLUSTER', 'DEBUG', 'SLOWLOG', 'MEMORY']
        : [],
    };

    // Prefer Upstash REST client in serverless (Vercel) environments when provided
    if (upstashRestUrl && upstashRestToken && UpstashRedis) {
      this.logger.log('Using Upstash REST client for Redis');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.upstashClient = new UpstashRedis({
        url: upstashRestUrl,
        token: upstashRestToken,
      });
      // The Upstash REST client doesn't maintain persistent connections like ioredis.
      // We deliberately leave isConnected = false here and probe lazily on first
      // call — otherwise a stale Upstash project (DNS ENOTFOUND, project deleted)
      // would block every request for the full undici fetch timeout (~4.5s)
      // and surface as INTERNAL_ERROR. (See 2026-08-08 Contabo incident.)
      this.isConnected = false;
      // Best-effort startup probe so the first request doesn't pay the
      // probe cost; failures are logged and we degrade silently.
      void this.probeUpstash().then((ok) => {
        if (ok) {
          this.logger.log('Upstash REST client probe OK');
          this.isConnected = true;
        } else {
          this.logger.warn(
            'Upstash REST client probe FAILED at startup — Redis calls will degrade until backend recovers',
          );
        }
      });
      return;
    }

    // Fallback to ioredis for normal Redis URL (including Upstash TCP URL)
    this.client = new Redis(redisUrl, options);

    this.client.on('connect', () => {
      this.isConnected = true;
      // N11 — re-emit warnings on the next disconnect.
      this.warnedKeys.clear();
      this.logger.log('Redis connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.warnedKeys.clear();
      this.logger.log('Redis ready');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error('Redis error', err);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.log('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  onModuleDestroy(): void {
    try {
      if (
        this.upstashClient &&
        typeof this.upstashClient.disconnect === 'function'
      ) {
        this.upstashClient.disconnect();
      }
    } catch {
      /* ignore teardown errors */
    }
    try {
      if (this.client) this.client.quit();
    } catch {
      /* ignore teardown errors */
    }
  }

  // Track whether the Upstash REST backend has been verified reachable.
  // On Contabo (2026-08-08) the configured Upstash project returned
  // ENOTFOUND; the REST client had previously optimistically set
  // `isConnected = true` on construction, so every Redis call (login
  // lockout, rate-limit buckets, JWT blacklist) blocked for ~4.5s on an
  // undici fetch timeout and surfaced as INTERNAL_ERROR to the user.
  // We now: (a) probe the REST endpoint once at startup, (b) re-probe on
  // failure, (c) route every operation through a guarded helper that
  // throws a known sentinel that callers already catch-and-continue.
  private upstashHealthy = false;
  private upstashProbeInFlight: Promise<boolean> | null = null;
  private upstashProbeAt = 0;
  private static readonly PROBE_COOLDOWN_MS = 30_000; // 30s between probes

  /**
   * Probe the Upstash REST endpoint.  Cooldown-gated so the request path
   * never pays the undici fetch timeout (~4.5s per call) more than once.
   * After a failed probe we defer 30s; during the cooldown window every
   * `withUpstash()` guard returns immediately without blocking.
   */
  private async probeUpstash(): Promise<boolean> {
    if (this.upstashProbeInFlight) return this.upstashProbeInFlight;

    // If we already know it's unhealthy AND we probed recently, skip.
    if (
      !this.upstashHealthy &&
      this.upstashProbeAt > 0 &&
      Date.now() - this.upstashProbeAt < RedisService.PROBE_COOLDOWN_MS
    ) {
      return false;
    }

    this.upstashProbeAt = Date.now();
    this.upstashProbeInFlight = (async () => {
      try {
        const r = await this.upstashClient.get('__nc_healthcheck__');
        this.upstashHealthy = r !== undefined;
        if (this.upstashHealthy) this.logger.log('Upstash REST probe OK');
        return this.upstashHealthy;
      } catch (err) {
        this.logger.warn(
          `Upstash REST probe failed (cooldown ${RedisService.PROBE_COOLDOWN_MS / 1000}s): ${String(err)}`,
        );
        this.upstashHealthy = false;
        return false;
      } finally {
        this.upstashProbeInFlight = null;
      }
    })();
    return this.upstashProbeInFlight;
  }

  /**
   * Run an Upstash REST call behind a health guard. If the backend is
   * currently unreachable, surface the typed `UpstashUnavailableError`
   * synchronously so callers can fall back without paying the undici
   * fetch timeout (~4.5s) per call.
   */
  private async withUpstash<T>(op: () => Promise<T>): Promise<T> {
    if (!this.upstashHealthy) {
      const ok = await this.probeUpstash();
      if (!ok) throw new UpstashUnavailableError();
    }
    try {
      const result = await op();
      this.upstashHealthy = true;
      return result;
    } catch (err) {
      this.upstashHealthy = false;
      throw err;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.upstashClient) {
      try {
        await this.withUpstash(() =>
          ttlSeconds
            ? this.upstashClient.set(key, value, { ex: ttlSeconds })
            : this.upstashClient.set(key, value),
        );
        return;
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return;
        this.logger.warn(`Upstash set failed, dropping write: ${String(err)}`);
        return;
      }
    }
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.upstashClient) {
      try {
        const res = await this.withUpstash(() => this.upstashClient.get(key));
        return (res as string | null) ?? null;
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return null;
        this.logger.warn(`Upstash get failed, returning null: ${String(err)}`);
        return null;
      }
    }
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    if (this.upstashClient) {
      try {
        await this.withUpstash(() => this.upstashClient.del(key));
        return;
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return;
        this.logger.warn(`Upstash del failed, dropping: ${String(err)}`);
        return;
      }
    }
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.upstashClient) {
      try {
        const v = await this.withUpstash(() => this.upstashClient.get(key));
        return v !== null && v !== undefined;
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return false;
        this.logger.warn(
          `Upstash exists failed, returning false: ${String(err)}`,
        );
        return false;
      }
    }
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Atomically increment a counter, returning the new value.
   * Used for sliding-window rate limiting (Phase 5 AI Action guard).
   */
  async incr(key: string): Promise<number> {
    if (this.upstashClient) {
      try {
        const res = await this.withUpstash(() => this.upstashClient.incr(key));
        return Number(res ?? 0);
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return 0;
        this.logger.warn(`Upstash incr failed, returning 0: ${String(err)}`);
        return 0;
      }
    }
    const res = await this.client.incr(key);
    return Number(res ?? 0);
  }

  /**
   * Set a TTL on an existing key. No-op if the key doesn't exist.
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.upstashClient) {
      try {
        await this.withUpstash(() => this.upstashClient.expire(key, ttlSeconds));
        return;
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return;
        this.logger.warn(`Upstash expire failed, dropping: ${String(err)}`);
        return;
      }
    }
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * SCAN-based key discovery. Cursor-based, non-blocking — safe for
   * large multi-tenant keyspaces. Returns up to `count` keys per call
   * and a cursor the caller must pass back. When `cursor === '0'` the
   * iteration is complete.
   *
   * Upstash REST has no SCAN, so we degrade to a single KEYS call.
   * Acceptable because Upstash Redis keyspaces are typically small and
   * this is only used by background sweep jobs.
   */
  async scan(
    cursor: string,
    match: string,
    count: number,
  ): Promise<[string, string[]]> {
    if (this.upstashClient) {
      try {
        const keys = await this.withUpstash(() => this.upstashClient.keys(match));
        return ['0', (keys as string[] | undefined) ?? []];
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return ['0', []];
        this.logger.warn(`Upstash scan failed, returning empty: ${String(err)}`);
        return ['0', []];
      }
    }
    const result = (await this.client.scan(
      cursor,
      'MATCH',
      match,
      'COUNT',
      count,
    )) as [string, string[]];
    return result;
  }

  /**
   * KEYS-based lookup. WARNING: blocks Redis O(N). Use `scan()` instead
   * for production code paths. Provided for small/test keyspaces only.
   */
  async keys(pattern: string): Promise<string[]> {
    if (this.upstashClient) {
      try {
        const keys = await this.withUpstash(() => this.upstashClient.keys(pattern));
        return (keys as string[] | undefined) ?? [];
      } catch (err) {
        if (err instanceof UpstashUnavailableError) return [];
        this.logger.warn(`Upstash keys failed, returning []: ${String(err)}`);
        return [];
      }
    }
    return this.client.keys(pattern);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // Blacklist a JWT token (for logout/revocation)
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) {
      // N11 — single warning per Redis-down window, not per call.
      this.warnOnce(
        'redis.blacklistToken.down',
        'Redis not connected, skipping token blacklist (further warnings suppressed until Redis reconnects)',
      );
      return;
    }
    try {
      await this.set(`bl:${jti}`, '1', ttlSeconds);
      // PERF-FIX: also poison the local cache so in-flight requests for
      // this same JTI get the blacklisted verdict immediately without
      // racing the Redis write.
      this.blacklistCache.set(`bl:${jti}`, true, { ttl: ttlSeconds * 1000 });
    } catch (err) {
      this.logger.warn(`Failed to blacklist token: ${String(err)}`);
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const cacheKey = `bl:${jti}`;
    // PERF-FIX: short-circuit on the local LRU before paying the remote
    // round-trip. Cache entries auto-expire after 30s for "not
    // blacklisted" verdicts, so a revoke that happens after a token has
    // been seen will take effect within at most 30s — acceptable for
    // logout-revocation (Next refresh will re-check).
    const cached = this.blacklistCache.get(cacheKey);
    if (cached !== undefined) return cached;

    if (!this.isConnected) {
      this.warnOnce(
        'redis.isBlacklisted.down',
        'Redis not connected, failing open for token check (further warnings suppressed until Redis reconnects)',
      );
      // Fail-open + cache the verdict so we don't keep warning.
      this.blacklistCache.set(cacheKey, false);
      return false;
    }
    try {
      const isBl = await this.exists(cacheKey);
      this.blacklistCache.set(cacheKey, isBl);
      return isBl;
    } catch (err) {
      this.warnOnce(
        `redis.isBlacklisted.error.${(err as Error).message.slice(0, 80)}`,
        `Redis unavailable when checking token blacklist: ${String(err)} (further warnings of this type suppressed)`,
      );
      // Fail-open: cache the negative verdict for 30s so subsequent
      // requests don't hammer a downed Redis.
      this.blacklistCache.set(cacheKey, false);
      return false;
    }
  }
}

/**
 * Sentinel error raised when the Upstash REST backend has been
 * probed and is currently unreachable. Callers in the request path
 * (lockout, rate-limit, audit, presence) catch this and degrade
 * gracefully — never let it surface as an INTERNAL_ERROR to the user.
 */
export class UpstashUnavailableError extends Error {
  constructor() {
    super('Upstash Redis REST backend is unavailable');
    this.name = 'UpstashUnavailableError';
  }
}
