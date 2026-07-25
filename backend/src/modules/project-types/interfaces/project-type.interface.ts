/**
 * ProjectTypes Module — Interface Segregation
 *
 * Following SOLID principles:
 * - Single Responsibility: Each interface has ONE purpose
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Depend on abstractions, not concretions
 */

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

// ─── Phase 2A: ProjectTypeClassification (additive, optional) ────────────────

export type ProjectTypeClassification =
  | 'CLIENT_ENGAGEMENT'
  | 'INTERNAL_INITIATIVE'
  | 'OPERATIONAL_PROGRAM';

// ─── Phase 2A: InformationRequirement (the discovery question shape) ──────────

export type InformationRequirementType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'
  | 'CURRENCY';

export type InformationRequirement = {
  id: string;                  // unique within the version's requirements
  label: string;
  helpText?: string;
  type: InformationRequirementType;
  required: boolean;
  options?: string[];          // for SELECT / MULTI_SELECT
  appliesWhen?: AppliesWhenRule;
  mapsTo?: { field: string };  // e.g. { field: 'customFieldValues.taxYear' }
  skipIfConfidenceGte?: number;// 0-100; if any response at this confidence exists, don't ask
  askVia?: ('form' | 'interview' | 'document')[]; // channels (default: ['form'])
};

export type AppliesWhenRule = {
  hasCustomer?: boolean;
  classification?: ProjectTypeClassification[];
  // future: date, role, hasEntityField (resolved at app layer)
};

export type ProjectType = {
  id: string;
  tenantId: string | null;
  name: string;
  slug: string | null;
  industry: string | null;
  isSystem: boolean;
  classification: ProjectTypeClassification | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTypeVersion = {
  id: string;
  projectTypeId: string;
  version: number;
  fieldSchema: FieldSchemaItem[];
  stageTemplate: StageTemplateItem[];
  approvalTemplate: unknown[];
  goalTemplate: unknown | null;
  roleTemplate: unknown | null;
  informationRequirements: InformationRequirement[];
  createdAt: Date;
};

export type ProjectTypeWithVersions = ProjectType & {
  versions: ProjectTypeVersion[];
  _count?: { versions: number };
};

export type CreateProjectTypeInput = {
  name: string;
  slug?: string;
  industry?: string;
  isSystem?: boolean;
  classification?: ProjectTypeClassification;
};

export type UpdateProjectTypeInput = {
  name?: string;
  slug?: string;
  industry?: string;
  classification?: ProjectTypeClassification | null;
};

export type CreateProjectTypeVersionInput = {
  fieldSchema: FieldSchemaItem[];
  stageTemplate: StageTemplateItem[];
  approvalTemplate?: unknown[];
  goalTemplate?: unknown[];
  roleTemplate?: unknown[];
  informationRequirements?: InformationRequirement[];
};

export interface ListProjectTypeOptions {
  search?: string;
  industry?: string;
  classification?: ProjectTypeClassification;
  slugs?: string[];
  page?: number;
  limit?: number;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export const I_PROJECT_TYPE_REPOSITORY = 'I_PROJECT_TYPE_REPOSITORY';

export interface IProjectTypeRepository {
  createType(data: CreateProjectTypeInput, tenantId: string | null): Promise<ProjectType>;
  findTypeById(id: string, tenantId: string | null): Promise<ProjectType | null>;
  findAllTypes(options: ListProjectTypeOptions, tenantId: string | null): Promise<{ data: ProjectType[]; total: number }>;
  updateType(id: string, tenantId: string | null, data: UpdateProjectTypeInput): Promise<ProjectType>;
  deleteType(id: string, tenantId: string | null): Promise<void>;

  createVersion(projectTypeId: string, data: CreateProjectTypeVersionInput): Promise<ProjectTypeVersion>;
  findVersionById(id: string): Promise<ProjectTypeVersion | null>;
  findVersionsByTypeId(projectTypeId: string): Promise<ProjectTypeVersion[]>;
  getCurrentVersion(projectTypeId: string): Promise<ProjectTypeVersion | null>;
}
