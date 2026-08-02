/**
 * assets/config.ts — Phase 5.B SPO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const assetsConfig: WorkspaceModuleConfig = {
  id: 'assets',
  label: 'Assets',
  dataModel: 'Asset',
  apiBase: '/api/v1/assets',
  description: 'Asset register: real estate, equity, private investments, cash, other.',
  fields: [
    { key: 'name',           label: 'Asset Name', type: 'text',   required: true },
    { key: 'type',           label: 'Type',       type: 'enum',   required: true, options: ['REAL_ESTATE', 'EQUITY', 'PRIVATE_INVESTMENT', 'CASH', 'OTHER'] },
    { key: 'ownerEntityId',  label: 'Owner Entity', type: 'text', required: true },
    { key: 'currentValuation', label: 'Current Valuation', type: 'number' },
    { key: 'lastReviewedAt', label: 'Last Reviewed', type: 'date' },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit'],
};