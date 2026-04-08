/**
 * Secret Provider Service
 *
 * SOLID: Single Responsibility — ONLY provides secret access
 * SOLID: Open/Closed — Add new secret types via configuration
 * SOLID: Dependency Inversion — Uses ConfigService via DI
 *
 * This service provides a centralized, auditable interface for secret access.
 * All modules should use this service instead of directly accessing ConfigService
 * for secret values.
 *
 * @module security/providers
 */

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ISecretProvider,
  ISecretResult,
  ISecretAuditLogger,
  ISecretAuditEvent,
} from '../interfaces/secret.interfaces';
import { WellKnownSecret } from '../interfaces/secret.interfaces';

/**
 * Cache entry for resolved secrets
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Mapping of well-known secrets to environment variable names
 */
const SECRET_ENV_MAPPING: Record<WellKnownSecret, string> = {
  [WellKnownSecret.OPENCLAW_API_KEY]: 'OPENCLAW_API_KEY',
  [WellKnownSecret.JWT_SECRET]: 'JWT_SECRET',
  [WellKnownSecret.OPENAI_API_KEY]: 'OPENAI_API_KEY',
  [WellKnownSecret.MINIMAX_API_KEY]: 'MINIMAX_API_KEY',
  [WellKnownSecret.DEEPSEEK_API_KEY]: 'DEEPSEEK_API_KEY',
  [WellKnownSecret.MIMO_API_KEY]: 'MIMO_API_KEY',
  [WellKnownSecret.DATABASE_URL]: 'DATABASE_URL',
  [WellKnownSecret.REDIS_URL]: 'REDIS_URL',
};

@Injectable()
export class SecretProviderService implements ISecretProvider {
  private readonly logger = new Logger(SecretProviderService.name);

  /**
   * In-memory cache for resolved secrets
   * TTL prevents stale values and supports rotation
   */
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  private readonly CACHE_TTL_MS: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject('AUDIT_LOGGER')
    private readonly auditLogger?: ISecretAuditLogger,
  ) {
    // Allow TTL to be configured via environment
    this.CACHE_TTL_MS = this.configService.get<number>(
      'security.secrets.cacheTtlMs',
      5 * 60 * 1000,
    );

    this.logger.log(
      `SecretProviderService initialized with cache TTL: ${this.CACHE_TTL_MS}ms`,
    );
  }

  /**
   * Resolve a secret reference
   *
   * Supported formats:
   * - `env:VARIABLE_NAME` - Environment variable
   * - `vault:path/to/secret` - Vault path (future)
   * - `static:value` - Static value (for defaults only)
   * - Direct variable name - Treated as env:VARIABLE_NAME
   */
  resolve(ref: string): ISecretResult {
    // Check cache first
    const cached = this.cache.get(ref);
    if (cached && cached.expiresAt > Date.now()) {
      this.logAuditEvent({
        action: 'CACHE_HIT',
        secretName: ref,
        success: true,
      });
      return { ...cached, source: 'cache' };
    }

    this.logAuditEvent({
      action: 'CACHE_MISS',
      secretName: ref,
      success: true,
    });

    let value: string;
    let source: 'env' | 'vault' = 'env';

    try {
      if (ref.startsWith('env:')) {
        // Environment variable reference
        const envVar = ref.substring(4);
        value = this.getEnvVariable(envVar);
        source = 'env';
      } else if (ref.startsWith('vault:')) {
        // Vault reference (future implementation)
        this.logger.warn(
          `Vault secrets not yet implemented, falling back to env for: ${ref}`,
        );
        const envVar = ref.substring(6);
        value = this.getEnvVariable(envVar);
        source = 'vault'; // Mark as vault for future reference
      } else if (ref.startsWith('static:')) {
        // Static value (use sparingly - only for defaults)
        this.logger.warn(
          `Static secret used: ${ref} - consider using env instead`,
        );
        value = ref.substring(7);
      } else {
        // Treat as environment variable
        value = this.getEnvVariable(ref);
        source = 'env';
      }
    } catch (error) {
      this.logAuditEvent({
        action: 'ACCESS',
        secretName: ref,
        source,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Cache the result
    this.cache.set(ref, {
      value,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    this.logAuditEvent({
      action: 'ACCESS',
      secretName: ref,
      source,
      success: true,
    });

    return { value, source, expiresAt: Date.now() + this.CACHE_TTL_MS };
  }

  /**
   * Get environment variable with fallback to process.env
   * @throws Error if environment variable is not found
   */
  private getEnvVariable(name: string): string {
    // Try ConfigService first (handles .env files)
    const configValue = this.configService.get<string>(name);
    if (configValue) {
      return configValue;
    }

    // Fall back to process.env
    const envValue = process.env[name];
    if (envValue) {
      return envValue;
    }

    // Throw error for missing critical secrets
    const criticalSecrets = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
    if (criticalSecrets.includes(name)) {
      const error = new Error(
        `CRITICAL: Required secret "${name}" is not defined in environment variables. ` +
          `Please set ${name} before starting the application.`,
      );
      this.logger.error(error.message);
      throw error;
    }

    // Log warning for non-critical secrets and return empty string
    this.logger.warn(`Non-critical secret not found in environment: ${name}`);
    return '';
  }

  /**
   * Invalidate cache for a specific secret
   */
  invalidate(ref: string): void {
    this.cache.delete(ref);
    this.logger.debug(`Cache invalidated for: ${ref}`);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Secret cache cleared');
  }

  // ─────────────────────────────────────────────────────────────
  // Well-known secret accessors
  // ─────────────────────────────────────────────────────────────

  getOpenClawApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.OPENCLAW_API_KEY]}`,
    ).value;
  }

  getJwtSecret(): string {
    return this.resolve(`env:${SECRET_ENV_MAPPING[WellKnownSecret.JWT_SECRET]}`)
      .value;
  }

  getOpenAiApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.OPENAI_API_KEY]}`,
    ).value;
  }

  getMiniMaxApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.MINIMAX_API_KEY]}`,
    ).value;
  }

  getDeepSeekApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.DEEPSEEK_API_KEY]}`,
    ).value;
  }

  getMimoApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.MIMO_API_KEY]}`,
    ).value;
  }

  getDatabaseUrl(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.DATABASE_URL]}`,
    ).value;
  }

  getRedisUrl(): string {
    return this.resolve(`env:${SECRET_ENV_MAPPING[WellKnownSecret.REDIS_URL]}`)
      .value;
  }

  /**
   * Check if a secret exists (non-empty)
   */
  has(ref: string): boolean {
    const result = this.resolve(ref);
    return result.value.length > 0;
  }

  /**
   * Get all cached secret names (for debugging)
   */
  getCachedSecrets(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Log audit event if audit logger is configured
   */
  private logAuditEvent(event: Omit<ISecretAuditEvent, 'timestamp'>): void {
    if (this.auditLogger) {
      try {
        this.auditLogger.log({
          ...event,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to log secret audit event', error);
      }
    }
  }
}
