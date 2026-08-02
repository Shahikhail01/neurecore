/**
 * grants/config.ts — Phase 5.A NGO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const grantsConfig: WorkspaceModuleConfig = {
  id: 'grants',
  label: 'Grants',
  dataModel: 'Grant',
  apiBase: '/api/v1/grants',
  description: 'Grant pipeline with funder info, amounts, status, and due dates.',
  fields: [
    { key: 'funderName', label: 'Funder',       type: 'text',   required: true },
    { key: 'amount',     label: 'Amount',       type: 'number', required: true },
    { key: 'status',     label: 'Status',       type: 'enum',   required: true, options: ['PROSPECTING', 'DRAFTING', 'SUBMITTED', 'AWARDED', 'REJECTED', 'REPORTING'] },
    { key: 'dueDate',    label: 'Due Date',     type: 'date',   required: true },
    { key: 'ownerAgent', label: 'Owner',        type: 'text' },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit', 'calendar', 'kanban'],
};