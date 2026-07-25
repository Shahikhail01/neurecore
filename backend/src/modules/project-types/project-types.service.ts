/**
 * ProjectTypes Service
 *
 * Phase 2: ProjectType + ProjectTypeVersion
 * SOLID: Single responsibility — owns ProjectType + Version lifecycle only.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import {
  I_PROJECT_TYPE_REPOSITORY,
  type IProjectTypeRepository,
} from './interfaces/project-type.interface';
import type {
  ProjectType,
  ProjectTypeVersion,
  CreateProjectTypeInput,
  UpdateProjectTypeInput,
  CreateProjectTypeVersionInput,
  ListProjectTypeOptions,
} from './interfaces/project-type.interface';

@Injectable()
export class ProjectTypesService {
  private readonly logger = new Logger(ProjectTypesService.name);

  constructor(
    @Inject(I_PROJECT_TYPE_REPOSITORY)
    private readonly repo: IProjectTypeRepository,
  ) {}

  // ─── Type CRUD ─────────────────────────────────────────────────────────────

  async createType(
    tenantId: string | null,
    dto: CreateProjectTypeInput,
  ): Promise<ProjectType> {
    return this.repo.createType(dto, tenantId);
  }

  async findTypeById(
    id: string,
    tenantId: string | null,
  ): Promise<ProjectType> {
    const found = await this.repo.findTypeById(id, tenantId);
    if (!found) throw new NotFoundException(`ProjectType ${id} not found`);
    return found;
  }

  async findAllTypes(
    tenantId: string | null,
    opts: ListProjectTypeOptions = {},
  ): Promise<{ data: ProjectType[]; total: number }> {
    return this.repo.findAllTypes(opts, tenantId);
  }

  async updateType(
    id: string,
    tenantId: string | null,
    dto: UpdateProjectTypeInput,
  ): Promise<ProjectType> {
    return this.repo.updateType(id, tenantId, dto);
  }

  async deleteType(id: string, tenantId: string | null): Promise<void> {
    return this.repo.deleteType(id, tenantId);
  }

  // ─── Version CRUD ───────────────────────────────────────────────────────────

  async createVersion(
    projectTypeId: string,
    tenantId: string | null,
    dto: CreateProjectTypeVersionInput,
  ): Promise<ProjectTypeVersion> {
    const pt = await this.repo.findTypeById(projectTypeId, tenantId);
    if (!pt)
      throw new NotFoundException(`ProjectType ${projectTypeId} not found`);

    return this.repo.createVersion(projectTypeId, dto);
  }

  async findVersionById(id: string): Promise<ProjectTypeVersion> {
    const found = await this.repo.findVersionById(id);
    if (!found)
      throw new NotFoundException(`ProjectTypeVersion ${id} not found`);
    return found;
  }

  async findVersionsByTypeId(
    projectTypeId: string,
    tenantId: string | null,
  ): Promise<ProjectTypeVersion[]> {
    const pt = await this.repo.findTypeById(projectTypeId, tenantId);
    if (!pt)
      throw new NotFoundException(`ProjectType ${projectTypeId} not found`);
    return this.repo.findVersionsByTypeId(projectTypeId);
  }

  async getCurrentVersion(
    projectTypeId: string,
    tenantId: string | null,
  ): Promise<ProjectTypeVersion | null> {
    const pt = await this.repo.findTypeById(projectTypeId, tenantId);
    if (!pt)
      throw new NotFoundException(`ProjectType ${projectTypeId} not found`);
    return this.repo.getCurrentVersion(projectTypeId);
  }

  // ─── Schema validation ─────────────────────────────────────────────────────

  validateCustomFields(
    fieldSchema: ProjectTypeVersion['fieldSchema'],
    customFieldValues: Record<string, unknown> | null | undefined,
  ): void {
    if (!fieldSchema || fieldSchema.length === 0) return;
    if (!customFieldValues || typeof customFieldValues !== 'object') {
      if (fieldSchema.some((f) => f.required)) {
        throw new BadRequestException(
          'customFieldValues is required for this project type',
        );
      }
      return;
    }

    const values = customFieldValues;

    for (const field of fieldSchema) {
      const value = values[field.key];

      if (
        field.required &&
        (value === undefined || value === null || value === '')
      ) {
        throw new BadRequestException(
          `Field "${field.label}" (${field.key}) is required`,
        );
      }

      if (value !== undefined && value !== null) {
        switch (field.type) {
          case 'NUMBER':
            if (typeof value !== 'number' || isNaN(value)) {
              throw new BadRequestException(
                `Field "${field.label}" must be a number`,
              );
            }
            break;
          case 'DATE':
            if (isNaN(Date.parse(String(value)))) {
              throw new BadRequestException(
                `Field "${field.label}" must be a valid date`,
              );
            }
            break;
          case 'SELECT':
            if (field.options && !field.options.includes(String(value))) {
              throw new BadRequestException(
                `Field "${field.label}" must be one of: ${field.options.join(', ')}`,
              );
            }
            break;
          case 'MULTI_SELECT':
            if (!Array.isArray(value)) {
              throw new BadRequestException(
                `Field "${field.label}" must be an array`,
              );
            }
            if (field.options) {
              const invalid = (value as string[]).filter(
                (v) => !field.options!.includes(v),
              );
              if (invalid.length > 0) {
                throw new BadRequestException(
                  `Field "${field.label}" contains invalid values: ${invalid.join(', ')}`,
                );
              }
            }
            break;
          case 'TEXT':
          default:
            if (typeof value !== 'string') {
              throw new BadRequestException(
                `Field "${field.label}" must be a string`,
              );
            }
            break;
        }
      }
    }
  }
}
