/**
 * campaigns/config.ts — Phase 4.A + 4.B workspace module config.
 * Shared between retail + media via sub-industry visibility.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const campaignsConfig: WorkspaceModuleConfig = {
  id: 'campaigns',
  label: 'Campaigns',
  dataModel: 'Campaign',
  apiBase: '/api/v1/campaigns',
  description: 'Marketing campaigns with audience targeting, budget, and performance.',
  fields: [
    { key: 'name',         label: 'Campaign Name', type: 'text', required: true },
    { key: 'channel',      label: 'Channel',  type: 'enum', required: true, options: ['EMAIL', 'SOCIAL', 'PAID', 'OFFLINE'] },
    { key: 'budget',       label: 'Budget',   type: 'number', required: true },
    { key: 'targetAudience', label: 'Target Audience', type: 'text' },
    { key: 'status',       label: 'Status',   type: 'enum', required: true, options: ['PLANNED', 'ACTIVE', 'PAUSED', 'ENDED'] },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit'],
};