/**
 * registerTenantCommands — registers all tenant portal navigation commands
 * Called once at shell mount. O principle: new commands are added here, never
 * by modifying CommandPalette.tsx itself.
 */

import { commandRegistry } from './command-registry';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function registerTenantCommands(router: AppRouterInstance): () => void {
  const unregister = commandRegistry.registerMany([
    // ── Navigation ──────────────────────────────────────────────────────────
    {
      id: 'nav:dashboard',
      label: 'Go to Dashboard',
      group: 'Navigate',
      shortcut: 'G D',
      action: () => router.push('/dashboard'),
    },
    {
      id: 'nav:agents',
      label: 'Go to Agents',
      group: 'Navigate',
      shortcut: 'G A',
      action: () => router.push('/agents'),
    },
    {
      id: 'nav:tasks',
      label: 'Go to Tasks',
      group: 'Navigate',
      shortcut: 'G T',
      action: () => router.push('/tasks'),
    },
    {
      id: 'nav:workflows',
      label: 'Go to Workflows',
      group: 'Navigate',
      shortcut: 'G W',
      action: () => router.push('/workflows'),
    },
    {
      id: 'nav:departments',
      label: 'Go to Departments',
      group: 'Navigate',
      action: () => router.push('/departments'),
    },
    {
      id: 'nav:approvals',
      label: 'Go to Approvals',
      group: 'Navigate',
      action: () => router.push('/approvals'),
    },
    {
      id: 'nav:analytics',
      label: 'Go to Analytics',
      group: 'Navigate',
      shortcut: 'G N',
      action: () => router.push('/analytics'),
    },
    {
      id: 'nav:billing',
      label: 'Go to Billing',
      group: 'Navigate',
      action: () => router.push('/billing'),
    },
    {
      id: 'nav:connectors',
      label: 'Go to Connectors',
      group: 'Navigate',
      action: () => router.push('/connectors'),
    },
    {
      id: 'nav:settings',
      label: 'Go to Settings',
      group: 'Navigate',
      action: () => router.push('/settings'),
    },

    // ── Actions ─────────────────────────────────────────────────────────────
    {      id: 'action:delegate-task',
      label: 'Delegate a Task',
      group: 'Actions',
      shortcut: 'D T',
      action: () => router.push('/tasks/delegate'),
    },
    {      id: 'action:new-agent',
      label: 'Deploy New Agent',
      group: 'Actions',
      shortcut: '⌘ N',
      action: () => router.push('/agents/new'),
    },
    {
      id: 'action:new-workflow',
      label: 'Create New Workflow',
      group: 'Actions',
      action: () => router.push('/workflows'),
    },
  ]);

  return unregister;
}
