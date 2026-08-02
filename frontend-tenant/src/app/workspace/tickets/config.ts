/**
 * tickets/config.ts — Phase 3.A workspace module config.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §6.1.4 (P1) — workspace module config
 * drives the generic WorkspaceModuleBuilder. Adding a new module = one config
 * file; zero new component code.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const ticketsConfig: WorkspaceModuleConfig = {
  id: 'tickets',
  label: 'Tickets',
  dataModel: 'Ticket',
  apiBase: '/api/v1/tickets',
  description: 'Client support tickets with SLA tracking and severity escalation.',
  fields: [
    { key: 'title',     label: 'Title',     type: 'text',     required: true, placeholder: 'Brief summary' },
    { key: 'severity',  label: 'Severity',  type: 'enum',     required: true, options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    { key: 'slaDueAt',  label: 'SLA Due',   type: 'datetime', required: true },
    { key: 'status',    label: 'Status',    type: 'enum',     required: true, options: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
    { key: 'body',      label: 'Description', type: 'markdown' },
  ],
  relationships: {
    customer: { type: 'belongsTo', target: 'Customer', label: 'Customer' },
    assignedAgent: { type: 'belongsTo', target: 'Agent', label: 'Assigned Agent' },
  },
  actions: ['create', 'update', 'assign', 'resolve', 'close'],
  views: ['list', 'detail', 'edit'],
};