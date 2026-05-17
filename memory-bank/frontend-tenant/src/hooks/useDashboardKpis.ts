// ─── useDashboardKpis ─────────────────────────────────────────────────────────
// S — Single Responsibility: fetch and poll dashboard KPI values only
'use client';
import { useState, useEffect, useCallback } from 'react';
import analyticsService from '@/services/analytics.service';
import type { DashboardKpis } from '@/types/ui.types';

export function useDashboardKpis(pollMs = 30_000) {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await analyticsService.getDashboardKpis();
      setKpis(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    const interval = setInterval(() => void fetch(), pollMs);
    return () => clearInterval(interval);
  }, [fetch, pollMs]);

  return { kpis, loading, error, refresh: fetch };
}
