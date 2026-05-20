/**
 * Tier Settings Service Implementation
 *
 * Single Responsibility: Only handles tenant tier management
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { TenantTier } from "@/types/settings.types";
import type { ITierSettingsService, ISettingsApiClient } from "./interfaces";

export class TierSettingsService implements ITierSettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  // Tier CRUD
  async getTiers(): Promise<TenantTier[]> {
    const response = await this.apiClient.get<BackendTier[]>("/tiers");
    return response.map((tier) => this.mapBackendTier(tier));
  }

  async getTier(id: string): Promise<TenantTier> {
    const tier = await this.apiClient.get<BackendTier>(`/tiers/${id}`);
    return this.mapBackendTier(tier);
  }

  async createTier(data: Partial<TenantTier>): Promise<TenantTier> {
    const tier = await this.apiClient.post<BackendTier>(
      "/tiers",
      this.mapTierPayload(data),
    );
    return this.mapBackendTier(tier);
  }

  async updateTier(id: string, data: Partial<TenantTier>): Promise<TenantTier> {
    const tier = await this.apiClient.patch<BackendTier>(
      `/tiers/${id}`,
      this.mapTierPayload(data),
    );
    return this.mapBackendTier(tier);
  }

  async deleteTier(id: string): Promise<void> {
    await this.apiClient.delete(`/tiers/${id}`);
  }

  async toggleTier(id: string, active: boolean): Promise<TenantTier> {
    const tier = await this.apiClient.patch<BackendTier>(
      `/tiers/${id}/toggle`,
      {
        isActive: active,
      },
    );
    return this.mapBackendTier(tier);
  }

  async setDefaultTier(id: string): Promise<TenantTier> {
    const tier = await this.apiClient.post<BackendTier>(
      `/tiers/${id}/set-default`,
    );
    return this.mapBackendTier(tier);
  }

  async reorderTiers(orderedIds: string[]): Promise<TenantTier[]> {
    const response = await this.apiClient.post<BackendTier[]>(
      "/tiers/reorder",
      { orderedIds },
    );
    return response.map((tier) => this.mapBackendTier(tier));
  }

  // Features
  async getTierFeatures(tierId: string): Promise<TenantTier["features"]> {
    const tier = await this.getTier(tierId);
    return tier.features;
  }

  async updateTierFeatures(
    tierId: string,
    features: TenantTier["features"],
  ): Promise<TenantTier> {
    return this.updateTier(tierId, { features });
  }

  // Permissions
  async getTierPermissions(tierId: string): Promise<TenantTier["permissions"]> {
    const tier = await this.getTier(tierId);
    return tier.permissions;
  }

  async updateTierPermissions(
    tierId: string,
    permissions: TenantTier["permissions"],
  ): Promise<TenantTier> {
    return this.updateTier(tierId, { permissions });
  }

  private mapBackendTier(tier: BackendTier): TenantTier {
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
      description: tier.description ?? "",
      isActive: tier.isActive,
      isDefault: tier.isDefault,
      sortOrder: tier.sortOrder ?? 0,
      pricing: {
        monthlyPrice: Number(tier.monthlyPrice ?? 0),
        yearlyPrice: Number(tier.yearlyPrice ?? 0),
        currency: tier.currency ?? "USD",
        billingCycle: "monthly",
      },
      limits,
      features: [
        {
          id: "custom_branding",
          name: "Custom Branding",
          description: "White-label your instance",
          enabled: limits.allowCustomBranding,
        },
        {
          id: "api_access",
          name: "API Access",
          description: "Programmatic access to your data",
          enabled: limits.allowApiAccess,
        },
        {
          id: "sso",
          name: "Single Sign-On",
          description: "Integrate with your identity provider",
          enabled: limits.allowSso,
        },
        {
          id: "audit_export",
          name: "Audit Export",
          description: "Export audit logs",
          enabled: limits.allowAuditExport,
        },
      ],
      permissions: [
        {
          id: "manage_users",
          name: "Manage Users",
          description: "Create and manage users",
          enabled: true,
        },
        {
          id: "manage_agents",
          name: "Manage Agents",
          description: "Create and manage agents",
          enabled: true,
        },
        {
          id: "view_analytics",
          name: "View Analytics",
          description: "View analytics dashboards",
          enabled: true,
        },
        {
          id: "manage_billing",
          name: "Manage Billing",
          description: "Manage subscription",
          enabled: false,
        },
      ],
      createdAt: new Date(tier.createdAt).toISOString(),
      updatedAt: new Date(tier.updatedAt).toISOString(),
    };
  }

  private mapTierPayload(data: Partial<TenantTier>) {
    const features = Array.isArray(data.features) ? data.features : [];
    const hasFeature = (id: string) =>
      features.some((feature) => feature.id === id && feature.enabled);

    return {
      name: data.name,
      slug: data.slug,
      description: data.description,
      isActive: data.isActive,
      isDefault: data.isDefault,
      sortOrder: data.sortOrder,
      monthlyPrice: data.pricing?.monthlyPrice,
      yearlyPrice: data.pricing?.yearlyPrice,
      currency: data.pricing?.currency,
      maxUsers: data.limits?.maxUsers,
      maxAgents: data.limits?.maxAgents,
      maxStorageGB: data.limits?.maxStorageGB,
      maxApiCalls: data.limits?.maxApiCalls,
      maxConversationMessages: data.limits?.maxConversationMessages,
      maxFileSizeMB: data.limits?.maxFileSizeMB,
      allowCustomBranding:
        data.limits?.allowCustomBranding ?? hasFeature("custom_branding"),
      allowApiAccess: data.limits?.allowApiAccess ?? hasFeature("api_access"),
      allowSso: data.limits?.allowSso ?? hasFeature("sso"),
      allowAuditExport:
        data.limits?.allowAuditExport ?? hasFeature("audit_export"),
    };
  }
}

interface BackendTier {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  currency: string;
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
  createdAt: string;
  updatedAt: string;
}
