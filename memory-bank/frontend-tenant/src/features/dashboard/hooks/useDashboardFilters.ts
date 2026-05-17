import { useState, useCallback } from 'react';
import type { TimeRange } from '@/shared/types/domain.types';

// ─── useDashboardFilters ──────────────────────────────────────────────────────
// SRP: Manages dashboard filter state (time range + optional department).
// ISP: Exposes only what callers need — getters + typed setters.

export interface DashboardFilters {
  timeRange: TimeRange;
  departmentId?: string;
}

export interface UseDashboardFiltersReturn {
  filters: DashboardFilters;
  setTimeRange: (range: TimeRange) => void;
  setDepartment: (id: string | undefined) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: DashboardFilters = {
  timeRange: '24h',
  departmentId: undefined,
};

export function useDashboardFilters(): UseDashboardFiltersReturn {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const setTimeRange = useCallback((range: TimeRange) => {
    setFilters((prev) => ({ ...prev, timeRange: range }));
  }, []);

  const setDepartment = useCallback((id: string | undefined) => {
    setFilters((prev) => ({ ...prev, departmentId: id }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return { filters, setTimeRange, setDepartment, resetFilters };
}
