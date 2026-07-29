/**
 * Settings Service Interfaces
 *
 * Following SOLID Principles:
 * - ISP: Small, focused interfaces for each domain
 * - DIP: All services depend on abstractions (interfaces)
 * - OCP: Interfaces are open for extension
 */

import type {
  AIProviderConfig,
  AIModel,
  AIRoutingConfig,
  TenantTier,
  EmailConfig,
  EmailTemplate,
  EmailLog,
  AuditLog,
  PaginatedAuditLogs,
  PlatformSettings,
} from "@/types/settings.types";

// ============================================
// CORE API CLIENT INTERFACE (DIP)
// ============================================

/**
 * Core API Client Interface
 * Abstracts the HTTP layer for all settings services
 * Following DIP - depend on abstraction, not concrete implementation
 */
export interface ISettingsApiClient {
  get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(endpoint: string, data?: unknown): Promise<T>;
  put<T>(endpoint: string, data?: unknown): Promise<T>;
  patch<T>(endpoint: string, data?: unknown): Promise<T>;
  delete<T>(endpoint: string): Promise<T>;
}

// ============================================
// AI SETTINGS INTERFACE (ISP)
// ============================================

/**
 * AI Settings Service Interface
 * Single Responsibility: Only handles AI provider configuration
 * Segregated from other settings domains
 */
export interface IAISettingsService {
  // Provider CRUD
  getProviders(): Promise<AIProviderConfig[]>;
  getProvider(id: string): Promise<AIProviderConfig>;
  createProvider(data: Partial<AIProviderConfig>): Promise<AIProviderConfig>;
  updateProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig>;
  deleteProvider(id: string): Promise<void>;
  toggleProvider(id: string, enabled: boolean): Promise<AIProviderConfig>;
  setDefaultProvider(id: string): Promise<AIProviderConfig>;

  // Model Management
  getModels(providerId: string): Promise<AIModel[]>;
  addModel(providerId: string, model: Partial<AIModel>): Promise<AIModel>;
  updateModel(
    providerId: string,
    modelId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel>;
  deleteModel(providerId: string, modelId: string): Promise<void>;
  toggleModel(
    providerId: string,
    modelId: string,
    enabled: boolean,
  ): Promise<AIModel>;
  setDefaultModel(providerId: string, modelId: string): Promise<AIModel>;

  // Validation
  testProviderConnection(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }>;

  // Phase 2.8: discover available models from the provider's
  // OpenAI-compatible /models endpoint and insert them as disabled
  // ai_models rows. Admin then chooses which to enable + default.
  discoverProviderModels(id: string): Promise<{
    ok: boolean;
    inserted?: Array<{
      id: string;
      modelId: string;
      displayName: string;
      capabilities: string[];
    }>;
    existing?: string[];
    message?: string;
    error?: string;
  }>;

  // AI Routing
  getAIRouting(): Promise<AIRoutingConfig>;
  updateAIRouting(config: Partial<AIRoutingConfig>): Promise<AIRoutingConfig>;
  resetAIRouting(): Promise<AIRoutingConfig>;
}

// ============================================
// TIER SETTINGS INTERFACE (ISP)
// ============================================

/**
 * Tier Settings Service Interface
 * Single Responsibility: Only handles tenant tier management
 */
export interface ITierSettingsService {
  // Tier CRUD
  getTiers(): Promise<TenantTier[]>;
  getTier(id: string): Promise<TenantTier>;
  createTier(data: Partial<TenantTier>): Promise<TenantTier>;
  updateTier(id: string, data: Partial<TenantTier>): Promise<TenantTier>;
  deleteTier(id: string): Promise<void>;
  toggleTier(id: string, active: boolean): Promise<TenantTier>;
  setDefaultTier(id: string): Promise<TenantTier>;
  reorderTiers(orderedIds: string[]): Promise<TenantTier[]>;

  // Features & Permissions
  getTierFeatures(tierId: string): Promise<TenantTier["features"]>;
  updateTierFeatures(
    tierId: string,
    features: TenantTier["features"],
  ): Promise<TenantTier>;
  getTierPermissions(tierId: string): Promise<TenantTier["permissions"]>;
  updateTierPermissions(
    tierId: string,
    permissions: TenantTier["permissions"],
  ): Promise<TenantTier>;
}

// ============================================
// EMAIL SETTINGS INTERFACE (ISP)
// ============================================

/**
 * Email Settings Service Interface
 * Single Responsibility: Only handles email configuration
 */
export interface IEmailSettingsService {
  // Configuration
  getConfigs(): Promise<EmailConfig[]>;
  getConfig(id: string): Promise<EmailConfig>;
  createConfig(data: Partial<EmailConfig>): Promise<EmailConfig>;
  updateConfig(id: string, data: Partial<EmailConfig>): Promise<EmailConfig>;
  deleteConfig(id: string): Promise<void>;
  toggleConfig(id: string, enabled: boolean): Promise<EmailConfig>;
  setDefaultConfig(id: string): Promise<EmailConfig>;
  testConfig(
    id: string,
    testEmail: string,
  ): Promise<{ success: boolean; error?: string }>;

  // Templates
  getTemplates(): Promise<EmailTemplate[]>;
  getTemplate(id: string): Promise<EmailTemplate>;
  createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate>;
  updateTemplate(
    id: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate>;
  deleteTemplate(id: string): Promise<void>;
  toggleTemplate(id: string, active: boolean): Promise<EmailTemplate>;

  // Logs
  getLogs(params?: {
    page?: number;
    limit?: number;
    status?: EmailLog["status"];
    type?: EmailTemplate["type"];
    search?: string;
  }): Promise<PaginatedAuditLogs>;
  getLog(id: string): Promise<EmailLog>;
  resendEmail(logId: string): Promise<EmailLog>;
}

// ============================================
// AUDIT LOGS INTERFACE (ISP)
// ============================================

/**
 * Audit Logs Service Interface
 * Single Responsibility: Only handles audit log retrieval and export
 */
export interface IAuditLogsService {
  getLogs(params?: {
    page?: number;
    limit?: number;
    level?: AuditLog["level"];
    category?: AuditLog["category"];
    actorId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<PaginatedAuditLogs>;

  getLog(id: string): Promise<AuditLog>;

  exportLogs(params: {
    format: "csv" | "json" | "pdf";
    level?: AuditLog["level"];
    category?: AuditLog["category"];
    startDate?: string;
    endDate?: string;
  }): Promise<Blob>;

  getLogSummary(params?: { startDate?: string; endDate?: string }): Promise<{
    total: number;
    byLevel: Record<AuditLog["level"], number>;
    byCategory: Record<AuditLog["category"], number>;
    byActor: { actorId: string; count: number }[];
  }>;
}

// ============================================
// PLATFORM SETTINGS INTERFACE (ISP)
// ============================================

/**
 * Platform Settings Service Interface
 * Single Responsibility: Only handles platform-wide settings
 */
export interface IPlatformSettingsService {
  getSettings(): Promise<PlatformSettings>;
  updateSettings(
    settings: Partial<PlatformSettings>,
  ): Promise<PlatformSettings>;

  // Individual settings sections
  getGeneralSettings(): Promise<PlatformSettings["general"]>;
  updateGeneralSettings(
    settings: Partial<PlatformSettings["general"]>,
  ): Promise<PlatformSettings["general"]>;

  getSecuritySettings(): Promise<PlatformSettings["security"]>;
  updateSecuritySettings(
    settings: Partial<PlatformSettings["security"]>,
  ): Promise<PlatformSettings["security"]>;

  getNotificationSettings(): Promise<PlatformSettings["notifications"]>;
  updateNotificationSettings(
    settings: Partial<PlatformSettings["notifications"]>,
  ): Promise<PlatformSettings["notifications"]>;

  getIntegrationSettings(): Promise<PlatformSettings["integrations"]>;
  updateIntegrationSettings(
    settings: Partial<PlatformSettings["integrations"]>,
  ): Promise<PlatformSettings["integrations"]>;
}

// ============================================
// SETTINGS FACTORY (DIP + OCP)
// ============================================

/**
 * Settings Service Factory
 * Following DIP - depends on interface, not concrete class
 * Following OCP - can add new services without modifying existing code
 */
export interface ISettingsServiceFactory {
  createAISettingsService(): IAISettingsService;
  createTierSettingsService(): ITierSettingsService;
  createEmailSettingsService(): IEmailSettingsService;
  createAuditLogsService(): IAuditLogsService;
  createPlatformSettingsService(): IPlatformSettingsService;
}
