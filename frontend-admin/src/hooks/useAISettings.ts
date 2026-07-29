/**
 * AI Settings Hook
 *
 * Single Responsibility: Only handles AI settings data fetching and state management
 * Part of the Settings module following SOLID principles
 */

import { useState, useEffect, useCallback } from "react";
import { getAISettingsService } from "@/services/settings";
import type { AIProviderConfig, AIModel, AIRoutingConfig } from "@/types/settings.types";

interface UseAISettingsState {
  providers: AIProviderConfig[];
  routing: AIRoutingConfig | null;
  loading: boolean;
  error: string | null;
}

interface SetDefaultProviderResult {
  ok: boolean;
  providerId: string;
  modelId?: string;
  routing?: AIRoutingConfig;
  error?: string;
}

interface UseAISettingsActions {
  refresh: () => Promise<void>;
  createProvider: (
    data: Partial<AIProviderConfig>,
  ) => Promise<AIProviderConfig>;
  updateProvider: (
    id: string,
    data: Partial<AIProviderConfig>,
  ) => Promise<AIProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  toggleProvider: (id: string, enabled: boolean) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<SetDefaultProviderResult>;
  testConnection: (
    id: string,
  ) => Promise<{ success: boolean; latency: number; error?: string }>;
  discoverProviderModels: (id: string) => Promise<{
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
  // Model actions
  getModels: (providerId: string) => Promise<AIModel[]>;
  addModel: (providerId: string, model: Partial<AIModel>) => Promise<AIModel>;
  updateModel: (
    providerId: string,
    modelId: string,
    data: Partial<AIModel>,
  ) => Promise<AIModel>;
  deleteModel: (providerId: string, modelId: string) => Promise<void>;
  toggleModel: (
    providerId: string,
    modelId: string,
    enabled: boolean,
  ) => Promise<void>;
  setDefaultModel: (
    providerId: string,
    modelId: string,
  ) => Promise<unknown>;
  // Routing actions
  updateRouting: (config: Partial<AIRoutingConfig>) => Promise<AIRoutingConfig>;
  resetRouting: () => Promise<AIRoutingConfig>;
}

export function useAISettings(): UseAISettingsState & UseAISettingsActions {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [routing, setRouting] = useState<AIRoutingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = getAISettingsService();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providersData, routingData] = await Promise.all([
        service.getProviders(),
        service.getAIRouting(),
      ]);
      setProviders(providersData);
      setRouting(routingData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load AI providers",
      );
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProvider = useCallback(
    async (data: Partial<AIProviderConfig>): Promise<AIProviderConfig> => {
      const provider = await service.createProvider(data);
      void refresh();
      return provider;
    },
    [service, refresh],
  );

  const updateProvider = useCallback(
    async (
      id: string,
      data: Partial<AIProviderConfig>,
    ): Promise<AIProviderConfig> => {
      const provider = await service.updateProvider(id, data);
      void refresh();
      return provider;
    },
    [service, refresh],
  );

  const deleteProvider = useCallback(
    async (id: string): Promise<void> => {
      await service.deleteProvider(id);
      void refresh();
    },
    [service, refresh],
  );

  const toggleProvider = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      await service.toggleProvider(id, enabled);
      void refresh();
    },
    [service, refresh],
  );

  const setDefaultProvider = useCallback(
    async (id: string): Promise<SetDefaultProviderResult> => {
      const res = await service.setDefaultProvider(id);
      void refresh();
      return res as unknown as SetDefaultProviderResult;
    },
    [service, refresh],
  );

  const testConnection = useCallback(
    async (id: string) => {
      return service.testProviderConnection(id);
    },
    [service],
  );

  const discoverProviderModels = useCallback(
    async (id: string) => {
      return service.discoverProviderModels(id);
    },
    [service],
  );

  // Model actions
  const getModels = useCallback(
    async (providerId: string): Promise<AIModel[]> => {
      return service.getModels(providerId);
    },
    [service],
  );

  const addModel = useCallback(
    async (providerId: string, model: Partial<AIModel>): Promise<AIModel> => {
      const newModel = await service.addModel(providerId, model);
      return newModel;
    },
    [service],
  );

  const updateModel = useCallback(
    async (
      providerId: string,
      modelId: string,
      data: Partial<AIModel>,
    ): Promise<AIModel> => {
      return service.updateModel(providerId, modelId, data);
    },
    [service],
  );

  const deleteModel = useCallback(
    async (providerId: string, modelId: string): Promise<void> => {
      await service.deleteModel(providerId, modelId);
    },
    [service],
  );

  const toggleModel = useCallback(
    async (
      providerId: string,
      modelId: string,
      enabled: boolean,
    ): Promise<void> => {
      await service.toggleModel(providerId, modelId, enabled);
    },
    [service],
  );

  const setDefaultModel = useCallback(
    async (
      providerId: string,
      modelId: string,
    ): Promise<unknown> => {
      return service.setDefaultModel(providerId, modelId);
    },
    [service],
  );

  // Routing actions
  const updateRouting = useCallback(
    async (config: Partial<AIRoutingConfig>): Promise<AIRoutingConfig> => {
      const updated = await service.updateAIRouting(config);
      setRouting(updated);
      return updated;
    },
    [service],
  );

  const resetRouting = useCallback(async (): Promise<AIRoutingConfig> => {
    const reset = await service.resetAIRouting();
    setRouting(reset);
    return reset;
  }, [service]);

  return {
    providers,
    routing,
    loading,
    error,
    refresh,
    createProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    setDefaultProvider,
    testConnection,
    discoverProviderModels,
    getModels,
    addModel,
    updateModel,
    deleteModel,
    toggleModel,
    setDefaultModel,
    updateRouting,
    resetRouting,
  };
}
