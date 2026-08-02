/**
 * knowledge/config.ts — Phase 3.A workspace module config (Knowledge Base).
 */

import type { WorkspaceModuleConfig } from '@/lib/industry-workspace-models';

export const knowledgeConfig: WorkspaceModuleConfig = {
  id: 'knowledge',
  label: 'Knowledge Base',
  dataModel: 'Article',
  apiBase: '/api/v1/knowledge',
  description: 'Markdown wiki articles, runbooks, and shared team knowledge.',
  fields: [
    { key: 'title',    label: 'Title',   type: 'text',     required: true },
    { key: 'category', label: 'Category', type: 'enum',     required: true, options: ['RUNBOOK', 'PROCESS', 'ARCHITECTURE', 'TROUBLESHOOTING', 'OTHER'] },
    { key: 'contentMarkdown', label: 'Content (Markdown)', type: 'markdown', required: true },
  ],
  relationships: {
    ownerAgent: { type: 'belongsTo', target: 'Agent', label: 'Owner Agent' },
  },
  actions: ['create', 'update', 'archive'],
  views: ['list', 'detail', 'edit'],
};