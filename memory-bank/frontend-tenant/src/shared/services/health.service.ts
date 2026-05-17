/**
 * Health Monitoring Service
 *
 * Provides health check utilities for the Tenant frontend.
 * Follows SOLID principles with proper type safety.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Health status types
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Health response
 */
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  duration?: number;
  checks: Record<string, HealthCheckResult>;
  version?: string;
  build?: {
    version: string;
    timestamp: string;
    environment: string;
  };
}

/**
 * Detailed health response
 */
export interface DetailedHealthResponse extends HealthResponse {
  system?: SystemMetrics;
  business?: BusinessMetrics;
}

/**
 * System metrics
 */
export interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percentage: number };
  eventLoop: { lag: number };
  heap: { used: number; total: number; percentage: number };
  external: number;
  rss: number;
  timestamp: string;
  uptime?: number;
}

/**
 * Business metrics
 */
export interface BusinessMetrics {
  activeTenants: number;
  activeUsers: number;
  totalApiCalls: number;
  apiCallsLastHour: number;
  avgApiLatency: number;
  errorRate: number;
}

/**
 * Readiness response
 */
export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: {
    database?: HealthCheckResult;
    cache?: HealthCheckResult;
  };
}

/**
 * Liveness response
 */
export interface LivenessResponse {
  alive: boolean;
  uptime: number;
  timestamp: string;
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  circuitBreakers: Record<string, { state: string; failures: number }>;
  timestamp: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get API base URL from environment
 */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return (window as any).ENV?.NEXT_PUBLIC_API_URL || "/api";
  }
  return process.env.NEXT_PUBLIC_API_URL || "/api";
}

const API_BASE_URL = getApiBaseUrl();

/**
 * Fetch health check data
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch detailed health check data
 */
export async function fetchDetailedHealth(): Promise<DetailedHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/health/detailed`);
  if (!response.ok) {
    throw new Error(`Detailed health check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch readiness status
 */
export async function fetchReadiness(): Promise<ReadinessResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/health/ready`);
  if (!response.ok) {
    throw new Error(`Readiness check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch liveness status
 */
export async function fetchLiveness(): Promise<LivenessResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/health/live`);
  if (!response.ok) {
    throw new Error(`Liveness check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch system metrics
 */
export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  const response = await fetch(`${API_BASE_URL}/v1/health/system`);
  if (!response.ok) {
    throw new Error(`System metrics fetch failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch circuit breaker status
 */
export async function fetchCircuitBreakers(): Promise<CircuitBreakerStatus> {
  const response = await fetch(`${API_BASE_URL}/v1/health/circuit-breakers`);
  if (!response.ok) {
    throw new Error(`Circuit breaker fetch failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Reset circuit breakers
 */
export async function resetCircuitBreakers(): Promise<{ message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/health/circuit-breakers/reset`,
  );
  if (!response.ok) {
    throw new Error(`Circuit breaker reset failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch Prometheus metrics
 */
export async function fetchMetrics(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/v1/health/metrics`);
  if (!response.ok) {
    throw new Error(`Metrics fetch failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.metrics;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the application is healthy
 */
export function isHealthy(health: HealthResponse): boolean {
  return (
    health.status === HealthStatus.HEALTHY ||
    health.status === HealthStatus.DEGRADED
  );
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return "#10B981"; // green
    case HealthStatus.DEGRADED:
      return "#F59E0B"; // amber
    case HealthStatus.UNHEALTHY:
      return "#EF4444"; // red
    default:
      return "#6B7280"; // gray
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return "Healthy";
    case HealthStatus.DEGRADED:
      return "Degraded";
    case HealthStatus.UNHEALTHY:
      return "Unhealthy";
    default:
      return "Unknown";
  }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format uptime to human readable
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}

/**
 * Format latency to human readable
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
