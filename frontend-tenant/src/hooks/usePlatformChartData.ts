/**
 * usePlatformChartData — fetches platform time-series for a given metric + range
 * I principle: focused on chart data only
 */
'use client';

import { useState, useEffect } from 'react';
import { adminMetricsService } from '@/services/admin-metrics.service';
import type { TimeSeriesPoint } from '@/types/ui.types';
import type { ChartTimeRange } from '@/types/ui.types';

type ServiceRange = '24h' | '7d' | '30d';

function toServiceRange(r: ChartTimeRange): ServiceRange {
  if (r === '1h') return '24h';
  if (r === '90d') return '30d';
  return r as ServiceRange;
}

interface UsePlatformChartResult {
  data: TimeSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function usePlatformChartData(
  metric: 'tasks' | 'errors' | 'cost' | 'agents',
  range: ChartTimeRange,
): UsePlatformChartResult {
  const [data, setData] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminMetricsService
      .getTimeSeriesData(metric, toServiceRange(range))
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chart data error'))
      .finally(() => setLoading(false));
  }, [metric, range]);

  return { data, loading, error };
}
