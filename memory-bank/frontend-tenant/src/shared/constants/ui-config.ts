// ─── ui-config.ts ─────────────────────────────────────────────────────────────
// UI constants: navigation, labels, status mappings, visual config.
// OCP: New statuses / nav items extend the config — no logic changes needed.

import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: ROUTES.DASHBOARD,         icon: '⬡' },
  { label: 'Agents',        href: ROUTES.AGENTS.ROOT,       icon: '◈' },
  { label: 'Departments',   href: ROUTES.DEPARTMENTS.ROOT,  icon: '⬟' },
  { label: 'Tasks',         href: ROUTES.TASKS.ROOT,        icon: '◫' },
  { label: 'Delegate',      href: ROUTES.TASKS.DELEGATE,    icon: '⟲' },
  { label: 'Workflows',     href: ROUTES.WORKFLOWS.ROOT,    icon: '⤡' },
  { label: 'Approvals',     href: ROUTES.APPROVALS,         icon: '◻' },
  { label: 'Analytics',     href: ROUTES.ANALYTICS,         icon: '◈' },
  { label: 'Connectors',    href: ROUTES.CONNECTORS,        icon: '⬟' },
  { label: 'Billing',       href: ROUTES.BILLING,           icon: '⬡' },
  { label: 'Settings',      href: ROUTES.SETTINGS.ROOT,     icon: '◌' },
];

// Status → display config for agents, tasks, workflows
export const AGENT_STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    color: 'text-status-profit',   dot: 'bg-status-profit' },
  INACTIVE:  { label: 'Inactive',  color: 'text-status-neutral',  dot: 'bg-status-neutral' },
  TRAINING:  { label: 'Training',  color: 'text-status-ops',      dot: 'bg-status-ops' },
  ERROR:     { label: 'Error',     color: 'text-status-risk',     dot: 'bg-status-risk' },
  PAUSED:    { label: 'Paused',    color: 'text-status-warn',     dot: 'bg-status-warn' },
} as const;

export const TASK_STATUS_CONFIG = {
  PENDING:     { label: 'Pending',      color: 'text-status-neutral', dot: 'bg-status-neutral' },
  ASSIGNED:    { label: 'Assigned',     color: 'text-status-ops',     dot: 'bg-status-ops' },
  IN_PROGRESS: { label: 'In Progress',  color: 'text-status-ops',     dot: 'bg-status-ops' },
  COMPLETED:   { label: 'Completed',    color: 'text-status-profit',  dot: 'bg-status-profit' },
  FAILED:      { label: 'Failed',       color: 'text-status-risk',    dot: 'bg-status-risk' },
  CANCELLED:   { label: 'Cancelled',    color: 'text-status-neutral', dot: 'bg-status-neutral' },
} as const;

export const WORKFLOW_STATUS_CONFIG = {
  DRAFT:    { label: 'Draft',    color: 'text-status-neutral' },
  ACTIVE:   { label: 'Active',   color: 'text-status-profit' },
  PAUSED:   { label: 'Paused',   color: 'text-status-warn' },
  ARCHIVED: { label: 'Archived', color: 'text-status-neutral' },
  ERROR:    { label: 'Error',    color: 'text-status-risk' },
} as const;

export const AGENT_MOOD_EMOJI: Record<string, string> = {
  busy:       '🔥',
  idle:       '😊',
  optimistic: '🚀',
  stressed:   '😰',
  offline:    '💤',
};

export const PRIORITY_CONFIG = {
  LOW:      { label: 'Low',      color: 'text-status-neutral' },
  MEDIUM:   { label: 'Medium',   color: 'text-status-warn' },
  HIGH:     { label: 'High',     color: 'text-orange-400' },
  CRITICAL: { label: 'Critical', color: 'text-status-risk' },
} as const;

export const PAGINATION_DEFAULT = {
  PAGE: 1,
  LIMIT: 20,
} as const;

export const TOAST_DURATION_MS = 4000;
export const DEBOUNCE_MS = 300;
export const REFRESH_INTERVAL_MS = 30_000;
