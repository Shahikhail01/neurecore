/**
 * industry-workspace-models.ts
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §6.1.2 (P1) — shared types for
 * the generic Workspace module builder.
 *
 * Every workspace module page is configured via one of these. Single source
 * of truth for module shape across all kept Industries.
 */

export type WorkspaceFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'boolean'
  | 'markdown'
  | 'json';

export interface WorkspaceFieldDef {
  key: string;
  label: string;
  type: WorkspaceFieldType;
  required?: boolean;
  options?: string[];
  hint?: string;
  placeholder?: string;
}

export type WorkspaceRelationshipType = 'belongsTo' | 'hasMany';

export interface WorkspaceRelationshipDef {
  type: WorkspaceRelationshipType;
  target: 'Customer' | 'Agent' | 'Project' | 'User';
  label: string;
}

export type WorkspaceAction = 'create' | 'update' | 'delete' | 'assign' | 'resolve' | 'close' | 'archive';
export type WorkspaceView = 'list' | 'detail' | 'edit' | 'kanban' | 'calendar';

export interface WorkspaceModuleConfig {
  /** Stable id matching INDUSTRY_NAV_CONFIGS[*].workspaceExtras[*].id. */
  id: string;
  /** Display label. */
  label: string;
  /** Backend data model name. */
  dataModel: string;
  /** REST API base path. */
  apiBase: string;
  /** One-line description (header + tooltip). */
  description: string;
  /** Field schema for the list + detail + edit views. */
  fields: WorkspaceFieldDef[];
  /** Relationships rendered as foreign-key selectors in the edit view. */
  relationships?: Record<string, WorkspaceRelationshipDef>;
  /** Actions surfaced as buttons in the list + detail views. */
  actions?: WorkspaceAction[];
  /** Views to render (defaults to ['list', 'detail', 'edit']). */
  views?: WorkspaceView[];
}