// ─── routes.ts ────────────────────────────────────────────────────────────────
// Single source of truth for all frontend routes.
// OCP: Add new routes here — nothing else needs to change.

export const ROUTES = {
  // Public
  LOGIN: '/login',
  REGISTER: '/register',

  // Authenticated
  DASHBOARD: '/dashboard',
  AGENTS: {
    ROOT: '/agents',
    DETAIL: (id: string) => `/agents/${id}`,
  },
  DEPARTMENTS: {
    ROOT: '/departments',
    DETAIL: (id: string) => `/departments/${id}`,
  },
  TASKS: {
    ROOT: '/tasks',
    DELEGATE: '/tasks/delegate',
    DETAIL: (id: string) => `/tasks/${id}`,
  },
  WORKFLOWS: {
    ROOT: '/workflows',
    BUILDER: '/workflows/builder',
    DETAIL: (id: string) => `/workflows/${id}`,
  },
  APPROVALS: '/approvals',
  ANALYTICS: '/analytics',
  CONNECTORS: '/connectors',
  BILLING: '/billing',
  SETTINGS: {
    ROOT: '/settings',
    PROFILE: '/settings/profile',
    NOTIFICATIONS: '/settings/notifications',
    APPEARANCE: '/settings/appearance',
    INTEGRATIONS: '/settings/integrations',
    AGENTS: '/settings/agents',
    SYSTEM: '/settings/system',
  },
} as const;

export type AppRoute = string;
