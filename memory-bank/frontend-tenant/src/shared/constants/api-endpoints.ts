// ─── api-endpoints.ts ─────────────────────────────────────────────────────────
// OCP: One place to add new endpoints — nothing else changes.
// Never hardcode paths in repositories or components.

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  AGENTS: {
    LIST: '/agents',
    DETAIL: (id: string) => `/agents/${id}`,
    EXECUTIONS: (id: string) => `/agents/${id}/executions`,
    CHAT: (id: string) => `/agents/${id}/chat`,
  },
  TASKS: {
    LIST: '/tasks',
    DETAIL: (id: string) => `/tasks/${id}`,
    DELEGATE: (id: string) => `/tasks/${id}/delegate`,
  },
  WORKFLOWS: {
    LIST: '/workflows',
    DETAIL: (id: string) => `/workflows/${id}`,
    ACTIVATE: (id: string) => `/workflows/${id}/activate`,
    EXECUTE: (id: string) => `/workflows/${id}/execute`,
    STATUS: (id: string) => `/workflows/${id}/status`,
  },
  DEPARTMENTS: {
    LIST: '/departments',
    DETAIL: (id: string) => `/departments/${id}`,
  },
  APPROVALS: {
    LIST: '/governance/approvals',
    DETAIL: (id: string) => `/governance/approvals/${id}`,
    APPROVE: (id: string) => `/governance/approvals/${id}/approve`,
    REJECT: (id: string) => `/governance/approvals/${id}/reject`,
  },
  ANALYTICS: {
    OVERVIEW: '/analytics/overview',
    AGENT_PERFORMANCE: '/analytics/agents',
    TASK_TRENDS: '/analytics/tasks',
    DEPARTMENT_METRICS: '/analytics/departments',
  },
  EXECUTIONS: {
    LIST: '/executions',
  },
  HEALTH: '/health',
} as const;
