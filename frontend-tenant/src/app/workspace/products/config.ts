/**
 * products/config.ts — Phase 4.A workspace module config.
 * Inventory uses Document store (T4 — no specialized SKU entity).
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const productsConfig: WorkspaceModuleConfig = {
  id: 'products',
  label: 'Products',
  dataModel: 'Document:product',
  apiBase: '/api/v1/documents?type=product',
  description: 'Product catalog with inventory levels, pricing, and promotion status.',
  fields: [
    { key: 'name',         label: 'Product Name', type: 'text',     required: true },
    { key: 'sku',          label: 'SKU',          type: 'text',     required: true },
    { key: 'category',     label: 'Category',     type: 'text' },
    { key: 'priceAmount',  label: 'Price',        type: 'number',   required: true },
    { key: 'stockLevel',   label: 'Stock Level',  type: 'number',   required: true },
    { key: 'promoActive',  label: 'Promotion Active', type: 'boolean' },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit'],
};