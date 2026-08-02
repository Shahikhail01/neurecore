/**
 * stores/config.ts — Phase 4.A workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const storesConfig: WorkspaceModuleConfig = {
  id: 'stores',
  label: 'Stores',
  dataModel: 'Store',
  apiBase: '/api/v1/stores',
  description: 'Store performance dashboard, sales by store, inventory by location.',
  fields: [
    { key: 'name',          label: 'Store Name', type: 'text', required: true },
    { key: 'address',       label: 'Address',    type: 'text' },
    { key: 'openingHours',  label: 'Opening Hours', type: 'text' },
    { key: 'manager',       label: 'Manager',    type: 'text' },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit'],
};