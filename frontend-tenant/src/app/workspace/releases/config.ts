/**
 * releases/config.ts — Phase 3.A workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const releasesConfig: WorkspaceModuleConfig = {
  id: 'releases',
  label: 'Releases',
  dataModel: 'Release',
  apiBase: '/api/v1/releases',
  description: 'Software releases with feature tracking, milestone dates, and rollback plans.',
  fields: [
    { key: 'name',     label: 'Release Name', type: 'text', required: true, placeholder: 'e.g. v2.4.0' },
    { key: 'version',  label: 'Version',     type: 'text', required: true },
    { key: 'targetDate', label: 'Target Date', type: 'date', required: true },
    { key: 'status',   label: 'Status',      type: 'enum', required: true, options: ['PLANNED', 'IN_DEVELOPMENT', 'TESTING', 'DEPLOYED', 'ROLLED_BACK'] },
    { key: 'rollbackPlan', label: 'Rollback Plan', type: 'markdown' },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit', 'calendar'],
};