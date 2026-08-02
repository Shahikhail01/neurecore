/**
 * inventory/config.ts — Phase 4.A workspace module config.
 * Inventory uses Document store (T4).
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const inventoryConfig: WorkspaceModuleConfig = {
  id: 'inventory',
  label: 'Inventory',
  dataModel: 'Document:product',
  apiBase: '/api/v1/documents?type=product&view=inventory',
  description: 'Stock levels with reorder points and supplier performance.',
  fields: [
    { key: 'name',         label: 'Product',  type: 'text',   required: true },
    { key: 'sku',          label: 'SKU',      type: 'text',   required: true },
    { key: 'stockLevel',   label: 'On Hand',  type: 'number', required: true },
    { key: 'reorderPoint', label: 'Reorder At', type: 'number' },
    { key: 'supplier',     label: 'Supplier', type: 'text' },
  ],
  actions: ['update'],
  views: ['list'],
};