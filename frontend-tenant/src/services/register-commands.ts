/**
 * registerTenantCommands — registers all tenant portal navigation commands
 * Called once at shell mount. O principle: new commands are added here, never
 * by modifying CommandPalette.tsx itself.
 */

import { commandRegistry } from './command-registry';
import { useChatStore } from '@/core/services/chat/chat.factory';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function registerTenantCommands(router: AppRouterInstance): () => void {
  // ── Phase 10.4 — Creatio AI parity ─────────────────────────
  // Parity AI actions open the chat and seed a pre-formed prompt. The user
  // can edit then send; the chat dispatches the matching backend nc.* tool
  // (Phase 10.3: score_lead, next_best_step, forecast_pipeline, …).
  const promptChat = (prompt: string) => {
    useChatStore.getState().requestExternalSend(prompt);
  };

  const unregister = commandRegistry.registerMany([
    // ── Navigation ──────────────────────────────────────────────────────────
    {
      id: 'nav:home',
      label: 'Go to Home',
      group: 'Navigate',
      shortcut: 'G H',
      action: () => router.push('/home'),
    },
    {
      id: 'nav:command-center',
      label: 'Go to Command Center (legacy)',
      group: 'Navigate',
      shortcut: 'G C',
      action: () => router.push('/command-center'),
    },
    {
      id: 'nav:dashboard',
      label: 'Go to Dashboard (legacy)',
      group: 'Navigate',
      shortcut: 'G D',
      action: () => router.push('/dashboard'),
    },
    {
      id: 'nav:agents',
      label: 'Go to Employees',
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

    // ── AI Actions (Phase 10.4 — Creatio AI parity) ─────────────────────────
    {
      id: 'ai:score-lead',
      label: 'AI: Score a lead',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ S',
      action: () => promptChat('Score this lead for propensity to buy and explain the top 3 drivers.'),
    },
    {
      id: 'ai:next-step',
      label: 'AI: Next best action',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ N',
      action: () => promptChat('What is the next best action for this deal? Explain why.'),
    },
    {
      id: 'ai:forecast',
      label: 'AI: Forecast pipeline',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ F',
      action: () => promptChat('Forecast the pipeline for this quarter with a weighted total and confidence interval.'),
    },
    {
      id: 'ai:quote',
      label: 'AI: Generate quote',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ Q',
      action: () => promptChat('Generate a draft quote for this deal with 3 line items and our standard discount.'),
    },
    {
      id: 'ai:case',
      label: 'AI: Resolve case',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ C',
      action: () => promptChat('Suggest next best action for this service case and draft a reply.'),
    },
    {
      id: 'ai:summarize',
      label: 'AI: Summarize & search KB',
      group: 'AI Actions',
      shortcut: '⌘ ⇧ K',
      action: () => promptChat('Summarize recent activity on this customer and search the knowledge base for related articles.'),
    },
    {
      id: 'ai:customer-360',
      label: 'AI: Customer 360',
      group: 'AI Actions',
      action: () => promptChat('Show me the 360 view of this customer — recent touchpoints, open deals, latest intent signal.'),
    },
    {
      id: 'ai:twin',
      label: 'AI: Run my Twin',
      group: 'AI Actions',
      action: () => promptChat('Run my AI Twin on this task and report what it would do.'),
    },
    {
      id: 'ai:send',
      label: 'AI: Send via channel',
      group: 'AI Actions',
      action: () => promptChat('Send this message via email to the customer contact.'),
    },
  ]);

  return unregister;
}
