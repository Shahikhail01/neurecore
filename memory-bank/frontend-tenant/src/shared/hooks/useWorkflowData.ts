// ─── useWorkflowData.ts ───────────────────────────────────────────────────────
// SRP: Workflow list fetching + filter state.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { workflowService } from '@/core/services/WorkflowService';
import type { Workflow } from '@/shared/types/domain.types';
import type { WorkflowFilters } from '@/core/services/interfaces/IWorkflowService';

interface UseWorkflowDataReturn {
  workflows: Workflow[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: WorkflowFilters;
  setFilters: (f: Partial<WorkflowFilters>) => void;
  refresh: () => void;
}

export function useWorkflowData(initial?: WorkflowFilters): UseWorkflowDataReturn {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<WorkflowFilters>({ page: 1, limit: 20, ...initial });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowService.listWorkflows(filters);
      setWorkflows(result.workflows);
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

  const setFilters = useCallback((f: Partial<WorkflowFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  return { workflows, total, loading, error, filters, setFilters, refresh: load };
}
