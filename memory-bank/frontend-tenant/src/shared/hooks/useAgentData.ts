// ─── useAgentData.ts ─────────────────────────────────────────────────────────
// SRP: Agent list fetching + filter state.
// Wraps agentService; exposes typed actions for UI components.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { agentService } from '@/core/services/AgentService';
import type { Agent } from '@/shared/types/domain.types';
import type { AgentFilters } from '@/core/services/interfaces/IAgentService';

interface UseAgentDataReturn {
  agents: Agent[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: AgentFilters;
  setFilters: (f: Partial<AgentFilters>) => void;
  refresh: () => void;
}

export function useAgentData(initial?: AgentFilters): UseAgentDataReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AgentFilters>({ page: 1, limit: 20, ...initial });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await agentService.listAgents(filters);
      setAgents(result.agents);
      setTotal(result.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((f: Partial<AgentFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  return { agents, total, loading, error, filters, setFilters, refresh: load };
}
