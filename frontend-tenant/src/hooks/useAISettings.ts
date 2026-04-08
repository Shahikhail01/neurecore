/**
 * AI Settings Hook
 *
 * Single Responsibility: Only handles AI settings data fetching and state management
 * Part of the Settings module following SOLID principles
 */

import { useState, useEffect, useCallback } from "react";
import { getAISettingsService } from "@/services/settings";
import type { AIProviderConfig, AIModel } from "@/types/settings.types";

interface UseAISettingsState {
  providers: AIProviderConfig[];
  loading: boolean;
  error: string | null;
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
  setDefaultProvider: (id: string) => Promise<void>;
  testConnection: (
    id: string,
  ) => Promise<{ success: boolean; latency: number; error?: string }>;
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
}

export function useAISettings(): UseAISettingsState & UseAISettingsActions {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = getAISettingsService();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.getProviders();
      setProviders(data);
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
    async (id: string): Promise<void> => {
      await service.setDefaultProvider(id);
      void refresh();
    },
    [service, refresh],
  );

  const testConnection = useCallback(
    async (id: string) => {
      return service.testProviderConnection(id);
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

  return {
    providers,
    loading,
    error,
    refresh,
    createProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    setDefaultProvider,
    testConnection,
    getModels,
    addModel,
    updateModel,
    deleteModel,
    toggleModel,
  };
}
