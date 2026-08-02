/**
 * cases/config.ts — Phase 5.A NGO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const casesConfig: WorkspaceModuleConfig = {
  id: 'cases',
  label: 'Cases',
  dataModel: 'BeneficiaryCase',
  apiBase: '/api/v1/cases',
  description: 'Beneficiary case tracking with anonymized beneficiary IDs and intervention history.',
  fields: [
    { key: 'caseNumber',   label: 'Case #',         type: 'text',   required: true },
    { key: 'beneficiaryId', label: 'Beneficiary ID', type: 'text',   required: true },
    { key: 'openedAt',     label: 'Opened At',      type: 'datetime', required: true },
    { key: 'status',       label: 'Status',         type: 'enum',   required: true, options: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
    { key: 'assignedAgent',label: 'Assigned Agent', type: 'text' },
  ],
  relationships: {
    beneficiary: { type: 'belongsTo', target: 'Customer', label: 'Beneficiary' },
  },
  actions: ['create', 'update', 'resolve', 'close'],
  views: ['list', 'detail', 'edit', 'kanban'],
};