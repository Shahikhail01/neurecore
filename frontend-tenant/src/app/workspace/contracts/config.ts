/**
 * contracts/config.ts — Phase 3.A workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const contractsConfig: WorkspaceModuleConfig = {
  id: 'contracts',
  label: 'Contracts',
  dataModel: 'Contract',
  apiBase: '/api/v1/contracts',
  description: 'Client contracts with template support, expiry tracking, and billing schedule.',
  fields: [
    { key: 'name',     label: 'Contract Name', type: 'text', required: true },
    { key: 'startDate', label: 'Start Date',    type: 'date', required: true },
    { key: 'endDate',   label: 'End Date',      type: 'date', required: true },
    { key: 'valueAmount', label: 'Contract Value', type: 'number', required: true },
    { key: 'slaTerms',  label: 'SLA Terms', type: 'markdown' },
    { key: 'billingSchedule', label: 'Billing Schedule', type: 'enum', options: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'MILESTONE'] },
  ],
  relationships: {
    customer: { type: 'belongsTo', target: 'Customer', label: 'Customer' },
  },
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit', 'calendar'],
};