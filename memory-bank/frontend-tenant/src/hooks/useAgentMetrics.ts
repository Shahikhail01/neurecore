// ─── useAgentMetrics ──────────────────────────────────────────────────────────
// S — Single Responsibility: per-agent observability metrics only
'use client';
import { useState, useEffect, useCallback } from 'react';
import analyticsService, { type AgentMetrics } from '@/services/analytics.service';

export function useAgentMetrics(pollMs = 60_000) {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyticsService.getAgentMetrics();
      setMetrics(data);
    } catch {
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    const interval = setInterval(() => void fetch(), pollMs);
    return () => clearInterval(interval);
  }, [fetch, pollMs]);

  return { metrics, loading, refresh: fetch };
}
