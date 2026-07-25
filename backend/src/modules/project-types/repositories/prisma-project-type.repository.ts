/**
 * ProjectTypes Module — Prisma Repository Implementation
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IProjectTypeRepository,
  ProjectType,
  ProjectTypeVersion,
  ProjectTypeWithVersions,
  CreateProjectTypeInput,
  UpdateProjectTypeInput,
  CreateProjectTypeVersionInput,
  ListProjectTypeOptions,
} from '../interfaces/project-type.interface';

@Injectable()
export class PrismaProjectTypeRepository implements IProjectTypeRepository {
  private readonly logger = new Logger(PrismaProjectTypeRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createType(
    data: CreateProjectTypeInput,
    tenantId: string | null,
  ): Promise<ProjectType> {
    this.logger.debug(`Creating project type: ${data.name}`);
    const created = await this.prisma.projectType.create({
      data: {
        name: data.name,
        slug: data.slug ?? this.slugify(data.name),
        industry: data.industry ?? null,
        isSystem: data.isSystem ?? false,
        classification: data.classification ?? null,
        tenantId,
      },
    });
    return this.mapToProjectType(created);
  }

  async findTypeById(
    id: string,
    tenantId: string | null,
  ): Promise<ProjectType | null> {
    const found = await this.prisma.projectType.findFirst({
      where: this.typeWhere(id, tenantId),
    });
    return found ? this.mapToProjectType(found) : null;
  }

  async findAllTypes(
    options: ListProjectTypeOptions,
    tenantId: string | null,
  ): Promise<{ data: ProjectType[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (tenantId !== null) {
      where.OR = [{ tenantId }, { tenantId: null, isSystem: true }];
    } else {
      where.tenantId = null;
      where.isSystem = true;
    }

    if (options.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }
    if (options.industry) {
      where.industry = options.industry;
    }
    if (options.classification) {
      where.classification = options.classification;
    }
    if (options.slugs && options.slugs.length > 0) {
      where.slug = { in: options.slugs };
    }

    const page = options.page || 1;
    const limit = options.limit || 20;

    const [items, total] = await Promise.all([
      this.prisma.projectType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.projectType.count({ where }),
    ]);

    // Deduplicate by (slug, industry): prefer tenant-scoped rows over system
    // rows so a tenant with a private override does not see both copies.
    const seen = new Map<string, (typeof items)[number]>();
    for (const row of items) {
      const key = `${row.slug}::${row.industry ?? ''}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, row);
        continue;
      }
      if (existing.tenantId == null && row.tenantId != null) {
        seen.set(key, row);
      }
    }
    const dedupedItems = Array.from(seen.values());

    return {
      data: dedupedItems.map((t) => this.mapToProjectType(t)),
      total: dedupedItems.length,
    };
  }

  async updateType(
    id: string,
    tenantId: string | null,
    data: UpdateProjectTypeInput,
  ): Promise<ProjectType> {
    const existing = await this.prisma.projectType.findFirst({
      where: this.typeWhere(id, tenantId),
    });
    if (!existing) {
      throw new NotFoundException(`ProjectType ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.classification !== undefined) {
      updateData.classification = data.classification;
    }

    const updated = await this.prisma.projectType.update({
      where: { id: existing.id },
      data: updateData,
    });
    return this.mapToProjectType(updated);
  }

  async deleteType(id: string, tenantId: string | null): Promise<void> {
    const existing = await this.prisma.projectType.findFirst({
      where: this.typeWhere(id, tenantId),
    });
    if (!existing) {
      throw new NotFoundException(`ProjectType ${id} not found`);
    }
    if (existing.isSystem) {
      throw new BadRequestException('System project types cannot be deleted');
    }
    await this.prisma.projectType.delete({ where: { id: existing.id } });
    this.logger.log(`Deleted project type: ${id}`);
  }

  // ─── Version operations ─────────────────────────────────────────────────────

  async createVersion(
    projectTypeId: string,
    data: CreateProjectTypeVersionInput,
  ): Promise<ProjectTypeVersion> {
    const latest = await this.prisma.projectTypeVersion.findFirst({
      where: { projectTypeId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await this.prisma.projectTypeVersion.create({
      data: {
        projectTypeId,
        version: nextVersion,
        fieldSchema: data.fieldSchema as unknown as Prisma.InputJsonValue,
        stageTemplate: data.stageTemplate as unknown as Prisma.InputJsonValue,
        approvalTemplate: (data.approvalTemplate ??
          []) as unknown as Prisma.InputJsonValue,
        goalTemplate: data.goalTemplate as unknown as Prisma.InputJsonValue,
        roleTemplate: data.roleTemplate as unknown as Prisma.InputJsonValue,
        informationRequirements: (data.informationRequirements ??
          []) as unknown as Prisma.InputJsonValue,
      },
    });
    return this.mapToVersion(created);
  }

  async findVersionById(id: string): Promise<ProjectTypeVersion | null> {
    const found = await this.prisma.projectTypeVersion.findUnique({
      where: { id },
    });
    return found ? this.mapToVersion(found) : null;
  }

  async findVersionsByTypeId(
    projectTypeId: string,
  ): Promise<ProjectTypeVersion[]> {
    const items = await this.prisma.projectTypeVersion.findMany({
      where: { projectTypeId },
      orderBy: { version: 'desc' },
    });
    return items.map((v) => this.mapToVersion(v));
  }

  async getCurrentVersion(
    projectTypeId: string,
  ): Promise<ProjectTypeVersion | null> {
    const found = await this.prisma.projectTypeVersion.findFirst({
      where: { projectTypeId },
      orderBy: { version: 'desc' },
    });
    return found ? this.mapToVersion(found) : null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private typeWhere(id: string, tenantId: string | null) {
    if (tenantId !== null) {
      return {
        id,
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      };
    }
    return { id, tenantId: null, isSystem: true };
  }

  private mapToProjectType(raw: {
    id: string;
    tenantId: string | null;
    name: string;
    slug: string | null;
    industry: string | null;
    isSystem: boolean;
    classification: ProjectType['classification'];
    createdAt: Date;
    updatedAt: Date;
  }): ProjectType {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      name: raw.name,
      slug: raw.slug ?? null,
      industry: raw.industry,
      isSystem: raw.isSystem,
      classification: raw.classification,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private mapToVersion(raw: {
    id: string;
    projectTypeId: string;
    version: number;
    fieldSchema: unknown;
    stageTemplate: unknown;
    approvalTemplate: unknown;
    goalTemplate: unknown | null;
    roleTemplate: unknown | null;
    informationRequirements: unknown | null;
    createdAt: Date;
  }): ProjectTypeVersion {
    return {
      id: raw.id,
      projectTypeId: raw.projectTypeId,
      version: raw.version,
      fieldSchema: raw.fieldSchema as ProjectTypeVersion['fieldSchema'],
      stageTemplate: raw.stageTemplate as ProjectTypeVersion['stageTemplate'],
      approvalTemplate:
        raw.approvalTemplate as ProjectTypeVersion['approvalTemplate'],
      goalTemplate: raw.goalTemplate,
      roleTemplate: raw.roleTemplate,
      informationRequirements: (raw.informationRequirements ??
        []) as ProjectTypeVersion['informationRequirements'],
      createdAt: raw.createdAt,
    };
  }
}
