/**
 * orders/config.ts — Phase 4.A workspace module config.
 * Orders integrate with the existing Customer record (T4).
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const ordersConfig: WorkspaceModuleConfig = {
  id: 'orders',
  label: 'Orders',
  dataModel: 'Order',
  apiBase: '/api/v1/orders',
  description: 'Order pipeline with fulfillment status, returns tracking, and customer service.',
  fields: [
    { key: 'orderNumber', label: 'Order #', type: 'text',     required: true },
    { key: 'status',      label: 'Status', type: 'enum',     required: true, options: ['PLACED', 'FULFILLED', 'RETURNED', 'CANCELLED'] },
    { key: 'totalAmount', label: 'Total',  type: 'number',   required: true },
    { key: 'placedAt',    label: 'Placed At', type: 'datetime' },
  ],
  relationships: {
    customer: { type: 'belongsTo', target: 'Customer', label: 'Customer' },
  },
  actions: ['create', 'update', 'close'],
  views: ['list', 'detail', 'edit'],
};