// ─── api.config.ts ────────────────────────────────────────────────────────────
// Single place to manage all API-level configuration.

export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  TIMEOUT_MS: 30_000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1_000,
  /** Short-lived cache TTLs per entity type (seconds) */
  CACHE_TTL: {
    AGENTS: 60,
    WORKFLOWS: 60,
    TASKS: 30,
    DEPARTMENTS: 120,
    ANALYTICS: 300,
    APPROVALS: 15,
  },
} as const;
