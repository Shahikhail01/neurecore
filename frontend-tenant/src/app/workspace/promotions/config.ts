/**
 * promotions/config.ts — Phase 4.A workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const promotionsConfig: WorkspaceModuleConfig = {
  id: 'promotions',
  label: 'Promotions',
  dataModel: 'Promotion',
  apiBase: '/api/v1/promotions',
  description: 'Active promotions, discount tracking, ROI analysis, campaign calendar.',
  fields: [
    { key: 'name',         label: 'Promotion Name', type: 'text', required: true },
    { key: 'discountPercent', label: 'Discount %', type: 'number', required: true },
    { key: 'validFrom',    label: 'Valid From', type: 'date', required: true },
    { key: 'validTo',      label: 'Valid To',   type: 'date', required: true },
    { key: 'status',       label: 'Status',     type: 'enum', required: true, options: ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'] },
    { key: 'roiEstimate',  label: 'ROI Estimate', type: 'number' },
  ],
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit', 'calendar'],
};