/**
 * Settings Types for NeureCore Admin
 *
 * Contains all type definitions for the Settings interface including:
 * - AI Provider configurations (Deepseek, Gemini, Openrouter)
 * - Tenant Tiers
 * - Email System
 * - Audit Logs
 * - Platform Settings
 */

// ============================================
// AI PROVIDER & MODELS
// ============================================

export type AIProvider = "deepseek" | "gemini" | "openrouter" | "minimax";

export interface AIProviderConfig {
  id: string;
  provider: AIProvider;
  name: string;
  apiKey: string; // Will be masked on display
  hasKey?: boolean;
  keyPreview?: string;
  apiEndpoint?: string;
  isEnabled: boolean;
  isDefault: boolean;
  models: AIModel[];
  settings: AIProviderSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string; // Provider-specific model ID (e.g., "gpt-4", "deepseek-chat")
  contextWindow: number;
  maxTokens: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  isDefault: boolean;
  isEnabled: boolean;
}

export interface AIProviderSettings {
  temperature: number;
  topP: number;
  topK?: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
  fallbackProvider?: AIProvider;
}

export const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  timeout: 30000,
  retryAttempts: 3,
};

export interface AIRoutingConfig {
  planning: string;
  execution: string;
  evaluation: string;
  conversation: string;
  coding: string;
  reasoning: string;
}

export const DEFAULT_AI_ROUTING: AIRoutingConfig = {
  planning: 'MiniMax-M2.7-highspeed',
  execution: 'MiniMax-M2.7-highspeed',
  evaluation: 'MiniMax-M2.7-highspeed',
  conversation: 'MiniMax-M2.7-highspeed',
  coding: 'MiniMax-M2.7-highspeed',
  reasoning: 'MiniMax-M2.7-highspeed',
};

// ============================================
// TENANT TIER SYSTEM
// ============================================

export interface TenantTier {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  pricing: TierPricing;
  limits: TierLimits;
  features: TierFeature[];
  permissions: TierPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface TierPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
}

export interface TierLimits {
  maxUsers: number;
  maxAgents: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxConversationMessages: number;
  maxFileSizeMB: number;
  allowCustomBranding: boolean;
  allowApiAccess: boolean;
  allowSso: boolean;
  allowAuditExport: boolean;
}

export interface TierFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  limit?: number;
}

export interface TierPermission {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_TIER_LIMITS: TierLimits = {
  maxUsers: 5,
  maxAgents: 10,
  maxStorageGB: 10,
  maxApiCalls: 10000,
  maxConversationMessages: 5000,
  maxFileSizeMB: 50,
  allowCustomBranding: false,
  allowApiAccess: false,
  allowSso: false,
  allowAuditExport: false,
};

// ============================================
// EMAIL SYSTEM
// ============================================

export interface EmailConfig {
  id: string;
  provider: EmailProvider;
  settings: EmailProviderSettings;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmailProvider = "smtp" | "ses" | "sendgrid" | "mailgun" | "resend";

export interface EmailProviderSettings {
  // SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;

  // API-based providers
  apiKey?: string;
  apiSecret?: string;
  region?: string;

  // Common
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: EmailTemplateType;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export type EmailTemplateType =
  | "welcome"
  | "password_reset"
  | "email_verification"
  | "tier_upgrade"
  | "tier_downgrade"
  | "payment_failed"
  | "payment_success"
  | "subscription_expiring"
  | "user_invite"
  | "custom";

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: EmailTemplateType;
  status: EmailLogStatus;
  error?: string;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
}

export type EmailLogStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed";

// ============================================
// AUDIT LOGS
// ============================================

export interface AuditLog {
  id: string;
  timestamp: string;
  level: AuditLevel;
  category: AuditCategory;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  changes?: AuditChange[];
}

export type AuditLevel = "info" | "warning" | "error" | "critical";

export type AuditCategory =
  | "authentication"
  | "authorization"
  | "user_management"
  | "tenant_management"
  | "tier_management"
  | "billing"
  | "ai_providers"
  | "email"
  | "settings"
  | "api_access"
  | "data_export"
  | "security";

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

// ============================================
// PLATFORM SETTINGS
// ============================================

export interface PlatformSettings {
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
}

export interface GeneralSettings {
  platformName: string;
  platformLogo?: string;
  platformUrl: string;
  supportEmail: string;
  defaultLanguage: string;
  defaultTimezone: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

export interface SecuritySettings {
  requireMfa: boolean;
  sessionTimeout: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  allowedIpRanges?: string[];
}

export interface NotificationSettings {
  emailNotifications: boolean;
  slackNotifications: boolean;
  webhookNotifications: boolean;
  notifyOnNewUser: boolean;
  notifyOnTierChange: boolean;
  notifyOnPayment: boolean;
  notifyOnSecurityAlert: boolean;
}

export interface IntegrationSettings {
  slackEnabled: boolean;
  slackWebhookUrl?: string;
  discordEnabled: boolean;
  discordWebhookUrl?: string;
  webhookEnabled: boolean;
  webhookUrl?: string;
  zapierEnabled: boolean;
  zapierHookUrl?: string;
}

// ============================================
// SETTINGS SERVICE RESPONSE
// ============================================

export interface SettingsResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}
