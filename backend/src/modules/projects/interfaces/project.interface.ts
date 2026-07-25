/**
 * Projects Module — Interface Definitions
 *
 * Following SOLID:
 * - Interface Segregation: focused interfaces for repository patterns
 * - Dependency Inversion: module depends on abstractions
 */

import type { ProjectStatus } from '../common/project-lifecycle';
export type { ProjectStatus };

export type BudgetType = 'FIXED_FEE' | 'HOURLY' | 'RETAINER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Project entity type — mirrors the Prisma Project model after Phase 1 migration.
 */
export type Project = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: import('../common/project-lifecycle').ProjectStatus;

  customerId: string | null;
  projectTypeId: string | null;
  projectTypeVersion: number | null;

  /**
   * INDUSTRY-SETUP-CONCEPT.md §3.1 G2 — project-level industry tag.
   * Mirrors the schema column added in the 20260722_project_industry migration.
   * Optional on this type to keep the existing test factories backward-
   * compatible (they don't construct an `industry` value).
   */
  industry?: string | null;

  budgetType: BudgetType | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;

  goalIds: string[];
  departmentId: string | null;

  parentProjectId: string | null;
  clonedFromProjectId: string | null;

  lostReason: string | null;
  customFieldValues: Record<string, unknown> | null;

  targetDate: Date | null;
  startDate: Date | null;
  completedAt: Date | null;

  priority: Priority | null;
  tags: string[];
  metadata: unknown;

  createdAt: Date;
  updatedAt: Date;
};

// ─── Repository / Service Inputs ──────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  customerId?: string | null;
  projectTypeId?: string | null;
  projectTypeVersion?: number | null;
  /**
   * Industry slug (e.g. "financial-services"). When supplied, the project
   * row is created with this value on Project.industry — queryable without
   * parsing derivedShape JSONB. Phase 0 G2 (INDUSTRY-SETUP-CONCEPT.md §3.1
   * G2). Typically derived by ProjectsService from the synthesised shape
   * or from Tenant.industry; callers normally don't set this directly.
   */
  industry?: string | null;
  budgetType?: BudgetType | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  departmentId?: string | null;
  targetDate?: Date | string | null;
  startDate?: Date | string | null;
  priority?: Priority | null;
  /**
   * Initial status. FIX-PROJ-D1 (Round-3 verification): previously the
   * repository hardcoded 'LEAD' and silently overwrote caller-supplied
   * values, so the FE wizard's Status dropdown had no effect. Now the
   * value is honoured. Default remains 'LEAD' so legacy callers without
   * an explicit status are unaffected.
   */
  status?: ProjectStatus;
  tags?: string[];
  goalIds?: string[];
  metadata?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown> | null;
  clonedFromProjectId?: string | null;
  /**
   * AI-derived project shape (from Hermes via ProjectShapeSynthesisService).
   * When set, ProjectsService.create() applies the shape inline (stages,
   * goals, members, CoS) and skips the ProjectType-based Phase 8/3A pipeline.
   * Persisted on Project.derivedShape for replan + corpus learning.
   * See memory-bank-new/plans/ai-driven-project-shape-synthesis-2026-07-19.md
   */
  derivedShape?: unknown;
  /** Schema version of derivedShape. Defaults to 1. */
  derivedShapeVersion?: number | null;
  /**
   * When true, allow creating a bare project with no projectTypeId and no
   * derivedShape. The project will be created with minimal info (name +
   * optional budget/priority/deadline) and NO automation pipeline will fire
   * (no goals, stages, members, CoS). Used by the CreateProjectTool as a
   * fallback when AI synthesis fails. Defaults to false (strict mode).
   */
  allowBareProject?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  customerId?: string | null;
  projectTypeId?: string | null;
  projectTypeVersion?: number | null;
  /**
   * Phase 0 G2 (INDUSTRY-SETUP-CONCEPT.md §3.1 G2). Updating the project's
   * industry tag. Normally only set automatically by ProjectsService.create()
   * — callers shouldn't override this directly.
   */
  industry?: string | null;
  budgetType?: BudgetType | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  departmentId?: string | null;
  targetDate?: Date | string | null;
  startDate?: Date | string | null;
  priority?: Priority | null;
  tags?: string[];
  goalIds?: string[];
  metadata?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown> | null;
  lostReason?: string | null;
}

export interface ListProjectsOptions {
  status?: import('../common/project-lifecycle').ProjectStatus;
  departmentId?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IProjectRepository {
  create(data: CreateProjectInput, tenantId: string): Promise<Project>;
  findById(id: string, tenantId: string): Promise<Project | null>;
  findAll(
    options: ListProjectsOptions,
    tenantId: string,
  ): Promise<{ data: Project[]; total: number }>;
  findByDepartment(departmentId: string, tenantId: string): Promise<Project[]>;
  update(
    id: string,
    tenantId: string,
    data: UpdateProjectInput,
  ): Promise<Project>;
  /** Atomic status transition — must be the only path to mutate `status`. */
  setStatus(
    id: string,
    tenantId: string,
    status: import('../common/project-lifecycle').ProjectStatus,
    extras?: { lostReason?: string | null; completedAt?: Date | null },
  ): Promise<Project>;
  delete(id: string, tenantId: string): Promise<void>;
  addGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project>;
  removeGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project>;
  createStages(
    projectId: string,
    stages: Array<{ name: string; order: number; description?: string }>,
  ): Promise<void>;
  cloneFromProject(
    sourceProjectId: string,
    newName: string,
    tenantId: string,
  ): Promise<Project>;
}

export interface ProjectWithRelations extends Project {
  department?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  goals?: Array<{ id: string; title: string; progress: number }>;
}

export const PROJECT_REPOSITORY = 'PROJECT_REPOSITORY';
