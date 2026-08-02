/**
 * documents/config.ts — Phase 5.B SPO workspace module config.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const documentsConfig: WorkspaceModuleConfig = {
  id: 'documents',
  label: 'Documents',
  dataModel: 'Document',
  apiBase: '/api/v1/documents?scope=spo',
  description: 'Governance record library: board minutes, corporate filings, resolutions — indexed and versioned.',
  fields: [
    { key: 'title',      label: 'Title',     type: 'text',     required: true },
    { key: 'type',       label: 'Type',      type: 'enum',     required: true, options: ['BOARD_MINUTES', 'FILING', 'RESOLUTION', 'POLICY', 'OTHER'] },
    { key: 'effectiveAt', label: 'Effective Date', type: 'date', required: true },
    { key: 'expiresAt',  label: 'Expires',   type: 'date' },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit'],
};