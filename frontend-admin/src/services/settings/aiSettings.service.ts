/**
 * AI Settings Service Implementation
 *
 * Single Responsibility: Only handles AI provider configuration
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { AIProviderConfig, AIModel, AIRoutingConfig } from "@/types/settings.types";
import type { IAISettingsService, ISettingsApiClient } from "./interfaces";
import { unwrapList, unwrapItem } from "@/services/unwrap";

export class AISettingsService implements IAISettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  // Provider Management
  async getProviders(): Promise<AIProviderConfig[]> {
    const response = await this.apiClient.get<any>("/ai/providers");
    return unwrapList(response).items as AIProviderConfig[];
  }

  async getProvider(id: string): Promise<AIProviderConfig> {
    const response = await this.apiClient.get<any>(`/ai/providers/${id}`);
    return unwrapItem(response) as AIProviderConfig;
  }

  async createProvider(
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const response = await this.apiClient.post<any>("/ai/providers", data);
    return unwrapItem(response) as AIProviderConfig;
  }

  async updateProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const response = await this.apiClient.patch<any>(`/ai/providers/${id}`, data);
    return unwrapItem(response) as AIProviderConfig;
  }

  async deleteProvider(id: string): Promise<void> {
    await this.apiClient.delete(`/ai/providers/${id}`);
  }

  async toggleProvider(
    id: string,
    enabled: boolean,
  ): Promise<AIProviderConfig> {
    const response = await this.apiClient.patch<any>(
      `/ai/providers/${id}/toggle`,
      { enabled },
    );
    return unwrapItem(response) as AIProviderConfig;
  }

  async setDefaultProvider(id: string): Promise<AIProviderConfig> {
    const response = await this.apiClient.post<any>(
      `/ai/providers/${id}/set-default`,
    );
    return unwrapItem(response) as AIProviderConfig;
  }

  // Model Management
  async getModels(providerId: string): Promise<AIModel[]> {
    const response = await this.apiClient.get<any>(
      `/ai/providers/${providerId}/models`,
    );
    return unwrapList(response).items as AIModel[];
  }

  async addModel(
    providerId: string,
    model: Partial<AIModel>,
  ): Promise<AIModel> {
    const response = await this.apiClient.post<any>(
      `/ai/providers/${providerId}/models`,
      model,
    );
    return unwrapItem(response) as AIModel;
  }

  async updateModel(
    providerId: string,
    modelId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel> {
    const response = await this.apiClient.patch<any>(
      `/ai/providers/${providerId}/models/${modelId}`,
      data,
    );
    return unwrapItem(response) as AIModel;
  }

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await this.apiClient.delete(
      `/ai/providers/${providerId}/models/${modelId}`,
    );
  }

  async toggleModel(
    providerId: string,
    modelId: string,
    enabled: boolean,
  ): Promise<AIModel> {
    const response = await this.apiClient.patch<any>(
      `/ai/providers/${providerId}/models/${modelId}/toggle`,
      { enabled },
    );
    return unwrapItem(response) as AIModel;
  }

  async setDefaultModel(providerId: string, modelId: string): Promise<AIModel> {
    const response = await this.apiClient.post<any>(
      `/ai/providers/${providerId}/models/${modelId}/set-default`,
    );
    return unwrapItem(response) as AIModel;
  }

  // Validation
  async testProviderConnection(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    const response = await this.apiClient.post<any>(`/ai/providers/${id}/test`);
    return unwrapItem(response);
  }

  // Phase 2.8: discover available models from the provider.
  async discoverProviderModels(
    id: string,
  ): Promise<{
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
  }> {
    const response = await this.apiClient.post<any>(
      `/ai/providers/${id}/discover-models`,
    );
    return unwrapItem(response) as {
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
    };
  }

  // AI Routing
  async getAIRouting(): Promise<AIRoutingConfig> {
    const response = await this.apiClient.get<any>("/ai/routing");
    return unwrapItem(response) as AIRoutingConfig;
  }

  async updateAIRouting(config: Partial<AIRoutingConfig>): Promise<AIRoutingConfig> {
    const response = await this.apiClient.patch<any>("/ai/routing", config);
    return unwrapItem(response) as AIRoutingConfig;
  }

  async resetAIRouting(): Promise<AIRoutingConfig> {
    const response = await this.apiClient.post<any>("/ai/routing/reset");
    return unwrapItem(response) as AIRoutingConfig;
  }
}
