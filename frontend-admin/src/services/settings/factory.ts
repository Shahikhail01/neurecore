/**
 * Settings Service Factory
 *
 * Dependency Injection container for all settings services
 * Following DIP - clients depend on interfaces, not concrete implementations
 * Following OCP - can add new services without modifying existing code
 */

import type {
  IAISettingsService,
  ITierSettingsService,
  IEmailSettingsService,
  IAuditLogsService,
  IPlatformSettingsService,
  ISettingsServiceFactory,
  ISettingsApiClient,
} from "./interfaces";

import { AISettingsService } from "./aiSettings.service";
import { TierSettingsService } from "./tierSettings.service";
import { EmailSettingsService } from "./emailSettings.service";
import { AuditLogsService } from "./auditSettings.service";
import { PlatformSettingsService } from "./platformSettings.service";
import { getSettingsApiClient, SettingsApiClient } from "./apiClient";

export class SettingsServiceFactory implements ISettingsServiceFactory {
  private apiClient: ISettingsApiClient;
  private tierApiClient: ISettingsApiClient;
  private aiService: IAISettingsService | null = null;
  private tierService: ITierSettingsService | null = null;
  private emailService: IEmailSettingsService | null = null;
  private auditService: IAuditLogsService | null = null;
  private platformService: IPlatformSettingsService | null = null;

  constructor(apiClient?: ISettingsApiClient) {
    this.apiClient = apiClient ?? getSettingsApiClient();
    this.tierApiClient = new SettingsApiClient("");
  }

  createAISettingsService(): IAISettingsService {
    if (!this.aiService) {
      this.aiService = new AISettingsService(this.apiClient);
    }
    return this.aiService;
  }

  createTierSettingsService(): ITierSettingsService {
    if (!this.tierService) {
      this.tierService = new TierSettingsService(this.tierApiClient);
    }
    return this.tierService;
  }

  createEmailSettingsService(): IEmailSettingsService {
    if (!this.emailService) {
      this.emailService = new EmailSettingsService(this.apiClient);
    }
    return this.emailService;
  }

  createAuditLogsService(): IAuditLogsService {
    if (!this.auditService) {
      this.auditService = new AuditLogsService(this.apiClient);
    }
    return this.auditService;
  }

  createPlatformSettingsService(): IPlatformSettingsService {
    if (!this.platformService) {
      this.platformService = new PlatformSettingsService(this.apiClient);
    }
    return this.platformService!;
  }
}

// ============================================
// SINGLETON FACTORY INSTANCE
// ============================================

let factoryInstance: ISettingsServiceFactory | null = null;

export function getSettingsServiceFactory(): ISettingsServiceFactory {
  if (!factoryInstance) {
    factoryInstance = new SettingsServiceFactory();
  }
  return factoryInstance;
}

export function setSettingsServiceFactory(
  factory: ISettingsServiceFactory,
): void {
  factoryInstance = factory;
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export function getAISettingsService(): IAISettingsService {
  return getSettingsServiceFactory().createAISettingsService();
}

export function getTierSettingsService(): ITierSettingsService {
  return getSettingsServiceFactory().createTierSettingsService();
}

export function getEmailSettingsService(): IEmailSettingsService {
  return getSettingsServiceFactory().createEmailSettingsService();
}

export function getAuditLogsService(): IAuditLogsService {
  return getSettingsServiceFactory().createAuditLogsService();
}

export function getPlatformSettingsService(): IPlatformSettingsService {
  return getSettingsServiceFactory().createPlatformSettingsService();
}
