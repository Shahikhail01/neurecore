/**
 * usePlatformKpis — polls platform-wide KPI data every 30 s
 * I (Interface Segregation): this hook exposes only what KPI tiles need
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminMetricsService } from '@/services/admin-metrics.service';
import type { PlatformKpis } from '@/types/ui.types';

interface UsePlatformKpisResult {
  kpis: PlatformKpis | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePlatformKpis(): UsePlatformKpisResult {
  const [kpis, setKpis] = useState<PlatformKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await adminMetricsService.getPlatformKpis();
      setKpis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load platform KPIs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { kpis, loading, error, refresh: fetch };
}
