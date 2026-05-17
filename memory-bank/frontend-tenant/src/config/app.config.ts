/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Frontend Configuration - Tenant Application
 * ═══════════════════════════════════════════════════════════════════════════
 * Type-safe environment configuration for the Tenant frontend.
 * Supports Vercel environment variables and client-side configuration.
 */

/**
 * Tenant Environment Configuration Interface
 */
export interface TenantEnvConfig {
  // Application
  NODE_ENV: "development" | "production" | "test";

  // API Configuration
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_API_TIMEOUT: number;

  // Frontend URLs
  NEXT_PUBLIC_TENANT_URL: string;
  NEXT_PUBLIC_ADMIN_URL: string;

  // App Info
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_APP_VERSION: string;

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: boolean;
  NEXT_PUBLIC_ENABLE_DEBUG: boolean;
  NEXT_PUBLIC_ENABLE_MAINTENANCE: boolean;
  NEXT_PUBLIC_ENABLE_VOICE_COMMANDS: boolean;
  NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION: boolean;

  // UI Configuration
  NEXT_PUBLIC_DEFAULT_THEME: "light" | "dark" | "system";
  NEXT_PUBLIC_ENABLE_ANIMATIONS: boolean;
  NEXT_PUBLIC_ENABLE_SOUND: boolean;
  NEXT_PUBLIC_DEFAULT_LANGUAGE: string;
  NEXT_PUBLIC_SUPPORTED_LANGUAGES: string;

  // Third-party Services
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;

  // WebSocket
  NEXT_PUBLIC_WS_URL: string;

  // Storage
  NEXT_PUBLIC_STORAGE_PROVIDER: "local" | "s3" | "gcs";
  NEXT_PUBLIC_S3_BUCKET?: string;

  // Tenant-specific
  NEXT_PUBLIC_ALLOW_SIGNUP: boolean;
  NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION: boolean;
  NEXT_PUBLIC_DEFAULT_TIER: string;
}

/**
 * Default configuration values
 */
const defaultConfig: TenantEnvConfig = {
  NODE_ENV: "development",
  NEXT_PUBLIC_API_URL: "http://localhost:3000/api/v1",
  NEXT_PUBLIC_API_TIMEOUT: 30000,
  NEXT_PUBLIC_TENANT_URL: "http://localhost:3001",
  NEXT_PUBLIC_ADMIN_URL: "http://localhost:3002",
  NEXT_PUBLIC_APP_NAME: "NeureCore",
  NEXT_PUBLIC_APP_VERSION: "1.0.0",
  NEXT_PUBLIC_ENABLE_ANALYTICS: true,
  NEXT_PUBLIC_ENABLE_DEBUG: false,
  NEXT_PUBLIC_ENABLE_MAINTENANCE: false,
  NEXT_PUBLIC_ENABLE_VOICE_COMMANDS: false,
  NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION: false,
  NEXT_PUBLIC_DEFAULT_THEME: "system",
  NEXT_PUBLIC_ENABLE_ANIMATIONS: true,
  NEXT_PUBLIC_ENABLE_SOUND: false,
  NEXT_PUBLIC_DEFAULT_LANGUAGE: "en",
  NEXT_PUBLIC_SUPPORTED_LANGUAGES: "en,es,fr,de,zh",
  NEXT_PUBLIC_SENTRY_DSN: undefined,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: undefined,
  NEXT_PUBLIC_WS_URL: "ws://localhost:3000",
  NEXT_PUBLIC_STORAGE_PROVIDER: "local",
  NEXT_PUBLIC_S3_BUCKET: undefined,
  NEXT_PUBLIC_ALLOW_SIGNUP: true,
  NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION: true,
  NEXT_PUBLIC_DEFAULT_TIER: "free",
};

/**
 * Parse boolean environment variable
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  return value === "true";
}

/**
 * Parse string environment variable
 */
function parseString(value: string | undefined, defaultValue: string): string {
  return value ?? defaultValue;
}

/**
 * Parse number environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configuration singleton for Tenant application
 */
class TenantConfig {
  private static instance: TenantConfig;
  private config: TenantEnvConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantConfig {
    if (!TenantConfig.instance) {
      TenantConfig.instance = new TenantConfig();
    }
    return TenantConfig.instance;
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): TenantEnvConfig {
    return {
      NODE_ENV:
        (process.env.NODE_ENV as TenantEnvConfig["NODE_ENV"]) ||
        defaultConfig.NODE_ENV,
      NEXT_PUBLIC_API_URL: parseString(
        process.env.NEXT_PUBLIC_API_URL,
        defaultConfig.NEXT_PUBLIC_API_URL,
      ),
      NEXT_PUBLIC_API_TIMEOUT: parseNumber(
        process.env.NEXT_PUBLIC_API_TIMEOUT,
        defaultConfig.NEXT_PUBLIC_API_TIMEOUT,
      ),
      NEXT_PUBLIC_TENANT_URL: parseString(
        process.env.NEXT_PUBLIC_TENANT_URL,
        defaultConfig.NEXT_PUBLIC_TENANT_URL,
      ),
      NEXT_PUBLIC_ADMIN_URL: parseString(
        process.env.NEXT_PUBLIC_ADMIN_URL,
        defaultConfig.NEXT_PUBLIC_ADMIN_URL,
      ),
      NEXT_PUBLIC_APP_NAME: parseString(
        process.env.NEXT_PUBLIC_APP_NAME,
        defaultConfig.NEXT_PUBLIC_APP_NAME,
      ),
      NEXT_PUBLIC_APP_VERSION: parseString(
        process.env.NEXT_PUBLIC_APP_VERSION,
        defaultConfig.NEXT_PUBLIC_APP_VERSION,
      ),
      NEXT_PUBLIC_ENABLE_ANALYTICS: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
        defaultConfig.NEXT_PUBLIC_ENABLE_ANALYTICS,
      ),
      NEXT_PUBLIC_ENABLE_DEBUG: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_DEBUG,
        defaultConfig.NEXT_PUBLIC_ENABLE_DEBUG,
      ),
      NEXT_PUBLIC_ENABLE_MAINTENANCE: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_MAINTENANCE,
        defaultConfig.NEXT_PUBLIC_ENABLE_MAINTENANCE,
      ),
      NEXT_PUBLIC_ENABLE_VOICE_COMMANDS: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_VOICE_COMMANDS,
        defaultConfig.NEXT_PUBLIC_ENABLE_VOICE_COMMANDS,
      ),
      NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION,
        defaultConfig.NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION,
      ),
      NEXT_PUBLIC_DEFAULT_THEME:
        (process.env
          .NEXT_PUBLIC_DEFAULT_THEME as TenantEnvConfig["NEXT_PUBLIC_DEFAULT_THEME"]) ||
        defaultConfig.NEXT_PUBLIC_DEFAULT_THEME,
      NEXT_PUBLIC_ENABLE_ANIMATIONS: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_ANIMATIONS,
        defaultConfig.NEXT_PUBLIC_ENABLE_ANIMATIONS,
      ),
      NEXT_PUBLIC_ENABLE_SOUND: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_SOUND,
        defaultConfig.NEXT_PUBLIC_ENABLE_SOUND,
      ),
      NEXT_PUBLIC_DEFAULT_LANGUAGE: parseString(
        process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE,
        defaultConfig.NEXT_PUBLIC_DEFAULT_LANGUAGE,
      ),
      NEXT_PUBLIC_SUPPORTED_LANGUAGES: parseString(
        process.env.NEXT_PUBLIC_SUPPORTED_LANGUAGES,
        defaultConfig.NEXT_PUBLIC_SUPPORTED_LANGUAGES,
      ),
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_ENVIRONMENT:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      NEXT_PUBLIC_WS_URL: parseString(
        process.env.NEXT_PUBLIC_WS_URL,
        defaultConfig.NEXT_PUBLIC_WS_URL,
      ),
      NEXT_PUBLIC_STORAGE_PROVIDER:
        (process.env
          .NEXT_PUBLIC_STORAGE_PROVIDER as TenantEnvConfig["NEXT_PUBLIC_STORAGE_PROVIDER"]) ||
        defaultConfig.NEXT_PUBLIC_STORAGE_PROVIDER,
      NEXT_PUBLIC_S3_BUCKET: process.env.NEXT_PUBLIC_S3_BUCKET,
      NEXT_PUBLIC_ALLOW_SIGNUP: parseBoolean(
        process.env.NEXT_PUBLIC_ALLOW_SIGNUP,
        defaultConfig.NEXT_PUBLIC_ALLOW_SIGNUP,
      ),
      NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION: parseBoolean(
        process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION,
        defaultConfig.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION,
      ),
      NEXT_PUBLIC_DEFAULT_TIER: parseString(
        process.env.NEXT_PUBLIC_DEFAULT_TIER,
        defaultConfig.NEXT_PUBLIC_DEFAULT_TIER,
      ),
    };
  }

  /**
   * Get configuration value
   */
  get<K extends keyof TenantEnvConfig>(key: K): TenantEnvConfig[K] {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): TenantEnvConfig {
    return this.config;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === "production";
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.config.NODE_ENV === "test";
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.config.NEXT_PUBLIC_API_URL;
  }

  /**
   * Get WebSocket URL
   */
  getWsUrl(): string {
    return this.config.NEXT_PUBLIC_WS_URL;
  }

  /**
   * Check if analytics is enabled
   */
  isAnalyticsEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_ANALYTICS;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_DEBUG;
  }

  /**
   * Check if maintenance mode is enabled
   */
  isMaintenanceModeEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_MAINTENANCE;
  }

  /**
   * Check if voice commands are enabled
   */
  isVoiceCommandsEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_VOICE_COMMANDS;
  }

  /**
   * Check if workflow automation is enabled
   */
  isWorkflowAutomationEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION;
  }

  /**
   * Check if signup is allowed
   */
  isSignupAllowed(): boolean {
    return this.config.NEXT_PUBLIC_ALLOW_SIGNUP;
  }

  /**
   * Check if email verification is required
   */
  isEmailVerificationRequired(): boolean {
    return this.config.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION;
  }

  /**
   * Get app name
   */
  getAppName(): string {
    return this.config.NEXT_PUBLIC_APP_NAME;
  }

  /**
   * Get app version
   */
  getAppVersion(): string {
    return this.config.NEXT_PUBLIC_APP_VERSION;
  }

  /**
   * Get default tier
   */
  getDefaultTier(): string {
    return this.config.NEXT_PUBLIC_DEFAULT_TIER;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.config.NEXT_PUBLIC_SUPPORTED_LANGUAGES.split(",");
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): string {
    return this.config.NEXT_PUBLIC_DEFAULT_LANGUAGE;
  }
}

// Export singleton instance
export const tenantConfig = TenantConfig.getInstance();

// Export default config for reference
export { defaultConfig };
