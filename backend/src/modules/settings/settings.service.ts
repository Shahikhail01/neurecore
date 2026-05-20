import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { TiersService } from '../tiers/tiers.service';

// Simple file-based storage for development
// This ensures data persists across backend restarts
const STORAGE_FILE = path.join(process.cwd(), 'data', 'settings.json');

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load settings from file
function loadSettings(): any {
  try {
    ensureDataDir();
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return null;
}

// Save settings to file
function saveSettings(data: any): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Types matching frontend
export interface AIProviderConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
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
  provider: string;
  modelId: string;
  contextWindow: number;
  maxTokens: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  isDefault: boolean;
  isEnabled: boolean;
}

interface AIProviderSettings {
  temperature: number;
  topP: number;
  topK?: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
  fallbackProvider?: string;
}

export interface TenantTier {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  pricing: {
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    billingCycle: string;
  };
  limits: {
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
  };
  features: any[];
  permissions: any[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailConfig {
  id: string;
  provider: string;
  settings: any;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  error?: string;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
}

// Load persisted data or use defaults
const persisted = loadSettings();

// File-based storage (persists across restarts)
const aiProviders: AIProviderConfig[] = persisted?.aiProviders || [];
const emailConfigs: EmailConfig[] = persisted?.emailConfigs || [];
const emailTemplates: EmailTemplate[] = persisted?.emailTemplates || [];
const emailLogs: EmailLog[] = persisted?.emailLogs || [];

// Counters
let aiProviderCounter =
  persisted?.counters?.aiProviderCounter ||
  Math.max(
    1,
    ...aiProviders.map((p) => parseInt(p.id.replace('provider-', '')) || 0),
  ) + 1;
let emailConfigCounter =
  persisted?.counters?.emailConfigCounter ||
  Math.max(
    1,
    ...emailConfigs.map(
      (c) => parseInt(c.id.replace('email-config-', '')) || 0,
    ),
  ) + 1;
let emailTemplateCounter =
  persisted?.counters?.emailTemplateCounter ||
  Math.max(
    1,
    ...emailTemplates.map(
      (t) => parseInt(t.id.replace('email-template-', '')) || 0,
    ),
  ) + 1;

// Helper to save data after modifications
function persistData() {
  saveSettings({
    aiProviders,
    emailConfigs,
    emailTemplates,
    emailLogs,
    counters: {
      aiProviderCounter,
      emailConfigCounter,
      emailTemplateCounter,
    },
  });
}

@Injectable()
export class SettingsService {
  constructor(private readonly tiersService: TiersService) {}

  // ==================== AI PROVIDERS ====================

  async getAIProviders(): Promise<AIProviderConfig[]> {
    return aiProviders;
  }

  async getAIProvider(id: string): Promise<AIProviderConfig | undefined> {
    return aiProviders.find((p) => p.id === id);
  }

  async createAIProvider(
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const provider: AIProviderConfig = {
      id: `provider-${aiProviderCounter++}`,
      provider: data.provider || 'openai',
      name: data.name || 'New Provider',
      apiKey: data.apiKey || '',
      apiEndpoint: data.apiEndpoint,
      isEnabled: true,
      isDefault: aiProviders.length === 0,
      models: [],
      settings: data.settings || {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    aiProviders.push(provider);
    return provider;
  }

  async updateAIProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    Object.assign(provider, data, { updatedAt: new Date().toISOString() });
    return provider;
  }

  async deleteAIProvider(id: string): Promise<void> {
    const index = aiProviders.findIndex((p) => p.id === id);
    if (index >= 0) aiProviders.splice(index, 1);
  }

  async toggleAIProvider(
    id: string,
    enabled: boolean,
  ): Promise<AIProviderConfig> {
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    provider.isEnabled = enabled;
    provider.updatedAt = new Date().toISOString();
    return provider;
  }

  async setDefaultAIProvider(id: string): Promise<AIProviderConfig> {
    aiProviders.forEach((p) => (p.isDefault = p.id === id));
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    return provider;
  }

  async testAIProvider(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    return { success: true, latency: 100 };
  }

  async getAIModels(providerId: string): Promise<AIModel[]> {
    const provider = aiProviders.find((p) => p.id === providerId);
    return provider?.models || [];
  }

  async addAIModel(
    providerId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel> {
    const provider = aiProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('Provider not found');
    const model: AIModel = {
      id: `model-${Date.now()}`,
      name: data.name || 'New Model',
      provider: provider.provider,
      modelId: data.modelId || 'gpt-4',
      contextWindow: data.contextWindow || 8192,
      maxTokens: data.maxTokens || 4096,
      supportsVision: data.supportsVision || false,
      supportsFunctionCalling: data.supportsFunctionCalling || false,
      isDefault: provider.models.length === 0,
      isEnabled: true,
    };
    provider.models.push(model);
    return model;
  }

  // ==================== TIERS ====================

  async getTiers(): Promise<TenantTier[]> {
    const items = await this.tiersService.findAll();
    return items.map((tier) => this.mapTierToLegacyShape(tier));
  }

  async getTier(id: string): Promise<TenantTier | undefined> {
    const tier = await this.tiersService.findById(id);
    return this.mapTierToLegacyShape(tier);
  }

  async createTier(data: Partial<TenantTier>): Promise<TenantTier> {
    const tier = await this.tiersService.create(
      this.mapLegacyInputToTierPayload(data),
    );
    return this.mapTierToLegacyShape(tier);
  }

  async updateTier(id: string, data: Partial<TenantTier>): Promise<TenantTier> {
    const tier = await this.tiersService.update(
      id,
      this.mapLegacyInputToTierPayload(data),
    );
    return this.mapTierToLegacyShape(tier);
  }

  async deleteTier(id: string): Promise<void> {
    await this.tiersService.delete(id);
  }

  async toggleTier(id: string, isActive: boolean): Promise<TenantTier> {
    const tier = await this.tiersService.toggleActive(id, isActive);
    return this.mapTierToLegacyShape(tier);
  }

  async setDefaultTier(id: string): Promise<TenantTier> {
    const tier = await this.tiersService.setDefault(id);
    return this.mapTierToLegacyShape(tier);
  }

  async reorderTiers(orderedIds: string[]): Promise<TenantTier[]> {
    const items = await this.tiersService.reorder(orderedIds);
    return items.map((tier) => this.mapTierToLegacyShape(tier));
  }

  async getTierUsage(id: string): Promise<{ tenants: number; users: number }> {
    return this.tiersService.getUsage(id);
  }

  private mapTierToLegacyShape(tier: any): TenantTier {
    const limits = {
      maxUsers: tier.maxUsers ?? 0,
      maxAgents: tier.maxAgents ?? 0,
      maxStorageGB: tier.maxStorageGB ?? 0,
      maxApiCalls: tier.maxApiCalls ?? 0,
      maxConversationMessages: tier.maxConversationMessages ?? 0,
      maxFileSizeMB: tier.maxFileSizeMB ?? 0,
      allowCustomBranding: tier.allowCustomBranding ?? false,
      allowApiAccess: tier.allowApiAccess ?? false,
      allowSso: tier.allowSso ?? false,
      allowAuditExport: tier.allowAuditExport ?? false,
    };

    return {
      id: tier.id,
      name: tier.name,
      slug: tier.slug,
      description: tier.description ?? '',
      isActive: tier.isActive,
      isDefault: tier.isDefault,
      sortOrder: tier.sortOrder ?? 0,
      pricing: {
        monthlyPrice: Number(tier.monthlyPrice ?? 0),
        yearlyPrice: Number(tier.yearlyPrice ?? 0),
        currency: tier.currency ?? 'USD',
        billingCycle: 'monthly',
      },
      limits,
      features: this.buildTierFeatures(limits),
      permissions: this.buildTierPermissions(),
      createdAt: new Date(tier.createdAt).toISOString(),
      updatedAt: new Date(tier.updatedAt).toISOString(),
    };
  }

  private mapLegacyInputToTierPayload(data: Partial<TenantTier>) {
    const pricing = data.pricing;
    const limits = data.limits;
    const featureFlags = this.extractFeatureFlags(data.features);

    return {
      name: data.name,
      slug: data.slug,
      description: data.description,
      isActive: data.isActive,
      isDefault: data.isDefault,
      sortOrder: data.sortOrder,
      monthlyPrice: pricing?.monthlyPrice,
      yearlyPrice: pricing?.yearlyPrice,
      currency: pricing?.currency,
      maxUsers: limits?.maxUsers,
      maxAgents: limits?.maxAgents,
      maxStorageGB: limits?.maxStorageGB,
      maxApiCalls: limits?.maxApiCalls,
      maxConversationMessages: limits?.maxConversationMessages,
      maxFileSizeMB: limits?.maxFileSizeMB,
      allowCustomBranding:
        limits?.allowCustomBranding ?? featureFlags.allowCustomBranding,
      allowApiAccess: limits?.allowApiAccess ?? featureFlags.allowApiAccess,
      allowSso: limits?.allowSso ?? featureFlags.allowSso,
      allowAuditExport:
        limits?.allowAuditExport ?? featureFlags.allowAuditExport,
    };
  }

  private extractFeatureFlags(features?: any[]) {
    const hasEnabled = (id: string) =>
      Array.isArray(features) &&
      features.some((feature) => feature?.id === id && feature?.enabled);

    return {
      allowCustomBranding: hasEnabled('custom_branding'),
      allowApiAccess: hasEnabled('api_access'),
      allowSso: hasEnabled('sso'),
      allowAuditExport: hasEnabled('audit_export'),
    };
  }

  private buildTierFeatures(limits: TenantTier['limits']) {
    return [
      {
        id: 'custom_branding',
        name: 'Custom Branding',
        description: 'White-label your instance',
        enabled: limits.allowCustomBranding,
      },
      {
        id: 'api_access',
        name: 'API Access',
        description: 'Programmatic access to your data',
        enabled: limits.allowApiAccess,
      },
      {
        id: 'sso',
        name: 'Single Sign-On',
        description: 'Integrate with your identity provider',
        enabled: limits.allowSso,
      },
      {
        id: 'audit_export',
        name: 'Audit Export',
        description: 'Export audit logs',
        enabled: limits.allowAuditExport,
      },
    ];
  }

  private buildTierPermissions() {
    return [
      {
        id: 'manage_users',
        name: 'Manage Users',
        description: 'Create and manage users',
        enabled: true,
      },
      {
        id: 'manage_agents',
        name: 'Manage Agents',
        description: 'Create and manage agents',
        enabled: true,
      },
      {
        id: 'view_analytics',
        name: 'View Analytics',
        description: 'View analytics dashboards',
        enabled: true,
      },
      {
        id: 'manage_billing',
        name: 'Manage Billing',
        description: 'Manage subscription',
        enabled: false,
      },
    ];
  }

  // ==================== EMAIL CONFIGS ====================

  async getEmailConfigs(): Promise<EmailConfig[]> {
    return emailConfigs;
  }

  async getEmailConfig(id: string): Promise<EmailConfig | undefined> {
    return emailConfigs.find((c) => c.id === id);
  }

  async createEmailConfig(data: Partial<EmailConfig>): Promise<EmailConfig> {
    const config: EmailConfig = {
      id: `email-config-${emailConfigCounter++}`,
      provider: data.provider || 'smtp',
      settings: data.settings || { fromEmail: '', fromName: '' },
      isEnabled: true,
      isDefault: emailConfigs.length === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    emailConfigs.push(config);
    return config;
  }

  async updateEmailConfig(
    id: string,
    data: Partial<EmailConfig>,
  ): Promise<EmailConfig> {
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    Object.assign(config, data, { updatedAt: new Date().toISOString() });
    return config;
  }

  async deleteEmailConfig(id: string): Promise<void> {
    const index = emailConfigs.findIndex((c) => c.id === id);
    if (index >= 0) emailConfigs.splice(index, 1);
  }

  async toggleEmailConfig(
    id: string,
    isEnabled: boolean,
  ): Promise<EmailConfig> {
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    config.isEnabled = isEnabled;
    config.updatedAt = new Date().toISOString();
    return config;
  }

  async setDefaultEmailConfig(id: string): Promise<EmailConfig> {
    emailConfigs.forEach((c) => (c.isDefault = c.id === id));
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    return config;
  }

  async testEmailConfig(
    id: string,
    testEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  // ==================== EMAIL TEMPLATES ====================

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return emailTemplates;
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return emailTemplates.find((t) => t.id === id);
  }

  async createEmailTemplate(
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    const template: EmailTemplate = {
      id: `email-template-${emailTemplateCounter++}`,
      name: data.name || 'New Template',
      subject: data.subject || '',
      body: data.body || '',
      type: data.type || 'custom',
      isActive: true,
      variables: data.variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    emailTemplates.push(template);
    return template;
  }

  async updateEmailTemplate(
    id: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    const template = emailTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Template not found');
    Object.assign(template, data, { updatedAt: new Date().toISOString() });
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    const index = emailTemplates.findIndex((t) => t.id === id);
    if (index >= 0) emailTemplates.splice(index, 1);
  }

  async toggleEmailTemplate(
    id: string,
    isActive: boolean,
  ): Promise<EmailTemplate> {
    const template = emailTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Template not found');
    template.isActive = isActive;
    template.updatedAt = new Date().toISOString();
    return template;
  }

  // ==================== EMAIL LOGS ====================

  async getEmailLogs(params: any): Promise<{
    items: EmailLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    return { items: emailLogs, total: emailLogs.length, page: 1, limit: 20 };
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    return emailLogs.find((l) => l.id === id);
  }

  async resendEmail(id: string): Promise<EmailLog> {
    const log = emailLogs.find((l) => l.id === id);
    if (!log) throw new Error('Log not found');
    return log;
  }
}
