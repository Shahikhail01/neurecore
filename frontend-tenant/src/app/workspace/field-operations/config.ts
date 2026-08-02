/**
 * field-operations/config.ts — Phase 5.A NGO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const fieldOpsConfig: WorkspaceModuleConfig = {
  id: 'field-operations',
  label: 'Field Operations',
  dataModel: 'FieldMission',
  apiBase: '/api/v1/field-missions',
  description: 'Field mission tracking: site, dates, team size, beneficiary count, status.',
  fields: [
    { key: 'programId',        label: 'Program',          type: 'text',   required: true },
    { key: 'siteName',         label: 'Site',             type: 'text',   required: true },
    { key: 'startDate',        label: 'Start Date',       type: 'date',   required: true },
    { key: 'endDate',          label: 'End Date',         type: 'date' },
    { key: 'teamSize',         label: 'Team Size',        type: 'number', required: true },
    { key: 'beneficiaryCount', label: 'Beneficiaries',    type: 'number' },
    { key: 'status',           label: 'Status',           type: 'enum',   required: true, options: ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit', 'calendar'],
};