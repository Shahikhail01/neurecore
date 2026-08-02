/**
 * content/config.ts — Phase 4.A + 4.B workspace module config.
 * Shared between retail + media via sub-industry visibility.
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const contentConfig: WorkspaceModuleConfig = {
  id: 'content',
  label: 'Content',
  dataModel: 'ContentItem',
  apiBase: '/api/v1/content',
  description: 'Content calendar, production schedule, publishing pipeline, performance.',
  fields: [
    { key: 'title',       label: 'Title', type: 'text', required: true },
    { key: 'type',        label: 'Type',  type: 'enum', required: true, options: ['BLOG', 'VIDEO', 'SOCIAL', 'EMAIL'] },
    { key: 'publishDate', label: 'Publish Date', type: 'datetime' },
    { key: 'status',      label: 'Status', type: 'enum', required: true, options: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] },
  ],
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit', 'calendar'],
};