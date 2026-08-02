/**
 * operations/config.ts — Phase 5.B SPO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const operationsConfig: WorkspaceModuleConfig = {
  id: 'operations',
  label: 'Operations',
  dataModel: 'HoldingOperation',
  apiBase: '/api/v1/operations',
  description: 'Inter-entity coordination: shared services, vendor tracking, efficiency KPIs.',
  fields: [
    { key: 'name',       label: 'Operation Name', type: 'text', required: true },
    { key: 'entityIds',  label: 'Entities Involved', type: 'text' },
    { key: 'status',     label: 'Status',  type: 'enum', required: true, options: ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'] },
    { key: 'ownerAgent', label: 'Owner',   type: 'text' },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit', 'kanban'],
};