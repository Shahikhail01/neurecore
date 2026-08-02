/**
 * programs/config.ts — Phase 5.A NGO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const programsConfig: WorkspaceModuleConfig = {
  id: 'programs',
  label: 'Programs',
  dataModel: 'Program',
  apiBase: '/api/v1/programs',
  description: 'Program directory with beneficiary counts, budgets, status, and KPI tracking.',
  fields: [
    { key: 'name',            label: 'Program Name', type: 'text', required: true },
    { key: 'beneficiaryCount', label: 'Beneficiaries', type: 'number', required: true },
    { key: 'budget',          label: 'Budget', type: 'number', required: true },
    { key: 'status',          label: 'Status', type: 'enum', required: true, options: ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'] },
    { key: 'startDate',       label: 'Start Date', type: 'date', required: true },
    { key: 'endDate',         label: 'End Date',   type: 'date' },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit', 'kanban'],
};