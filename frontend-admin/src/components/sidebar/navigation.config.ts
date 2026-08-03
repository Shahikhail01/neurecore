/**
 * Navigation configuration — single source of truth for the admin sidebar
 * AND the command palette (which both consume this same registry).
 *
 * Phase 10 — Admin Business Composition.
 *
 * SOLID:
 *   OCP — adding a new nav item = one entry here; nothing else changes.
 *   SRP — only describes nav structure; rendering lives in components.
 *   DIP — sidebar/palette components depend on this config object.
 *
 * Each group has a stable `id` and a label; items reference `/admin/…` paths.
 * Icons are short unicode glyphs to match the existing admin visual language.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  description?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Overview', href: '/overview', icon: '◈' },
      { label: 'Tenants', href: '/tenants', icon: '⬟' },
      { label: 'Users', href: '/users', icon: '◫' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { label: 'AI Employees', href: '/agents-pool', icon: '◆' },
      { label: 'Departments', href: '/departments-pool', icon: '⬟' },
      { label: 'Industries', href: '/industries', icon: '⬢' },
      { label: 'Tiers', href: '/tiers', icon: '⬡' },
      { label: 'Features', href: '/features', icon: '✦' },
      { label: 'Packages', href: '/packages', icon: '⎔' },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { label: 'Employee Fleet', href: '/agents', icon: '◈' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { label: 'Models', href: '/models', icon: '⬡' },
      { label: 'Brain Map', href: '/brain', icon: '⬡' },
      { label: 'Strategy', href: '/strategy', icon: '◈' },
    ],
  },
  {
    id: 'control',
    label: 'Control',
    items: [
      { label: 'Monitoring', href: '/monitoring', icon: '◻' },
      { label: 'Security', href: '/security', icon: '◌' },
      { label: 'Connectors', href: '/connectors', icon: '⬟' },
      { label: 'Billing', href: '/billing', icon: '⬡' },
      { label: 'Infrastructure', href: '/infrastructure', icon: '◈' },
      { label: 'Harness Control', href: '/harness-control', icon: '◇' },
      { label: 'Audit Logs', href: '/audit', icon: '◫' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    items: [
      { label: 'Brevo Email', href: '/admin/brevo', icon: '✉' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { label: 'Settings', href: '/settings', icon: '⚙' },
    ],
  },
];

/** Flattened items for the command palette. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

