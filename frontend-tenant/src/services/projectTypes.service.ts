/**
 * projectTypes.service.ts — Phase 2 ProjectType tenant service
 *
 * Wraps the backend project-types API for the tenant UI.
 *
 * Phase 2D: also exports `informationEngineService` — the read/write paths
 * for the Information Engine UI. Living in the same file keeps the
 * service boundary tight (the engine is reached via /projects/:id/* per
 * the project-creation-imp-plan.md §4.3 API surface).
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';
import type {
  ResolvedQuestion,
  EntityCompleteness,
  InformationResponseDto,
} from '@/components/discovery/types';

export type FieldSchemaItem = {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT';
  required?: boolean;
  options?: string[];
};

export type StageTemplateItem = {
  name: string;
  order: number;
  defaultDurationDays?: number;
};

export type ProjectTypeClassification =
  | 'CLIENT_ENGAGEMENT'
  | 'INTERNAL_INITIATIVE'
  | 'OPERATIONAL_PROGRAM';

export interface ProjectType {
  id: string;
  tenantId: string | null;
  name: string;
  slug: string | null;
  industry: string | null;
  isSystem: boolean;
  classification: ProjectTypeClassification | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypeVersion {
  id: string;
  projectTypeId: string;
  version: number;
  fieldSchema: FieldSchemaItem[];
  stageTemplate: StageTemplateItem[];
  approvalTemplate: unknown[];
  goalTemplate: unknown | null;
  roleTemplate: unknown | null;
  informationRequirements: import('@/components/discovery/types').InformationRequirement[];
  createdAt: string;
}

export const projectTypesService = {
  async list(opts?: {
    search?: string;
    industry?: string;
    classification?: ProjectTypeClassification;
    slugs?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ items: ProjectType[]; total: number }> {
    const params: Record<string, unknown> = { ...(opts ?? {}) };
    if (opts?.slugs && opts.slugs.length > 0) {
      // NestJS doesn't auto-array-stringify GET query params for class-validator
      // @IsArray(); send the canonical `slugs=a&slugs=b` shape via paramsSerializer.
      params.slugs = opts.slugs;
    }
    const res = await api.get('/project-types', {
      params,
      paramsSerializer: {
        indexes: null,
      },
    });
    const { items, total } = unwrapList(res);
    return { items: items as ProjectType[], total: total ?? items.length };
  },

  async get(id: string): Promise<ProjectType | null> {
    const res = await api.get(`/project-types/${id}`);
    return unwrapItem(res) as ProjectType | null;
  },

  async getCurrentVersion(projectTypeId: string): Promise<ProjectTypeVersion | null> {
    const res = await api.get(`/project-types/${projectTypeId}/versions/current`);
    return unwrapItem(res) as ProjectTypeVersion | null;
  },

  async listVersions(projectTypeId: string): Promise<ProjectTypeVersion[]> {
    const res = await api.get(`/project-types/${projectTypeId}/versions`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as ProjectTypeVersion[]) : [];
  },

  async listPacks(projectTypeId: string): Promise<
    Array<{
      projectTypeId: string;
      questionPackId: string;
      sortOrder: number;
      questionPack: {
        id: string;
        key: string;
        name: string;
        description: string | null;
        questions: import('@/components/discovery/types').InformationRequirement[];
        version: number;
        isSystem: boolean;
      };
    }>
  > {
    const res = await api.get(`/project-types/${projectTypeId}/packs`);
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  async replacePacks(
    projectTypeId: string,
    packIds: string[],
  ): Promise<unknown[]> {
    const res = await api.put(`/project-types/${projectTypeId}/packs`, { packIds });
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  },
};

/**
 * informationEngineService — Phase 2D tenant API for the EIE.
 *
 * Endpoints under /v1/projects/:id/* per project-creation-imp-plan.md §4.3.
 * Every write path triggers a CompletenessService recompute on the
 * server (engine invariant).
 */

export const informationEngineService = {
  /** Read the resolved question list for a project. */
  async getResolvedRequirements(projectId: string): Promise<{ questions: ResolvedQuestion[] }> {
    const res = await api.get(`/projects/${projectId}/information-requirements`);
    return unwrapItem(res) as { questions: ResolvedQuestion[] };
  },

  /** Read the deterministic next question (or null when complete). */
  async getNextQuestion(
    projectId: string,
  ): Promise<{ question: ResolvedQuestion | null; existingResponse?: { value: unknown; confidence: number } | null }> {
    const res = await api.get(`/projects/${projectId}/next-question`);
    return unwrapItem(res) as { question: ResolvedQuestion | null; existingResponse?: { value: unknown; confidence: number } | null };
  },

  /** Read the current EntityCompleteness row for a project. */
  async getCompleteness(projectId: string): Promise<EntityCompleteness> {
    const res = await api.get('/completeness', {
      params: { entityType: 'PROJECT', entityId: projectId },
    });
    return unwrapItem(res) as EntityCompleteness;
  },

  /** Record an answer. Triggers a server-side recompute. */
  async recordResponse(
    projectId: string,
    dto: {
      questionId: string;
      value: unknown;
      sourceType?: string;
      sourceLabel?: string;
      sourceRefType?: string;
      sourceRefId?: string;
      confidence?: number;
    },
  ): Promise<{ response: InformationResponseDto; completeness: EntityCompleteness }> {
    const res = await api.post('/responses', {
      entityType: 'PROJECT',
      entityId: projectId,
      ...dto,
    });
    return unwrapItem(res) as { response: InformationResponseDto; completeness: EntityCompleteness };
  },

  /** Upload a document and return candidate answers (Phase 2E). */
  async uploadDocument(
    projectId: string,
    file: File,
  ): Promise<{ documentId: string; candidates: InformationResponseDto[] }> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/projects/${projectId}/documents/extract`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapItem(res) as { documentId: string; candidates: InformationResponseDto[] };
  },

  /** Accept N candidates from a prior document upload (Phase 2E). */
  async acceptDocumentCandidates(
    documentId: string,
    acceptedQuestionIds: string[],
  ): Promise<EntityCompleteness> {
    const res = await api.post(`/projects/_/documents/${documentId}/accept`, {
      acceptedQuestionIds,
    });
    return unwrapItem(res) as EntityCompleteness;
  },

  /** Hermes-channel: get the conversational prompt. (Phase 2E.) */
  async askInterview(
    projectId: string,
  ): Promise<{
    prompt: string;
    question: ResolvedQuestion | null;
    completeness: EntityCompleteness;
  }> {
    const res = await api.post(`/projects/${projectId}/interview/ask`);
    return unwrapItem(res) as {
      prompt: string;
      question: ResolvedQuestion | null;
      completeness: EntityCompleteness;
    };
  },

  /** Hermes-channel: parse + record a free-form reply. (Phase 2E.) */
  async answerInterview(
    projectId: string,
    message: string,
  ): Promise<{ extracted: InformationResponseDto[]; completeness: EntityCompleteness }> {
    const res = await api.post(`/projects/${projectId}/interview/answer`, { message });
    return unwrapItem(res) as {
      extracted: InformationResponseDto[];
      completeness: EntityCompleteness;
    };
  },
};
