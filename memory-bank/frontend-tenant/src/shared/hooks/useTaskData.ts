// ─── useTaskData.ts ───────────────────────────────────────────────────────────
// SRP: Task list fetching + filter state.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { taskService } from '@/core/services/TaskService';
import type { Task } from '@/shared/types/domain.types';
import type { TaskFilters } from '@/core/services/interfaces/ITaskService';

interface UseTaskDataReturn {
  tasks: Task[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: TaskFilters;
  setFilters: (f: Partial<TaskFilters>) => void;
  refresh: () => void;
}

export function useTaskData(initial?: TaskFilters): UseTaskDataReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TaskFilters>({ page: 1, limit: 20, ...initial });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await taskService.listTasks(filters);
      setTasks(result.tasks);
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

  const setFilters = useCallback((f: Partial<TaskFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  return { tasks, total, loading, error, filters, setFilters, refresh: load };
}
