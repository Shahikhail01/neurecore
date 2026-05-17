// ─── useChartData ─────────────────────────────────────────────────────────────
// S — Single Responsibility: fetch time-series chart data for a given metric + range
'use client';
import { useState, useEffect, useCallback } from 'react';
import analyticsService from '@/services/analytics.service';
import type { ChartTimeRange, TimeSeriesPoint } from '@/types/ui.types';

export function useChartData(metric: string, range: ChartTimeRange) {
  const [data, setData] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const points = await analyticsService.getTimeSeriesData(metric, range);
      setData(points);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [metric, range]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { data, loading, refresh: fetch };
}
