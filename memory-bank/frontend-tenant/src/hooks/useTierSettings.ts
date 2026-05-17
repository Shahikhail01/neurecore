/**
 * Tier Settings Hook
 *
 * Single Responsibility: Only handles Tier settings data fetching and state management
 */

import { useState, useEffect, useCallback } from "react";
import { getTierSettingsService } from "@/services/settings";
import type { TenantTier } from "@/types/settings.types";

interface UseTierSettingsState {
  tiers: TenantTier[];
  loading: boolean;
  error: string | null;
}

interface UseTierSettingsActions {
  refresh: () => Promise<void>;
  createTier: (data: Partial<TenantTier>) => Promise<TenantTier>;
  updateTier: (id: string, data: Partial<TenantTier>) => Promise<TenantTier>;
  deleteTier: (id: string) => Promise<void>;
  toggleTier: (id: string, active: boolean) => Promise<void>;
  setDefaultTier: (id: string) => Promise<void>;
  reorderTiers: (orderedIds: string[]) => Promise<void>;
}

export function useTierSettings(): UseTierSettingsState &
  UseTierSettingsActions {
  const [tiers, setTiers] = useState<TenantTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = getTierSettingsService();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.getTiers();
      setTiers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tiers");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTier = useCallback(
    async (data: Partial<TenantTier>): Promise<TenantTier> => {
      const tier = await service.createTier(data);
      void refresh();
      return tier;
    },
    [service, refresh],
  );

  const updateTier = useCallback(
    async (id: string, data: Partial<TenantTier>): Promise<TenantTier> => {
      const tier = await service.updateTier(id, data);
      void refresh();
      return tier;
    },
    [service, refresh],
  );

  const deleteTier = useCallback(
    async (id: string): Promise<void> => {
      await service.deleteTier(id);
      void refresh();
    },
    [service, refresh],
  );

  const toggleTier = useCallback(
    async (id: string, active: boolean): Promise<void> => {
      await service.toggleTier(id, active);
      void refresh();
    },
    [service, refresh],
  );

  const setDefaultTier = useCallback(
    async (id: string): Promise<void> => {
      await service.setDefaultTier(id);
      void refresh();
    },
    [service, refresh],
  );

  const reorderTiers = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      await service.reorderTiers(orderedIds);
      void refresh();
    },
    [service, refresh],
  );

  return {
    tiers,
    loading,
    error,
    refresh,
    createTier,
    updateTier,
    deleteTier,
    toggleTier,
    setDefaultTier,
    reorderTiers,
  };
}
