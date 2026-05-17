import { useState, useEffect, useCallback } from "react";
import {
  fetchHealth,
  fetchReadiness,
  fetchLiveness,
  fetchSystemMetrics,
  fetchDetailedHealth,
  HealthResponse,
  DetailedHealthResponse,
  ReadinessResponse,
  LivenessResponse,
  SystemMetrics,
  HealthStatus,
  isHealthy,
} from "../services/health.service";

/**
 * Use Health Monitor Hook
 *
 * React hook for monitoring application health.
 * Provides polling-based health checks with configurable intervals.
 *
 * @param interval - Polling interval in milliseconds (default: 30000)
 * @param enabled - Whether to start polling (default: true)
 */
export function useHealthMonitor(interval = 30000, enabled = true) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [detailedHealth, setDetailedHealth] =
    useState<DetailedHealthResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [liveness, setLiveness] = useState<LivenessResponse | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSystemHealthy, setIsSystemHealthy] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all health data in parallel
      const [healthData, readinessData, livenessData, metricsData] =
        await Promise.all([
          fetchHealth(),
          fetchReadiness(),
          fetchLiveness(),
          fetchSystemMetrics(),
        ]);

      setHealth(healthData);
      setReadiness(readinessData);
      setLiveness(livenessData);
      setSystemMetrics(metricsData);
      setIsSystemHealthy(isHealthy(healthData));

      // Try to get detailed health (may fail if not available)
      try {
        const detailedData = await fetchDetailedHealth();
        setDetailedHealth(detailedData);
      } catch {
        // Detailed health is optional, ignore errors
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Health check failed"));
      setIsSystemHealthy(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    refresh();

    // Set up polling
    const timer = setInterval(refresh, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, refresh]);

  return {
    // Health data
    health,
    detailedHealth,
    readiness,
    liveness,
    systemMetrics,

    // Status
    isLoading,
    error,
    isHealthy: isSystemHealthy,
    status: health?.status || HealthStatus.UNKNOWN,

    // Actions
    refresh,
  };
}

/**
 * Use Readiness Check Hook
 *
 * Lightweight hook for checking if the application is ready.
 * Use this for Kubernetes readiness probes or initial load.
 */
export function useReadinessCheck(interval = 10000) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async () => {
    try {
      const result = await fetchReadiness();
      setIsReady(result.ready);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Readiness check failed"),
      );
      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, interval);
    return () => clearInterval(timer);
  }, [interval, check]);

  return { isReady, isLoading, error, check };
}

/**
 * Use Liveness Check Hook
 *
 * Lightweight hook for checking if the application is alive.
 * Use this for Kubernetes liveness probes.
 */
export function useLivenessCheck(interval = 5000) {
  const [isAlive, setIsAlive] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async () => {
    try {
      const result = await fetchLiveness();
      setIsAlive(result.alive);
      setUptime(result.uptime);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Liveness check failed"));
      setIsAlive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, interval);
    return () => clearInterval(timer);
  }, [interval, check]);

  return { isAlive, uptime, isLoading, error, check };
}

/**
 * Use System Metrics Hook
 *
 * Hook for fetching system resource metrics.
 */
export function useSystemMetrics(interval = 15000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await fetchSystemMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch metrics"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(fetchMetrics, interval);
    return () => clearInterval(timer);
  }, [interval, fetchMetrics]);

  return { metrics, isLoading, error, refresh: fetchMetrics };
}
